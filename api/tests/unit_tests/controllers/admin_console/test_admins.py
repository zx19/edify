"""admins 端点：两级名单（roster/grant/revoke/transfer）鉴权接线 + 分支约束。

装饰器真跑（patch controllers.console.admin 的名字），业务层走
`.__wrapped__.__wrapped__` 直调原始方法（跳过 founder/system_admin_required 与 with_session）。
状态断言用 sqlite 实库；current_password 校验走真实 compare_password（锁定接线）。
"""

import base64
import secrets
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from werkzeug.exceptions import BadRequest, Forbidden, NotFound, Unauthorized

from controllers.console.admin_console import admins as admins_mod
from libs.password import hash_password
from models.account import Account, AccountStatus
from models.admin_audit import AdminAuditLog

_FOUNDER_PASSWORD = "founder-pass1"


def _unauthenticated():
    return patch("controllers.console.admin.current_user", MagicMock(is_authenticated=False))


def _non_admin():
    return patch.multiple(
        "controllers.console.admin",
        current_user=MagicMock(is_authenticated=True),
        is_system_admin=MagicMock(return_value=False),
    )


def _non_founder():
    return patch.multiple(
        "controllers.console.admin",
        current_user=MagicMock(is_authenticated=True),
        is_founder_admin=MagicMock(return_value=False),
    )


def _hash(password: str, salt: bytes) -> str:
    return base64.b64encode(hash_password(password, salt)).decode()


def _founder_mock(password: str = _FOUNDER_PASSWORD) -> MagicMock:
    salt = secrets.token_bytes(16)
    founder = MagicMock(id="founder-1", email="founder@x.com")
    founder.name = "Founder"
    founder.password_salt = base64.b64encode(salt).decode()
    founder.password = _hash(password, salt)
    return founder


def _seed_account(session: Session, email: str, *, password: str | None = None, **flags) -> Account:
    account = Account(name=email.split("@")[0], email=email, **flags)
    if password is not None:
        salt = secrets.token_bytes(16)
        account.password_salt = base64.b64encode(salt).decode()
        account.password = _hash(password, salt)
    session.add(account)
    session.commit()
    return account


def _seed_founder(session: Session, password: str = _FOUNDER_PASSWORD) -> Account:
    return _seed_account(
        session,
        "founder@x.com",
        password=password,
        status=AccountStatus.ACTIVE,
        is_system_admin=True,
        system_admin_source="install",
    )


def _account_mock(**attrs) -> MagicMock:
    """Mock 构造器的 name= 是保留字（repr 名），不会落到 .name 属性——统一构造后赋值。"""
    mock = MagicMock()
    for key, value in attrs.items():
        setattr(mock, key, value)
    return mock


class TestGuards:
    def test_roster_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            admins_mod.SystemAdminListApi().get()

    def test_roster_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            admins_mod.SystemAdminListApi().get()

    def test_grant_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            admins_mod.SystemAdminListApi().post()

    def test_grant_rejects_non_founder(self):
        with _non_founder(), pytest.raises(Forbidden):
            admins_mod.SystemAdminListApi().post()

    def test_revoke_rejects_non_founder(self):
        with _non_founder(), pytest.raises(Forbidden):
            admins_mod.SystemAdminApi().delete(account_id="a-1")

    def test_transfer_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            admins_mod.SystemAdminTransferApi().post()

    def test_transfer_rejects_non_founder(self):
        with _non_founder(), pytest.raises(Forbidden):
            admins_mod.SystemAdminTransferApi().post()


def _raw_grant():
    return admins_mod.SystemAdminListApi.post.__wrapped__.__wrapped__


def _raw_revoke():
    return admins_mod.SystemAdminApi.delete.__wrapped__.__wrapped__


def _raw_transfer():
    return admins_mod.SystemAdminTransferApi.post.__wrapped__.__wrapped__


class TestGrant:
    def test_wrong_current_password_forbidden(self):
        session = MagicMock()
        mock_ns = MagicMock(payload={"email": "dev@x.com", "current_password": "wrong-pass1"})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(Forbidden),
        ):
            _raw_grant()(admins_mod.SystemAdminListApi(), session)

    def test_active_account_direct_grant(self):
        account = _account_mock(
            id="a-1",
            email="dev@x.com",
            name="Dev",
            status=AccountStatus.ACTIVE,
            is_system_admin=False,
            system_admin_source=None,
        )
        session = MagicMock()
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch.object(admins_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=account),
            patch.object(admins_mod, "send_inner_email_task") as mock_mail,
            patch.object(admins_mod, "audit_log") as mock_audit,
        ):
            mock_ns.payload = {"email": "dev@x.com", "current_password": _FOUNDER_PASSWORD}
            body, status = _raw_grant()(admins_mod.SystemAdminListApi(), session)

        assert status == 201
        assert account.is_system_admin is True
        assert account.system_admin_source == "grant"
        assert body["source"] == "grant"
        assert body["pending"] is False
        assert body["invite_url"] is None
        mock_mail.delay.assert_called_once()
        assert mock_audit.call_args.args[0] == "admin.grant"
        detail = mock_audit.call_args.kwargs["detail"]
        assert detail["branch"] == "direct"
        assert detail["email_sent"] is True

    def test_direct_grant_mail_failure_non_blocking(self):
        account = _account_mock(
            id="a-1",
            email="dev@x.com",
            name="Dev",
            status=AccountStatus.ACTIVE,
            is_system_admin=False,
            system_admin_source=None,
        )
        session = MagicMock()
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch.object(admins_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=account),
            patch.object(admins_mod, "send_inner_email_task") as mock_mail,
            patch.object(admins_mod, "audit_log") as mock_audit,
        ):
            mock_ns.payload = {"email": "dev@x.com", "current_password": _FOUNDER_PASSWORD}
            mock_mail.delay.side_effect = RuntimeError("smtp down")
            body, status = _raw_grant()(admins_mod.SystemAdminListApi(), session)

        assert status == 201
        assert account.is_system_admin is True
        assert mock_audit.call_args.kwargs["detail"]["email_sent"] is False

    def test_grant_already_admin_is_idempotent(self):
        account = _account_mock(
            id="a-1",
            email="dev@x.com",
            name="Dev",
            status=AccountStatus.ACTIVE,
            is_system_admin=True,
            system_admin_source="grant",
        )
        session = MagicMock()
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch.object(admins_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=account),
            patch.object(admins_mod, "send_inner_email_task") as mock_mail,
            patch.object(admins_mod, "audit_log") as mock_audit,
        ):
            mock_ns.payload = {"email": "dev@x.com", "current_password": _FOUNDER_PASSWORD}
            body, status = _raw_grant()(admins_mod.SystemAdminListApi(), session)

        assert status == 201
        assert account.system_admin_source == "grant"
        mock_mail.delay.assert_not_called()
        mock_audit.assert_not_called()

    def test_unregistered_account_invite_branch(self):
        pending = _account_mock(
            id="a-2",
            email="new@x.com",
            name="new",
            status=AccountStatus.PENDING,
            is_system_admin=False,
            system_admin_source=None,
            interface_language="en-US",
        )
        session = MagicMock()
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch.object(admins_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=None),
            patch.object(admins_mod.RegisterService, "register", return_value=pending) as mock_register,
            patch.object(admins_mod, "issue_invite_token", return_value="tok-1") as mock_issue,
            patch.object(admins_mod, "send_inner_email_task") as mock_mail,
            patch.object(admins_mod, "audit_log") as mock_audit,
        ):
            mock_ns.payload = {"email": "new@x.com", "current_password": _FOUNDER_PASSWORD}
            body, status = _raw_grant()(admins_mod.SystemAdminListApi(), session)

        assert status == 201
        assert body["invite_url"] == "/activate?token=tok-1"
        assert body["pending"] is True
        assert pending.is_system_admin is True
        assert pending.system_admin_source == "invite"
        assert mock_register.call_args.kwargs["status"] == AccountStatus.PENDING
        assert mock_register.call_args.kwargs["create_workspace_required"] is False
        assert mock_issue.call_args.args == ("a-2", "new@x.com")
        mock_mail.delay.assert_called_once()
        detail = mock_audit.call_args.kwargs["detail"]
        assert detail["branch"] == "invite"
        assert detail["invite_mail_dispatched"] is True

    def test_pending_invite_resend_refreshes_token(self):
        account = _account_mock(
            id="a-3",
            email="invited@x.com",
            name="invited",
            status=AccountStatus.PENDING,
            is_system_admin=True,
            system_admin_source="invite",
            interface_language="en-US",
        )
        session = MagicMock()
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch.object(admins_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=account),
            patch.object(admins_mod.RegisterService, "register") as mock_register,
            patch.object(admins_mod, "issue_invite_token", return_value="tok-2") as mock_issue,
            patch.object(admins_mod, "send_inner_email_task") as mock_mail,
            patch.object(admins_mod, "audit_log") as mock_audit,
        ):
            mock_ns.payload = {"email": "invited@x.com", "current_password": _FOUNDER_PASSWORD}
            body, status = _raw_grant()(admins_mod.SystemAdminListApi(), session)

        assert status == 201
        assert body["invite_url"] == "/activate?token=tok-2"
        mock_register.assert_not_called()
        mock_issue.assert_called_once_with("a-3", "invited@x.com")
        mock_mail.delay.assert_called_once()
        assert mock_audit.call_args.kwargs["detail"]["branch"] == "resend"

    def test_banned_account_rejected(self):
        account = _account_mock(id="a-4", email="banned@x.com", status=AccountStatus.BANNED)
        session = MagicMock()
        mock_ns = MagicMock(payload={"email": "banned@x.com", "current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch.object(admins_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=account),
            pytest.raises(BadRequest),
        ):
            _raw_grant()(admins_mod.SystemAdminListApi(), session)


class TestRevoke:
    def test_wrong_current_password_forbidden(self):
        session = MagicMock()
        mock_ns = MagicMock(payload={"current_password": "wrong-pass1"})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(Forbidden),
        ):
            _raw_revoke()(admins_mod.SystemAdminApi(), session, "a-1")

    def test_founder_self_revoke_forbidden(self):
        founder = _founder_mock()
        session = MagicMock()
        session.get.return_value = founder
        mock_ns = MagicMock(payload={"current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", founder),
            pytest.raises(Forbidden),
        ):
            _raw_revoke()(admins_mod.SystemAdminApi(), session, founder.id)

    def test_env_listed_admin_rejected(self):
        target = _account_mock(
            id="a-9",
            email="ops@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=False,
            system_admin_source=None,
        )
        session = MagicMock()
        session.get.return_value = target
        env_cfg = MagicMock(SYSTEM_ADMIN_EMAILS=["ops@x.com"])
        mock_ns = MagicMock(payload={"current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch("services.system_admin_service.dify_config", env_cfg),
            pytest.raises(BadRequest),
        ):
            _raw_revoke()(admins_mod.SystemAdminApi(), session, "a-9")

    def test_non_admin_rejected(self):
        target = _account_mock(
            id="a-9",
            email="plain@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=False,
            system_admin_source=None,
        )
        session = MagicMock()
        session.get.return_value = target
        env_cfg = MagicMock(SYSTEM_ADMIN_EMAILS=[])
        mock_ns = MagicMock(payload={"current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            patch("services.system_admin_service.dify_config", env_cfg),
            pytest.raises(BadRequest),
        ):
            _raw_revoke()(admins_mod.SystemAdminApi(), session, "a-9")

    def test_missing_account_404(self):
        session = MagicMock()
        session.get.return_value = None
        mock_ns = MagicMock(payload={"current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(NotFound),
        ):
            _raw_revoke()(admins_mod.SystemAdminApi(), session, "ghost")

    def test_revoke_active_db_admin(self, sqlite_session: Session):
        founder = _seed_founder(sqlite_session)
        grantee = _seed_account(
            sqlite_session,
            "dev@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=True,
            system_admin_source="grant",
        )
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", founder),
        ):
            mock_ns.payload = {"current_password": _FOUNDER_PASSWORD}
            body, status = _raw_revoke()(admins_mod.SystemAdminApi(), sqlite_session, grantee.id)

        assert status == 200
        assert body["result"] == "success"
        assert grantee.is_system_admin is False
        assert grantee.system_admin_source is None
        audit = sqlite_session.scalar(select(AdminAuditLog).where(AdminAuditLog.action == "admin.revoke"))
        assert audit is not None
        assert audit.actor_account_id == founder.id
        assert audit.target_id == grantee.id

    def test_revoke_pending_invite_revokes_token(self, sqlite_session: Session):
        _seed_founder(sqlite_session)
        invitee = _seed_account(
            sqlite_session,
            "invited@x.com",
            status=AccountStatus.PENDING,
            is_system_admin=True,
            system_admin_source="invite",
        )
        founder = sqlite_session.scalar(select(Account).where(Account.email == "founder@x.com"))
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", founder),
            patch.object(admins_mod, "revoke_invite_for_account") as mock_revoke_token,
        ):
            mock_ns.payload = {"current_password": _FOUNDER_PASSWORD}
            body, status = _raw_revoke()(admins_mod.SystemAdminApi(), sqlite_session, invitee.id)

        assert status == 200
        assert invitee.is_system_admin is False
        assert invitee.system_admin_source is None
        mock_revoke_token.assert_called_once_with(invitee.id)
        audit = sqlite_session.scalar(select(AdminAuditLog).where(AdminAuditLog.action == "admin.revoke"))
        assert audit is not None


class TestTransfer:
    def test_wrong_current_password_forbidden(self):
        session = MagicMock()
        mock_ns = MagicMock(payload={"account_id": "a-1", "current_password": "wrong-pass1"})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(Forbidden),
        ):
            _raw_transfer()(admins_mod.SystemAdminTransferApi(), session)

    def test_target_env_listed_rejected(self):
        target = _account_mock(
            id="a-9",
            email="ops@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=False,
            system_admin_source=None,
        )
        session = MagicMock()
        session.get.return_value = target
        mock_ns = MagicMock(payload={"account_id": "a-9", "current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(BadRequest),
        ):
            _raw_transfer()(admins_mod.SystemAdminTransferApi(), session)

    def test_target_non_admin_rejected(self):
        target = _account_mock(
            id="a-9",
            email="plain@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=False,
            system_admin_source=None,
        )
        session = MagicMock()
        session.get.return_value = target
        mock_ns = MagicMock(payload={"account_id": "a-9", "current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(BadRequest),
        ):
            _raw_transfer()(admins_mod.SystemAdminTransferApi(), session)

    def test_target_pending_invite_rejected(self):
        target = _account_mock(
            id="a-9",
            email="invited@x.com",
            status=AccountStatus.PENDING,
            is_system_admin=True,
            system_admin_source="invite",
        )
        session = MagicMock()
        session.get.return_value = target
        mock_ns = MagicMock(payload={"account_id": "a-9", "current_password": _FOUNDER_PASSWORD})
        with (
            patch.object(admins_mod, "console_ns", mock_ns),
            patch.object(admins_mod, "current_user", _founder_mock()),
            pytest.raises(BadRequest),
        ):
            _raw_transfer()(admins_mod.SystemAdminTransferApi(), session)

    def test_transfer_swaps_founder(self, sqlite_session: Session):
        founder = _seed_founder(sqlite_session)
        target = _seed_account(
            sqlite_session,
            "dev@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=True,
            system_admin_source="grant",
        )
        with (
            patch.object(admins_mod, "console_ns") as mock_ns,
            patch.object(admins_mod, "current_user", founder),
        ):
            mock_ns.payload = {"account_id": target.id, "current_password": _FOUNDER_PASSWORD}
            body, status = _raw_transfer()(admins_mod.SystemAdminTransferApi(), sqlite_session)

        assert status == 200
        assert body["result"] == "success"
        assert founder.system_admin_source == "grant"
        assert target.system_admin_source == "install"
        audit = sqlite_session.scalar(select(AdminAuditLog).where(AdminAuditLog.action == "admin.transfer"))
        assert audit is not None
        assert audit.actor_account_id == founder.id
        assert audit.target_id == target.id


class TestRoster:
    def test_roster_merges_db_and_env(self, sqlite_session: Session):
        founder = _seed_founder(sqlite_session)
        grantee = _seed_account(
            sqlite_session,
            "dev@x.com",
            status=AccountStatus.ACTIVE,
            is_system_admin=True,
            system_admin_source="grant",
        )
        invitee = _seed_account(
            sqlite_session,
            "invited@x.com",
            status=AccountStatus.PENDING,
            is_system_admin=True,
            system_admin_source="invite",
        )
        env_admin = _seed_account(sqlite_session, "ops@x.com", status=AccountStatus.ACTIVE)
        plain = _seed_account(sqlite_session, "plain@x.com", status=AccountStatus.ACTIVE)
        env_cfg = MagicMock(SYSTEM_ADMIN_EMAILS=["ops@x.com", "founder@x.com", "ghost@x.com"])

        with (
            patch.object(admins_mod, "dify_config", env_cfg),
            patch("services.system_admin_service.dify_config", env_cfg),
        ):
            body, status = admins_mod.SystemAdminListApi.get.__wrapped__.__wrapped__(
                admins_mod.SystemAdminListApi(), sqlite_session
            )

        assert status == 200
        rows = {row["email"]: row for row in body["data"]}
        # DB 管理员 ∪ env 已注册账号；普通账号与未注册 env 邮箱不进名单
        assert set(rows) == {founder.email, grantee.email, invitee.email, env_admin.email}
        assert rows[founder.email]["source"] == "install"  # env 命中不覆盖 DB 持久化来源
        assert rows[grantee.email]["source"] == "grant"
        assert rows[invitee.email]["source"] == "invite"
        assert rows[invitee.email]["pending"] is True
        assert rows[env_admin.email]["source"] == "env"
        assert rows[env_admin.email]["pending"] is False
        assert plain.email not in rows
