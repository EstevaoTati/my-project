/**
 * Serves 242konnect-web under the *exact* CSP Netlify will send it, to check the
 * Expo build survives that policy.
 *
 * Netlify applies the most specific matching header block, so the app now gets
 * the /242konnect-web/* policy rather than the landing page's /*. Both are read
 * out of netlify.toml rather than retyped — a copy would drift, and a policy
 * that silently blocks something the bundle needs breaks the deployed path
 * without failing anything here.
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
  .filter((b) => b.c);
// Most specific wins, exactly as Netlify resolves it.
const APP_BLOCK = CSP.find((b) => b.p === "/242konnect-web/*") || CSP.find((b) => b.p === "/*");
const POLICY = APP_BLOCK.c;
console.log(`applying the ${APP_BLOCK.p} policy:\n  ` + POLICY + "\n");
const TYPES = {".html":"text/html",".js":"text/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".ttf":"font/ttf",".ico":"image/x-icon",".svg":"image/svg+xml"};
http.createServer((req,res)=>{
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream",
                       "Content-Security-Policy": POLICY });
  fs.createReadStream(f).pipe(res);
}).listen(Number(process.env.PORT || 8971), () => console.log("serving under the strict CSP on " + (process.env.PORT || 8971)));
