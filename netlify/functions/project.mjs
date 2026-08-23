// MWINDA DIGITAL — AI Business Intelligence project persistence.
//
// Business plans are confidential, and this MVP has no user accounts. A
// project is therefore owned by whoever holds its unguessable uuid AND a
// 32-byte secret token issued at creation. The server stores only the token's
// hash, and returns a project only when both match.
//
// If Supabase is not configured, every action returns 501 and the browser
// keeps working exactly as before, on localStorage alone.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit,
  secretMatches, founderKeyUsable,
  authLockedOut, recordAuthFailure, recordAuthSuccess,
} from "./_security.mjs";
import {
  configured, select, insert, update, logEvent,
  newToken, hashToken, tokenMatches, isUuid,
} from "./_db.mjs";

const MAX_BODY_BYTES = 512 * 1024;   // a finished dossier is ~40-80 KB of JSON
const RATE = new SlidingWindow({ windowMs: 60_000, max: 40 });
// Events carry no ownership proof, so they get their own tighter bucket —
// otherwise anyone could inflate the analytics table for free.
const EVENT_RATE = new SlidingWindow({ windowMs: 60_000, max: 12 });
// `create` happens once per project; `save` happens every couple of seconds.
// Sharing one bucket let a single IP mint ~20 MB/min of unauthenticated rows,
// enough to fill the free tier in under half an hour.
const CREATE_RATE = new SlidingWindow({ windowMs: 60_000, max: 6 });
// Ceiling per jsonb column. A finished dossier is 40-80 KB across all of them.
const MAX_JSON_FIELD = 96 * 1024;

const COLUMNS = [
  "intent", "country", "region", "city", "sector", "business_type", "budget",
  "idea", "answers", "stages", "tasks_done", "checked", "progress",
];

/** Map the client's project shape onto table columns, dropping anything else. */
function toRow(p = {}) {
  const clamp = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
  // jsonb columns were passed through on a bare typeof check, so a caller
  // could store megabytes per row. Oversized fields are dropped, not
  // truncated: half a JSON blob is worse than none.
  const jsonb = (v) => {
    if (!v || typeof v !== "object") return {};
    try {
      return JSON.stringify(v).length > MAX_JSON_FIELD ? {} : v;
    } catch { return {}; }
  };
  return {
    intent: clamp(p.intent, 80),
    country: clamp(p.country, 80),
    region: clamp(p.region, 80),
    city: clamp(p.city, 80),
    sector: clamp(p.sector, 80),
    business_type: clamp(p.businessType, 80),
    budget: clamp(p.budget, 60),
    idea: clamp(p.idea, 4000),
    answers: jsonb(p.answers),
    stages: jsonb(p.stages),
    tasks_done: jsonb(p.tasksDone),
    checked: jsonb(p.checked),
    progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
  };
}

/** Map a row back to the client's shape. */
function toProject(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    intent: row.intent || "", country: row.country || "", region: row.region || "",
    city: row.city || "", sector: row.sector || "", businessType: row.business_type || "",
    budget: row.budget || "", idea: row.idea || "",
    answers: row.answers || {}, stages: row.stages || {},
    tasksDone: row.tasks_done || {}, checked: row.checked || {},
    progress: row.progress || 0,
  };
}

async function fetchOwned(id, token) {
  if (!isUuid(id) || typeof token !== "string" || !token) return null;
  const rows = await select("projects", `id=eq.${encodeURIComponent(id)}&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !tokenMatches(token, row.token_hash)) return null;
  return row;
}

export default async (req) => {
  const ip = clientIp(req);

  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (originRejected(req)) {
    audit("project.origin_rejected", { ip });
    return json(403, { error: "forbidden" });
  }
  if (!configured()) {
    // Not an error: the site is designed to run without a database.
    return json(501, { error: "storage not configured", storage: "local" });
  }

  const wait = RATE.check(ip);
  if (wait) return json(429, { error: "too many requests" }, { "retry-after": String(wait) });

  const parsed = await readJson(req, MAX_BODY_BYTES);
  if (parsed.tooLarge) return json(413, { error: "project too large" });
  if (parsed.invalid) return json(400, { error: "invalid JSON body" });
  const { action, id, token, project } = parsed.value || {};

  try {
    switch (action) {
      case "create": {
        const createWait = CREATE_RATE.check(ip);
        if (createWait) {
          audit("project.create_rate_limited", { ip });
          return json(429, { error: "too many new projects" }, { "retry-after": String(createWait) });
        }
        const fresh = newToken();
        const rows = await insert("projects", { ...toRow(project), token_hash: hashToken(fresh) });
        const row = Array.isArray(rows) ? rows[0] : rows;
        await logEvent("project_created", row.id, { country: row.country, sector: row.sector });
        audit("project.created", { ip });
        // The token is returned exactly once. It is the only key to this row.
        return json(200, { id: row.id, token: fresh, updatedAt: row.updated_at });
      }

      case "save": {
        const row = await fetchOwned(id, token);
        if (!row) return json(403, { error: "unknown project or token" });
        const patch = toRow(project);
        const saved = await update("projects", `id=eq.${encodeURIComponent(id)}`, patch);
        const out = Array.isArray(saved) ? saved[0] : saved;
        audit("project.saved", { ip });
        if (patch.progress >= 100 && (row.progress || 0) < 100) {
          await logEvent("project_completed", id, {});
        }
        return json(200, { id, updatedAt: out?.updated_at });
      }

      case "load": {
        const row = await fetchOwned(id, token);
        if (!row) return json(403, { error: "unknown project or token" });
        // A dossier read is worth a log line: without it, anyone holding a
        // shared link reads confidential plans leaving no trace at all.
        audit("project.loaded", { ip });
        return json(200, { project: toProject(row) });
      }

      case "event": {
        // Product KPI signal. Accepted without ownership proof because it
        // carries no personal data and no project content — but that also
        // makes it the cheapest thing to flood, so it is capped separately
        // and restricted to the event names the client actually emits.
        if (EVENT_RATE.check(ip)) return json(429, { error: "too many events" });
        const ALLOWED = new Set(["dossier_exported", "stage_generated", "project_opened"]);
        const name = typeof parsed.value.event === "string" ? parsed.value.event : "";
        if (!ALLOWED.has(name)) return json(400, { error: "unknown event" });
        // Attach the project only on proof of ownership. The client already
        // holds the token, so this costs it nothing — but it stops anyone
        // fabricating rows against a real project and skewing the KPI board.
        let linked = null;
        if (isUuid(id) && typeof token === "string" && token) {
          linked = (await fetchOwned(id, token)) ? id : null;
        }
        await logEvent(name, linked, {});
        return json(200, { ok: true });
      }

      case "stats": {
        // Founder-only: the MVP KPI board. Throttled like every other
        // founder-gated surface, so the key cannot be probed here.
        const lock = authLockedOut(ip);
        if (lock) {
          audit("project.auth_locked_out", { ip });
          return json(429, { error: "too many attempts — try again later" }, { "retry-after": String(lock) });
        }
        if (!founderKeyUsable() || !secretMatches(parsed.value.key, process.env.FOUNDER_KEY)) {
          recordAuthFailure(ip);
          audit("project.stats_denied", { ip });
          return json(403, { error: "forbidden" });
        }
        recordAuthSuccess(ip);
        const rows = await select("kpi_overview", "limit=1");
        audit("project.stats_ok", { ip });
        return json(200, { stats: Array.isArray(rows) ? rows[0] : rows });
      }

      default:
        return json(400, { error: "unknown action" });
    }
  } catch (error) {
    console.error("project function error", error?.message);
    audit("project.failed", { ip, action: String(action).slice(0, 20) });
    // Degrade rather than fail: the client keeps its local copy.
    return json(503, { error: "storage temporarily unavailable", storage: "local" });
  }
};
