// Full BI suite in a real browser against the real functions (fake model).
import { chromium, devices } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:4700";
// Headless sandboxes often cannot reach Google Fonts; pass FONTS_CSS=<file> to serve them locally.
const LOCAL_FONTS = process.env.FONTS_CSS ? readFileSync(process.env.FONTS_CSS, "utf8") : null;
const ctl = (o) => writeFileSync(new URL("control.json", import.meta.url), JSON.stringify({ charsPerSec: 6000, ...o }));
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
const results = [];

let clients = 0;
async function fresh(size = "1280x900") {
  let opts;
  if (typeof size === "object") opts = size;
  else {
    const [w, h] = size.split("x").map(Number);
    const mobile = w < 600;
    opts = { viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile };
  }
  // Each context is its own client for the dispatcher's rate limit (40/hour),
  // so a full run no longer needs a server restart between suites.
  const ctx = await browser.newContext({ ...opts, acceptDownloads: true, extraHTTPHeaders: { "x-nf-client-connection-ip": "10.0.0." + ++clients } });
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
  if (process.env.STREAM) console.log(results[results.length - 1]);
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

await scenario("editable-after-reload", async () => {
  // Fields rendered while their step is hidden must be readable once shown.
  ctl({});
  const { ctx, page } = await fresh();
  await analyze(page);
  await page.locator('.step.active [data-all]').click();
  await waitStep(page, "dossier", 120000);
  for (const reload of [false, true]) {
    if (reload) await page.reload({ waitUntil: "domcontentloaded" });
    await page.click("#rail button:has-text('Business plan')");
    await waitStep(page, "plan");
    await page.waitForTimeout(200);
    const hs = await page.$$eval("#planOut textarea", (t) => t.map((x) => x.getBoundingClientRect().height));
    assert.ok(hs.length === 17 && Math.min(...hs) > 40, (reload ? "after reload" : "after one-click") + ": collapsed fields " + hs.map(Math.round));
  }
  await ctx.close();
  return "plan fields readable after one-click and after reload";
});

// ------------------------------------------------ phones, tablets, computers --
const DEVICES = (process.env.DEVICES || "iPhone SE,iPhone 13,Pixel 7,iPad (gen 7),iPad Pro 11 landscape,Laptop 1366,Desktop 1920").split(",");
const profile = (name) => {
  if (/^(Laptop|Desktop) (\d+)$/.test(name)) { const w = +name.split(" ")[1]; return { viewport: { width: w, height: w > 1600 ? 1080 : 768 } }; }
  const { defaultBrowserType, ...p } = devices[name];   // eslint-disable-line no-unused-vars
  return p;
};
/** Anything wider than the screen: a page a phone has to pan sideways. */
const sideways = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth <= vw + 1) return null;
  const wide = [...document.querySelectorAll(".step.active *, header *, .rail *")].filter((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || r.right <= vw + 1) return false;
    for (let a = e.parentElement; a; a = a.parentElement) if (/auto|scroll|hidden/.test(getComputedStyle(a).overflowX) && a !== document.body && a !== document.documentElement) return false;
    return true;
  });
  return `page ${document.documentElement.scrollWidth}px on a ${vw}px screen: ` + wide.slice(0, 3).map((e) => e.tagName.toLowerCase() + "." + e.className).join(", ");
});
for (const name of DEVICES) {
  await scenario("device: " + name, async () => {
    ctl({ charsPerSec: Number(process.env.CPS || 3000) });
    const p = profile(name);
    const touch = !!p.hasTouch;
    const press = (sel) => (touch ? page.tap(sel) : page.click(sel));
    const { ctx, page } = await fresh(p);
    const where = [];
    const check = async (label) => { const w = await sideways(page); if (w) where.push(label + ": " + w); };
    await fillStart(page);
    await check("start");
    if (touch) {
      // Under 16px, iOS Safari zooms the page into the field on tap.
      const small = await page.$$eval(".field input, .field select, .field textarea", (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((f) => f < 16));
      assert.deepEqual(small, [], "fields under 16px zoom the page on iPhone");
    }
    const h = await page.$eval("#btnAnalyze", (b) => b.getBoundingClientRect().height);
    assert.ok(h >= 40, "Analyse button too small to tap: " + h + "px");
    await press("#btnAnalyze");
    await waitStep(page, "analyze", 600000);
    await check("analysis");
    await page.locator(".step.active [data-all]").scrollIntoViewIfNeeded();
    await (touch ? page.locator(".step.active [data-all]").tap() : page.locator(".step.active [data-all]").click());
    await page.waitForSelector(".status-all");
    await check("one-click progress");
    await waitStep(page, "dossier", 600000);
    await check("dossier");
    for (const step of ["Business plan", "Financials", "Roadmap"]) {
      const btn = page.locator(`#rail button:has-text('${step}')`);
      if (!(await btn.isVisible())) continue;
      await (touch ? btn.tap() : btn.click());
      await page.waitForTimeout(250);
      await check(step);
    }
    await page.locator("#rail button:has-text('Dossier')").click();
    await waitStep(page, "dossier");
    const file = "suite-device-" + name.replace(/\W+/g, "-").toLowerCase() + ".pdf";
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), press("#btnPrint")]);
    await dl.saveAs(file);
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" ");
    for (const must of ["Business model canvas", "Execution roadmap"]) assert.ok(text.includes(must), "PDF is missing " + must);
    await page.screenshot({ path: "suite-device-" + name.replace(/\W+/g, "-").toLowerCase() + ".png" });
    assert.deepEqual(where, [], where.join(" | "));
    assert.deepEqual(page.problems, []);
    await ctx.close();
    return `${p.viewport.width}x${p.viewport.height}${touch ? " touch" : ""}, PDF ${doc.numPages} pages`;
  });
}

// ----------------------------------------------------------- bad networks --
await scenario("offline-mid-generation", async () => {
  // A phone in a lift: 40 s with no network while the business model is written.
  ctl({ charsPerSec: 2500 });
  const { ctx, page } = await fresh("390x844");
  await analyze(page);
  await page.locator('.step.active [data-next="model"]').click();
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.waitForTimeout(40000);
  const shown = await page.textContent(".step.active .status");
  assert.ok(!(await page.$(".step.active .status.err")), "gave up while offline: " + await errs(page));
  await ctx.setOffline(false);
  await waitStep(page, "model", 60000);
  await ctx.close();
  return "waited out 40 s offline (\"" + shown.trim().slice(0, 50) + "…\"), then landed";
});

await scenario("phone-slept-past-deadline", async () => {
  // The screen locked during the analysis and came back 12 minutes later: the
  // result is still on the server and must be collected, not silently dropped.
  ctl({});
  const { ctx, page } = await fresh("390x844");
  await fillStart(page);
  await page.click("#btnAnalyze");
  await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem("mwinda.bi.project") || "{}"); return p.pending && p.pending.analyze; });
  await page.waitForTimeout(2500);  // finished on the server meanwhile
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("mwinda.bi.project")); p.pending.analyze.at = Date.now() - 12 * 60 * 1000; localStorage.setItem("mwinda.bi.project", JSON.stringify(p)); });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("mwinda.bi.project")).stages.analyze, null, { timeout: 30000 });
  assert.equal(page.posts.filter((p) => p.stage === "analyze").length, 1, "analysis was generated twice");
  await ctx.close();
  return "collected the finished analysis after a 12-minute gap";
});

await scenario("dropped-start-request", async () => {
  // The request that starts a stage is lost on the way: retried, not an error.
  ctl({});
  const { ctx, page } = await fresh("390x844");
  let dropped = 0;
  await page.route("**/.netlify/functions/bi", (route) => (route.request().method() === "POST" && !dropped++ ? route.abort("connectionreset") : route.continue()));
  await analyze(page);
  assert.equal(dropped, 2, "expected one dropped start and one retry");
  await ctx.close();
  return "start request lost once, retried, analysis landed";
});

await browser.close();
ctl({});
console.log(results.join("\n"));
