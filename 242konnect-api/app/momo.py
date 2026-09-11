"""Mobile Money collections — MTN MoMo and Airtel Money.

Collecting money from a customer's mobile wallet is a two-phase operation with
both operators:

    request to pay  →  operator prompts the handset for a PIN  →  poll status

Nothing is debited when we send the request. The customer types their PIN on
their own phone, and the transaction sits in PENDING until they do — or until
the prompt expires. So the API exposes the same two phases the app needs:
``request_to_pay`` returns immediately with a reference, and ``status`` answers
where it has got to.

Credentials live here, on the server, and never in the app bundle: anyone can
unzip an APK, and these particular secrets authorise collecting money into the
242Konnect merchant accounts.

Configuration
-------------

MTN MoMo Collections (https://momodeveloper.mtn.com):

    MTN_MOMO_SUBSCRIPTION_KEY   Collections product subscription key
    MTN_MOMO_API_USER           API user UUID created against the target env
    MTN_MOMO_API_KEY            API key generated for that user
    MTN_MOMO_ENVIRONMENT        "sandbox" or the production target id
    MTN_MOMO_CALLBACK_URL       optional; we poll regardless

Airtel Money Collections (https://developers.airtel.africa):

    AIRTEL_CLIENT_ID
    AIRTEL_CLIENT_SECRET
    AIRTEL_ENVIRONMENT          "sandbox" or "production"
    AIRTEL_COUNTRY              ISO-2, "CG" for the Republic of the Congo
    AIRTEL_CURRENCY             defaults to XAF

With an operator unconfigured, requests for it are refused with a clear message
rather than pretended — the same rule the OTP service follows.
"""

from __future__ import annotations

import base64
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

import httpx

Operator = Literal["mtn", "airtel"]
Status = Literal["pending", "successful", "failed", "expired"]

#: How long we keep a record of a collection we started.
RECORD_TTL_SECONDS = 3600

#: Currency for the Republic of the Congo.
DEFAULT_CURRENCY = "XAF"

REQUEST_TIMEOUT = httpx.Timeout(20.0, connect=10.0)


class MomoError(Exception):
    """Raised with a message already fit to show the payer, in French."""


@dataclass
class Collection:
    """One collection in flight, keyed by our own reference."""

    id: str
    operator: Operator
    phone: str
    amount: int
    status: Status = "pending"
    operator_reference: str | None = None
    reason: str | None = None
    created_at: float = field(default_factory=time.time)


#: In-process, like the OTP store. A second worker would not see these, so a
#: real deployment needs Redis or Postgres here — noted in the README.
_STORE: dict[str, Collection] = {}


def _prune() -> None:
    cutoff = time.time() - RECORD_TTL_SECONDS
    for key in [k for k, v in _STORE.items() if v.created_at < cutoff]:
        _STORE.pop(key, None)


def _msisdn(phone: str) -> str:
    """Congolese national number to the international form both APIs expect.

    "061234567" -> "242061234567". Numbers already carrying the country code are
    left alone.
    """
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("242"):
        return digits
    return f"242{digits}"


# --------------------------------------------------------------------------- #
# MTN MoMo Collections
# --------------------------------------------------------------------------- #


def _mtn_config() -> dict[str, str] | None:
    keys = ("MTN_MOMO_SUBSCRIPTION_KEY", "MTN_MOMO_API_USER", "MTN_MOMO_API_KEY")
    values = {k: os.environ.get(k, "").strip() for k in keys}
    if not all(values.values()):
        return None
    values["MTN_MOMO_ENVIRONMENT"] = os.environ.get("MTN_MOMO_ENVIRONMENT", "sandbox").strip()
    values["MTN_MOMO_BASE_URL"] = os.environ.get(
        "MTN_MOMO_BASE_URL", "https://sandbox.momodeveloper.mtn.com"
    ).rstrip("/")
    return values


async def _mtn_token(client: httpx.AsyncClient, cfg: dict[str, str]) -> str:
    """Collections access token. Short-lived, so it is fetched per operation."""
    basic = base64.b64encode(
        f"{cfg['MTN_MOMO_API_USER']}:{cfg['MTN_MOMO_API_KEY']}".encode()
    ).decode()
    response = await client.post(
        f"{cfg['MTN_MOMO_BASE_URL']}/collection/token/",
        headers={
            "Authorization": f"Basic {basic}",
            "Ocp-Apim-Subscription-Key": cfg["MTN_MOMO_SUBSCRIPTION_KEY"],
        },
    )
    if response.status_code >= 400:
        raise MomoError("Authentification MTN MoMo refusée.")
    token = response.json().get("access_token")
    if not token:
        raise MomoError("Authentification MTN MoMo incomplète.")
    return str(token)


async def _mtn_request_to_pay(record: Collection, label: str) -> None:
    cfg = _mtn_config()
    if cfg is None:
        raise MomoError("Le paiement MTN Mobile Money n'est pas encore activé.")

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        token = await _mtn_token(client, cfg)
        response = await client.post(
            f"{cfg['MTN_MOMO_BASE_URL']}/collection/v1_0/requesttopay",
            headers={
                "Authorization": f"Bearer {token}",
                # MTN keys the transaction on this header, and replays it on a
                # retry — which is what makes a retry safe rather than a double
                # debit.
                "X-Reference-Id": record.id,
                "X-Target-Environment": cfg["MTN_MOMO_ENVIRONMENT"],
                "Ocp-Apim-Subscription-Key": cfg["MTN_MOMO_SUBSCRIPTION_KEY"],
                "Content-Type": "application/json",
            },
            json={
                "amount": str(record.amount),
                "currency": os.environ.get("MTN_MOMO_CURRENCY", DEFAULT_CURRENCY),
                "externalId": record.id,
                "payer": {"partyIdType": "MSISDN", "partyId": _msisdn(record.phone)},
                "payerMessage": label[:160],
                "payeeNote": "242Konnect",
            },
        )

    # 202 Accepted: the prompt is on its way. Anything else never reached the payer.
    if response.status_code != 202:
        raise MomoError("MTN MoMo a refusé la demande de paiement.")


async def _mtn_status(record: Collection) -> None:
    cfg = _mtn_config()
    if cfg is None:
        raise MomoError("Le paiement MTN Mobile Money n'est pas encore activé.")

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        token = await _mtn_token(client, cfg)
        response = await client.get(
            f"{cfg['MTN_MOMO_BASE_URL']}/collection/v1_0/requesttopay/{record.id}",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Target-Environment": cfg["MTN_MOMO_ENVIRONMENT"],
                "Ocp-Apim-Subscription-Key": cfg["MTN_MOMO_SUBSCRIPTION_KEY"],
            },
        )

    if response.status_code >= 400:
        # Leave it pending: a failed status read is not a failed payment, and
        # calling it failed here could lose a debit the customer already made.
        return

    body = response.json()
    state = str(body.get("status", "PENDING")).upper()
    if state == "SUCCESSFUL":
        record.status = "successful"
        record.operator_reference = str(body.get("financialTransactionId") or record.id)
    elif state == "FAILED":
        record.status = "failed"
        record.reason = _mtn_reason(str(body.get("reason") or ""))


def _mtn_reason(code: str) -> str:
    return {
        "PAYER_NOT_FOUND": "Ce numéro n'a pas de compte MTN MoMo.",
        "NOT_ENOUGH_FUNDS": "Solde insuffisant sur le compte MTN MoMo.",
        "PAYER_LIMIT_REACHED": "Plafond de transaction atteint sur votre compte MTN MoMo.",
        "EXPIRED": "La demande a expiré avant votre confirmation.",
        "APPROVAL_REJECTED": "Vous avez refusé la demande de paiement.",
    }.get(code.upper(), "Le paiement a été refusé par MTN MoMo.")


# --------------------------------------------------------------------------- #
# Airtel Money Collections
# --------------------------------------------------------------------------- #


def _airtel_config() -> dict[str, str] | None:
    client_id = os.environ.get("AIRTEL_CLIENT_ID", "").strip()
    secret = os.environ.get("AIRTEL_CLIENT_SECRET", "").strip()
    if not client_id or not secret:
        return None
    env = os.environ.get("AIRTEL_ENVIRONMENT", "sandbox").strip()
    return {
        "client_id": client_id,
        "client_secret": secret,
        "country": os.environ.get("AIRTEL_COUNTRY", "CG").strip(),
        "currency": os.environ.get("AIRTEL_CURRENCY", DEFAULT_CURRENCY).strip(),
        "base_url": os.environ.get(
            "AIRTEL_BASE_URL",
            "https://openapiuat.airtel.africa" if env == "sandbox" else "https://openapi.airtel.africa",
        ).rstrip("/"),
    }


async def _airtel_token(client: httpx.AsyncClient, cfg: dict[str, str]) -> str:
    response = await client.post(
        f"{cfg['base_url']}/auth/oauth2/token",
        json={
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "grant_type": "client_credentials",
        },
    )
    if response.status_code >= 400:
        raise MomoError("Authentification Airtel Money refusée.")
    token = response.json().get("access_token")
    if not token:
        raise MomoError("Authentification Airtel Money incomplète.")
    return str(token)


def _airtel_headers(cfg: dict[str, str], token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-Country": cfg["country"],
        "X-Currency": cfg["currency"],
        "Content-Type": "application/json",
    }


async def _airtel_request_to_pay(record: Collection, label: str) -> None:
    cfg = _airtel_config()
    if cfg is None:
        raise MomoError("Le paiement Airtel Money n'est pas encore activé.")

    # Airtel wants the subscriber number without the country code.
    national = _msisdn(record.phone)[3:]

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        token = await _airtel_token(client, cfg)
        response = await client.post(
            f"{cfg['base_url']}/merchant/v1/payments/",
            headers=_airtel_headers(cfg, token),
            json={
                "reference": label[:60],
                "subscriber": {"country": cfg["country"], "currency": cfg["currency"], "msisdn": national},
                "transaction": {
                    "amount": record.amount,
                    "country": cfg["country"],
                    "currency": cfg["currency"],
                    "id": record.id,
                },
            },
        )

    if response.status_code >= 400:
        raise MomoError("Airtel Money a refusé la demande de paiement.")

    body = response.json()
    if not body.get("status", {}).get("success", False):
        raise MomoError(body.get("status", {}).get("message") or "Airtel Money a refusé la demande.")


async def _airtel_status(record: Collection) -> None:
    cfg = _airtel_config()
    if cfg is None:
        raise MomoError("Le paiement Airtel Money n'est pas encore activé.")

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        token = await _airtel_token(client, cfg)
        response = await client.get(
            f"{cfg['base_url']}/standard/v1/payments/{record.id}",
            headers=_airtel_headers(cfg, token),
        )

    if response.status_code >= 400:
        return  # As with MTN: unknown is not failed.

    data = response.json().get("data", {}).get("transaction", {})
    state = str(data.get("status", "")).upper()
    if state in {"TS", "SUCCESS", "SUCCESSFUL"}:
        record.status = "successful"
        record.operator_reference = str(data.get("airtel_money_id") or record.id)
    elif state in {"TF", "FAILED"}:
        record.status = "failed"
        record.reason = "Le paiement a été refusé par Airtel Money."
    elif state in {"TE", "EXPIRED"}:
        record.status = "expired"
        record.reason = "La demande a expiré avant votre confirmation."


# --------------------------------------------------------------------------- #
# Public surface
# --------------------------------------------------------------------------- #


def configured(operator: Operator) -> bool:
    return (_mtn_config() if operator == "mtn" else _airtel_config()) is not None


async def request_to_pay(operator: Operator, phone: str, amount: int, label: str) -> Collection:
    """Asks the operator to prompt ``phone`` for its PIN. Debits nothing yet."""
    _prune()
    record = Collection(id=str(uuid.uuid4()), operator=operator, phone=phone, amount=amount)

    if operator == "mtn":
        await _mtn_request_to_pay(record, label)
    else:
        await _airtel_request_to_pay(record, label)

    _STORE[record.id] = record
    return record


async def status(collection_id: str) -> Collection:
    """Re-reads a collection from its operator and returns the updated record."""
    record = _STORE.get(collection_id)
    if record is None:
        raise MomoError("Transaction inconnue ou expirée.")

    if record.status != "pending":
        return record  # Settled states are final; stop asking.

    if record.operator == "mtn":
        await _mtn_status(record)
    else:
        await _airtel_status(record)

    return record
