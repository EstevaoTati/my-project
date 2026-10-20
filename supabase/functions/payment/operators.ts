/**
 * MTN MoMo and Airtel Money collections, for the `payment` function.
 *
 * Same protocol as 242konnect-api/app/momo.py: request to pay, the operator
 * prompts the handset for its PIN, then we read the status until it settles.
 * Kept free of Deno and Supabase imports, with `fetch` and the environment
 * passed in, so core.test.mjs can drive it under Node with a fake operator.
 *
 * The amount and the payer's number come from the caller (index.ts), which
 * takes the amount from the request row, never from the app.
 */

export type Method = 'mtn' | 'airtel';
export type CollectionStatus = 'pending' | 'successful' | 'failed' | 'expired';

export type Outcome = {
  status: CollectionStatus;
  /** The operator's own transaction id, once it has one. */
  operatorRef?: string;
  /** What the operator says it collected, when it says (MTN does). */
  amount?: number;
  /** Why it did not succeed, in French. */
  reason?: string;
};

export type Env = (key: string) => string | undefined;
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Raised with a message fit to show the payer, in French. */
export class OperatorError extends Error {}

const CURRENCY = 'XAF';
const TIMEOUT_MS = 20000;

/**
 * Congolese mobile number to the international form both operators expect.
 * "061234567" and "242061234567" give "242061234567"; anything else is null.
 */
export function msisdn(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (/^2420[4-6]\d{7}$/.test(digits)) return digits;
  if (/^0[4-6]\d{7}$/.test(digits)) return `242${digits}`;
  return null;
}

type MtnConfig = { key: string; user: string; apiKey: string; target: string; base: string };
type AirtelConfig = { id: string; secret: string; country: string; base: string };

function mtnConfig(env: Env): MtnConfig | null {
  const key = env('MTN_MOMO_SUBSCRIPTION_KEY')?.trim();
  const user = env('MTN_MOMO_API_USER')?.trim();
  const apiKey = env('MTN_MOMO_API_KEY')?.trim();
  if (!key || !user || !apiKey) return null;
  return {
    key,
    user,
    apiKey,
    target: env('MTN_MOMO_ENVIRONMENT')?.trim() || 'sandbox',
    base: (env('MTN_MOMO_BASE_URL')?.trim() || 'https://sandbox.momodeveloper.mtn.com').replace(/\/+$/, ''),
  };
}

function airtelConfig(env: Env): AirtelConfig | null {
  const id = env('AIRTEL_CLIENT_ID')?.trim();
  const secret = env('AIRTEL_CLIENT_SECRET')?.trim();
  if (!id || !secret) return null;
  const sandbox = (env('AIRTEL_ENVIRONMENT')?.trim() || 'sandbox') === 'sandbox';
  return {
    id,
    secret,
    country: env('AIRTEL_COUNTRY')?.trim() || 'CG',
    base: (
      env('AIRTEL_BASE_URL')?.trim() || (sandbox ? 'https://openapiuat.airtel.africa' : 'https://openapi.airtel.africa')
    ).replace(/\/+$/, ''),
  };
}

export function configured(method: Method, env: Env): boolean {
  return (method === 'mtn' ? mtnConfig(env) : airtelConfig(env)) !== null;
}

async function send(fetchFn: Fetch, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch {
    throw new OperatorError("L'opérateur Mobile Money ne répond pas. Réessayez dans un instant.");
  } finally {
    clearTimeout(timer);
  }
}

async function mtnToken(cfg: MtnConfig, fetchFn: Fetch): Promise<string> {
  const response = await send(fetchFn, `${cfg.base}/collection/token/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${cfg.user}:${cfg.apiKey}`)}`, 'Ocp-Apim-Subscription-Key': cfg.key },
  });
  const body = response.ok ? await response.json().catch(() => ({})) : {};
  if (!body.access_token) throw new OperatorError('Authentification MTN MoMo refusée.');
  return String(body.access_token);
}

async function airtelToken(cfg: AirtelConfig, fetchFn: Fetch): Promise<string> {
  const response = await send(fetchFn, `${cfg.base}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.id, client_secret: cfg.secret, grant_type: 'client_credentials' }),
  });
  const body = response.ok ? await response.json().catch(() => ({})) : {};
  if (!body.access_token) throw new OperatorError('Authentification Airtel Money refusée.');
  return String(body.access_token);
}

const airtelHeaders = (cfg: AirtelConfig, token: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Country': cfg.country,
  'X-Currency': CURRENCY,
  'Content-Type': 'application/json',
});

/**
 * Asks the operator to prompt the payer. `id` is our collection id and becomes
 * the operator's transaction id: a retry with the same id is the same payment.
 */
export async function requestToPay(
  method: Method,
  input: { id: string; msisdn: string; amount: number; label: string },
  env: Env,
  fetchFn: Fetch
): Promise<void> {
  if (method === 'mtn') {
    const cfg = mtnConfig(env);
    if (!cfg) throw new OperatorError("Le paiement MTN Mobile Money n'est pas encore activé.");
    const token = await mtnToken(cfg, fetchFn);
    const response = await send(fetchFn, `${cfg.base}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': input.id,
        'X-Target-Environment': cfg.target,
        'Ocp-Apim-Subscription-Key': cfg.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(input.amount),
        currency: CURRENCY,
        externalId: input.id,
        payer: { partyIdType: 'MSISDN', partyId: input.msisdn },
        payerMessage: input.label.slice(0, 160),
        payeeNote: '242Konnect',
      }),
    });
    // 202: the prompt is on its way. Anything else never reached the payer.
    if (response.status !== 202) throw new OperatorError('MTN MoMo a refusé la demande de paiement.');
    return;
  }

  const cfg = airtelConfig(env);
  if (!cfg) throw new OperatorError("Le paiement Airtel Money n'est pas encore activé.");
  const token = await airtelToken(cfg, fetchFn);
  const response = await send(fetchFn, `${cfg.base}/merchant/v1/payments/`, {
    method: 'POST',
    headers: airtelHeaders(cfg, token),
    body: JSON.stringify({
      reference: input.label.slice(0, 60),
      // Airtel wants the subscriber number without the country code.
      subscriber: { country: cfg.country, currency: CURRENCY, msisdn: input.msisdn.slice(3) },
      transaction: { amount: input.amount, country: cfg.country, currency: CURRENCY, id: input.id },
    }),
  });
  const body = response.ok ? await response.json().catch(() => ({})) : {};
  if (!body?.status?.success) throw new OperatorError('Airtel Money a refusé la demande de paiement.');
}

const MTN_REASONS: Record<string, string> = {
  PAYER_NOT_FOUND: "Ce numéro n'a pas de compte MTN MoMo.",
  NOT_ENOUGH_FUNDS: 'Solde insuffisant sur le compte MTN MoMo.',
  PAYER_LIMIT_REACHED: 'Plafond de transaction atteint sur votre compte MTN MoMo.',
  EXPIRED: 'La demande a expiré avant votre confirmation.',
  APPROVAL_REJECTED: 'Vous avez refusé la demande de paiement.',
};

/** Reads where a collection has got to. An unreadable status is `pending`, never `failed`. */
export async function readStatus(method: Method, id: string, env: Env, fetchFn: Fetch): Promise<Outcome> {
  if (method === 'mtn') {
    const cfg = mtnConfig(env);
    if (!cfg) return { status: 'pending' };
    const token = await mtnToken(cfg, fetchFn);
    const response = await send(fetchFn, `${cfg.base}/collection/v1_0/requesttopay/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'X-Target-Environment': cfg.target, 'Ocp-Apim-Subscription-Key': cfg.key },
    });
    // A failed read is not a failed payment: calling it failed could lose a
    // debit the customer already made.
    if (!response.ok) return { status: 'pending' };
    const body = await response.json().catch(() => ({}));
    const state = String(body.status ?? 'PENDING').toUpperCase();
    if (state === 'SUCCESSFUL') {
      const amount = Number(body.amount);
      return {
        status: 'successful',
        operatorRef: String(body.financialTransactionId || id).slice(0, 80),
        amount: Number.isFinite(amount) ? Math.round(amount) : undefined,
      };
    }
    if (state === 'FAILED') {
      const code = String((typeof body.reason === 'object' ? body.reason?.code : body.reason) ?? '').toUpperCase();
      return { status: code === 'EXPIRED' ? 'expired' : 'failed', reason: MTN_REASONS[code] ?? 'Le paiement a été refusé par MTN MoMo.' };
    }
    return { status: 'pending' };
  }

  const cfg = airtelConfig(env);
  if (!cfg) return { status: 'pending' };
  const token = await airtelToken(cfg, fetchFn);
  const response = await send(fetchFn, `${cfg.base}/standard/v1/payments/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: airtelHeaders(cfg, token),
  });
  if (!response.ok) return { status: 'pending' };
  const body = await response.json().catch(() => ({}));
  const tx = body?.data?.transaction ?? {};
  const state = String(tx.status ?? '').toUpperCase();
  if (['TS', 'SUCCESS', 'SUCCESSFUL'].includes(state))
    return { status: 'successful', operatorRef: String(tx.airtel_money_id || id).slice(0, 80) };
  if (['TF', 'FAILED'].includes(state)) return { status: 'failed', reason: 'Le paiement a été refusé par Airtel Money.' };
  if (['TE', 'EXPIRED'].includes(state)) return { status: 'expired', reason: 'La demande a expiré avant votre confirmation.' };
  return { status: 'pending' };
}
