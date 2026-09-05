/**
 * The 6-digit PIN, from the app's side.
 *
 * Everything real happens in the `pin` Edge Function; this file only carries
 * digits to it and reads the answer back. That division is the point, not an
 * accident of layering:
 *
 * - **No hashing here.** A PIN hashed on the device would have to be compared
 *   somewhere, and any comparison the device can perform, an attacker holding
 *   the device can perform 10^6 times.
 * - **No attempt counting here.** A counter in AsyncStorage is a counter the
 *   guesser can clear. The lockout lives in `app_metadata`, written by the
 *   service role and by nothing else.
 * - **The hash never travels.** Nothing in this file can request it, and the
 *   function has no response that contains it.
 *
 * What the device does keep is the fact that a PIN exists, so the sign-in
 * screen can offer it without a round trip on a cold start. That flag is a
 * convenience, never an authorisation: a lie in storage buys nothing, because
 * the function still refuses a wrong PIN.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured, type SupabaseSession } from './supabase';

export const PIN_LENGTH = 6;

/** Per-account, so two people sharing a phone don't see each other's state. */
const flagKey = (userId: string) => `242k.pin.${userId}`;

export class PinError extends Error {
  constructor(message: string, readonly code: string, readonly attemptsLeft?: number) {
    super(message);
  }
}

type PinAction =
  | { action: 'status' }
  | { action: 'set'; pin: string; current?: string }
  | { action: 'verify'; pin: string };

/** Translations for the codes the function returns. It answers in codes, we render French. */
function messageFor(code: string, payload: Record<string, unknown>): string {
  switch (code) {
    case 'invalid_pin_format':
      return `Le code doit contenir ${PIN_LENGTH} chiffres.`;
    case 'weak_pin':
      return typeof payload.message === 'string'
        ? payload.message
        : 'Ce code est trop simple. Choisissez-en un autre.';
    case 'current_pin_incorrect':
      return 'Le code actuel est incorrect.';
    case 'pin_incorrect': {
      const left = Number(payload.attemptsLeft);
      return Number.isFinite(left) && left > 0
        ? `Code incorrect. Il vous reste ${left} tentative${left > 1 ? 's' : ''}.`
        : 'Code incorrect.';
    }
    case 'locked': {
      const until = typeof payload.lockedUntil === 'string' ? Date.parse(payload.lockedUntil) : NaN;
      const minutes = Number.isFinite(until)
        ? Math.max(1, Math.ceil((until - Date.now()) / 60_000))
        : 15;
      return `Trop de codes incorrects. Réessayez dans ${minutes} minutes.`;
    }
    case 'no_pin':
      return "Aucun code n'est défini sur ce compte.";
    case 'invalid_token':
    case 'missing_token':
      return 'Votre session a expiré. Reconnectez-vous.';
    default:
      return 'Le service de code confidentiel est indisponible. Réessayez.';
  }
}

const TIMEOUT_MS = 20_000;

async function callPin(
  session: SupabaseSession,
  body: PinAction
): Promise<Record<string, unknown>> {
  if (!supabaseConfigured) throw new PinError('Service non configuré.', 'unconfigured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const code = typeof payload.error === 'string' ? payload.error : 'unknown';
      const left = Number(payload.attemptsLeft);
      throw new PinError(
        messageFor(code, payload),
        code,
        Number.isFinite(left) ? left : undefined
      );
    }
    return payload;
  } catch (e) {
    if (e instanceof PinError) throw e;
    if (e instanceof Error && e.name === 'AbortError')
      throw new PinError('Le service ne répond pas. Vérifiez votre connexion.', 'timeout');
    throw new PinError('Impossible de joindre le service de code confidentiel.', 'unreachable');
  } finally {
    clearTimeout(timer);
  }
}

/** Whether this account has a PIN, and whether it is currently locked out. */
export async function pinStatus(
  session: SupabaseSession
): Promise<{ hasPin: boolean; lockedUntil: string | null }> {
  const payload = await callPin(session, { action: 'status' });
  const hasPin = payload.hasPin === true;
  await rememberHasPin(session.userId, hasPin);
  return {
    hasPin,
    lockedUntil: typeof payload.lockedUntil === 'string' ? payload.lockedUntil : null,
  };
}

/** Sets a first PIN, or replaces one — replacing requires the current PIN. */
export async function setPin(
  session: SupabaseSession,
  pin: string,
  current?: string
): Promise<void> {
  await callPin(session, { action: 'set', pin, ...(current ? { current } : {}) });
  await rememberHasPin(session.userId, true);
}

/** Checks a PIN. Resolves on success; throws `PinError` with a reason otherwise. */
export async function verifyPin(session: SupabaseSession, pin: string): Promise<void> {
  await callPin(session, { action: 'verify', pin });
}

/**
 * The local "this account has a PIN" flag.
 *
 * A hint for the sign-in screen, never a decision: the server refuses a wrong
 * PIN whatever this says, and a missing flag only costs one extra round trip.
 */
export async function rememberHasPin(userId: string, hasPin: boolean): Promise<void> {
  try {
    if (hasPin) await AsyncStorage.setItem(flagKey(userId), '1');
    else await AsyncStorage.removeItem(flagKey(userId));
  } catch {
    // Losing the hint costs a round trip, nothing else.
  }
}

export async function knownToHavePin(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(flagKey(userId))) === '1';
  } catch {
    return false;
  }
}

/** The rules the screen states before anyone types, matching the server's. */
export function pinProblem(pin: string): string | null {
  const digits = pin.replace(/\D/g, '');
  if (digits.length !== PIN_LENGTH) return `Le code doit contenir ${PIN_LENGTH} chiffres.`;
  if (/^(\d)\1{5}$/.test(digits)) return 'Évitez six chiffres identiques.';
  if ('0123456789012345'.includes(digits) || '9876543210987654'.includes(digits))
    return 'Évitez des chiffres qui se suivent.';
  if (/^(\d{2})\1{2}$/.test(digits) || /^(\d{3})\1$/.test(digits))
    return 'Évitez un motif qui se répète.';
  return null;
}
