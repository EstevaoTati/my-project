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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (!BASE_URL) await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({
    // Falls back to Playwright's own resolution when the env var is unset.
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const runtime = [];
  page.on("console", (m) => m.type() === "error" && runtime.push("console: " + m.text().slice(0, 140)));
  page.on("pageerror", (e) => runtime.push("pageerror: " + e.message.slice(0, 140)));
  page.on("requestfailed", (r) => runtime.push("request failed: " + r.url().slice(0, 90)));

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

  await page.goto(BASE_URL || `http://localhost:${PORT}/`, { waitUntil: "networkidle" });

  section("Splash & first launch");
  // The directives put a 2-3s logo animation before anything else. Assert it is
  // actually on screen rather than just waiting it out.
  await check("splash shows the wordmark on black", async () => {
    const ok = await seen("text=242Konnect");
    const ground = await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find(
        (d) => getComputedStyle(d).backgroundColor === "rgb(10, 10, 10)"
      );
      return !!el;
    });
    return ok && ground;
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

  section("Three account formats");
  await check("three types offered", async () =>
    (await seen('[aria-label="Particulier"]')) &&
    (await seen('[aria-label="Prestataire"]')) &&
    (await seen('[aria-label="Business"]')));
  await check("each type lists different requirements", async () => {
    await tap('[aria-label="Prestataire"]');
    const pro = await seen("text=Une photo de profil (obligatoire)");
    await tap('[aria-label="Business"]');
    const biz = (await seen("text=RCCM et NIF")) && !(await seen("text=Une photo de profil (obligatoire)"));
    await tap('[aria-label="Particulier"]');
    const part = await seen("text=Adresse complète et un repère");
    return pro && biz && part;
  });
  await page.screenshot({ path: `${OUT}/s1-types.png` });

  await check("identity step blocks Continuer while empty", async () => {
    await tap('[aria-label="Business"]');
    await tap('[aria-label="Continuer"]');
    const el = await visible('[aria-label="Continuer vers les informations"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("Business asks for RCCM, NIF and sector", async () => {
    await fill('[aria-label="Nom du responsable"]', "Estevao Macumba");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="E-mail professionnel"]', "contact@mwinda.cg");
    await fill('[aria-label="Mot de passe"]', "motdepasse");
    await tap('[aria-label="Continuer vers les informations"]');
    return (await seen('[aria-label="RCCM"]')) && (await seen('[aria-label="NIF"]')) &&
           (await seen("text=Votre entreprise"));
  });
  await check("Business form has no date of birth", async () => !(await seen('[aria-label="Date de naissance"]')));
  await page.screenshot({ path: `${OUT}/s2-business.png` });

  await check("back to the type step", async () => {
    await tap('[aria-label="Retour"]');
    await tap('[aria-label="Retour"]');
    return seen("text=Quel type de compte ?");
  });

  await check("Prestataire requires a photo before continuing", async () => {
    await tap('[aria-label="Prestataire"]');
    await tap('[aria-label="Continuer"]');
    await fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Adresse e-mail"]', "estevao@mwinda.cg");
    await fill('[aria-label="Mot de passe"]', "motdepasse");
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
    await fill('[aria-label="Mot de passe"]', "motdepasse");
    await tap('[aria-label="Continuer vers les informations"]');
    return seen("text=Où intervenir ?");
  });
  await check("address and reference are required", async () => {
    const el = await visible('[aria-label="Créer mon compte"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("details move to verification", async () => {
    await fill('[aria-label="Adresse complète"]', "Avenue Tiboti, Mpaka");
    await fill('[aria-label="Référence de l\'adresse"]', "En face du marché");
    await tap('[aria-label="Créer mon compte"]');
    await page.waitForTimeout(1000);
    return seen("text=Vérification");
  });
  await check("no account exists until the code is confirmed", () => seen("text=Aucun e-mail n'a été envoyé"));
  await check("a wrong code is refused", async () => {
    const real = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((n) =>
        /^\d{6}$/.test((n.textContent || "").trim()) && n.children.length === 0);
      return el ? el.textContent.trim() : null;
    });
    if (real === "000000") return true;
    await fill('[aria-label="Code de vérification"]', "000000");
    await page.waitForTimeout(900);
    return seen("text=Code incorrect");
  });
  await check("the real code creates the account", async () => {
    const real = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((n) =>
        /^\d{6}$/.test((n.textContent || "").trim()) && n.children.length === 0);
      return el ? el.textContent.trim() : null;
    });
    if (!real) throw new Error("demo code not found");
    await fill('[aria-label="Code de vérification"]', real);
    await page.waitForTimeout(1600);
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
  await check("payment opens", async () => {
    await tap('[aria-label^="Payer la mission"]');
    return seen("text=Moyen de paiement");
  });
  await check("escrow explained before paying", () => seen("text=n'est payé qu'après votre validation"));
  await check("cash is not offered", async () => !(await seen("text=Espèces")));
  await check("confirm disabled before a method", async () => {
    const el = await visible('[aria-label="Confirmer le paiement"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("Mobile Money asks for a number", async () => {
    await tap('[aria-label="MTN Mobile Money"]');
    return seen('[aria-label="Numéro de téléphone"]');
  });
  await check("card does not ask for a number", async () => {
    await tap('[aria-label="Carte bancaire"]');
    return !(await seen('[aria-label="Numéro de téléphone"]'));
  });
  await check("paying holds the funds", async () => {
    await tap('[aria-label="MTN Mobile Money"]');
    await tap('[aria-label="Confirmer le paiement"]');
    return seen("text=242Konnect conserve ce montant");
  });
  await page.screenshot({ path: `${OUT}/c1-payment.png` });
  await check("receipt closes", async () => { await tap("text=Terminé"); return true; });
  await check("mission now reads as funds held", () => seen("text=Fonds bloqués"));

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
  await check("one account shows all three profiles", async () =>
    (await seen('[aria-label="Profil Particulier"]')) &&
    (await seen('[aria-label="Activer le profil Prestataire"]')));
  await check("activating Prestataire switches to it", async () => {
    await tap('[aria-label="Activer le profil Prestataire"]');
    await page.waitForTimeout(700);
    return seen('[aria-label="Profil Prestataire"]');
  });
  await check("Accueil now shows the Espace Prestataire", async () => {
    await tap('[aria-label="Accueil"]');
    await page.waitForTimeout(800);
    return (await seen("text=Espace Prestataire")) && (await seen("text=Score 242K"));
  });
  await check("it states the payout terms", async () =>
    (await seen("text=Commission 242Konnect")) && (await seen("text=Versement express")));
  await page.screenshot({ path: `${OUT}/s3-prestataire.png` });

  await check("activating Business switches to it", async () => {
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Activer le profil Business"]');
    await page.waitForTimeout(700);
    await tap('[aria-label="Accueil"]');
    await page.waitForTimeout(800);
    return seen("text=Espace Business");
  });
  await check("an establishment can actually be added", async () => {
    await tap('[aria-label="Ajouter un établissement"]');
    await fill('[aria-label="Nom"]', "Agence Mpaka");
    await tap('[aria-label="Type Chantier"]');
    await fill('[aria-label="Adresse"]', "Rue Tiboti");
    await tap('[aria-label="Enregistrer l\'établissement"]');
    await page.waitForTimeout(700);
    return (await seen("text=Agence Mpaka")) && (await seen("text=Chantier"));
  });
  await check("a collaborator can be invited with a role", async () => {
    await tap('[aria-label="Inviter un collaborateur"]');
    await fill('[aria-label="Nom"]', "Brianna K.");
    await fill('[aria-label="E-mail"]', "brianna@mwinda.cg");
    await tap('[aria-label="Rôle Comptable"]');
    await tap('[aria-label="Envoyer l\'invitation"]');
    await page.waitForTimeout(700);
    return (await seen("text=Brianna K.")) && (await seen("text=Comptable"));
  });
  await check("an invalid collaborator e-mail is refused", async () => {
    await tap('[aria-label="Inviter un collaborateur"]');
    await fill('[aria-label="Nom"]', "Test");
    await fill('[aria-label="E-mail"]', "pas-un-email");
    await tap('[aria-label="Envoyer l\'invitation"]');
    return seen("text=adresse e-mail valide");
  });
  await page.screenshot({ path: `${OUT}/s4-business.png` });
  await check("close the sheet", async () => { await tap('[aria-label="Fermer"]'); return true; });

  await check("switching back to Particulier restores the home feed", async () => {
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Profil Particulier"]');
    await page.waitForTimeout(700);
    await tap('[aria-label="Accueil"]');
    await page.waitForTimeout(800);
    return (await seen("text=Catégories")) && !(await seen("text=Espace Business"));
  });
  await check("open the editor", async () => {
    // The previous check ends on Accueil, so come back to the Profil tab.
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Modifier le profil"]');
    return seen("text=ne peut pas être modifié");
  });
  await check("save name and bio", async () => {
    await fill('[aria-label="Nom complet"]', "Estevao M. Macumba");
    await fill('[aria-label="À propos de vous"]', "Basé à Pointe-Noire.");
    await tap('[aria-label="Enregistrer le profil"]');
    await page.waitForTimeout(1000);
    return seen("text=Estevao M. Macumba");
  });
  await page.screenshot({ path: `${OUT}/c2-profile.png` });

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
    await page.waitForSelector("text=Estevao M. Macumba", { timeout: 25000 });
    return true;
  });
  await check("data survives too", async () => {
    await tap('[aria-label="Missions"]');
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
  await check("sign back in", async () => {
    await fill('[aria-label="Numéro de téléphone ou e-mail"]', "061234567");
    await fill('[aria-label="Mot de passe"]', "motdepasse");
    await tap('[aria-label="Se connecter"]');
    await page.waitForTimeout(1400);
    return seen("text=Catégories");
  });
  await check("account data still there", async () => {
    await tap('[aria-label="Missions"]');
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
