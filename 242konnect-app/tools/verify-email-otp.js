/**
 * Proves the e-mail OTP path end to end: the app asks the API for a code, the
 * API mails it (console transport here), and the app accepts only that code.
 *
 * The point is that the code is never in the app's own state — the test has to
 * read it from the API's outbox, exactly as a user reads their inbox.
 */
const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = process.env.APP_DIST || require("path").resolve(__dirname, "..", "dist");
// The API's console transport writes here; the test reads it the way a
// user reads their inbox.
const LOG = process.env.API_LOG || "/tmp/242konnect-api.log";
const TYPES = {".html":"text/html",".js":"text/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".ttf":"font/ttf",".ico":"image/x-icon",".svg":"image/svg+xml"};
const server = http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split("?")[0]);const f=path.join(ROOT,p==="/"?"/index.html":p);
 if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(200,{"Content-Type":"text/html"});fs.createReadStream(path.join(ROOT,"index.html")).pipe(res);return;}
 res.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});

let pass = 0; const fails = [];
const check = async (label, fn) => { try { const r = await fn(); if (!r) throw new Error("falsy"); console.log("  ✓ "+label); pass++; }
  catch (e) { console.log("  ✗ "+label+" — "+e.message.split("\n")[0]); fails.push(label); } };

(async () => {
  await new Promise(r => server.listen(Number(process.env.PORT || 8988), r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  // Pinned: the app follows the device language, so a browser reporting en-US
  // opens it in English and every French selector below silently misses.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0,120)));

  const vis = async s => { for (const e of (await p.locator(s).all()).reverse()) if (await e.isVisible()) return e; return null; };
  const tap = async s => { const e = await vis(s); if (!e) throw new Error("not visible: "+s); await e.click(); await p.waitForTimeout(500); };
  const fill = async (s,v) => { const e = await vis(s); if (!e) throw new Error("not visible: "+s); await e.fill(v); await p.waitForTimeout(200); };
  const seen = async s => !!(await vis(s));

  await p.goto("http://localhost:8988/", { waitUntil: "networkidle" });
  await p.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
  await p.waitForTimeout(800);

  const before = fs.readFileSync(LOG, "utf8").length;

  // Sign-up opens on the account type, then identity, then the profile's own
  // details — and only then is a code sent. No password is asked for anywhere
  // before this point; it is chosen after the address is proved.
  await tap('[aria-label="Créer un compte"]');
  await p.waitForSelector("text=Quel type de compte ?", { timeout: 15000 });
  await tap('[aria-label="Continuer"]');
  await fill('[aria-label="Nom complet"]', "Estevao Macumba");
  await fill('[aria-label="Numéro de téléphone"]', "066554433");
  await fill('[aria-label="Adresse e-mail"]', "estevao@mwinda.cg");
  await tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
  await tap('[aria-label="Pointe-Noire"]');
  await tap('[aria-label="Continuer vers les informations"]');
  await p.waitForSelector("text=Où intervenir ?", { timeout: 15000 });
  await fill('[aria-label="Adresse complète"]', "Avenue Tiboti, Mpaka");
  await fill("[aria-label=\"Référence de l'adresse\"]", "En face du marché");
  await tap('[aria-label="Créer mon compte"]');
  await p.waitForSelector("text=Vérification", { timeout: 20000 });
  await p.waitForTimeout(1200);

  await check("app reports the e-mail was sent, not a demo code", async () =>
    (await seen("text=Consultez votre boîte e-mail")) && !(await seen("text=Démonstration")));

  await check("the code is nowhere in the page", async () => {
    const fresh = fs.readFileSync(LOG, "utf8").slice(before);
    const m = fresh.match(/est : (\d{6})/);
    if (!m) throw new Error("API did not send a code");
    const body = await p.content();
    // The code lives in the mail, not on the device.
    return !body.includes(m[1]);
  });

  await check("a wrong code is refused by the server", async () => {
    const fresh = fs.readFileSync(LOG, "utf8").slice(before);
    const real = fresh.match(/est : (\d{6})/)[1];
    const wrong = real === "000000" ? "111111" : "000000";
    await fill('[aria-label="Code de vérification"]', wrong);
    await p.waitForTimeout(1500);
    return seen("text=Code incorrect");
  });

  // Verifying unlocks the password step; that step creates the account. The
  // order matters — nothing exists until the address has been proved.
  await check("the mailed code unlocks the password step", async () => {
    const fresh = fs.readFileSync(LOG, "utf8").slice(before);
    const real = fresh.match(/est : (\d{6})/)[1];
    await fill('[aria-label="Code de vérification"]', real);
    await p.waitForSelector('[aria-label="Confirmer le mot de passe"]', { timeout: 20000 });
    return true;
  });

  await check("the password creates the account", async () => {
    await fill('[aria-label="Mot de passe"]', "Mwinda2026");
    await fill('[aria-label="Confirmer le mot de passe"]', "Mwinda2026");
    await tap('[aria-label="Créer mon compte"]');
    await p.waitForSelector("text=Catégories", { timeout: 20000 });
    return true;
  });

  await p.screenshot({ path: "app-shots/otp-email.png" });
  console.log(errs.length ? "\nRUNTIME: "+errs[0] : "\n✓ no page errors");
  console.log(`\n${pass} passed, ${fails.length} failed`);
  await b.close(); server.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
