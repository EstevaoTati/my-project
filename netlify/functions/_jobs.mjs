// Job records for the BI engine, in Netlify Blobs.
//
// A stage takes 20-120 seconds. A synchronous function does not get that long
// — the platform kills the invocation, and because the response was already
// streaming, the browser sees a stream that simply stops: no result line, no
// error line. That is the "no result received" the founder was getting on
// every analysis. Streaming keeps a connection open; it does not buy time.
//
// So the work moved to a background function, which does get the time, and the
// two halves talk through a job record here. Blobs is the right store for it:
// it is part of Netlify, needs no credentials and no provisioning, and these
// records are worthless after a few minutes.
//
// Supabase would also have worked, but the BI project store already degrades
// to 501 when Supabase is unconfigured — which is this deployment's state —
// and a dossier that cannot be generated at all is a worse failure than one
// that cannot be shared between devices.
import { getStore } from "@netlify/blobs";

const STORE = "bi-jobs";

/** Records older than this are stale: a job that has not finished by now never will. */
export const JOB_TTL_MS = 20 * 60 * 1000;

function store() {
  // Throws when Blobs is unavailable (local `netlify dev` without linking, a
  // site where the feature is off). Callers turn that into an honest error
  // rather than a hang.
  return getStore({ name: STORE, consistency: "strong" });
}

/**
 * A job id that is unguessable — the id is the only key to the result — and
 * that carries its own birth time: 8 hex digits of seconds, then 14 random
 * bytes (112 bits). The timestamp lets sweepJobs() find stale records from a
 * key listing alone, without reading a single business plan to learn its age.
 */
export function newJobId() {
  const b = new Uint8Array(14);
  crypto.getRandomValues(b);
  const t = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0").slice(-8);
  return t + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Seconds-since-epoch encoded in an id, or 0 for an id minted before it was. */
function bornAt(id) {
  const t = parseInt(String(id).slice(0, 8), 16);
  // Only trust values in a plausible window; older random-only ids decode to
  // noise and are left for the TTL check on read.
  return t > 1_700_000_000 && t < 4_000_000_000 ? t * 1000 : 0;
}

export async function putJob(id, record) {
  await store().setJSON(id, { ...record, at: Date.now() });
}

export async function getJob(id) {
  const rec = await store().get(id, { type: "json" });
  if (!rec) return null;
  if (Date.now() - (rec.at || 0) > JOB_TTL_MS) return { status: "expired" };
  return rec;
}

export async function dropJob(id) {
  try { await store().delete(id); } catch { /* a leftover record expires on its own */ }
}

/** Is the store usable at all? Checked before promising a job id. */
export async function jobsAvailable() {
  try {
    const s = store();
    await s.get("__probe__", { type: "text" });   // a miss is a success
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete records past their TTL. A result is removed as soon as the browser
 * acknowledges it, but a tab closed mid-generation never acknowledges, and a
 * business plan must not sit in a store indefinitely because of that.
 * Cheap and best-effort: one key listing, deletes only.
 */
export async function sweepJobs() {
  try {
    const s = store();
    const { blobs } = await s.list();
    const cutoff = Date.now() - JOB_TTL_MS;
    await Promise.all(blobs
      .filter((b) => { const at = bornAt(b.key); return at && at < cutoff; })
      .slice(0, 200)
      .map((b) => s.delete(b.key).catch(() => {})));
  } catch { /* the next sweep will try again */ }
}

