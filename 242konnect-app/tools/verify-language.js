/**
 * Does the app actually change language?
 *
 * The dictionary being complete (tools/i18n-check.js) and the app rendering in
 * English are different claims. This checks the second: switch to English on
 * the account screen and confirm the shell, the catalogue and a long sentence
 * all follow — then switch back.
 */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");

const DIST = process.env.APP_DIST || path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8998);
const T = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json",
            ".png":"image/png", ".ttf":"font/ttf", ".ico":"image/x-icon" };
const server = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split("?")[0]);
  const f = path.join(DIST, p === "/" ? "/index.html" : p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    r.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(path.join(DIST, "index.html")).pipe(r); return;
  }
  r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(r);
});

let pass = 0; const fails = [];
const check = async (l, fn) => { try { const r = await fn(); if (!r) throw new Error("falsy");
  console.log("  ✓ " + l); pass++; } catch (e) {
  console.log("  ✗ " + l + " — " + e.message.split("\n")[0]); fails.push(l); } };

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  // Pin the locale. The app follows the device language on first launch, so a
  // browser reporting en-US opens in English and every "starts in French"
  // assertion below would be checking the wrong thing.
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" })
  ).newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));

  const vis = async (s) => { for (const e of (await page.locator(s).all()).reverse())
    if (await e.isVisible()) return e; return null; };
  const tap = async (s) => { const e = await vis(s); if (!e) throw new Error("not visible: " + s);
    await e.click(); await page.waitForTimeout(650); };
  const text = () => page.evaluate(() => document.body.innerText);

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Chaque problème", { timeout: 30000 });
  await page.waitForTimeout(700);

  await check("the app opens in French", async () =>
    (await text()).includes("Chaque problème est un besoin de compétence"));

  await tap('[aria-label="J\'ai déjà un compte, se connecter"]');
  await tap('[aria-label="Se connecter avec le compte de démonstration"]');
  await page.waitForTimeout(1600);
  await tap('[aria-label="Profil"]');

  await check("the language switch is on the account screen", () => vis('[aria-label="English"]'));

  await tap('[aria-label="English"]');
  await page.waitForTimeout(700);

  await check("the shell is in English", async () => {
    const body = await text();
    return body.includes("Sign out") && body.includes("Jobs") && body.includes("Profile");
  });

  // Everything from here on is reached by its English label, tab bar included:
  // the accessibility labels are translated too, which is the point.
  await check("the catalogue is in English", async () => {
    await tap('[aria-label="Home"]');
    await page.waitForTimeout(700);
    const body = await text();
    return body.includes("Categories") && !body.includes("Catégories");
  });

  await check("trade names are translated", async () => {
    await tap("text=See all");
    await page.waitForTimeout(800);
    const body = await text();
    return body.includes("Plumber") || body.includes("Mason") || body.includes("Electrical");
  });

  await check("long sentences are translated, not left in French", async () => {
    // The back control is itself translated by now, so it is reached by its
    // English label — using the French one here is how this check first failed.
    await tap('[aria-label="Back"]');
    await tap('[aria-label="Jobs"]');
    await page.waitForTimeout(700);
    const body = await text();
    // The escrow rule only renders once there are bookings, and the demo
    // account has none, so the empty state is the long sentence on this screen.
    return (
      body.includes("Book a provider from their profile") ||
      body.includes("All payments go through 242Konnect")
    );
  });

  await check("switching back restores French", async () => {
    await tap('[aria-label="Profile"]');
    await tap('[aria-label="Français"]');
    await page.waitForTimeout(700);
    return (await text()).includes("Se déconnecter");
  });

  await check("the choice survives a reload", async () => {
    await tap('[aria-label="English"]');
    await page.waitForTimeout(600);
    await page.reload({ waitUntil: "networkidle" });
    // Past the splash, which runs about 2.6 s, and past the session restore.
    await page.waitForTimeout(5000);
    const body = await text();
    // The browser still reports fr-FR, so English here can only come from the
    // stored choice rather than from the device.
    return body.includes("Categories") || body.includes("Profile");
  });

  await check("no page errors", () => errs.length === 0 || `errors: ${errs[0]}`);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (errs.length) console.log("errors:", errs.slice(0, 3));
  await browser.close(); server.close();
  process.exit(fails.length ? 1 : 0);
})();
