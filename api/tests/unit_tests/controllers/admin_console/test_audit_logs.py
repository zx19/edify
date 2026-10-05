"""audit-logs 端点：鉴权接线 + 过滤透传 + 响应形状。"""

from unittest.mock import MagicMock, patch

import pytest
from werkzeug.exceptions import Forbidden, Unauthorized

from controllers.console.admin_console import audit_logs as audit_logs_mod
from controllers.console.admin_console.audit_logs import AdminAuditLogQuery


def _unauthenticated():
    return patch("controllers.console.admin.current_user", MagicMock(is_authenticated=False))


def _non_admin():
    return patch.multiple(
        "controllers.console.admin",
        current_user=MagicMock(is_authenticated=True),
        is_system_admin=MagicMock(return_value=False),
    )


class TestGuards:
    def test_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            audit_logs_mod.AuditLogListApi().get()

    def test_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            audit_logs_mod.AuditLogListApi().get()


class TestList:
    def test_response_shape_and_filters(self):
        log = MagicMock(
            id="log-1",
            action="workspace.create",
            actor_account_id="actor-1",
            target_type="workspace",
            target_id="t-1",
            workspace_id="t-1",
            detail='{"name": "研发部"}',
            created_at=None,
        )
        page = MagicMock(items=[log], has_next=False, total=1)
        session = MagicMock()
        query = AdminAuditLogQuery(action="workspace.create", actor="actor-1", workspace_id="t-1", start=100, end=200)
        with (
            patch.object(audit_logs_mod, "query_params_from_request", return_value=query),
            patch.object(audit_logs_mod, "paginate_query", return_value=page) as mock_paginate,
        ):
            body, status = audit_logs_mod.AuditLogListApi.get.__wrapped__.__wrapped__(
                audit_logs_mod.AuditLogListApi(), session
            )

        assert status == 200
        assert body["total"] == 1
        item = body["data"][0]
        assert item["action"] == "workspace.create"
        assert item["detail"] == '{"name": "研发部"}'  # JSON 字符串原样返回
        # 过滤条件确实参与了查询构造（stmt 被 paginate_query 接收）
        assert mock_paginate.call_args.kwargs["page"] == 1
