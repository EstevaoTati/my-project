/**
 * The Supabase connection, in one place.
 *
 * Two things run over it:
 *
 * - **GoTrue** (`/auth/v1`) issues, mails and checks the verification codes —
 *   see `otpClient.ts`. Nothing on the device ever holds a code.
 * - **PostgREST** (`/rest/v1`) holds the account rows in `public.profiles` —
 *   see `profileStore.ts`. That is what makes an account something other than a
 *   record on one phone.
 *
 * Both need the same base URL and publishable key, so they are read once here
 * rather than separately in each file.
 *
 * On the key: the publishable (anon) key is *designed* to ship inside a client.
 * It authorises only what row-level security allows, and the policy on
 * `public.profiles` is `auth.uid() = id` — you can read and write your own row
 * and no one else's. A mail-provider key (Resend, SendGrid) is the opposite kind
 * of credential: anyone who unzips the APK could then send mail as 242Konnect.
 * That is why the mail goes out through Supabase and not from the app.
 */

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
export const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/** True when the build was given a project to talk to. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * A signed-in Supabase user.
 *
 * Returned by GoTrue when a verification code is accepted, which is the only
 * moment the app can prove who someone is. It is what authorises the row in
 * `public.profiles`: without it PostgREST sees an anonymous caller and RLS
 * refuses every row.
 */
export type SupabaseSession = {
  accessToken: string;
  /** Absent on providers that don't issue one; the session then simply expires. */
  refreshToken: string | null;
  /** `auth.users.id` — the primary key of the profile row. */
  userId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

export class SupabaseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const TIMEOUT_MS = 15000;

/** Reads a GoTrue token response into a session, or null if it isn't one. */
export function sessionFromPayload(payload: Record<string, unknown>): SupabaseSession | null {
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
  const user = payload.user as { id?: unknown } | undefined;
  const userId = typeof user?.id === 'string' ? user.id : '';
  if (!accessToken || !userId) return null;

  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : null,
    userId,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * A request to the project, with the publishable key attached and, when a
 * session is given, that user's bearer token on top of it.
 *
 * AbortController rather than a racing timer: a hung request on a weak mobile
 * connection should actually be cancelled, not left running while the app
 * carries on without it.
 */
export async function supabaseFetch(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  session?: SupabaseSession | null
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session?.accessToken || SUPABASE_KEY}`,
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Half a minute of slack, so a token doesn't expire mid-request. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * The session, still valid.
 *
 * Access tokens last an hour by default and profile edits happen long after
 * sign-in, so the stored session is refreshed on the way out rather than
 * assumed good. Returns null when it can no longer be refreshed — the caller
 * then keeps the account on the device and syncs at the next sign-in, which is
 * the honest outcome and not one worth interrupting anybody for.
 */
export async function freshSession(
  session: SupabaseSession | null
): Promise<SupabaseSession | null> {
  if (!session) return null;
  if (session.expiresAt - REFRESH_MARGIN_MS > Date.now()) return session;
  if (!session.refreshToken) return null;

  try {
    const response = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refreshToken },
    });
    if (!response.ok) return null;
    return sessionFromPayload((await response.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}
