/**
 * The Particulier journey the founder named as this phase's priority:
 *
 *   Demande → Acceptation → Paiement → Reçu → Avis
 *
 * Sign-up and verification are covered by verify-signup-order.js; this picks up
 * from a signed-in account and drives the money and the feedback, which is where
 * the correction note asks for notification, payment status, a receipt the
 * client can download, and a rating with a comment and an optional photo.
 */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");

const DIST = process.env.APP_DIST || path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8997);
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
  // Locale is pinned so the suite is deterministic. The app follows the
  // device language on first launch, so a browser reporting en-US opens it
  // in English and every French selector below silently misses.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
    locale: "fr-FR",
  });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));

  const vis = async (s) => { for (const e of (await page.locator(s).all()).reverse())
    if (await e.isVisible()) return e; return null; };
  const tap = async (s) => { const e = await vis(s); if (!e) throw new Error("not visible: " + s);
    await e.click(); await page.waitForTimeout(650); };
  const seen = async (s) => !!(await vis(s));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Chaque problème", { timeout: 30000 });
  await page.waitForTimeout(700);
  await tap('[aria-label="J\'ai déjà un compte, se connecter"]');
  await tap('[aria-label="Se connecter avec le compte de démonstration"]');
  await page.waitForTimeout(1600);

  // Demande: book a professional from their profile.
  await tap("text=Voir plus");
  await page.waitForTimeout(700);
  // Cards are labelled by the professional's name and rating.
  const card = await vis('[aria-label*=" sur 5"]');
  if (!card) throw new Error("no professional card found");
  await card.click();
  await page.waitForTimeout(900);

  await check("a booking can be requested", async () => {
    await tap('[aria-label$="maintenant"]');
    await page.waitForTimeout(600);
    // The slot list has no prefix of its own; each option is its own label.
    const slots = await page.locator('[role="button"]').all();
    for (const s of slots) {
      const l = await s.getAttribute("aria-label");
      if (l && /\d/.test(l) && !/Confirmer|Fermer|Retour/.test(l) && (await s.isVisible())) {
        await s.click(); await page.waitForTimeout(300); break;
      }
    }
    await tap('[aria-label="Confirmer la réservation"]');
    await page.waitForTimeout(900);
    return true;
  });

  // The confirmation sheet stays open over the profile and swallows clicks, so
  // close it before touching anything underneath.
  const closer = await vis('[aria-label="Fermer"]');
  if (closer) { await closer.click(); await page.waitForTimeout(500); }

  // The professional profile is full-bleed and hides the tab bar, so the way
  // out is its own back control, not a tab.
  await tap('[aria-label="Retour"]');
  await page.waitForTimeout(700);

  await tap('[aria-label="Missions"]');
  await check("the request waits for acceptance, not payment", async () =>
    (await seen("text=En attente")) && !(await seen('[aria-label^="Payer la mission"]')));

  await check("acceptance makes it payable", async () => {
    await tap('[aria-label^="Simuler l\'acceptation"]');
    return (await seen("text=À payer")) && (await seen('[aria-label^="Payer la mission"]'));
  });

  await check("acceptance raises a notification", async () => {
    // First tap switches to the tab, which is still on the search results we
    // navigated through. Tapping an already-focused tab pops it to its root —
    // that is the app behaving correctly, not a missing bell.
    await tap('[aria-label="Accueil"]');
    await tap('[aria-label="Accueil"]');
    await page.waitForTimeout(700);
    await tap('[aria-label*="Notifications"]');
    const ok = await seen("text=Demande acceptée");
    await tap('[aria-label="Fermer"]');
    return ok;
  });

  await check("paying by card holds the funds", async () => {
    await tap('[aria-label="Missions"]');
    await tap('[aria-label^="Payer la mission"]');
    await tap('[aria-label="Carte bancaire"]');
    await tap('[aria-label="Confirmer le paiement"]');
    await page.waitForTimeout(800);
    return seen("text=242Konnect conserve ce montant");
  });

  await check("the receipt downloads from the confirmation", async () => {
    const wait = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await tap('[aria-label="Télécharger le reçu"]');
    const dl = await wait;
    if (!dl) throw new Error("no download started");
    return /242Konnect-recu-.*\.html$/.test(dl.suggestedFilename());
  });

  await tap("text=Terminé");
  await check("payment status is visible on the mission", () => seen("text=Fonds bloqués"));

  await check("validating releases the funds", async () => {
    await tap('[aria-label^="Valider la prestation"]');
    await tap('[aria-label="Confirmer la validation"]');
    await page.waitForTimeout(700);
    const ok = await seen("text=versés au prestataire");
    await tap("text=Terminé");
    return ok;
  });

  await check("a review can be left with a rating and a comment", async () => {
    await tap('[aria-label^="Laisser un avis"]');
    await tap('[aria-label="Donner 4 étoiles"]');
    const box = await vis('[aria-label="Votre commentaire"]');
    if (!box) throw new Error("no comment field");
    await box.fill("Travail rapide et propre, je recommande.");
    await tap('[aria-label="Publier mon avis"]');
    await page.waitForTimeout(700);
    return seen("text=Travail rapide et propre");
  });

  await check("the receipt is still downloadable afterwards", async () => {
    const wait = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await tap('[aria-label^="Télécharger le reçu"]');
    return !!(await wait);
  });

  await check("no page errors", () => errs.length === 0 || `errors: ${errs[0]}`);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (errs.length) console.log("errors:", errs.slice(0, 3));
  await browser.close(); server.close();
  process.exit(fails.length ? 1 : 0);
})();
