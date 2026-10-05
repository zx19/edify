from unittest.mock import MagicMock, patch

import pytest
from werkzeug.exceptions import Forbidden

from controllers.console.admin import founder_admin_required, system_admin_required


@system_admin_required
def _view():
    return "ok"


@founder_admin_required
def _founder_view():
    return "ok"


def test_allows_system_admin():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_system_admin", return_value=True),
    ):
        cu.return_value = MagicMock(is_authenticated=True)
        assert _view() == "ok"


def test_rejects_non_admin():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_system_admin", return_value=False),
    ):
        cu.return_value = MagicMock(is_authenticated=True)
        with pytest.raises(Forbidden):
            _view()


def test_founder_required_allows_founder():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_founder_admin", return_value=True),
    ):
        cu.return_value = MagicMock(is_authenticated=True)
        assert _founder_view() == "ok"


def test_founder_required_rejects_ordinary_admin():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_founder_admin", return_value=False),
    ):
        cu.return_value = MagicMock(is_authenticated=True)
        with pytest.raises(Forbidden):
            _founder_view()
