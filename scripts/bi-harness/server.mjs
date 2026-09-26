// Serves the repo like Netlify, and runs the REAL functions in netlify/functions
// (with the SDK and Blobs faked by loader.mjs). `-background` functions answer
// 202 at once and keep running, as on the platform.
import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = process.env.ROOT || new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const PORT = Number(process.env.PORT || 4700);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };
const stats = { requests: {} };
globalThis.__harnessStats = stats;

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);
  const fn = url.pathname.match(/^\/\.netlify\/functions\/([\w-]+)$/);
  if (fn) {
    const name = fn[1];
    stats.requests[name] = (stats.requests[name] || 0) + 1;
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const request = new Request(url.href, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
    if (name === "__stats") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ...stats, blobs: [...(globalThis.__blobStores?.get("bi-jobs")?.keys() || [])] })); }
    let mod;
    try { mod = await import(join(ROOT, "netlify/functions", name + ".mjs") + "?v=" + (process.env.NOCACHE ? Date.now() : 1)); }
    catch (e) { res.writeHead(404); return res.end(String(e.message)); }
    if (name.endsWith("-background")) {
      res.writeHead(202); res.end();
      Promise.resolve(mod.default(request)).catch((e) => console.error("background crashed", e));
      return;
    }
    try {
      const out = await mod.default(request);
      const h = {}; out.headers.forEach((v, k) => { h[k] = v; });
      res.writeHead(out.status, h);
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) { console.error(name, "crashed", e); res.writeHead(500); res.end("crash: " + e.message); }
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === "/") p = "/index.html";
  if (p === "/bi") p = "/bi.html";
  if (p === "/os") p = "/os.html";
  const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
  try {
    const st = await stat(file);
    if (!st.isFile()) throw 0;
    const type = TYPES[extname(file)] || "application/octet-stream";
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1 });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "content-type": type, "content-length": st.size });
    createReadStream(file).pipe(res);
  } catch {
    if (p.startsWith("/assets/")) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[".html"] });
    res.end(await readFile(join(ROOT, "index.html")));
  }
}).listen(PORT, () => console.log("harness on " + PORT));
