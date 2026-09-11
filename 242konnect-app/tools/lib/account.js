/**
 * Creates a real account, the way a real person does.
 *
 * The suites used to sign in through a built-in demo account. That account is
 * gone — it put a working password into the shipped JavaScript, which is not
 * something a production build should carry — so anything that needs to be
 * *inside* the app now has to sign up for itself.
 *
 * That means a verification code, and the code exists only in an e-mail. So
 * these suites run against a build pointed at the local 242Konnect API
 * (`EXPO_PUBLIC_API_URL`), whose console transport writes the mail to a log,
 * and the helper reads it from there — the way a user reads their inbox. The
 * page never holds the code, which is the property under test elsewhere and
 * must stay true here.
 *
 * Usage:
 *   const { signUp } = require("./lib/account");
 *   await signUp(page, { phone: "066554433", email: "t@mwinda.cg" });
 */
const fs = require("fs");

const API_LOG = process.env.API_LOG || "/tmp/242konnect-api.log";

/** How long the outbox is watched for a code before giving up. */
const CODE_TIMEOUT_MS = 15000;

function outboxLength() {
  return fs.existsSync(API_LOG) ? fs.readFileSync(API_LOG, "utf8").length : 0;
}

/** The newest code the API mailed after `since`, waiting for it to arrive. */
async function mailedCode(since) {
  const deadline = Date.now() + CODE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (fs.existsSync(API_LOG)) {
      const fresh = fs.readFileSync(API_LOG, "utf8").slice(since);
      const all = [...fresh.matchAll(/est : (\d{6})/g)];
      if (all.length) return all[all.length - 1][1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no code in the API outbox — is the API running, and is the build pointed at it?");
}

/**
 * Walks the whole sign-up: type, identity, profile details, the mailed code,
 * then the password that finally creates the account.
 *
 * Resolves once the app's home screen is showing. Throws with the step that
 * failed, so a broken suite says where rather than just timing out.
 */
async function signUp(page, options = {}) {
  const {
    name = "Estevao Macumba",
    phone = "066554433",
    email = "tester@mwinda.cg",
    password = "Mwinda2026",
    city = "Pointe-Noire",
    address = "Avenue Tiboti, Mpaka",
    landmark = "En face du marché",
    timeout = 20000,
  } = options;

  const visible = async (sel) => {
    for (const el of (await page.locator(sel).all()).reverse()) {
      if (await el.isVisible()) return el;
    }
    return null;
  };
  const tap = async (sel) => {
    const el = await visible(sel);
    if (!el) throw new Error(`sign-up: nothing visible for ${sel}`);
    await el.click();
    await page.waitForTimeout(600);
  };
  const fill = async (sel, value) => {
    const el = await visible(sel);
    if (!el) throw new Error(`sign-up: nothing visible for ${sel}`);
    await el.fill(value);
    await page.waitForTimeout(200);
  };

  await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
  await page.waitForTimeout(700);

  await tap('[aria-label="Créer un compte"]');
  await page.waitForSelector("text=Quel type de compte ?", { timeout });
  await tap('[aria-label="Continuer"]');

  await fill('[aria-label="Nom complet"]', name);
  await fill('[aria-label="Numéro de téléphone"]', phone);
  await fill('[aria-label="Adresse e-mail"]', email);
  await tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
  await tap(`[aria-label="${city}"]`);

  // Mark the outbox immediately before the send, so a code left over from an
  // earlier run cannot be mistaken for this one.
  const since = outboxLength();
  await tap('[aria-label="Continuer vers les informations"]');
  await page.waitForSelector("text=Où intervenir ?", { timeout });

  await fill('[aria-label="Adresse complète"]', address);
  await fill("[aria-label=\"Référence de l'adresse\"]", landmark);
  await tap('[aria-label="Créer mon compte"]');
  await page.waitForSelector("text=Vérification", { timeout });

  await fill('[aria-label="Code de vérification"]', await mailedCode(since));
  await page.waitForSelector('[aria-label="Confirmer le mot de passe"]', { timeout });

  await fill('[aria-label="Mot de passe"]', password);
  await fill('[aria-label="Confirmer le mot de passe"]', password);
  await tap('[aria-label="Créer mon compte"]');

  // The PIN offer sits between account creation and the app. Skipping it keeps
  // these suites about their own subject; verify-pin covers the screen itself.
  const later = await visible('[aria-label="Plus tard"]');
  if (later) {
    await later.click();
    await page.waitForTimeout(800);
  }

  await page.waitForSelector("text=Catégories", { timeout });
  return { name, phone, email, password };
}

module.exports = { signUp, mailedCode, outboxLength, API_LOG };
