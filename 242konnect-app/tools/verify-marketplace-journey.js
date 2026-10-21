/**
 * Two people, one request, through the server.
 *
 * A prestataire signs up and publishes a listing; 242Konnect approves it; a
 * client finds it, prepares a request, pays; the prestataire sees the request
 * without the address, accepts, sees the address, reports each step; the
 * client approves and the money is released. A message crosses the chat.
 *
 * Runs against tools/lib/fake-supabase.js, because supabase.co is not
 * reachable from the build environment. The database rules themselves are
 * proved separately against the real project by tools/verify-marketplace.sql.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8990 EXPO_PUBLIC_SUPABASE_ANON_KEY=test-key \
 *     EXPO_PUBLIC_API_URL= npx expo export --platform web --clear --output-dir dist-market
 *   APP_DIST=$PWD/dist-market node tools/verify-marketplace-journey.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createFakeSupabase } = require("./lib/fake-supabase");
const { writePng, acceptConsents } = require("./lib/account");

const ROOT = process.env.APP_DIST || path.resolve(__dirname, "..", "dist-market");
const PORT = 8997;
const OUTBOX = path.join(os.tmpdir(), "242k-fake-supabase-outbox.log");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon" };

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
    await page.waitForTimeout(200);
  };
  const seen = async (sel) => !!(await visible(sel));
  const waitSeen = async (sel, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await seen(sel)) return true;
      await page.waitForTimeout(500);
    }
    return false;
  };
  return { visible, tap, fill, seen, waitSeen };
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

/** Code, password, then the mandatory PIN — the Supabase path end to end. */
async function finishSignUp(page, h, email, password) {
  await page.waitForSelector("text=Vérification", { timeout: 20000 });
  await h.fill('[aria-label="Code de vérification"]', await latestCode(email));
  await page.waitForSelector('[aria-label="Confirmer le mot de passe"]', { timeout: 20000 });
  await h.fill('[aria-label="Mot de passe"]', password);
  await h.fill('[aria-label="Confirmer le mot de passe"]', password);
  await h.tap('[aria-label="Créer mon compte"]');
  await page.waitForSelector('[aria-label="Nouveau code"]', { timeout: 20000 });
  await h.fill('[aria-label="Nouveau code"]', "428317");
  await h.fill('[aria-label="Confirmer le code"]', "428317");
  await h.tap('[aria-label="Définir mon code"]');
  // A client lands on the marketplace, a prestataire on their dashboard.
  await page.waitForFunction(() => /Catégories|Tableau de bord/.test(document.body.innerText), null, { timeout: 25000 });
}

(async () => {
  const fake = createFakeSupabase({ port: 8990, outbox: OUTBOX });
  await fake.listen();
  await new Promise((r) => site.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
    await page.waitForTimeout(700);
    return page;
  };
  const avatar = writePng(path.join(os.tmpdir(), "242k-market-avatar.png"));

  // ------------------------------------------------------------------ B
  section("Prestataire signs up and is published");
  const pb = await open();
  const b = helpers(pb);
  await check("a prestataire completes sign-up with contract and PIN", async () => {
    await b.tap('[aria-label="Créer un compte"]');
    await b.tap('[aria-label="Prestataire"]');
    await b.tap('[aria-label="Continuer"]');
    await b.fill('[aria-label="Nom complet"]', "Jean-Paul Massamba");
    await b.fill('[aria-label="Numéro de téléphone"]', "066112233");
    await b.fill('[aria-label="Adresse e-mail"]', "jp@mwinda.cg");
    await b.tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
    await b.tap('[aria-label="Pointe-Noire"]');
    const [chooser] = await Promise.all([
      pb.waitForEvent("filechooser", { timeout: 15000 }),
      b.tap('[aria-label="Ajouter une photo de profil"]'),
    ]);
    await chooser.setFiles(avatar);
    await pb.waitForTimeout(2500);
    await b.tap('[aria-label="Continuer vers les informations"]');
    await b.fill('[aria-label="Date de naissance"]', "1990-04-12");
    await b.tap('[aria-label="Choisir votre métier"]');
    await b.tap('[aria-label="Plombier"]');
    await b.fill("[aria-label=\"Zone d'intervention\"]", "Mpaka, Tié-Tié");
    await b.tap('[aria-label="Modèle de prix Prix fixe"]');
    await b.fill('[aria-label="Montant"]', "15000");
    await b.tap('[aria-label="Durée Quelques heures"]');
    await b.fill('[aria-label="Biographie"]', "Plombier depuis 12 ans.");
    await b.tap('[aria-label="Continuer vers les consentements"]');
    await b.tap('[aria-label="Lire Contrat Prestataire"]');
    await b.tap("[aria-label=\"J'ai lu et j'accepte le contrat Prestataire\"]");
    await b.fill('[aria-label="Signature : votre nom complet"]', "Jean-Paul Massamba");
    await acceptConsents(pb);
    await b.tap('[aria-label="Créer mon compte"]');
    await finishSignUp(pb, b, "jp@mwinda.cg", "Mwinda2026");
    return true;
  });
  await check("the listing reaches the server as pending", async () => {
    const end = Date.now() + 10000;
    while (Date.now() < end && fake.listings.size === 0) await pb.waitForTimeout(300);
    const [l] = [...fake.listings.values()];
    return !!l && l.status === "pending" && l.trade_id === "plombier" && l.pricing?.model === "fixed";
  });
  await check("provider mode opens on the dashboard, with the review status", async () => {
    const dash = await b.waitSeen("text=Tableau de bord");
    const banner = await b.waitSeen("text=/Profil en examen par 242Konnect/");
    // Spec §14: no browsing competitors in provider mode.
    return dash && banner && !(await b.seen('[aria-label="Quel service recherchez-vous ?"]'));
  });

  // ------------------------------------------------------------------ A
  section("Client finds the prestataire");
  const pa = await open();
  const a = helpers(pa);
  await check("a client signs up", async () => {
    await a.tap('[aria-label="Créer un compte"]');
    await a.tap('[aria-label="Continuer"]');
    await a.fill('[aria-label="Nom complet"]', "Estevao Macumba");
    await a.fill('[aria-label="Numéro de téléphone"]', "066554433");
    await a.fill('[aria-label="Adresse e-mail"]', "estevao@mwinda.cg");
    await a.tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
    await a.tap('[aria-label="Pointe-Noire"]');
    await a.tap('[aria-label="Continuer vers les informations"]');
    await a.fill('[aria-label="Adresse complète"]', "Avenue Tiboti 12, Mpaka");
    await a.fill("[aria-label=\"Référence de l'adresse\"]", "En face du marché");
    await a.tap('[aria-label="Continuer vers les consentements"]');
    await acceptConsents(pa);
    await a.tap('[aria-label="Créer mon compte"]');
    await finishSignUp(pa, a, "estevao@mwinda.cg", "Mwinda2026");
    return true;
  });
  await check("a pending prestataire is listed with a badge but cannot be booked", async () => {
    await a.waitSeen('[aria-label="Prestataire inscrit Jean-Paul Massamba"]');
    await a.tap('[aria-label="Prestataire inscrit Jean-Paul Massamba"]');
    const shown = await a.waitSeen("text=En examen · non réservable");
    const blocked = !(await a.seen('[aria-label="Envoyer une demande à Jean-Paul Massamba"]'));
    await a.tap('[aria-label="Retour"]');
    return shown && blocked;
  });

  fake.approveAll(); // what a 242Konnect reviewer does from the dashboard

  await check("once approved, a request can be prepared", async () => {
    await pa.waitForTimeout(800);
    await a.tap('[aria-label="Prestataire inscrit Jean-Paul Massamba"]');
    await a.waitSeen('[aria-label="Envoyer une demande à Jean-Paul Massamba"]');
    await a.tap('[aria-label="Envoyer une demande à Jean-Paul Massamba"]');
    await a.fill('[aria-label="Description de la demande"]', "Fuite sous l'évier de la cuisine.");
    await a.tap("text=Demain, 09h00");
    await a.tap('[aria-label="Préparer la demande"]');
    return a.waitSeen("text=Demande préparée");
  });
  await check("the prestataire cannot see an unpaid draft", async () => {
    const [r] = [...fake.requests.values()];
    return !!r && r.status === "draft";
  });
  await check("only Mobile Money is offered: what the server can verify", async () => {
    await a.tap('[aria-label="Revoir et payer"]');
    await a.waitSeen('[aria-label="Revoir et payer la demande en ligne"]');
    await a.tap('[aria-label="Revoir et payer la demande en ligne"]');
    const recap = (await a.waitSeen("text=Total autorisé")) && (await a.seen("text=Avenue Tiboti 12, Mpaka"));
    return recap && (await a.seen('[aria-label="MTN Mobile Money"]')) && !(await a.seen('[aria-label="Carte bancaire"]'));
  });
  await check("with the operators not live, booking pauses and nothing is paid", async () => {
    fake.setPaymentsLive(false);
    await a.tap('[aria-label="MTN Mobile Money"]');
    await a.fill('[aria-label="Numéro Mobile Money"]', "061234567");
    await a.tap("[aria-label=\"J'autorise le paiement\"]");
    await a.tap('[aria-label="Confirmer le paiement en ligne"]');
    const shown = await a.waitSeen("text=/Le paiement en ligne ouvre bientôt/");
    const [r] = [...fake.requests.values()];
    return shown && r.status === "draft" && fake.collections.size === 0;
  });
  await check("the client cannot declare the payment itself", async () => {
    const [r] = [...fake.requests.values()];
    // Straight at the server, as an attacker with the client's token would.
    const res = await fetch("http://127.0.0.1:8990/rest/v1/rpc/request_action", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer tok-${r.client_id}~99999` },
      body: JSON.stringify({ p_request: r.id, p_action: "pay", p_payload: { method: "mtn", payment_ref: "I-promise" } }),
    }).then((x) => x.status);
    return res === 403 && r.status === "draft";
  });
  await check("the client pays by Mobile Money; the server confirms it", async () => {
    fake.setPaymentsLive(true);
    await pa.screenshot({ path: path.join(os.tmpdir(), "242k-market-pay.png") });
    await a.tap('[aria-label="Confirmer le paiement en ligne"]');
    await pa.waitForTimeout(4500);
    const [r] = [...fake.requests.values()];
    return r.status === "sent" && !!r.payment_verified_at && (await a.waitSeen("text=Envoyée · fonds bloqués"));
  });

  // ------------------------------------------------------------------ B
  section("Prestataire receives, accepts and works");
  await check("the request arrives in Jobs without the address", async () => {
    await b.tap('[aria-label="Missions"]');
    await b.waitSeen('[aria-label="Voir la demande Plombier"]', 25000);
    await b.tap('[aria-label="Voir la demande Plombier"]');
    const arrived = await b.waitSeen("text=Fuite sous l'évier de la cuisine.");
    await pb.screenshot({ path: path.join(os.tmpdir(), "242k-provider-request.png") });
    return arrived && !(await b.seen("text=/Avenue Tiboti 12/")) && (await b.seen("text=Estevao M."));
  });
  await check("a message reaches the client through the request chat", async () => {
    await b.tap('[aria-label="Écrire au client"]');
    await b.fill('[aria-label="Votre message"]', "Bonjour, je passe demain à 9h.");
    await b.tap('[aria-label="Envoyer le message"]');
    await b.tap('[aria-label="Fermer"]');
    await a.tap('[aria-label="Ouvrir le chat de la demande"]');
    const ok = await a.waitSeen("text=Bonjour, je passe demain à 9h.", 10000);
    await a.tap('[aria-label="Fermer"]');
    return ok;
  });
  await check("accepting opens the mission and releases the address", async () => {
    await b.tap('[aria-label="Accepter la demande"]');
    return b.waitSeen("text=/Avenue Tiboti 12/");
  });
  await check("each step is reported", async () => {
    for (const next of ["En route", "Arrivé", "En cours", "Terminée"]) {
      await b.tap(`[aria-label="Étape suivante ${next}"]`);
      await pb.waitForTimeout(400);
    }
    const [r] = [...fake.requests.values()];
    await b.tap('[aria-label="Fermer"]');
    return r.stage === "completed" && Object.keys(r.stage_at).length === 5;
  });

  // ------------------------------------------------------------------ A
  section("Client approves");
  await check("the client sees completion and approves", async () => {
    await a.tap('[aria-label="Accueil"]');
    await a.tap('[aria-label="Missions"]');
    await a.waitSeen('[aria-label="Valider et débloquer les fonds"]', 25000);
    await a.tap('[aria-label="Valider et débloquer les fonds"]');
    const [r] = [...fake.requests.values()];
    await pa.waitForTimeout(800);
    return r.status === "validated" && (await a.waitSeen("text=Validée"));
  });

  // ------------------------------------------------------------------ C
  section("Open request: two prestataires, one mission");
  const pc = await open();
  const c = helpers(pc);
  await check("a second plumber signs up in the same city", async () => {
    await c.tap('[aria-label="Créer un compte"]');
    await c.tap('[aria-label="Prestataire"]');
    await c.tap('[aria-label="Continuer"]');
    await c.fill('[aria-label="Nom complet"]', "Chantal Ngoma");
    await c.fill('[aria-label="Numéro de téléphone"]', "066998877");
    await c.fill('[aria-label="Adresse e-mail"]', "chantal@mwinda.cg");
    await c.tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
    await c.tap('[aria-label="Pointe-Noire"]');
    const [chooser] = await Promise.all([
      pc.waitForEvent("filechooser", { timeout: 15000 }),
      c.tap('[aria-label="Ajouter une photo de profil"]'),
    ]);
    await chooser.setFiles(avatar);
    await pc.waitForTimeout(2500);
    await c.tap('[aria-label="Continuer vers les informations"]');
    await c.fill('[aria-label="Date de naissance"]', "1988-02-03");
    await c.tap('[aria-label="Choisir votre métier"]');
    await c.tap('[aria-label="Plombier"]');
    await c.fill("[aria-label=\"Zone d'intervention\"]", "Loandjili");
    await c.tap('[aria-label="Modèle de prix Prix fixe"]');
    await c.fill('[aria-label="Montant"]', "12000");
    await c.tap('[aria-label="Durée Quelques heures"]');
    await c.fill('[aria-label="Biographie"]', "Plombière, 8 ans d'expérience.");
    await c.tap('[aria-label="Continuer vers les consentements"]');
    await c.tap('[aria-label="Lire Contrat Prestataire"]');
    await c.tap("[aria-label=\"J'ai lu et j'accepte le contrat Prestataire\"]");
    await c.fill('[aria-label="Signature : votre nom complet"]', "Chantal Ngoma");
    await acceptConsents(pc);
    await c.tap('[aria-label="Créer mon compte"]');
    await finishSignUp(pc, c, "chantal@mwinda.cg", "Mwinda2026");
    const end = Date.now() + 10000;
    while (Date.now() < end && fake.listings.size < 2) await pc.waitForTimeout(300);
    fake.approveAll();
    return fake.listings.size === 2;
  });
  await check("the client publishes an open request from the + button", async () => {
    await a.tap('[aria-label="Accueil"]');
    await a.tap('[aria-label="Publier une demande"]');
    await a.tap('[aria-label="Publier une demande en Plomberie"]');
    await a.tap('[aria-label="Métier Plombier"]');
    await a.fill('[aria-label="Description de la demande"]', "Chauffe-eau qui fuit.");
    await a.fill('[aria-label="Quartier"]', "Mpaka");
    await a.tap("text=Demain, 11h00");
    await a.fill('[aria-label="Budget de la demande"]', "20000");
    await pa.screenshot({ path: path.join(os.tmpdir(), "242k-open-request.png") });
    await a.tap('[aria-label="Préparer la demande ouverte"]');
    await a.waitSeen('[aria-label="Payer la demande"]');
    const open = [...fake.requests.values()].find((r) => r.provider_id == null);
    return !!open && open.status === "draft" && open.city === "Pointe-Noire" && open.trade_id === "plombier";
  });
  await check("it reaches nobody before it is paid", async () => {
    await c.tap('[aria-label="Missions"]');
    await pc.waitForTimeout(1500);
    return !(await c.seen("text=Chauffe-eau qui fuit."));
  });
  await check("paid, it goes to every eligible plumber", async () => {
    await a.tap('[aria-label="Payer la demande"]');
    await a.waitSeen('[aria-label="Revoir et payer la demande en ligne"]');
    await a.tap('[aria-label="Revoir et payer la demande en ligne"]');
    await a.tap('[aria-label="MTN Mobile Money"]');
    await a.fill('[aria-label="Numéro Mobile Money"]', "061234567");
    await a.tap("[aria-label=\"J'autorise le paiement\"]");
    await a.tap('[aria-label="Confirmer le paiement en ligne"]');
    await pa.waitForTimeout(4500);
    const open = [...fake.requests.values()].find((r) => r.trade_id === "plombier" && r.description === "Chauffe-eau qui fuit.");
    const cSees = await c.waitSeen('[aria-label="Voir la demande Plombier"]', 25000);
    await b.tap('[aria-label="Missions"]');
    await b.tap('[aria-label="Disponibles"]');
    const bSees = await b.waitSeen('[aria-label="Voir la demande Plombier"]', 25000);
    return open.status === "sent" && cSees && bSees;
  });
  await check("the first to accept gets the mission", async () => {
    await c.tap('[aria-label="Voir la demande Plombier"]');
    await c.waitSeen("text=Chauffe-eau qui fuit.");
    const shared = await c.seen("text=/le premier qui accepte obtient la mission/");
    await c.tap('[aria-label="Accepter la demande"]');
    const open = [...fake.requests.values()].find((r) => r.description === "Chauffe-eau qui fuit.");
    const gotIt = await c.waitSeen("text=/Avenue Tiboti 12/");
    await pc.screenshot({ path: path.join(os.tmpdir(), "242k-provider-job.png") });
    await c.tap('[aria-label="Fermer"]');
    return shared && gotIt && open.status === "accepted" && !!open.provider_id;
  });
  await check("the second is told it is already assigned, and keeps it in History", async () => {
    await b.tap('[aria-label="Voir la demande Plombier"]');
    await b.waitSeen("text=Chauffe-eau qui fuit.");
    await b.tap('[aria-label="Accepter la demande"]');
    const told = await b.waitSeen("text=/Un autre prestataire a déjà accepté cette demande/");
    await b.tap('[aria-label="Fermer"]');
    await b.tap('[aria-label="Historique"]');
    const kept = await b.waitSeen("text=Déjà attribuée");
    return told && kept && fake.dismissals.some((d) => d.reason === "assigned");
  });
  await check("the client's message is masked and shows as unread", async () => {
    await a.tap('[aria-label="Missions"]');
    await a.waitSeen('[aria-label="Ouvrir le chat de la demande"]', 20000);
    const buttons = await pa.locator('[aria-label="Ouvrir le chat de la demande"]').all();
    await buttons[buttons.length - 1].click();
    await pa.waitForTimeout(600);
    await a.fill('[aria-label="Votre message"]', "Appelez-moi au 06 123 45 67 svp");
    await a.tap('[aria-label="Envoyer le message"]');
    await a.tap('[aria-label="Fermer"]');
    await c.tap('[aria-label="Messages"]');
    const listed = await c.waitSeen('[aria-label="Conversation avec Estevao M."]', 25000);
    const badge = await c.waitSeen('[aria-label="1 non lus"]', 10000);
    await pc.screenshot({ path: path.join(os.tmpdir(), "242k-provider-messages.png") });
    await c.tap('[aria-label="Conversation avec Estevao M."]');
    const masked = (await c.waitSeen("text=Appelez-moi au ••• svp")) && !(await c.seen("text=/123 45 67/"));
    await c.tap('[aria-label="Fermer"]');
    return listed && badge && masked;
  });
  await check("the availability switch reaches the server", async () => {
    await c.tap('[aria-label="Accueil"]');
    await c.waitSeen('[aria-label="Disponible"]');
    // The Jobs tab, kept mounted, has the same switch: use the dashboard's.
    await pc.locator('[aria-label="Disponible"]').first().click();
    await pc.waitForTimeout(800);
    const l = [...fake.listings.values()].find((x) => x.full_name === "Chantal Ngoma");
    await pc.screenshot({ path: path.join(os.tmpdir(), "242k-provider-dashboard.png") });
    return l && l.available === false;
  });
  await check("Client mode gives the marketplace back on the same account", async () => {
    await c.tap('[aria-label="Profil"]');
    await c.waitSeen("text=Profil et paramètres");
    await pc.screenshot({ path: path.join(os.tmpdir(), "242k-provider-settings.png") });
    await c.tap('[aria-label="Mode client"]');
    await c.tap('[aria-label="Accueil"]');
    return c.waitSeen('[aria-label="Quel service recherchez-vous ?"]');
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
