#!/usr/bin/env node
// Local server for the wedding site: static files + the REAL Netlify
// functions, backed by an in-memory fake of Supabase (PostgREST + Storage).
//
//   node scripts/dev-server.mjs            # http://localhost:8787
//   PORT=9000 node scripts/dev-server.mjs
//
// Dev keys (printed on start) are fixed so tests can use them. Never reuse
// them in production — production keys live only in Netlify env vars.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8787);
const FAKE_PORT = PORT + 1;

// ------------------------------------------------------------ fake Supabase
const DEFAULTS = {
  wed_invitations: () => ({ kind: "individual", party: [], max_guests: 1, lang: "fr", rsvp_status: "pending", rsvp_seats: 0, rsvp_attendees: [], checked_in_count: 0, checked_in_at: null, sent_at: null, opened_at: null, table_id: null, rsvp_at: null, rsvp_message: null }),
  wed_guestbook: () => ({ approved: false, invitation_id: null }),
  wed_tables: () => ({ capacity: 8, sort: 0 }),
  wed_settings: () => ({ value: {} }),
};
const PK = { wed_settings: "key" };
export const tables = { wed_invitations: [], wed_guestbook: [], wed_tables: [], wed_settings: [] };
export const storage = new Map();

function parseValue(v) {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}
function filters(params) {
  const out = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit"].includes(k)) continue;
    const m = /^(eq|in|is)\.(.*)$/.exec(v);
    if (!m) throw new Error("unsupported filter " + k + "=" + v);
    if (m[1] === "in") { const set = m[2].replace(/^\(|\)$/g, "").split(","); out.push((r) => set.includes(String(r[k]))); }
    else if (m[1] === "is") out.push((r) => (r[k] ?? null) === parseValue(m[2]));
    else out.push((r) => String(r[k]) === m[2]);
  }
  return (r) => out.every((f) => f(r));
}
function project(rows, params) {
  let out = [...rows];
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((o) => o.split("."));
    out.sort((a, b) => {
      for (const [k, dir] of keys) { const c = String(a[k] ?? "").localeCompare(String(b[k] ?? "")); if (c) return dir === "desc" ? -c : c; }
      return 0;
    });
  }
  if (params.get("limit")) out = out.slice(0, Number(params.get("limit")));
  const sel = params.get("select");
  if (sel && sel !== "*") out = out.map((r) => Object.fromEntries(sel.split(",").map((c) => [c, r[c] ?? null])));
  return structuredClone(out);
}

function fakeSupabase(req, res, body) {
  const url = new URL(req.url, "http://x");
  const send = (s, v) => { res.writeHead(s, { "content-type": "application/json" }); res.end(v === undefined ? "" : JSON.stringify(v)); };
  if (req.headers.apikey !== "fake-service-key") return send(401, { message: "bad key" });

  if (url.pathname.startsWith("/storage/v1/object/")) {
    storage.set(url.pathname.replace("/storage/v1/object/", ""), body);
    return send(200, { Key: url.pathname });
  }
  const table = url.pathname.replace("/rest/v1/", "");
  const rows = tables[table];
  if (!rows) return send(404, { message: "no table " + table });
  const match = filters(url.searchParams);

  if (req.method === "GET") return send(200, project(rows.filter(match), url.searchParams));
  if (req.method === "POST") {
    const input = JSON.parse(body.toString() || "null");
    const list = Array.isArray(input) ? input : [input];
    const pk = PK[table] || "id";
    const upsert = /merge-duplicates/.test(req.headers.prefer || "");
    const out = [];
    for (const r of list) {
      if (table === "wed_invitations" && rows.some((x) => x.code === r.code)) return send(409, { message: "duplicate code" });
      const existing = upsert && rows.find((x) => x[pk] === r[pk]);
      if (existing) { Object.assign(existing, r); out.push(existing); continue; }
      const row = { ...(DEFAULTS[table]?.() || {}), id: randomUUID(), created_at: new Date().toISOString(), ...r };
      rows.push(row); out.push(row);
    }
    return send(201, structuredClone(out));
  }
  if (req.method === "PATCH") {
    const patch = JSON.parse(body.toString());
    const hit = rows.filter(match);
    hit.forEach((r) => Object.assign(r, patch));
    return send(200, structuredClone(hit));
  }
  if (req.method === "DELETE") {
    for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1);
    return send(204);
  }
  send(405, {});
}

// ---------------------------------------------------------------- env ----
Object.assign(process.env, {
  SUPABASE_URL: `http://127.0.0.1:${FAKE_PORT}`,
  SUPABASE_SERVICE_KEY: "fake-service-key",
  ADMIN_KEY: process.env.ADMIN_KEY || "dev-admin-key-Stephane-Syntiche",
  STAFF_KEY: process.env.STAFF_KEY || "dev-staff-key-door-2027",
  INVITE_SECRET: process.env.INVITE_SECRET || "dev-invite-secret-not-for-prod",
  ALLOWED_ORIGINS: `localhost:${PORT},127.0.0.1:${PORT}`,
  SITE_URL: `http://localhost:${PORT}`,
});

// ------------------------------------------------------------- server ----
const FUNCTIONS = { "/api/content": "content", "/api/invite": "invite", "/api/guestbook": "guestbook", "/api/admin": "admin", "/api/checkin": "checkin" };
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".txt": "text/plain" };
const PRIVATE = /^\/(netlify|supabase|docs|scripts)\//;

const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });

export async function start() {
  const fake = createServer(async (req, res) => fakeSupabase(req, res, await readBody(req)));
  await new Promise((ok) => fake.listen(FAKE_PORT, "127.0.0.1", ok));

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const fn = FUNCTIONS[url.pathname];
    if (fn) {
      const mod = await import(pathToFileURL(join(ROOT, "netlify/functions", fn + ".mjs")).href);
      const body = await readBody(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(",") : v);
      headers.set("x-nf-client-connection-ip", req.socket.remoteAddress || "127.0.0.1");
      const r = await mod.default(new Request(url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let path = decodeURIComponent(url.pathname);
    if (PRIVATE.test(path)) { res.writeHead(404); return res.end("not found"); }
    if (path === "/") path = "/index.html";
    if (path === "/admin") path = "/admin.html";
    if (path === "/checkin") path = "/checkin.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    try {
      if (!(await stat(file)).isFile()) throw 0;
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  await new Promise((ok) => server.listen(PORT, ok));
  return { server, fake, url: `http://localhost:${PORT}` };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await start();
  console.log(`Wedding site: ${url}\nDashboard:    ${url}/admin   key: ${process.env.ADMIN_KEY}\nDoor app:     ${url}/checkin key: ${process.env.STAFF_KEY}`);
}
