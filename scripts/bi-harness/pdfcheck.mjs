import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
const data = new Uint8Array(readFileSync(process.argv[2] || "dossier.pdf"));
const doc = await getDocument({ data, verbosity: 0 }).promise;
let text = "";
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i);
  const c = await p.getTextContent();
  text += c.items.map((x) => x.str).join(" ") + "\n";
}
console.log("pages:", doc.numPages, "bytes:", data.length, "chars:", text.length, "question marks:", (text.match(/\?/g) || []).length);
for (const w of (process.argv[3] || "").split("|").filter(Boolean)) console.log((text.includes(w) ? "  has " : "  MISSING ") + w);
if (process.env.DUMP) console.log(text.slice(0, Number(process.env.DUMP)));
