from unittest.mock import MagicMock, patch

from services.system_admin_service import get_system_admin_source, is_founder_admin, is_system_admin


def _account(email="a@x.com", flag=False, source=None):
    acc = MagicMock()
    acc.email = email
    acc.is_system_admin = flag
    acc.system_admin_source = source
    return acc


def test_flag_true_short_circuits():
    assert is_system_admin(_account(flag=True, source="grant")) is True


@patch("services.system_admin_service.dify_config")
def test_env_list_match_case_insensitive(mock_cfg):
    mock_cfg.SYSTEM_ADMIN_EMAILS = ["Ops@X.com", "b@x.com"]
    assert is_system_admin(_account(email="ops@x.com")) is True
    assert is_system_admin(_account(email="c@x.com")) is False


@patch("services.system_admin_service.dify_config")
def test_source_derivation(mock_cfg):
    mock_cfg.SYSTEM_ADMIN_EMAILS = ["ops@x.com"]
    assert get_system_admin_source(_account(flag=True, source="install")) == "install"
    assert get_system_admin_source(_account(email="ops@x.com")) == "env"  # env 命中、列未置位
    assert get_system_admin_source(_account(email="c@x.com")) is None


def test_founder_only_install_source():
    assert is_founder_admin(_account(flag=True, source="install")) is True
    assert is_founder_admin(_account(flag=True, source="grant")) is False
    assert is_founder_admin(_account(flag=False, source="install")) is False
