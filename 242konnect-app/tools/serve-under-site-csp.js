/**
 * Serves 242konnect-web with the *exact* CSP the landing page sets for /*, to
 * check the Expo build survives it. The merge added a scoped exception for the
 * static prototype at /242konnect/* but none for /242konnect-web/, so if the
 * bundle needs anything the strict policy blocks, the deployed path is broken.
 */
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = process.env.WEB_DIR || require("path").resolve(__dirname, "..", "..", "242konnect-web");
const toml = fs.readFileSync(
  process.env.NETLIFY_TOML || require("path").resolve(__dirname, "..", "..", "netlify.toml"),
  "utf8"
);
// Read the real policy rather than retyping it — a copy would drift.
const CSP = toml.split(/\[\[headers\]\]/).slice(1)
  .map((b) => ({ p: (b.match(/for\s*=\s*"([^"]+)"/) || [])[1],
                 c: (b.match(/Content-Security-Policy\s*=\s*"([^"]+)"/) || [])[1] }))
  .find((b) => b.p === "/*").c;
console.log("applying the site's /* policy:\n  " + CSP + "\n");
const TYPES = {".html":"text/html",".js":"text/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".ttf":"font/ttf",".ico":"image/x-icon",".svg":"image/svg+xml"};
http.createServer((req,res)=>{
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream",
                       "Content-Security-Policy": CSP });
  fs.createReadStream(f).pipe(res);
}).listen(Number(process.env.PORT || 8971), () => console.log("serving under the strict CSP on " + (process.env.PORT || 8971)));
