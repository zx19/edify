from datetime import datetime
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import TypeBase
from .types import LongText, StringUUID


class AdminAuditLog(TypeBase):
    __tablename__ = "admin_audit_logs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="admin_audit_log_pkey"),
        sa.Index("admin_audit_logs_workspace_idx", "workspace_id"),
        sa.Index("admin_audit_logs_action_idx", "action"),
        sa.Index("admin_audit_logs_created_idx", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        StringUUID, insert_default=lambda: str(uuid4()), default_factory=lambda: str(uuid4()), init=False
    )
    actor_account_id: Mapped[str] = mapped_column(StringUUID)
    action: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[str | None] = mapped_column(String(32), default=None)
    target_id: Mapped[str | None] = mapped_column(String(64), default=None)
    workspace_id: Mapped[str | None] = mapped_column(StringUUID, default=None)
    detail: Mapped[str | None] = mapped_column(LongText, default=None)  # JSON 字符串
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False, init=False
    )
