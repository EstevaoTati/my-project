/**
 * 242Konnect PIN service — v7 (2026-10-19 security hardening).
 *
 * A six-digit PIN has 10^6 values. Anyone who can read a hash, or who can
 * guess without limit, gets the PIN; so the hash never leaves the server, the
 * comparison happens here, and wrong guesses are counted where no client and
 * no second function instance can reset them.
 *
 * What changed from v6 (the version live since 2026-09-11):
 *  - The lockout lived in this isolate's memory, so every new isolate, cold
 *    start or parallel instance started the count again — a PIN could be
 *    brute-forced by spreading guesses (finding F-03). The count and the lock
 *    are now in public.user_pin_security, updated atomically by
 *    public.pin_register_attempt(); a third lockout in 24 h locks for a day.
 *  - New hashes use 210,000 PBKDF2 rounds; v6 rows (120,000) still verify and
 *    are re-hashed on the next correct entry.
 *  - Security events (PIN set, changed, reset, wrong, locked, bad token) go to
 *    public.security_events — never the PIN, a hash or the token.
 *  - action "reset": a forgotten PIN can be replaced without the old one, but
 *    only with a session obtained from an e-mail code in the last 10 minutes
 *    (step-up). Before, a forgotten PIN could not be replaced at all.
 *  - Request bodies over 2 KB are refused before parsing.
 *
 * Protocol (unchanged for the app; it reads `error`, not the status):
 *   POST {action:"status"}             -> {hasPin, lockedUntil}
 *   POST {action:"set", pin, current?} -> {} | {error}
 *   POST {action:"verify", pin}        -> {} | {error, attemptsLeft | lockedUntil}
 *   POST {action:"reset", pin}         -> {} | {error:"step_up_required"}
 * Errors: invalid_pin_format, weak_pin, current_pin_incorrect, pin_incorrect,
 *   locked, no_pin, step_up_required, invalid_token, missing_token,
 *   payload_too_large, method_not_allowed, unknown.
 *
 * Deploy with verify_jwt = false: the token is validated here against the Auth
 * server (auth.getUser), which also rejects revoked sessions — the gateway's
 * signature check alone would not.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { hashPin, normalizePin, recentEmailCode, verifyPin, weakPin } from './core.ts';

const MAX_ATTEMPTS = 5;
const MAX_BODY_BYTES = 2048;

const corsHeaders = {
  // Bearer-token API with no cookies: a wildcard origin grants nothing the
  // token does not. Set PIN_ALLOWED_ORIGIN to pin it to the app's domain.
  'Access-Control-Allow-Origin': Deno.env.get('PIN_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const err = (error: string, status: number, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function clientIp(req: Request): string | null {
  const first = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(first) ? first : null;
}

/** Best effort: a failed log write never changes the answer to the caller. */
async function logEvent(kind: string, severity: string, userId: string | null, detail: Record<string, unknown>, ip: string | null) {
  try {
    await db.rpc('log_security_event', { p_kind: kind, p_severity: severity, p_user: userId, p_detail: detail, p_ip: ip });
  } catch {
    // Logged by the platform; nothing else to do here.
  }
}

async function lockState(userId: string): Promise<{ failed: number; lockedUntil: string | null }> {
  const { data } = await db.rpc('pin_lock_state', { p_user: userId });
  const row = Array.isArray(data) ? data[0] : data;
  const until = row?.locked_until ?? null;
  const active = until && Date.parse(until) > Date.now() ? until : null;
  return { failed: Number(row?.failed_attempts ?? 0), lockedUntil: active };
}

async function registerAttempt(userId: string, success: boolean) {
  const { data, error } = await db.rpc('pin_register_attempt', { p_user: userId, p_success: success });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const until = row?.locked_until ?? null;
  return {
    failed: Number(row?.failed_attempts ?? 0),
    lockedUntil: until && Date.parse(until) > Date.now() ? (until as string) : null,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('method_not_allowed', 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return err('unknown', 500);

  const ip = clientIp(req);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return err('missing_token', 401);

  // Validated by the Auth server: signature, expiry, and that the session has
  // not been revoked. The user id below comes from here, never from the body.
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) {
    await logEvent('pin.invalid_token', 'low', null, {}, ip);
    return err('invalid_token', 401);
  }
  const userId = user.id;

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return err('payload_too_large', 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return err('unknown', 400);
  }

  const { data: existing } = await db.from('user_pin').select('pin_hash').eq('user_id', userId).maybeSingle();
  const action = body.action;

  if (action === 'status') {
    const lock = await lockState(userId);
    return json({ hasPin: !!existing, lockedUntil: lock.lockedUntil });
  }

  if (action === 'set' || action === 'reset') {
    const pin = normalizePin(body.pin);
    if (!pin) return err('invalid_pin_format', 400);
    const weak = weakPin(pin);
    if (weak) return err('weak_pin', 400, { message: weak });

    if (existing && action === 'set') {
      // Replacing a PIN needs the current one — counted like any other guess,
      // so "set" cannot be used to brute-force around the lockout.
      const lock = await lockState(userId);
      if (lock.lockedUntil) return err('locked', 429, { lockedUntil: lock.lockedUntil });
      const current = normalizePin(body.current);
      const check = current ? await verifyPin(current, existing.pin_hash as string) : { ok: false };
      if (!check.ok) {
        const after = await registerAttempt(userId, false);
        await logEvent('pin.change_refused', 'low', userId, { attemptsLeft: MAX_ATTEMPTS - after.failed }, ip);
        if (after.lockedUntil) return err('locked', 429, { lockedUntil: after.lockedUntil });
        return err('current_pin_incorrect', 400, { attemptsLeft: MAX_ATTEMPTS - after.failed });
      }
    }
    if (action === 'reset' && !recentEmailCode(token, Math.floor(Date.now() / 1000))) {
      await logEvent('pin.reset_refused', 'medium', userId, { reason: 'no recent e-mail code' }, ip);
      return err('step_up_required', 403);
    }

    const { error } = await db
      .from('user_pin')
      .upsert({ user_id: userId, pin_hash: await hashPin(pin), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return err('unknown', 500);
    await registerAttempt(userId, true);
    await logEvent(
      action === 'reset' ? 'pin.reset' : existing ? 'pin.changed' : 'pin.set',
      action === 'reset' ? 'medium' : 'info',
      userId,
      {},
      ip
    );
    return json({});
  }

  if (action === 'verify') {
    if (!existing) return err('no_pin', 404);
    const lock = await lockState(userId);
    if (lock.lockedUntil) return err('locked', 429, { lockedUntil: lock.lockedUntil });

    const pin = normalizePin(body.pin);
    const check = pin ? await verifyPin(pin, existing.pin_hash as string) : { ok: false, upgrade: false };
    if (!check.ok) {
      const after = await registerAttempt(userId, false);
      await logEvent('pin.wrong', 'low', userId, { attemptsLeft: MAX_ATTEMPTS - after.failed }, ip);
      if (after.lockedUntil) return err('locked', 429, { lockedUntil: after.lockedUntil });
      return err('pin_incorrect', 401, { attemptsLeft: MAX_ATTEMPTS - after.failed });
    }
    await registerAttempt(userId, true);
    if (check.upgrade && pin) {
      await db.from('user_pin').update({ pin_hash: await hashPin(pin), updated_at: new Date().toISOString() }).eq('user_id', userId);
    }
    return json({});
  }

  return err('unknown', 400);
});
