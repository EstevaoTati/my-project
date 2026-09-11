/**
 * The app must work over plain http, on a host that is not localhost.
 *
 * **The bug this pins.** Passwords are hashed with `expo-crypto`, which on web
 * calls `crypto.subtle`. WebCrypto is only exposed in a *secure context* —
 * https, or the special-cased localhost/127.0.0.1. Open the same build on a LAN
 * address or an http preview host and the browser refuses:
 *
 *     Access to the WebCrypto API is restricted to secure origins (localhost/https)
 *
 * Sign-up and sign-in both hash a password before they can do anything, so the
 * whole app stopped authenticating. `src/sha256.ts` is the fallback.
 *
 * **Why the suite cannot just use localhost.** It is a secure context by
 * definition, so a test served from it can never see this failure. Chromium is
 * launched here with `--host-resolver-rules` so a made-up hostname resolves to
 * the loopback server without being treated as trustworthy. The first two
 * assertions confirm the hostile condition was actually reproduced — without
 * them a green run would prove nothing at all.
 *
 *   API_LOG=/tmp/242konnect-api.log APP_DIST=./dist node tools/verify-insecure-origin.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { signUp } = require("./lib/account");

const ROOT = path.resolve(process.env.APP_DIST || path.join(__dirname, "..", "dist"));
const PORT = Number(process.env.PORT || 8907);
/** Anything but localhost/127.0.0.1: those are trusted whatever the scheme. */
const HOST = process.env.INSECURE_HOST || "lan.242konnect.test";

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".ttf": "font/ttf", ".ico": "image/x-icon", ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(path.join(ROOT, "index.html")).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try {
    const r = await fn();
    if (!r) throw new Error("assertion returned falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + e.message.split("\n")[0]);
    fails.push(label);
  }
};

(async () => {
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // Resolve the made-up host to the loopback server. The origin Chromium sees
    // stays `http://lan.242konnect.test:PORT`, which is not a secure context.
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));

  const base = `http://${HOST}:${PORT}/`;
  await page.goto(base, { waitUntil: "networkidle" });

  // If either of these two fails the rest is meaningless: the browser would be
  // in a secure context and the old code would have passed just as well.
  await check("the origin really is insecure", async () =>
    (await page.evaluate(() => window.isSecureContext)) === false);
  await check("crypto.subtle really is unavailable", async () =>
    (await page.evaluate(() => typeof (globalThis.crypto || {}).subtle)) === "undefined");

  await check("the app still paints", async () => {
    await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
    return true;
  });

  // The end-to-end proof: sign-up hashes a password, so completing it means the
  // fallback ran and produced something storable.
  const account = { phone: "066700077", email: "insecure@mwinda.cg", password: "Mwinda2026" };
  await check("a full sign-up completes without WebCrypto", async () => {
    await signUp(page, account);
    return true;
  });

  const visible = async (sel) => {
    for (const el of (await page.locator(sel).all()).reverse()) {
      if (await el.isVisible()) return el;
    }
    return null;
  };
  const tap = async (sel) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.click();
    await page.waitForTimeout(700);
  };

  // This context has never reloaded, so the app still counts it as a first
  // launch and sign-out lands on Bienvenue rather than Connexion. That is the
  // documented routing, not a fault, so the check follows it to the form.
  await check("signing out leaves the account", async () => {
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Se déconnecter"]');
    await page.waitForTimeout(1200);
    return !!(await visible("text=Chaque problème est un besoin"));
  });

  // The other half of the fallback: verifying a stored hash. A password hashed
  // without WebCrypto has to compare equal when read back, or accounts created
  // over http would be write-only.
  await check("the hash stored without WebCrypto verifies on sign-in", async () => {
    await tap('[aria-label="J\'ai déjà un compte, se connecter"]');
    await page.waitForTimeout(900);
    const id = await visible('[aria-label="Numéro de téléphone ou e-mail"]');
    if (!id) throw new Error("no sign-in form");
    await id.fill(account.phone);
    const pw = await visible('[aria-label="Mot de passe"]');
    await pw.fill(account.password);
    await tap('[aria-label="Se connecter"]');
    await page.waitForTimeout(2000);
    // The password is only the first factor, so success is the second-factor
    // screen. The generic refusal would mean the hash did not match.
    if (await visible("text=Identifiant ou mot de passe incorrect"))
      throw new Error("the stored hash did not verify");
    return !!(await visible('[aria-label="Code de vérification"]')) ||
           !!(await visible("text=Vérification"));
  });

  await check("no page errors", () => {
    // The secure-origin refusal surfaced as an uncaught error before the fix,
    // so an empty list here is the regression guard.
    const crypto = errs.filter((e) => /WebCrypto|secure origin|subtle/i.test(e));
    if (crypto.length) throw new Error(crypto[0]);
    return errs.length === 0;
  });

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  errs.slice(0, 5).forEach((e) => console.log("   ! " + e));
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
