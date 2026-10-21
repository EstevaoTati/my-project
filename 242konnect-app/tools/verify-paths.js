/**
 * The build must work wherever it is served from.
 *
 * Both share links put the app at a sub-path, not at a site root:
 *
 *   https://<netlify-site>/242konnect-web
 *   https://rawcdn.githack.com/<owner>/<repo>/<sha>/242konnect-web/index.html
 *
 * `expo export` emits absolute URLs (`/_expo/…`, `/assets/…`), which resolve
 * against the origin and 404 at any depth other than the root. The failure is
 * silent — a blank page, no error dialog — which is exactly how two broken
 * preview links got sent out before this suite existed.
 *
 * So this loads the real build at three depths and asserts the app actually
 * paints, with no failed request. Static grepping is not enough: the asset URLs
 * live inside the bundle, and only a browser resolves them.
 *
 *   BUILD_DIR=../242konnect-web node tools/verify-paths.js
 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BUILD = path.resolve(process.env.BUILD_DIR || "../242konnect-web");
const PORT = Number(process.env.PORT || 8094);

// Depths to serve the app at. "" is a site root; the others mimic Netlify and
// githack, which is where it is actually shared from.
const MOUNTS = ["", "/242konnect-web", "/a/b/c/242konnect-web"];

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".ttf": "font/ttf", ".ico": "image/x-icon", ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);

  // A bare directory URL redirects to the trailing-slash form, which is what
  // netlify.toml declares and what makes relative references resolve against
  // the app's own folder. Modelled here rather than assumed: answering the bare
  // path with the file's bytes instead — a `status = 200` rewrite — is what
  // produced a blank page on the shared link.
  const bare = MOUNTS.find((m) => m && url === m);
  if (bare) {
    res.writeHead(301, { Location: bare + "/" });
    res.end();
    return;
  }

  const mount = MOUNTS.filter((m) => m && url.startsWith(m + "/")).sort((a, b) => b.length - a.length)[0] ?? "";
  const rel = url.slice(mount.length) || "/";
  const file = path.join(BUILD, rel === "/" ? "/index.html" : rel);
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try {
    const r = await fn();
    if (!r) throw new Error("assertion falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + e.message.split("\n")[0]);
    fails.push(label);
  }
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  await check("index.html holds no absolute reference", () => {
    const html = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
    const abs = html.match(/(src|href)="\/[^"]*"/g);
    if (abs) throw new Error("absolute: " + abs.join(", "));
    return true;
  });

  await check("the bundle holds no absolute asset URL", () => {
    const dir = path.join(BUILD, "_expo/static/js/web");
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      const hits = fs.readFileSync(path.join(dir, f), "utf8").match(/"\/assets\//g);
      if (hits) throw new Error(`${hits.length} in ${f}`);
    }
    return true;
  });

  // Each URL gets its own browser context, and that is not tidiness: the app
  // records "already launched" in localStorage, so a second visit in the same
  // context routes past the welcome screen to Connexion — and an assertion on
  // welcome copy would fail for a reason that has nothing to do with paths.
  const visit = async (url, label) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const page = await ctx.newPage();
    const bad = [];
    page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
    page.on("requestfailed", (r) => bad.push(`FAILED ${r.url()}`));

    await check(`the app paints at ${label}`, async () => {
      await page.goto(url, { waitUntil: "networkidle" });
      // Past the splash, then real copy — a blank page is the symptom this
      // whole suite exists to catch.
      await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 25000 });
      return true;
    });

    await check(`no failed request at ${label}`, async () => {
      await page.waitForTimeout(1500);
      if (bad.length) throw new Error(bad.slice(0, 3).join(" | "));
      return true;
    });

    await ctx.close();
  };

  for (const mount of MOUNTS) {
    const where = mount || "(site root)";
    await visit(`http://127.0.0.1:${PORT}${mount}/index.html`, `${where}/index.html`);

    // The bare directory URL, which is what anyone actually types or shares,
    // and a different test: a host that answers it with a `status = 200`
    // rewrite leaves the browser on a URL with no trailing slash, so every
    // `./…` reference resolves one directory too high — a blank page with no
    // error. That is exactly how a broken share link got sent out.
    if (mount) await visit(`http://127.0.0.1:${PORT}${mount}`, `the bare ${where}`);
  }

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
