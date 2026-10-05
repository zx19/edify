"""系统管理员邀请 token redis 存取：签发/查询/作废 + 反向索引（按账号作废）。"""

import json
from unittest.mock import patch

from services import system_admin_invite_service as invite_svc


def _payload(account_id="a-1", email="e@x.com") -> bytes:
    return json.dumps({"account_id": account_id, "email": email}, ensure_ascii=False).encode()


class TestIssue:
    @patch("services.system_admin_invite_service.redis_client")
    def test_stores_token_and_reverse_index_with_ttl(self, mock_redis):
        mock_redis.get.return_value = None

        token = invite_svc.issue_invite_token("a-1", "e@x.com")

        ttl = invite_svc.SYSTEM_ADMIN_INVITE_EXPIRY_HOURS * 3600
        mock_redis.setex.assert_any_call(
            f"system_admin_invite:token:{token}",
            ttl,
            json.dumps({"account_id": "a-1", "email": "e@x.com"}, ensure_ascii=False),
        )
        mock_redis.setex.assert_any_call("system_admin_invite:account:a-1", ttl, token)

    @patch("services.system_admin_invite_service.redis_client")
    def test_resend_revokes_previous_token(self, mock_redis):
        mock_redis.get.return_value = b"old-token"

        invite_svc.issue_invite_token("a-1", "e@x.com")

        mock_redis.delete.assert_any_call("system_admin_invite:token:old-token")
        mock_redis.delete.assert_any_call("system_admin_invite:account:a-1")


class TestGet:
    @patch("services.system_admin_invite_service.redis_client")
    def test_hit_returns_payload(self, mock_redis):
        mock_redis.get.return_value = _payload()

        assert invite_svc.get_invite("tok") == {"account_id": "a-1", "email": "e@x.com"}
        mock_redis.get.assert_called_once_with("system_admin_invite:token:tok")

    @patch("services.system_admin_invite_service.redis_client")
    def test_miss_returns_none(self, mock_redis):
        mock_redis.get.return_value = None

        assert invite_svc.get_invite("ghost") is None


class TestRevoke:
    @patch("services.system_admin_invite_service.redis_client")
    def test_revoke_token_clears_both_indexes(self, mock_redis):
        mock_redis.get.return_value = _payload()

        invite_svc.revoke_invite_token("tok")

        mock_redis.delete.assert_any_call("system_admin_invite:token:tok")
        mock_redis.delete.assert_any_call("system_admin_invite:account:a-1")

    @patch("services.system_admin_invite_service.redis_client")
    def test_revoke_for_account_clears_token(self, mock_redis):
        mock_redis.get.return_value = b"tok-1"

        invite_svc.revoke_invite_for_account("a-1")

        mock_redis.delete.assert_any_call("system_admin_invite:account:a-1")
        mock_redis.delete.assert_any_call("system_admin_invite:token:tok-1")

    @patch("services.system_admin_invite_service.redis_client")
    def test_revoke_for_account_without_token_is_noop(self, mock_redis):
        mock_redis.get.return_value = None

        invite_svc.revoke_invite_for_account("a-9")

        mock_redis.delete.assert_called_once_with("system_admin_invite:account:a-9")
