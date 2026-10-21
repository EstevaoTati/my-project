/**
 * The password, held by Supabase Auth rather than by the phone.
 *
 * Until now the password was hashed and kept on the device only. That made an
 * account a file on one phone: a reinstall, a second phone or a cleared browser
 * and the password could not be checked anywhere, so the person could not sign
 * in at all — even though their profile was safe in `public.profiles`.
 *
 * GoTrue now holds it (bcrypt, server-side, rate-limited), set once the e-mail
 * code has proved the address:
 *
 *   sign-up      code → session → setServerPassword → account
 *   sign-in      signInWithPassword → session → PIN → app
 *   recovery     code → session → setServerPassword
 *
 * Accounts created before this change have no server password. They are
 * migrated the first time they sign in on a device that still knows their
 * local password: the e-mail code proves the address, and the password they
 * just typed is handed to GoTrue — see `signIn` in auth.tsx.
 */

import { supabaseConfigured, supabaseFetch, sessionFromPayload, type SupabaseSession } from './supabase';

/** Wrong e-mail/password pair — kept distinct so the caller can try the legacy path. */
export class InvalidCredentialsError extends Error {}

const reasonOf = (payload: Record<string, unknown>) =>
  String(payload.error_code ?? payload.code ?? payload.error ?? payload.msg ?? payload.message ?? '');

/** E-mail + password → session. Throws `InvalidCredentialsError` on a wrong pair. */
export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
  if (!supabaseConfigured) throw new Error('Service non configuré.');
  let response: Response;
  try {
    response = await supabaseFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    });
  } catch {
    throw new Error('Connexion impossible. Vérifiez votre réseau et réessayez.');
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.ok) {
    const session = sessionFromPayload(payload);
    if (session) return session;
  }
  const reason = reasonOf(payload);
  if (response.status === 429) throw new Error('Trop de tentatives. Patientez une minute avant de réessayer.');
  if (/email_not_confirmed/i.test(reason))
    throw new Error("Cette adresse n'a pas encore été vérifiée. Terminez l'inscription avec le code reçu par e-mail.");
  if (response.status === 400 || /invalid_credentials|invalid_grant/i.test(reason))
    throw new InvalidCredentialsError('invalid credentials');
  throw new Error('Le service de connexion est indisponible. Réessayez.');
}

/**
 * Gives the account its password on the server. Needs a fresh session — the
 * one the e-mail code just bought — which is exactly when it is called.
 */
export async function setServerPassword(session: SupabaseSession, password: string): Promise<void> {
  if (!supabaseConfigured) return;
  let response: Response;
  try {
    response = await supabaseFetch('/auth/v1/user', { method: 'PUT', body: { password } }, session);
  } catch {
    throw new Error("Le mot de passe n'a pas pu être enregistré : vérifiez votre connexion et réessayez.");
  }
  if (response.ok) return;
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = reasonOf(payload);
  // Already that password: nothing to change, nothing wrong.
  if (/same_password/i.test(reason)) return;
  if (/weak_password/i.test(reason))
    throw new Error('Ce mot de passe est trop faible pour le serveur. Choisissez-en un plus long ou plus varié.');
  throw new Error("Le mot de passe n'a pas pu être enregistré sur le serveur. Réessayez.");
}
