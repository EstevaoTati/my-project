"""E-mail delivery for verification codes.

Two transports behind one interface:

- **Resend** when ``RESEND_API_KEY`` is set. Chosen because it is a single HTTPS
  call with no SDK, which keeps this file readable and the dependency list at
  ``httpx``. Swapping in SendGrid, Mailgun or SES means writing another
  ``Transport`` — nothing else in the codebase refers to a provider.
- **Console** otherwise, which prints the message instead of sending it. That is
  what runs in development and in CI, and it is deliberately loud about not
  having sent anything.

The API key is read from the environment and never returned by any endpoint.
"""

from __future__ import annotations

import os
from typing import Protocol

import httpx

RESEND_ENDPOINT = "https://api.resend.com/emails"
DEFAULT_FROM = "242Konnect <verification@242konnect.net>"


class MailError(Exception):
    """Delivery failed. The caller turns this into a 502 with a French message."""


class Transport(Protocol):
    name: str

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None: ...


class ConsoleTransport:
    """Prints instead of sending. Used when no provider is configured."""

    name = "console"

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        print(
            "\n"
            "──────────────────────────────────────────────\n"
            "  AUCUN E-MAIL ENVOYÉ — transport « console »\n"
            f"  À       : {to}\n"
            f"  Objet   : {subject}\n"
            f"  Contenu : {text}\n"
            "  Définissez RESEND_API_KEY pour envoyer réellement.\n"
            "──────────────────────────────────────────────",
            flush=True,
        )


class ResendTransport:
    """Sends through Resend's REST API."""

    name = "resend"

    def __init__(self, api_key: str, sender: str):
        self._api_key = api_key
        self._sender = sender

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    RESEND_ENDPOINT,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={
                        "from": self._sender,
                        "to": [to],
                        "subject": subject,
                        "html": html,
                        "text": text,
                    },
                )
        except httpx.HTTPError as exc:
            raise MailError(f"réseau: {exc}") from exc

        if response.status_code >= 400:
            # The body carries Resend's reason (unverified domain, bad key…),
            # which is what makes this debuggable. It goes to our logs, never to
            # the client.
            raise MailError(f"resend {response.status_code}: {response.text[:200]}")


def build_transport() -> Transport:
    key = os.environ.get("RESEND_API_KEY", "").strip()
    sender = os.environ.get("OTP_MAIL_FROM", DEFAULT_FROM)
    return ResendTransport(key, sender) if key else ConsoleTransport()


def render_code_email(code: str) -> tuple[str, str, str]:
    """Subject, HTML and plain-text bodies for a verification code.

    Plain text is not optional: some clients refuse HTML, and a code nobody can
    read is a support ticket.
    """
    subject = f"{code} — votre code de vérification 242Konnect"

    text = (
        f"Votre code de vérification 242Konnect est : {code}\n\n"
        "Il expire dans 10 minutes et ne peut servir qu'une fois.\n"
        "Si vous n'avez pas demandé ce code, ignorez ce message — "
        "personne ne peut accéder à votre compte sans lui.\n\n"
        "242Konnect — Just One Click\n"
        "Pointe-Noire, République du Congo"
    )

    # Inline styles and a table-free layout: e-mail clients strip <style> blocks
    # and disagree about flexbox. The green/yellow/red rule is the brand mark.
    html = f"""\
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#fafafa;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
               color:#0a0a0a;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;
                border-radius:14px;padding:28px;">
      <div style="height:4px;width:56px;border-radius:2px;overflow:hidden;margin-bottom:20px;
                  background:linear-gradient(to right,#00a651 0 33%,#ffcb05 33% 66%,#ed1c24 66% 100%);"></div>

      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;">Votre code de vérification</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:20px;color:#6b7280;">
        Saisissez ce code dans l'application pour confirmer votre compte.
      </p>

      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;
                  padding:16px;background:#f4f4f5;border-radius:10px;margin-bottom:20px;">
        {code}
      </div>

      <p style="margin:0 0 6px;font-size:13px;line-height:19px;color:#6b7280;">
        Il expire dans 10&nbsp;minutes et ne peut servir qu'une fois.
      </p>
      <p style="margin:0;font-size:13px;line-height:19px;color:#6b7280;">
        Si vous n'avez pas demandé ce code, ignorez ce message : personne ne peut
        accéder à votre compte sans lui.
      </p>

      <hr style="border:none;border-top:1px solid #e5e5e5;margin:22px 0 14px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        242Konnect — Just One Click<br>Pointe-Noire, République du Congo
      </p>
    </div>
  </body>
</html>"""

    return subject, html, text
