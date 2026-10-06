"""系统管理员名单端点（/console/api/admin/system-admins）：两级模型。

- 名单（GET）：DB `is_system_admin=true` ∪ env 名单已注册账号，系统管理员可读。
- 授予/撤销/转让（POST/DELETE/POST transfer）：创始人独占（founder_admin_required），
  全部要求 current_password 二次确认。
- 激活为公开端点，见 activation.py。

邮件走通用 send_inner_email_task（原始模板通道），best-effort：SMTP/broker 失败不阻塞，
发送结果写入审计 detail（PRD US-4 AC3）。
"""

import logging
from datetime import datetime
from http import HTTPStatus

from flask_login import current_user
from flask_restx import Resource
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from werkzeug.exceptions import BadRequest, Forbidden, NotFound

from configs import dify_config
from controllers.common.schema import register_schema_models
from controllers.common.session import with_session
from controllers.console import console_ns
from controllers.console.admin import founder_admin_required, system_admin_required
from fields.base import ResponseModel
from libs.helper import EmailStr, dump_response, to_timestamp
from libs.password import compare_password
from models.account import Account, AccountStatus
from services.account_service import AccountService, RegisterService
from services.audit_service import audit_log
from services.system_admin_invite_service import (
    SYSTEM_ADMIN_INVITE_URL_PATH,
    issue_invite_token,
    revoke_invite_for_account,
)
from services.system_admin_service import get_system_admin_source
from tasks.mail_inner_task import send_inner_email_task

logger = logging.getLogger(__name__)


class AdminSystemAdminGrantPayload(BaseModel):
    email: EmailStr
    current_password: str = Field(min_length=1)


class AdminSystemAdminRevokePayload(BaseModel):
    current_password: str = Field(min_length=1)


class AdminSystemAdminTransferPayload(BaseModel):
    account_id: str = Field(min_length=1)
    current_password: str = Field(min_length=1)


class AdminSystemAdminItemResponse(ResponseModel):
    id: str
    email: str
    name: str
    status: str
    source: str | None = None
    pending: bool
    created_at: int | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _normalize_created_at(cls, value: datetime | int | None) -> int | None:
        return to_timestamp(value)


class AdminSystemAdminListResponse(ResponseModel):
    data: list[AdminSystemAdminItemResponse]


class AdminSystemAdminGrantResponse(ResponseModel):
    id: str
    email: str
    name: str
    status: str
    source: str | None = None
    pending: bool
    invite_url: str | None = None


class AdminSystemAdminActionResponse(ResponseModel):
    result: str


register_schema_models(
    console_ns,
    AdminSystemAdminGrantPayload,
    AdminSystemAdminRevokePayload,
    AdminSystemAdminTransferPayload,
    AdminSystemAdminItemResponse,
    AdminSystemAdminListResponse,
    AdminSystemAdminGrantResponse,
    AdminSystemAdminActionResponse,
)


def _require_current_password(password: str) -> None:
    """创始人写操作二次确认：密码不符 403。"""
    if not compare_password(password, current_user.password, current_user.password_salt):
        raise Forbidden("Current password is incorrect.")


def _send_grant_notification(account: Account) -> bool:
    try:
        send_inner_email_task.delay(
            to=[account.email],
            subject="You have been granted system administrator",
            body="<p>You have been granted system administrator permissions.</p>",
            substitutions={},
        )
        return True
    except Exception:
        # SMTP/broker 失败不阻塞授予（PRD US-4 AC3）
        logger.exception("Failed to send system admin grant notification to %s", account.email)
        return False


def _send_invite_mail(account: Account, invite_url: str) -> bool:
    full_url = f"{dify_config.CONSOLE_WEB_URL}{invite_url}"
    # URL 直接内联进 body：MAIL_TEMPLATING_MODE=disabled 时模板原样发送，占位符不会被替换
    body = f'<p>You have been invited as system administrator. Activate: <a href="{full_url}">{full_url}</a></p>'
    try:
        send_inner_email_task.delay(
            to=[account.email],
            subject="You have been invited as system administrator",
            body=body,
            substitutions={},
        )
        return True
    except Exception:
        # SMTP/broker 失败不阻塞：邀请链接照常下发（PRD US-4 AC3）
        logger.exception("Failed to send system admin invite mail to %s", account.email)
        return False


def _to_item(account: Account) -> AdminSystemAdminItemResponse:
    return AdminSystemAdminItemResponse(
        id=account.id,
        email=account.email,
        name=account.name,
        status=str(account.status),
        source=get_system_admin_source(account),
        pending=account.status == AccountStatus.PENDING,
        created_at=account.created_at,
    )


@console_ns.route("/admin/system-admins")
class SystemAdminListApi(Resource):
    @console_ns.doc("list_system_admins")
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminSystemAdminListResponse.__name__])
    @system_admin_required
    @with_session(write=False)
    def get(self, session: Session):
        """名单 = DB 置位账号 ∪ env 名单已注册账号；env 命中但未置位的行 source='env'。"""
        db_accounts = session.scalars(
            select(Account).where(Account.is_system_admin.is_(True)).order_by(Account.created_at.asc(), Account.id)
        ).all()

        env_emails = {e.lower() for e in (dify_config.SYSTEM_ADMIN_EMAILS or [])}
        covered = {a.email.lower() for a in db_accounts if a.email}
        missing = sorted(env_emails - covered)
        env_accounts = (
            session.scalars(
                select(Account).where(func.lower(Account.email).in_(missing)).order_by(Account.created_at.asc())
            ).all()
            if missing
            else []
        )

        data = [_to_item(account) for account in (*db_accounts, *env_accounts)]
        return AdminSystemAdminListResponse(data=data).model_dump(mode="json"), HTTPStatus.OK

    @console_ns.doc("grant_system_admin")
    @console_ns.expect(console_ns.models[AdminSystemAdminGrantPayload.__name__])
    @console_ns.response(HTTPStatus.CREATED, "Granted", console_ns.models[AdminSystemAdminGrantResponse.__name__])
    @founder_admin_required
    @with_session(write=True)
    def post(self, session: Session):
        """授予三分支：active 直授 / 未注册建 PENDING+邀请 / 已 PENDING 幂等重发。"""
        payload = AdminSystemAdminGrantPayload.model_validate(console_ns.payload or {})
        _require_current_password(payload.current_password)

        account = AccountService.get_account_by_email_with_case_fallback(payload.email, session=session)

        invite_url: str | None = None
        email_sent = False
        invite_mail_dispatched = False

        if account is not None and account.status == AccountStatus.ACTIVE:
            branch = "direct"
            if not account.is_system_admin:
                account.is_system_admin = True
                account.system_admin_source = "grant"
                email_sent = _send_grant_notification(account)
                audit_log(
                    "admin.grant",
                    current_user.id,
                    target_type="account",
                    target_id=account.id,
                    detail={"email": account.email, "branch": branch, "email_sent": email_sent},
                    session=session,
                )
            # 已是 DB 系统管理员：幂等成功，不重复置位/审计/邮件（同 workspace.archive 口径）
        elif account is None or account.status == AccountStatus.PENDING:
            if account is None:
                branch = "invite"
                normalized_email = payload.email.lower()
                account = RegisterService.register(
                    email=normalized_email,
                    name=normalized_email.split("@")[0],
                    language="en-US",
                    status=AccountStatus.PENDING,
                    is_setup=True,
                    create_workspace_required=False,
                    check_normalized_email=True,
                    session=session,
                )
            else:
                # 已是本邀请流程创建的 PENDING → 幂等重发；其他 PENDING → 走邀请化
                branch = "resend" if account.is_system_admin and account.system_admin_source == "invite" else "invite"
            account.is_system_admin = True
            account.system_admin_source = "invite"
            token = issue_invite_token(account.id, account.email)
            invite_url = f"{SYSTEM_ADMIN_INVITE_URL_PATH}?token={token}"
            invite_mail_dispatched = _send_invite_mail(account, invite_url)
            audit_log(
                "admin.grant",
                current_user.id,
                target_type="account",
                target_id=account.id,
                detail={
                    "email": account.email,
                    "branch": branch,
                    "invite_mail_dispatched": invite_mail_dispatched,
                },
                session=session,
            )
        else:
            raise BadRequest(f"Account status {account.status} does not allow granting system admin.")

        return dump_response(
            AdminSystemAdminGrantResponse,
            {
                "id": account.id,
                "email": account.email,
                "name": account.name,
                "status": str(account.status),
                "source": account.system_admin_source,
                "pending": account.status == AccountStatus.PENDING,
                "invite_url": invite_url,
            },
        ), HTTPStatus.CREATED


@console_ns.route("/admin/system-admins/<string:account_id>")
class SystemAdminApi(Resource):
    @console_ns.doc("revoke_system_admin")
    @console_ns.expect(console_ns.models[AdminSystemAdminRevokePayload.__name__])
    @console_ns.response(HTTPStatus.OK, "Revoked", console_ns.models[AdminSystemAdminActionResponse.__name__])
    @founder_admin_required
    @with_session(write=True)
    def delete(self, session: Session, account_id: str):
        payload = AdminSystemAdminRevokePayload.model_validate(console_ns.payload or {})
        _require_current_password(payload.current_password)

        target = session.get(Account, account_id)
        if not target:
            raise NotFound("Account not found.")
        if target.id == current_user.id:
            raise Forbidden("Founder admin cannot revoke self.")

        source = get_system_admin_source(target)
        if source is None:
            raise BadRequest("Account is not a system admin.")
        if source == "env":
            raise BadRequest("Env-listed system admin cannot be revoked from console.")

        # 待激活邀请：置位清除 + redis token 作废（PENDING 账号行保留）
        token_revoked = False
        if target.status == AccountStatus.PENDING and target.system_admin_source == "invite":
            revoke_invite_for_account(target.id)
            token_revoked = True

        target.is_system_admin = False
        target.system_admin_source = None
        audit_log(
            "admin.revoke",
            current_user.id,
            target_type="account",
            target_id=target.id,
            detail={"email": target.email, "source": source, "token_revoked": token_revoked},
            session=session,
        )
        return dump_response(AdminSystemAdminActionResponse, {"result": "success"}), HTTPStatus.OK


@console_ns.route("/admin/system-admins/transfer")
class SystemAdminTransferApi(Resource):
    @console_ns.doc("transfer_founder_admin")
    @console_ns.expect(console_ns.models[AdminSystemAdminTransferPayload.__name__])
    @console_ns.response(HTTPStatus.OK, "Transferred", console_ns.models[AdminSystemAdminActionResponse.__name__])
    @founder_admin_required
    @with_session(write=True)
    def post(self, session: Session):
        """创始人身份转让：目标必须是已注册且 active 的 DB 系统管理员（source ∈ grant/invite）。

        env 来源不可受让——其管理员身份由 env 控制、不稳定。自转让天然被该约束拦截
        （创始人自身 source=install）。
        """
        payload = AdminSystemAdminTransferPayload.model_validate(console_ns.payload or {})
        _require_current_password(payload.current_password)

        target = session.get(Account, payload.account_id)
        if not target:
            raise NotFound("Account not found.")
        if not (
            target.is_system_admin
            and target.system_admin_source in ("grant", "invite")
            and target.status == AccountStatus.ACTIVE
        ):
            raise BadRequest("Transfer target must be an active console-managed system admin.")

        # 重新从本 session 取创始人行：current_user 可能挂在别的 session 上，直接改不保证落库
        founder = session.get(Account, current_user.id)
        assert founder is not None  # founder_admin_required 已保证当前会话有效
        from_email, to_email = founder.email, target.email
        founder.system_admin_source = "grant"
        target.system_admin_source = "install"
        audit_log(
            "admin.transfer",
            founder.id,
            target_type="account",
            target_id=target.id,
            detail={
                "from_account_id": founder.id,
                "from_email": from_email,
                "to_account_id": target.id,
                "to_email": to_email,
            },
            session=session,
        )
        return dump_response(AdminSystemAdminActionResponse, {"result": "success"}), HTTPStatus.OK
