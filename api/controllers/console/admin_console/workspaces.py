"""系统管理员工作空间管理端点（/console/api/admin/workspaces）。

系统管理员可无空间：一律走 Flask-Login current_user + system_admin_required，
不得使用 current_account_with_tenant()。
"""

import logging
from datetime import datetime
from http import HTTPStatus

from flask_login import current_user
from flask_restx import Resource
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from werkzeug.exceptions import NotFound

from controllers.common.schema import query_params_from_model, query_params_from_request, register_schema_models
from controllers.common.session import with_session
from controllers.console import console_ns
from controllers.console.admin import system_admin_required
from fields.base import ResponseModel
from libs.helper import EmailStr, dump_response, to_timestamp
from libs.pagination import paginate_query
from models.account import Account, AccountStatus, Tenant, TenantAccountJoin, TenantAccountRole, TenantStatus
from services.account_service import AccountService, RegisterService, TenantService
from services.audit_service import audit_log
from tasks.mail_invite_member_task import send_invite_member_mail_task

logger = logging.getLogger(__name__)


class AdminWorkspaceListQuery(BaseModel):
    keyword: str | None = None
    status: str | None = Field(default=None, description="normal | archive")
    page: int = Field(default=1, ge=1, le=99999)
    limit: int = Field(default=20, ge=1, le=100)


class AdminWorkspaceCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    owner_email: EmailStr


class AdminWorkspaceOwnerResponse(ResponseModel):
    id: str
    name: str
    email: str


class AdminWorkspaceListItemResponse(ResponseModel):
    id: str
    name: str
    status: str
    created_at: int | None = None
    owner: AdminWorkspaceOwnerResponse | None = None
    member_count: int = 0

    @field_validator("created_at", mode="before")
    @classmethod
    def _normalize_created_at(cls, value: datetime | int | None) -> int | None:
        return to_timestamp(value)


class AdminWorkspacePaginationResponse(ResponseModel):
    data: list[AdminWorkspaceListItemResponse]
    has_more: bool
    limit: int
    page: int
    total: int


class AdminWorkspaceCreateResponse(ResponseModel):
    id: str
    name: str
    owner_pending: bool
    invite_url: str | None = None


class AdminWorkspaceActionResponse(ResponseModel):
    result: str
    status: str


register_schema_models(
    console_ns,
    AdminWorkspaceListQuery,
    AdminWorkspaceCreatePayload,
    AdminWorkspaceOwnerResponse,
    AdminWorkspaceListItemResponse,
    AdminWorkspacePaginationResponse,
    AdminWorkspaceCreateResponse,
    AdminWorkspaceActionResponse,
)


@console_ns.route("/admin/workspaces")
class WorkspaceListApi(Resource):
    @console_ns.doc(params=query_params_from_model(AdminWorkspaceListQuery))
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminWorkspacePaginationResponse.__name__])
    @system_admin_required
    @with_session(write=False)
    def get(self, session: Session):
        args = query_params_from_request(AdminWorkspaceListQuery)

        stmt = select(Tenant).order_by(Tenant.created_at.desc())
        if args.keyword:
            stmt = stmt.where(Tenant.name.ilike(f"%{args.keyword}%"))
        if args.status:
            stmt = stmt.where(Tenant.status == args.status)

        tenants = paginate_query(stmt, session=session, page=args.page, per_page=args.limit)

        tenant_ids = [t.id for t in tenants.items]
        owners: dict[str, AdminWorkspaceOwnerResponse] = {}
        member_counts: dict[str, int] = {}
        if tenant_ids:
            owner_rows = session.execute(
                select(TenantAccountJoin.tenant_id, Account.id, Account.name, Account.email)
                .join(Account, Account.id == TenantAccountJoin.account_id)
                .where(
                    TenantAccountJoin.tenant_id.in_(tenant_ids),
                    TenantAccountJoin.role == TenantAccountRole.OWNER,
                )
            ).all()
            owners = {
                row.tenant_id: AdminWorkspaceOwnerResponse(id=row.id, name=row.name, email=row.email)
                for row in owner_rows
            }
            count_rows = session.execute(
                select(TenantAccountJoin.tenant_id, func.count())
                .where(TenantAccountJoin.tenant_id.in_(tenant_ids))
                .group_by(TenantAccountJoin.tenant_id)
            ).all()
            member_counts = {row[0]: row[1] for row in count_rows}

        data = [
            AdminWorkspaceListItemResponse(
                id=tenant.id,
                name=tenant.name,
                status=str(tenant.status),
                created_at=tenant.created_at,
                owner=owners.get(tenant.id),
                member_count=member_counts.get(tenant.id, 0),
            )
            for tenant in tenants.items
        ]
        return AdminWorkspacePaginationResponse(
            data=data, has_more=tenants.has_next, limit=args.limit, page=args.page, total=tenants.total
        ).model_dump(mode="json"), HTTPStatus.OK

    @console_ns.expect(console_ns.models[AdminWorkspaceCreatePayload.__name__])
    @console_ns.response(HTTPStatus.CREATED, "Created", console_ns.models[AdminWorkspaceCreateResponse.__name__])
    @system_admin_required
    @with_session(write=True)
    def post(self, session: Session):
        payload = AdminWorkspaceCreatePayload.model_validate(console_ns.payload or {})

        owner = AccountService.get_account_by_email_with_case_fallback(payload.owner_email, session=session)
        owner_pending = owner is None or owner.status == AccountStatus.PENDING
        if owner is None:
            normalized_email = payload.owner_email.lower()
            owner = RegisterService.register(
                email=normalized_email,
                name=normalized_email.split("@")[0],
                language="en-US",
                status=AccountStatus.PENDING,
                is_setup=True,
                create_workspace_required=False,
                check_normalized_email=True,
                session=session,
            )

        tenant = TenantService.create_owner_tenant(
            account=owner, name=payload.name, is_from_dashboard=True, session=session
        )

        invite_url: str | None = None
        email_sent = False
        if owner_pending:
            token = RegisterService.generate_invite_token(
                tenant, owner, role=TenantAccountRole.OWNER.value, requires_setup=True
            )
            invite_url = f"/activate?token={token}"
            try:
                send_invite_member_mail_task.delay(
                    language=owner.interface_language or "en-US",
                    to=owner.email,
                    token=token,
                    inviter_name=current_user.name,
                    workspace_name=tenant.name,
                )
                email_sent = True
            except Exception:
                # SMTP 失败不阻塞创建（PRD US-4 AC3 同口径）：邀请链接照常下发
                logger.exception("Failed to send workspace owner invite mail to %s", owner.email)

        audit_log(
            "workspace.create",
            current_user.id,
            target_type="workspace",
            target_id=tenant.id,
            workspace_id=tenant.id,
            detail={
                "name": tenant.name,
                "owner_email": owner.email,
                "owner_pending": owner_pending,
                "email_sent": email_sent,
            },
            session=session,
        )

        return dump_response(
            AdminWorkspaceCreateResponse,
            {"id": tenant.id, "name": tenant.name, "owner_pending": owner_pending, "invite_url": invite_url},
        ), HTTPStatus.CREATED


def _set_workspace_status(
    session: Session, tenant_id: str, target: TenantStatus, action: str, actor_account_id: str
) -> dict:
    """归档/恢复共用：幂等——已在目标态时直接返回成功、不重复写审计。"""
    tenant = session.get(Tenant, tenant_id)
    if not tenant:
        raise NotFound("Workspace not found.")
    if tenant.status != target:
        tenant.status = target
        audit_log(
            action,
            actor_account_id,
            target_type="workspace",
            target_id=tenant.id,
            workspace_id=tenant.id,
            detail={"name": tenant.name},
            session=session,
        )
    return {"result": "success", "status": str(target)}


@console_ns.route("/admin/workspaces/<string:tenant_id>/archive")
class WorkspaceArchiveApi(Resource):
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminWorkspaceActionResponse.__name__])
    @system_admin_required
    @with_session(write=True)
    def post(self, session: Session, tenant_id: str):
        result = _set_workspace_status(session, tenant_id, TenantStatus.ARCHIVE, "workspace.archive", current_user.id)
        return result, HTTPStatus.OK


@console_ns.route("/admin/workspaces/<string:tenant_id>/unarchive")
class WorkspaceUnarchiveApi(Resource):
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminWorkspaceActionResponse.__name__])
    @system_admin_required
    @with_session(write=True)
    def post(self, session: Session, tenant_id: str):
        result = _set_workspace_status(session, tenant_id, TenantStatus.NORMAL, "workspace.unarchive", current_user.id)
        return result, HTTPStatus.OK
