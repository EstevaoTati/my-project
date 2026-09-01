// MWINDA AI BUSINESS INTELLIGENCE — the dispatcher.
//
// Six stages, generated one at a time so the user can edit between them and so
// a failure never costs a whole dossier. Every stage returns validated JSON via
// tool-use rather than prose the client has to parse.
//
// This endpoint used to do the generation itself and stream NDJSON back. That
// could not work: the code's own comment said a stage runs 20-120 seconds, and
// a synchronous function does not get 20-120 seconds. The platform killed the
// invocation mid-stream, and because bytes had already been sent the browser
// saw the stream simply stop — no result line, no error line — and reported
// "no result received". Streaming holds a connection open; it does not extend
// an execution limit. That was the bug behind every failed analysis.
//
// So the work happens in bi-run-background.mjs, which Netlify runs
// asynchronously with a 15-minute ceiling. This function keeps every guard it
// had — origin, rate limits, token budget, body size, founder key — and hands
// off in milliseconds. The browser polls bi-status.mjs.
import {
  json, secretMatches, founderKeyUsable, clientIp, SlidingWindow,
  authLockedOut, recordAuthFailure, recordAuthSuccess,
  originRejected, readJson, audit,
} from "./_security.mjs";
import { newJobId, putJob, jobsAvailable } from "./_jobs.mjs";
import { STAGES } from "./_bi_stages.mjs";

const MAX_BODY_BYTES = 96 * 1024;
const PUBLIC_RATE = new SlidingWindow({ windowMs: 3_600_000, max: 40 });  // ~6 dossiers/h
const FOUNDER_RATE = new SlidingWindow({ windowMs: 3_600_000, max: 200 });
const GLOBAL_RATE = new SlidingWindow({ windowMs: 3_600_000, max: 200 });

// Request counts are a poor proxy for cost when one stage can emit 16k tokens.
// Track actual spend and stop above a budget. Per warm instance like every
// other limiter here — the Anthropic monthly cap remains the hard ceiling —
// but this turns "600 requests" into something denominated in money.
//
// The worker reports what a stage actually cost; this is where it lands.
const TOKEN_WINDOW_MS = 3_600_000;
const tokenSpend = [];   // [{ t, tokens }]
function tokensThisHour() {
  const cutoff = Date.now() - TOKEN_WINDOW_MS;
  while (tokenSpend.length && tokenSpend[0].t < cutoff) tokenSpend.shift();
  return tokenSpend.reduce((sum, e) => sum + e.tokens, 0);
}
function recordTokens(n) {
  if (Number.isFinite(n) && n > 0) tokenSpend.push({ t: Date.now(), tokens: n });
}
const TOKEN_BUDGET = Number(process.env.BI_TOKEN_BUDGET_HOURLY) || 400_000;

// A stage costs roughly this much when nothing is known yet. Charged on
// dispatch so a burst of parallel requests cannot all pass the budget check
// before any of them reports back; the worker's real figure is authoritative
// once the job finishes.
const ESTIMATED_TOKENS = 6000;

export default async (req) => {
  const ip = clientIp(req);

  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (process.env.BI_ENABLED === "false") return json(503, { error: "business intelligence is temporarily disabled" });
  if (originRejected(req)) {
    audit("bi.origin_rejected", { ip });
    return json(403, { error: "forbidden" });
  }

  const globalWait = GLOBAL_RATE.check("global");
  if (globalWait) return json(429, { error: "service busy, retry shortly" }, { "retry-after": String(globalWait) });

  const spent = tokensThisHour();
  if (spent >= TOKEN_BUDGET) {
    audit("bi.token_budget_exhausted", { ip, spent });
    return json(429, { error: "generation budget reached — please try again later" }, { "retry-after": "900" });
  }

  const parsed = await readJson(req, MAX_BODY_BYTES);
  if (parsed.tooLarge) return json(413, { error: "project too large" });
  if (parsed.invalid) return json(400, { error: "invalid JSON body" });
  const body = parsed.value;

  const stage = STAGES[body?.stage] ? body.stage : null;
  if (!stage) return json(400, { error: "unknown stage" });
  if (!body?.project?.idea || typeof body.project.idea !== "string") {
    return json(400, { error: "an idea is required" });
  }
  if (body.project.idea.length > 4000) return json(400, { error: "idea must be under 4000 characters" });

  // Founder mode here only raises rate limits, so a wrong key degrades rather
  // than refuses. Guessing must still be throttled: without this, the key can
  // be probed here at no cost even though chat.mjs locks it down.
  let founder = false;
  if (typeof body?.key === "string" && body.key.length) {
    const lock = authLockedOut(ip);
    if (lock) {
      audit("bi.auth_locked_out", { ip });
      return json(429, { error: "too many attempts — try again later" }, { "retry-after": String(lock) });
    }
    founder = founderKeyUsable() && secretMatches(body.key, process.env.FOUNDER_KEY);
    if (founder) recordAuthSuccess(ip);
    else { recordAuthFailure(ip); audit("bi.auth_failed", { ip }); }
  }
  const wait = (founder ? FOUNDER_RATE : PUBLIC_RATE).check(ip);
  if (wait) {
    audit("bi.rate_limited", { ip, stage });
    return json(429, { error: "generation limit reached — please try again later" }, { "retry-after": String(wait) });
  }

  // Promise nothing that cannot be delivered: without the job store there is
  // nowhere for the worker to put its answer, and the browser would poll a job
  // that will never exist. Say so now instead.
  if (!(await jobsAvailable())) {
    audit("bi.jobs_unavailable", { ip, stage });
    return json(503, { error: "the generation store is unavailable on this deployment — please try again later" });
  }

  const jobId = newJobId();
  await putJob(jobId, { status: "queued", stage, chars: 0 });
  recordTokens(ESTIMATED_TOKENS);

  // Netlify runs a `-background` function asynchronously and answers 202 at
  // once. The await is only for the handoff, not for the work.
  const target = new URL("/.netlify/functions/bi-run-background", req.url);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId, stage, ip, founder,
        project: body.project,
        prior: body.prior,
      }),
    });
    if (!res.ok && res.status !== 202) throw new Error("worker refused: HTTP " + res.status);
  } catch (error) {
    console.error("bi dispatch error", error?.message);
    audit("bi.dispatch_failed", { ip, stage });
    await putJob(jobId, { status: "error", stage, error: "could not start the generation — please retry" });
    return json(502, { error: "could not start the generation — please retry" });
  }

  audit("bi.dispatched", { ip, stage, founder });
  return json(202, { jobId, stage });
};
