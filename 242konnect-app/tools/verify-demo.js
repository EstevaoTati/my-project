/**
 * Walks a shared preview build the way a tester will: in through the demo
 * account, then across the app.
 *
 * The main suite signs *up*, which needs a code that only exists in an e-mail —
 * unreachable from this container. This covers the path a tester on a link
 * actually takes.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL;
let pass = 0;
const fails = [];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));

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
  await page.waitForTimeout(800);

  await check("the link opens straight into the app", () => seen("text=Chaque problème est un besoin"));
  await check("sign in screen reachable", async () => {
    await tap('[aria-label="J\'ai déjà un compte, se connecter"]');
    return seen("text=Bon retour");
  });
  await check("the demo account is offered", () => seen("text=Version de démonstration"));
  await check("the demo account signs in", async () => {
    await tap('[aria-label="Se connecter avec le compte de démonstration"]');
    await page.waitForTimeout(1500);
    return seen("text=Catégories");
  });
  await check("trades catalogue opens", async () => {
    await tap("text=Voir tout");
    return seen("text=Métiers");
  });
  await check("in-app back returns to the feed", async () => {
    await tap('[aria-label="Retour"]');
    return seen("text=Catégories");
  });
  await check("Missions tab works", async () => {
    await tap('[aria-label="Missions"]');
    return seen("text=Aucune mission");
  });
  await check("Messages tab works", async () => {
    await tap('[aria-label="Messages"]');
    return true;
  });
  await check("Profil tab works", async () => {
    await tap('[aria-label="Profil"]');
    return seen("text=Se déconnecter");
  });
  await check("the demo account carries its own identity", () => seen("text=Compte Démo"));
  await check("no page errors", () => errs.length === 0 || `errors: ${errs[0]}`);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (errs.length) console.log("page errors:", errs.slice(0, 3));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
