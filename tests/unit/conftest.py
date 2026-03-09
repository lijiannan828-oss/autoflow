"""Unit test conftest — auto-apply 'unit' marker to all tests in this tree."""

import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        if "/tests/unit/" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
