// MWINDA AI BUSINESS INTELLIGENCE — job status.
//
// The browser polls this while bi-run-background.mjs works. It is deliberately
// tiny and fast: no model, no reference data, one blob read.
//
// The job id is the only key to a result, and it is 18 random bytes, so this
// needs no other authorisation — but it is rate limited, because a poll loop
// is by nature repetitive and a broken client should not be able to hammer it.
import { json, clientIp, SlidingWindow } from "./_security.mjs";
import { getJob, dropJob } from "./_jobs.mjs";

// A client polls every ~2s for at most a few minutes: ~150 requests a job,
// and a founder may run six stages. Generous, but not unbounded.
const POLL_RATE = new SlidingWindow({ windowMs: 600_000, max: 800 });

/**
 * `originRejected` cannot be used here: it treats a missing Origin header as
 * hostile, and browsers do not send Origin on same-origin GET requests. Using
 * it would 403 every single poll — the endpoint would never once answer.
 *
 * `sec-fetch-site` is the header that carries this information for a GET, so
 * check that instead. It is only a hardening measure either way: this endpoint
 * is read-only, rate limited, and the job id is 18 random bytes, so there is
 * nothing here for a cross-site caller to reach without already having the id.
 */
function crossSite(req) {
  const site = req.headers.get("sec-fetch-site");
  return !!site && site !== "same-origin" && site !== "none";
}

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "method not allowed" });
  if (crossSite(req)) return json(403, { error: "forbidden" });

  const ip = clientIp(req);
  const wait = POLL_RATE.check(ip);
  if (wait) return json(429, { error: "too many status checks" }, { "retry-after": String(wait) });

  const id = new URL(req.url).searchParams.get("job") || "";
  if (!/^[0-9a-f]{36}$/.test(id)) return json(400, { error: "invalid job id" });

  let rec;
  try {
    rec = await getJob(id);
  } catch (error) {
    console.error("bi-status read error", error?.message);
    return json(503, { error: "the generation store is unavailable — please retry" });
  }

  if (!rec) return json(404, { error: "unknown or expired job" });

  if (rec.status === "done") {
    // Read once, then let it go: the browser has the dossier now, and a
    // business plan should not sit in a store longer than it must.
    await dropJob(id);
    return json(200, { status: "done", stage: rec.stage, data: rec.data });
  }
  if (rec.status === "error") {
    await dropJob(id);
    return json(200, { status: "error", stage: rec.stage, error: rec.error });
  }
  if (rec.status === "expired") {
    return json(200, { status: "error", stage: rec.stage, error: "the generation timed out — please retry" });
  }

  return json(200, { status: rec.status || "running", stage: rec.stage, chars: rec.chars || 0 });
};
