// LES ÉLITES — contact messages and manuscript submissions.
//
// POST /api/submit  (JSON, ≤ 32 KB)
//   { kind: "contact", name, email, country?, subject?, message, consent, website }
//   { kind: "manuscript", name, email, phone?, country, title, genre, language,
//     summary, length?, message?, consent, website, file: { name, size, type } }
//   { kind: "manuscript-done", ref, claim }
//
// Why manuscripts take two calls: a synchronous Netlify function accepts a
// ~6 MB body, a manuscript can be 20 MB. So this function never touches the
// file. It validates the form, stores the row, and returns a single-use signed
// upload URL for ONE private object path; the browser PUTs the file straight
// to Supabase Storage; the second call proves the object exists (with a claim
// secret only that browser holds) before the submission becomes REÇU.
// The browser never holds a Supabase key. The bucket is private, with a size
// cap and a MIME allow-list enforced by Storage itself (see the migration).
//
// Degrades to 501 when Supabase is not configured — the form then tells the
// visitor plainly that it is not switched on, instead of pretending.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_BODY = 32 * 1024;
const MAX_FILE = 20 * 1024 * 1024;
const FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
};
const BUCKET = "manuscripts";
const PER_HOUR = 5; // submissions per IP hash per hour, per kind

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const env = (k) => process.env[k] || "";
const configured = () => Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_KEY"));
const sb = () => env("SUPABASE_URL").replace(/\/+$/, "");
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");

async function supa(path, { method = "GET", body, prefer, raw } = {}) {
  const key = env("SUPABASE_SERVICE_KEY");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(sb() + path, {
      method,
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(prefer ? { prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    if (raw) return { ok: res.ok, status: res.status, text };
    if (!res.ok) {
      console.error("supabase", method, path.split("?")[0], res.status, text.slice(0, 200));
      throw new Error("supabase " + res.status);
    }
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- validation ----------
const str = (v, max, req = false) => {
  const s = typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : "";
  if (req && !s) return { err: "required" };
  if (s.length > max) return { err: "too_long" };
  return { v: s || null };
};
const EMAIL = /^[^\s@<>()[\],;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

function validate(input, spec) {
  const out = {}, errors = {};
  for (const [k, [max, req]] of Object.entries(spec)) {
    const r = str(input[k], max, req);
    if (r.err) errors[k] = r.err; else out[k] = r.v;
  }
  if (out.email && !EMAIL.test(out.email)) errors.email = "invalid";
  if (input.consent !== true) errors.consent = "required";
  return { out, errors };
}

function allowedOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin navigations in some browsers omit it
  const allow = (env("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const host = new URL(origin).host;
    return host === req.headers.get("host") || allow.includes(origin);
  } catch { return false; }
}

const ipHash = (req) => sha((req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0] + env("IP_SALT"));

async function rateLimited(table, ip) {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const rows = await supa(`/rest/v1/${table}?select=id&ip_hash=eq.${ip}&created_at=gte.${since}&limit=${PER_HOUR + 1}`);
  return rows.length >= PER_HOUR;
}

function makeRef(prefix) {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${prefix}-${d}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function notify(subject, text) {
  // Optional e-mail to the team via Resend. Without a key the row is still
  // stored and visible in Supabase; nothing is lost.
  if (!env("RESEND_API_KEY") || !env("NOTIFY_TO") || !env("NOTIFY_FROM")) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env("NOTIFY_FROM"), to: env("NOTIFY_TO").split(","), subject, text }),
    });
  } catch (e) { console.error("notify failed", e.message); }
}

// ---------- handlers ----------
async function contact(body, ip) {
  const { out, errors } = validate(body, { name: [120, true], email: [200, true], country: [80], subject: [200], message: [4000, true] });
  if (Object.keys(errors).length) return json(422, { error: "invalid", fields: errors });
  if (await rateLimited("contact_messages", ip)) return json(429, { error: "rate_limited" });
  const ref = makeRef("MSG");
  await supa("/rest/v1/contact_messages", { method: "POST", prefer: "return=minimal", body: { ref, ...out, ip_hash: ip } });
  await notify(`[Les Élites] Message ${ref} — ${out.subject || out.name}`, `${out.name} <${out.email}> (${out.country || "—"})\n\n${out.message}`);
  return json(200, { ok: true, ref });
}

async function manuscript(body, ip) {
  const { out, errors } = validate(body, {
    name: [120, true], email: [200, true], phone: [40], country: [80, true], title: [200, true],
    genre: [80, true], language: [60, true], summary: [3000, true], length: [60], message: [3000],
  });
  const f = body.file || {};
  const ext = String(f.name || "").toLowerCase().split(".").pop();
  if (!FILE_TYPES[ext]) errors.file = "type";
  else if (!Number.isInteger(f.size) || f.size <= 0 || f.size > MAX_FILE) errors.file = "size";
  if (Object.keys(errors).length) return json(422, { error: "invalid", fields: errors });
  if (await rateLimited("manuscript_submissions", ip)) return json(429, { error: "rate_limited" });

  const ref = makeRef("MS");
  const claim = randomBytes(24).toString("base64url");
  // Path is ours, never the visitor's filename: no traversal, no collisions.
  const path = `${new Date().toISOString().slice(0, 7)}/${ref}.${ext}`;
  const sign = await supa(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: "POST", body: {} });
  if (!sign || !sign.url) throw new Error("no signed url");

  await supa("/rest/v1/manuscript_submissions", {
    method: "POST", prefer: "return=minimal",
    body: {
      ref, status: "pending_upload", ...out, file_path: path, file_name: String(f.name).slice(0, 200),
      file_size: f.size, file_type: FILE_TYPES[ext], claim_hash: sha(claim), ip_hash: ip,
    },
  });
  return json(200, { ok: true, ref, claim, upload: { url: sb() + "/storage/v1" + sign.url, type: FILE_TYPES[ext] } });
}

async function manuscriptDone(body) {
  const ref = typeof body.ref === "string" && /^MS-\d{6}-[0-9A-F]{6}$/.test(body.ref) ? body.ref : null;
  const claim = typeof body.claim === "string" ? body.claim : "";
  if (!ref || !claim) return json(400, { error: "invalid" });
  const rows = await supa(`/rest/v1/manuscript_submissions?ref=eq.${ref}&select=id,status,claim_hash,file_path,name,email,title,language,country&limit=1`);
  const row = rows[0];
  const a = Buffer.from(sha(claim)), b = Buffer.from(row ? row.claim_hash : "0".repeat(64));
  if (!row || a.length !== b.length || !timingSafeEqual(a, b)) return json(404, { error: "not_found" });
  if (row.status !== "pending_upload") return json(200, { ok: true, ref, status: row.status });

  // The object must really be there (the signed URL may have been abandoned).
  const dir = row.file_path.split("/")[0], file = row.file_path.split("/")[1];
  const listed = await supa(`/storage/v1/object/list/${BUCKET}`, { method: "POST", body: { prefix: dir + "/", search: file, limit: 1 } });
  if (!Array.isArray(listed) || !listed.some((o) => o.name === file)) return json(409, { error: "file_missing" });

  await supa(`/rest/v1/manuscript_submissions?id=eq.${row.id}`, { method: "PATCH", prefer: "return=minimal", body: { status: "received", claim_hash: null, received_at: new Date().toISOString() } });
  await supa("/rest/v1/submission_events", { method: "POST", prefer: "return=minimal", body: { submission_id: row.id, status: "received", actor: "system" } });
  await notify(`[Les Élites] Manuscrit ${ref} — ${row.title}`, `${row.name} <${row.email}> (${row.country})\n${row.title} — ${row.language}\nFichier : ${BUCKET}/${row.file_path}`);
  return json(200, { ok: true, ref, status: "received" });
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  if (!allowedOrigin(req)) return json(403, { error: "origin" });
  if (!configured()) return json(501, { error: "not_configured" });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json(413, { error: "too_large" });
  let body;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return json(413, { error: "too_large" });
    body = JSON.parse(text);
  } catch { return json(400, { error: "bad_json" }); }
  if (!body || typeof body !== "object") return json(400, { error: "bad_json" });
  // Honeypot: bots fill every field. Answer like a success, store nothing.
  if (body.website) return json(200, { ok: true, ref: makeRef(body.kind === "contact" ? "MSG" : "MS") });

  try {
    const ip = ipHash(req);
    if (body.kind === "contact") return await contact(body, ip);
    if (body.kind === "manuscript") return await manuscript(body, ip);
    if (body.kind === "manuscript-done") return await manuscriptDone(body);
    return json(400, { error: "kind" });
  } catch (e) {
    console.error("submit failed", e.message);
    return json(502, { error: "upstream" });
  }
};

export const config = { path: "/api/submit" };
