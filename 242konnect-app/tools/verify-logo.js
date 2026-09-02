/**
 * Is the drawn mark actually the official logo?
 *
 * The mark is redrawn as SVG geometry rather than shipped as the 2.2 MB brand
 * PNG, so the thing worth checking is whether the redraw still matches the
 * original. Reading the component source back would only re-assert what was
 * typed; this renders it and scans the pixels, then compares against
 * measurements taken from the brand file itself.
 *
 * Requires `pngjs`. Running `npm install` in a directory whose package.json
 * omits a package prunes it — that is how playwright vanished mid-session once.
 *
 *   REFERENCE=/path/to/brand.png node tools/verify-logo.js
 */
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

const DIST = process.env.APP_DIST || path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8977);

/* Measured off the brand file. The redraw has to agree with these. */
const EXPECT = {
  green: [0x02, 0x9b, 0x4f],
  yellow: [0xfb, 0xd2, 0x18],
  red: [0xe4, 0x18, 0x1f],
  ratio: 787 / 288,
  /** Band thickness as a fraction of the mark's height. */
  bandFraction: 73 / 288,
  /** Where the overlap sits horizontally, as fractions of the width. */
  overlapStart: 317 / 787,
  overlapEnd: 470 / 787,
};

let pass = 0;
const fails = [];
const check = (ok, label) => {
  if (ok) {
    console.log("  ✓ " + label);
    pass++;
  } else {
    console.log("  ✗ " + label);
    fails.push(label);
  }
};

const near = (a, b, tol = 26) => Math.abs(a - b) <= tol;
const isColour = (px, rgb, tol = 40) =>
  near(px[0], rgb[0], tol) && near(px[1], rgb[1], tol) && near(px[2], rgb[2], tol);

/** Nearest of the three brand colours, or null on background/antialiasing. */
function classify(px) {
  if (px[3] < 128) return null;
  let best = null;
  let bestD = Infinity;
  for (const [name, rgb] of Object.entries({
    green: EXPECT.green,
    yellow: EXPECT.yellow,
    red: EXPECT.red,
  })) {
    const d =
      (px[0] - rgb[0]) ** 2 + (px[1] - rgb[1]) ** 2 + (px[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  // Far from all three: background, or the antialiased edge against it.
  return bestD < 90 * 90 ? best : null;
}

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = require("http").createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(DIST, p === "/" ? "/index.html" : p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(path.join(DIST, "index.html")).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  // Measure the splash mark, which is the largest the app draws it, and at 3x
  // so a 73/288 band is tens of pixels rather than six. The welcome screen's
  // 64 px lockup is far too small: every boundary there falls inside one
  // antialiased pixel and the band fraction is unmeasurable.
  //
  // Timing matters. The splash runs about 2.6 s and then hands off, so a longer
  // wait silently measures the small mark instead.
  const page = await (
    await browser.newContext({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 3 })
  ).newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);

  // Screenshot the mark as the app actually paints it.
  //
  // An earlier version pulled the SVG out and re-injected it on a blank page.
  // That looked tidier but re-laid the element out, so the viewBox scaled to a
  // different box and the measured band thickness drifted with x — a harness
  // artefact that reads exactly like a geometry bug in the component.
  const box = await page.locator("svg").first().boundingBox();
  if (!box) {
    console.log("  \u2717 the mark is not laid out");
    process.exit(1);
  }

  const shot = await page.locator("svg").first().screenshot();
  const png = PNG.sync.read(shot);
  const { width: W, height: H, data } = png;
  const at = (x, y) => {
    const i = (W * y + x) << 2;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  console.log(`\n  rendered ${W}×${H}`);

  check(near(W / H, EXPECT.ratio, 0.08), `ratio is ${EXPECT.ratio.toFixed(2)}:1 (got ${(W / H).toFixed(2)})`);

  // Sample the three colours where each must be the only one present.
  const midY = Math.round(H / 2);
  const leftCap = at(Math.round(W * 0.02), midY);
  const rightCap = at(Math.round(W * 0.98), midY);
  check(isColour(leftCap, EXPECT.green), `left link is green #029b4f`);
  check(isColour(rightCap, EXPECT.red), `right link is red #e4181f`);

  // Yellow must exist, and only inside the overlap.
  const yellowXs = [];
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (classify(at(x, y)) === "yellow") { yellowXs.push(x); break; }
    }
  }
  check(yellowXs.length > 0, "the crossing is yellow #fbd218");
  if (yellowXs.length) {
    const lo = Math.min(...yellowXs) / W;
    const hi = Math.max(...yellowXs) / W;
    check(
      lo > EXPECT.overlapStart - 0.06 && hi < EXPECT.overlapEnd + 0.06,
      `yellow sits in the overlap (${(lo * 100).toFixed(0)}%–${(hi * 100).toFixed(0)}%, expected ${(EXPECT.overlapStart * 100).toFixed(0)}%–${(EXPECT.overlapEnd * 100).toFixed(0)}%)`
    );
  }

  // The links must be rings, not solid pills: a column through a link's middle
  // has band, hole, band. A solid shape would read as one run and still look
  // plausible at 34 px.
  const colAt = (frac) => {
    const x = Math.round(W * frac);
    const runs = [];
    let cur = null, start = 0;
    for (let y = 0; y < H; y++) {
      const c = classify(at(x, y)) ? "on" : "off";
      if (c !== cur) { if (cur) runs.push([cur, start, y - start]); cur = c; start = y; }
    }
    if (cur) runs.push([cur, start, H - start]);
    return runs.filter(([s]) => s === "on");
  };
  const leftRuns = colAt(0.25);
  if (process.env.DEBUG_LOGO) {
    for (const f of [0.1, 0.2, 0.25, 0.3, 0.4]) {
      console.log(`    debug x=${(f * 100).toFixed(0)}%:`, JSON.stringify(colAt(f)));
    }
  }
  const rightRuns = colAt(0.85);
  check(leftRuns.length === 2, `left link is a ring, not a solid pill (${leftRuns.length} bands)`);
  check(rightRuns.length === 2, `right link is a ring, not a solid pill (${rightRuns.length} bands)`);

  if (leftRuns.length === 2) {
    const band = leftRuns[0][2] / H;
    check(near(band, EXPECT.bandFraction, 0.035), `band is ${(EXPECT.bandFraction * 100).toFixed(0)}% of height (got ${(band * 100).toFixed(0)}%)`);
  }

  // All three colours present in the expected left-to-right order.
  const order = [];
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const c = classify(at(x, y));
      if (c && order[order.length - 1] !== c) { order.push(c); break; }
    }
  }
  const compact = order.filter((c, i) => c !== order[i - 1]);
  check(compact[0] === "green", "reads green first");
  check(compact.includes("yellow"), "then yellow");
  check(compact[compact.length - 1] === "red", "then red");

  console.log(`\n${pass} passed, ${fails.length} failed`);
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
