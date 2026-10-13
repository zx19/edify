"""profile 下发系统管理员标记 + 无空间管理员 admission（require_tenant=False）。"""

import inspect
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from werkzeug.exceptions import Unauthorized

from controllers.console import flask_admission
from controllers.console.workspace.account import AccountProfileApi, AccountProfilePatchPayload
from controllers.console.workspace.error import AccountNotInitializedError
from core.rbac import RBACPermission, RBACResourceScope
from machinery.context import RequestContext
from machinery.errors import AdmissionConfigurationError
from models.account import AccountStatus, TenantAccountRole
from services.entities.account_entities import AccountSnapshot


def _snapshot(name: str = "Test Account") -> AccountSnapshot:
    return AccountSnapshot(
        id="account-1",
        name=name,
        email="account-1@example.com",
        avatar=None,
        is_password_set=True,
        interface_language="en-US",
        interface_theme="light",
        timezone="UTC",
        last_login_at=None,
        last_login_ip=None,
        status="active",
        initialized_at=None,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def _request_context(workspace_id: str | None = "tenant-1") -> RequestContext:
    return RequestContext(
        request_id="request-1",
        trace_id=None,
        account_id="account-1",
        active_workspace_id=workspace_id,
    )


def _patch_profile_service(profile: MagicMock):
    return patch(
        "controllers.console.workspace.account.application_services",
        return_value=SimpleNamespace(accounts=SimpleNamespace(profile=profile)),
    )


class TestProfileAdminFlags:
    def test_get_enriches_admin_flags_for_system_admin(self):
        profile = MagicMock()
        profile.get.return_value = _snapshot()
        current_user = MagicMock()

        with (
            Flask(__name__).test_request_context("/account/profile", method="GET"),
            _patch_profile_service(profile),
            patch("controllers.console.workspace.account.current_user", current_user),
            patch("controllers.console.workspace.account.is_system_admin", return_value=True) as is_system_admin,
            patch(
                "controllers.console.workspace.account.get_system_admin_source", return_value="install"
            ) as get_system_admin_source,
        ):
            api = AccountProfileApi()
            result = inspect.unwrap(api.get)(api, _request_context())

        assert result["is_system_admin"] is True
        assert result["system_admin_source"] == "install"
        is_system_admin.assert_called_once_with(current_user)
        get_system_admin_source.assert_called_once_with(current_user)

    def test_get_defaults_admin_flags_for_non_admin(self):
        profile = MagicMock()
        profile.get.return_value = _snapshot()

        with (
            Flask(__name__).test_request_context("/account/profile", method="GET"),
            _patch_profile_service(profile),
            patch("controllers.console.workspace.account.current_user", MagicMock()),
            patch("controllers.console.workspace.account.is_system_admin", return_value=False),
            patch("controllers.console.workspace.account.get_system_admin_source", return_value=None),
        ):
            api = AccountProfileApi()
            result = inspect.unwrap(api.get)(api, _request_context())

        assert result["is_system_admin"] is False
        assert result["system_admin_source"] is None

    def test_patch_enriches_admin_flags(self):
        profile = MagicMock()
        profile.update.return_value = _snapshot(name="New Name")
        current_user = MagicMock()

        with (
            Flask(__name__).test_request_context("/account/profile", method="PATCH", json={"name": "New Name"}),
            _patch_profile_service(profile),
            patch("controllers.console.workspace.account.current_user", current_user),
            patch("controllers.console.workspace.account.is_system_admin", return_value=True),
            patch("controllers.console.workspace.account.get_system_admin_source", return_value="grant"),
        ):
            api = AccountProfileApi()
            args = AccountProfilePatchPayload(name="New Name")
            result = inspect.unwrap(api.patch)(api, args, _request_context())

        profile.update.assert_called_once()
        assert result["name"] == "New Name"
        assert result["is_system_admin"] is True
        assert result["system_admin_source"] == "grant"


class TestRequireTenantAdmission:
    def test_require_tenant_false_admits_account_without_tenant(self):
        account = MagicMock()
        account.id = "account-1"

        with (
            patch("controllers.console.flask_admission.setup_required", side_effect=lambda view: view),
            patch("controllers.console.flask_admission.login_required", side_effect=lambda view: view),
            patch("controllers.console.flask_admission.account_initialization_required", side_effect=lambda view: view),
            # 无空间 init 变体经 wraps 模块解析 optional(真链,不打桩)
            patch(
                "controllers.console.wraps.current_account_with_tenant_optional",
                return_value=(account, None),
            ),
            patch(
                "controllers.console.flask_admission.current_account_with_tenant",
                side_effect=AssertionError("tenant required"),
            ) as strict_resolver,
            patch(
                "controllers.console.flask_admission.current_account_with_tenant_optional",
                return_value=(account, None),
            ),
            patch("controllers.console.flask_admission.get_request_id", return_value="request-1"),
            patch("controllers.console.flask_admission.get_trace_id", return_value="trace-1"),
        ):

            class Handler:
                @flask_admission.console_account_admission(require_tenant=False)
                def get(self, request_context: RequestContext):
                    return request_context

            with Flask(__name__).test_request_context():
                result = Handler().get()

        assert result == RequestContext(
            request_id="request-1",
            trace_id="trace-1",
            account_id="account-1",
            active_workspace_id=None,
        )
        strict_resolver.assert_not_called()

    def test_require_tenant_false_rejects_unauthenticated_caller(self):
        with (
            patch("controllers.console.flask_admission.setup_required", side_effect=lambda view: view),
            patch("controllers.console.flask_admission.login_required", side_effect=lambda view: view),
            patch("controllers.console.flask_admission.account_initialization_required", side_effect=lambda view: view),
            # 无空间 init 变体经 wraps 模块解析 optional(真链,不打桩)
            patch(
                "controllers.console.wraps.current_account_with_tenant_optional",
                return_value=(None, None),
            ),
            patch(
                "controllers.console.flask_admission.current_account_with_tenant_optional",
                return_value=(None, None),
            ),
        ):

            class Handler:
                @flask_admission.console_account_admission(require_tenant=False)
                def get(self, request_context: RequestContext):
                    return request_context

            with Flask(__name__).test_request_context(), pytest.raises(Unauthorized):
                Handler().get()

    def test_require_tenant_false_rejects_role_requirement(self):
        with pytest.raises(AdmissionConfigurationError, match="require_tenant"):
            flask_admission.console_account_admission(
                require_tenant=False,
                allowed_roles=frozenset({TenantAccountRole.OWNER}),
            )

    def test_require_tenant_false_rejects_rbac_requirement(self):
        with pytest.raises(AdmissionConfigurationError, match="require_tenant"):
            flask_admission.console_account_admission(
                require_tenant=False,
                rbac_resource_scope=RBACResourceScope.WORKSPACE,
                rbac_permission=RBACPermission.CREDENTIAL_CREATE,
            )


class TestRequireTenantFalseRealInitCheck:
    """回归:QA 实测无空间管理员 profile 500(2026-10-13)——admission 链里的
    account_initialization_required 走 current_account_with_tenant() 硬断言租户,
    与 require_tenant=False 语义矛盾。修复后 init 检查换无空间变体,本组用例
    不打桩 init 检查,锁真链。"""

    def test_no_tenant_active_account_admitted_and_strict_resolver_untouched(self):
        account = MagicMock()
        account.id = "account-1"
        account.status = AccountStatus.ACTIVE
        strict_resolver = MagicMock(side_effect=AssertionError("tenant required"))

        with (
            patch("controllers.console.flask_admission.setup_required", side_effect=lambda view: view),
            patch("controllers.console.flask_admission.login_required", side_effect=lambda view: view),
            patch(
                "controllers.console.wraps.current_account_with_tenant_optional",
                return_value=(account, None),
            ),
            patch(
                "controllers.console.flask_admission.current_account_with_tenant_optional",
                return_value=(account, None),
            ),
            patch("controllers.console.wraps.current_account_with_tenant", strict_resolver),
            patch("controllers.console.flask_admission.current_account_with_tenant", strict_resolver),
            patch("controllers.console.flask_admission.get_request_id", return_value="request-1"),
            patch("controllers.console.flask_admission.get_trace_id", return_value="trace-1"),
        ):

            class Handler:
                @flask_admission.console_account_admission(require_tenant=False)
                def get(self, request_context: RequestContext):
                    return request_context

            with Flask(__name__).test_request_context():
                result = Handler().get()

        assert result.active_workspace_id is None
        strict_resolver.assert_not_called()

    def test_no_tenant_uninitialized_account_still_rejected(self):
        account = MagicMock()
        account.id = "account-1"
        account.status = AccountStatus.UNINITIALIZED

        with (
            patch("controllers.console.flask_admission.setup_required", side_effect=lambda view: view),
            patch("controllers.console.flask_admission.login_required", side_effect=lambda view: view),
            patch(
                "controllers.console.wraps.current_account_with_tenant_optional",
                return_value=(account, None),
            ),
            patch(
                "controllers.console.flask_admission.current_account_with_tenant_optional",
                return_value=(account, None),
            ),
            patch("controllers.console.flask_admission.get_request_id", return_value="request-1"),
            patch("controllers.console.flask_admission.get_trace_id", return_value="trace-1"),
        ):

            class Handler:
                @flask_admission.console_account_admission(require_tenant=False)
                def get(self, request_context: RequestContext):
                    return request_context

            with Flask(__name__).test_request_context(), pytest.raises(AccountNotInitializedError):
                Handler().get()

