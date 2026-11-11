/**
 * The PIN function's pure logic — hashing, comparison, input rules, and the
 * step-up check — with no Deno or Supabase dependency, so the same file runs
 * under the Edge runtime and under Node for the tests (core.test.mjs).
 */

export const PIN_LENGTH = 6;
/** Cost for new hashes. Old rows verify at their own cost and are re-hashed. */
export const ITERATIONS = 210_000;
/** A forgotten PIN may be replaced only this soon after an e-mail code. */
export const STEP_UP_SECONDS = 10 * 60;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** Exactly six digits, as a string. Anything else never reaches the KDF. */
export function normalizePin(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  return /^\d{6}$/.test(input) ? input : null;
}

/** The PINs everyone tries first. Refused at the point of choice. */
export function weakPin(pin: string): string | null {
  if (/^(\d)\1{5}$/.test(pin)) return 'Évitez six chiffres identiques.';
  if ('0123456789012345'.includes(pin) || '9876543210987654'.includes(pin))
    return 'Évitez des chiffres qui se suivent.';
  if (/^(\d{2})\1{2}$/.test(pin) || /^(\d{3})\1$/.test(pin)) return 'Évitez un motif qui se répète.';
  return null;
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(pin, salt, ITERATIONS))}`;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type Parsed = { iterations: number; salt: Uint8Array<ArrayBuffer>; hash: Uint8Array<ArrayBuffer> };

/**
 * Both formats in production:
 *   pbkdf2$sha256$<iterations>$<salt>$<hash>   written by this version
 *   pbkdf2$<iterations>$<salt>$<hash>          written by v6 (120,000 rounds)
 */
export function parseStored(stored: string): Parsed | null {
  const parts = stored.split('$');
  let iter: string, salt: string, hash: string;
  if (parts.length === 5 && parts[0] === 'pbkdf2' && parts[1] === 'sha256') [, , iter, salt, hash] = parts;
  else if (parts.length === 4 && parts[0] === 'pbkdf2') [, iter, salt, hash] = parts;
  else return null;
  const iterations = Number(iter);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 10_000_000) return null;
  try {
    return { iterations, salt: unb64(salt), hash: unb64(hash) };
  } catch {
    return null;
  }
}

/** Constant-time check, plus whether the row should be re-hashed at the current cost. */
export async function verifyPin(pin: string, stored: string): Promise<{ ok: boolean; upgrade: boolean }> {
  const parsed = parseStored(stored);
  if (!parsed) return { ok: false, upgrade: false };
  const ok = sameBytes(await derive(pin, parsed.salt, parsed.iterations), parsed.hash);
  return { ok, upgrade: ok && (parsed.iterations < ITERATIONS || !stored.startsWith('pbkdf2$sha256$')) };
}

/**
 * Step-up for a forgotten PIN: the access token must come from an e-mail code
 * entered in the last STEP_UP_SECONDS. GoTrue records how a session was
 * obtained in the token's `amr` claim; the token itself has already been
 * validated by the Auth server before this is called, so its payload can be
 * trusted here.
 */
export function recentEmailCode(accessToken: string, nowSeconds: number): boolean {
  const part = accessToken.split('.')[1];
  if (!part) return false;
  let payload: { amr?: { method?: string; timestamp?: number }[] };
  try {
    payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return false;
  }
  return (payload.amr ?? []).some(
    (m) =>
      (m.method === 'otp' || m.method === 'email/signup' || m.method === 'magiclink') &&
      typeof m.timestamp === 'number' &&
      nowSeconds - m.timestamp >= 0 &&
      nowSeconds - m.timestamp <= STEP_UP_SECONDS
  );
}
