"""系统管理操作审计查询（/console/api/admin/audit-logs）。"""

from datetime import UTC, datetime
from http import HTTPStatus

from flask_restx import Resource
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from controllers.common.schema import query_params_from_model, query_params_from_request, register_schema_models
from controllers.common.session import with_session
from controllers.console import console_ns
from controllers.console.admin import system_admin_required
from fields.base import ResponseModel
from libs.helper import to_timestamp
from libs.pagination import paginate_query
from models.admin_audit import AdminAuditLog


class AdminAuditLogQuery(BaseModel):
    action: str | None = None
    actor: str | None = Field(default=None, description="actor_account_id")
    workspace_id: str | None = None
    start: int | None = Field(default=None, description="起始时间（epoch 秒，含）")
    end: int | None = Field(default=None, description="截止时间（epoch 秒，含）")
    page: int = Field(default=1, ge=1, le=99999)
    limit: int = Field(default=20, ge=1, le=100)


class AdminAuditLogItemResponse(ResponseModel):
    id: str
    action: str
    actor_account_id: str
    target_type: str | None = None
    target_id: str | None = None
    workspace_id: str | None = None
    detail: str | None = None  # JSON 字符串原样返回
    created_at: int | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _normalize_created_at(cls, value: datetime | int | None) -> int | None:
        return to_timestamp(value)


class AdminAuditLogListResponse(ResponseModel):
    data: list[AdminAuditLogItemResponse]
    has_more: bool
    limit: int
    page: int
    total: int


register_schema_models(
    console_ns,
    AdminAuditLogQuery,
    AdminAuditLogItemResponse,
    AdminAuditLogListResponse,
)


def _epoch_to_naive_utc(value: int) -> datetime:
    """epoch 秒 → 朴素 UTC（created_at 为 DB 时区朴素时间戳，部署态为 UTC）。"""
    return datetime.fromtimestamp(value, tz=UTC).replace(tzinfo=None)


@console_ns.route("/admin/audit-logs")
class AuditLogListApi(Resource):
    @console_ns.doc(params=query_params_from_model(AdminAuditLogQuery))
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminAuditLogListResponse.__name__])
    @system_admin_required
    @with_session(write=False)
    def get(self, session: Session):
        args = query_params_from_request(AdminAuditLogQuery)

        stmt = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
        if args.action:
            stmt = stmt.where(AdminAuditLog.action == args.action)
        if args.actor:
            stmt = stmt.where(AdminAuditLog.actor_account_id == args.actor)
        if args.workspace_id:
            stmt = stmt.where(AdminAuditLog.workspace_id == args.workspace_id)
        if args.start is not None:
            stmt = stmt.where(AdminAuditLog.created_at >= _epoch_to_naive_utc(args.start))
        if args.end is not None:
            stmt = stmt.where(AdminAuditLog.created_at <= _epoch_to_naive_utc(args.end))

        page = paginate_query(stmt, session=session, page=args.page, per_page=args.limit)
        data = [AdminAuditLogItemResponse.model_validate(log, from_attributes=True) for log in page.items]
        return AdminAuditLogListResponse(
            data=data, has_more=page.has_next, limit=args.limit, page=args.page, total=page.total
        ).model_dump(mode="json"), HTTPStatus.OK
