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
  await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 25000 });
  await page.waitForTimeout(900);

  section("Welcome & account");
  await check("welcome screen", () => seen("text=Chaque problème est un besoin"));
  await check("welcome to sign in", async () => { await tap("text=J'ai déjà un compte"); return seen("text=Bon retour"); });
  await check("unknown credentials rejected", async () => {
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Mot de passe"]', "mauvais");
    await tap('[aria-label="Se connecter"]');
    return seen("text=Numéro ou mot de passe incorrect");
  });
  await check("sign in to sign up", async () => { await tap("text=Créer un compte"); return seen("text=Créer votre compte"); });
  await check("submit disabled while incomplete", async () => {
    const el = await visible('[aria-label="Créer mon compte"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("pro role warns space isn't built", async () => {
    await tap('[aria-label="Je suis professionnel"]');
    return seen("text=L'espace professionnel arrive bientôt");
  });
  await check("back to client role", () => tap('[aria-label="Je cherche un service"]'));
  await check("create the account", async () => {
    await fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Mot de passe"]', "motdepasse");
    await tap('[aria-label="Créer mon compte"]');
    await page.waitForTimeout(1200);
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
  for (const cat of ["Ménage", "Plomberie", "Électricité", "Mécanique", "IT & Tech"]) {
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
    await tap('[aria-label="Catégorie Beauté"]');
    return seen("text=Coiffure à domicile");
  });
  await check("text search filters", async () => {
    await tap('[aria-label="Toutes les catégories"]');
    await fill('[aria-label="Rechercher un métier"]', "clim");
    return seen("text=Entretien clim");
  });
  await check("a trade opens its professionals", async () => {
    await tap("text=Installation clim");
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

  section("Missions & payment");
  await check("mission listed", async () => { await tap('[aria-label="Missions"]'); return seen("text=Demain, 09h00"); });
  await check("payment opens", async () => {
    await tap('[aria-label^="Payer la mission"]');
    return seen("text=Choisissez un moyen de paiement");
  });
  await check("confirm disabled before a method", async () => {
    const el = await visible('[aria-label="Confirmer le paiement"]');
    return el && (await el.getAttribute("aria-disabled")) === "true";
  });
  await check("Mobile Money asks for a number", async () => {
    await tap('[aria-label="MTN Mobile Money"]');
    return seen('[aria-label="Numéro de téléphone"]');
  });
  await check("receipt states no money moved", async () => {
    await tap('[aria-label="Confirmer le paiement"]');
    return seen("text=aucun argent n'a été débité");
  });
  await page.screenshot({ path: `${OUT}/c1-payment.png` });
  await check("receipt closes", async () => { await tap("text=Terminé"); return true; });
  await check("mission reads as paid", () => seen("text=Payée"));

  section("Profile editing");
  await check("open Profil", async () => { await tap('[aria-label="Profil"]'); return seen("text=Se déconnecter"); });
  await check("open the editor", async () => {
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
  await check("survives a reload", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    return seen("text=Estevao M. Macumba");
  });
  await check("data survives too", async () => {
    await tap('[aria-label="Missions"]');
    return seen("text=Payée");
  });
  await check("sign out", async () => {
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Se déconnecter"]');
    await page.waitForTimeout(900);
    return seen("text=Chaque problème est un besoin");
  });
  await check("sign back in", async () => {
    await tap("text=J'ai déjà un compte");
    await fill('[aria-label="Numéro de téléphone"]', "061234567");
    await fill('[aria-label="Mot de passe"]', "motdepasse");
    await tap('[aria-label="Se connecter"]');
    await page.waitForTimeout(1400);
    return seen("text=Catégories");
  });
  await check("account data still there", async () => {
    await tap('[aria-label="Missions"]');
    return seen("text=Payée");
  });

  console.log(`\n${pass} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log("   ✗ " + f));
  console.log(runtime.length ? "\nRUNTIME ERRORS:" : "\n✓ no console errors, no failed requests");
  [...new Set(runtime)].slice(0, 10).forEach((r) => console.log("   ✗ " + r));

  await browser.close();
  if (!BASE_URL) server.close();
  process.exit(failures.length || runtime.length ? 1 : 0);
})();
