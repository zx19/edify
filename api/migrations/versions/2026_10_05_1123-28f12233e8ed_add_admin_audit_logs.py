"""add admin audit logs

系统管理操作审计表：admin_audit_logs（actor/action/target/workspace/detail JSON + 三索引）。

Revision ID: 28f12233e8ed
Revises: a7b73f18e2dc
Create Date: 2026-10-05 11:23:00.000000

"""

import sqlalchemy as sa
from alembic import op

import models.types

# revision identifiers, used by Alembic.
revision = "28f12233e8ed"
down_revision = "a7b73f18e2dc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", models.types.StringUUID(), nullable=False),
        sa.Column("actor_account_id", models.types.StringUUID(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("workspace_id", models.types.StringUUID(), nullable=True),
        sa.Column("detail", models.types.LongText(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="admin_audit_log_pkey"),
    )
    with op.batch_alter_table("admin_audit_logs", schema=None) as batch_op:
        batch_op.create_index("admin_audit_logs_workspace_idx", ["workspace_id"], unique=False)
        batch_op.create_index("admin_audit_logs_action_idx", ["action"], unique=False)
        batch_op.create_index("admin_audit_logs_created_idx", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("admin_audit_logs")
