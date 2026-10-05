"""系统管理操作审计埋点：写入 admin_audit_logs。action 取值域（点分小写）：
workspace.create|archive|unarchive、admin.grant|revoke|transfer。"""

import json

from sqlalchemy.orm import Session

from models.admin_audit import AdminAuditLog


def audit_log(
    action: str,
    actor_account_id: str,
    target_type: str | None = None,
    target_id: str | None = None,
    workspace_id: str | None = None,
    detail: dict | None = None,
    *,
    session: Session,
) -> None:
    """系统管理操作审计。调用方负责 commit。"""
    session.add(
        AdminAuditLog(
            actor_account_id=actor_account_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            workspace_id=workspace_id,
            detail=json.dumps(detail or {}, ensure_ascii=False),
        )
    )
