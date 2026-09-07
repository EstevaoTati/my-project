/**
 * The demo account must be gone from what ships — in the bundle, not just on
 * the screen.
 *
 * It existed so a tester on a shared link could get in without an inbox, and it
 * earned its keep. But it put a working password (`Demo2024`) and its phone
 * number into the shipped JavaScript, where anyone can read them, and a
 * production build must not carry a set of credentials that opens an account.
 *
 * Hiding the button is not removal: the strings would still be in the bundle
 * and the account would still be seeded into storage. So this greps the built
 * artefact as well as driving the page — a UI assertion alone would pass
 * against a build that merely stopped rendering the card.
 *
 *   BUILD_DIR=../242konnect-web node tools/verify-no-demo.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BUILD = path.resolve(process.env.BUILD_DIR || "../242konnect-web");
const PORT = Number(process.env.PORT || 8106);
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".ttf": "font/ttf", ".ico": "image/x-icon", ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(BUILD, url === "/" ? "/index.html" : url);
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
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
    if (!r) throw new Error("assertion falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + e.message.split("\n")[0]);
    fails.push(label);
  }
};

/** Everything the demo account put into the bundle. */
const FORBIDDEN = [
  "Demo2024",
  "060000000",
  "demo@242konnect.cg",
  "Compte Démo",
  "démonstration",
  "Demo account",
  "demo account",
];

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  const bundleDir = path.join(BUILD, "_expo/static/js/web");
  const bundles = fs.readdirSync(bundleDir).filter((f) => f.endsWith(".js"));

  for (const token of FORBIDDEN) {
    await check(`the bundle does not contain "${token}"`, () => {
      for (const f of bundles) {
        if (fs.readFileSync(path.join(bundleDir, f), "utf8").includes(token))
          throw new Error(`found in ${f}`);
      }
      return true;
    });
  }

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
    await page.waitForTimeout(700);
  };

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
  await page.waitForTimeout(800);

  await check("the sign-in screen still works", async () => {
    await tap("text=J'ai déjà un compte");
    return !!(await vis('[aria-label="Numéro de téléphone ou e-mail"]'));
  });

  await check("it offers no demo shortcut", async () =>
    !(await vis('[aria-label*="démonstration"]')) && !(await vis("text=Version de démonstration")));

  await check("the demo number and password are refused like any other guess", async () => {
    await (await vis('[aria-label="Numéro de téléphone ou e-mail"]')).fill("060000000");
    await (await vis('[aria-label="Mot de passe"]')).fill("Demo2024");
    await tap('[aria-label="Se connecter"]');
    await page.waitForTimeout(1800);
    // The account must not exist, and the refusal must be the generic one that
    // does not reveal whether the number is registered.
    const refused = await vis("text=Identifiant ou mot de passe incorrect");
    const insideTheApp = await vis("text=Catégories");
    if (insideTheApp) throw new Error("the demo account still signs in");
    return !!refused;
  });

  await check("sign-up is still reachable", async () => {
    await tap('[aria-label="Créer un compte"]');
    return !!(await vis("text=Quel type de compte ?"));
  });

  await check("no page errors", () => errs.length === 0);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  errs.slice(0, 3).forEach((e) => console.log("   ! " + e));
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
