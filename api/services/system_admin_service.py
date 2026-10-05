"""系统管理员判定：持久化标记 ∪ env 名单（大小写不敏感）；创始人 = source=install（全部署恒一位）。"""

from configs import dify_config
from models.account import Account


def _env_hit(account: Account) -> bool:
    emails = {e.lower() for e in (dify_config.SYSTEM_ADMIN_EMAILS or [])}
    return bool(account.email) and account.email.lower() in emails


def is_system_admin(account: Account) -> bool:
    if getattr(account, "is_system_admin", False):
        return True
    return _env_hit(account)


def get_system_admin_source(account: Account) -> str | None:
    """'install'|'grant'|'invite'（持久化列）；仅 env 命中时 'env'；非管理员 None。"""
    if getattr(account, "is_system_admin", False):
        return account.system_admin_source
    return "env" if _env_hit(account) else None


def is_founder_admin(account: Account) -> bool:
    return getattr(account, "is_system_admin", False) and account.system_admin_source == "install"
