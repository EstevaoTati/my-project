/**
 * Mode Pro — the Prestataire profile has its own look (src/proTheme.ts).
 *
 * One account, two profiles, two looks: the Client keeps the light interface
 * with black actions; the Prestataire gets the anthracite one with yellow
 * actions, a PRO badge and a dashboard shortcut. Checked here:
 *
 *  1. A prestataire lands in Mode Pro: dark tab bar, "Espace Pro" header,
 *     PRO badge, and the centre button opens their space.
 *  2. The marketplace is still all there (search, categories) — Mode Pro
 *     changes the look, never what a prestataire can do.
 *  3. The dashboard shortcut on Accueil opens the Espace Prestataire.
 *  4. Switching to Particulier brings back the Client look and its
 *     "Publier une demande" button; switching back restores Mode Pro.
 *
 * Runs against tools/lib/fake-supabase.js with the dist-market build:
 *
 *   APP_DIST=$PWD/dist-market node tools/verify-pro-mode.js
 */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const { createFakeSupabase } = require("./lib/fake-supabase");

const ROOT = process.env.APP_DIST || path.resolve(__dirname, "..", "dist-market");
const PORT = 8995;
const OUTBOX = path.join(os.tmpdir(), "242k-fake-supabase-pro.log");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon", ".jpeg": "image/jpeg" };
const ANTHRACITE = "rgb(22, 24, 29)";
const WHITE = "rgb(255, 255, 255)";

const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]); const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(200, { "Content-Type": "text/html" }); return fs.createReadStream(path.join(ROOT, "index.html")).pipe(res); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
});

function png(file) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const s = Buffer.alloc(4); s.writeUInt32BE(crc(body)); return Buffer.concat([l, body, s]); };
  const n = 64, ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.concat(Array.from({ length: n }, (_, y) => Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: n }, (_, x) => Buffer.from([0x3c + y, 0x55 + x, 0x70]))) ])));
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))])); return file;
}
let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try { if (!(await fn())) throw new Error("assertion returned falsy"); console.log("  ✓ " + label); pass++; }
  catch (e) { console.log("  ✗ " + label + " — " + String(e.message).split("\n")[0]); fails.push(label); }
};

(async () => {
  fs.writeFileSync(OUTBOX, "");
  const fake = createFakeSupabase({ port: 8990, outbox: OUTBOX }); await fake.listen();
  await new Promise((r) => site.listen(PORT, r));
  const photo = png(path.join(os.tmpdir(), "242k-pro-avatar.png"));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" })).newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const visible = async (sel) => { for (const el of (await page.locator(sel).all()).reverse()) if (await el.isVisible()) return el; return null; };
  const tap = async (sel) => { const el = await visible(sel); if (!el) throw new Error("not visible: " + sel); await el.click(); await page.waitForTimeout(600); };
  const fill = async (sel, v) => { const el = await visible(sel); if (!el) throw new Error("not visible: " + sel); await el.fill(v); await page.waitForTimeout(250); };
  const wait = async (sel, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await visible(sel)) return; await page.waitForTimeout(300); } throw new Error("never saw " + sel); };
  const code = async () => { const end = Date.now() + 15000; while (Date.now() < end) { const m = [...fs.readFileSync(OUTBOX, "utf8").matchAll(/est : (\d{6})/g)]; if (m.length) return m[m.length - 1][1]; await new Promise((r) => setTimeout(r, 250)); } throw new Error("no code"); };
  // Background of the tab bar: the element holding the Accueil tab's parent row.
  const barColour = () => page.evaluate(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find((n) => n.getAttribute("aria-label") === "Accueil");
    return tab ? getComputedStyle(tab.parentElement).backgroundColor : null;
  });
  const seen = async (sel) => !!(await visible(sel));

  console.log("\n── A prestataire lands in Mode Pro ──");
  await check("sign-up as prestataire reaches the app", async () => {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await wait("text=Chaque problème est un besoin");
    await tap('[aria-label="Créer un compte"]'); await tap('[aria-label="Prestataire"]'); await tap('[aria-label="Continuer"]');
    await fill('[aria-label="Nom complet"]', "Jean-Paul Massamba"); await fill('[aria-label="Numéro de téléphone"]', "066551188"); await fill('[aria-label="Adresse e-mail"]', "jp@exemple.cg");
    await tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]'); await tap('[aria-label="Pointe-Noire"]');
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), tap('[aria-label="Ajouter une photo de profil"]')]); await chooser.setFiles(photo); await page.waitForTimeout(2500);
    await tap('[aria-label="Continuer vers les informations"]');
    await fill('[aria-label="Date de naissance"]', "1990-04-12"); await tap('[aria-label="Choisir votre métier"]'); await tap('[aria-label="Plombier"]');
    await fill("[aria-label=\"Zone d'intervention\"]", "Mpaka, Tié-Tié"); await tap('[aria-label="Modèle de prix Tarif horaire"]'); await fill('[aria-label="Montant"]', "12000");
    await tap('[aria-label="Durée Quelques heures"]'); await fill('[aria-label="Biographie"]', "Plombier depuis douze ans à Pointe-Noire.");
    await tap('[aria-label="Continuer vers les consentements"]');
    await tap('[aria-label="Lire Contrat Prestataire"]'); await tap("[aria-label=\"J'ai lu et j'accepte le contrat Prestataire\"]");
    await tap("[aria-label=\"J'accepte les conditions d'utilisation\"]"); await tap("[aria-label=\"J'accepte la politique de confidentialité\"]");
    await fill('[aria-label="Signature : votre nom complet"]', "Jean-Paul Massamba");
    await tap('[aria-label="Créer mon compte"]'); await wait("text=Vérification");
    await fill('[aria-label="Code de vérification"]', await code()); await wait('[aria-label="Confirmer le mot de passe"]');
    await fill('[aria-label="Mot de passe"]', "Konnect2026"); await fill('[aria-label="Confirmer le mot de passe"]', "Konnect2026"); await tap('[aria-label="Créer mon compte"]');
    await wait('[aria-label="Nouveau code"]'); await fill('[aria-label="Nouveau code"]', "428317"); await fill('[aria-label="Confirmer le code"]', "428317"); await tap('[aria-label="Définir mon code"]');
    await wait("text=Catégories");
    return true;
  });
  await check("the tab bar is anthracite", async () => (await barColour()) === ANTHRACITE);
  await check("the header says Espace Pro, with the PRO badge", async () => (await seen("text=Espace Pro")) && (await seen("text=PRO")));
  await check("the centre button opens the provider's space, not a client request", async () =>
    (await seen('[aria-label="Mon Espace Pro"]')) && !(await seen('[aria-label="Publier une demande"]')));
  await check("the marketplace is all still there", async () =>
    (await seen('[aria-label="Quel service recherchez-vous ?"]')) && (await seen("text=Top Professionnels")));
  await check("the dashboard shortcut opens the Espace Prestataire", async () => {
    await tap('[aria-label="Ouvrir mon tableau de bord"]');
    await wait("text=Suivi de la vérification");
    return seen("text=Plombier");
  });
  await check("its back button leads to the Profil page", async () => {
    await tap('[aria-label="Retour"]');
    await wait('[aria-label="Modifier le profil"]', 5000);
    await tap('[aria-label="Mon Espace Pro"]');
    await wait("text=Suivi de la vérification");
    return true;
  });

  console.log("\n── Switching profile switches the look ──");
  await check("as Particulier: light tab bar and the request button", async () => {
    // Opened from Accueil, the dashboard must still have the Profil page under
    // it: tapping the Profil tab returns there.
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Activer le profil Particulier"]');
    await tap('[aria-label="Accueil"]');
    return (await barColour()) === WHITE && (await seen('[aria-label="Publier une demande"]')) && (await seen("text=Bienvenue,"));
  });
  await check("back to Prestataire: Mode Pro again", async () => {
    await tap('[aria-label="Profil"]');
    await tap('[aria-label="Profil Prestataire"]');
    await tap('[aria-label="Accueil"]');
    return (await barColour()) === ANTHRACITE && (await seen("text=Espace Pro"));
  });
  await check("no page errors", async () => errors.length === 0);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  await browser.close(); site.close(); await fake.close?.();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
