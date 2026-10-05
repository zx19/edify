from unittest.mock import MagicMock, patch

from models.account import AccountStatus
from services.account_service import AccountService


def _session_no_tenant():
    session = MagicMock()
    session.scalar.return_value = None  # 无任何 TenantAccountJoin
    return session


def test_load_user_system_admin_without_tenant_allowed():
    account = MagicMock(status=AccountStatus.ACTIVE)
    session = _session_no_tenant()
    session.get.return_value = account
    with patch("services.account_service.is_system_admin", return_value=True):
        result = AccountService.load_user("uid", session=session)
    assert result is account


def test_load_user_normal_without_tenant_rejected():
    account = MagicMock(status=AccountStatus.ACTIVE)
    session = _session_no_tenant()
    session.get.return_value = account
    with patch("services.account_service.is_system_admin", return_value=False):
        result = AccountService.load_user("uid", session=session)
    assert result is None
