// MWINDA DIGITAL — Supabase access layer.
//
// Talks to Supabase over PostgREST with plain fetch: no SDK, no extra bundle
// weight, and one obvious place where every credential and query lives.
//
// Two rules this module exists to enforce:
//   1. The service_role key never leaves the server. The browser has no
//      Supabase credential at all — it calls our functions, our functions
//      call Supabase.
//   2. Persistence is optional. If SUPABASE_URL / SUPABASE_SERVICE_KEY are
//      unset, `configured()` is false and every caller falls back to the
//      previous local-only behaviour. Adding a database must never be able to
//      take the site down.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TIMEOUT_MS = 8000;

export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function baseUrl() {
  return String(process.env.SUPABASE_URL).replace(/\/+$/, "") + "/rest/v1";
}

function headers(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...extra,
  };
}

/** Low-level request. Throws on non-2xx so callers can decide how to degrade. */
async function request(path, { method = "GET", body, prefer } = {}) {
  if (!configured()) throw new Error("supabase not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(baseUrl() + path, {
      method,
      headers: headers(prefer ? { prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      // Never echo the response body to the client: it can contain schema
      // details. Log it, return a generic failure.
      console.error("supabase error", res.status, text.slice(0, 300));
      throw new Error("supabase request failed: " + res.status);
    }
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

export const select = (table, query = "") => request(`/${table}?${query}`);

export const insert = (table, row) =>
  request(`/${table}`, { method: "POST", body: row, prefer: "return=representation" });

export const update = (table, query, patch) =>
  request(`/${table}?${query}`, { method: "PATCH", body: patch, prefer: "return=representation" });

/** Fire-and-forget analytics: a failed event must never break a user action. */
export async function logEvent(event, projectId = null, meta = {}) {
  if (!configured()) return;
  try {
    await insert("events", { event, project_id: projectId, meta });
  } catch { /* analytics is best-effort by design */ }
}

// ------------------------------------------------------- project ownership --
// Without user accounts, a project belongs to whoever holds its unguessable id
// AND its secret token. Only the token's SHA-256 is stored, so a database dump
// does not by itself grant API access to anyone's business plan.

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(String(token), "utf8").digest("hex");

export function tokenMatches(token, storedHash) {
  if (typeof token !== "string" || typeof storedHash !== "string") return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cheap shape check — PostgREST rejects bad uuids, but fail fast and cheaply. */
export const isUuid = (v) =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
