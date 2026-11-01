#!/usr/bin/env node
// Real-browser smoke test for the House of Knowledge (Playwright + Chromium).
//   node scripts/smoke-test.mjs                  # site as committed
//   MEDIA_DIR=/path/to/media node scripts/...    # serve these files as media/*
//   SHOTS=/tmp/shots node scripts/...            # also write screenshots
// Asserts behaviour, not pixels: no console errors, every scene reachable,
// visible scene videos play continuously (no scrolling needed) and hidden
// ones pause, reveals reverse, dialogs
// trap focus and return it, classic mode shows everything without the stage,
// forms report "not configured" honestly when the API answers 501.
import http from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, readdirSync } from "node:fs";
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
  ok(onFwd === 4 && onBack === 0, `reveals reverse on scroll back (${onFwd} → ${onBack})`);

  if (MEDIA) {
    await scrollToChapter(p, "arrivee", 0.1);
    await p.waitForFunction(() => document.querySelector(".s1 video.ready"), null, { timeout: 8000 }).catch(() => {});
    ok(await p.evaluate(() => !!document.querySelector(".s1 video.ready")), "scene 1 video loaded");
    // Continuous playback: time advances while the page does not move.
    await scrollToChapter(p, "arrivee", 0.3);
    const t0 = await p.evaluate(() => document.querySelector(".s1 video").currentTime);
    await settle(p, 1500);
    const t1 = await p.evaluate(() => document.querySelector(".s1 video").currentTime);
    const st = await p.evaluate(() => { const v = document.querySelector(".s1 video"); return { paused: v.paused, loop: v.loop }; });
    ok(!st.paused && st.loop && t1 !== t0, `scene 1 plays continuously without scrolling (${t0.toFixed(2)}s → ${t1.toFixed(2)}s, loop=${st.loop})`);
    // Scrolling must be felt: playback rushes while the wheel turns, then eases back.
    await scrollToChapter(p, "arrivee", 0.1);
    await settle(p, 1500);
    let peak = 1;
    const playing = () => p.evaluate(() => { const v = [...document.querySelectorAll(".scene video")].find((x) => !x.paused); return v ? v.playbackRate : 1; });
    for (let k = 0; k < 8; k++) {
      await p.mouse.wheel(0, 70); await p.waitForTimeout(40);
      peak = Math.max(peak, await playing());
    }
    await settle(p, 2500);
    const rest = await playing();
    const zoom = await p.evaluate(() => getComputedStyle(document.querySelector(".scene.s1")).transform);
    ok(peak > 1.8 && rest < 1.15, `scroll speed drives the camera (rate peak ${peak.toFixed(2)}× → rest ${rest.toFixed(2)}×)`);
    ok(zoom !== "none" && zoom !== "matrix(1, 0, 0, 1, 0, 0)", `scroll progress dollies the camera in (${zoom.slice(0, 28)}…)`);
    await scrollToChapter(p, "maison", 0.5);
    await settle(p, 800);
    const ps = await p.evaluate(() => [...document.querySelectorAll(".scene video")].map((v) => (v.getAttribute("src") ? (v.paused ? "p" : "▶") : "-")).join(""));
    ok(ps[0] === "p" && ps[1] === "▶", `scene 2 plays, scene 1 paused once out of view (${ps})`);
  }

  // library: book dialog, focus trap + return
  await scrollToChapter(p, "bibliotheque", 0.4);
  const book = p.locator(".book3d").first();
  await book.focus();
  await p.keyboard.press("Enter");
  await settle(p, 400);
  ok(await p.locator("#dlg[open]").isVisible(), "book opens from the shelf with the keyboard");
  ok(/Appel|Called/.test(await p.locator("#dlgTitle").textContent()), "book panel shows the real title");
  ok(await p.locator("#dlg a[href*='livres/called-to-stand-beside-him.html']").count() === 1, "panel links to the permanent book URL");
  ok(await p.locator('#dlg a[href="https://a.co/d/0h9yuEtI"]').count() === 1, "Amazon button carries the real purchase link");
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
  ok(await p.locator("#services li").count() === 9, "the house's 9 services are listed");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-atelier-book.png` });

  // language switch
  await p.click('[data-lang-btn="en"]'); await settle(p, 200);
  ok(/Shape\./.test(await p.locator(".hero-lines").textContent()) && /Publishing works/.test(await p.locator(".panel-hero .lead").textContent()), "EN switch translates content");
  await p.click('[data-lang-btn="fr"]');

  // contact form: honest when backend is not configured
  ok(await p.locator('#contact a[href="mailto:estevaomacumba@gmail.com"]').count() === 1, "home contact strip carries the real email");
  await p.goto(BASE + "/contact.html"); await settle(p, 400);
  await p.click("#contactForm [type=submit]");
  ok(await p.locator("#contactForm [aria-invalid=true]").count() >= 3, "empty contact form flags required fields");
  await p.fill("#contactForm [name=name]", "Test"); await p.fill("#contactForm [name=email]", "t@example.com");
  await p.fill("#contactForm [name=message]", "Bonjour"); await p.fill("#contactForm [name=subject]", "Test"); await p.check("#contactForm [name=consent]");
  await p.click("#contactForm [type=submit]"); await settle(p, 500);
  ok(/messagerie|estevaomacumba/.test(await p.locator("#contactForm .form-status").textContent()), "no backend → hands the message to the mail app (real address)");

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
  ok(await p.evaluate(() => document.documentElement.classList.contains("classic")), "choice holds for this tab (reload)");
  const fresh = await p.context().newPage();
  await fresh.goto(BASE + "/index.html"); await settle(fresh, 300);
  ok(!(await fresh.evaluate(() => document.documentElement.classList.contains("classic"))), "a new visit starts immersive again");
  await fresh.close();
  ok(p.errors.length === 0, "no JS errors");
  await p.context().close();
}

// ---------- reduced motion ----------
console.log("prefers-reduced-motion (OS setting)");
{
  const p = await page({ width: 1280, height: 800 }, { reduced: true });
  await p.goto(BASE + "/index.html"); await settle(p, 400);
  const cls = await p.evaluate(() => document.documentElement.className);
  ok(/os-reduce/.test(cls) && !/calm|classic/.test(cls), `stays immersive, secondary motion off (${cls})`);
  await scrollToChapter(p, "maison", 0.02);
  ok(await p.locator("#maison .axes li").first().isVisible(), "content reachable");
  if (MEDIA) ok(await p.evaluate(() => !!document.querySelector(".scene video[src]")), "footage still loads");
  await p.click("#motionBtn"); await settle(p, 300);
  ok(await p.evaluate(() => document.documentElement.classList.contains("calm") && [...document.querySelectorAll(".scene video")].every((v) => v.paused)), "in-page button pauses all footage");
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
  ok(await p.locator("#grid .bcard:visible").count() === 8, "catalogue lists 8 books");
  await p.fill("#q", "biblical"); await settle(p, 100);
  ok(await p.locator("#grid .bcard:visible").count() === 2, "search filters (biblical → 2)");
  await p.fill("#q", ""); await p.selectOption("#fl", "french"); await settle(p, 100);
  ok(await p.locator("#grid .bcard:visible").count() === 4, "language filter (French → 4)");
  await p.selectOption("#fl", ""); await p.click('.fchip[data-f="science"]'); await settle(p, 100);
  ok(await p.locator("#grid .bcard:visible").count() === 3, "collection chip filters (science → 3)");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/catalogue.png`, fullPage: true });
  await p.goto(BASE + "/livres/called-to-stand-beside-him.html"); await settle(p, 300);
  ok(/Appelée à Rester/.test(await p.locator("h1").textContent()), "book page renders the French title");
  ok(await p.locator("[data-book3d] .b3").count() === 1, "book page has the 3D book");
  ok(await p.locator('script[type="application/ld+json"]').count() === 1, "book page has structured data");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/book-page.png`, fullPage: true });
  await p.goto(BASE + "/auteurs/stephane-taty.html"); await settle(p, 200);
  ok(await p.locator(".bgrid .bcard").count() === 3, "author page lists 3 books");
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

// ---------- every link and every button, on every page ----------
console.log("link & button audit");
{
  const p = await page({ width: 1280, height: 800 });
  const pages = ["/index.html", "/maison.html", "/services.html", "/catalogue.html", "/contact.html", "/manuscrit.html", "/confidentialite.html",
    ...readdirSync(join(ROOT, "livres")).map((f) => "/livres/" + f), ...readdirSync(join(ROOT, "auteurs")).map((f) => "/auteurs/" + f)];
  const bad = [], seen = new Set(), deadButtons = [];
  for (const pg of pages) {
    await p.goto(BASE + pg); await settle(p, 250);
    const hrefs = await p.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (/^https:\/\/(a\.co|maps\.google\.com)\//.test(h) || /^mailto:estevaomacumba@gmail\.com/.test(h) || /^tel:\+17065725957$/.test(h)) continue;
      if (/^(https?:|mailto:|tel:)/.test(h)) { bad.push(`${pg} → unexpected external ${h}`); continue; }
      if (h === "#" || h === "") { bad.push(`${pg} → empty link`); continue; }
      const u = new URL(h, BASE + pg);
      const key = u.pathname;
      if (u.hash && u.pathname === new URL(BASE + pg).pathname) {
        if (!(await p.$(u.hash))) bad.push(`${pg} → missing anchor ${u.hash}`);
        continue;
      }
      if (seen.has(key)) continue; seen.add(key);
      const r = await fetch(BASE + key);
      if (r.status !== 200) bad.push(`${pg} → ${h} (${r.status})`);
    }
    // Every visible button must be wired to something real.
    const unwired = await p.$$eval("button", (bs) => bs.filter((b) => b.offsetParent).filter((b) =>
      !(b.type === "submit" || b.matches("[data-open],[data-book],[data-lang-btn],[data-close],#menuBtn,#classicBtn,#motionBtn,.fchip,#desk,.dlg-x"))
    ).map((b) => b.outerHTML.slice(0, 80)));
    unwired.forEach((u) => deadButtons.push(`${pg}: ${u}`));
  }
  ok(bad.length === 0, `all links resolve on ${pages.length} pages (${seen.size} internal targets checked)` + (bad.length ? "\n    " + bad.join("\n    ") : ""));
  ok(deadButtons.length === 0, "every button is wired" + (deadButtons.length ? "\n    " + deadButtons.join("\n    ") : ""));
  // Order button → contact form prefilled with the book and request type.
  await p.goto(BASE + "/livres/chretiente-ere-intelligence-artificielle.html"); await settle(p, 300);
  await p.click(".book-info .btn-gold"); await p.waitForLoadState(); await settle(p, 900);
  ok(/contact\.html/.test(p.url()) && (await p.inputValue("#contactSubject")).includes("Christianisme") && (await p.inputValue("#contactType")) === "order", "« Commander » opens the contact form prefilled (book + order)");
  ok(p.errors.length === 0, "no JS errors across the audit" + (p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""));
  await p.context().close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
