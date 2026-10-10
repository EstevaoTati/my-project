#!/usr/bin/env node
// Wedding site test suite — real functions, fake Supabase, real Chromium.
//
//   node scripts/test.mjs          # unit + API
//   node scripts/test.mjs --e2e    # + browser flows (needs Playwright/Chromium)
//
// Run it after ANY change to the functions, the RSVP flow or the motion layer.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.env.PORT = process.env.PORT || "8797";
const { start, tables } = await import("./dev-server.mjs");
const lib = await import("../netlify/functions/_lib.mjs");

let pass = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✕", name, "\n     ", e.message); }
}

// ------------------------------------------------------------------ unit --
console.log("unit");
await test("i18n: every key exists in EN and FR", () => {
  const ctx = { window: {}, document: {}, navigator: {}, localStorage: null, CustomEvent: class {} };
  vm.runInNewContext(readFileSync(join(ROOT, "i18n.js"), "utf8"), ctx);
  const { en, fr } = ctx.window.i18n.dict;
  const missing = [...Object.keys(en).filter((k) => !(k in fr)).map((k) => "fr:" + k), ...Object.keys(fr).filter((k) => !(k in en)).map((k) => "en:" + k)];
  assert.deepEqual(missing, []);
});
await test("i18n: every data-i18n key in the pages exists", () => {
  const ctx = { window: {}, document: {}, navigator: {}, CustomEvent: class {} };
  vm.runInNewContext(readFileSync(join(ROOT, "i18n.js"), "utf8"), ctx);
  const html = readFileSync(join(ROOT, "index.html"), "utf8") + readFileSync(join(ROOT, "app.js"), "utf8");
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g), ...html.matchAll(/\bt\("([a-z]+\.[\w.]+)"/g)].map((m) => m[1]);
  const unknown = [...new Set(keys)].filter((k) => !(k in ctx.window.i18n.dict.en));
  assert.deepEqual(unknown, []);
});
await test("content: unknown facts stay null — nothing invented", () => {
  const c = JSON.parse(readFileSync(join(ROOT, "content.json"), "utf8"));
  assert.equal(c.date, "2027-03-13");
  assert.equal(c.city, "Sumner");
  for (const k of ["venue", "address", "start", "end"]) { assert.equal(c.ceremony[k], null); assert.equal(c.reception[k], null); }
  assert.equal(c.rsvp.deadline, null);
  assert.equal(c.gifts.registry_url, null);
  assert.equal(c.gifts.fund_url, null);
  assert.deepEqual(c.program, []);
  for (const s of Object.values(c.scenes)) assert.ok(c.photos.some((p) => p.id === s), "scene photo exists: " + s);
});
await test("time: 4 pm on March 13, 2027 in Sumner is 00:00 UTC on the 14th (PST, before DST)", () => {
  assert.equal(lib.zonedToUtc("2027-03-13", "16:00", "America/Los_Angeles").toISOString(), "2027-03-14T00:00:00.000Z");
  assert.equal(lib.zonedToUtc("2027-03-15", "16:00", "America/Los_Angeles").toISOString(), "2027-03-15T23:00:00.000Z");
});
await test("invite codes: signature verifies, tampering fails", () => {
  process.env.INVITE_SECRET = "dev-invite-secret-not-for-prod";
  const code = lib.newCode(), tok = lib.inviteToken(code);
  assert.equal(lib.verifyInvite(tok), code);
  assert.equal(lib.verifyInvite(tok.slice(0, -1) + (tok.endsWith("A") ? "B" : "A")), null);
  assert.equal(lib.verifyInvite("AAAAAAAA." + tok.split(".")[1]), null);
  assert.equal(lib.verifyInvite("../../etc"), null);
});
await test("rsvp deadline closes at the end of the day, Pacific", () => {
  const c = { timezone: "America/Los_Angeles", rsvp: { deadline: "2027-02-01" } };
  assert.equal(lib.rsvpClosed(c, Date.parse("2027-02-02T07:59:00Z")), false);
  assert.equal(lib.rsvpClosed(c, Date.parse("2027-02-02T08:01:00Z")), true);
});

// ------------------------------------------------------------------- api --
const { server, fake, url } = await start();
const H = { origin: url, "content-type": "application/json" };
const post = (path, body, headers = H) => fetch(url + path, { method: "POST", headers, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const ADMIN = process.env.ADMIN_KEY, STAFF = process.env.STAFF_KEY;
const admin = (b) => post("/api/admin", { key: ADMIN, ...b });

console.log("api");
let g;
await test("admin: wrong key 403, staff key refused, admin key works", async () => {
  assert.equal((await post("/api/admin", { key: "nope-nope-nope-nope", action: "stats" })).status, 403);
  assert.equal((await post("/api/admin", { key: STAFF, action: "stats" })).status, 403);
  assert.equal((await admin({ action: "stats" })).status, 200);
});
await test("cross-origin requests are refused", async () => {
  const r = await post("/api/invite", { action: "open", token: "x" }, { ...H, origin: "https://evil.example" });
  assert.equal(r.status, 403);
});
await test("admin creates an invitation with a signed link", async () => {
  const r = await admin({ action: "guests.save", guest: { label: "Marie & Paul", greeting: "Marie", kind: "couple", party: ["Marie", "Paul"], max_guests: 2, email: "m@example.com", phone: "+1", notes: "PRIVATE NOTE" } });
  assert.equal(r.status, 200);
  g = r.body.guest;
  assert.match(g.token, /^[A-Z2-9]{8}\.[A-Za-z0-9_-]{12}$/);
  assert.ok(g.link.endsWith("/?invite=" + g.token));
});
await test("guest view never leaks email, phone or private notes", async () => {
  const r = await post("/api/invite", { action: "open", token: g.token });
  assert.equal(r.status, 200);
  const s = JSON.stringify(r.body);
  for (const secret of ["m@example.com", "PRIVATE NOTE", '"phone"', '"code"', '"id"']) assert.ok(!s.includes(secret), "leaked " + secret);
});
await test("forged and unknown tokens look identical (404)", async () => {
  assert.equal((await post("/api/invite", { action: "open", token: g.code + ".AAAAAAAAAAAA" })).status, 404);
  assert.equal((await post("/api/invite", { action: "open", token: "garbage" })).status, 404);
});
await test("RSVP: more guests than allowed is refused, not truncated", async () => {
  const r = await post("/api/invite", { action: "rsvp", token: g.token, attending: true, attendees: [{ name: "A" }, { name: "B" }, { name: "C" }] });
  assert.equal(r.status, 400); assert.equal(r.body.error, "too_many_guests");
});
await test("RSVP: attending, then changed to declined", async () => {
  let r = await post("/api/invite", { action: "rsvp", token: g.token, attending: true, attendees: [{ name: "Marie", dietary: "vegan" }, { name: "Paul" }], message: "Yes!" });
  assert.equal(r.status, 200); assert.equal(r.body.invitation.rsvp.seats, 2);
  r = await post("/api/invite", { action: "rsvp", token: g.token, attending: false });
  assert.equal(r.body.invitation.rsvp.status, "declined"); assert.equal(r.body.invitation.rsvp.seats, 0);
});
await test("RSVP: closed after the deadline, locked when updates are off", async () => {
  await admin({ action: "settings.save", content: { rsvp: { deadline: "2020-01-01" } } });
  assert.equal((await post("/api/invite", { action: "rsvp", token: g.token, attending: false })).body.error, "rsvp_closed");
  await admin({ action: "settings.save", content: { rsvp: { deadline: null, allow_update: false } } });
  assert.equal((await post("/api/invite", { action: "rsvp", token: g.token, attending: false })).body.error, "rsvp_locked");
  await admin({ action: "settings.save", content: {} });
});
await test("content: dashboard edits are merged over the defaults", async () => {
  await admin({ action: "settings.save", content: { ceremony: { venue: "Test Hall" } } });
  const c = await fetch(url + "/api/content").then((r) => r.json());
  assert.equal(c.ceremony.venue, "Test Hall"); assert.equal(c.ceremony.address, null); assert.equal(c.city, "Sumner");
  await admin({ action: "settings.save", content: {} });
});
await test("guestbook: links rejected, bots dropped silently, nothing public until approved", async () => {
  assert.equal((await post("/api/guestbook", { name: "Spam", message: "visit https://x.example", elapsed: 9000 })).body.error, "no_links");
  const before = tables.wed_guestbook.length;
  assert.equal((await post("/api/guestbook", { name: "Bot", message: "hi", website: "x", elapsed: 9000 })).status, 200);
  assert.equal(tables.wed_guestbook.length, before, "honeypot stored nothing");
  await post("/api/guestbook", { name: "Odile", message: "Félicitations !", elapsed: 9000, token: g.token });
  assert.equal((await fetch(url + "/api/guestbook").then((r) => r.json())).entries.length, 0);
  const e = (await admin({ action: "guestbook.list" })).body.entries.find((x) => x.name === "Odile");
  assert.ok(e.invitation_id, "linked to the verified invitation");
  await admin({ action: "guestbook.set", id: e.id, approved: true });
  const pub = (await fetch(url + "/api/guestbook").then((r) => r.json())).entries;
  assert.deepEqual(Object.keys(pub[0]).sort(), ["created_at", "message", "name"]);
});
await test("check-in: staff checks in once; duplicates refused; only admin can undo", async () => {
  await post("/api/invite", { action: "rsvp", token: g.token, attending: true, attendees: [{ name: "Marie" }, { name: "Paul" }] });
  let r = await post("/api/checkin", { key: STAFF, action: "checkin", code: g.link });
  assert.equal(r.status, 200); assert.equal(r.body.guest.checked_in_count, 2);
  assert.ok(!JSON.stringify(r.body).includes("m@example.com"));
  r = await post("/api/checkin", { key: STAFF, action: "checkin", code: g.token });
  assert.equal(r.status, 409);
  assert.equal((await post("/api/checkin", { key: STAFF, action: "undo", code: g.token })).status, 403);
  assert.equal((await post("/api/checkin", { key: ADMIN, action: "undo", code: g.token })).status, 200);
  assert.equal((await post("/api/checkin", { key: "wrong-key-wrong-key", action: "stats" })).status, 403);
});
await test("CSV-style import and seating", async () => {
  const r = await admin({ action: "guests.import", rows: [{ label: "A" }, { label: "B", max_guests: 99 }] });
  assert.equal(r.body.imported, 2);
  const t = (await admin({ action: "tables.save", table: { name: "T1", capacity: 6 } })).body.table;
  const b = (await admin({ action: "guests.list" })).body.guests.find((x) => x.label === "B");
  assert.equal(b.max_guests, 20, "clamped to 20");
  await admin({ action: "guests.save", guest: { ...b, table_id: t.id } });
  assert.equal((await admin({ action: "guests.list" })).body.guests.find((x) => x.label === "B").table_id, t.id);
});
await test("site does not serve source, schema or docs", async () => {
  for (const p of ["/netlify/functions/_lib.mjs", "/supabase/migrations/0001_wedding.sql", "/scripts/test.mjs", "/docs/SETUP.md"]) {
    assert.equal((await fetch(url + p)).status, 404, p);
  }
});

// ------------------------------------------------------------------- e2e --
if (process.argv.includes("--e2e")) {
  console.log("e2e");
  const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs").catch(() => import("playwright"));
  const browser = await chromium.launch();
  const fresh = (await admin({ action: "guests.save", guest: { label: "Famille Mbuyi", greeting: "Marie", kind: "household", party: ["Marie Mbuyi", "Jean Mbuyi"], max_guests: 3, lang: "fr" } })).body.guest;

  async function page(opts = {}) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
    const p = await ctx.newPage();
    p.errors = [];
    p.on("pageerror", (e) => p.errors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) p.errors.push(m.text()); });
    if (opts.blockGsap) await p.route("**/assets/vendor/gsap.min.js", (r) => r.abort());
    if (opts.skipIntro !== false) await p.addInitScript(() => sessionStorage.setItem("ss.intro", "1"));
    return p;
  }

  await test("intro plays, can be skipped, and is not shown twice in a session", async () => {
    const p = await page({ skipIntro: false });
    await p.goto(url + "/", { waitUntil: "networkidle" });
    assert.equal(await p.isVisible("#intro"), true);
    await p.click("#skipBtn"); await p.waitForTimeout(1100);
    assert.equal(await p.isHidden("#intro"), true);
    await p.reload({ waitUntil: "networkidle" });
    assert.equal(await p.isHidden("#intro"), true);
    assert.deepEqual(p.errors, []);
  });
  await test("invitation link: personal welcome, token removed from the URL, French chosen", async () => {
    const p = await page();
    await p.goto(url + "/?invite=" + fresh.token, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    assert.ok(!p.url().includes("invite="));
    assert.equal(await p.evaluate(() => document.documentElement.lang), "fr");
    assert.match(await p.textContent(".hero-welcome"), /Bienvenue, Marie/);
    assert.deepEqual(p.errors, []);
  });
  await test("RSVP in the browser: capped at the invitation size; names survive a language switch", async () => {
    const p = await page({ viewport: { width: 1280, height: 860 } });
    await p.goto(url + "/?invite=" + fresh.token, { waitUntil: "networkidle" });
    await p.evaluate(() => document.querySelector("#rsvp").scrollIntoView());
    await p.check("[name=attending][value=yes]");
    await p.click("#addAttendee");
    await p.fill("#attendeeList li:nth-child(3) [name=att-name]", "Petit Mbuyi");
    assert.equal(await p.isHidden("#addAttendee"), true);
    await p.click("[data-lang=en]");
    assert.deepEqual(await p.$$eval("#attendeeList [name=att-name]", (e) => e.map((x) => x.value)), ["Marie Mbuyi", "Jean Mbuyi", "Petit Mbuyi"]);
    await p.click("#rsvpForm button[type=submit]");
    await p.waitForSelector("[data-pane=done]:not([hidden])");
    assert.match(await p.textContent("#doneTitle"), /can't wait/);
    assert.deepEqual(p.errors, []);
  });
  for (const mode of [{ reduced: true, name: "reduced motion" }, { blockGsap: true, name: "GSAP failed to load" }]) {
    await test(`${mode.name}: every chapter is still visible`, async () => {
      const p = await page(mode);
      await p.goto(url + "/", { waitUntil: "networkidle" });
      for (const sel of ["#heroNames", "#soulsTitle", "#storyTitle", ".milestone .ms-title", "#promiseTitle", "#revealTitle", ".reveal-date", "#cdTitle", ".event-card", "#rsvpTitle", "#giftsTitle", ".gal-item", "#faqTitle", "#finaleNames"]) {
        await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), sel);
        await p.waitForTimeout(80);
        const op = await p.evaluate((s) => { let e = document.querySelector(s), o = 1; while (e) { o *= +getComputedStyle(e).opacity; e = e.parentElement; } return o; }, sel);
        assert.ok(op > 0.95, `${sel} opacity ${op}`);
      }
      assert.ok(await p.evaluate(() => document.querySelector("#envelope").classList.contains("is-open")), "envelope opens without motion");
      // The blocked gsap.min.js itself logs one "Failed to load resource" — expected.
      assert.deepEqual(p.errors.filter((e) => !(mode.blockGsap && /Failed to load resource/.test(e))), []);
    });
  }
  await test("no horizontal scroll on a 360px phone", async () => {
    const p = await page({ viewport: { width: 360, height: 740 } });
    await p.goto(url + "/", { waitUntil: "networkidle" });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= 360, "scrollWidth " + sw);
  });
  await test("dashboard: sign in, approve a guestbook message, publish content", async () => {
    await post("/api/guestbook", { name: "Tante Odile", message: "Que Dieu bénisse votre union !", elapsed: 9000 });
    const p = await page({ viewport: { width: 1360, height: 900 } });
    await p.goto(url + "/admin"); await p.fill("[name=key]", ADMIN); await p.click("#loginForm button");
    await p.waitForSelector("#tiles .tile");
    await p.click("[data-tab=guestbook]");
    await p.locator("#gbAdmin li", { hasText: "Tante Odile" }).getByRole("button", { name: "Approve" }).click();
    await p.waitForTimeout(400);
    assert.ok((await fetch(url + "/api/guestbook").then((r) => r.json())).entries.some((e) => e.name === "Tante Odile"));
    await p.click("[data-tab=content]");
    await p.locator(".cf-sec", { hasText: "Ceremony" }).locator("input").first().fill("Pavilion");
    await p.click("#saveContent"); await p.waitForTimeout(400);
    assert.equal((await fetch(url + "/api/content").then((r) => r.json())).ceremony.venue, "Pavilion");
    assert.deepEqual(p.errors, []);
  });
  await browser.close();
}

server.close(); fake.close();
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
