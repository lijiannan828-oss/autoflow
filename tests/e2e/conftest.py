"""E2E test conftest — auto-apply 'e2e' marker."""

import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        if "/tests/e2e/" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
