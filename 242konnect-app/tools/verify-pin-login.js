/**
 * The personal PIN, and accounts that live in Supabase — end to end.
 *
 *  1. Sign-up ends on the PIN, and setting it opens the app straight away.
 *  2. The account, its consents and its PIN are stored server-side.
 *  3. Opening the app again asks for the PIN only — that is the log-in.
 *  4. A wrong PIN is refused; the right one opens the app.
 *  5. After signing out: e-mail + password (checked by Supabase), then the PIN.
 *  6. On a brand-new device (empty storage): the same log-in works, and the
 *     profile and consents come back from Supabase — nothing to fill in again.
 *  7. A device that does not know about the PIN offers "change", never a
 *     second "define" — the bug seen in production (three 400s).
 *  8. An account from before the password moved to Supabase is migrated on
 *     its next sign-in.
 *
 * Runs against tools/lib/fake-supabase.js (supabase.co is unreachable from the
 * build environment), with a build pointed at it:
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8990 EXPO_PUBLIC_SUPABASE_ANON_KEY=test-key \
 *     EXPO_PUBLIC_API_URL= npx expo export --platform web --clear --output-dir dist-market
 *   APP_DIST=$PWD/dist-market node tools/verify-pin-login.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createFakeSupabase } = require("./lib/fake-supabase");
const { acceptConsents } = require("./lib/account");

const ROOT = process.env.APP_DIST || path.resolve(__dirname, "..", "dist-market");
const PORT = 8998;
const OUTBOX = path.join(os.tmpdir(), "242k-fake-supabase-pin.log");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const EMAIL = "client@mwinda.cg";
const PASSWORD = "Mwinda2026";
const PIN = "428317";

const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(200, { "Content-Type": "text/html" });
    return fs.createReadStream(path.join(ROOT, "index.html")).pipe(res);
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try {
    if (!(await fn())) throw new Error("assertion returned falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + String(e.message).split("\n")[0]);
    fails.push(label);
  }
};
const section = (name) => console.log(`\n── ${name} ──`);

function helpers(page) {
  const visible = async (sel) => {
    for (const el of (await page.locator(sel).all()).reverse()) if (await el.isVisible()) return el;
    return null;
  };
  const tap = async (sel) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.click();
    await page.waitForTimeout(600);
  };
  const fill = async (sel, v) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.fill(v);
    await page.waitForTimeout(250);
  };
  const seen = async (sel) => !!(await visible(sel));
  const waitSeen = async (sel, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await seen(sel)) return true;
      await page.waitForTimeout(400);
    }
    return false;
  };
  return { tap, fill, seen, waitSeen };
}

const latestCode = async (email) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const m = [...fs.readFileSync(OUTBOX, "utf8").matchAll(new RegExp(`pour ${email.replace(/[.@]/g, "\\$&")} est : (\\d{6})`, "g"))];
    if (m.length) return m[m.length - 1][1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no code for " + email);
};

(async () => {
  const fake = createFakeSupabase({ port: 8990, outbox: OUTBOX });
  await fake.listen();
  await new Promise((r) => site.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const newDevice = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3500); // splash
    return page;
  };

  section("Sign-up ends on the PIN, then straight into the app");
  const pa = await newDevice();
  const a = helpers(pa);
  await check("sign-up reaches the PIN step", async () => {
    await a.waitSeen("text=Chaque problème est un besoin");
    await a.tap('[aria-label="Créer un compte"]');
    await a.tap('[aria-label="Continuer"]');
    await a.fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await a.fill('[aria-label="Numéro de téléphone"]', "066554433");
    await a.fill('[aria-label="Adresse e-mail"]', EMAIL);
    await a.tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
    await a.tap('[aria-label="Pointe-Noire"]');
    await a.tap('[aria-label="Continuer vers les informations"]');
    await a.fill('[aria-label="Adresse complète"]', "Avenue Tiboti 12, Mpaka");
    await a.fill("[aria-label=\"Référence de l'adresse\"]", "En face du marché");
    await a.tap('[aria-label="Continuer vers les consentements"]');
    await acceptConsents(pa);
    await a.tap('[aria-label="Créer mon compte"]');
    await a.waitSeen("text=Vérification");
    await a.fill('[aria-label="Code de vérification"]', await latestCode(EMAIL));
    await a.waitSeen('[aria-label="Confirmer le mot de passe"]');
    await a.fill('[aria-label="Mot de passe"]', PASSWORD);
    await a.fill('[aria-label="Confirmer le mot de passe"]', PASSWORD);
    await a.tap('[aria-label="Créer mon compte"]');
    return a.waitSeen('[aria-label="Nouveau code"]');
  });
  await check("the password is stored by Supabase, not only on the phone", async () => fake.serverPassword(EMAIL) === PASSWORD);
  await check("setting the PIN opens the app straight away", async () => {
    await a.fill('[aria-label="Nouveau code"]', PIN);
    await a.fill('[aria-label="Confirmer le code"]', PIN);
    await a.tap('[aria-label="Définir mon code"]');
    return a.waitSeen("text=Catégories", 15000);
  });
  await check("the PIN is stored server-side", async () => fake.hasPin(EMAIL));
  await check("the full account is in Supabase", async () => {
    const [row] = [...fake.profiles.values()];
    return !!row && row.full_name === "Estevao Macumba" && row.email === EMAIL && row.particulier?.address === "Avenue Tiboti 12, Mpaka";
  });
  await check("the consents are in Supabase", async () =>
    ["terms", "privacy", "marketing"].every((k) => fake.consents.some((c) => c.kind === k)));

  section("Opening the app again: the PIN is the log-in");
  await check("reopening asks for the PIN only", async () => {
    await pa.reload({ waitUntil: "networkidle" });
    return (await a.waitSeen("text=Bonjour, Estevao")) && !(await a.seen("text=Catégories")) && !(await a.seen('[aria-label="Mot de passe"]'));
  });
  await check("a wrong PIN is refused", async () => {
    await a.fill('[aria-label="Code confidentiel"]', "111222");
    return a.waitSeen("text=/Code incorrect/");
  });
  await check("the right PIN opens the app", async () => {
    await a.fill('[aria-label="Code confidentiel"]', PIN);
    return a.waitSeen("text=Catégories");
  });

  section("After signing out: password checked by Supabase, then the PIN");
  await check("sign-in with e-mail + password asks for the PIN", async () => {
    await a.tap('[aria-label="Profil"]');
    await a.tap('[aria-label="Se déconnecter"]');
    await a.waitSeen('[aria-label="Numéro de téléphone ou e-mail"]');
    await a.fill('[aria-label="Numéro de téléphone ou e-mail"]', EMAIL);
    await a.fill('[aria-label="Mot de passe"]', PASSWORD);
    await a.tap('[aria-label="Se connecter"]');
    return a.waitSeen('[aria-label="Code confidentiel"]');
  });
  await check("the PIN completes it — no e-mail code needed", async () => {
    await a.fill('[aria-label="Code confidentiel"]', PIN);
    return a.waitSeen("text=Catégories");
  });

  section("A brand-new device: everything comes back from Supabase");
  const pb = await newDevice();
  const b = helpers(pb);
  await check("a phone number alone is not enough on a new device", async () => {
    await b.waitSeen("text=Chaque problème est un besoin");
    await b.tap("text=J'ai déjà un compte");
    await b.fill('[aria-label="Numéro de téléphone ou e-mail"]', "066554433");
    await b.fill('[aria-label="Mot de passe"]', PASSWORD);
    await b.tap('[aria-label="Se connecter"]');
    return b.waitSeen("text=/connectez-vous avec votre adresse e-mail/");
  });
  await check("e-mail + password, then the PIN, opens the app", async () => {
    await b.fill('[aria-label="Numéro de téléphone ou e-mail"]', EMAIL);
    await b.tap('[aria-label="Se connecter"]');
    await b.waitSeen('[aria-label="Code confidentiel"]');
    await b.fill('[aria-label="Code confidentiel"]', PIN);
    return b.waitSeen("text=Catégories");
  });
  await check("the profile is restored and consents are not asked again", async () => {
    await b.tap('[aria-label="Profil"]');
    return (await b.waitSeen("text=Estevao Macumba")) && !(await b.seen("text=Mise à jour des conditions"));
  });
  await check("this device offers to change the PIN, not to define a second one", async () =>
    b.waitSeen('[aria-label="Changer mon code confidentiel"]', 8000));
  await check("changing the PIN with the current one works", async () => {
    await b.tap('[aria-label="Changer mon code confidentiel"]');
    await b.fill('[aria-label="Code actuel"]', PIN);
    await b.fill('[aria-label="Nouveau code"]', "593104");
    await b.fill('[aria-label="Confirmer le code"]', "593104");
    await b.tap('[aria-label="Changer mon code"]');
    // Like setting it, changing it lands straight back in the app.
    return (await b.waitSeen("text=Catégories")) && fake.pinOf(EMAIL) === "593104";
  });

  section("An account from before the password moved to Supabase");
  await check("its next sign-in on this device migrates the password", async () => {
    fake.forgetServerPassword(EMAIL);
    await b.tap('[aria-label="Profil"]');
    await b.tap('[aria-label="Se déconnecter"]');
    // First launch on this device: sign-out returns to the welcome screen.
    if (!(await b.waitSeen('[aria-label="Numéro de téléphone ou e-mail"]', 3000))) await b.tap("text=J'ai déjà un compte");
    await b.waitSeen('[aria-label="Numéro de téléphone ou e-mail"]');
    await b.fill('[aria-label="Numéro de téléphone ou e-mail"]', EMAIL);
    await b.fill('[aria-label="Mot de passe"]', PASSWORD);
    await b.tap('[aria-label="Se connecter"]');
    await b.waitSeen('[aria-label="Code de vérification"]');
    await b.fill('[aria-label="Code de vérification"]', await latestCode(EMAIL));
    await b.waitSeen("text=Catégories");
    return fake.serverPassword(EMAIL) === PASSWORD;
  });

  await check("no page errors", async () => errors.length === 0);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  errors.slice(0, 5).forEach((e) => console.log("   ! " + e));
  await browser.close();
  site.close();
  fake.close();
  process.exit(fails.length ? 1 : 0);
})();
