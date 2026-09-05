/**
 * Can every tab be tapped on a phone?
 *
 * The founder reported the Profil button doing nothing on a phone while working
 * on a computer. The cause is not the button: mobile browsers report a layout
 * viewport taller than the visible one, so an app sized with `height: 100%`
 * runs its last row underneath the browser's own bottom chrome.
 *
 * This shrinks the visible viewport the way a browser toolbar does and checks
 * that every tab is still inside it and still reachable. A plain viewport does
 * not reproduce the bug, which is exactly why it survived earlier suites.
 */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");

const DIST = process.env.APP_DIST || path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8994);
/** Roughly the bottom chrome of Chrome on Android / Safari on iOS. */
const CHROME_PX = Number(process.env.CHROME_PX || 96);

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
const check = (ok, label) => { if (ok) { console.log("  ✓ " + label); pass++; }
  else { console.log("  ✗ " + label); fails.push(label); } };

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  // The visible area a phone actually gives the page, toolbars included.
  // Locale is pinned so the suite is deterministic. The app follows the
  // device language on first launch, so a browser reporting en-US opens it
  // in English and every French selector below silently misses.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 - CHROME_PX },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR",
  });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));

  const vis = async (s) => { for (const e of (await page.locator(s).all()).reverse())
    if (await e.isVisible()) return e; return null; };
  const tap = async (s) => { const e = await vis(s); if (!e) throw new Error("not visible: " + s);
    await e.click(); await page.waitForTimeout(700); };

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Chaque problème", { timeout: 30000 });
  await page.waitForTimeout(600);

  await tap('[aria-label="J\'ai déjà un compte, se connecter"]');
  await tap('[aria-label="Se connecter avec le compte de démonstration"]');
  await page.waitForTimeout(1600);
  check(!!(await vis("text=Catégories")), "signed in");

  const viewportH = page.viewportSize().height;

  // Every tab must sit inside the visible viewport, not merely exist.
  for (const label of ["Accueil", "Missions", "Messages", "Profil"]) {
    const el = await vis(`[aria-label="${label}"]`);
    if (!el) { check(false, `${label} tab is present`); continue; }
    const box = await el.boundingBox();
    check(
      !!box && box.y + box.height <= viewportH + 1,
      `${label} tab is inside the visible viewport (bottom ${box ? Math.round(box.y + box.height) : "?"} of ${viewportH})`
    );
  }

  // Playwright's viewport is already the visible one, so it cannot reproduce a
  // real phone's layout/visual viewport mismatch. What it can prove is that the
  // fix for it is actually live: the app must size itself with dvh, not 100%.
  const sizing = await page.evaluate(() => {
    const root = document.getElementById("root");
    const injected = document.querySelector('style[data-242k="viewport"]');
    return {
      injected: !!injected,
      usesDvh: !!injected && /100dvh/.test(injected.textContent || ""),
      rootHeight: root ? Math.round(root.getBoundingClientRect().height) : 0,
      innerHeight: window.innerHeight,
    };
  });
  check(sizing.injected && sizing.usesDvh, "the app sizes itself with dvh, not 100%");
  check(
    Math.abs(sizing.rootHeight - sizing.innerHeight) <= 2,
    `the app fills the visible viewport exactly (${sizing.rootHeight} vs ${sizing.innerHeight})`
  );

  // And Profil in particular must actually navigate, since that is the report.
  await tap('[aria-label="Profil"]');
  check(!!(await vis("text=Se déconnecter")), "tapping Profil opens the account screen");

  await tap('[aria-label="Accueil"]');
  check(!!(await vis("text=Catégories")), "and Accueil goes back");

  check(errs.length === 0, errs.length ? `no page errors (${errs[0]})` : "no page errors");

  console.log(`\n${pass} passed, ${fails.length} failed`);
  await browser.close(); server.close();
  process.exit(fails.length ? 1 : 0);
})();
