/**
 * Checks the single-file preview page: it must run from file:// with no network
 * at all, keep the app's fixed bars and modal portals inside the phone frame,
 * and honour both themes.
 */
const { chromium } = require("playwright");
const F = process.env.PREVIEW_FILE ||
  "file://" + require("path").resolve(__dirname, "..", "dist-preview", "242konnect.html");
const OUT = process.env.SHOT_DIR || require("os").tmpdir() + "/242konnect-shots";

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let fail = 0;
  const log = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) fail++; };

  // textContent matches every ancestor, so take the deepest element that still
  // contains the string — otherwise this measures the page wrapper.
  const INNERMOST = `(t) => {
    const all = [...document.querySelectorAll('div')].filter(d => d.textContent.includes(t));
    return all.filter(d => ![...d.children].some(c => c.textContent.includes(t)))[0] || null;
  }`;

  for (const [w, h, label] of [[1280, 1000, "desktop"], [390, 900, "mobile"]]) {
    console.log(`\n${label} ${w}x${h}`);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const bad = [];
    page.on("requestfailed", (r) => bad.push("FAILED " + r.url().slice(0, 60)));
    page.on("pageerror", (e) => bad.push("pageerror: " + e.message.slice(0, 100)));
    page.on("console", (m) => m.type() === "error" && bad.push("console: " + m.text().slice(0, 100)));

    await page.goto(F);
    // The splash runs first now; wait past it to the Commencer screen.
    await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
    await page.waitForTimeout(1200);

    const visible = async (sel) => {
      for (const el of (await page.locator(sel).all()).reverse()) if (await el.isVisible()) return el;
      return null;
    };
    // Sign up so the tabs and sheets exist to be measured. Sign-up is now
    // three steps (type → identity → details) and ends on OTP verification.
    await (await visible('[aria-label="Créer un compte"]')).click();
    await page.waitForSelector("text=Quel type de compte ?", { timeout: 15000 });
    await page.waitForTimeout(500);
    await (await visible('[aria-label="Continuer"]')).click();
    await page.waitForTimeout(600);
    await (await visible('[aria-label="Nom complet"]')).fill("Estevao Macumba");
    await (await visible('[aria-label="Numéro de téléphone"]')).fill("061234567");
    await (await visible('[aria-label="Adresse e-mail"]')).fill("estevao@mwinda.cg");
    await (await visible('[aria-label="Mot de passe"]')).fill("motdepasse");
    await (await visible('[aria-label="Continuer vers les informations"]')).click();
    await page.waitForSelector("text=Où intervenir ?", { timeout: 15000 });
    await page.waitForTimeout(500);
    await (await visible('[aria-label="Adresse complète"]')).fill("Avenue Tiboti, Mpaka");
    await (await visible("[aria-label=\"Référence de l'adresse\"]")).fill("En face du marché");
    await (await visible('[aria-label="Créer mon compte"]')).click();
    await page.waitForSelector("text=Vérification", { timeout: 20000 });
    await page.waitForTimeout(700);
    const otp = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find(
        (n) => /^\d{6}$/.test((n.textContent || "").trim()) && n.children.length === 0
      );
      return el ? el.textContent.trim() : null;
    });
    if (!otp) throw new Error("demo OTP not found on the preview page");
    await (await visible('[aria-label="Code de vérification"]')).fill(otp);
    await page.waitForSelector("text=Catégories", { timeout: 20000 });
    await page.waitForTimeout(1200);

    log(!bad.length, bad.length ? `runtime: ${bad[0]}` : "no runtime errors, zero network");

    const hOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    log(!hOverflow, "no horizontal page scroll");

    const contained = await page.evaluate((src) => {
      const innermost = eval(src);
      const phone = document.querySelector(".phone").getBoundingClientRect();
      const el = innermost("Accueil");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.bottom <= phone.bottom + 2 && r.top >= phone.top - 2;
    }, INNERMOST);
    log(contained === true, "tab bar stays inside the phone frame");

    // "Directly bring to the app": the app must occupy the viewport on load,
    // with nothing above it to scroll past.
    const landing = await page.evaluate(() => {
      const phone = document.querySelector(".phone").getBoundingClientRect();
      return {
        top: Math.round(phone.top),
        coversH: phone.height >= Math.min(844, window.innerHeight) - 2,
        noScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
        onlyChild: document.querySelectorAll("body > .stage").length === 1,
      };
    });
    log(landing.coversH && landing.noScroll, `app fills the viewport on load (top=${landing.top}, no page scroll)`);
    log(landing.onlyChild, "nothing above the app to scroll past");

    if (label === "mobile") {
      const bleed = await page.evaluate(() => {
        const r = document.querySelector(".phone").getBoundingClientRect();
        const cs = getComputedStyle(document.querySelector(".phone"));
        return r.width >= window.innerWidth - 1 && cs.borderTopWidth === "0px";
      });
      log(bleed, "full-bleed on a phone (no wasted frame)");
    }
    await page.screenshot({ path: `${OUT}/preview-${label}.png` });

    if (label === "desktop") {
      await (await visible('[aria-label*="Notifications"]')).click();
      await page.waitForTimeout(800);
      const modalIn = await page.evaluate((src) => {
        const innermost = eval(src);
        const phone = document.querySelector(".phone").getBoundingClientRect();
        const el = innermost("Jean-Paul K. a accepté");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.top >= phone.top - 4 && r.bottom <= phone.bottom + 4
            && r.left >= phone.left - 4 && r.right <= phone.right + 4;
      }, INNERMOST);
      log(modalIn === true, "modal portal contained by the phone frame");
      await page.screenshot({ path: `${OUT}/preview-modal.png` });
      await (await visible('[aria-label="Fermer"]')).click();
      await page.waitForTimeout(500);

      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(400);
      const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      log(dark === "rgb(7, 12, 22)", `data-theme=dark wins (${dark})`);
      await page.screenshot({ path: `${OUT}/preview-dark.png` });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      await page.waitForTimeout(300);
      const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      log(light === "rgb(230, 234, 240)", `data-theme=light wins (${light})`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(fail ? `\n${fail} check(s) failed` : "\n✓ all preview checks passed");
  process.exit(fail ? 1 : 0);
})();
