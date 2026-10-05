"""workspaces 端点：鉴权接线 + 创建双分支 + 归档幂等。

装饰器真跑（patch controllers.console.admin 的名字），业务层走
`.__wrapped__.__wrapped__` 直调原始方法（跳过 system_admin_required 与 with_session）。
"""

from unittest.mock import MagicMock, patch

import pytest
from werkzeug.exceptions import Forbidden, NotFound, Unauthorized

from controllers.console.admin_console import workspaces as workspaces_mod
from controllers.console.admin_console.workspaces import AdminWorkspaceCreatePayload
from models.account import AccountStatus, TenantStatus


def _unauthenticated():
    return patch("controllers.console.admin.current_user", MagicMock(is_authenticated=False))


def _non_admin():
    return patch.multiple(
        "controllers.console.admin",
        current_user=MagicMock(is_authenticated=True),
        is_system_admin=MagicMock(return_value=False),
    )


class TestGuards:
    def test_list_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            workspaces_mod.WorkspaceListApi().get()

    def test_list_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            workspaces_mod.WorkspaceListApi().get()

    def test_create_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            workspaces_mod.WorkspaceListApi().post()

    def test_create_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            workspaces_mod.WorkspaceListApi().post()

    def test_archive_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            workspaces_mod.WorkspaceArchiveApi().post(tenant_id="t-1")

    def test_unarchive_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            workspaces_mod.WorkspaceUnarchiveApi().post(tenant_id="t-1")


def _raw_post():
    return workspaces_mod.WorkspaceListApi.post.__wrapped__.__wrapped__


def _actor():
    actor = MagicMock(id="actor-1")
    actor.name = "Ops"
    return actor


def _payload() -> AdminWorkspaceCreatePayload:
    return AdminWorkspaceCreatePayload(name="研发部", owner_email="dev@x.com")


class TestCreateWorkspace:
    def test_registered_active_owner_direct(self):
        owner = MagicMock(status=AccountStatus.ACTIVE, email="dev@x.com")
        tenant = MagicMock(id="t-1")
        tenant.name = "研发部"
        session = MagicMock()
        with (
            patch.object(workspaces_mod, "console_ns") as mock_ns,
            patch.object(workspaces_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=owner),
            patch.object(workspaces_mod.TenantService, "create_owner_tenant", return_value=tenant) as mock_create,
            patch.object(workspaces_mod, "audit_log") as mock_audit,
            patch.object(workspaces_mod, "current_user", MagicMock(id="actor-1")),
        ):
            mock_ns.payload = {"name": "研发部", "owner_email": "dev@x.com"}
            body, status = _raw_post()(workspaces_mod.WorkspaceListApi(), session)

        assert status == 201
        assert body["owner_pending"] is False
        assert body["invite_url"] is None
        mock_create.assert_called_once()
        assert mock_create.call_args.kwargs["is_from_dashboard"] is True
        assert mock_audit.call_args.args[0] == "workspace.create"
        assert mock_audit.call_args.kwargs["detail"]["owner_pending"] is False

    def test_unregistered_owner_pending_invite(self):
        pending_owner = MagicMock(status=AccountStatus.PENDING, email="new@x.com", interface_language="en-US")
        tenant = MagicMock(id="t-2")
        tenant.name = "研发部"
        session = MagicMock()
        with (
            patch.object(workspaces_mod, "console_ns") as mock_ns,
            patch.object(workspaces_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=None),
            patch.object(workspaces_mod.RegisterService, "register", return_value=pending_owner) as mock_register,
            patch.object(workspaces_mod.TenantService, "create_owner_tenant", return_value=tenant),
            patch.object(workspaces_mod.RegisterService, "generate_invite_token", return_value="tok-1"),
            patch.object(workspaces_mod, "send_invite_member_mail_task") as mock_mail,
            patch.object(workspaces_mod, "audit_log") as mock_audit,
            patch.object(workspaces_mod, "current_user", _actor()),
        ):
            mock_ns.payload = {"name": "研发部", "owner_email": "new@x.com"}
            body, status = _raw_post()(workspaces_mod.WorkspaceListApi(), session)

        assert status == 201
        assert body["owner_pending"] is True
        assert body["invite_url"] == "/activate?token=tok-1"
        # PENDING 预创建不得顺手建个人空间（空间由本端点显式创建）
        assert mock_register.call_args.kwargs["create_workspace_required"] is False
        assert mock_register.call_args.kwargs["status"] == AccountStatus.PENDING
        mock_mail.delay.assert_called_once()
        detail = mock_audit.call_args.kwargs["detail"]
        assert detail["owner_pending"] is True
        assert detail["invite_mail_dispatched"] is True

    def test_invite_mail_failure_non_blocking(self):
        pending_owner = MagicMock(status=AccountStatus.PENDING, email="new@x.com", interface_language=None)
        tenant = MagicMock(id="t-3")
        tenant.name = "研发部"
        session = MagicMock()
        with (
            patch.object(workspaces_mod, "console_ns") as mock_ns,
            patch.object(workspaces_mod.AccountService, "get_account_by_email_with_case_fallback", return_value=None),
            patch.object(workspaces_mod.RegisterService, "register", return_value=pending_owner),
            patch.object(workspaces_mod.TenantService, "create_owner_tenant", return_value=tenant),
            patch.object(workspaces_mod.RegisterService, "generate_invite_token", return_value="tok-2"),
            patch.object(workspaces_mod, "send_invite_member_mail_task") as mock_mail,
            patch.object(workspaces_mod, "audit_log") as mock_audit,
            patch.object(workspaces_mod, "current_user", _actor()),
        ):
            mock_ns.payload = {"name": "研发部", "owner_email": "new@x.com"}
            mock_mail.delay.side_effect = RuntimeError("smtp down")
            body, status = _raw_post()(workspaces_mod.WorkspaceListApi(), session)

        assert status == 201
        assert body["invite_url"] == "/activate?token=tok-2"
        assert mock_audit.call_args.kwargs["detail"]["invite_mail_dispatched"] is False


class TestArchiveIdempotency:
    def test_archive_transitions_and_audits(self):
        tenant = MagicMock(id="t-1", status=TenantStatus.NORMAL)
        tenant.name = "研发部"
        session = MagicMock()
        session.get.return_value = tenant
        with (
            patch.object(workspaces_mod, "audit_log") as mock_audit,
            patch.object(workspaces_mod, "current_user", MagicMock(id="actor-1")),
        ):
            result, status = workspaces_mod.WorkspaceArchiveApi.post.__wrapped__.__wrapped__(
                workspaces_mod.WorkspaceArchiveApi(), session, "t-1"
            )

        assert status == 200
        assert tenant.status == TenantStatus.ARCHIVE
        assert mock_audit.call_args.args[0] == "workspace.archive"

    def test_archive_already_archived_is_idempotent(self):
        tenant = MagicMock(id="t-1", status=TenantStatus.ARCHIVE)
        session = MagicMock()
        session.get.return_value = tenant
        with (
            patch.object(workspaces_mod, "audit_log") as mock_audit,
            patch.object(workspaces_mod, "current_user", MagicMock(id="actor-1")),
        ):
            result, status = workspaces_mod.WorkspaceArchiveApi.post.__wrapped__.__wrapped__(
                workspaces_mod.WorkspaceArchiveApi(), session, "t-1"
            )

        assert status == 200
        assert result["status"] == "archive"
        mock_audit.assert_not_called()

    def test_unarchive_restores_normal(self):
        tenant = MagicMock(id="t-1", status=TenantStatus.ARCHIVE)
        session = MagicMock()
        session.get.return_value = tenant
        with (
            patch.object(workspaces_mod, "audit_log") as mock_audit,
            patch.object(workspaces_mod, "current_user", MagicMock(id="actor-1")),
        ):
            _, status = workspaces_mod.WorkspaceUnarchiveApi.post.__wrapped__.__wrapped__(
                workspaces_mod.WorkspaceUnarchiveApi(), session, "t-1"
            )

        assert status == 200
        assert tenant.status == TenantStatus.NORMAL
        assert mock_audit.call_args.args[0] == "workspace.unarchive"

    def test_archive_missing_workspace_404(self):
        session = MagicMock()
        session.get.return_value = None
        with (
            patch.object(workspaces_mod, "current_user", MagicMock(id="actor-1")),
            pytest.raises(NotFound),
        ):
            workspaces_mod.WorkspaceArchiveApi.post.__wrapped__.__wrapped__(
                workspaces_mod.WorkspaceArchiveApi(), session, "ghost"
            )
