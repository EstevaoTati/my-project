/**
 * The 6-digit PIN screens, and the one property that matters most about them:
 * **nothing about the PIN is decided on the device.**
 *
 * The hashing, the comparison and the attempt count all live in the `pin` Edge
 * Function, so the interesting assertions here are about what the app refuses
 * to do on its own — it will not accept a PIN it cannot send anywhere, and it
 * will not pretend one was stored.
 *
 * Run against the shareable build (Supabase configured, demo account enabled):
 *   BASE_URL=http://127.0.0.1:8081/ node tools/verify-pin.js
 *
 * The demo account is deliberately the subject. It has no Supabase user behind
 * it — that is the whole point of a local demo account — so the "define a PIN"
 * path has no session to spend and must say so rather than quietly succeed.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL;
let pass = 0;
const fails = [];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));

  const vis = async (s) => {
    for (const e of (await page.locator(s).all()).reverse()) if (await e.isVisible()) return e;
    return null;
  };
  const tap = async (s) => {
    const e = await vis(s);
    if (!e) throw new Error("not visible: " + s);
    await e.click();
    await page.waitForTimeout(600);
  };
  const fill = async (s, v) => {
    const e = await vis(s);
    if (!e) throw new Error("not visible: " + s);
    await e.fill(v);
    await page.waitForTimeout(250);
  };
  const seen = async (s) => !!(await vis(s));
  const check = async (label, fn) => {
    try {
      const r = await fn();
      if (!r) throw new Error("assertion falsy");
      console.log("  ✓ " + label);
      pass++;
    } catch (e) {
      console.log("  ✗ " + label + " — " + e.message.split("\n")[0]);
      fails.push(label);
    }
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
  await page.waitForTimeout(900);

  await tap("text=J'ai déjà un compte");
  await tap('[aria-label="Se connecter avec le compte de démonstration"]');
  await page.waitForSelector("text=Catégories", { timeout: 20000 });

  await check("the account screen offers a PIN", async () => {
    await tap('[aria-label="Profil"]');
    return seen('[aria-label="Définir un code confidentiel"]');
  });

  await check("it opens the PIN screen", async () => {
    await tap('[aria-label="Définir un code confidentiel"]');
    return (await seen('[aria-label="Nouveau code"]')) && (await seen('[aria-label="Confirmer le code"]'));
  });

  await check("it says the PIN is not kept on the device", () =>
    seen("text=n'est jamais enregistré sur cet appareil"));

  await check("an obvious PIN is refused before it is sent", async () => {
    await fill('[aria-label="Nouveau code"]', "123456");
    await page.waitForTimeout(400);
    return seen("text=Évitez des chiffres qui se suivent");
  });

  await check("a repeated pattern is refused too", async () => {
    await fill('[aria-label="Nouveau code"]', "121212");
    await page.waitForTimeout(400);
    return seen("text=Évitez un motif qui se répète");
  });

  await check("two different PINs are refused", async () => {
    await fill('[aria-label="Nouveau code"]', "428317");
    await fill('[aria-label="Confirmer le code"]', "428318");
    await page.waitForTimeout(400);
    return seen("text=Les deux codes ne correspondent pas");
  });

  await check("the PIN is never rendered as a readable number", async () => {
    await fill('[aria-label="Confirmer le code"]', "428317");
    await page.waitForTimeout(300);
    // The boxes show dots. A digit of the PIN sitting in its own text node is
    // what showing it would look like.
    return page.evaluate(() =>
      ![...document.querySelectorAll("*")].some(
        (n) => n.children.length === 0 && /^[428317]$/.test((n.textContent || "").trim())
      )
    );
  });

  // The honest failure. The demo account has no Supabase user, so there is no
  // session to authorise the write — and the app says so instead of reporting a
  // PIN it never stored.
  await check("with no verified session it refuses rather than pretends", async () => {
    await tap('[aria-label="Définir mon code"]');
    await page.waitForTimeout(2500);
    return (
      (await seen("text=session de vérification a expiré")) ||
      (await seen("text=Impossible de joindre")) ||
      (await seen("text=indisponible"))
    );
  });

  await check("nothing claims a PIN was set", async () => !(await seen("text=Changer mon code confidentiel")));

  // The PIN screen is a root-level gate, not a card inside the account stack —
  // it has to be, because the same screen is offered straight after sign-up
  // when there is no stack to sit in. Dismissing it therefore lands on the home
  // tab rather than back on Profil.
  await check("skipping returns to the app", async () => {
    await tap('[aria-label="Plus tard"]');
    await page.waitForTimeout(1000);
    return seen("text=Catégories");
  });

  await check("no page errors", () => errs.length === 0);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  errs.slice(0, 5).forEach((e) => console.log("   ! " + e));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
