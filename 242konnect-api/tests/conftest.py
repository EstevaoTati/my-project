import pytest

from app import security


@pytest.fixture(autouse=True)
def fresh_security_state():
    """Rate-limit counters and cached tokens must not leak between tests."""
    security.reset_caches()
    yield
    security.reset_caches()
