// MWINDA DIGITAL — founder briefs endpoint.
// Returns the Monday briefs (docs/briefs/*.md, bundled via included_files
// in netlify.toml) only when the request carries the FOUNDER_KEY.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function keyMatches(candidate) {
  const expected = process.env.FOUNDER_KEY;
  if (!expected || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function findBriefsDir() {
  const candidates = [
    join(process.cwd(), "docs/briefs"),
    process.env.LAMBDA_TASK_ROOT && join(process.env.LAMBDA_TASK_ROOT, "docs/briefs"),
    new URL("../../docs/briefs", import.meta.url).pathname,
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      await readdir(dir);
      return dir;
    } catch { /* try next */ }
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON body" });
  }
  if (!process.env.FOUNDER_KEY) return json(503, { error: "briefs are not configured" });
  if (!keyMatches(body?.key)) return json(403, { error: "invalid key" });

  const dir = await findBriefsDir();
  if (!dir) return json(200, { briefs: [] });

  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse()
    .slice(0, 12); // newest first, cap the payload

  const briefs = [];
  for (const file of files) {
    const content = await readFile(join(dir, file), "utf8");
    briefs.push({
      file,
      date: (file.match(/^\d{4}-\d{2}-\d{2}/) || [file.replace(".md", "")])[0],
      title: (content.match(/^#\s+(.+)$/m) || [, file])[1],
      content,
    });
  }
  return json(200, { briefs });
};
