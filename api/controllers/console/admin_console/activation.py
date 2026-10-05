"""系统管理员邀请激活端点（/console/api/admin/activation）：公开，无鉴权装饰器。

受邀者是匿名用户，凭 redis 邀请 token 完成激活；与 /activate（空间成员邀请，
member_invite:token 命名空间）相互独立。
"""

import base64
import secrets
from http import HTTPStatus

from flask_restx import Resource
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from werkzeug.exceptions import BadRequest

from constants.languages import supported_language
from controllers.common.schema import query_params_from_model, query_params_from_request, register_schema_models
from controllers.common.session import with_session
from controllers.console import console_ns
from fields.base import ResponseModel
from libs.datetime_utils import naive_utc_now
from libs.helper import dump_response
from libs.password import hash_password, valid_password
from models.account import Account, AccountStatus
from services.system_admin_invite_service import get_invite, revoke_invite_token


class AdminActivationCheckQuery(BaseModel):
    token: str = Field(min_length=1)


class AdminActivationPayload(BaseModel):
    token: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1)
    interface_language: str | None = None

    @field_validator("interface_language")
    @classmethod
    def validate_lang(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return supported_language(value)


class AdminActivationCheckResponse(ResponseModel):
    is_valid: bool
    email: str | None = None


class AdminActivationResponse(ResponseModel):
    result: str


register_schema_models(
    console_ns,
    AdminActivationCheckQuery,
    AdminActivationPayload,
    AdminActivationCheckResponse,
    AdminActivationResponse,
)


def _load_pending_invitee(session: Session, token: str) -> Account:
    invite = get_invite(token)
    if not invite:
        raise BadRequest("Invalid or expired activation token.")
    account = session.get(Account, invite["account_id"])
    if not account or account.status != AccountStatus.PENDING:
        # token 无效或已激活同口径 400，不泄露账号状态
        raise BadRequest("Invalid or expired activation token.")
    return account


@console_ns.route("/admin/activation/check")
class AdminActivationCheckApi(Resource):
    @console_ns.doc("check_admin_activation_token")
    @console_ns.doc(params=query_params_from_model(AdminActivationCheckQuery))
    @console_ns.response(HTTPStatus.OK, "Success", console_ns.models[AdminActivationCheckResponse.__name__])
    @with_session(write=False)
    def get(self, session: Session):
        args = query_params_from_request(AdminActivationCheckQuery)

        invite = get_invite(args.token)
        account = session.get(Account, invite["account_id"]) if invite else None
        is_valid = bool(account) and account.status == AccountStatus.PENDING
        return dump_response(
            AdminActivationCheckResponse,
            {"is_valid": is_valid, "email": account.email if is_valid else None},
        ), HTTPStatus.OK


@console_ns.route("/admin/activation")
class AdminActivationApi(Resource):
    @console_ns.doc("activate_system_admin")
    @console_ns.expect(console_ns.models[AdminActivationPayload.__name__])
    @console_ns.response(HTTPStatus.OK, "Activated", console_ns.models[AdminActivationResponse.__name__])
    @console_ns.response(400, "Invalid or expired token")
    @with_session(write=True)
    def post(self, session: Session):
        payload = AdminActivationPayload.model_validate(console_ns.payload or {})

        account = _load_pending_invitee(session, payload.token)
        try:
            valid_password(payload.password)
        except ValueError as e:
            raise BadRequest(str(e)) from e

        salt = secrets.token_bytes(16)
        account.password_salt = base64.b64encode(salt).decode()
        account.password = base64.b64encode(hash_password(payload.password, salt)).decode()
        account.name = payload.name
        if payload.interface_language:
            account.interface_language = payload.interface_language
        account.status = AccountStatus.ACTIVE
        account.initialized_at = naive_utc_now()

        revoke_invite_token(payload.token)

        return dump_response(AdminActivationResponse, {"result": "success"}), HTTPStatus.OK
