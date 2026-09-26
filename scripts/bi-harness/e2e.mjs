// Full BI suite in a real browser against the real functions (fake model).
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:4700";
// Headless sandboxes often cannot reach Google Fonts; pass FONTS_CSS=<file> to serve them locally.
const LOCAL_FONTS = process.env.FONTS_CSS ? readFileSync(process.env.FONTS_CSS, "utf8") : null;
const ctl = (o) => writeFileSync(new URL("control.json", import.meta.url), JSON.stringify({ charsPerSec: 6000, ...o }));
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
const results = [];

async function fresh(size = "1280x900") {
  const [w, h] = size.split("x").map(Number);
  const mobile = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  const page = await ctx.newPage();
  if (LOCAL_FONTS) await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: LOCAL_FONTS }));
  page.problems = [];
  page.posts = [];
  page.on("pageerror", (e) => page.problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/501|Failed to load resource/.test(m.text())) page.problems.push("console: " + m.text()); });
  page.on("request", (r) => { if (r.url().endsWith("/functions/bi") && r.method() === "POST") page.posts.push({ stage: JSON.parse(r.postData()).stage, kb: +(Buffer.byteLength(r.postData()) / 1024).toFixed(1) }); });
  await page.goto(BASE + "/bi", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "domcontentloaded" });
  return { ctx, page };
}
async function fillStart(page) {
  await page.click("#intentChips button >> nth=0");
  await page.selectOption("#country", "Democratic Republic of Congo");
  await page.fill("#region", "Kinshasa");
  await page.selectOption("#sector", "Food & Beverage");
  await page.selectOption("#businessType", "SaaS");
  await page.fill("#idea", "Je veux créer une plateforme qui permet aux restaurants de Kinshasa de gérer leurs commandes et leurs livraisons grâce à l’IA, avec paiement par mobile money.");
}
const waitStep = (page, id, timeout = 90000) => page.waitForSelector("#step-" + id + ".active", { timeout });
const errs = (page) => page.evaluate(() => [...document.querySelectorAll(".status.err")].map((e) => e.textContent).join(" | "));
async function analyze(page) {
  await fillStart(page);
  await page.click("#btnAnalyze");
  await waitStep(page, "analyze", 600000);
}
async function downloadPdf(page, file) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click("#btnPrint")]);
  await dl.saveAs(file);
  return dl.suggestedFilename();
}
async function scenario(name, fn) {
  if (only && !only.includes(name)) return;
  const t0 = Date.now();
  try { const note = await fn(); results.push(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${note ? " — " + note : ""}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message.split("\n")[0]}`); }
}

await scenario("step-by-step", async () => {
  ctl({ charsPerSec: Number(process.env.CPS || 6000) });
  const tStart = Date.now();
  const { ctx, page } = await fresh();
  await analyze(page);
  for (const s of ["model", "plan", "financials", "compliance", "roadmap"]) {
    await page.locator(`.step.active [data-next="${s}"]`).click();
    try { await waitStep(page, s, 600000); } catch { throw new Error(s + " failed: " + await errs(page)); }
  }
  const genSecs = ((Date.now() - tStart) / 1000).toFixed(1);
  await page.locator('.step.active [data-next="dossier"]').click();
  await waitStep(page, "dossier");
  const heads = await page.$$eval("#dossierOut .doc-section h4", (hs) => hs.map((h) => h.textContent));
  const dupes = heads.filter((h, i) => heads.indexOf(h) !== i);
  assert.deepEqual(dupes, [], "duplicate headings: " + dupes);
  for (const must of ["Résumé exécutif", "Key risks and first mitigations", "Assumptions to validate before investing", "Business model canvas", "Financial projection — year 1", "Execution roadmap"]) assert.ok(heads.some((h) => h.startsWith(must)), "missing " + must);
  assert.ok(await page.isHidden("#btnAllMissing"), "missing-sections button should hide when complete");
  const fname = await downloadPdf(page, "suite-step.pdf");
  // access link: server storage is off here (501) — the message must be visible on this step
  await page.click("#btnLink");
  await page.waitForFunction(() => document.getElementById("linkNote").textContent.length > 10);
  assert.ok(await page.isVisible("#linkNote"), "link note not visible");
  const maxKb = Math.max(...page.posts.map((p) => p.kb));
  assert.ok(maxKb < 40, "request too big: " + maxKb + " KB");
  assert.deepEqual(page.problems, []);
  await page.screenshot({ path: "suite-dossier.png" });
  await ctx.close();
  return `${heads.length} sections, ${fname}, largest request ${maxKb} KB, all six stages in ${genSecs}s`;
});

await scenario("one-click", async () => {
  ctl({ charsPerSec: Number(process.env.CPS || 2500) });
  const { ctx, page } = await fresh("390x844");
  await analyze(page);
  const t = Date.now();
  await page.locator('.step.active [data-all]').click();
  await page.waitForSelector(".status-all");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "suite-oneclick-progress.png" });
  await waitStep(page, "dossier", 600000);
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  const done = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("mwinda.bi.project")).stages));
  assert.equal(done.length, 6, "stages: " + done);
  assert.match(await page.textContent("#pdfNote"), /ready/);
  await downloadPdf(page, "suite-oneclick.pdf");
  await page.screenshot({ path: "suite-oneclick-done.png" });
  assert.deepEqual(page.problems, []);
  await ctx.close();
  return `model then 4 in parallel: ${secs}s`;
});

await scenario("reload-mid-generation", async () => {
  ctl({ charsPerSec: 2500 });
  const { ctx, page } = await fresh();
  await analyze(page);
  await page.locator('.step.active [data-next="model"]').click();
  await page.waitForTimeout(1500);
  const pend = await page.evaluate(() => JSON.parse(localStorage.getItem("mwinda.bi.project")).pending);
  assert.ok(pend.model && pend.model.jobId, "job id not persisted");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem("mwinda.bi.project")); return p.stages.model && !p.pending.model; }, null, { timeout: 60000 });
  const dispatched = page.posts.filter((p) => p.stage === "model").length;
  assert.equal(dispatched, 1, "model was dispatched " + dispatched + " times — should resume, not restart");
  await ctx.close();
  return "resumed the same job after reload";
});

await scenario("lost-reply", async () => {
  ctl({});
  const { ctx, page } = await fresh();
  let dropped = 0;
  await page.route("**/bi-status?job=*", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (!dropped && body.includes('"done"')) { dropped++; return route.abort("connectionreset"); }
    return route.fulfill({ response: res, body });
  });
  await analyze(page);
  assert.equal(dropped, 1);
  await ctx.close();
  return "finished result survived a dropped response";
});

await scenario("failure-then-retry", async () => {
  ctl({ fail: { "regulatory checklist": "error500" } });
  const { ctx, page } = await fresh();
  await analyze(page);
  await page.locator('.step.active [data-next="model"]').click(); await waitStep(page, "model");
  await page.locator('.step.active [data-next="plan"]').click(); await waitStep(page, "plan");
  await page.locator('.step.active [data-next="financials"]').click(); await waitStep(page, "financials");
  await page.locator('.step.active [data-next="compliance"]').click();
  await page.waitForSelector(".step.active .status.err button");
  const msg = await errs(page);
  await page.click(".step.active .status.err button");
  await waitStep(page, "compliance");
  await ctx.close();
  return "error shown (" + msg.trim().slice(0, 60) + "), Retry recovered";
});

await scenario("partial-dossier-pdf", async () => {
  ctl({});
  const { ctx, page } = await fresh();
  await analyze(page);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.locator(".step.active [data-pdf]").click()]);
  await dl.saveAs("suite-partial.pdf");
  await waitStep(page, "dossier");
  assert.ok(await page.isVisible("#btnAllMissing"), "missing-sections button should show");
  await page.click("#btnAllMissing");
  await page.waitForFunction(() => /ready/.test(document.getElementById("pdfNote").textContent), null, { timeout: 120000 });
  const heads = await page.$$eval("#dossierOut .doc-section h4", (hs) => hs.length);
  await ctx.close();
  return "PDF after analysis alone, then completed from the dossier (" + heads + " sections)";
});

await scenario("rail-dossier-fresh", async () => {
  ctl({});
  const { ctx, page } = await fresh();
  await analyze(page);
  await page.locator('.step.active [data-next="model"]').click(); await waitStep(page, "model");
  await page.click("#rail button:has-text('Dossier')");
  await waitStep(page, "dossier");
  const heads = await page.$$eval("#dossierOut .doc-section h4", (hs) => hs.map((h) => h.textContent));
  assert.ok(heads.includes("Business model canvas"), "rail dossier is stale: " + heads.join(","));
  await ctx.close();
  return "rail shows the current dossier";
});

await browser.close();
ctl({});
console.log(results.join("\n"));
