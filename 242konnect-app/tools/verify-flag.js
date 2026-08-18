/**
 * Checks the rendered brand mark really is the Congolese flag: the two
 * boundaries diagonal (not horizontal), crossing the edges where the reference
 * image crosses them, in the sampled colours.
 *
 * Rendering it large and screenshotting is the only honest way to test this —
 * reading the SVG source back would just re-assert what I typed.
 */
const { chromium } = require("playwright");
const fs = require("fs"); const http = require("http"); const path = require("path");
const ROOT = process.env.APP_DIST || require("path").resolve(__dirname, "..", "dist");
const TYPES = {".html":"text/html",".js":"text/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".ttf":"font/ttf",".ico":"image/x-icon",".svg":"image/svg+xml"};
const server = http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split("?")[0]);const f=path.join(ROOT,p==="/"?"/index.html":p);
 if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(200,{"Content-Type":"text/html"});fs.createReadStream(path.join(ROOT,"index.html")).pipe(res);return;}
 res.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});

const SHOT = (process.env.SHOT_DIR || require("os").tmpdir()) + "/242konnect-flag.png";
const REF = { green: [0x00,0x97,0x39], yellow: [0xff,0xd1,0x00], red: [0xdc,0x24,0x1f] };
let pass = 0; const fails = [];
const check = (label, ok, detail = "") => { if (ok) { console.log("  ✓ " + label + (detail && "  " + detail)); pass++; }
  else { console.log("  ✗ " + label + (detail && "  " + detail)); fails.push(label); } };

(async () => {
  await new Promise(r => server.listen(8975, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })).newPage();
  await p.goto("http://localhost:8975/", { waitUntil: "networkidle" });
  await p.waitForSelector("text=Chaque problème est un besoin", { timeout: 30000 });
  await p.waitForTimeout(1000);

  // Isolate the mark on a blank page before measuring. Overlaying it left the
  // screen's own white text painting across the flag, which corrupted the
  // scanlines — the first run failed on that, not on the geometry.
  const markup = await p.evaluate(() => {
    const svg = document.querySelector("svg[viewBox='0 0 3 2']");
    if (!svg) return null;
    return svg.outerHTML;
  });
  if (!markup) throw new Error("brand mark not found on the welcome screen");

  await p.setContent(
    `<body style="margin:0;background:#fff">` +
      `<div id="flag" style="width:600px;height:400px">${markup}</div>` +
    `</body>`
  );
  await p.evaluate(() => {
    const svg = document.querySelector("#flag svg");
    svg.setAttribute("width", "600");
    svg.setAttribute("height", "400");
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: SHOT, clip: { x: 0, y: 0, width: 600, height: 400 } });

  const { PNG } = require("pngjs");
  const png = PNG.sync.read(fs.readFileSync(SHOT));
  const W = png.width, H = png.height;
  const at = (x, y) => { const i = (W * Math.round(y) + Math.round(x)) << 2; return [png.data[i], png.data[i+1], png.data[i+2]]; };
  const dist2 = (c, r) => (c[0]-r[0])**2 + (c[1]-r[1])**2 + (c[2]-r[2])**2;
  const field = (x, y) => {
    const c = at(x, y);
    return Object.keys(REF).reduce((best, k) => (dist2(c, REF[k]) < dist2(c, REF[best]) ? k : best));
  };
  // Exact-match helper, for asserting the colours themselves rather than the layout.
  const exact = (x, y, k) => dist2(at(x, y), REF[k]) < 300;

  check("green fills the upper hoist, in #009739", exact(W*0.12, H*0.15, "green"));
  check("yellow fills the band, in #ffd100", exact(W*0.50, H*0.50, "yellow"));
  check("red fills the lower fly, in #dc241f", exact(W*0.85, H*0.85, "red"));

  // The reference crossings: top edge green→yellow at 2/3, bottom edge
  // yellow→red at 1/3. Horizontal stripes would put none of these here.
  const cross = (scan, n) => { const out = []; let prev = field(...scan(0));
    for (let i = 1; i < n; i++) { const cur = field(...scan(i));
      if (cur !== prev) { out.push([prev, cur, i / n]); prev = cur; } } return out; };

  const top = cross((i) => [i, H * 0.02], W);
  const bottom = cross((i) => [i, H * 0.98], W);
  const gy = top.find((c) => c[0] === "green" && c[1] === "yellow");
  const yr = bottom.find((c) => c[0] === "yellow" && c[1] === "red");

  check("green→yellow crosses the top edge at 2/3", gy && Math.abs(gy[2] - 2/3) < 0.03,
    gy ? `(measured ${gy[2].toFixed(3)})` : "(not found)");
  check("yellow→red crosses the bottom edge at 1/3", yr && Math.abs(yr[2] - 1/3) < 0.03,
    yr ? `(measured ${yr[2].toFixed(3)})` : "(not found)");

  // A diagonal boundary moves across the width as you scan down; a horizontal
  // one does not. This is the check that would have caught the stripes.
  const rowCross = (yFrac) => { const c = cross((i) => [i, H * yFrac], W).find((x) => x[0] === "green"); return c ? c[2] : null; };
  const hi = rowCross(0.20), lo = rowCross(0.80);
  check("the boundary is diagonal, not horizontal", hi !== null && lo !== null && hi - lo > 0.3,
    hi !== null && lo !== null ? `(green ends at ${hi.toFixed(2)} up top, ${lo.toFixed(2)} down low)` : "");

  check("yellow reaches the bottom-left corner", field(W*0.02, H*0.97) === "yellow");
  check("yellow reaches the top-right corner", field(W*0.95, H*0.02) === "yellow");

  console.log(`\n${pass} passed, ${fails.length} failed`);
  await b.close(); server.close();
  process.exit(fails.length ? 1 : 0);
})();
