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

  for (const mount of MOUNTS) {
    const where = mount || "(site root)";
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const page = await ctx.newPage();
    const bad = [];
    page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
    page.on("requestfailed", (r) => bad.push(`FAILED ${r.url()}`));

    await check(`the app paints at ${where}`, async () => {
      await page.goto(`http://127.0.0.1:${PORT}${mount}/index.html`, { waitUntil: "networkidle" });
      // Wait past the splash, then assert real copy — a blank page is the
      // symptom this whole suite exists to catch.
      await page.waitForSelector("text=Chaque problème est un besoin", { timeout: 25000 });
      return true;
    });

    await check(`no failed request at ${where}`, async () => {
      await page.waitForTimeout(1500);
      if (bad.length) throw new Error(bad.slice(0, 3).join(" | "));
      return true;
    });

    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log("   ✗ " + f));
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
