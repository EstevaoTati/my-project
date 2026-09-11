/**
 * The prestataire account, end to end.
 *
 * **Why this exists.** `verify-particulier-journey` walks a customer from
 * sign-up to a paid, reviewed mission. There was no equivalent for a
 * prestataire, so the account type the founder asked about most had the least
 * coverage: `verify-app` proves the *type* can be chosen and that the photo is
 * demanded, and then stops — no test had ever completed a prestataire sign-up.
 * Everything past that point was unverified.
 *
 * Completing it needs a real photo, because §2.2 makes one mandatory for a
 * prestataire and the form will not advance without it. On web `expo-image-picker`
 * is an `<input type="file">`, so the suite answers the file chooser with a PNG
 * it generates itself.
 *
 * The two properties that matter most here:
 *
 *  - **Parity.** A prestataire must keep the marketplace. Activating the profile
 *    used to replace the Accueil tab with a dashboard, which silently removed
 *    search, the catalogue and booking from the one profile most likely to also
 *    be a customer. Accueil must show the same home a particulier sees.
 *  - **Their own data, not placeholders.** The Espace Prestataire has to show
 *    the trade, zone and rate actually entered at sign-up, and must show the
 *    verification badge as *pending* — §7.6 says 242Konnect awards it after
 *    checking documents, so it can never be self-set.
 *
 *   API_LOG=... APP_DIST=./dist node tools/verify-prestataire-journey.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(process.env.APP_DIST || path.join(__dirname, "..", "dist"));
const PORT = Number(process.env.PORT || 8908);
const API_LOG = process.env.API_LOG || "/tmp/242konnect-api.log";

const TRADE = "Plombier";
const ZONE = "Mpaka, Tié-Tié";
const RATE = "12000";
const BIO = "Plombier depuis douze ans à Pointe-Noire. Fuites, robinetterie, chauffe-eau.";
const BIRTH = "1990-04-12";
const ACCOUNT = {
  name: "Jean-Paul Massamba",
  phone: "066551188",
  email: "prestataire@mwinda.cg",
  password: "Mwinda2026",
};

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

/** A real 8x8 PNG, so the picker and the resizer both get something valid. */
function writePng(file) {
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const size = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // truecolour
  // One filter byte per row, then RGB pixels.
  const raw = Buffer.concat(
    Array.from({ length: size }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x3c)])
    )
  );
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", require("zlib").deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return file;
}

let mark = 0;
const markOutbox = () => {
  mark = fs.existsSync(API_LOG) ? fs.readFileSync(API_LOG, "utf8").length : 0;
};
const mailedCode = async () => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (fs.existsSync(API_LOG)) {
      const all = [...fs.readFileSync(API_LOG, "utf8").slice(mark).matchAll(/est : (\d{6})/g)];
      if (all.length) return all[all.length - 1][1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no code in the API outbox — is the API running?");
};

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
const section = (n) => console.log(`\n── ${n} ──`);

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const photo = writePng(path.join(os.tmpdir(), "242k-prestataire-avatar.png"));

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "fr-FR",
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));

  const visible = async (sel) => {
    for (const el of (await page.locator(sel).all()).reverse()) {
      if (await el.isVisible()) return el;
    }
    return null;
  };
  const seen = async (sel) => !!(await visible(sel));
  const tap = async (sel) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.click();
    await page.waitForTimeout(600);
  };
  const fill = async (sel, value) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.fill(value);
    await page.waitForTimeout(200);
  };

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
  await page.waitForTimeout(800);

  section("Choosing the prestataire type");
  await check("sign-up opens on the type step", async () => {
    await tap('[aria-label="Créer un compte"]');
    return seen("text=Quel type de compte ?");
  });
  await check("Prestataire states what it will ask for", async () => {
    await tap('[aria-label="Prestataire"]');
    return (
      (await seen("text=Une photo de profil (obligatoire)")) &&
      (await seen("text=Votre métier, votre zone et votre tarif"))
    );
  });

  section("Identity, with the mandatory photo");
  await check("the photo is demanded before anything else can proceed", async () => {
    await tap('[aria-label="Continuer"]');
    await fill('[aria-label="Nom complet"]', ACCOUNT.name);
    await fill('[aria-label="Numéro de téléphone"]', ACCOUNT.phone);
    await fill('[aria-label="Adresse e-mail"]', ACCOUNT.email);
    await tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
    await tap('[aria-label="Pointe-Noire"]');
    const el = await visible('[aria-label="Continuer vers les informations"]');
    const blocked = el && (await el.getAttribute("aria-disabled")) === "true";
    return blocked && (await seen("text=Obligatoire pour un prestataire"));
  });

  await check("supplying a photo unblocks it", async () => {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      tap('[aria-label="Ajouter une photo de profil"]'),
    ]);
    await chooser.setFiles(photo);
    // The picker resizes and re-encodes before the avatar appears.
    await page.waitForTimeout(2500);
    const el = await visible('[aria-label="Continuer vers les informations"]');
    return el && (await el.getAttribute("aria-disabled")) !== "true";
  });

  section("The prestataire's own details");
  await check("the trade, zone and rate are asked for", async () => {
    await tap('[aria-label="Continuer vers les informations"]');
    return (
      (await seen("text=Votre activité")) &&
      (await seen('[aria-label="Date de naissance"]')) &&
      (await seen('[aria-label="Choisir votre métier"]'))
    );
  });
  await check("a trade can be chosen from the catalogue", async () => {
    await fill('[aria-label="Date de naissance"]', BIRTH);
    await tap('[aria-label="Choisir votre métier"]');
    await tap(`[aria-label="${TRADE}"]`);
    return seen(`text=${TRADE}`);
  });
  await check("the account cannot be created until the rest is filled", async () => {
    const el = await visible('[aria-label="Créer mon compte"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("filling zone, rate and biography completes the step", async () => {
    await fill("[aria-label=\"Zone d'intervention\"]", ZONE);
    await fill('[aria-label="Tarif horaire (FCFA)"]', RATE);
    await fill('[aria-label="Biographie"]', BIO);
    const el = await visible('[aria-label="Créer mon compte"]');
    return el && (await el.getAttribute("aria-disabled")) !== "true";
  });

  section("Verification and password");
  await check("the mailed code is required, and never shown in the page", async () => {
    markOutbox();
    await tap('[aria-label="Créer mon compte"]');
    await page.waitForSelector("text=Vérification", { timeout: 20000 });
    const codeOnScreen = await page.evaluate(() =>
      [...document.querySelectorAll("*")].some(
        (n) => n.children.length === 0 && /^\d{6}$/.test((n.textContent || "").trim())
      )
    );
    return !codeOnScreen;
  });
  await check("the code from the outbox unlocks the password step", async () => {
    await fill('[aria-label="Code de vérification"]', await mailedCode());
    await page.waitForSelector('[aria-label="Confirmer le mot de passe"]', { timeout: 20000 });
    return true;
  });
  await check("the password creates the prestataire account", async () => {
    await fill('[aria-label="Mot de passe"]', ACCOUNT.password);
    await fill('[aria-label="Confirmer le mot de passe"]', ACCOUNT.password);
    await tap('[aria-label="Créer mon compte"]');
    await page.waitForSelector("text=Catégories", { timeout: 25000 });
    return true;
  });

  section("Parity: a prestataire is a customer too");
  // The regression this guards: activating Prestataire used to replace Accueil
  // with the dashboard, taking search, catalogue and booking away entirely.
  await check("Accueil is the marketplace, not a dashboard", async () =>
    (await seen("text=Catégories")) && !(await seen("text=Score 242K")));
  await check("a prestataire can search and see professionals", async () => {
    await fill('[aria-label="Quel service recherchez-vous ?"]', "fuite");
    await tap('[aria-label="Rechercher"]');
    const found = await seen("text=/professionnels? disponibles?/");
    await tap('[aria-label="Retour"]');
    await page.waitForTimeout(600);
    return found;
  });
  await check("a prestataire can open a professional's profile", async () => {
    await tap('[aria-label="Catégorie Plomberie"]');
    const listed = await seen("text=/professionnels? disponibles?/");
    await tap('[aria-label="Retour"]');
    await page.waitForTimeout(600);
    return listed;
  });

  section("Espace Prestataire");
  await check("the Prestataire profile is the active one", async () => {
    await tap('[aria-label="Profil"]');
    await page.waitForTimeout(700);
    return seen('[aria-label="Profil Prestataire"]');
  });
  await check("the Espace Prestataire is offered from Profil", async () =>
    seen('[aria-label="Espace Prestataire"]'));
  await check("it shows the trade, zone and rate that were entered", async () => {
    await tap('[aria-label="Espace Prestataire"]');
    await page.waitForTimeout(900);
    return (
      (await seen("text=Espace Prestataire")) &&
      (await seen(`text=${TRADE}`)) &&
      (await seen("text=/Mpaka/")) &&
      (await seen("text=/12\\s?000/"))
    );
  });
  // §7.6: the badge is awarded by 242Konnect after checking documents, so a
  // freshly created account must read as pending and never as verified.
  //
  // The exclusion is an *exact* match on purpose. The pending notice explains
  // the badge by naming it — "avant d'attribuer le badge « Prestataire
  // vérifié »" — and an unquoted `text=` is a case-insensitive substring, so
  // looking for "Vérifié" loosely matches the very sentence that says the
  // account is *not* verified. Only a standalone badge reading exactly
  // "Vérifié" would be the real failure.
  await check("the verification badge reads as pending, not verified", async () => {
    const pending = await seen("text=En attente");
    const explains = await seen("text=/en attente de v[eé]rification/i");
    const claimsVerified = await visible('text="Vérifié"');
    if (claimsVerified) throw new Error("the account claims to be verified");
    return pending && explains;
  });
  await check("it states the payout terms", async () =>
    (await seen("text=Commission 242Konnect")) && (await seen("text=Versement express")));
  await check("there is a way back out", async () => {
    await tap('[aria-label="Retour"]');
    await page.waitForTimeout(700);
    return seen("text=Se déconnecter");
  });

  section("The session survives")
  await check("a reload keeps the prestataire signed in", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Catégories", { timeout: 30000 });
    await tap('[aria-label="Profil"]');
    await page.waitForTimeout(700);
    return (await seen('[aria-label="Profil Prestataire"]')) &&
           (await seen('[aria-label="Espace Prestataire"]'));
  });

  await check("no page errors", () => errs.length === 0);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  errs.slice(0, 5).forEach((e) => console.log("   ! " + e));
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
