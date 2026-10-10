// STEPHANE & SYNTICHE — shared server primitives.
//
// Adapted from the MWINDA site's _security.mjs / _db.mjs, the same rules:
//   * every request: origin check + bounded JSON + a per-IP sliding window;
//   * every key-gated path: lockout BEFORE the compare, audit on success too;
//   * the service_role key never leaves the server; the browser holds no
//     Supabase credential;
//   * guest data is never returned to anyone but the holder of that guest's
//     signed link, or an admin.
// The wedding site is deployed as its own Netlify site, so these are copied
// rather than imported across the repo: one less way for a change to the
// company site to break a wedding.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import DEFAULTS from "../../content.json" with { type: "json" };

// ------------------------------------------------------------------ http --
export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });

export function clientIp(req) {
  return req.headers.get("x-nf-client-connection-ip") || "unknown";
}

export class SlidingWindow {
  constructor({ windowMs, max, maxKeys = 2000 }) {
    Object.assign(this, { windowMs, max, maxKeys });
    this.hits = new Map();
  }
  check(key = "unknown") {
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return Math.max(1, Math.ceil((this.windowMs - (now - recent[0])) / 1000));
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      let n = 0;
      for (const k of this.hits.keys()) { if (n++ >= this.maxKeys / 10) break; this.hits.delete(k); }
    }
    return 0;
  }
}

export function originRejected(req) {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let host;
  try { host = new URL(origin).host; } catch { return true; }
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")).filter(Boolean);
  const allowed = new Set(configured);
  if (!configured.length) { try { allowed.add(new URL(req.url).host); } catch { /* absolute on Netlify */ } }
  return !allowed.has(host);
}

export async function readJson(req, maxBytes) {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return { tooLarge: true };
  try { return { value: JSON.parse(raw || "{}") }; } catch { return { invalid: true }; }
}

export function audit(event, fields = {}) {
  const { ip, ...rest } = fields;
  const actor = ip === undefined ? undefined
    : ip === "unknown" ? "unknown"
    : createHash("sha256").update(ip).digest("hex").slice(0, 12);
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, actor, ...rest }));
}

// ------------------------------------------------------------------ keys --
// Two roles. ADMIN_KEY: the couple and named organisers — everything.
// STAFF_KEY: door staff on the day — check-in lookups only, no guest list.
function keyUsable(key) {
  return typeof key === "string" && key.length >= 16 && new Set(key).size >= 8;
}

function secretMatches(candidate, expected) {
  if (typeof candidate !== "string" || !candidate || typeof expected !== "string") return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

const FAILS = new Map();
const AUTH = { maxFails: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

/**
 * Resolve the caller's role from a presented key, with lockout.
 * Returns { role: "admin" | "staff" } or { response } to send back as-is.
 */
export function authorize(req, key, scope) {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = FAILS.get(ip);
  if (rec?.until > now) {
    audit(`${scope}.auth_locked_out`, { ip });
    return { response: json(429, { error: "too_many_attempts" }, { "retry-after": String(Math.ceil((rec.until - now) / 1000)) }) };
  }
  let role = null;
  if (keyUsable(process.env.ADMIN_KEY) && secretMatches(key, process.env.ADMIN_KEY)) role = "admin";
  else if (keyUsable(process.env.STAFF_KEY) && secretMatches(key, process.env.STAFF_KEY)) role = "staff";
  if (!role) {
    const r = rec && now - r0(rec) < AUTH.windowMs ? rec : { count: 0, first: now, until: 0 };
    r.count += 1;
    if (r.count >= AUTH.maxFails) r.until = now + AUTH.lockoutMs;
    FAILS.set(ip, r);
    audit(`${scope}.auth_denied`, { ip });
    return { response: json(403, { error: "forbidden" }) };
  }
  FAILS.delete(ip);
  return { role };
}
const r0 = (rec) => rec.first || 0;

// ---------------------------------------------------------- invite codes --
// CODE: 8 chars from an alphabet without look-alikes (printable on cards,
// readable over the phone). SIG: HMAC(INVITE_SECRET, CODE), 12 base64url
// chars = 72 bits. Rotating INVITE_SECRET invalidates every link at once.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const newCode = () =>
  Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

export const inviteSecretUsable = () => keyUsable(process.env.INVITE_SECRET);

export function signCode(code) {
  return createHmac("sha256", process.env.INVITE_SECRET).update(code).digest("base64url").slice(0, 12);
}

/** "CODE.SIG" → CODE when the signature is valid, else null. */
export function verifyInvite(token) {
  if (typeof token !== "string" || !inviteSecretUsable()) return null;
  const m = /^([A-Z2-9]{8})\.([A-Za-z0-9_-]{12})$/.exec(token.trim());
  if (!m) return null;
  const a = Buffer.from(signCode(m[1]));
  const b = Buffer.from(m[2]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[1] : null;
}

export const inviteToken = (code) => `${code}.${signCode(code)}`;

// -------------------------------------------------------------------- db --
const TIMEOUT_MS = 8000;

export const dbConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const supa = () => String(process.env.SUPABASE_URL).replace(/\/+$/, "");

async function request(path, { method = "GET", body, prefer, raw, contentType } = {}) {
  if (!dbConfigured()) throw new Error("supabase not configured");
  const key = process.env.SUPABASE_SERVICE_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(supa() + path, {
      method,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": contentType || "application/json",
        ...(prefer ? { prefer } : {}),
      },
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("supabase error", res.status, text.slice(0, 300));
      const err = new Error("supabase request failed: " + res.status);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

const rest = (p) => "/rest/v1" + p;
export const db = {
  select: (table, query = "") => request(rest(`/${table}?${query}`)),
  insert: (table, row) => request(rest(`/${table}`), { method: "POST", body: row, prefer: "return=representation" }),
  upsert: (table, row) => request(rest(`/${table}`), { method: "POST", body: row, prefer: "return=representation,resolution=merge-duplicates" }),
  update: (table, query, patch) => request(rest(`/${table}?${query}`), { method: "PATCH", body: patch, prefer: "return=representation" }),
  remove: (table, query) => request(rest(`/${table}?${query}`), { method: "DELETE", prefer: "return=minimal" }),
  upload: (bucket, name, bytes, type) =>
    request(`/storage/v1/object/${bucket}/${name}`, { method: "POST", raw: bytes, contentType: type, prefer: undefined }),
  publicUrl: (bucket, name) => `${supa()}/storage/v1/object/public/${bucket}/${name}`,
};

export const isUuid = (v) =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const clamp = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// --------------------------------------------------------------- content --
export const defaults = () => structuredClone(DEFAULTS);

/** Deep merge: objects merge key by key; arrays and scalars replace. */
export function merge(base, over) {
  if (over === undefined) return base;
  if (Array.isArray(base) || Array.isArray(over) || typeof base !== "object" || typeof over !== "object" || !base || !over) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}

export async function loadContent() {
  const base = defaults();
  if (!dbConfigured()) return base;
  try {
    const rows = await db.select("wed_settings", "key=eq.content&select=value");
    return merge(base, rows?.[0]?.value || {});
  } catch {
    return base; // content must never take the site down
  }
}

/** The instant the ceremony starts, as a UTC Date, given local date/time and zone. */
export function zonedToUtc(date, time, tz) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
  );
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asLocal - guess));
}

/** RSVPs close at the end of the deadline day, in the wedding's time zone. */
export function rsvpClosed(content, now = Date.now()) {
  const dl = content?.rsvp?.deadline;
  if (!dl || !/^\d{4}-\d{2}-\d{2}$/.test(dl)) return false;
  return now > zonedToUtc(dl, "23:59", content.timezone || "America/Los_Angeles").getTime() + 59_000;
}
