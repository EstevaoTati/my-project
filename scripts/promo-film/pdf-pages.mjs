// Render pages of the demo dossier PDF to shots/pdf-N.png (the film fans them out).
//   node pdf-pages.mjs demo-dossier.pdf 1,2,4
import { chromium } from "../bi-harness/node_modules/playwright-core/index.mjs";
import { readFileSync } from "node:fs";
const file = process.argv[2], pages = process.argv[3].split(",").map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
const nm = new URL("../bi-harness/node_modules/pdfjs-dist/legacy/build/", import.meta.url);
await page.route("http://x/**", (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === "/doc.pdf") return r.fulfill({ body: readFileSync(file), contentType: "application/pdf" });
  if (u.pathname === "/") return r.fulfill({ body: "<html><body style='margin:0;background:#888'><canvas id=c></canvas></body></html>", contentType: "text/html" });
  return r.fulfill({ body: readFileSync(new URL("." + u.pathname, nm)), contentType: "text/javascript" });
});
await page.goto("http://x/");
for (const n of pages) {
  await page.evaluate(async (n) => {
    const pdfjs = await import("http://x/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "http://x/pdf.worker.mjs";
    const doc = await pdfjs.getDocument("http://x/doc.pdf").promise;
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1.45 });
    const c = document.getElementById("c"); c.width = vp.width; c.height = vp.height;
    await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  }, n);
  await page.locator("#c").screenshot({ path: new URL(`shots/pdf-${n}.png`, import.meta.url).pathname });
  console.log("wrote shots/pdf-" + n + ".png");
}
await browser.close();
