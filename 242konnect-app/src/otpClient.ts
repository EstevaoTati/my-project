/**
 * Talks to the 242Konnect API for verification codes.
 *
 * The app deliberately holds no e-mail credentials. A React Native bundle is
 * extractable — a provider key shipped inside it could be pulled out of the APK
 * and used to send mail as 242Konnect. So the code is issued and mailed by the
 * API (see `242konnect-api/`), and the app only ever asks it to.
 *
 * When `EXPO_PUBLIC_API_URL` is not set there is no API to call, so the app
 * falls back to generating a code locally and showing it on screen behind a
 * "démonstration" notice. That keeps the flow testable without pretending an
 * e-mail was sent.
 */

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** Whether a real API is configured. Drives the notice on the OTP screen. */
export const hasOtpApi = API_URL.length > 0;

/** How the code reached the user — the OTP screen renders differently for each. */
export type OtpDelivery =
  | { mode: 'email'; expiresIn: number }
  | { mode: 'demo'; code: string };

export class OtpApiError extends Error {}

const TIMEOUT_MS = 12000;

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  // AbortController rather than Promise.race: a hung request should actually be
  // cancelled, not left running while we move on.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      // FastAPI puts the human-readable reason in `detail`; it is already in
      // French and safe to show.
      const detail = typeof payload.detail === 'string' ? payload.detail : null;
      throw new OtpApiError(detail ?? "Le service de vérification est indisponible.");
    }
    return payload;
  } catch (e) {
    if (e instanceof OtpApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError')
      throw new OtpApiError('Le service de vérification ne répond pas. Vérifiez votre connexion.');
    throw new OtpApiError('Impossible de joindre le service de vérification.');
  } finally {
    clearTimeout(timer);
  }
}

function localCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

/**
 * Asks the API to mail a code. `key` identifies the sign-up in progress — the
 * phone number — so a resend replaces the previous code rather than adding one.
 */
export async function requestCode(key: string, email: string): Promise<OtpDelivery> {
  if (!hasOtpApi) return { mode: 'demo', code: localCode() };
  const payload = await post('/auth/otp/start', { key, email });
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 600;
  return { mode: 'email', expiresIn };
}

/**
 * Checks a code. In demo mode the comparison happens on the device; with an API
 * it happens server-side, where attempts are capped and codes expire.
 */
export async function checkCode(key: string, code: string, delivery: OtpDelivery): Promise<void> {
  if (delivery.mode === 'demo') {
    if (code.replace(/\D/g, '') !== delivery.code)
      throw new OtpApiError('Code incorrect. Vérifiez les chiffres reçus.');
    return;
  }
  await post('/auth/otp/verify', { key, code: code.replace(/\D/g, '') });
}
