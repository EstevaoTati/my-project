// HTTP-level checks against the harness: dispatch, poll, ack, failure modes.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const B = "http://127.0.0.1:4700/.netlify/functions/";
const H = { origin: "http://127.0.0.1:4700", "content-type": "application/json" };
const project = { idea: "Plateforme de commande pour restaurants à Kinshasa", country: "Democratic Republic of Congo", sector: "Food & Beverage" };
async function run(stage, prior = {}) {
  const r = await fetch(B + "bi", { method: "POST", headers: H, body: JSON.stringify({ stage, project, prior }) });
  const j = await r.json(); if (!j.jobId) return { http: r.status, ...j };
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const s = await (await fetch(B + "bi-status?job=" + j.jobId)).json();
    if (s.status === "done" || s.status === "error") return { ...s, jobId: j.jobId };
  }
  return { status: "timeout" };
}
const ctl = (o) => writeFileSync(new URL("control.json", import.meta.url), JSON.stringify({ charsPerSec: 40000, ...o }));

ctl({});
let a = await run("analyze"); assert.equal(a.status, "done");
// done survives a second read, and ack deletes it
const again = await (await fetch(B + "bi-status?job=" + a.jobId)).json(); assert.equal(again.status, "done");
await fetch(B + "bi-status?job=" + a.jobId + "&ack=1");
const gone = await fetch(B + "bi-status?job=" + a.jobId); assert.equal(gone.status, 404);
console.log("done kept until ack: ok");

let p = await run("plan", { analyze: a.data }); assert.equal(p.status, "done");
assert.equal(p.data.sections.length, 17); assert.equal(p.data.sections[0].id, "executive-summary"); assert.equal(p.data.sections[16].id, "conclusion");
console.log("plan in two halves, merged in order: ok");

ctl({ fail: { "business plan": "max_tokens" } });
p = await run("plan"); assert.equal(p.status, "done", JSON.stringify(p)); console.log("plan truncated once -> retried -> ok");
ctl({ fail: { "idea analysis": "stringify" } });
a = await run("analyze"); assert.equal(a.status, "done"); assert.ok(Array.isArray(a.data.targetCustomers) && a.data.targetCustomers.length); console.log("array-as-string repaired: ok");
ctl({ fail: { "business model": "incomplete" } });
let m = await run("model"); assert.equal(m.status, "done"); console.log("incomplete once -> retried -> ok");
ctl({ fail: { "business model": "incomplete" }, failAlways: true });
m = await run("model"); assert.equal(m.status, "error"); assert.match(m.error, /incomplete/); console.log("incomplete twice -> honest error: ok");
ctl({ fail: { "execution roadmap": "error500" }, failAlways: true });
let rd = await run("roadmap"); assert.equal(rd.status, "error"); assert.match(rd.error, /unavailable/); console.log("5xx -> error: ok");
ctl({ fail: { "execution roadmap": "nokey" }, failAlways: true });
rd = await run("roadmap"); assert.match(rd.error, /not configured/); console.log("bad key -> clear error: ok");
// big legacy payload is accepted
const bigPrior = { plan: { sections: Array.from({ length: 17 }, (_, i) => ({ id: "x" + i, title: "t", body: "é".repeat(3000) })) } };
ctl({});
const r = await fetch(B + "bi", { method: "POST", headers: H, body: JSON.stringify({ stage: "roadmap", project, prior: { ...bigPrior, analyze: a.data } }) });
assert.equal(r.status, 202); console.log("~" + Math.round(Buffer.byteLength(JSON.stringify(bigPrior)) / 1024) + " KB legacy prior accepted: ok");
ctl({});
console.log("ALL API CHECKS PASSED");
