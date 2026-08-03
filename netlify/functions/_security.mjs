// MWINDA DIGITAL — shared security primitives for the serverless functions.
//
// Design notes:
// - Secrets never leave Netlify env vars. Nothing here logs a secret or a
//   candidate secret, not even truncated.
// - Rate/auth state is per warm instance. Netlify may run several instances,
//   so these are brakes that make automated abuse slow and noisy, not hard
//   guarantees. The hard guarantee is the Anthropic monthly spend cap.
import { createHash, timingSafeEqual } from "node:crypto";

/** JSON response with no-store and nosniff by default. */
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

/**
 * Constant-time secret comparison.
 * Hashing first means the comparison is always over 32 bytes, so neither the
 * result nor the timing reveals the expected secret's length.
 */
export function secretMatches(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  if (candidate.length === 0 || expected.length === 0) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Refuse to run privileged mode behind a weak key. A short or low-entropy
 * FOUNDER_KEY is worse than no key at all, because it looks like security.
 */
export function founderKeyUsable() {
  const key = process.env.FOUNDER_KEY;
  if (typeof key !== "string" || key.length < 16) return false;
  return new Set(key).size >= 8; // reject "aaaaaaaaaaaaaaaa"-style keys
}

/**
 * Client IP as established by Netlify's edge.
 *
 * Deliberately does NOT fall back to x-forwarded-for or client-ip: those are
 * client-settable, so a fallback would let an attacker mint a fresh identity
 * per request and walk straight through every per-IP control. When the edge
 * header is missing, all such requests share one "unknown" bucket — they get
 * throttled together rather than not at all.
 */
export function clientIp(req) {
  return req.headers.get("x-nf-client-connection-ip") || "unknown";
}

/** Sliding-window limiter. Buckets are namespaced so surfaces can't drain each other. */
export class SlidingWindow {
  constructor({ windowMs, max, maxKeys = 2000 }) {
    this.windowMs = windowMs;
    this.max = max;
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  /** Returns seconds to wait if over the limit, or 0 when the call is allowed. */
  check(key) {
    if (!key) key = "unknown"; // never fail open on a missing IP
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      const retryMs = this.windowMs - (now - recent[0]);
      this.hits.set(key, recent);
      return Math.max(1, Math.ceil(retryMs / 1000));
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.#evictOldest();
    return 0;
  }

  // Bound memory without ever wiping the whole table: a wholesale clear() is
  // an attack primitive — flood with distinct keys and every active limit
  // resets. Map iterates in insertion order, so the head is the oldest.
  #evictOldest() {
    const drop = Math.ceil(this.maxKeys * 0.1);
    let n = 0;
    for (const key of this.hits.keys()) {
      if (n++ >= drop) break;
      this.hits.delete(key);
    }
  }
}

/**
 * Failed-authentication throttle with a lockout.
 * Guessing a 96-bit key is infeasible; this exists to make credential-stuffing
 * and scripted probing expensive, and to bound the log noise they generate.
 */
const FAILS = new Map(); // ip -> { count, until }
const AUTH = { maxFails: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

export function authLockedOut(ip) {
  const rec = FAILS.get(ip || "unknown");
  if (!rec) return 0;
  const now = Date.now();
  if (rec.until && rec.until > now) return Math.ceil((rec.until - now) / 1000);
  if (rec.until && rec.until <= now) FAILS.delete(ip || "unknown");
  return 0;
}

export function recordAuthFailure(ip) {
  const k = ip || "unknown";
  const now = Date.now();
  const rec = FAILS.get(k) || { count: 0, first: now, until: 0 };
  if (now - rec.first > AUTH.windowMs) {
    rec.count = 0;
    rec.first = now;
  }
  rec.count += 1;
  if (rec.count >= AUTH.maxFails) rec.until = now + AUTH.lockoutMs;
  FAILS.set(k, rec);

  // Evict only entries whose lockout has expired. Never clear() — otherwise
  // flooding the table with fresh IPs releases the attacker's own lockout.
  if (FAILS.size > 2000) {
    for (const [key, r] of FAILS) {
      if (!r.until || r.until <= now) FAILS.delete(key);
      if (FAILS.size <= 1500) break;
    }
  }
}

export function recordAuthSuccess(ip) {
  FAILS.delete(ip || "unknown");
}

/**
 * Same-origin enforcement.
 *
 * Browsers send `Origin` on every POST, same-origin included, so requiring it
 * costs the real frontend nothing while blocking naive scripted abuse and any
 * cross-site page trying to spend the API budget. Determined attackers can
 * still forge headers — this raises cost, it is not an authentication control.
 * Set ALLOWED_ORIGINS (comma-separated) when adding a custom domain.
 */
export function originRejected(req) {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;
  if (!origin) return true;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  // Allowlist comes from configuration, never from request headers: deriving
  // it from x-forwarded-host / host lets a caller satisfy the check with its
  // own forged pair. Falls back to the runtime's own URL host so the site
  // works before ALLOWED_ORIGINS is set; set it once a custom domain exists.
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
    .filter(Boolean);
  const allowed = new Set(configured);
  if (!configured.length) {
    try {
      allowed.add(new URL(req.url).host);
    } catch { /* req.url is absolute on Netlify; stay defensive */ }
  }

  return !allowed.has(originHost);
}

/** Reject oversized bodies before parsing them into memory. */
export function bodyTooLarge(req, maxBytes) {
  const len = Number(req.headers.get("content-length") || 0);
  return Number.isFinite(len) && len > maxBytes;
}

/** Read a JSON body with a hard byte ceiling, even when content-length lies. */
export async function readJson(req, maxBytes) {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return { tooLarge: true };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { invalid: true };
  }
}

/** One-line structured audit event. Never include secrets or message content. */
export function audit(event, fields = {}) {
  const { ip, ...rest } = fields;
  // Pseudonymous but stable: correlates an attacker's requests across log
  // lines without writing raw addresses. "unknown" stays visible as itself so
  // unattributable traffic is obvious rather than silently unlabelled.
  const actor = ip === undefined ? undefined
    : ip === "unknown" ? "unknown"
    : createHash("sha256").update(ip).digest("hex").slice(0, 12);
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, actor, ...rest }));
}
