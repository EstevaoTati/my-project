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
  STAGES, BASE, STAGE_PROMPT, clampProject, contextBlock, priorBlock,
} from "./_bi_stages.mjs";

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

  try {
    await putJob(jobId, { status: "running", stage, chars: 0 });

    const project = clampProject(body.project);
    // Grounding, resolved before the model is called. A missing database, an
    // unknown country or an empty table all yield an empty block, and the
    // stage runs exactly as it did before this layer existed.
    const ref = await referenceFor(project.country, stage);

    const client = new Anthropic();
    const stream = client.messages.stream({
      model: process.env.BI_MODEL || "claude-sonnet-5",
      max_tokens: spec.maxTokens,
      system: `${BASE}\n\nCurrent task: ${STAGE_PROMPT[stage]}`,
      tools: [{
        name: "deliver",
        description: `Deliver the ${spec.title} as structured data.`,
        input_schema: spec.schema,
      }],
      tool_choice: { type: "tool", name: "deliver" },
      messages: [{
        role: "user",
        content: `Project context:\n${contextBlock(project)}${ref.block}${priorBlock(body.prior)}`,
      }],
    });

    // Progress is written to the job record so the browser has something
    // honest to show. Throttled hard: each write is a network round trip, and
    // the point is reassurance, not telemetry.
    let chars = 0;
    let lastWrite = 0;
    let lastAt = 0;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
        chars += event.delta.partial_json.length;
        const now = Date.now();
        if (chars - lastWrite > 1500 && now - lastAt > 2000) {
          lastWrite = chars;
          lastAt = now;
          await putJob(jobId, { status: "running", stage, chars }).catch(() => { /* progress is optional */ });
        }
      }
    }

    const final = await stream.finalMessage();
    const tokens = (final.usage?.output_tokens || 0) + (final.usage?.input_tokens || 0);

    // A truncated tool call still yields partial JSON. Delivering a half-written
    // analysis as if it were complete would be worse than failing.
    if (final.stop_reason === "max_tokens") {
      audit("bi.truncated", { ip, stage, out_tokens: final.usage?.output_tokens });
      return void await fail("generation was cut short — please retry", tokens);
    }

    const block = final.content.find((b) => b.type === "tool_use");
    const missing = block ? (spec.schema.required || []).filter((k) => block.input?.[k] === undefined) : ["all"];
    if (!block || missing.length) {
      audit("bi.incomplete_output", { ip, stage, missing: missing.join(",") });
      return void await fail("generation was incomplete — please retry", tokens);
    }

    audit("bi.completed", {
      ip, stage, founder,
      in_tokens: final.usage?.input_tokens,
      out_tokens: final.usage?.output_tokens,
      grounded: ref.facts.length,
    });
    // Only the analysis crosses to the client. The reference layer — which
    // sources exist, which were consulted, how many figures were injected —
    // stays server-side: it is how the engine knows where official data lives,
    // and that is methodology, not something to publish with every dossier.
    await putJob(jobId, { status: "done", stage, data: block.input, tokens });
  } catch (error) {
    const busy = error instanceof Anthropic.RateLimitError;
    const noKey = error?.status === 401 || /api[_ -]?key/i.test(error?.message || "");
    console.error("bi worker error", error?.status, error?.message);
    audit("bi.failed", { ip, stage, status: error?.status });
    await fail(
      busy ? "the engine is busy — please retry in a minute"
        : noKey ? "the engine is not configured on this deployment (missing or invalid API key)"
          : "engine unavailable — please retry",
    ).catch(() => { /* the job then expires, and the client says so */ });
  }

  return new Response("", { status: 202 });
};
