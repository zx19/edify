"""add system admin fields to accounts

Adds the persisted system-admin flag (`is_system_admin`) and its provenance
column (`system_admin_source`: 'install'|'grant'|'invite'). The env-based
allowlist (SYSTEM_ADMIN_EMAILS) is config-only and intentionally not reflected
here; the two sources are unioned at read time by services.system_admin_service.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a7b73f18e2dc"
down_revision = "5578e028b2f2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("accounts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_system_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        batch_op.add_column(sa.Column("system_admin_source", sa.String(length=16), nullable=True))


def downgrade():
    with op.batch_alter_table("accounts", schema=None) as batch_op:
        batch_op.drop_column("system_admin_source")
        batch_op.drop_column("is_system_admin")
