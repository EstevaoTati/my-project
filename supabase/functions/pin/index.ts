/**
 * The 6-digit PIN, checked where the client cannot watch.
 *
 * This function exists because of one number: a six-digit PIN has a keyspace of
 * 10^6. Anything that can read `pin_hash` can exhaust that keyspace offline, in
 * well under a second, whatever algorithm produced the hash. So the hash must
 * never leave the server, the comparison must happen here, and the count of
 * wrong guesses must be kept somewhere the guesser cannot reset.
 *
 * That is the whole design:
 *
 * - `public.user_pin` has RLS enabled and **no policies at all**, so no anon or
 *   authenticated client can read or write it. Only the service role, which
 *   lives in this function's environment and nowhere near the app bundle, can
 *   reach it. Nothing here ever returns a hash, a salt, or an attempt count
 *   fine-grained enough to be useful.
 * - The user is taken from the verified JWT, never from the request body. A
 *   caller cannot set or check somebody else's PIN by naming their id, because
 *   the id in the body is not read.
 * - Wrong guesses are counted in `app_metadata`, which the Admin API writes and
 *   a client cannot. Five in a row locks the PIN for fifteen minutes. Without
 *   that, 10^6 is a few hours of patient requests.
 *
 * PBKDF2-SHA256 at 210,000 iterations with a per-user random salt. For a
 * password this would be adequate; for a six-digit PIN it is the only thing
 * standing between a leaked table and every PIN in it, which is why the
 * iteration count is high rather than merely respectable. The stored format is
 * self-describing — `pbkdf2$sha256$<iterations>$<salt>$<hash>` — so the cost can
 * be raised later and old rows still verify, then re-hash on next use.
 *
 * Actions, all POST, all requiring the caller's bearer token:
 *   { action: "status" }              → { hasPin, lockedUntil }
 *   { action: "set", pin, current? }  → { ok } — `current` required to replace
 *   { action: "verify", pin }         → { ok } or 401 with attemptsLeft
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const ITERATIONS = 210_000;
const PIN_LENGTH = 6;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // The app is served from Netlify and from file:// previews, and carries
      // no cookies here — the bearer token is explicit. Credentials are never
      // included, so a wildcard origin grants nothing a token would not.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** Exactly six digits. Anything else is rejected before it reaches the KDF. */
function normalizePin(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  return digits.length === PIN_LENGTH ? digits : null;
}

/**
 * Refuses the PINs everyone picks first.
 *
 * A lockout makes online guessing expensive, but the guesses are not random:
 * 123456, 000000 and a four-digit year cover a startling share of real PINs, and
 * five tries is plenty to walk the top five. Refusing them at the point of
 * choice costs the user one retry and removes the cheapest attack entirely.
 */
function weakPin(pin: string): string | null {
  if (/^(\d)\1{5}$/.test(pin)) return 'Ce code est trop simple : six chiffres identiques.';
  const ascending = '0123456789012345';
  const descending = '9876543210987654';
  if (ascending.includes(pin) || descending.includes(pin))
    return 'Ce code est trop simple : des chiffres qui se suivent.';
  // A repeated group — 121212, 456456. Six digits that are really two or three.
  if (/^(\d{2})\1{2}$/.test(pin) || /^(\d{3})\1$/.test(pin))
    return 'Ce code est trop simple : un motif qui se répète.';
  return null;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** Constant-time compare, so a wrong PIN cannot be narrowed by timing. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, algo, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || algo !== 'sha256') return false;
  const rounds = Number(iterations);
  if (!Number.isFinite(rounds) || rounds < 1) return false;
  const candidate = await derive(pin, unb64(salt), rounds);
  return sameBytes(candidate, unb64(hash));
}

type LockState = { failures: number; lockedUntil: number | null };

function readLock(appMetadata: Record<string, unknown> | undefined): LockState {
  const failures = Number(appMetadata?.pin_failures ?? 0);
  const until = appMetadata?.pin_locked_until;
  const lockedUntil = typeof until === 'string' ? Date.parse(until) : null;
  return {
    failures: Number.isFinite(failures) ? failures : 0,
    lockedUntil: lockedUntil && Number.isFinite(lockedUntil) ? lockedUntil : null,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({}, 204);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const bearer = request.headers.get('Authorization') ?? '';
  const token = bearer.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'missing_token' }, 401);

  // Service role: this client bypasses RLS, which is the only way to touch
  // user_pin at all. Every query below is scoped to the id from the token.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'invalid_token' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const lock = readLock(user.app_metadata as Record<string, unknown>);
  const locked = lock.lockedUntil !== null && lock.lockedUntil > Date.now();

  const { data: row } = await admin
    .from('user_pin')
    .select('pin_hash')
    .eq('user_id', user.id)
    .maybeSingle();

  if (body.action === 'status') {
    return json({
      hasPin: Boolean(row?.pin_hash),
      lockedUntil: locked ? new Date(lock.lockedUntil!).toISOString() : null,
    });
  }

  const pin = normalizePin(body.pin);
  if (!pin) return json({ error: 'invalid_pin_format' }, 400);

  if (body.action === 'set') {
    const weak = weakPin(pin);
    if (weak) return json({ error: 'weak_pin', message: weak }, 400);

    // Replacing an existing PIN needs the old one. Otherwise anyone holding a
    // session — a borrowed unlocked phone — could silently swap the second
    // factor for one of their own.
    if (row?.pin_hash) {
      if (locked) return json({ error: 'locked', lockedUntil: new Date(lock.lockedUntil!).toISOString() }, 423);
      const current = normalizePin(body.current);
      if (!current || !(await verifyPin(current, row.pin_hash)))
        return json({ error: 'current_pin_incorrect' }, 401);
    }

    const { error } = await admin
      .from('user_pin')
      .upsert({ user_id: user.id, pin_hash: await hashPin(pin), updated_at: new Date().toISOString() });
    if (error) return json({ error: 'store_failed' }, 500);

    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { pin_failures: 0, pin_locked_until: null },
    });
    return json({ ok: true });
  }

  if (body.action === 'verify') {
    if (locked)
      return json({ error: 'locked', lockedUntil: new Date(lock.lockedUntil!).toISOString() }, 423);
    if (!row?.pin_hash) return json({ error: 'no_pin' }, 404);

    if (await verifyPin(pin, row.pin_hash)) {
      if (lock.failures > 0)
        await admin.auth.admin.updateUserById(user.id, {
          app_metadata: { pin_failures: 0, pin_locked_until: null },
        });
      return json({ ok: true });
    }

    const failures = lock.failures + 1;
    const lockNow = failures >= MAX_FAILURES;
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        pin_failures: lockNow ? 0 : failures,
        pin_locked_until: lockNow
          ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
          : null,
      },
    });

    return json(
      lockNow
        ? { error: 'locked', lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() }
        : { error: 'pin_incorrect', attemptsLeft: MAX_FAILURES - failures },
      lockNow ? 423 : 401
    );
  }

  return json({ error: 'unknown_action' }, 400);
});
