"""Tests for Mobile Money collections.

The operators are stubbed at the HTTP layer, so these exercise our own logic —
which is where the money bugs live: whether a debit is reported before the
customer confirmed, whether a failed status *read* gets mistaken for a failed
*payment*, and whether the right MSISDN reaches the operator.
"""

from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import momo
from app.main import app

MTN_ENV = {
    "MTN_MOMO_SUBSCRIPTION_KEY": "sub-key",
    "MTN_MOMO_API_USER": "api-user",
    "MTN_MOMO_API_KEY": "api-key",
    "MTN_MOMO_ENVIRONMENT": "sandbox",
    "MTN_MOMO_BASE_URL": "https://mtn.test",
}

AIRTEL_ENV = {
    "AIRTEL_CLIENT_ID": "client-id",
    "AIRTEL_CLIENT_SECRET": "client-secret",
    "AIRTEL_ENVIRONMENT": "sandbox",
    "AIRTEL_COUNTRY": "CG",
    "AIRTEL_CURRENCY": "XAF",
    "AIRTEL_BASE_URL": "https://airtel.test",
}


@pytest.fixture(autouse=True)
def clear_store():
    momo._STORE.clear()
    yield
    momo._STORE.clear()


def use_env(monkeypatch, env: dict[str, str]) -> None:
    for key, value in env.items():
        monkeypatch.setenv(key, value)


class StubTransport(httpx.AsyncBaseTransport):
    """Answers the operator calls, and records what we sent them."""

    def __init__(self, routes: dict[tuple[str, str], httpx.Response]):
        self.routes = routes
        self.seen: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        key = (request.method, request.url.path)
        if key not in self.routes:
            return httpx.Response(404, json={"error": f"unstubbed {key}"})
        response = self.routes[key]
        return httpx.Response(
            response.status_code, content=response.content, headers=response.headers
        )


@pytest.fixture
def stub(monkeypatch):
    """Installs a transport into every AsyncClient the module creates."""
    holder: dict[str, StubTransport] = {}
    original = httpx.AsyncClient.__init__

    def patched(self, *args, **kwargs):
        kwargs["transport"] = holder["transport"]
        original(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched)

    def install(routes):
        holder["transport"] = StubTransport(routes)
        return holder["transport"]

    return install


# --------------------------------------------------------------------------- #
# Normalisation
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("061234567", "242061234567"),
        ("06 123 45 67", "242061234567"),
        ("242061234567", "242061234567"),
    ],
)
def test_msisdn_normalisation(raw, expected):
    assert momo._msisdn(raw) == expected


def test_unconfigured_operator_is_refused_not_faked(monkeypatch):
    for key in list(MTN_ENV) + list(AIRTEL_ENV):
        monkeypatch.delenv(key, raising=False)
    assert momo.configured("mtn") is False
    assert momo.configured("airtel") is False


# --------------------------------------------------------------------------- #
# MTN
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_mtn_request_to_pay_starts_pending(monkeypatch, stub):
    use_env(monkeypatch, MTN_ENV)
    transport = stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/collection/v1_0/requesttopay"): httpx.Response(202),
        }
    )

    record = await momo.request_to_pay("mtn", "061234567", 25000, "mission")

    # Nothing is debited until the payer enters their PIN.
    assert record.status == "pending"
    assert record.operator_reference is None

    sent = json.loads(transport.seen[-1].content)
    assert sent["payer"]["partyId"] == "242061234567"
    assert sent["amount"] == "25000"
    # The idempotency header is what makes a retry safe rather than a double debit.
    assert transport.seen[-1].headers["X-Reference-Id"] == record.id


@pytest.mark.anyio
async def test_mtn_successful_status_carries_operator_reference(monkeypatch, stub):
    use_env(monkeypatch, MTN_ENV)
    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/collection/v1_0/requesttopay"): httpx.Response(202),
        }
    )
    record = await momo.request_to_pay("mtn", "061234567", 1000, "mission")

    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("GET", f"/collection/v1_0/requesttopay/{record.id}"): httpx.Response(
                200, json={"status": "SUCCESSFUL", "financialTransactionId": "FT-9001"}
            ),
        }
    )
    settled = await momo.status(record.id)
    assert settled.status == "successful"
    assert settled.operator_reference == "FT-9001"


@pytest.mark.anyio
async def test_mtn_failure_reason_is_translated(monkeypatch, stub):
    use_env(monkeypatch, MTN_ENV)
    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/collection/v1_0/requesttopay"): httpx.Response(202),
        }
    )
    record = await momo.request_to_pay("mtn", "061234567", 1000, "mission")

    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("GET", f"/collection/v1_0/requesttopay/{record.id}"): httpx.Response(
                200, json={"status": "FAILED", "reason": "NOT_ENOUGH_FUNDS"}
            ),
        }
    )
    settled = await momo.status(record.id)
    assert settled.status == "failed"
    assert settled.reason == "Solde insuffisant sur le compte MTN MoMo."


@pytest.mark.anyio
async def test_unreadable_status_stays_pending(monkeypatch, stub):
    """A failed status *read* must not be reported as a failed *payment*.

    The customer may already have entered their PIN; calling it failed here
    would tell them nothing was taken while the operator says otherwise.
    """
    use_env(monkeypatch, MTN_ENV)
    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/collection/v1_0/requesttopay"): httpx.Response(202),
        }
    )
    record = await momo.request_to_pay("mtn", "061234567", 1000, "mission")

    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("GET", f"/collection/v1_0/requesttopay/{record.id}"): httpx.Response(500),
        }
    )
    assert (await momo.status(record.id)).status == "pending"


@pytest.mark.anyio
async def test_settled_collections_are_not_re_polled(monkeypatch, stub):
    use_env(monkeypatch, MTN_ENV)
    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/collection/v1_0/requesttopay"): httpx.Response(202),
        }
    )
    record = await momo.request_to_pay("mtn", "061234567", 1000, "mission")
    record.status = "successful"

    # Every route unstubbed: reaching the network at all would 404 and downgrade
    # the record, so this passing means we short-circuited.
    transport = stub({})
    assert (await momo.status(record.id)).status == "successful"
    assert transport.seen == []


@pytest.mark.anyio
async def test_rejected_request_raises_rather_than_recording(monkeypatch, stub):
    use_env(monkeypatch, MTN_ENV)
    stub(
        {
            ("POST", "/collection/token/"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/collection/v1_0/requesttopay"): httpx.Response(400, json={}),
        }
    )
    with pytest.raises(momo.MomoError):
        await momo.request_to_pay("mtn", "061234567", 1000, "mission")
    # A request that never reached the payer must leave nothing to poll.
    assert momo._STORE == {}


# --------------------------------------------------------------------------- #
# Airtel
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_airtel_request_uses_national_msisdn(monkeypatch, stub):
    use_env(monkeypatch, AIRTEL_ENV)
    transport = stub(
        {
            ("POST", "/auth/oauth2/token"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/merchant/v1/payments/"): httpx.Response(
                200, json={"status": {"success": True}}
            ),
        }
    )
    record = await momo.request_to_pay("airtel", "045550000", 7500, "mission")

    sent = json.loads(transport.seen[-1].content)
    # Airtel wants the subscriber number without the country code.
    assert sent["subscriber"]["msisdn"] == "045550000"
    assert sent["transaction"]["amount"] == 7500
    assert transport.seen[-1].headers["X-Country"] == "CG"
    assert transport.seen[-1].headers["X-Currency"] == "XAF"
    assert record.status == "pending"


@pytest.mark.anyio
async def test_airtel_ts_is_success(monkeypatch, stub):
    use_env(monkeypatch, AIRTEL_ENV)
    stub(
        {
            ("POST", "/auth/oauth2/token"): httpx.Response(200, json={"access_token": "t"}),
            ("POST", "/merchant/v1/payments/"): httpx.Response(
                200, json={"status": {"success": True}}
            ),
        }
    )
    record = await momo.request_to_pay("airtel", "045550000", 1000, "mission")

    stub(
        {
            ("POST", "/auth/oauth2/token"): httpx.Response(200, json={"access_token": "t"}),
            ("GET", f"/standard/v1/payments/{record.id}"): httpx.Response(
                200,
                json={"data": {"transaction": {"status": "TS", "airtel_money_id": "AM-42"}}},
            ),
        }
    )
    settled = await momo.status(record.id)
    assert settled.status == "successful"
    assert settled.operator_reference == "AM-42"


# --------------------------------------------------------------------------- #
# HTTP surface
# --------------------------------------------------------------------------- #


def test_status_of_unknown_collection_is_404():
    with TestClient(app) as client:
        assert client.get("/payments/momo/nope").status_code == 404


def test_request_to_pay_rejects_bad_input():
    with TestClient(app) as client:
        assert client.post(
            "/payments/momo/request-to-pay",
            json={"operator": "orange", "phone": "061234567", "amount": 100},
        ).status_code == 422
        assert client.post(
            "/payments/momo/request-to-pay",
            json={"operator": "mtn", "phone": "061234567", "amount": 0},
        ).status_code == 422


def test_health_reports_which_operators_are_live():
    with TestClient(app) as client:
        body = client.get("/health").json()
        assert set(body["momo"]) == {"mtn", "airtel"}
