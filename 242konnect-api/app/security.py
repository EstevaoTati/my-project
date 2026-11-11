"""Request-level security for the 242Konnect API.

Everything here is enforced on the server, because the app is an untrusted
client (anyone can call these endpoints with curl):

- ``require_user``: the caller is identified by their Supabase access token,
  checked against Supabase Auth itself — signature, expiry and revocation —
  never by an id sent in the body.
- ``RateLimiter``: sliding-window limits per client address and per subject
  (user, e-mail address), so one caller cannot flood the mailer, guess codes
  in bulk or spam Mobile Money PIN prompts at someone's phone.
- ``BodySizeLimit``: requests over a fixed size are refused before parsing.
- ``SecurityHeaders``: responses are not cached, sniffed or framed.

The limiter and the token cache are in-process, like the OTP store: correct
for one worker. A second worker needs Redis (see docs/security/assessment.md,
risk R-05).
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from collections import deque
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger("242konnect.security")

# --------------------------------------------------------------------------- #
# Client address
# --------------------------------------------------------------------------- #


def client_ip(request: Request) -> str:
    """The caller's address. X-Forwarded-For is trusted only behind a proxy
    that sets it (TRUST_PROXY=1); otherwise anyone could forge it to dodge the
    rate limits."""
    if os.environ.get("TRUST_PROXY") == "1":
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


def mask_email(email: str) -> str:
    """For logs: enough to correlate, not enough to harvest."""
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


# --------------------------------------------------------------------------- #
# Rate limiting
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Limit:
    max_requests: int
    window_seconds: float


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str, limit: Limit) -> None:
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > limit.window_seconds:
            hits.popleft()
        if len(hits) >= limit.max_requests:
            retry = max(1, int(limit.window_seconds - (now - hits[0])))
            log.warning("rate limit hit: %s", key.split(":", 1)[0])
            raise HTTPException(
                status_code=429,
                detail="Trop de demandes. Réessayez dans quelques minutes.",
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)
        # Keep memory bounded under a flood of distinct keys.
        if len(self._hits) > 50_000:
            self._hits = {k: v for k, v in self._hits.items() if v and now - v[-1] < 3600}

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()

def _scale() -> float:
    """RATE_LIMIT_SCALE multiplies every limit — for the end-to-end test
    suites, which sign up dozens of accounts from one address in a minute.
    Never below 1: configuration can loosen a limit for tests, never remove it.
    Production leaves it unset."""
    try:
        return max(1.0, float(os.environ.get("RATE_LIMIT_SCALE", "1")))
    except ValueError:
        return 1.0


def _limit(max_requests: int, window_seconds: float) -> Limit:
    return Limit(int(max_requests * _scale()), window_seconds)


LIMITS = {
    # A sign-up sends one code; a few retries are normal, dozens are not.
    "otp_start_ip": _limit(10, 600),
    "otp_start_email": _limit(5, 3600),
    # Each code already allows 5 attempts; this caps guessing across codes.
    "otp_verify_ip": _limit(30, 600),
    # A PIN prompt lands on a real phone: never let one account spam them.
    "momo_start_user": _limit(10, 600),
    "momo_status_user": _limit(120, 60),
}


# --------------------------------------------------------------------------- #
# Authentication
# --------------------------------------------------------------------------- #

_TOKEN_CACHE: dict[str, tuple[str, float]] = {}
_TOKEN_CACHE_SECONDS = 60


async def verify_token(token: str) -> str | None:
    """Supabase Auth's answer for this token: the user id, or None."""
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Authentification non configurée sur ce serveur.")
    async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
        response = await client.get(
            f"{url}/auth/v1/user", headers={"apikey": key, "Authorization": f"Bearer {token}"}
        )
    if response.status_code != 200:
        return None
    user_id = response.json().get("id")
    return user_id if isinstance(user_id, str) else None


async def require_user(request: Request) -> str:
    """FastAPI dependency: the authenticated user's id, or 401."""
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer ") or len(header) > 4096:
        raise HTTPException(status_code=401, detail="Connexion requise.")
    token = header[7:].strip()
    digest = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    cached = _TOKEN_CACHE.get(digest)
    if cached and cached[1] > now:
        return cached[0]
    try:
        user_id = await verify_token(token)
    except httpx.HTTPError:
        # Cannot check, so do not let in: fail closed.
        raise HTTPException(status_code=503, detail="Service d'authentification injoignable.")
    if not user_id:
        # The address only, never the token itself.
        log.info("rejected token from %s", client_ip(request))  # nosemgrep: python-logger-credential-disclosure
        raise HTTPException(status_code=401, detail="Session invalide ou expirée.")
    _TOKEN_CACHE[digest] = (user_id, now + _TOKEN_CACHE_SECONDS)
    if len(_TOKEN_CACHE) > 10_000:
        for k in [k for k, v in _TOKEN_CACHE.items() if v[1] <= now]:
            _TOKEN_CACHE.pop(k, None)
    return user_id


def reset_caches() -> None:
    _TOKEN_CACHE.clear()
    limiter.reset()


# --------------------------------------------------------------------------- #
# ASGI middleware
# --------------------------------------------------------------------------- #

MAX_BODY_BYTES = 16 * 1024


class BodySizeLimit:
    """Refuses bodies over ``MAX_BODY_BYTES`` — declared or actually streamed."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared is not None and (not declared.isdigit() or int(declared) > self.max_bytes):
            await _plain(send, 413, b'{"detail":"Requ\\u00eate trop volumineuse."}')
            return
        seen = 0

        async def limited_receive() -> Message:
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    raise HTTPException(status_code=413, detail="Requête trop volumineuse.")
            return message

        await self.app(scope, limited_receive, send)


SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"cache-control", b"no-store"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
    (b"strict-transport-security", b"max-age=63072000; includeSubDomains"),
]


class SecurityHeaders:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                names = {k.lower() for k, _ in message.get("headers", [])}
                message.setdefault("headers", [])
                message["headers"] = list(message["headers"]) + [
                    (k, v) for k, v in SECURITY_HEADERS if k not in names
                ]
            await send(message)

        await self.app(scope, receive, with_headers)


async def _plain(send: Send, status: int, body: bytes) -> None:
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json")] + SECURITY_HEADERS,
        }
    )
    await send({"type": "http.response.body", "body": body})


def cors_origins() -> list[str]:
    """Explicit origins only. A wildcard is refused in production, where it
    would let any website drive the API with a visitor's token."""
    raw = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    if "*" in raw and os.environ.get("APP_ENV") == "production":
        raise RuntimeError("CORS_ORIGINS='*' is not allowed when APP_ENV=production")
    return raw
