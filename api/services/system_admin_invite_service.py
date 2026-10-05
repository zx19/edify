"""系统管理员邀请 token：redis 存取（TTL 72h）。与 system_admin_service（判定）保持分离。

正向索引 `system_admin_invite:token:{token}` → JSON {account_id, email}；
反向索引 `system_admin_invite:account:{account_id}` → token（撤销待激活邀请/重发作废旧 token 用）。
"""

import json
import uuid

from extensions.ext_redis import redis_client

SYSTEM_ADMIN_INVITE_EXPIRY_HOURS = 72

# 邀请链接路径（前端激活页）：响应 invite_url = f"{SYSTEM_ADMIN_INVITE_URL_PATH}?token={token}"
SYSTEM_ADMIN_INVITE_URL_PATH = "/activate"

_TOKEN_KEY_PREFIX = "system_admin_invite:token:"
_ACCOUNT_KEY_PREFIX = "system_admin_invite:account:"


def _token_key(token: str) -> str:
    return f"{_TOKEN_KEY_PREFIX}{token}"


def _account_key(account_id: str) -> str:
    return f"{_ACCOUNT_KEY_PREFIX}{account_id}"


def issue_invite_token(account_id: str, email: str) -> str:
    """签发（或刷新）邀请 token：同账号旧 token 先作废，正反向索引同 TTL。"""
    revoke_invite_for_account(account_id)
    token = uuid.uuid4().hex
    ttl = SYSTEM_ADMIN_INVITE_EXPIRY_HOURS * 3600
    payload = json.dumps({"account_id": account_id, "email": email}, ensure_ascii=False)
    redis_client.setex(_token_key(token), ttl, payload)
    redis_client.setex(_account_key(account_id), ttl, token)
    return token


def get_invite(token: str) -> dict | None:
    raw = redis_client.get(_token_key(token))
    if not raw:
        return None
    return json.loads(raw)


def revoke_invite_token(token: str) -> None:
    invite = get_invite(token)
    redis_client.delete(_token_key(token))
    if invite and invite.get("account_id"):
        redis_client.delete(_account_key(invite["account_id"]))


def revoke_invite_for_account(account_id: str) -> None:
    token = redis_client.get(_account_key(account_id))
    redis_client.delete(_account_key(account_id))
    if token:
        redis_client.delete(_token_key(token.decode() if isinstance(token, bytes) else token))
