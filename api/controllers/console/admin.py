from collections.abc import Callable
from functools import wraps

from flask import request
from flask_login import current_user
from werkzeug.exceptions import Forbidden, Unauthorized

from configs import dify_config
from libs.token import extract_access_token
from services.system_admin_service import is_founder_admin, is_system_admin


def admin_required[**P, R](view: Callable[P, R]) -> Callable[P, R]:
    @wraps(view)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
        if not dify_config.ADMIN_API_KEY:
            raise Unauthorized("API key is invalid.")

        auth_token = extract_access_token(request)
        if not auth_token:
            raise Unauthorized("Authorization header is missing.")
        if auth_token != dify_config.ADMIN_API_KEY:
            raise Unauthorized("API key is invalid.")

        return view(*args, **kwargs)

    return decorated


def system_admin_required[**P, R](view: Callable[P, R]) -> Callable[P, R]:
    """系统管理员（人）会话校验。与机器通道 admin_required（ADMIN_API_KEY）并存。

    注意：不得改用 current_account_with_tenant()——系统管理员可能无空间。
    """

    @wraps(view)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
        if not current_user.is_authenticated:
            raise Unauthorized("Login required.")
        if not is_system_admin(current_user):
            raise Forbidden("System admin only.")
        return view(*args, **kwargs)

    return decorated


def founder_admin_required[**P, R](view: Callable[P, R]) -> Callable[P, R]:
    """创始人管理员校验（两级模型：名单授予/撤销/转让独占）。普通系统管理员 403 兜底。"""

    @wraps(view)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
        if not current_user.is_authenticated:
            raise Unauthorized("Login required.")
        if not is_founder_admin(current_user):
            raise Forbidden("Founder admin only.")
        return view(*args, **kwargs)

    return decorated
