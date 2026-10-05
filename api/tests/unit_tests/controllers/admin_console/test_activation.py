"""activation 端点（公开，无鉴权装饰器）：token 校验 + 设密码激活。

公开性用结构断言锁定：方法上仅一层 with_session（`__wrapped__` 一剥即到底），
不存在 system_admin_required/founder_admin_required。状态断言用 sqlite 实库。
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session
from werkzeug.exceptions import BadRequest

from controllers.console.admin_console import activation as activation_mod
from controllers.console.admin_console.activation import AdminActivationCheckQuery
from libs.password import compare_password
from models.account import Account, AccountStatus


def _seed_invitee(session: Session, *, status=AccountStatus.PENDING) -> Account:
    account = Account(
        name="invited",
        email="invited@x.com",
        status=status,
        is_system_admin=True,
        system_admin_source="invite",
    )
    session.add(account)
    session.commit()
    return account


class TestPublicWiring:
    """公开端点：装饰器链里不得出现鉴权层（剥掉唯一一层 with_session 后即原始函数）。"""

    def test_check_has_no_auth_decorator(self):
        assert not hasattr(activation_mod.AdminActivationCheckApi.get.__wrapped__, "__wrapped__")

    def test_activate_has_no_auth_decorator(self):
        assert not hasattr(activation_mod.AdminActivationApi.post.__wrapped__, "__wrapped__")


class TestCheck:
    def _raw(self):
        return activation_mod.AdminActivationCheckApi.get.__wrapped__

    def test_invalid_token(self):
        session = MagicMock()
        query = AdminActivationCheckQuery(token="x")
        with (
            patch.object(activation_mod, "query_params_from_request", return_value=query),
            patch.object(activation_mod, "get_invite", return_value=None),
        ):
            body, status = self._raw()(activation_mod.AdminActivationCheckApi(), session)

        assert status == 200
        assert body == {"is_valid": False, "email": None}

    def test_valid_token_with_pending_account(self, sqlite_session: Session):
        invitee = _seed_invitee(sqlite_session)
        with (
            patch.object(
                activation_mod, "query_params_from_request", return_value=AdminActivationCheckQuery(token="tok-1")
            ),
            patch.object(activation_mod, "get_invite", return_value={"account_id": invitee.id, "email": invitee.email}),
        ):
            body, status = self._raw()(activation_mod.AdminActivationCheckApi(), sqlite_session)

        assert status == 200
        assert body == {"is_valid": True, "email": "invited@x.com"}

    def test_token_valid_but_account_already_active(self, sqlite_session: Session):
        invitee = _seed_invitee(sqlite_session, status=AccountStatus.ACTIVE)
        with (
            patch.object(
                activation_mod, "query_params_from_request", return_value=AdminActivationCheckQuery(token="tok-1")
            ),
            patch.object(activation_mod, "get_invite", return_value={"account_id": invitee.id, "email": invitee.email}),
        ):
            body, status = self._raw()(activation_mod.AdminActivationCheckApi(), sqlite_session)

        assert status == 200
        assert body["is_valid"] is False


class TestActivate:
    def _raw(self):
        return activation_mod.AdminActivationApi.post.__wrapped__

    def _payload(self, **overrides):
        payload = {"token": "tok-1", "name": "New Name", "password": "abcd1234", "interface_language": "en-US"}
        payload.update(overrides)
        return payload

    def test_invalid_token_400(self):
        session = MagicMock()
        mock_ns = MagicMock(payload=self._payload())
        with (
            patch.object(activation_mod, "console_ns", mock_ns),
            patch.object(activation_mod, "get_invite", return_value=None),
            pytest.raises(BadRequest),
        ):
            self._raw()(activation_mod.AdminActivationApi(), session)

    def test_token_valid_but_account_missing_400(self, sqlite_session: Session):
        invite = {"account_id": "ghost", "email": "invited@x.com"}
        mock_ns = MagicMock(payload=self._payload())
        with (
            patch.object(activation_mod, "console_ns", mock_ns),
            patch.object(activation_mod, "get_invite", return_value=invite),
            pytest.raises(BadRequest),
        ):
            self._raw()(activation_mod.AdminActivationApi(), sqlite_session)

    def test_already_activated_account_400(self, sqlite_session: Session):
        invitee = _seed_invitee(sqlite_session, status=AccountStatus.ACTIVE)
        invite = {"account_id": invitee.id, "email": invitee.email}
        mock_ns = MagicMock(payload=self._payload())
        with (
            patch.object(activation_mod, "console_ns", mock_ns),
            patch.object(activation_mod, "get_invite", return_value=invite),
            pytest.raises(BadRequest),
        ):
            self._raw()(activation_mod.AdminActivationApi(), sqlite_session)

    def test_weak_password_400(self, sqlite_session: Session):
        invitee = _seed_invitee(sqlite_session)
        invite = {"account_id": invitee.id, "email": invitee.email}
        mock_ns = MagicMock(payload=self._payload(password="short"))
        with (
            patch.object(activation_mod, "console_ns", mock_ns),
            patch.object(activation_mod, "get_invite", return_value=invite),
            pytest.raises(BadRequest),
        ):
            self._raw()(activation_mod.AdminActivationApi(), sqlite_session)

    def test_happy_path_activates_and_revokes_token(self, sqlite_session: Session):
        invitee = _seed_invitee(sqlite_session)
        with (
            patch.object(activation_mod, "console_ns") as mock_ns,
            patch.object(activation_mod, "get_invite", return_value={"account_id": invitee.id, "email": invitee.email}),
            patch.object(activation_mod, "revoke_invite_token") as mock_revoke,
        ):
            mock_ns.payload = self._payload()
            body, status = self._raw()(activation_mod.AdminActivationApi(), sqlite_session)

        assert status == 200
        assert body["result"] == "success"
        assert invitee.status == AccountStatus.ACTIVE
        assert invitee.name == "New Name"
        assert invitee.initialized_at is not None
        # 密码真实落库：hash_password 产线口径可被 compare_password 校验
        assert compare_password("abcd1234", invitee.password, invitee.password_salt) is True
        mock_revoke.assert_called_once_with("tok-1")
