/**
 * The app in English, for someone in the United States.
 *
 * Two things the first field test (Utah, November 2026) reported:
 *
 *  1. "Some buttons stay in French after changing the language." The i18n
 *     check only sees strings written as t('…'); a sentence typed straight
 *     into a screen, or an error thrown outside a component, is invisible to
 *     it. So this drives the app in English — sign-up to chat, client and
 *     prestataire — and reads every visible text, label and placeholder on
 *     each screen for French. It also reads the list of keys the app asked
 *     for in English and found no translation for.
 *  2. "I chose the United States and the app shows the Congo." Checked here:
 *     a US account sees the United States, its cities and its prestataires,
 *     never the Congo's, and can contact one.
 *
 * Runs against tools/lib/fake-supabase.js with the dist-market build:
 *
 *   APP_DIST=$PWD/dist-market node tools/verify-english.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { createFakeSupabase } = require("./lib/fake-supabase");
const { writePng } = require("./lib/account");

const ROOT = process.env.APP_DIST || path.resolve(__dirname, "..", "dist-market");
const PORT = 8994;
const OUTBOX = path.join(os.tmpdir(), "242k-fake-supabase-en.log");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon", ".jpeg": "image/jpeg" };

// The English dictionary, read from the source the app is built from.
const en = (() => {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "src", "locales", "en.ts"), "utf8");
  const body = src.slice(src.indexOf("{", src.indexOf("export const en")));
  return vm.runInNewContext("(" + body.replace(/;\s*$/, "") + ")");
})();
const E = (fr) => en[fr] ?? fr;
/** An element by its label, in English — or in French if it leaked, so the tour goes on and the scan reports it. */
const sel = (fr) => `[aria-label="${E(fr)}"], [aria-label="${fr}"]`;

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
const shots = [];
const check = async (label, fn) => {
  try {
    if (!(await fn())) throw new Error("assertion returned falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + String(e.message).split("\n")[0]);
    fails.push(label);
    // SHOTS=<dir>: what each phone showed when the check failed.
    if (process.env.SHOTS)
      for (const [i, page] of shots.entries())
        await page.screenshot({ path: path.join(process.env.SHOTS, `fail-${fails.length}-${i}.png`) }).catch(() => {});
  }
};
const section = (name) => console.log(`\n── ${name} ──`);
/** SHOTS=<dir>: keeps a picture of the screens the field test was about. */
const snap = async (page, name) => {
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + ".png") }).catch(() => {});
};

// French, as it shows on an English screen: an accent, or a word English does not have.
const FRENCH = /[àâçèéêëîïôùûœ]|\b(le|la|les|des|du|une|un|votre|vos|notre|avec|dans|vous|nous|cette|ces|aux|chez|sans|aussi|demande|demandes|paiement|prestataire|prestataires|ville|envoyer|annuler|retour|aucun|aucune|chaque|toutes|tous|compte|rechercher|voir|suivant|continuer|choisir|modifier|ajouter|confirmer|connexion|bienvenue|demain|heures|jours|semaines|mois|adresse|pour|est|et|ou|de|sur|par)\b/i;
// What may stay French: the language's own name, and what the testers typed.
const ALLOWED = [/^(🇫🇷\s*)?Français$/];
const leaks = new Map();

function helpers(page, who) {
  const visible = async (s) => {
    for (const el of (await page.locator(s).all()).reverse()) if (await el.isVisible()) return el;
    return null;
  };
  const tap = async (s) => {
    const el = await visible(s);
    if (!el) throw new Error("not visible: " + s);
    await el.click();
    await page.waitForTimeout(600);
  };
  const fill = async (s, v) => {
    const el = await visible(s);
    if (!el) throw new Error("not visible: " + s);
    await el.fill(v);
    await page.waitForTimeout(200);
  };
  const seen = async (s) => !!(await visible(s));
  const waitSeen = async (s, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await seen(s)) return true;
      await page.waitForTimeout(400);
    }
    return false;
  };
  const texts = () =>
    page.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
      };
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const s = n.nodeValue.trim();
        if (s && n.parentElement && vis(n.parentElement)) out.add(s);
      }
      for (const el of document.querySelectorAll("[aria-label],[placeholder]"))
        if (vis(el)) for (const a of ["aria-label", "placeholder"]) if (el.getAttribute(a)) out.add(el.getAttribute(a));
      return [...out];
    });
  /** Reads the screen that is up and files anything French under its name. */
  const scan = async (screen) => {
    await page.waitForTimeout(300);
    for (const text of await texts())
      if (FRENCH.test(text) && !ALLOWED.some((re) => re.test(text))) {
        const key = text.slice(0, 140);
        if (!leaks.has(key)) leaks.set(key, `${who} · ${screen}`);
      }
  };
  const has = async (needle) => (await texts()).some((x) => x.includes(needle));
  return { visible, tap, fill, seen, waitSeen, scan, has, texts };
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

/** United States, Utah, Provo — on the sign-up identity step. */
async function chooseUtah(h) {
  await h.tap('[aria-label^="Country:"], [aria-label^="Pays :"]');
  await h.tap('[aria-label$="United States"], [aria-label$="États-Unis"]');
  await h.tap(sel("Choisir l'État"));
  await h.tap('[aria-label="Utah"]');
  await h.fill(sel("Ville"), "Provo");
}

/** Consents, code, password, PIN: the end of every sign-up. */
async function finish(page, h, email) {
  await h.tap(sel("J'accepte les conditions d'utilisation"));
  await h.tap(sel("J'accepte la politique de confidentialité"));
  await h.scan("sign-up: consents");
  await h.tap(sel("Créer mon compte"));
  if (!(await h.waitSeen(sel("Code de vérification")))) throw new Error("no code step");
  await h.scan("verification code");
  await h.fill(sel("Code de vérification"), await latestCode(email));
  if (!(await h.waitSeen(sel("Confirmer le mot de passe")))) throw new Error("no password step");
  await h.scan("create password");
  await h.fill(sel("Mot de passe"), "Konnect2026");
  await h.fill(sel("Confirmer le mot de passe"), "Konnect2026");
  await h.tap(sel("Créer mon compte"));
  if (!(await h.waitSeen(sel("Nouveau code")))) throw new Error("no PIN step");
  await h.scan("set PIN");
  await h.fill(sel("Nouveau code"), "428317");
  await h.fill(sel("Confirmer le code"), "428317");
  await h.tap(sel("Définir mon code"));
}

(async () => {
  fs.writeFileSync(OUTBOX, "");
  const fake = createFakeSupabase({ port: 8990, outbox: OUTBOX });
  await fake.listen();
  await new Promise((r) => site.listen(PORT, r));
  // Already in the directory: one prestataire in each country.
  fake.seedListing({ full_name: "Briany Kabas", trade_id: "peintre", city: "Lehi", country: "US", pricing: { model: "hourly", amount: 40, currency: "USD", negotiable: false } });
  fake.seedListing({ full_name: "Jean-Paul Massamba", trade_id: "peintre", city: "Pointe-Noire", country: "CG", pricing: { model: "fixed", amount: 15000, currency: "FCFA", negotiable: false } });

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const open = async () => {
    // An American phone: the app starts in English on its own.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    shots.push(page);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    return page;
  };
  const avatar = writePng(path.join(os.tmpdir(), "242k-en-avatar.png"));

  // ---------------------------------------------------------------- P
  section("A prestataire in Utah signs up, in English");
  const pp = await open();
  const p = helpers(pp, "prestataire");
  await check("the app opens in English on an American phone", async () => {
    const ok = await p.waitSeen(sel("Créer un compte"), 30000);
    await pp.waitForTimeout(800);
    await p.scan("welcome");
    return ok && (await p.seen('[aria-label="Create an account"]'));
  });
  await check("sign-up as a prestataire, United States, Utah", async () => {
    await p.tap(sel("Créer un compte"));
    await p.scan("sign-up: profile");
    await p.tap(sel("Prestataire"));
    await p.tap(sel("Continuer"));
    await p.fill(sel("Nom complet"), "Daniel Moore");
    await p.fill(sel("Numéro de téléphone"), "066112233");
    await p.fill(sel("Adresse e-mail"), "daniel@example.com");
    await chooseUtah(p);
    const [chooser] = await Promise.all([pp.waitForEvent("filechooser", { timeout: 15000 }), p.tap(sel("Ajouter une photo de profil"))]);
    await chooser.setFiles(avatar);
    await pp.waitForTimeout(2500);
    await p.scan("sign-up: identity");
    await p.tap(sel("Continuer vers les informations"));
    await p.fill(sel("Date de naissance"), "1990-04-12");
    await p.tap(sel("Choisir votre métier"));
    await p.scan("sign-up: trade picker");
    await p.tap(sel("Plombier"));
    await p.fill(sel("Zone d'intervention"), "Provo and Orem");
    await p.tap(`[aria-label="${E("Modèle de prix")} ${E("Tarif horaire")}"]`);
    await p.fill(sel("Montant"), "45");
    await p.tap(`[aria-label="${E("Durée")} ${E("Quelques heures")}"]`);
    await p.fill(sel("Biographie"), "Plumber for twelve years.");
    await p.scan("sign-up: professional details");
    await p.tap(sel("Continuer vers les consentements"));
    await p.tap(`[aria-label="${E("Lire")} ${E("Contrat Prestataire")}"]`);
    await p.scan("sign-up: provider contract");
    await p.tap(sel("J'ai lu et j'accepte le contrat Prestataire"));
    await p.fill(sel("Signature : votre nom complet"), "Daniel Moore");
    await finish(pp, p, "daniel@example.com");
    return p.waitSeen(`text=${E("Tableau de bord")}`, 25000);
  });
  await check("the listing is published in the United States", async () => {
    const end = Date.now() + 10000;
    let l;
    while (Date.now() < end && !(l = [...fake.listings.values()].find((x) => x.full_name === "Daniel Moore"))) await pp.waitForTimeout(300);
    return !!l && l.country === "US" && l.city === "Provo";
  });
  await check("the prestataire's screens are read: dashboard, jobs, messages, profile", async () => {
    await p.scan("provider dashboard");
    await p.tap(sel("Missions"));
    await p.scan("jobs: available");
    await p.tap(sel("Mes missions"));
    await p.scan("jobs: mine");
    await p.tap(sel("Historique"));
    await p.scan("jobs: history");
    await p.tap(sel("Messages"));
    await p.scan("provider messages");
    await p.tap(sel("Publier"));
    await p.scan("provider + sheet");
    await p.tap(sel("Fermer"));
    await p.tap(sel("Profil"));
    await p.scan("provider settings");
    await p.tap(sel("Documents, contrat et vérification"));
    await p.scan("provider file");
    await p.tap(sel("Retour"));
    await p.tap(sel("Modifier le profil professionnel"));
    await p.scan("edit profile");
    await p.tap(sel("Retour"));
    return true;
  });

  fake.approveAll(); // what a 242Konnect reviewer does

  // ---------------------------------------------------------------- A
  section("A client in Utah signs up, in English");
  const pa = await open();
  const a = helpers(pa, "client");
  await check("sign-up as a client, United States, Utah", async () => {
    await a.waitSeen(sel("Créer un compte"), 30000);
    await a.tap(sel("Créer un compte"));
    await a.tap(sel("Continuer"));
    await a.fill(sel("Nom complet"), "Sarah Kent");
    await a.fill(sel("Numéro de téléphone"), "066554433");
    await a.fill(sel("Adresse e-mail"), "sarah@example.com");
    await chooseUtah(a);
    await a.scan("sign-up: identity (client)");
    await a.tap(sel("Continuer vers les informations"));
    await a.fill(sel("Adresse complète"), "450 Center Street");
    await a.fill(sel("Référence de l'adresse"), "Next to the library");
    await a.scan("sign-up: address");
    await a.tap(sel("Continuer vers les consentements"));
    await finish(pa, a, "sarah@example.com");
    return a.waitSeen(`text=${E("Catégories")}`, 25000);
  });

  section("The United States, not the Congo");
  await check("the home screen opens on the account's own city", async () => {
    await a.scan("home");
    return (await a.has("Provo, Utah, USA")) && !(await a.has("Congo"));
  });
  await check("it lists the prestataires of the United States only", async () => {
    const us = (await a.waitSeen(`[aria-label="${E("Prestataire inscrit")} Daniel Moore"]`, 40000)) && (await a.seen(`[aria-label="${E("Prestataire inscrit")} Briany Kabas"]`));
    await snap(pa, "home-usa");
    return us && !(await a.has("Jean-Paul Massamba"));
  });
  await check("the area picker offers the United States and its cities", async () => {
    await a.tap('[aria-label*="Provo, Utah, USA"]');
    await a.scan("area picker");
    await snap(pa, "area-picker-usa");
    const ok = (await a.seen('[aria-label="United States"]')) && (await a.seen('[aria-label="Lehi, USA"]')) && !(await a.has("Brazzaville"));
    await a.tap('[aria-label="Lehi, USA"]');
    return ok && (await a.has("Lehi, USA"));
  });
  await check("a category shows the country's prestataires of that trade", async () => {
    await a.tap(`[aria-label="${E("Catégorie")} ${E("Construction & Bâtiment")}"]`);
    await pa.waitForTimeout(800);
    await a.scan("category results");
    const ok = (await a.seen(`[aria-label="${E("Prestataire inscrit")} Briany Kabas"]`)) && !(await a.has("Daniel Moore")) && !(await a.has("Jean-Paul"));
    await a.tap(sel("Retour"));
    return ok;
  });
  await check("the trades list shows no Congolese prices", async () => {
    await a.tap(sel("Voir tous les métiers"));
    await pa.waitForTimeout(600);
    await a.scan("all trades");
    const ok = !(await a.has("FCFA"));
    await a.tap(sel("Retour"));
    return ok;
  });

  section("Contacting a prestataire");
  await check("the client writes to a prestataire, with nothing to pay", async () => {
    await a.tap(`[aria-label="${E("Prestataire inscrit")} Daniel Moore"]`);
    await a.waitSeen(`[aria-label="${E("Contacter")} Daniel Moore"]`);
    await a.scan("prestataire page");
    await a.tap(`[aria-label="${E("Envoyer une demande à")} Daniel Moore"]`);
    await a.scan("booking sheet");
    await a.tap(sel("Fermer"));
    await a.tap(`[aria-label="${E("Contacter")} Daniel Moore"]`);
    await a.scan("contact sheet");
    await snap(pa, "contact-sheet");
    await a.fill(sel("Votre message au prestataire"), "Hello, my kitchen sink leaks. Call me on 801 555 0100 please.");
    await a.tap(sel("Envoyer le message au prestataire"));
    const sent = await a.waitSeen(sel("Ouvrir mes messages"));
    await a.scan("contact sent");
    const r = [...fake.requests.values()].find((x) => x.kind === "inquiry");
    return sent && !!r && r.status === "sent" && r.amount === null;
  });
  await check("the conversation is in the client's Messages", async () => {
    await a.tap(sel("Ouvrir mes messages"));
    // The client sees the prestataire's first name and initial, as everywhere before a booking.
    const listed = await a.waitSeen(`[aria-label="${E("Conversation avec")} Daniel M."]`, 20000);
    await a.scan("client messages");
    return listed;
  });
  await check("the prestataire reads it, phone number masked, and answers", async () => {
    await p.tap(sel("Accueil"));
    await p.tap(sel("Missions"));
    await p.tap(sel("Disponibles"));
    await p.waitSeen(`[aria-label="${E("Lire le message de")} Sarah K."]`, 30000);
    await p.scan("jobs: a contact request");
    const cardMasked = (await p.has("•••")) && !(await p.has("555 0100"));
    await p.tap(`[aria-label="${E("Lire le message de")} Sarah K."]`);
    await p.scan("contact request sheet");
    const masked = (await p.has("•••")) && !(await p.has("555 0100"));
    await p.tap(sel("Répondre au client"));
    await p.scan("provider chat");
    await p.fill(sel("Votre message"), "Hello Sarah, I can come tomorrow at 9.");
    await p.tap(sel("Envoyer le message"));
    await p.tap(sel("Fermer"));
    await p.tap(sel("Fermer"));
    return masked && cardMasked;
  });
  await check("the answer reaches the client", async () => {
    await a.tap(`[aria-label="${E("Conversation avec")} Daniel M."]`);
    const ok = await a.waitSeen("text=Hello Sarah, I can come tomorrow at 9.", 15000);
    await a.scan("client chat");
    await a.tap(sel("Fermer"));
    return ok;
  });

  section("The rest of the client's screens, read in English");
  await check("missions, the + sheet, profile, privacy, FAQ", async () => {
    await a.tap(sel("Missions"));
    await pa.waitForTimeout(800);
    await a.scan("client missions");
    await a.tap(sel("Publier une demande"));
    await a.scan("post a request: categories");
    await a.tap(`[aria-label="${E("Publier une demande en")} ${E("Plomberie")}"]`);
    await a.scan("post a request: trades");
    await a.tap(`[aria-label="${E("Métier")} ${E("Plombier")}"]`);
    await a.scan("post a request: form");
    await a.tap(sel("Fermer"));
    await a.tap(sel("Accueil"));
    await a.tap(sel("Retour")); // the Home tab was left on the prestataire's page
    await a.tap('[aria-label^="Notifications"]');
    await a.scan("notifications");
    await a.tap(sel("Fermer"));
    await a.tap(sel("Profil"));
    await a.scan("client profile");
    await a.tap(sel("Modifier le profil"));
    await a.scan("client edit profile");
    await a.tap(sel("Retour"));
    await a.tap(sel("Confidentialité"));
    await a.scan("privacy");
    await a.tap(sel("Retour"));
    await a.tap(sel("Questions fréquentes"));
    await a.scan("FAQ");
    await a.tap(sel("Retour"));
    return true;
  });
  await check("signing out and the sign-in screen", async () => {
    await a.tap(sel("Se déconnecter"));
    await a.waitSeen(sel("J'ai déjà un compte, se connecter"));
    await a.scan("welcome, signed out");
    await a.tap(sel("J'ai déjà un compte, se connecter"));
    await a.waitSeen(sel("Numéro de téléphone ou e-mail"));
    await a.scan("sign in");
    await a.fill(sel("Numéro de téléphone ou e-mail"), "sarah@example.com");
    await a.fill(sel("Mot de passe"), "wrong-password");
    await a.tap(sel("Se connecter"));
    await pa.waitForTimeout(1500);
    await a.scan("sign in: wrong password");
    return true;
  });

  section("Nothing left in French");
  const untranslated = new Set();
  for (const page of [pa, pp])
    for (const key of await page.evaluate(() => [...(globalThis.__i18nMissing ?? [])])) untranslated.add(key);
  // Typed by the people in this test, not by the app.
  for (const typed of ["Provo and Orem", "Plumber for twelve years.", "450 Center Street", "Next to the library", "Provo", "Lehi", "Utah", "Daniel Moore", "Sarah Kent", "Briany Kabas"]) untranslated.delete(typed);
  await check("every string the app asked for has an English translation", async () => {
    [...untranslated].slice(0, 60).forEach((k) => console.log("      no English: " + JSON.stringify(k)));
    return untranslated.size === 0;
  });
  await check("no French text on any screen visited", async () => {
    [...leaks.entries()].slice(0, 80).forEach(([text, where]) => console.log(`      ${where}: ${JSON.stringify(text)}`));
    return leaks.size === 0;
  });
  if (process.env.LEAKS_OUT) fs.writeFileSync(process.env.LEAKS_OUT, JSON.stringify({ leaks: [...leaks.entries()], untranslated: [...untranslated] }, null, 1));
  await check("no page errors", async () => errors.length === 0);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  errors.slice(0, 5).forEach((e) => console.log("   ! " + e));
  await browser.close();
  site.close();
  fake.close();
  process.exit(fails.length ? 1 : 0);
})();
