/**
 * 242Konnect payment service — the only path that marks a request paid
 * (security finding F-01).
 *
 * The app no longer declares a payment. It asks this function to start a
 * Mobile Money collection for one of its own draft requests, then asks where
 * the collection has got to. When the operator reports it SUCCESSFUL, this
 * function — with the service role — calls public.confirm_payment(), which
 * checks the amount against the request and moves it to 'sent'.
 *
 *   POST {action:"start", request, method:"mtn"|"airtel", phone}
 *        -> {collection, status:"pending"|"successful"}
 *   POST {action:"status", collection}
 *        -> {status, requestStatus, reason?}
 * Errors: payments_unavailable (503: operator credentials not set),
 *   not_found, not_payable, currency_unsupported, invalid_phone,
 *   invalid_method, payment_in_progress, rate_limited, operator_refused,
 *   invalid_token, missing_token, payload_too_large, method_not_allowed,
 *   unknown. Each error carries a French `message` for the payer.
 *
 * What the app sends is never trusted for money: the amount comes from the
 * request row, the payer's identity from the Auth server, and the result from
 * the operator. Collections live in public.payment_collections (RLS on, no
 * policies) and double as the idempotency record: one live collection per
 * request, and our collection id is the operator's transaction id.
 *
 * Operator credentials are function secrets (supabase secrets set …), never
 * in the app: MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY,
 * MTN_MOMO_ENVIRONMENT, MTN_MOMO_BASE_URL; AIRTEL_CLIENT_ID,
 * AIRTEL_CLIENT_SECRET, AIRTEL_ENVIRONMENT, AIRTEL_COUNTRY, AIRTEL_BASE_URL.
 *
 * Deploy with verify_jwt = false: the token is validated here against the
 * Auth server, which also rejects revoked sessions.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { configured, msisdn, OperatorError, readStatus, requestToPay, type Method, type Outcome } from './operators.ts';

const MAX_BODY_BYTES = 2048;
/** Collections a user may start in ten minutes: retries, not a PIN-prompt flood. */
const MAX_STARTS = 5;
/** Past this, a collection the operator still calls pending stops blocking a retry. */
const STALE_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES: Record<string, string> = {
  payments_unavailable:
    "Le paiement en ligne ouvre bientôt : MTN Mobile Money et Airtel Money sont en cours d'activation. Votre demande reste enregistrée et rien n'a été débité.",
  not_found: 'Demande introuvable.',
  not_payable: "Cette demande n'attend plus de paiement.",
  currency_unsupported: 'Le Mobile Money ne prend que les montants en FCFA.',
  invalid_phone: 'Numéro Mobile Money invalide : 9 chiffres, par exemple 06 123 45 67.',
  invalid_method: 'Choisissez MTN Mobile Money ou Airtel Money.',
  payment_in_progress: 'Un paiement est déjà en cours pour cette demande. Confirmez-le sur votre téléphone.',
  rate_limited: 'Trop de tentatives de paiement. Réessayez dans quelques minutes.',
  operator_refused: "L'opérateur a refusé la demande de paiement.",
  invalid_token: 'Votre session a expiré. Reconnectez-vous.',
  missing_token: 'Votre session a expiré. Reconnectez-vous.',
  unknown: "Le service de paiement n'a pas pu traiter la demande. Réessayez.",
};

const corsHeaders = {
  // Bearer-token API with no cookies: a wildcard origin grants nothing the
  // token does not. Set PAYMENT_ALLOWED_ORIGIN to pin it to the app's domain.
  'Access-Control-Allow-Origin': Deno.env.get('PAYMENT_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const err = (error: string, status: number, message?: string) =>
  json({ error, message: message ?? MESSAGES[error] ?? MESSAGES.unknown }, status);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const env = (key: string) => Deno.env.get(key);

type Collection = {
  id: string;
  request_id: string;
  client_id: string;
  method: Method;
  msisdn: string;
  amount: number;
  amount_collected: number | null;
  status: Outcome['status'];
  operator_ref: string | null;
  reason: string | null;
  created_at: string;
};

function clientIp(req: Request): string | null {
  const first = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(first) ? first : null;
}

/** Best effort: a failed log write never changes the answer to the caller. */
async function logEvent(kind: string, severity: string, userId: string, detail: Record<string, unknown>, ip: string | null) {
  try {
    await db.rpc('log_security_event', { p_kind: kind, p_severity: severity, p_user: userId, p_detail: detail, p_ip: ip });
  } catch {
    // Logged by the platform; nothing else to do here.
  }
}

async function requestStatus(requestId: string): Promise<string | null> {
  const { data } = await db.from('service_requests').select('status').eq('id', requestId).maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

/**
 * Re-reads a pending collection from its operator and records what changed.
 * A success is handed to confirm_payment(), which is idempotent, so calling
 * this twice for one success is harmless — and a confirmation that failed on
 * a transient error is retried on the next status call.
 */
async function settle(c: Collection, ip: string | null): Promise<Collection> {
  if (c.status === 'pending') {
    const outcome = await readStatus(c.method, c.id, env, fetch).catch(() => ({ status: 'pending' }) as Outcome);
    if (outcome.status === 'pending') return c;
    const patch = {
      status: outcome.status,
      operator_ref: outcome.operatorRef ?? null,
      amount_collected: outcome.status === 'successful' ? (outcome.amount ?? null) : null,
      reason: outcome.reason?.slice(0, 200) ?? null,
      updated_at: new Date().toISOString(),
    };
    // Only a row still pending moves: two concurrent polls settle it once.
    const { data } = await db.from('payment_collections').update(patch).eq('id', c.id).eq('status', 'pending').select().maybeSingle();
    c = (data as Collection | null) ?? { ...c, ...patch };
    if (outcome.status !== 'successful') await logEvent('payment.failed', 'low', c.client_id, { collection: c.id, request: c.request_id, status: outcome.status }, ip);
  }
  if (c.status === 'successful') {
    const { error } = await db.rpc('confirm_payment', {
      p_request: c.request_id,
      p_method: c.method,
      p_operator_ref: c.operator_ref ?? c.id,
      // The operator's figure when it gave one, so a short payment is caught.
      p_amount: c.amount_collected ?? c.amount,
    });
    if (error) await logEvent('payment.confirm_error', 'high', c.client_id, { collection: c.id, request: c.request_id }, ip);
  }
  return c;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('method_not_allowed', 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return err('unknown', 500);

  const ip = clientIp(req);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return err('missing_token', 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) return err('invalid_token', 401);
  const userId = user.id;

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return err('payload_too_large', 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return err('unknown', 400);
  }

  if (body.action === 'start') {
    const method = body.method;
    if (method !== 'mtn' && method !== 'airtel') return err('invalid_method', 400);
    const number = msisdn(body.phone);
    if (!number) return err('invalid_phone', 400);
    const requestId = typeof body.request === 'string' && UUID.test(body.request) ? body.request : null;
    if (!requestId) return err('not_found', 404);

    // Checked before anything is written: with no credentials, nothing starts.
    if (!configured(method, env)) return err('payments_unavailable', 503);

    const { data: request } = await db
      .from('service_requests')
      .select('id, client_id, status, amount, currency')
      .eq('id', requestId)
      .maybeSingle();
    // Someone else's request reads as missing, as it does through RLS.
    if (!request || request.client_id !== userId) return err('not_found', 404);
    if (request.status !== 'draft') return err('not_payable', 409);
    if (request.currency !== 'FCFA') return err('currency_unsupported', 409);

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db
      .from('payment_collections')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', userId)
      .gte('created_at', since);
    if ((count ?? 0) >= MAX_STARTS) {
      await logEvent('payment.rate_limited', 'low', userId, { request: requestId }, ip);
      return err('rate_limited', 429);
    }

    const { data: live } = await db
      .from('payment_collections')
      .select('*')
      .eq('request_id', requestId)
      .in('status', ['pending', 'successful'])
      .maybeSingle();
    if (live) {
      const current = await settle(live as Collection, ip);
      if (current.status === 'successful') return json({ collection: current.id, status: 'successful' });
      if (current.status === 'pending') {
        const young = Date.now() - Date.parse(current.created_at) < STALE_MS;
        // A double tap, or the app retrying after a timeout: same payment.
        if (young && current.method === method && current.msisdn === number) return json({ collection: current.id, status: 'pending' });
        if (young) return err('payment_in_progress', 409);
        await db
          .from('payment_collections')
          .update({ status: 'expired', reason: 'Remplacée par une nouvelle demande.', updated_at: new Date().toISOString() })
          .eq('id', current.id)
          .eq('status', 'pending');
      }
    }

    const id = crypto.randomUUID();
    const { error: insertError } = await db.from('payment_collections').insert({
      id,
      request_id: requestId,
      client_id: userId,
      method,
      msisdn: number,
      amount: request.amount,
    });
    // 23505: a concurrent start won the race for this request.
    if (insertError) return err(insertError.code === '23505' ? 'payment_in_progress' : 'unknown', insertError.code === '23505' ? 409 : 500);

    try {
      await requestToPay(method, { id, msisdn: number, amount: request.amount, label: `242Konnect · ${requestId.slice(0, 6).toUpperCase()}` }, env, fetch);
    } catch (e) {
      const message = e instanceof OperatorError ? e.message : MESSAGES.operator_refused;
      await db
        .from('payment_collections')
        .update({ status: 'failed', reason: message.slice(0, 200), updated_at: new Date().toISOString() })
        .eq('id', id);
      await logEvent('payment.refused', 'low', userId, { collection: id, request: requestId, method }, ip);
      return err('operator_refused', 502, message);
    }
    await logEvent('payment.started', 'info', userId, { collection: id, request: requestId, method, amount: request.amount }, ip);
    return json({ collection: id, status: 'pending' });
  }

  if (body.action === 'status') {
    const collectionId = typeof body.collection === 'string' && UUID.test(body.collection) ? body.collection : null;
    if (!collectionId) return err('not_found', 404);
    const { data } = await db.from('payment_collections').select('*').eq('id', collectionId).maybeSingle();
    if (!data || data.client_id !== userId) return err('not_found', 404);
    const c = await settle(data as Collection, ip);
    return json({ status: c.status, requestStatus: await requestStatus(c.request_id), ...(c.reason ? { reason: c.reason } : {}) });
  }

  return err('unknown', 400);
});
