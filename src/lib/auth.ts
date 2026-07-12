import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Auth pilote — sessions par cookie HMAC signé, sans dépendance externe.
 * Deux rôles : ADMIN (Estevao, via ADMIN_ACCESS_TOKEN) et CLIENT (cabinet,
 * via son dashboardToken). À remplacer par NextAuth/Supabase Auth quand le
 * multi-utilisateurs par cabinet deviendra nécessaire (décision documentée).
 */

const COOKIE_NAME = "mwinda_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 jours

export interface Session {
  role: "admin" | "client";
  organizationId?: string;
  exp: number;
}

function getSecret(): string | null {
  return process.env.AUTH_SECRET ?? null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function createSession(
  session: Omit<Session, "exp">,
): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const full: Session = { ...session, exp: Date.now() + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  const token = `${payload}.${sign(payload, secret)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return true;
}

export async function getSession(): Promise<Session | null> {
  const secret = getSecret();
  if (!secret) return null;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Session;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Compare un code fourni au token admin, en temps constant. */
export function isAdminCode(code: string): boolean {
  const admin = process.env.ADMIN_ACCESS_TOKEN;
  if (!admin) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(admin);
  return a.length === b.length && timingSafeEqual(a, b);
}
