import json
from unittest.mock import MagicMock

from services.audit_service import audit_log


def test_audit_log_writes_row():
    session = MagicMock()
    audit_log(
        "workspace.create",
        "actor-1",
        target_type="workspace",
        target_id="t-1",
        workspace_id="t-1",
        detail={"name": "研发部"},
        session=session,
    )
    added = session.add.call_args[0][0]
    assert added.action == "workspace.create"
    assert added.actor_account_id == "actor-1"
    assert json.loads(added.detail) == {"name": "研发部"}


def test_audit_log_default_detail():
    session = MagicMock()
    audit_log("admin.transfer", "actor-1", session=session)
    added = session.add.call_args[0][0]
    assert json.loads(added.detail) == {}
