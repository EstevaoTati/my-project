/**
 * Verification codes — issued and e-mailed by a service, never by the app.
 *
 * The rule this file exists to enforce: **the code must arrive in the user's
 * inbox and nowhere else.** That is not a presentation choice, so it is not left
 * to the screen to respect. `OtpDelivery` carries no `code` field, `requestCode`
 * never returns one, and nothing here generates one. The app literally cannot
 * display a code it never receives — comparing the entered digits is the
 * service's job, and only the service knows the answer.
 *
 * An earlier version generated a code on the device and printed it on screen
 * when no service was configured. That is what this replaces.
 *
 * Two providers are supported, picked by whichever environment variables are
 * set at build time:
 *
 * 1. **Supabase** (`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
 *    — Supabase GoTrue generates the code, mails it, stores the user in
 *    `auth.users`, and verifies server-side. Preferred: the publishable key is
 *    *designed* to ship inside a client, so a shared preview build can send real
 *    e-mail with no server of our own to deploy.
 *
 * 2. **The 242Konnect API** (`EXPO_PUBLIC_API_URL`) — the FastAPI service in
 *    `242konnect-api/`, for when the code should be issued by our own backend.
 *
 * With neither set there is no way to send an e-mail, so sign-up **fails** with
 * a plain message. Refusing is the honest outcome; the alternative is pretending
 * a mail went out.
 *
 * Note the asymmetry with Resend: a Resend key must never be bundled, because
 * anyone can unzip an APK and send mail as 242Konnect with it. A Supabase
 * publishable key is a different kind of credential — it authorises only what
 * row-level security and GoTrue's own rate limits allow — which is why it can
 * live in the bundle and the Resend key cannot.
 */

import {
  SUPABASE_KEY,
  SUPABASE_URL,
  sessionFromPayload,
  supabaseConfigured,
  type SupabaseSession,
} from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/**
 * Supabase does not report the code's lifetime in its response, so it is read
 * from the build config. Match it to Auth → Email OTP Expiration in the
 * dashboard; the default there is one hour.
 */
const SUPABASE_TTL = Number(process.env.EXPO_PUBLIC_SUPABASE_OTP_TTL ?? '') || 3600;

export type OtpProvider = 'supabase' | 'api' | 'none';

/** Which service will send the mail. Screens use this to warn before a form is filled in. */
export const otpProvider: OtpProvider = supabaseConfigured ? 'supabase' : API_URL ? 'api' : 'none';

/** True when a real e-mail can be sent. */
export const canSendOtp = otpProvider !== 'none';

export const OTP_UNAVAILABLE_MESSAGE =
  "La vérification par e-mail n'est pas configurée sur cette version de démonstration. " +
  'Aucun code ne peut être envoyé, donc la création de compte est indisponible ici.';

/**
 * What the app knows about a sent code: that it was sent, by whom, and for how
 * long it is valid. Deliberately not the code itself.
 */
export type OtpDelivery = {
  provider: Exclude<OtpProvider, 'none'>;
  /** Seconds until the code expires. */
  expiresIn: number;
};

/** Details stored alongside the account when the provider supports it. */
export type OtpMetadata = {
  name?: string;
  phone?: string;
  profile?: string;
};

export class OtpApiError extends Error {}

/**
 * The send failed inside the provider, not because of anything the user typed.
 * Carried as its own class because the two callers react differently: the screen
 * shows `message`, while a build wired to a second provider could fall back.
 */
export class OtpDeliveryError extends OtpApiError {}

const TIMEOUT_MS = 15000;

/**
 * What GoTrue says when its SMTP transport refuses the message. It is the same
 * `unexpected_failure` for every mailer problem — bad credentials, a blocked
 * port, a provider outage — so the text is the only thing that identifies it.
 *
 * This has bitten this project for real: a custom SMTP server was configured in
 * the Supabase dashboard with credentials the server rejected (`535
 * "Authentication credentials invalid"`), every POST /otp answered 500, and the
 * English string below was rendered straight onto the sign-up screen. See
 * 242konnect-app/DEPLOY.md — it is fixed in the dashboard, never in the app.
 */
const MAILER_FAILURE = /error sending (magic link|confirmation|recovery|invite) (e-?mail|email)/i;

/**
 * Shown when the provider accepted the request but could not send the mail.
 *
 * Deliberately does not repeat the provider's English string: it names an
 * internal transport ("magic link") that means nothing to someone signing up,
 * and reads as though they mistyped something. Nothing they can do differently
 * would help, so the message says so and points at the operator.
 */
export const OTP_DELIVERY_FAILED_MESSAGE =
  "L'envoi de l'e-mail de vérification a échoué côté serveur. Ce n'est pas une erreur de votre part : " +
  "le service d'e-mail de 242Konnect est mal configuré ou momentanément indisponible. " +
  'Réessayez dans quelques minutes, et si le problème persiste signalez-le à 242Konnect.';

/** First human-readable reason found in a provider's error body. */
function reasonFrom(payload: Record<string, unknown>): string | null {
  for (const field of ['detail', 'error_description', 'msg', 'message', 'error']) {
    const value = payload[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  onError: (status: number, reason: string | null) => string
): Promise<Record<string, unknown>> {
  // AbortController rather than Promise.race: a hung request should actually be
  // cancelled, not left running while we move on.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const reason = reasonFrom(payload);
      // Checked before `onError`, because a mailer failure is the provider's
      // problem rather than the caller's and reads the same whichever endpoint
      // hit it. Letting the raw reason through here is what put "Error sending
      // magic link email" in front of users.
      if (reason && MAILER_FAILURE.test(reason))
        throw new OtpDeliveryError(OTP_DELIVERY_FAILED_MESSAGE);
      throw new OtpApiError(onError(response.status, reason));
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

const supabaseHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });

/**
 * Asks the configured service to mail a code to `email`.
 *
 * `key` identifies the sign-up in progress — the phone number — so that the
 * 242Konnect API replaces the previous code on a resend rather than leaving two
 * valid. Supabase keys on the e-mail address itself and does the same.
 *
 * Throws if nothing is configured: a sign-up must not look started when no mail
 * went out.
 */
export async function requestCode(
  key: string,
  email: string,
  metadata: OtpMetadata = {}
): Promise<OtpDelivery> {
  if (otpProvider === 'none') throw new OtpApiError(OTP_UNAVAILABLE_MESSAGE);

  if (otpProvider === 'supabase') {
    // `create_user` lets the account exist in auth.users on first verification;
    // `data` lands in raw_user_meta_data so the name and profile type are stored
    // with it rather than only on the device.
    await postJson(
      `${SUPABASE_URL}/auth/v1/otp`,
      { email, create_user: true, data: metadata },
      supabaseHeaders(),
      (status, reason) => {
        if (status === 429)
          return 'Trop de demandes de code. Patientez une minute avant de réessayer.';
        // Any 5xx is the service failing, not the address being wrong. GoTrue
        // returns `unexpected_failure` for a mailer problem it cannot describe
        // further, and its English text would only mislead.
        if (status >= 500) return OTP_DELIVERY_FAILED_MESSAGE;
        return reason ?? "L'envoi de l'e-mail de vérification a échoué.";
      }
    );
    return { provider: 'supabase', expiresIn: SUPABASE_TTL };
  }

  const payload = await postJson(
    `${API_URL}/auth/otp/start`,
    { key, email },
    {},
    // FastAPI puts the reason in `detail`; it is already in French and safe to show.
    (_status, reason) => reason ?? 'Le service de vérification est indisponible.'
  );
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 600;
  return { provider: 'api', expiresIn };
}

/**
 * Checks a code against the service that issued it. Always a round trip: the
 * device has nothing to compare against, which is the point — attempts are
 * capped and codes expire server-side.
 *
 * Returns the Supabase session the accepted code buys. That session is the only
 * proof of identity the app ever holds, and it is what lets the account row be
 * written under row-level security — see `profileStore.ts`. The 242Konnect API
 * has no equivalent, so it returns null there.
 */
export async function checkCode(
  key: string,
  email: string,
  code: string,
  delivery: OtpDelivery
): Promise<SupabaseSession | null> {
  const token = code.replace(/\D/g, '');

  if (delivery.provider === 'supabase') {
    const payload = await postJson(
      `${SUPABASE_URL}/auth/v1/verify`,
      { email, token, type: 'email' },
      supabaseHeaders(),
      (status, reason) => {
        // GoTrue answers 401/403 for a wrong token and 410 once it has expired,
        // with an English message. Both are shown to the user, so translate.
        if (status === 410) return 'Ce code a expiré. Demandez-en un nouveau.';
        if (status === 401 || status === 403 || status === 400)
          return 'Code incorrect. Vérifiez les chiffres reçus par e-mail.';
        return reason ?? 'La vérification a échoué. Réessayez.';
      }
    );
    return sessionFromPayload(payload);
  }

  await postJson(
    `${API_URL}/auth/otp/verify`,
    { key, code: token },
    {},
    (_status, reason) => reason ?? 'Code incorrect. Vérifiez les chiffres reçus par e-mail.'
  );
  return null;
}
