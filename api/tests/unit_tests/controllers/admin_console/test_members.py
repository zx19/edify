"""members 端点：鉴权接线 + 空间成员列表 + 跨空间按人聚合。"""

from unittest.mock import MagicMock, patch

import pytest
from werkzeug.exceptions import Forbidden, NotFound, Unauthorized

from controllers.console.admin_console import members as members_mod
from controllers.console.admin_console.members import AdminMemberAggregateQuery, AdminMemberListQuery


def _unauthenticated():
    return patch("controllers.console.admin.current_user", MagicMock(is_authenticated=False))


def _non_admin():
    return patch.multiple(
        "controllers.console.admin",
        current_user=MagicMock(is_authenticated=True),
        is_system_admin=MagicMock(return_value=False),
    )


class TestGuards:
    def test_workspace_members_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            members_mod.WorkspaceMemberListApi().get(tenant_id="t-1")

    def test_workspace_members_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            members_mod.WorkspaceMemberListApi().get(tenant_id="t-1")

    def test_aggregate_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            members_mod.MemberAggregateListApi().get()


class TestWorkspaceMembers:
    def test_missing_workspace_404(self):
        session = MagicMock()
        session.get.return_value = None
        raw = members_mod.WorkspaceMemberListApi.get.__wrapped__.__wrapped__
        with pytest.raises(NotFound):
            raw(members_mod.WorkspaceMemberListApi(), session, "ghost")

    def test_list_shape(self):
        session = MagicMock()
        session.get.return_value = MagicMock(id="t-1")
        join = MagicMock(created_at=None)
        join.role = "owner"
        account = MagicMock(id="a-1", email="dev@x.com")
        account.name = "Dev"
        page = MagicMock(items=[(join, account)], has_next=False, total=1)
        with (
            patch.object(members_mod, "query_params_from_request", return_value=AdminMemberListQuery()),
            patch.object(members_mod, "paginate_query", return_value=page),
        ):
            body, status = members_mod.WorkspaceMemberListApi.get.__wrapped__.__wrapped__(
                members_mod.WorkspaceMemberListApi(), session, "t-1"
            )

        assert status == 200
        assert body["total"] == 1
        assert body["data"][0]["account_id"] == "a-1"
        assert body["data"][0]["role"] == "owner"


class TestMemberAggregate:
    def test_grouping_by_account(self):
        account = MagicMock(id="a-1", email="dev@x.com")
        account.name = "Dev"
        accounts_page = MagicMock(items=[account], has_next=False, total=1)
        join = MagicMock(account_id="a-1", tenant_id="t-1", created_at=None)
        join.role = "owner"
        session = MagicMock()
        session.execute.return_value.all.return_value = [(join, "研发部")]
        with (
            patch.object(members_mod, "query_params_from_request", return_value=AdminMemberAggregateQuery()),
            patch.object(members_mod, "paginate_query", return_value=accounts_page),
        ):
            body, status = members_mod.MemberAggregateListApi.get.__wrapped__.__wrapped__(
                members_mod.MemberAggregateListApi(), session
            )

        assert status == 200
        row = body["data"][0]
        assert row["account_id"] == "a-1"
        assert row["memberships"] == [
            {"workspace_id": "t-1", "workspace_name": "研发部", "role": "owner", "joined_at": None}
        ]
