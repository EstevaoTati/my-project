import * as Crypto from 'expo-crypto';

/**
 * Password storage and strength.
 *
 * The correction note asks for "un système de mot de passe sécurisé" and for it
 * not to be easy to reach someone's account just by knowing their number or
 * e-mail. Passwords were previously kept in plain text in AsyncStorage, which
 * on web is localStorage — readable by anything with access to the device or
 * the origin. This replaces that.
 *
 * **What this is.** Salted SHA-256: a per-account random salt, stored beside the
 * hash, so identical passwords produce different hashes and a precomputed table
 * is useless.
 *
 * **What this is not.** A password KDF. SHA-256 is fast by design, which is the
 * opposite of what you want against an offline guessing attack; bcrypt, scrypt
 * or Argon2 exist for that reason. Those need native modules or a server, and
 * the real fix is for passwords never to be verified on the device at all —
 * once Supabase Auth holds the account, this becomes dead code. Until then it
 * raises the cost from "read the file" to "run a cracker", which is worth
 * having and worth being honest about.
 */

const SALT_BYTES = 16;

export const MIN_PASSWORD = 8;

export type StoredSecret = { salt: string; hash: string };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function digest(salt: string, password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

export async function hashPassword(password: string): Promise<StoredSecret> {
  const salt = toHex(Crypto.getRandomBytes(SALT_BYTES));
  return { salt, hash: await digest(salt, password) };
}

/**
 * Constant-time-ish comparison. JavaScript gives no real guarantee here, but
 * comparing the whole string rather than bailing on the first mismatch removes
 * the most obvious timing signal.
 */
export async function verifyPassword(password: string, secret: StoredSecret): Promise<boolean> {
  const candidate = await digest(secret.salt, password);
  if (candidate.length !== secret.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ secret.hash.charCodeAt(i);
  return diff === 0;
}

/**
 * Why a password is rejected, in French, or null when it passes.
 *
 * Eight characters with some variety, rather than the six-with-no-rules the app
 * had. Stated as one message per problem so the person knows what to change.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD)
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
  if (!/[a-zA-Z]/.test(password)) return 'Ajoutez au moins une lettre.';
  if (!/[0-9]/.test(password)) return 'Ajoutez au moins un chiffre.';
  if (/^(.)\1+$/.test(password)) return 'Choisissez un mot de passe moins évident.';
  const common = ['motdepasse', 'password', '12345678', 'azertyui', 'qwertyui', '242konnect'];
  if (common.includes(password.toLowerCase())) return 'Ce mot de passe est trop courant.';
  return null;
}

/** A coarse strength read for the meter on the password screen. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.length < MIN_PASSWORD) return 0;
  let score = 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;
  return Math.min(3, score) as 0 | 1 | 2 | 3;
}
