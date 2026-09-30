/**
 * Drives every interactive control in the built app and asserts each one does
 * something. Serves the export over HTTP the way Netlify will.
 *
 * Two rules learned the hard way here:
 *  - Screens left mounted behind the current one keep their nodes in the DOM at
 *    0x0, so always act on the *visible* match, never `.first()`.
 *  - A falsy assertion is a failure, not a silent pass.
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.APP_DIST || require("path").resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8902);
const OUT = process.env.SHOT_DIR || require("os").tmpdir() + "/242konnect-shots";
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

// Point the suite at an already-running server (e.g. the deep, githack-shaped
// path) instead of the local root server it would otherwise start itself.
const BASE_URL = process.env.BASE_URL || null;

/**
 * The verification service's outbox.
 *
 * Sign-up needs a code that only ever exists in an e-mail, so this suite reads
 * it from where the API sent it rather than from the page — the page not having
 * it is the property under test. Run the API with its console transport and
 * build the app with EXPO_PUBLIC_API_URL pointing at it; `npm run verify` does
 * both.
 */
const API_LOG = process.env.API_LOG || "/tmp/242konnect-api.log";
let mailWatermark = 0;

/** Chosen after verification now, so the suite needs one that passes the rules. */
const SIGNUP_PASSWORD = "Mwinda2026";
/** A real image for the dossier's mandatory photo. */
const AVATAR = require("./lib/account").writePng(
  require("path").join(require("os").tmpdir(), "242k-app-avatar.png")
);

/** Marks the current end of the outbox, so the next read gets only new mail. */
const markOutbox = () => {
  mailWatermark = fs.existsSync(API_LOG) ? fs.readFileSync(API_LOG, "utf8").length : 0;
};

/** The most recent code the API mailed since the last `markOutbox()`. */
const mailedCode = () => {
  if (!fs.existsSync(API_LOG)) return null;
  const fresh = fs.readFileSync(API_LOG, "utf8").slice(mailWatermark);
  const all = [...fresh.matchAll(/est : (\d{6})/g)];
  return all.length ? all[all.length - 1][1] : null;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (!BASE_URL) await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({
    // Falls back to Playwright's own resolution when the env var is unset.
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  // Locale is pinned so the suite is deterministic. The app follows the
  // device language on first launch, so a browser reporting en-US opens it
  // in English and every French selector below silently misses.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "fr-FR",
  });
  const page = await ctx.newPage();

  const runtime = [];

  /**
   * Two checks deliberately provoke a rejection from the API — a wrong OTP code
   * (400) and an operator with no credentials (502) — and the browser logs both
   * as console errors. Those are the assertions passing, not the app breaking.
   *
   * Scoped to the exact endpoints rather than muting 4xx/5xx generally, so a
   * genuinely broken request still fails the run.
   */
  const expectedRejections = [];
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const url = r.url();
    if (url.includes("/auth/otp/verify") || url.includes("/payments/momo/"))
      expectedRejections.push(r.status());
  });
  const isProvoked = (text) =>
    expectedRejections.some((status) => text.includes(String(status))) &&
    /Failed to load resource/.test(text);

  page.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !isProvoked(m.text()) &&
      runtime.push("console: " + m.text().slice(0, 140))
  );
  page.on("pageerror", (e) => runtime.push("pageerror: " + e.message.slice(0, 140)));
  page.on("requestfailed", (r) => runtime.push("request failed: " + r.url().slice(0, 90)));

  const visible = async (sel) => {
    for (const el of (await page.locator(sel).all()).reverse()) {
      if (await el.isVisible()) return el;
    }
    return null;
  };
  const seen = async (sel) => !!(await visible(sel));

  /**
   * Any bare six-digit run rendered as its own text node — what showing the
   * code would look like. The OTP boxes hold one digit each, so an entered code
   * cannot produce a false positive here.
   */
  const codeOnScreen = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("*")].some(
        (n) => n.children.length === 0 && /^\d{6}$/.test((n.textContent || "").trim())
      )
    );
  const tap = async (sel) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.click();
    await page.waitForTimeout(600);
    return true;
  };
  const fill = async (sel, value) => {
    const el = await visible(sel);
    if (!el) throw new Error("not visible: " + sel);
    await el.fill(value);
    await page.waitForTimeout(250);
    return true;
  };

  let pass = 0;
  const failures = [];
  const check = async (label, fn) => {
    try {
      const r = await fn();
      if (!r) throw new Error("assertion returned falsy");
      console.log(`  ✓ ${label}`);
      pass++;
    } catch (e) {
      console.log(`  ✗ ${label} — ${e.message.split("\n")[0]}`);
      failures.push(label);
    }
  };
  const section = (name) => console.log(`\n── ${name} ──`);

  /**
   * The identity step asks where you live, so every path through it has to
   * answer. Congo defaults in, and the city is picked from the sheet.
   */
  const pickCity = async (city = "Pointe-Noire") => {
    await tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
    await tap(`[aria-label="${city}"]`);
    return true;
  };

  await page.goto(BASE_URL || `http://localhost:${PORT}/`, { waitUntil: "networkidle" });

  section("Splash & first launch");
  // The directives put a 2-3s logo animation before anything else. Assert it is
  // actually on screen rather than just waiting it out.
  await check("splash shows the mark on the brand ground", async () => {
    // The splash draws the official logo as SVG, not the word "242Konnect", and
    // its ground is theme.anthracite (#16181d) since the charte landed — the
    // near-black rgb(10,10,10) this used to look for is gone. Colours and
    // geometry of the mark itself are verify-logo.js's job; here it only has to
    // be on screen, at splash size rather than the small header lockup.
    return page.evaluate(() => {
      const mark = [...document.querySelectorAll("svg")].some(
        (s) => s.getBoundingClientRect().width > 150
      );
      const ground = [...document.querySelectorAll("div")].some(
        (d) => getComputedStyle(d).backgroundColor === "rgb(22, 24, 29)"
      );
      return mark && ground;
    });
  });
  await page.screenshot({ path: `${OUT}/s0-splash.png` });
  await check("splash hands off to Commencer on first launch", async () => {
    await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 25000 });
    return true;
  });
  await page.waitForTimeout(700);

  section("Welcome & account");
  await check("welcome screen", () => seen("text=Chaque problème est un besoin"));
  await check("Découvrir opens the presentation", async () => {
    await tap('[aria-label="Découvrir 242Konnect"]');
    return seen("text=Comment ça marche");
  });
  await check("presentation states the escrow rule", () => seen("text=jusqu'à ce que vous validiez"));
  await check("presentation closes", async () => { await tap('[aria-label="Fermer"]'); return seen("text=Créer un compte"); });
  await check("welcome to sign in", async () => { await tap("text=J'ai déjà un compte"); return seen("text=Bon retour"); });
  await check("sign in accepts phone or e-mail", () => seen('[aria-label="Numéro de téléphone ou e-mail"]'));
  await check("unknown credentials rejected", async () => {
    await fill('[aria-label="Numéro de téléphone ou e-mail"]', "061234567");
    await fill('[aria-label="Mot de passe"]', "mauvais");
    await tap('[aria-label="Se connecter"]');
    return seen("text=Identifiant ou mot de passe incorrect");
  });
  // Sign-up now opens on the type step, not a single form.
  await check("sign in to sign up", async () => { await tap("text=Créer un compte"); return seen("text=Quel type de compte ?"); });

  section("Two account formats");
  // Business was removed on the founder's instruction: an entreprise books the
  // same way a person does, so the third form earned nothing.
  // Client §04 / Prestataire §01: three roles are presented, but Business is
  // not selectable — it needs a separate request and 242Konnect's approval.
  await check("three roles shown, Business not selectable", async () => {
    const business = await visible('[aria-label="Business, sur demande"]');
    return (await seen('[aria-label="Particulier"]')) &&
      (await seen('[aria-label="Prestataire"]')) &&
      !!business && (await business.getAttribute("aria-disabled")) === "true";
  });
  await check("each type lists different requirements", async () => {
    await tap('[aria-label="Prestataire"]');
    const pro = await seen("text=Une photo de profil (obligatoire)");
    await tap('[aria-label="Particulier"]');
    const part =
      (await seen("text=Adresse complète et un repère")) &&
      !(await seen("text=Une photo de profil (obligatoire)"));
    return pro && part;
  });
  await page.screenshot({ path: `${OUT}/s1-types.png` });

  await check("identity step blocks Continuer while empty", async () => {
    await tap('[aria-label="Prestataire"]');
    await tap('[aria-label="Continuer"]');
    const el = await visible('[aria-label="Continuer vers les informations"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("the identity step uses neutral labels now Business is gone", async () => {
    // These two were relabelled per type ("Nom du responsable", "E-mail
    // professionnel") only because a Business existed. One type of person is
    // left, so the labels are plain again.
    await fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Adresse e-mail"]', "contact@mwinda.cg");
    await pickCity();
    return (await seen('[aria-label="Nom complet"]')) &&
           !(await seen('[aria-label="Nom du responsable"]')) &&
           !(await seen('[aria-label="E-mail professionnel"]'));
  });
  await page.screenshot({ path: `${OUT}/s2-prestataire.png` });

  // One step back now: the walk stopped on identity rather than reaching the
  // details form, because a prestataire cannot pass identity without a photo.
  await check("back to the type step", async () => {
    await tap('[aria-label="Retour"]');
    return seen("text=Quel type de compte ?");
  });

  await check("Prestataire requires a photo before continuing", async () => {
    await tap('[aria-label="Prestataire"]');
    await tap('[aria-label="Continuer"]');
    await fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Adresse e-mail"]', "estevao@mwinda.cg");
    await pickCity();
    const el = await visible('[aria-label="Continuer vers les informations"]');
    const blocked = el && (await el.getAttribute("aria-disabled")) === "true";
    return blocked && (await seen("text=Obligatoire pour un prestataire"));
  });

  await check("back out to Particulier", async () => {
    await tap('[aria-label="Retour"]');
    await tap('[aria-label="Particulier"]');
    return seen("text=Adresse complète et un repère");
  });

  section("Particulier sign-up, OTP and uniqueness");
  await check("identity step", async () => {
    await tap('[aria-label="Continuer"]');
    await fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Adresse e-mail"]', "estevao@mwinda.cg");
    await pickCity();
    await tap('[aria-label="Continuer vers les informations"]');
    return seen("text=Où intervenir ?");
  });
  await check("address and reference are required", async () => {
    const el = await visible('[aria-label="Continuer vers les consentements"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  // Client §06: "Empêcher la sélection de plus de trois intérêts".
  await check("a fourth interest cannot be selected", async () => {
    for (const i of ["Maison", "Bricolage", "Automobile"]) await tap(`[aria-label="Centre d'intérêt ${i}"]`);
    const fourth = await visible('[aria-label="Centre d\'intérêt Beauté"]');
    const blocked = fourth && (await fourth.getAttribute("aria-disabled")) === "true";
    return blocked && (await seen("text=/3\\/3/"));
  });
  await check("details continue to consent", async () => {
    await fill('[aria-label="Adresse complète"]', "Avenue Tiboti, Mpaka");
    await fill('[aria-label="Référence de l\'adresse"]', "En face du marché");
    await tap('[aria-label="Continuer vers les consentements"]');
    return seen("text=Consentements");
  });
  // Client §10: mandatory consents separate from the optional marketing one.
  await check("the account cannot be created without the mandatory consents", async () => {
    await tap('[aria-label="Je souhaite recevoir les nouveautés et offres de 242Konnect"]');
    const el = await visible('[aria-label="Créer mon compte"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("the terms can be read before accepting", async () => {
    await tap("[aria-label=\"Lire Conditions d'utilisation\"]");
    return seen("text=Paiements protégés");
  });
  await check("consents given, details move to verification", async () => {
    await tap("[aria-label=\"J'accepte les conditions d'utilisation\"]");
    await tap("[aria-label=\"J'accepte la politique de confidentialité\"]");
    markOutbox();
    await tap('[aria-label="Créer mon compte"]');
    await page.waitForTimeout(1000);
    return seen("text=Vérification");
  });
  // The code is not on the device and must not be: it is read from the
  // service's outbox, the way a user reads their inbox. See API_LOG below.
  await check("the app says to check the inbox, and shows no code", async () =>
    (await seen("text=Consultez votre boîte e-mail")) && !(await codeOnScreen()));
  await check("a wrong code is refused", async () => {
    await fill('[aria-label="Code de vérification"]', "000000");
    await page.waitForTimeout(1200);
    return seen("text=Code incorrect");
  });
  // Verification no longer creates the account: it unlocks the password step,
  // and that step creates it. Nothing exists until the address is proved.
  await check("the code from the e-mail unlocks the password step", async () => {
    const real = mailedCode();
    if (!real) throw new Error("no code in the outbox — is the API running?");
    await fill('[aria-label="Code de vérification"]', real);
    await page.waitForTimeout(1800);
    return seen('[aria-label="Mot de passe"]');
  });
  await check("a weak password is refused", async () => {
    await fill('[aria-label="Mot de passe"]', "1234");
    const el = await visible('[aria-label="Créer mon compte"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("the password creates the account", async () => {
    await fill('[aria-label="Mot de passe"]', SIGNUP_PASSWORD);
    await fill('[aria-label="Confirmer le mot de passe"]', SIGNUP_PASSWORD);
    await tap('[aria-label="Créer mon compte"]');
    await page.waitForTimeout(1800);
    return seen("text=Catégories");
  });

  section("Home header");
  await check("bell opens notifications", async () => {
    await tap('[aria-label*="Notifications"]');
    return seen("text=Jean-Paul K. a accepté votre demande");
  });
  await check("notifications close", async () => { await tap('[aria-label="Fermer"]'); return seen("text=Top Professionnels"); });
  await check("city picker opens", async () => {
    await tap('[aria-label*="Changer de ville"]');
    return seen("text=Brazzaville, Rép. du Congo");
  });
  await check("city selection applies", async () => {
    await tap('[aria-label="Brazzaville, Rép. du Congo"]');
    return seen("text=Brazzaville, Rép. du Congo");
  });

  section("Home actions");
  await check("search navigates", async () => {
    await fill('[aria-label="Quel service recherchez-vous ?"]', "urgence");
    await tap('[aria-label="Rechercher"]');
    return seen("text=/professionnels? disponibles?/");
  });
  await check("back home", async () => { await tap('[aria-label="Retour"]'); return seen("text=Catégories"); });
  await check("'Voir plus' to results", async () => { await tap("text=Voir plus"); return seen('[aria-label="Trier par Prix"]'); });
  await check("back home", async () => { await tap('[aria-label="Retour"]'); return seen("text=Catégories"); });

  section("Categories");
  for (const cat of ["Plomberie", "Électricité", "Construction & Bâtiment", "Automobile", "Informatique & Numérique"]) {
    await check(`category ${cat}`, async () => {
      await tap(`[aria-label="Catégorie ${cat}"]`);
      const ok = await seen("text=/professionnels? disponibles?/");
      await tap('[aria-label="Retour"]');
      return ok;
    });
  }

  section("Trades catalogue");
  await check("'Voir tout' opens the catalogue", async () => {
    await tap('[aria-label="Voir tous les métiers"]');
    return seen("text=Tous les métiers");
  });
  await check("trades are listed", () => seen("text=Débouchage"));
  await check("category chip filters", async () => {
    await tap('[aria-label="Catégorie Beauté & Bien-être"]');
    return seen("text=Coiffeuse");
  });
  await check("text search filters", async () => {
    await tap('[aria-label="Toutes les catégories"]');
    await fill('[aria-label="Rechercher un métier"]', "clim");
    return seen("text=Climatisation");
  });
  await check("a trade opens its professionals", async () => {
    await tap("text=Climatisation");
    return seen("text=/professionnels? disponibles?/");
  });
  await check("back to catalogue", async () => { await tap('[aria-label="Retour"]'); return seen("text=Tous les métiers"); });
  await check("back home", async () => { await tap('[aria-label="Retour"]'); return seen("text=Catégories"); });

  section("Results & filters");
  await check("open a category", async () => {
    await tap('[aria-label="Catégorie Plomberie"]');
    return seen("text=/professionnels? disponibles?/");
  });
  for (const s of ["Pertinence", "Prix", "Note (4+)", "Vérifié"]) {
    await check(`sort ${s}`, async () => {
      await tap(`[aria-label="Trier par ${s}"]`);
      return seen("text=/professionnels? disponibles?|Aucun professionnel/");
    });
  }
  await check("favourite toggles", async () => {
    await tap('[aria-label="Trier par Pertinence"]');
    await page.locator('[aria-label="Ajouter aux favoris"]').first().click();
    await page.waitForTimeout(500);
    return seen('[aria-label="Retirer des favoris"]');
  });

  section("Professional profile");
  await check("open a professional", async () => { await tap("text=Jean-Paul K."); return seen("text=À propos"); });
  await check("favourite carried from results", () => seen('[aria-label="Retirer des favoris"]'));
  await check("share doesn't crash", async () => { await tap('[aria-label="Partager"]'); return true; });
  await check("portfolio gallery opens", async () => {
    await tap('[aria-label="Voir tout le portfolio"]');
    return seen('[aria-label="Fermer la galerie"]');
  });
  await check("gallery closes", async () => { await tap('[aria-label="Fermer la galerie"]'); return seen("text=Compétences"); });
  await check("booking sheet opens", async () => {
    await tap('[aria-label^="Réserver Jean-Paul K."]');
    return seen("text=Choisissez un créneau");
  });
  await check("confirm disabled without a slot", async () => {
    const el = await visible('[aria-label="Confirmer la réservation"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("booking confirms", async () => {
    await tap("text=Demain, 09h00");
    await tap('[aria-label="Confirmer la réservation"]');
    return seen("text=C'est noté");
  });
  await check("confirmation closes", async () => { await tap("text=Terminé"); return seen("text=À propos"); });

  section("Messaging");
  await check("message opens the thread", async () => {
    await tap('[aria-label^="Envoyer un message"]');
    // The composer's label is on the input; `text=` matches content, not
    // placeholders, so assert via the accessibility label.
    return seen('[aria-label="Écrivez votre message"]');
  });
  await check("simulated-reply notice shown", () => seen("text=personne ne les reçoit"));
  await check("send a message", async () => {
    await fill('[aria-label="Écrivez votre message"]', "Bonjour, fuite sous l'évier.");
    await tap('[aria-label="Envoyer"]');
    return seen("text=fuite sous l'évier");
  });
  await page.screenshot({ path: `${OUT}/c0-chat.png` });
  // Assert the message preview specifically. "Jean-Paul K." alone also appears
  // on the results screen, so it passed once while messaging was broken.
  await check("thread listed in Messages", async () => {
    await tap('[aria-label="Retour"]');
    await page.screenshot({ path: `${OUT}/c0b-thread-list.png` });
    return seen('[aria-label="Conversation avec Jean-Paul K."]');
  });
  await check("thread reopens from the list", async () => {
    await tap('[aria-label="Conversation avec Jean-Paul K."]');
    return seen("text=fuite sous l'évier");
  });

  section("Missions, escrow & settlement");
  await check("mission listed", async () => { await tap('[aria-label="Missions"]'); return seen("text=Demain, 09h00"); });
  await check("the no-direct-payment rule is stated", () => seen("text=Ne remettez jamais d'argent directement"));
  // Commande §07: the request goes out only once the payment is authorised, so
  // nothing can be accepted before then.
  await check("an unpaid request has not been sent", async () =>
    (await seen("text=À payer")) && !(await seen("[aria-label^=\"Simuler l'acceptation\"]")));
  await check("payment opens on the order review", async () => {
    await tap('[aria-label^="Payer la mission"]');
    return (await seen("text=Moyen de paiement")) && (await seen("text=Récapitulatif de la commande"));
  });
  await check("the total authorised is shown with its fees", async () =>
    (await seen("text=Frais de protection 242Konnect")) && (await seen("text=Total autorisé")));
  await check("escrow explained before paying", () => seen("text=qu'après votre validation"));
  await check("the refund policy is shown before authorising", () => seen("text=Annulation et remboursement"));
  await check("cash is not offered", async () => !(await seen("text=Espèces")));
  await check("confirm disabled before a method", async () => {
    const el = await visible('[aria-label="Confirmer le paiement"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("Mobile Money asks for a number", async () => {
    await tap('[aria-label="MTN Mobile Money"]');
    return seen('[aria-label="Numéro Mobile Money"]');
  });
  await check("card does not ask for a number", async () => {
    await tap('[aria-label="Carte bancaire"]');
    return !(await seen('[aria-label="Numéro Mobile Money"]'));
  });
  // Mobile Money is asynchronous — the operator prompts the handset and we wait
  // — so it is checked on its own below. The escrow and settlement rules are
  // about the money, not the rail, so they run over the single-step card path.
  await check("Mobile Money warns when the number looks like the other operator", async () => {
    await tap('[aria-label="MTN Mobile Money"]');
    await fill('[aria-label="Numéro Mobile Money"]', "045550000");
    await page.waitForTimeout(400);
    return seen("text=ressemble à un numéro Airtel Money");
  });
  await check("the warning clears on the matching operator", async () => {
    await tap('[aria-label="Airtel Money"]');
    await page.waitForTimeout(400);
    return !(await seen("text=ressemble à un numéro"));
  });
  // Commande §06: an explicit authorisation before any debit.
  await check("paying needs an explicit authorisation", async () => {
    const el = await visible('[aria-label="Confirmer le paiement"]');
    const blocked = el && (await el.getAttribute("aria-disabled")) === "true";
    await tap("[aria-label=\"J'autorise le paiement\"]");
    return blocked;
  });
  await check("an unactivated operator is refused, not faked", async () => {
    await tap('[aria-label="Confirmer le paiement"]');
    // Either the operator refuses it, or the gateway is unconfigured and the
    // walkthrough runs; both must reach a real state, never a silent receipt.
    await page.waitForTimeout(2500);
    const refused = await seen("text=n'est pas encore activé");
    const prompting = await seen("text=Confirmez sur votre téléphone");
    if (prompting) await tap('[aria-label="Annuler le paiement"]');
    return refused || prompting;
  });
  await check("paying holds the funds", async () => {
    await tap('[aria-label="Carte bancaire"]');
    await tap('[aria-label="Confirmer le paiement"]');
    await page.waitForTimeout(600);
    return seen("text=242Konnect conserve ce montant");
  });
  await page.screenshot({ path: `${OUT}/c1-payment.png` });
  await check("receipt closes", async () => { await tap("text=Terminé"); return true; });
  await check("mission now reads as sent with funds held", () => seen("text=fonds bloqués"));
  await check("the prestataire accepts the paid request", async () => {
    await tap("[aria-label^=\"Simuler l'acceptation\"]");
    return seen("text=En route");
  });
  // Commande §08–§09: validation only once the work is completed.
  await check("validation waits for the work to be completed", async () =>
    !(await seen('[aria-label^="Valider la prestation"]')));
  await check("the mission moves through its stages", async () => {
    for (let i = 0; i < 4; i++) {
      await tap("[aria-label^=\"Simuler l'étape suivante\"]");
      await page.waitForTimeout(250);
    }
    return seen('[aria-label^="Valider la prestation"]');
  });

  await check("validation shows the settlement split", async () => {
    await tap('[aria-label^="Valider la prestation"]');
    return (await seen("text=Commission 242Konnect (12 %)")) && (await seen("text=Versé au prestataire"));
  });
  await check("express payout changes the fee", async () => {
    await tap('[aria-label="Versement express"]');
    return seen("text=Frais de versement (4 %)");
  });
  await check("standard payout is 1,25 % over 7 days", async () => {
    await tap('[aria-label="Versement standard"]');
    return (await seen("text=Frais de versement (1,25 %)")) && (await seen("text=Sous 7 jours"));
  });
  await page.screenshot({ path: `${OUT}/c1b-settlement.png` });
  await check("validating releases the funds", async () => {
    await tap('[aria-label="Confirmer la validation"]');
    return seen("text=versés au prestataire");
  });
  await check("settlement closes", async () => { await tap("text=Terminé"); return true; });
  await check("mission reads as validated", () => seen("text=Validée"));

  section("Profile editing");
  await check("open Profil", async () => { await tap('[aria-label="Profil"]'); return seen("text=Se déconnecter"); });
  // The dashboard is offered on profile ownership, so a particulier-only
  // account must not see it. Asserted here, before Prestataire is activated —
  // afterwards the account owns both and the row is meant to stay.
  await check("a particulier-only account is not offered the Espace Prestataire", async () =>
    !(await seen('[aria-label="Espace Prestataire"]')));
  await check("one account carries both profiles, and no Business", async () =>
    (await seen('[aria-label="Profil Particulier"]')) &&
    (await seen('[aria-label="Offrir mes services"]')) &&
    !(await seen('[aria-label="Activer le profil Business"]')) &&
    !(await seen('[aria-label="Profil Business"]')));
  // Client §14 / Prestataire §01: offering services opens a separate dossier
  // that lists what is needed — never a one-tap activation.
  await check("offering services opens a dossier, not an instant switch", async () => {
    await tap('[aria-label="Offrir mes services"]');
    await page.waitForTimeout(700);
    const el = await visible('[aria-label="Envoyer le dossier"]');
    return (await seen("text=Pièces nécessaires")) && el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("no pricing model is preselected", async () =>
    !(await seen('[aria-label="Montant"]')));
  await check("the dossier refuses an under-16 date of birth", async () => {
    await fill('[aria-label="Date de naissance"]', "2020-01-01");
    return seen("text=/16 ans et plus/");
  });
  await check("a complete dossier with a signed contract submits", async () => {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      tap('[aria-label="Ajouter une photo de profil"]'),
    ]);
    await chooser.setFiles(AVATAR);
    await page.waitForTimeout(2500);
    await fill('[aria-label="Date de naissance"]', "1992-06-15");
    await tap('[aria-label="Choisir votre métier"]');
    await tap('[aria-label="Plombier"]');
    await fill("[aria-label=\"Zone d'intervention\"]", "Mpaka");
    await tap('[aria-label="Modèle de prix À partir de"]');
    await fill('[aria-label="Montant"]', "9000");
    await tap('[aria-label="Prix négociable"]');
    await tap('[aria-label="Durée Quelques jours"]');
    await fill('[aria-label="Biographie"]', "Plombier à Pointe-Noire depuis 10 ans.");
    // The contract must be opened before it can be accepted, and the
    // signature must be the account's full name.
    const locked = await visible("[aria-label=\"J'ai lu et j'accepte le contrat Prestataire\"]");
    const wasLocked = locked && (await locked.getAttribute("aria-disabled")) === "true";
    await tap('[aria-label="Lire Contrat Prestataire"]');
    await tap("[aria-label=\"J'ai lu et j'accepte le contrat Prestataire\"]");
    await fill('[aria-label="Signature : votre nom complet"]', "Quelqu'un d'autre");
    const wrong = await visible('[aria-label="Envoyer le dossier"]');
    const refusedWrong = wrong && (await wrong.getAttribute("aria-disabled")) === "true";
    await fill('[aria-label="Signature : votre nom complet"]', "Estevao Macumba");
    await tap('[aria-label="Envoyer le dossier"]');
    await page.waitForTimeout(1200);
    return wasLocked && refusedWrong && (await seen("text=Suivi de la vérification"));
  });
  await check("the dossier is under review and not bookable", async () =>
    (await seen("text=Dossier soumis")) &&
    (await seen("text=En examen · non réservable")) &&
    (await seen("text=/À partir de 9\\s?000 FCFA/")) &&
    (await seen("text=/Contrat Prestataire/")) &&
    !(await visible('text="Vérifié"')));
  await check("it states the payout terms", async () =>
    (await seen("text=Commission 242Konnect")) && (await seen("text=Versement express")));
  await page.screenshot({ path: `${OUT}/s3-prestataire.png` });
  await check("and it has a way back", async () => {
    await tap('[aria-label="Retour"]');
    await page.waitForTimeout(700);
    return seen("text=Se déconnecter");
  });
  // Client §04: "Le rôle principal ne doit jamais changer automatiquement."
  await check("the client profile stays the active one", async () =>
    (await seen('[aria-label="Profil Prestataire"]')) &&
    (await seen('[aria-label="Espace Prestataire"]')) &&
    (await visible('[aria-label="Profil Particulier"][aria-selected="true"]')) !== null);

  // A prestataire is a customer too: switching must keep the marketplace.
  await check("switching to Prestataire keeps the marketplace", async () => {
    await tap('[aria-label="Profil Prestataire"]');
    await page.waitForTimeout(700);
    await tap('[aria-label="Accueil"]');
    await page.waitForTimeout(800);
    return (await seen("text=Catégories")) && !(await seen("text=Score 242K"));
  });
  await check("a prestataire can still browse and search", async () =>
    (await seen('[aria-label="Quel service recherchez-vous ?"]')) &&
    (await seen('[aria-label="Rechercher"]')) &&
    (await seen('[aria-label="Voir tous les métiers"]')) &&
    (await seen('[aria-label="Catégorie Plomberie"]')) &&
    (await seen('[aria-label*="Changer de ville"]')));
  await check("switching back to Particulier keeps the home feed", async () => {
    await tap('[aria-label="Profil"]');
    await page.waitForTimeout(600);
    await tap('[aria-label="Profil Particulier"]');
    await page.waitForTimeout(700);
    await tap('[aria-label="Accueil"]');
    await page.waitForTimeout(800);
    return seen("text=Catégories");
  });

  await check("the editor offers the pricing model, not a bare hourly rate", async () => {
    await tap('[aria-label="Profil"]');
    await page.waitForTimeout(600);
    await tap('[aria-label="Modifier le profil"]');
    await page.waitForTimeout(700);
    return (await seen('[aria-label="Modèle de prix À partir de"][aria-checked="true"], [aria-label="Modèle de prix À partir de"][aria-selected="true"]')) &&
      !(await seen('[aria-label="Tarif horaire (FCFA)"]'));
  });
  // The phone shown here used to be printed as "+242 " plus the stored number,
  // which already begins with its dial code — so it read "+242 242…", and was
  // simply wrong for the US numbers the country picker exists to support.
  await check("the phone is shown once, with the right dial code", async () => {
    const doubled = await seen("text=/\\+242\\s*242/");
    if (doubled) throw new Error("the dial code is printed twice");
    return seen("text=/\\+242\\s*0?6/");
  });
  // Client §14: "Le nom et le téléphone vérifiés ne se modifient pas librement."
  await check("the verified name and phone are read-only", async () =>
    (await seen("text=ne peut pas être modifié")) &&
    (await seen("text=Le nom vérifié se corrige par une demande")) &&
    !(await seen('input[aria-label="Nom complet"]')));
  await check("save the bio", async () => {
    await fill('[aria-label="À propos de vous"]', "Basé à Pointe-Noire.");
    await tap('[aria-label="Enregistrer le profil"]');
    await page.waitForTimeout(1000);
    return seen("text=Basé à Pointe-Noire.");
  });
  await page.screenshot({ path: `${OUT}/c2-profile.png` });

  // Client §10: privacy preferences, consent history and data requests.
  section("Privacy");
  await check("Confidentialité shows the accepted documents with their dates", async () => {
    await tap('[aria-label="Confidentialité"]');
    await page.waitForTimeout(700);
    return (await seen("text=Documents acceptés")) &&
      (await seen("text=/accepté le/")) &&
      (await seen("text=Responsable des données"));
  });
  await check("marketing consent can be withdrawn", async () => {
    const sw = await visible('[aria-label="Communications marketing"]');
    const before = sw && (await sw.getAttribute("aria-checked"));
    await tap('[aria-label="Communications marketing"]');
    await page.waitForTimeout(600);
    const after = await (await visible('[aria-label="Communications marketing"]')).getAttribute("aria-checked");
    return before === "true" && after === "false";
  });
  await check("correction and deletion can be requested", async () =>
    (await seen('[aria-label="Demander une correction"]')) &&
    (await seen('[aria-label="Demander la suppression"]')));
  await check("back from privacy", async () => {
    await tap('[aria-label="Retour"]');
    await page.waitForTimeout(600);
    return seen("text=Se déconnecter");
  });

  section("FAQ");
  await check("open the FAQ", async () => {
    await tap('[aria-label="Questions fréquentes"]');
    return seen("text=Tarifs et paiement");
  });
  await check("an answer expands", async () => {
    await tap("text=Quels moyens de paiement acceptez-vous ?");
    return seen("text=MTN Mobile Money, Airtel Money");
  });
  await check("payment limits stated", async () => {
    await tap("text=Le paiement fonctionne-t-il vraiment ?");
    return seen("text=aucun argent n'est débité");
  });
  await page.screenshot({ path: `${OUT}/c3-faq.png` });
  await check("back to account", async () => { await tap('[aria-label="Retour"]'); return seen("text=Se déconnecter"); });

  section("Tab bar");
  for (const t of ["Accueil", "Missions", "Messages", "Profil"]) {
    await check(`tab ${t}`, () => tap(`[aria-label="${t}"]`));
  }
  await check("'+' opens post-a-job", async () => {
    await tap('[aria-label="Accueil"]');
    await tap('[aria-label="Publier une demande"]');
    return seen("text=De quel service avez-vous besoin ?");
  });
  await check("choosing a trade confirms", async () => {
    await tap('[aria-label="Publier une demande en Plomberie"]');
    return seen("text=Votre demande est en ligne");
  });
  await check("post-a-job closes", async () => { await tap("text=Terminé"); return true; });

  section("Session");
  await check("survives a reload (through the splash)", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Catégories", { timeout: 25000 });
    return true;
  });
  await check("data survives too", async () => {
    await tap('[aria-label="Missions"]');
    await tap('[aria-label^="Terminées"]');
    return seen("text=Validée");
  });
  // Not the first launch any more, so this must land on Connexion directly —
  // the directives route later opens past Commencer.
  await check("sign out lands on Connexion, not Commencer", async () => {
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Se déconnecter"]');
    await page.waitForTimeout(1200);
    return (await seen("text=Bon retour")) && !(await seen("text=Just One Click."));
  });
  // The password is only the first factor now: a correct one sends a code and
  // stops there. Getting into the app still means reading the outbox.
  await check("the right password alone does not sign anyone in", async () => {
    markOutbox();
    await fill('[aria-label="Numéro de téléphone ou e-mail"]', "061234567");
    await fill('[aria-label="Mot de passe"]', SIGNUP_PASSWORD);
    await tap('[aria-label="Se connecter"]');
    await page.waitForTimeout(1600);
    return (await seen("text=Vérification")) && !(await seen("text=Catégories"));
  });
  await check("sign-in shows no code either", async () => !(await codeOnScreen()));
  await check("the mailed code completes the sign-in", async () => {
    const real = mailedCode();
    if (!real) throw new Error("no code in the outbox — did sign-in ask for one?");
    await fill('[aria-label="Code de vérification"]', real);
    await page.waitForTimeout(1800);
    return seen("text=Catégories");
  });
  await check("account data still there", async () => {
    await tap('[aria-label="Missions"]');
    await tap('[aria-label^="Terminées"]');
    return seen("text=Validée");
  });

  console.log(`\n${pass} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log("   ✗ " + f));
  console.log(runtime.length ? "\nRUNTIME ERRORS:" : "\n✓ no console errors, no failed requests");
  [...new Set(runtime)].slice(0, 10).forEach((r) => console.log("   ✗ " + r));

  await browser.close();
  if (!BASE_URL) server.close();
  process.exit(failures.length || runtime.length ? 1 : 0);
})();
