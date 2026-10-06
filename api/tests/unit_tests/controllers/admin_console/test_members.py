"""members 端点：鉴权接线 + 空间成员列表 + 跨空间按人聚合。

查询路径用 sqlite 实库锁定（paginate_query 仅支持单实体 select——双实体 join
曾在此炸过，mock 缝隙盖不住，必须真实分页器过一遍）。
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session
from werkzeug.exceptions import Forbidden, NotFound, Unauthorized

from controllers.console.admin_console import members as members_mod
from controllers.console.admin_console.members import AdminMemberAggregateQuery, AdminMemberListQuery
from models.account import Account, Tenant, TenantAccountJoin, TenantAccountRole


def _unauthenticated():
    return patch("controllers.console.admin.current_user", MagicMock(is_authenticated=False))


def _non_admin():
    return patch.multiple(
        "controllers.console.admin",
        current_user=MagicMock(is_authenticated=True),
        is_system_admin=MagicMock(return_value=False),
        check_csrf_token=MagicMock(),
    )


class TestGuards:
    def test_workspace_members_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            members_mod.WorkspaceMemberListApi().get(tenant_id="t-1")

    def test_workspace_members_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            members_mod.WorkspaceMemberListApi().get(tenant_id="t-1")

    def test_aggregate_rejects_unauthenticated(self):
        with _unauthenticated(), pytest.raises(Unauthorized):
            members_mod.MemberAggregateListApi().get()

    def test_aggregate_rejects_non_admin(self):
        with _non_admin(), pytest.raises(Forbidden):
            members_mod.MemberAggregateListApi().get()


def _seed_workspace_with_members(session: Session):
    tenant = Tenant(name="研发部")
    owner = Account(name="Owner", email="owner@x.com")
    member = Account(name="Dev", email="dev@x.com")
    session.add_all([tenant, owner, member])
    session.flush()
    session.add_all(
        [
            TenantAccountJoin(tenant_id=tenant.id, account_id=owner.id, role=TenantAccountRole.OWNER),
            TenantAccountJoin(tenant_id=tenant.id, account_id=member.id, role=TenantAccountRole.NORMAL),
        ]
    )
    session.commit()
    return tenant, owner, member


class TestWorkspaceMembers:
    def test_missing_workspace_404(self, sqlite_session: Session):
        raw = members_mod.WorkspaceMemberListApi.get.__wrapped__.__wrapped__
        with pytest.raises(NotFound):
            raw(members_mod.WorkspaceMemberListApi(), sqlite_session, "ghost")

    def test_list_real_query(self, sqlite_session: Session):
        tenant, owner, member = _seed_workspace_with_members(sqlite_session)
        with patch.object(members_mod, "query_params_from_request", return_value=AdminMemberListQuery()):
            body, status = members_mod.WorkspaceMemberListApi.get.__wrapped__.__wrapped__(
                members_mod.WorkspaceMemberListApi(), sqlite_session, tenant.id
            )

        assert status == 200
        assert body["total"] == 2
        rows = {row["account_id"]: row for row in body["data"]}
        assert rows[owner.id]["role"] == "owner"
        assert rows[owner.id]["email"] == "owner@x.com"
        assert rows[member.id]["role"] == "normal"


class TestMemberAggregate:
    def test_grouping_by_account_real_query(self, sqlite_session: Session):
        tenant, owner, member = _seed_workspace_with_members(sqlite_session)
        other = Tenant(name="市场部")
        sqlite_session.add(other)
        sqlite_session.flush()
        sqlite_session.add(TenantAccountJoin(tenant_id=other.id, account_id=member.id, role=TenantAccountRole.ADMIN))
        sqlite_session.commit()

        with patch.object(members_mod, "query_params_from_request", return_value=AdminMemberAggregateQuery()):
            body, status = members_mod.MemberAggregateListApi.get.__wrapped__.__wrapped__(
                members_mod.MemberAggregateListApi(), sqlite_session
            )

        assert status == 200
        assert body["total"] == 2
        rows = {row["account_id"]: row for row in body["data"]}
        member_workspaces = {m["workspace_id"]: m for m in rows[member.id]["memberships"]}
        assert set(member_workspaces) == {tenant.id, other.id}
        assert member_workspaces[other.id]["role"] == "admin"
        assert member_workspaces[other.id]["workspace_name"] == "市场部"
        assert len(rows[owner.id]["memberships"]) == 1
