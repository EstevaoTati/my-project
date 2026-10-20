"""242Konnect API — verification codes by e-mail.

The first slice of the API the cahier des charges describes (§10.5). It does one
job: issue a code, mail it, and verify it. Accounts, missions and payments are
separate work; this exists because the app cannot send e-mail safely on its own.

Run it:

    cd 242konnect-api
    pip install -r requirements.txt
    RESEND_API_KEY=... uvicorn app.main:app --reload

Without ``RESEND_API_KEY`` it starts anyway and prints the message to the
console instead of sending — useful in development, and it says so loudly.
"""

from __future__ import annotations

import logging
import os
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from . import momo, otp
from .mailer import MailError, build_transport, render_code_email
from .security import (
    LIMITS,
    BodySizeLimit,
    SecurityHeaders,
    client_ip,
    cors_origins,
    limiter,
    mask_email,
    require_user,
)

log = logging.getLogger("242konnect.otp")

PRODUCTION = os.environ.get("APP_ENV") == "production"

app = FastAPI(
    title="242Konnect API",
    version="0.2.0",
    description="Codes de vérification par e-mail.",
    # The schema is a map of the attack surface; not published in production.
    docs_url=None if PRODUCTION else "/docs",
    redoc_url=None,
    openapi_url=None if PRODUCTION else "/openapi.json",
)

# Explicit origins only (CORS_ORIGINS). Native apps send no Origin and are not
# affected; a browser build must be listed. No credentials: the bearer token
# is explicit, so no cookie can be ridden.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["POST", "GET"],
    allow_headers=["authorization", "content-type"],
    allow_credentials=False,
)
app.add_middleware(BodySizeLimit)
app.add_middleware(SecurityHeaders)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Never a stack trace, a path or a provider message to the client.
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erreur interne. Réessayez."})

transport = build_transport()


class StartRequest(BaseModel):
    """`key` identifies the sign-up in progress — the phone number, normally."""

    # Unknown fields are refused rather than ignored (mass assignment).
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=3, max_length=64, pattern=r"^[0-9A-Za-z+@._-]+$")
    email: EmailStr


class VerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=3, max_length=64, pattern=r"^[0-9A-Za-z+@._-]+$")
    code: str = Field(min_length=otp.CODE_LENGTH, max_length=otp.CODE_LENGTH)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "transport": transport.name,
        "pending": otp.pending_count(),
        # Makes it obvious in a browser whether real mail is going out.
        "sends_email": transport.name != "console",
        # Same, for money: which operators can actually be debited.
        "momo": {"mtn": momo.configured("mtn"), "airtel": momo.configured("airtel")},
    }


@app.post("/auth/otp/start")
async def start(body: StartRequest, request: Request) -> dict:
    limiter.check(f"otp_start_ip:{client_ip(request)}", LIMITS["otp_start_ip"])
    limiter.check(f"otp_start_email:{body.email.lower()}", LIMITS["otp_start_email"])
    try:
        code = otp.issue(body.key, body.email)
    except otp.OtpError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc

    subject, html, text = render_code_email(code)
    try:
        await transport.send(to=body.email, subject=subject, html=html, text=text)
    except MailError as exc:
        # The provider's reason is useful to us and meaningless (or leaky) to the
        # client, so it is logged and not returned.
        log.error("otp delivery failed for %s: %s", mask_email(body.email), exc)
        raise HTTPException(
            status_code=502,
            detail="Impossible d'envoyer l'e-mail pour le moment. Réessayez dans un instant.",
        ) from exc

    # Note what is *not* here: the code. The whole point is that it travels by
    # e-mail and nowhere else.
    return {"sent": True, "channel": "email", "expires_in": otp.TTL_SECONDS}


@app.post("/auth/otp/verify")
async def verify(body: VerifyRequest, request: Request) -> dict:
    limiter.check(f"otp_verify_ip:{client_ip(request)}", LIMITS["otp_verify_ip"])
    try:
        otp.verify(body.key, body.code)
    except otp.OtpError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
    return {"verified": True}


# --------------------------------------------------------------------------- #
# Mobile Money collections
# --------------------------------------------------------------------------- #


class RequestToPayBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator: Literal["mtn", "airtel"]
    #: National or international Congolese number; normalised server-side.
    phone: str = Field(min_length=9, max_length=15, pattern=r"^[0-9 +]+$")
    #: Whole FCFA. XAF has no minor unit, so fractional amounts are meaningless.
    amount: int = Field(gt=0, le=5_000_000)
    currency: str = Field(default="XAF", pattern=r"^XAF$")
    label: str = Field(default="242Konnect", max_length=160, pattern=r"^[^<>]*$")
    #: One per order: a replay of the same request returns the same collection.
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[0-9A-Za-z_-]+$")


def _collection_payload(record: momo.Collection) -> dict:
    return {
        "id": record.id,
        "status": record.status,
        "operator_reference": record.operator_reference,
        "reason": record.reason,
    }


@app.post("/payments/momo/request-to-pay")
async def request_to_pay(body: RequestToPayBody, user: str = Depends(require_user)) -> dict:
    """Starts a collection. Returns as soon as the PIN prompt has been sent.

    This does not wait for the customer — they have up to a minute or so to
    enter their PIN, which is far longer than a request should be held open. The
    app polls the status endpoint instead.
    """
    limiter.check(f"momo_start_user:{user}", LIMITS["momo_start_user"])
    try:
        record = await momo.request_to_pay(
            body.operator, body.phone, body.amount, body.label, body.idempotency_key, owner=user
        )
    except momo.MomoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        log.error("momo request-to-pay transport error: %s", exc)
        raise HTTPException(
            status_code=502, detail="L'opérateur Mobile Money est injoignable. Réessayez."
        ) from exc
    return _collection_payload(record)


@app.get("/payments/momo/{collection_id}")
async def collection_status(collection_id: str, user: str = Depends(require_user)) -> dict:
    """Where a collection has got to. Polled by the app until it settles."""
    limiter.check(f"momo_status_user:{user}", LIMITS["momo_status_user"])
    # Someone else's collection answers exactly like an unknown one (BOLA).
    if momo.owner_of(collection_id) != user:
        raise HTTPException(status_code=404, detail="Transaction inconnue ou expirée.")
    try:
        record = await momo.status(collection_id)
    except momo.MomoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        # Leave the client polling rather than failing a payment that may well
        # have succeeded: unknown is not the same as refused.
        log.warning("momo status transport error: %s", exc)
        return {"id": collection_id, "status": "pending", "operator_reference": None, "reason": None}
    return _collection_payload(record)
