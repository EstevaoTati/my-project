#!/usr/bin/env node
// Real-browser smoke test for the House of Knowledge (Playwright + Chromium).
//   node scripts/smoke-test.mjs                  # site as committed
//   MEDIA_DIR=/path/to/media node scripts/...    # serve these files as media/*
//   SHOTS=/tmp/shots node scripts/...            # also write screenshots
// Asserts behaviour, not pixels: no console errors, every scene reachable,
// video time follows scroll forwards AND backwards, reveals reverse, dialogs
// trap focus and return it, classic mode shows everything without the stage,
// forms report "not configured" honestly when the API answers 501.
import http from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = await import("playwright")); }
const MEDIA = process.env.MEDIA_DIR;
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".xml": "application/xml" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/api/submit") { res.writeHead(501, { "content-type": "application/json" }); return res.end('{"error":"not_configured"}'); }
  if (p.endsWith("/")) p += "index.html";
  let file = MEDIA && p.startsWith("/media/") ? join(MEDIA, p.slice(7)) : join(ROOT, p);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const buf = readFileSync(file);
  const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
  if (range) {
    const s = +range[1], e = range[2] ? +range[2] : buf.length - 1;
    res.writeHead(206, { "content-type": TYPES[extname(file)], "content-range": `bytes ${s}-${e}/${buf.length}`, "accept-ranges": "bytes", "content-length": e - s + 1 });
    return res.end(buf.subarray(s, e + 1));
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "accept-ranges": "bytes" });
  res.end(buf);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) failed++; };
const browser = await chromium.launch();

async function page(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: opts.reduced ? "reduce" : "no-preference", hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_|status of (404|501)/.test(m.text()) && errors.push(m.text()));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  p.errors = errors;
  return p;
}
const settle = (p, ms = 500) => p.waitForTimeout(ms);
async function scrollToChapter(p, id, frac) {
  await p.evaluate(([id, frac]) => {
    const c = document.getElementById(id);
    const top = c.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top + (c.offsetHeight - innerHeight) * frac, behavior: "instant" });
  }, [id, frac]);
  await settle(p, 900);
}

// ---------- desktop, experience ----------
console.log("desktop experience" + (MEDIA ? " (with media)" : " (no media → painted fallback)"));
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "/index.html");
  await settle(p, 800);
  ok(await p.locator("h1").isVisible(), "hero headline visible on load");
  ok(await p.locator(".stage").isVisible(), "stage rendered");
  if (MEDIA) {
    const lazy = await p.evaluate(() => [...document.querySelectorAll(".scene video")].map((v) => (v.getAttribute("src") ? 1 : 0)).join(""));
    ok(lazy === "11000", `only the current and next scene download on load (${lazy})`);
  }
  const ids = ["arrivee", "maison", "bibliotheque", "atelier", "observatoire"];
  for (const [i, id] of ids.entries()) {
    await scrollToChapter(p, id, 0.5);
    const cur = await p.getAttribute(`#rail a:nth-of-type(${i + 1})`, "aria-current");
    ok(cur === "step", `scene ${i + 1} (${id}) becomes active`);
    const op = await p.evaluate((n) => getComputedStyle(document.querySelector(`.scene.s${n}`)).opacity, i + 1);
    ok(+op > 0.99, `scene ${i + 1} layer fully visible (opacity ${op})`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-${i + 1}-${id}.png` });
  }
  // threshold cross-fade
  await scrollToChapter(p, "maison", 0.95);
  const fade = await p.evaluate(() => +document.querySelector(".scene.s3").style.opacity);
  ok(fade > 0.2 && fade < 1, `doorway cross-fade into the library (next scene opacity ${fade.toFixed(2)})`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-threshold.png` });

  // reveals are reversible
  await scrollToChapter(p, "maison", 0.7);
  const onFwd = await p.locator("#maison .axes li.on").count();
  await scrollToChapter(p, "maison", 0.05);
  const onBack = await p.locator("#maison .axes li.on").count();
  ok(onFwd === 5 && onBack === 0, `reveals reverse on scroll back (${onFwd} → ${onBack})`);

  if (MEDIA) {
    await scrollToChapter(p, "arrivee", 0.1);
    await p.waitForFunction(() => document.querySelector(".s1 video.ready"), null, { timeout: 8000 }).catch(() => {});
    ok(await p.evaluate(() => !!document.querySelector(".s1 video.ready")), "scene 1 video loaded");
    const tAt = async (frac) => { await scrollToChapter(p, "arrivee", frac); await settle(p, 700); return p.evaluate(() => document.querySelector(".s1 video").currentTime); };
    const a = await tAt(0.2), b = await tAt(0.8), c = await tAt(0.3);
    ok(b > a + 2 && c < b - 2, `video time follows scroll forward and back (${a.toFixed(2)}s → ${b.toFixed(2)}s → ${c.toFixed(2)}s)`);
  }

  // library: book dialog, focus trap + return
  await scrollToChapter(p, "bibliotheque", 0.4);
  const book = p.locator(".book3d").first();
  await book.focus();
  await p.keyboard.press("Enter");
  await settle(p, 400);
  ok(await p.locator("#dlg[open]").isVisible(), "book opens from the shelf with the keyboard");
  ok(/Called to Stand/.test(await p.locator("#dlgTitle").textContent()), "book panel shows the real title");
  ok(await p.locator("#dlg a[href*='livres/called-to-stand-beside-him.html']").count() === 1, "panel links to the permanent book URL");
  ok(await p.locator("#dlg .btn", { hasText: /Acheter/ }).count() === 0, "no Buy button without a confirmed sales link");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-book-dialog.png` });
  await p.keyboard.press("Escape");
  await settle(p, 300);
  ok(!(await p.locator("#dlg[open]").count()), "Esc closes the panel");
  ok(await p.evaluate(() => document.activeElement.classList.contains("book3d")), "focus returns to the book");
  for (const k of ["authors", "collections"]) {
    await p.click(`.poi[data-open="${k}"]`); await settle(p, 300);
    ok(await p.locator("#dlg[open]").isVisible(), `${k} gallery opens`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-${k}.png` });
    await p.keyboard.press("Escape");
  }

  await scrollToChapter(p, "atelier", 0.85);
  ok(await p.locator("#services li").count() === 1, "only confirmed services rendered (1)");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-atelier-book.png` });

  // language switch
  await p.click('[data-lang-btn="en"]'); await settle(p, 200);
  ok((await p.locator(".hero-emblem + .kicker + h1 + .motto + .lead").textContent()).startsWith("A publishing house"), "EN switch translates content");
  await p.click('[data-lang-btn="fr"]');

  // contact form: honest when backend is not configured
  await p.locator("#contact").scrollIntoViewIfNeeded();
  await p.click("#contactForm [type=submit]");
  ok(await p.locator("#contactForm [aria-invalid=true]").count() >= 3, "empty contact form flags required fields");
  await p.fill("#contactForm [name=name]", "Test"); await p.fill("#contactForm [name=email]", "t@example.com");
  await p.fill("#contactForm [name=message]", "Bonjour"); await p.check("#contactForm [name=consent]");
  await p.click("#contactForm [type=submit]"); await settle(p, 500);
  ok(/pas encore activé/.test(await p.locator("#contactForm .form-status").textContent()), "501 → says the form is not switched on (no fake success)");

  ok(p.errors.length === 0, "no JS errors" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
  await p.context().close();
}

// ---------- classic mode ----------
console.log("classic mode");
{
  const p = await page({ width: 1280, height: 800 });
  await p.goto(BASE + "/index.html");
  await p.click("#classicBtn"); await settle(p, 400);
  ok(!(await p.locator(".stage").isVisible()), "stage hidden");
  ok(await p.locator("#atelier .steps li").first().isVisible(), "all content visible without scrolling the experience");
  const h = await p.evaluate(() => document.getElementById("maison").offsetHeight / innerHeight);
  ok(h < 1.6, `chapters are normal height (${h.toFixed(2)} vh)`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/classic-full.png`, fullPage: true });
  await p.reload(); await settle(p, 300);
  ok(await p.evaluate(() => document.documentElement.classList.contains("classic")), "choice persists across reloads");
  ok(p.errors.length === 0, "no JS errors");
  await p.context().close();
}

// ---------- reduced motion ----------
console.log("prefers-reduced-motion");
{
  const p = await page({ width: 1280, height: 800 }, { reduced: true });
  await p.goto(BASE + "/index.html"); await settle(p, 400);
  ok(await p.evaluate(() => document.documentElement.classList.contains("calm")), "calm mode on");
  await scrollToChapter(p, "maison", 0.02);
  ok(await p.locator("#maison .axes li").last().isVisible() && +(await p.locator("#maison .axes li").last().evaluate((e) => getComputedStyle(e).opacity)) === 1, "content fully shown, no progressive reveal");
  ok(await p.evaluate(() => [...document.querySelectorAll(".scene video")].every((v) => !v.getAttribute("src"))), "no video downloaded");
  await p.context().close();
}

// ---------- mobile ----------
console.log("mobile 390×844");
{
  const p = await page({ width: 390, height: 844 }, { touch: true });
  await p.goto(BASE + "/index.html"); await settle(p, 600);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, `no horizontal scroll (${overflow}px)`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/mobile-1.png` });
  for (const id of ["maison", "bibliotheque", "atelier", "observatoire"]) {
    await scrollToChapter(p, id, 0.75);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/mobile-${id}.png` });
  }
  await p.click("#menuBtn"); await settle(p, 500);
  ok(await p.locator("#navLinks a").first().isVisible(), "menu opens");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/mobile-menu.png` });
  const small = await p.evaluate(() => [...document.querySelectorAll("a.btn, button.btn, .chip, .poi, .langs button, .menu-btn")].filter((e) => e.offsetParent && (e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44)).map((e) => e.textContent.trim().slice(0, 20)));
  ok(small.length === 0, "touch targets ≥ 44px" + (small.length ? ": " + small.join(", ") : ""));
  ok(p.errors.length === 0, "no JS errors");
  await p.context().close();
}

// ---------- sub-pages ----------
console.log("sub-pages");
{
  const p = await page({ width: 1280, height: 800 });
  await p.goto(BASE + "/catalogue.html"); await settle(p, 300);
  ok(await p.locator("#grid .card:visible").count() === 5, "catalogue lists 5 books");
  await p.fill("#q", "biblical"); await settle(p, 100);
  ok(await p.locator("#grid .card:visible").count() === 2, "search filters (biblical → 2)");
  await p.fill("#q", ""); await p.selectOption("#fl", "fr"); await settle(p, 100);
  ok(await p.locator("#grid .card:visible").count() === 2, "language filter (fr → 2)");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/catalogue.png`, fullPage: true });
  await p.goto(BASE + "/livres/called-to-stand-beside-him.html"); await settle(p, 300);
  ok(await p.locator("h1").textContent() === "Called to Stand Beside Him", "book page renders");
  ok(await p.locator('script[type="application/ld+json"]').count() === 1, "book page has structured data");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/book-page.png`, fullPage: true });
  await p.goto(BASE + "/auteurs/stephane-taty.html"); await settle(p, 200);
  ok(await p.locator(".cards .card").count() === 3, "author page lists 3 books");
  await p.goto(BASE + "/manuscrit.html"); await settle(p, 200);
  await p.setInputFiles("#msForm [name=file]", { name: "x.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await p.click("#msForm [type=submit]");
  ok(await p.locator('#msForm [name=file][aria-invalid=true]').count() === 1, "manuscript form rejects a .exe");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/manuscrit.png`, fullPage: true });
  ok(p.errors.length === 0, "no JS errors" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
  await p.context().close();
}

// ---------- no JS ----------
console.log("JavaScript disabled");
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/index.html");
  ok(await p.locator("#maison .axes li").last().isVisible(), "content readable without JS");
  ok(await p.locator("#bookList").count() === 1, "book list fallback present");
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
