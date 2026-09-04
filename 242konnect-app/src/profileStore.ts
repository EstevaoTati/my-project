/**
 * The account, on the server.
 *
 * `auth.tsx` writes accounts to AsyncStorage, which is what makes the app work
 * offline and what made an account exist on exactly one phone. This file is the
 * other half: `public.profiles` in Supabase, one row per `auth.users` id, so a
 * profile filled in on a phone is still there after a reinstall or on a second
 * device.
 *
 * Row-level security does the enforcing, not this file. Every policy on the
 * table is `auth.uid() = id`, so the bearer token obtained when a verification
 * code is accepted authorises exactly one row — the caller's own. There is no
 * request here that could reach anyone else's data, whatever the app asked for.
 *
 * Two rules the device alone could never enforce, and which are the point of
 * having the table at all:
 *
 * - **Uniqueness is platform-wide.** `email` and `phone` are UNIQUE columns, so
 *   a number already registered on someone else's phone is refused here even
 *   though this device has never seen it. The local check in `auth.tsx` only
 *   ever saw accounts on this device; §9.10 asks for more than that.
 * - **The password never comes here.** Not the password, not its hash, not its
 *   salt — `StoredSecret` stays on the device. Supabase authenticates by mailed
 *   code; the password is a second, local factor and the row has no column for
 *   it.
 */

import type { Account, ProfileKind } from './auth';
import type { CountryCode, Location } from './countries';
import { supabaseConfigured, supabaseFetch, type SupabaseSession } from './supabase';

/** Thrown when the number or address already belongs to another account. */
export class ProfileConflictError extends Error {}

const PROFILE_KINDS: ProfileKind[] = ['particulier', 'prestataire', 'business'];

/** The columns of `public.profiles`, as PostgREST returns them. */
type ProfileRow = {
  id: string;
  email: string;
  phone: string;
  phone_country: string;
  full_name: string;
  country: string;
  city: string | null;
  state: string | null;
  profiles: string[] | null;
  active_profile: string;
  bio: string | null;
  avatar_url: string | null;
  particulier: unknown;
  prestataire: unknown;
  business: unknown;
  created_at: string;
};

function toRow(account: Account, userId: string): Record<string, unknown> {
  return {
    id: userId,
    email: account.email,
    phone: account.phone,
    phone_country: account.phoneCountry,
    full_name: account.name,
    country: account.location.country,
    city: account.location.city ?? null,
    state: account.location.state ?? null,
    profiles: account.profiles,
    active_profile: account.activeProfile,
    bio: account.bio ?? null,
    // The photo is a data URI, bounded to ~220 KB by photo.ts. Small enough for
    // a text column, and it is the part of a profile people most notice losing.
    avatar_url: account.avatar ?? null,
    particulier: account.particulier ?? null,
    prestataire: account.prestataire ?? null,
    business: account.business ?? null,
  };
}

/** Only the fields the server owns; the device keeps the password and the id. */
function fromRow(row: ProfileRow): Omit<Account, 'createdAt'> & { createdAt?: number } {
  const kinds = (row.profiles ?? []).filter((k): k is ProfileKind =>
    PROFILE_KINDS.includes(k as ProfileKind)
  );
  const location: Location = {
    country: (row.country as CountryCode) ?? 'CG',
    city: row.city ?? '',
    ...(row.state ? { state: row.state } : {}),
  };
  const createdAt = Date.parse(row.created_at);

  return {
    phone: row.phone,
    phoneCountry: (row.phone_country as CountryCode) ?? 'CG',
    location,
    email: row.email,
    name: row.full_name,
    ...(row.avatar_url ? { avatar: row.avatar_url } : {}),
    ...(row.bio ? { bio: row.bio } : {}),
    profiles: kinds.length ? kinds : ['particulier'],
    activeProfile: PROFILE_KINDS.includes(row.active_profile as ProfileKind)
      ? (row.active_profile as ProfileKind)
      : 'particulier',
    ...(row.particulier ? { particulier: row.particulier as Account['particulier'] } : {}),
    ...(row.prestataire ? { prestataire: row.prestataire as Account['prestataire'] } : {}),
    ...(row.business ? { business: row.business as Account['business'] } : {}),
    ...(Number.isFinite(createdAt) ? { createdAt } : {}),
  };
}

/**
 * Writes the account to its row, creating it on first call.
 *
 * `resolution=merge-duplicates` makes this an upsert on the primary key, so
 * sign-up and every later edit take the same path — there is no "first save"
 * special case to get wrong.
 *
 * Throws `ProfileConflictError` when the unique constraint on `email` or
 * `phone` rejects the row, which means the identity belongs to a different
 * account. Callers treat that as the refusal §9.10 dictates, not as a sync
 * failure to shrug off.
 */
export async function pushProfile(session: SupabaseSession, account: Account): Promise<void> {
  if (!supabaseConfigured) return;

  const response = await supabaseFetch(
    '/rest/v1/profiles',
    {
      method: 'POST',
      body: toRow(account, session.userId),
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    },
    session
  );
  if (response.ok) return;

  const payload = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
  // 23505 is Postgres' unique_violation. On the primary key it would have been
  // merged, so reaching here means it was `email` or `phone` — someone else's.
  // The wording shown to the user lives in auth.tsx, which quotes §9.10; this
  // only says which kind of failure it was.
  if (response.status === 409 || payload.code === '23505')
    throw new ProfileConflictError('phone or email already registered');
  throw new Error(payload.message ?? "Le compte n'a pas pu être enregistré sur le serveur.");
}

/**
 * Reads the account's row back, or null when there isn't one yet.
 *
 * Used on sign-in: the profile as last saved on any device wins over whatever
 * this device happens to remember, which is what "my edits are gone" was really
 * asking for.
 */
export async function pullProfile(
  session: SupabaseSession
): Promise<ReturnType<typeof fromRow> | null> {
  if (!supabaseConfigured) return null;

  const response = await supabaseFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}&select=*&limit=1`,
    {},
    session
  );
  if (!response.ok) return null;

  const rows = (await response.json().catch(() => [])) as ProfileRow[];
  const row = Array.isArray(rows) ? rows[0] : undefined;
  return row ? fromRow(row) : null;
}
