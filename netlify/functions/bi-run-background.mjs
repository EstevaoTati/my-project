// MWINDA AI BUSINESS INTELLIGENCE — the worker.
//
// Netlify runs any function whose name ends in `-background` asynchronously:
// the caller gets 202 immediately and this keeps running for up to 15 minutes.
// That is the only shape on this platform that fits a stage taking 20-120
// seconds. The previous design streamed NDJSON from a synchronous function,
// which the platform killed mid-stream — the browser saw the stream stop with
// no result and no error, and reported "no result received".
//
// Nothing here is reachable from the browser: the dispatcher (bi.mjs) does all
// the validation, rate limiting and budget accounting, and only then invokes
// this. It writes progress and the final outcome to the job record, which
// bi-status.mjs serves back.
//
// Deliberate design choice, unchanged: the model proposes financial
// ASSUMPTIONS, it does not compute the projection. LLMs are unreliable at
// arithmetic and a business plan whose numbers do not add up is worse than
// none. The maths runs in the browser.
import Anthropic from "@anthropic-ai/sdk";
import { audit } from "./_security.mjs";
import { referenceFor } from "./_reference.mjs";
import { putJob } from "./_jobs.mjs";
import {
  STAGES, BASE, STAGE_PROMPT, PLAN_IDS, PLAN_PARTS, planPart, normalize, missingFields,
  clampProject, contextBlock, priorBlock,
} from "./_bi_stages.mjs";

/** A generation that must not be delivered. `retry` = worth one more attempt. */
class StageError extends Error {
  constructor(message, { retry = false, tokens = 0 } = {}) {
    super(message);
    this.retry = retry;
    this.tokens = tokens;
  }
}

/**
 * One tool call, streamed. `onChars` receives the running character count so
 * progress can be reported; the result is normalised and checked before it is
 * returned — a truncated or incomplete answer throws, it is never delivered.
 */
async function callOnce(client, { system, schema, maxTokens, user, title, stageKey, onChars }) {
  const stream = client.messages.stream({
    model: process.env.BI_MODEL || "claude-sonnet-5",
    max_tokens: maxTokens,
    system,
    tools: [{ name: "deliver", description: `Deliver the ${title} as structured data.`, input_schema: schema }],
    tool_choice: { type: "tool", name: "deliver" },
    messages: [{ role: "user", content: user }],
  });

  let chars = 0;
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
      chars += event.delta.partial_json.length;
      onChars(chars);
    }
  }

  const final = await stream.finalMessage();
  const tokens = (final.usage?.output_tokens || 0) + (final.usage?.input_tokens || 0);
  // A truncated tool call still yields partial JSON. Delivering a half-written
  // analysis as if it were complete would be worse than failing.
  if (final.stop_reason === "max_tokens") {
    throw new StageError("generation was cut short — please retry", { retry: true, tokens });
  }
  const block = final.content.find((b) => b.type === "tool_use");
  const data = block ? normalize(schema, block.input) : null;
  const missing = missingFields(stageKey, data);
  if (missing.length) {
    throw new StageError("generation was incomplete — please retry", { retry: true, tokens, missing });
  }
  return { data, tokens, out: final.usage?.output_tokens || 0, in: final.usage?.input_tokens || 0 };
}

/** callOnce, with one quiet second attempt when the first was cut short or incomplete. */
async function call(client, args, audit_) {
  try {
    return await callOnce(client, args);
  } catch (error) {
    if (!(error instanceof StageError) || !error.retry) throw error;
    audit_("bi.retrying", { reason: error.message });
    const again = await callOnce(client, args);
    again.tokens += error.tokens;
    return again;
  }
}

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch { return new Response("", { status: 202 }); }

  const { jobId, stage, ip, founder } = body;
  const spec = STAGES[stage];
  // The dispatcher validated all of this. If it is wrong here, something
  // invoked us directly — record nothing and stop.
  if (!jobId || !spec) return new Response("", { status: 202 });

  const fail = async (error, tokens) => {
    await putJob(jobId, { status: "error", stage, error, tokens: tokens || 0 });
  };
  const note = (event, fields) => audit(event, { ip, stage, ...fields });

  try {
    await putJob(jobId, { status: "running", stage, chars: 0 });

    const project = clampProject(body.project);
    // Grounding, resolved before the model is called. A missing database, an
    // unknown country or an empty table all yield an empty block, and the
    // stage runs exactly as it did before this layer existed.
    const ref = await referenceFor(project.country, stage);
    const user = `Project context:\n${contextBlock(project)}${ref.block}${priorBlock(body.prior)}`;
    const client = new Anthropic();

    // Progress is written to the job record so the browser has something
    // honest to show. Throttled hard: each write is a network round trip, and
    // the point is reassurance, not telemetry. Parallel calls add up.
    const partChars = [];
    let lastWrite = 0;
    let lastAt = 0;
    const progress = (part) => (chars) => {
      partChars[part] = chars;
      const total = partChars.reduce((a, b) => a + (b || 0), 0);
      const now = Date.now();
      if (total - lastWrite > 1500 && now - lastAt > 2000) {
        lastWrite = total;
        lastAt = now;
        putJob(jobId, { status: "running", stage, chars: total }).catch(() => { /* progress is optional */ });
      }
    };

    let result;
    if (stage === "plan") {
      // Two halves in parallel, merged back into the canonical section order.
      const parts = await Promise.all(PLAN_PARTS.map((ids, i) => {
        const part = planPart(ids);
        return call(client, {
          system: `${BASE}\n\nCurrent task: ${part.prompt}`,
          schema: part.schema, maxTokens: part.maxTokens, user,
          title: spec.title, stageKey: "plan", onChars: progress(i),
        }, note);
      }));
      const byId = new Map();
      for (const p of parts) for (const s of p.data.sections) if (!byId.has(s.id)) byId.set(s.id, s);
      result = {
        data: { sections: PLAN_IDS.filter((id) => byId.has(id)).map((id) => byId.get(id)) },
        tokens: parts.reduce((a, p) => a + p.tokens, 0),
        in: parts.reduce((a, p) => a + p.in, 0),
        out: parts.reduce((a, p) => a + p.out, 0),
      };
    } else {
      result = await call(client, {
        system: `${BASE}\n\nCurrent task: ${STAGE_PROMPT[stage]}`,
        schema: spec.schema, maxTokens: spec.maxTokens, user,
        title: spec.title, stageKey: stage, onChars: progress(0),
      }, note);
    }

    note("bi.completed", { founder, in_tokens: result.in, out_tokens: result.out, grounded: ref.facts.length });
    // Only the analysis crosses to the client. The reference layer — which
    // sources exist, which were consulted, how many figures were injected —
    // stays server-side: it is how the engine knows where official data lives,
    // and that is methodology, not something to publish with every dossier.
    await putJob(jobId, { status: "done", stage, data: result.data, tokens: result.tokens });
  } catch (error) {
    if (error instanceof StageError) {
      note(error.message.includes("cut short") ? "bi.truncated" : "bi.incomplete_output", {});
      return void await fail(error.message, error.tokens).catch(() => { /* expires instead */ });
    }
    const busy = error instanceof Anthropic.RateLimitError || error?.status === 429 || error?.status === 529;
    const noKey = error?.status === 401 || /api[_ -]?key/i.test(error?.message || "");
    console.error("bi worker error", error?.status, error?.message);
    note("bi.failed", { status: error?.status });
    await fail(
      busy ? "the engine is busy — please retry in a minute"
        : noKey ? "the engine is not configured on this deployment (missing or invalid API key)"
          : "engine unavailable — please retry",
    ).catch(() => { /* the job then expires, and the client says so */ });
  }

  return new Response("", { status: 202 });
};
