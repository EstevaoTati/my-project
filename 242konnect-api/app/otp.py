"""OTP issuing, verification and delivery.

Why this lives on a server and not in the app
---------------------------------------------
Sending e-mail needs a provider API key. A React Native bundle is extractable:
anyone with the APK can pull a key out of it and send mail as 242Konnect —
phishing under the brand, and the bill lands on us. So the key stays here and
the app only ever calls this service.

The cahier des charges already puts it here: §10.5 lists OTP among the APIs,
and §11.2 fixes the stack as Python/FastAPI.

Storage is in-process for now. Codes are short-lived and low-value, so losing
them on restart only forces a resend. Moving to PostgreSQL (§11.2) means
replacing `_STORE` with a table — nothing else in this module changes.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass

CODE_LENGTH = 6
TTL_SECONDS = 10 * 60
MAX_ATTEMPTS = 5
# Enough to stop someone walking the code space, loose enough for a real person
# who mistyped and asked for another.
RESEND_COOLDOWN_SECONDS = 30


@dataclass
class Challenge:
    """One outstanding verification."""

    # The code is stored hashed. A leaked process dump or log line should not
    # hand over live codes, and we never need the plaintext again after sending.
    code_hash: str
    email: str
    expires_at: float
    issued_at: float
    attempts: int = 0


_STORE: dict[str, Challenge] = {}


def _pepper() -> bytes:
    """Separates our hashes from a generic rainbow table.

    Falls back to a per-process random value so a missing env var degrades to
    "codes don't survive a restart" rather than to a weaker hash.
    """
    return os.environ.get("OTP_PEPPER", "").encode() or _RUNTIME_PEPPER


_RUNTIME_PEPPER = secrets.token_bytes(32)


def _hash(code: str, key: str) -> str:
    return hmac.new(_pepper(), f"{key}:{code}".encode(), hashlib.sha256).hexdigest()


def _generate() -> str:
    """A uniformly random N-digit code, leading zeros preserved."""
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


class OtpError(Exception):
    """Something the caller should see as a 4xx, with a French message."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def issue(key: str, email: str) -> str:
    """Creates or replaces the challenge for `key`, returning the plaintext code.

    The caller is expected to hand the code straight to the mailer and then drop
    it; it is never returned to the client.
    """
    existing = _STORE.get(key)
    if existing and time.time() - existing.issued_at < RESEND_COOLDOWN_SECONDS:
        wait = int(RESEND_COOLDOWN_SECONDS - (time.time() - existing.issued_at))
        raise OtpError(f"Patientez {wait} secondes avant de demander un nouveau code.", 429)

    code = _generate()
    now = time.time()
    _STORE[key] = Challenge(
        code_hash=_hash(code, key),
        email=email,
        expires_at=now + TTL_SECONDS,
        issued_at=now,
    )
    return code


def verify(key: str, code: str) -> None:
    """Raises OtpError unless `code` is the live code for `key`."""
    challenge = _STORE.get(key)
    if challenge is None:
        raise OtpError("Aucune vérification en cours. Demandez un nouveau code.")

    if time.time() > challenge.expires_at:
        del _STORE[key]
        raise OtpError("Ce code a expiré. Demandez un nouveau code.")

    if challenge.attempts >= MAX_ATTEMPTS:
        del _STORE[key]
        raise OtpError("Trop de tentatives. Demandez un nouveau code.", 429)

    challenge.attempts += 1

    # compare_digest, not ==: a plain comparison leaks how much of the code was
    # right through timing, which matters for a six-digit secret.
    if not hmac.compare_digest(challenge.code_hash, _hash(code.strip(), key)):
        remaining = MAX_ATTEMPTS - challenge.attempts
        if remaining <= 0:
            del _STORE[key]
            raise OtpError("Trop de tentatives. Demandez un nouveau code.", 429)
        raise OtpError("Code incorrect. Vérifiez les chiffres reçus.")

    # Single use.
    del _STORE[key]


def pending_count() -> int:
    """Outstanding challenges, for the health endpoint."""
    now = time.time()
    return sum(1 for c in _STORE.values() if c.expires_at > now)


def clear() -> None:
    """Test hook."""
    _STORE.clear()
