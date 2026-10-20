"""Adversarial tests for the API's security controls (app/security.py).

Each test is an attack the API must refuse: no token, a forged token, someone
else's payment, a flood, an oversized or over-specified body, a leaky error.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app import momo, security
from app.main import app


@pytest.fixture
def users(monkeypatch):
    """Two real-looking accounts; any other token is rejected by 'Supabase'."""
    tokens = {"token-alice": "alice", "token-bob": "bob"}
    calls = []

    async def fake(token):
        calls.append(token)
        return tokens.get(token)

    monkeypatch.setattr(security, "verify_token", fake)
    return calls


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    momo._STORE.clear()
    momo._BY_KEY.clear()
    with TestClient(app) as c:
        yield c


# --------------------------------------------------------------------------- #
# Authentication
# --------------------------------------------------------------------------- #


def test_payments_require_a_token(client, users):
    body = {"operator": "mtn", "phone": "061234567", "amount": 100}
    assert client.post("/payments/momo/request-to-pay", json=body).status_code == 401
    assert client.get("/payments/momo/anything").status_code == 401


def test_a_forged_token_is_refused(client, users):
    response = client.get("/payments/momo/anything", headers=bearer("forged"))
    assert response.status_code == 401
    assert users == ["forged"]  # it was checked with Supabase, not trusted


def test_auth_fails_closed_when_supabase_is_unreachable(client, monkeypatch):
    async def down(token):
        raise httpx.ConnectError("unreachable")

    monkeypatch.setattr(security, "verify_token", down)
    assert client.get("/payments/momo/x", headers=bearer("token-alice")).status_code == 503


def test_auth_fails_closed_when_not_configured(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    assert client.get("/payments/momo/x", headers=bearer("token-alice")).status_code == 503


# --------------------------------------------------------------------------- #
# Object-level authorization (BOLA)
# --------------------------------------------------------------------------- #


def test_another_users_collection_looks_unknown(client, users):
    momo._STORE["c-1"] = momo.Collection(id="c-1", operator="mtn", phone="242061234567", amount=500, owner="alice")
    momo._STORE["c-1"].status = "successful"
    assert client.get("/payments/momo/c-1", headers=bearer("token-alice")).status_code == 200
    stolen = client.get("/payments/momo/c-1", headers=bearer("token-bob"))
    assert stolen.status_code == 404
    assert "242061234567" not in stolen.text


@pytest.mark.anyio
async def test_idempotency_keys_are_per_user(monkeypatch):
    """Bob reusing Alice's key must not be handed Alice's payment."""
    momo._STORE.clear()
    momo._BY_KEY.clear()
    started = []

    async def fake_mtn(record, label):
        started.append(record.owner)

    monkeypatch.setattr(momo, "_mtn_request_to_pay", fake_mtn)
    a = await momo.request_to_pay("mtn", "061234567", 500, "x", "shared-key-1", owner="alice")
    b = await momo.request_to_pay("mtn", "061234567", 500, "x", "shared-key-1", owner="bob")
    assert a.id != b.id and started == ["alice", "bob"]


# --------------------------------------------------------------------------- #
# Abuse limits
# --------------------------------------------------------------------------- #


def test_otp_start_is_rate_limited_per_address(client, monkeypatch):
    sent = []

    async def fake_send(**kwargs):
        sent.append(kwargs["to"])

    from app import main

    monkeypatch.setattr(main.transport, "send", fake_send)
    codes = [
        client.post("/auth/otp/start", json={"key": f"06{i:07d}", "email": f"u{i}@example.cg"}).status_code
        for i in range(12)
    ]
    assert codes[:10] == [200] * 10
    assert codes[10:] == [429, 429]
    assert len(sent) == 10


def test_payment_prompts_are_rate_limited_per_user(client, users, monkeypatch):
    async def fake_mtn(record, label):
        return None

    monkeypatch.setattr(momo, "_mtn_request_to_pay", fake_mtn)
    body = {"operator": "mtn", "phone": "061234567", "amount": 100}
    codes = [
        client.post("/payments/momo/request-to-pay", json=body, headers=bearer("token-alice")).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [200] * 10 and codes[10] == 429
    # Bob has his own budget.
    assert client.post("/payments/momo/request-to-pay", json=body, headers=bearer("token-bob")).status_code == 200


# --------------------------------------------------------------------------- #
# Input handling
# --------------------------------------------------------------------------- #


def test_oversized_bodies_are_refused(client):
    huge = {"key": "061234567", "email": "a@b.cg", "pad": "x" * 20_000}
    assert client.post("/auth/otp/start", json=huge).status_code == 413


def test_unknown_fields_are_refused(client, users):
    """Mass assignment: a field the API does not expect is an error, not ignored."""
    body = {"operator": "mtn", "phone": "061234567", "amount": 100, "owner": "bob", "status": "successful"}
    assert client.post("/payments/momo/request-to-pay", json=body, headers=bearer("token-alice")).status_code == 422


def test_markup_in_labels_is_refused(client, users):
    body = {"operator": "mtn", "phone": "061234567", "amount": 100, "label": "<script>x</script>"}
    assert client.post("/payments/momo/request-to-pay", json=body, headers=bearer("token-alice")).status_code == 422


# --------------------------------------------------------------------------- #
# Responses
# --------------------------------------------------------------------------- #


def test_security_headers_on_every_response(client):
    response = client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_cors_is_not_open_by_default(client):
    response = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_wildcard_cors_refused_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError):
        security.cors_origins()


def test_unexpected_errors_leak_nothing(monkeypatch):
    async def boom(collection_id):
        raise ValueError("SELECT * FROM secret_table WHERE key='sk_live_123'")

    monkeypatch.setattr(momo, "status", boom)
    monkeypatch.setattr(momo, "owner_of", lambda _id: "alice")

    async def fake(token):
        return "alice"

    monkeypatch.setattr(security, "verify_token", fake)
    with TestClient(app, raise_server_exceptions=False) as c:
        response = c.get("/payments/momo/c-9", headers=bearer("t"))
    assert response.status_code == 500
    assert "secret_table" not in response.text and "sk_live" not in response.text


def test_rate_limits_can_be_loosened_for_tests_but_never_removed(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_SCALE", "0")
    assert security._scale() == 1.0
    monkeypatch.setenv("RATE_LIMIT_SCALE", "not-a-number")
    assert security._scale() == 1.0
    monkeypatch.setenv("RATE_LIMIT_SCALE", "100")
    assert security._limit(10, 600).max_requests == 1000
