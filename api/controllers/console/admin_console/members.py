"""系统管理员成员只读视图（PRD v1.6：管理台成员写操作一期不做）。

- GET /admin/workspaces/<tenant_id>/members —— 空间详情成员 tab（只读）
- GET /admin/members —— 跨空间按人聚合（PRD US-3 AC1：行=账号 + memberships 徽标组）
"""

from datetime import datetime
from http import HTTPStatus

from flask_restx import Resource
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from werkzeug.exceptions import NotFound

from controllers.common.schema import query_params_from_model, query_params_from_request, register_schema_models
from controllers.common.session import with_session
from controllers.console import console_ns
from controllers.console.admin import system_admin_required
from fields.base import ResponseModel
from libs.helper import to_timestamp
from libs.pagination import paginate_query
from models.account import Account, Tenant, TenantAccountJoin


class AdminMemberListQuery(BaseModel):
    page: int = Field(default=1, ge=1, le=99999)
    limit: int = Field(default=20, ge=1, le=100)


class AdminMemberAggregateQuery(BaseModel):
    keyword: str | None = None
    workspace_id: str | None = None
    page: int = Field(default=1, ge=1, le=99999)
    limit: int = Field(default=20, ge=1, le=100)


class AdminMemberItemResponse(ResponseModel):
    account_id: str
    name: str
    email: str
    role: str
    created_at: int | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _normalize_created_at(cls, value: datetime | int | None) -> int | None:
        return to_timestamp(value)


class AdminMemberListResponse(ResponseModel):
    data: list[AdminMemberItemResponse]
    has_more: bool
    limit: int
    page: int
    total: int


class AdminMembershipItemResponse(ResponseModel):
    workspace_id: str
    workspace_name: str
    role: str
    joined_at: int | None = None

    @field_validator("joined_at", mode="before")
    @classmethod
    def _normalize_joined_at(cls, value: datetime | int | None) -> int | None:
        return to_timestamp(value)


class AdminMemberAggregateItemResponse(ResponseModel):
    account_id: str
    name: str
    email: str
    memberships: list[AdminMembershipItemResponse]


class AdminMemberAggregateListResponse(ResponseModel):
    data: list[AdminMemberAggregateItemResponse]
    has_more: bool
    limit: int
    page: int
    total: int


register_schema_models(
    console_ns,
    AdminMemberListQuery,
    AdminMemberAggregateQuery,
    AdminMemberItemResponse,
    AdminMemberListResponse,
    AdminMembershipItemResponse,
    AdminMemberAggregateItemResponse,
    AdminMemberAggregateListResponse,
)


@console_ns.route("/admin/workspaces/<string:tenant_id>/members")
class WorkspaceMemberListApi(Resource):
    @console_ns.doc(params=query_params_from_model(AdminMemberListQuery))
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminMemberListResponse.__name__])
    @system_admin_required
    @with_session(write=False)
    def get(self, session: Session, tenant_id: str):
        if not session.get(Tenant, tenant_id):
            raise NotFound("Workspace not found.")
        args = query_params_from_request(AdminMemberListQuery)

        # paginate_query 内部走 session.scalars()，只能接单实体 select；
        # 账号信息按页批量取，避免 N+1
        stmt = (
            select(TenantAccountJoin)
            .where(TenantAccountJoin.tenant_id == tenant_id)
            .order_by(TenantAccountJoin.created_at.asc())
        )
        page = paginate_query(stmt, session=session, page=args.page, per_page=args.limit)
        account_ids = [join.account_id for join in page.items]
        accounts = (
            {a.id: a for a in session.scalars(select(Account).where(Account.id.in_(account_ids))).all()}
            if account_ids
            else {}
        )
        data = [
            AdminMemberItemResponse(
                account_id=join.account_id,
                name=accounts[join.account_id].name,
                email=accounts[join.account_id].email,
                role=str(join.role),
                created_at=join.created_at,
            )
            for join in page.items
            if join.account_id in accounts
        ]
        return AdminMemberListResponse(
            data=data, has_more=page.has_next, limit=args.limit, page=args.page, total=page.total
        ).model_dump(mode="json"), HTTPStatus.OK


@console_ns.route("/admin/members")
class MemberAggregateListApi(Resource):
    @console_ns.doc(params=query_params_from_model(AdminMemberAggregateQuery))
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminMemberAggregateListResponse.__name__])
    @system_admin_required
    @with_session(write=False)
    def get(self, session: Session):
        args = query_params_from_request(AdminMemberAggregateQuery)

        # 账号级分页：join 只为过滤，distinct 去重多空间账号
        acct_stmt = (
            select(Account)
            .join(TenantAccountJoin, TenantAccountJoin.account_id == Account.id)
            .distinct()
            .order_by(Account.created_at.desc(), Account.id)
        )
        if args.keyword:
            acct_stmt = acct_stmt.where(
                or_(Account.name.ilike(f"%{args.keyword}%"), Account.email.ilike(f"%{args.keyword}%"))
            )
        if args.workspace_id:
            acct_stmt = acct_stmt.where(TenantAccountJoin.tenant_id == args.workspace_id)

        accounts_page = paginate_query(acct_stmt, session=session, page=args.page, per_page=args.limit)

        account_ids = [a.id for a in accounts_page.items]
        memberships_by_account: dict[str, list[AdminMembershipItemResponse]] = {aid: [] for aid in account_ids}
        if account_ids:
            join_rows = session.execute(
                select(TenantAccountJoin, Tenant.name)
                .join(Tenant, Tenant.id == TenantAccountJoin.tenant_id)
                .where(TenantAccountJoin.account_id.in_(account_ids))
                .order_by(TenantAccountJoin.created_at.asc())
            ).all()
            for join, workspace_name in join_rows:
                memberships_by_account[join.account_id].append(
                    AdminMembershipItemResponse(
                        workspace_id=join.tenant_id,
                        workspace_name=workspace_name,
                        role=str(join.role),
                        joined_at=join.created_at,
                    )
                )

        data = [
            AdminMemberAggregateItemResponse(
                account_id=account.id,
                name=account.name,
                email=account.email,
                memberships=memberships_by_account[account.id],
            )
            for account in accounts_page.items
        ]
        return AdminMemberAggregateListResponse(
            data=data, has_more=accounts_page.has_next, limit=args.limit, page=args.page, total=accounts_page.total
        ).model_dump(mode="json"), HTTPStatus.OK
