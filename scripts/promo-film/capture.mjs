// Capture the product screens the film shows, from the running app.
import { chromium } from "../bi-harness/node_modules/playwright-core/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import demo from "./demo-project.mjs";
const HERE = new URL("./", import.meta.url).pathname;
const OUT = HERE + "shots/";
mkdirSync(OUT, { recursive: true });
// Offline sandboxes: FONTS_CSS=<local @font-face css>, GSAP_DIR=<dir with gsap.min.js + ScrollTrigger.min.js>.
const FONTS = process.env.FONTS_CSS ? readFileSync(process.env.FONTS_CSS, "utf8") : null;
const GSAP = process.env.GSAP_DIR ? readFileSync(process.env.GSAP_DIR + "/gsap.min.js", "utf8") : null;
const ST = process.env.GSAP_DIR ? readFileSync(process.env.GSAP_DIR + "/ScrollTrigger.min.js", "utf8") : null;
const B = "http://127.0.0.1:4700";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;

async function newPage(w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  if (FONTS) await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: FONTS }));
  if (GSAP) await page.route("https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: GSAP }));
  if (ST) await page.route("https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: ST }));
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  return { ctx, page };
}
// Freeze the background as the poster (headless Chromium cannot play H.264).
const settle = (page) => page.evaluate(() => {
  document.querySelector(".site-bg")?.classList.add("video-ready");
  document.body.classList.add("has-video-bg");
  const s = document.createElement("style");
  s.textContent = ".site-bg-img{animation:none!important;transform:none!important} *{caret-color:transparent!important} html{scroll-behavior:auto!important}";
  document.head.appendChild(s);
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
});
async function scrollTo(page, sel, offset = 90) {
  await page.evaluate(([sel, off]) => {
    const el = document.querySelector(sel);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off);
  }, [sel, offset]);
  await page.waitForTimeout(500);
}
async function shot(page, name) { await page.screenshot({ path: OUT + name + ".png" }); console.log("shot", name); }
const want = (n) => !only || only.includes(n);

// ---- BI with the demo project ------------------------------------------------
if (want("bi")) {
  const { ctx, page } = await newPage();
  await page.goto(B + "/bi", { waitUntil: "domcontentloaded" });
  await page.evaluate((p) => { localStorage.clear(); localStorage.setItem("mwinda.bi.project", JSON.stringify(p)); }, demo);
  await page.reload({ waitUntil: "networkidle" });
  await settle(page);
  await page.waitForTimeout(800);
  await shot(page, "bi-hero");
  await scrollTo(page, "#step-start .panel:nth-of-type(2)", 70);
  await shot(page, "bi-start");
  await scrollTo(page, "#idea", 160);
  await shot(page, "bi-idea"); console.log("RECT idea", JSON.stringify(await page.evaluate(() => document.querySelector("#btnAnalyze").getBoundingClientRect())));
  const rail = (label) => page.click(`#rail button:has-text('${label}')`);
  await rail("Analysis"); await page.waitForTimeout(300); await scrollTo(page, "#step-analyze h2", 40); await shot(page, "bi-analysis");
  await scrollTo(page, "#step-analyze .panel:nth-of-type(3)", 80); await shot(page, "bi-risks");
  await scrollTo(page, "#step-analyze .no-print .field", 160); await shot(page, "bi-questions"); console.log("RECT all", JSON.stringify(await page.evaluate(() => document.querySelector("#step-analyze [data-all]").getBoundingClientRect())));
  await rail("Business model"); await page.waitForTimeout(300); await scrollTo(page, "#step-model h2", 40); await shot(page, "bi-model");
  await rail("Business plan"); await page.waitForTimeout(300); await scrollTo(page, "#step-plan h2", 40); await shot(page, "bi-plan");
  await rail("Financials"); await page.waitForTimeout(300); await scrollTo(page, "#step-financials h2", 40); await shot(page, "bi-fin-inputs");
  await scrollTo(page, "#finOut .scenario", 120); await shot(page, "bi-fin-scenarios");
  await rail("Compliance"); await page.waitForTimeout(300); await scrollTo(page, "#step-compliance h2", 40); await shot(page, "bi-compliance");
  await rail("Roadmap"); await page.waitForTimeout(300); await scrollTo(page, "#step-roadmap h2", 40); await shot(page, "bi-roadmap");
  await rail("Dossier"); await page.waitForTimeout(400); await scrollTo(page, "#step-dossier", 80); await shot(page, "bi-dossier"); console.log("RECT pdf", JSON.stringify(await page.evaluate(() => document.querySelector("#btnPrint").getBoundingClientRect())));
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnPrint")]);
  await dl.saveAs(HERE + "demo-dossier.pdf");
  await page.waitForTimeout(300);
  // The export scrolls to the top of the page; come back to the dossier so the
  // shot shows the "Open the PDF" link the export leaves.
  await scrollTo(page, "#step-dossier", 80);
  await shot(page, "bi-dossier-pdf");
  await ctx.close();
}

// ---- the one-click progress panel, live --------------------------------------
if (want("progress")) {
  const { ctx, page } = await newPage();
  const p = JSON.parse(JSON.stringify(demo));
  for (const k of ["model", "plan", "financials", "compliance", "roadmap"]) delete p.stages[k];
  await page.goto(B + "/bi", { waitUntil: "domcontentloaded" });
  await page.evaluate((p) => { localStorage.clear(); localStorage.setItem("mwinda.bi.project", JSON.stringify(p)); }, p);
  await page.reload({ waitUntil: "networkidle" });
  await settle(page);
  await page.click("#rail button:has-text('Analysis')");
  await page.waitForTimeout(300);
  await page.locator('#step-analyze [data-all]').click();
  await page.waitForSelector(".status-all");
  await page.waitForFunction(() => document.querySelectorAll(".status-all .row.ok").length >= 1, null, { timeout: 120000 });
  await page.waitForTimeout(2200);
  await scrollTo(page, "#step-analyze .actions", 300);
  await shot(page, "bi-progress");
  await page.waitForFunction(() => document.querySelectorAll(".status-all .row.ok").length >= 5, null, { timeout: 300000 }).catch(() => {});
  await scrollTo(page, "#step-analyze .actions", 300);
  await shot(page, "bi-progress-done");
  await ctx.close();
}

// ---- the site ---------------------------------------------------------------
if (want("site")) {
  const { ctx, page } = await newPage();
  await page.goto(B + "/", { waitUntil: "networkidle" });
  await settle(page);
  await page.waitForTimeout(3200);
  await shot(page, "site-hero");
  await scrollTo(page, "#divisions", 0); await page.waitForTimeout(800); await shot(page, "site-divisions");
  await scrollTo(page, "#bi", 0); await page.waitForTimeout(800); await shot(page, "site-bi");
  await scrollTo(page, "#ecosystem", 0); await page.waitForTimeout(800); await shot(page, "site-ecosystem");
  await page.goto(B + "/os", { waitUntil: "networkidle" });
  await settle(page);
  await page.waitForTimeout(3500);
  await shot(page, "os-hero");
  await scrollTo(page, "#talk, .talk, section:nth-of-type(2)", 40); await shot(page, "os-talk");
  await ctx.close();
}
await browser.close();
