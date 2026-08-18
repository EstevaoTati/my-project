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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from . import otp
from .mailer import MailError, build_transport, render_code_email

log = logging.getLogger("242konnect.otp")

app = FastAPI(
    title="242Konnect API",
    version="0.1.0",
    description="Codes de vérification par e-mail.",
)

# The app runs from a device and, in development, from a web build on another
# origin. Tighten this to the real origins before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

transport = build_transport()


class StartRequest(BaseModel):
    """`key` identifies the sign-up in progress — the phone number, normally."""

    key: str = Field(min_length=3, max_length=64)
    email: EmailStr


class VerifyRequest(BaseModel):
    key: str = Field(min_length=3, max_length=64)
    code: str = Field(min_length=otp.CODE_LENGTH, max_length=otp.CODE_LENGTH)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "transport": transport.name,
        "pending": otp.pending_count(),
        # Makes it obvious in a browser whether real mail is going out.
        "sends_email": transport.name != "console",
    }


@app.post("/auth/otp/start")
async def start(body: StartRequest) -> dict:
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
        log.error("otp delivery failed for %s: %s", body.email, exc)
        raise HTTPException(
            status_code=502,
            detail="Impossible d'envoyer l'e-mail pour le moment. Réessayez dans un instant.",
        ) from exc

    # Note what is *not* here: the code. The whole point is that it travels by
    # e-mail and nowhere else.
    return {"sent": True, "channel": "email", "expires_in": otp.TTL_SECONDS}


@app.post("/auth/otp/verify")
async def verify(body: VerifyRequest) -> dict:
    try:
        otp.verify(body.key, body.code)
    except otp.OtpError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
    return {"verified": True}
