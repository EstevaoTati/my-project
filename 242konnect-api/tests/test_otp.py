"""Tests for the OTP service.

Weighted towards the properties that matter if someone attacks it: the code is
never returned over the wire, wrong codes are refused, attempts are capped,
codes expire, and a code cannot be replayed.
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app import mailer, otp
from app.main import app


class RecordingTransport:
    """Captures what would have been sent, so tests can read the code."""

    name = "recording"

    def __init__(self):
        self.sent: list[dict] = []

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        self.sent.append({"to": to, "subject": subject, "html": html, "text": text})


@pytest.fixture
def transport(monkeypatch):
    recorder = RecordingTransport()
    monkeypatch.setattr("app.main.transport", recorder)
    otp.clear()
    return recorder


@pytest.fixture
def client():
    return TestClient(app)


def code_from(transport: RecordingTransport) -> str:
    """Pulls the six digits out of the most recent message."""
    import re

    match = re.search(r"\b(\d{6})\b", transport.sent[-1]["text"])
    assert match, "no code in the sent message"
    return match.group(1)


def test_start_does_not_return_the_code(client, transport):
    response = client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    assert response.status_code == 200
    body = response.json()
    assert body["sent"] is True
    # The whole point: the code travels by e-mail, not in the response.
    code = code_from(transport)
    assert code not in response.text


def test_code_is_emailed_to_the_right_address(client, transport):
    client.post("/auth/otp/start", json={"key": "061234567", "email": "estevao@mwinda.cg"})
    assert transport.sent[-1]["to"] == "estevao@mwinda.cg"
    # Subject leads with the code so it is readable from a notification.
    assert code_from(transport) in transport.sent[-1]["subject"]
    # Both bodies carry it: some clients refuse HTML.
    assert code_from(transport) in transport.sent[-1]["html"]


def test_verify_accepts_the_real_code(client, transport):
    client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    code = code_from(transport)
    response = client.post("/auth/otp/verify", json={"key": "061234567", "code": code})
    assert response.status_code == 200
    assert response.json() == {"verified": True}


def test_verify_refuses_a_wrong_code(client, transport):
    client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    real = code_from(transport)
    wrong = "000000" if real != "000000" else "111111"
    response = client.post("/auth/otp/verify", json={"key": "061234567", "code": wrong})
    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"].lower()


def test_a_code_cannot_be_replayed(client, transport):
    client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    code = code_from(transport)
    assert client.post("/auth/otp/verify", json={"key": "061234567", "code": code}).status_code == 200
    again = client.post("/auth/otp/verify", json={"key": "061234567", "code": code})
    assert again.status_code == 400


def test_attempts_are_capped(client, transport):
    client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    real = code_from(transport)
    wrong = "000000" if real != "000000" else "111111"
    statuses = [
        client.post("/auth/otp/verify", json={"key": "061234567", "code": wrong}).status_code
        for _ in range(otp.MAX_ATTEMPTS + 1)
    ]
    # The cap must bite before someone can walk a six-digit space.
    assert 429 in statuses
    # And the challenge is destroyed, so the real code no longer works either.
    assert client.post("/auth/otp/verify", json={"key": "061234567", "code": real}).status_code == 400


def test_codes_expire(client, transport, monkeypatch):
    client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    code = code_from(transport)
    monkeypatch.setattr(time, "time", lambda: time.__dict__["time"]() if False else 1e12)
    response = client.post("/auth/otp/verify", json={"key": "061234567", "code": code})
    assert response.status_code == 400
    assert "expiré" in response.json()["detail"]


def test_resend_is_rate_limited(client, transport):
    first = client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    assert first.status_code == 200
    second = client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    assert second.status_code == 429


def test_verify_without_a_challenge_is_refused(client, transport):
    response = client.post("/auth/otp/verify", json={"key": "inconnu", "code": "123456"})
    assert response.status_code == 400


def test_invalid_email_is_rejected(client, transport):
    response = client.post("/auth/otp/start", json={"key": "061234567", "email": "pas-un-email"})
    assert response.status_code == 422
    assert transport.sent == []


def test_delivery_failure_does_not_leak_the_provider_reason(client, monkeypatch):
    class Failing:
        name = "failing"

        async def send(self, **_):
            raise mailer.MailError("resend 403: domain not verified, key sk_live_abc123")

    monkeypatch.setattr("app.main.transport", Failing())
    otp.clear()
    response = client.post("/auth/otp/start", json={"key": "061234567", "email": "a@b.cg"})
    assert response.status_code == 502
    # The provider's message can name the key or the domain; it must not travel.
    assert "sk_live" not in response.text
    assert "resend" not in response.text.lower()


def test_health_reports_whether_mail_actually_sends(client, transport):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert "sends_email" in body


def test_console_transport_is_the_default_without_a_key(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert mailer.build_transport().name == "console"


def test_resend_transport_is_used_when_a_key_is_present(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "sk_test_x")
    assert mailer.build_transport().name == "resend"
