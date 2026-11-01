#!/usr/bin/env node
// Render-crawl the current leselitespublishinghouse.com with a real browser
// (the site is a JavaScript app: its HTML holds no text until JS runs).
// Runs on GitHub's runners. Output → docs/source-site/ (never served):
//   rendered/<slug>.txt   visible text after render (innerText)
//   rendered/<slug>.json  url, title, headings, buttons, links, images
//   shots/<slug>.png      full-page screenshot (desktop)
//   images/               every content image (<= 4 MB)
//   bundle/               raw HTML + JS/JSON the app loads (text lives there too)
//   index.json            summary
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BASE = process.env.SITE || "https://leselitespublishinghouse.com/";
const OUT = process.argv[2] || "docs/source-site";
const HOST = new URL(BASE).host.replace(/^www\./, "");
for (const d of ["rendered", "shots", "images", "bundle"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const slug = (u) => { const x = new URL(u); return ((x.pathname.replace(/^\/|\/$/g, "") || "home") + (x.hash ? "-" + x.hash.slice(1) : "")).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "home"; };
const same = (u) => { try { return new URL(u).host.replace(/^www\./, "") === HOST; } catch { return false; } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: "Mozilla/5.0 (compatible; LesElitesSiteAudit/2.0) Chrome/126" });
const images = new Map(), bundles = new Map();
ctx.on("response", async (r) => {
  try {
    const u = r.url(), ct = r.headers()["content-type"] || "";
    if (ct.startsWith("image/") && r.ok()) { const b = await r.body(); if (b.length <= 4e6 && b.length > 1500) images.set(u, { b, ct }); }
    else if ((/javascript|json/.test(ct) || /\.(js|mjs|json)(\?|$)/.test(u)) && r.ok()) { const b = await r.body(); if (b.length < 8e6) bundles.set(u, b); }
  } catch {}
});

const queue = [BASE], seen = new Set(), pages = [];
async function scrollAll(p) {
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
}
while (queue.length && pages.length < 60) {
  const u = queue.shift().replace(/\/$/, "/");
  const key = u.split("#")[0] + (u.includes("#/") ? u.slice(u.indexOf("#")) : "");
  if (seen.has(key)) continue; seen.add(key);
  const p = await ctx.newPage();
  try {
    await p.goto(u, { waitUntil: "networkidle", timeout: 45000 });
    await p.waitForTimeout(1500); await scrollAll(p); await p.waitForTimeout(800);
    // Open anything that hides text: tabs, accordions, "read more".
    for (const sel of ['[role="tab"]', "details > summary", '[aria-expanded="false"]']) {
      for (const el of await p.$$(sel)) { try { await el.click({ timeout: 800 }); await p.waitForTimeout(150); } catch {} }
    }
    const data = await p.evaluate(() => {
      const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
      const txt = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
      return {
        url: location.href, title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || "",
        headings: [...document.querySelectorAll("h1,h2,h3,h4")].filter(vis).map((h) => h.tagName + ": " + txt(h)),
        buttons: [...document.querySelectorAll("button,a[role=button],.btn,[class*=button]")].filter(vis).map((b) => ({ text: txt(b).slice(0, 120), href: b.getAttribute("href") || "" })),
        links: [...document.querySelectorAll("a[href]")].map((a) => ({ text: txt(a).slice(0, 120), href: a.href })),
        images: [...document.querySelectorAll("img")].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt })),
        text: document.body.innerText,
      };
    });
    const s = slug(data.url);
    fs.writeFileSync(path.join(OUT, "rendered", s + ".txt"), `URL: ${data.url}\nTITLE: ${data.title}\n\n${data.text}\n`);
    fs.writeFileSync(path.join(OUT, "rendered", s + ".json"), JSON.stringify({ ...data, text: undefined }, null, 1));
    await p.screenshot({ path: path.join(OUT, "shots", s + ".png"), fullPage: true });
    pages.push({ url: data.url, slug: s, title: data.title, chars: data.text.length });
    for (const l of data.links) if (same(l.href) && !/\.(pdf|jpg|jpeg|png|webp|zip)$/i.test(l.href) && !/mailto:|tel:/.test(l.href)) queue.push(l.href);
    // Also click internal nav items that are buttons (SPAs often route without <a href>).
    if (pages.length === 1) {
      const labels = await p.$$eval("nav button, header button", (bs) => bs.map((b) => (b.innerText || "").trim()).filter(Boolean));
      for (const label of labels.slice(0, 20)) {
        const q = await ctx.newPage();
        try {
          await q.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
          await q.getByRole("button", { name: label, exact: true }).first().click({ timeout: 3000 });
          await q.waitForTimeout(1500);
          if (!seen.has(q.url())) queue.push(q.url());
          else { // same URL: section/modal content — capture it anyway
            await scrollAll(q);
            const t = await q.evaluate(() => document.body.innerText);
            const s2 = "click-" + label.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);
            fs.writeFileSync(path.join(OUT, "rendered", s2 + ".txt"), `CLICKED: ${label}\nURL: ${q.url()}\n\n${t}\n`);
          }
        } catch {} finally { await q.close(); }
      }
    }
  } catch (e) { console.log("fail", u, e.message); } finally { await p.close(); }
}
let ni = 0;
for (const [u, { b, ct }] of images) {
  const ext = (ct.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg").replace("svg+xml", "svg");
  let name = path.basename(new URL(u).pathname).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || crypto.createHash("md5").update(u).digest("hex").slice(0, 10);
  if (!name.toLowerCase().endsWith("." + ext)) name += "." + ext;
  fs.writeFileSync(path.join(OUT, "images", name), b); ni++;
}
let nb = 0;
for (const [u, b] of bundles) {
  if (!same(u) && !/supabase|firebase|base44|sanity|contentful|strapi|api/i.test(u)) continue;
  const name = (new URL(u).pathname.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-90) || "root") + (new URL(u).search ? "-" + crypto.createHash("md5").update(u).digest("hex").slice(0, 6) : "");
  fs.writeFileSync(path.join(OUT, "bundle", name), b); nb++;
}
const home = await (await fetch(BASE)).text().catch(() => "");
fs.writeFileSync(path.join(OUT, "bundle", "index.html"), home);
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ base: BASE, crawled: new Date().toISOString(), renderer: "playwright-chromium", pages, images: ni, bundles: nb }, null, 1));
console.log(`pages=${pages.length} images=${ni} bundles=${nb}`);
await browser.close();
