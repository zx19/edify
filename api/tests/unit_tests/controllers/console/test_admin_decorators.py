from unittest.mock import patch

import pytest
from werkzeug.exceptions import Forbidden, Unauthorized

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
        patch("controllers.console.admin.check_csrf_token"),
    ):
        cu.is_authenticated = True
        assert _view() == "ok"


def test_rejects_non_admin():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_system_admin", return_value=False),
        patch("controllers.console.admin.check_csrf_token"),
    ):
        cu.is_authenticated = True
        with pytest.raises(Forbidden):
            _view()


def test_rejects_csrf_failure():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch(
            "controllers.console.admin.check_csrf_token", side_effect=Unauthorized("CSRF token is missing or invalid.")
        ),
        patch("controllers.console.admin.is_system_admin", return_value=True) as mock_admin_check,
    ):
        cu.is_authenticated = True
        with pytest.raises(Unauthorized):
            _view()
        # CSRF 先于鉴权判定：token 不过则不打角色查询
        mock_admin_check.assert_not_called()


def test_rejects_unauthenticated():
    with patch("controllers.console.admin.current_user") as cu:
        cu.is_authenticated = False
        with pytest.raises(Unauthorized):
            _view()


def test_founder_required_allows_founder():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_founder_admin", return_value=True),
        patch("controllers.console.admin.check_csrf_token"),
    ):
        cu.is_authenticated = True
        assert _founder_view() == "ok"


def test_founder_required_rejects_ordinary_admin():
    with (
        patch("controllers.console.admin.current_user") as cu,
        patch("controllers.console.admin.is_founder_admin", return_value=False),
        patch("controllers.console.admin.check_csrf_token"),
    ):
        cu.is_authenticated = True
        with pytest.raises(Forbidden):
            _founder_view()


def test_founder_required_rejects_unauthenticated():
    with patch("controllers.console.admin.current_user") as cu:
        cu.is_authenticated = False
        with pytest.raises(Unauthorized):
            _founder_view()
