// MWINDA DIGITAL — founder briefs endpoint.
// Serves the Monday briefs (docs/briefs/*.md, bundled via included_files in
// netlify.toml) only to a caller holding FOUNDER_KEY. These briefs are the
// company's internal strategy: treat this endpoint as a privileged surface.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  json, secretMatches, founderKeyUsable, clientIp, SlidingWindow,
  authLockedOut, recordAuthFailure, recordAuthSuccess,
  originRejected, readJson, audit,
} from "./_security.mjs";

const RATE = new SlidingWindow({ windowMs: 60_000, max: 20 });
const MAX_BODY_BYTES = 4 * 1024;
const MAX_BRIEFS = 12;

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
  const ip = clientIp(req);

  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  if (originRejected(req)) {
    audit("brief.origin_rejected", { ip });
    return json(403, { error: "forbidden" });
  }

  const wait = RATE.check(ip);
  if (wait) {
    audit("brief.rate_limited", { ip });
    return json(429, { error: "too many requests" }, { "retry-after": String(wait) });
  }

  const lock = authLockedOut(ip);
  if (lock) {
    audit("brief.auth_locked_out", { ip });
    return json(429, { error: "too many attempts — try again later" }, { "retry-after": String(lock) });
  }

  const parsed = await readJson(req, MAX_BODY_BYTES);
  if (parsed.tooLarge) return json(413, { error: "request too large" });
  if (parsed.invalid) return json(400, { error: "invalid JSON body" });

  if (!founderKeyUsable()) {
    audit("brief.not_configured", { ip });
    return json(503, { error: "briefs are not configured" });
  }
  if (!secretMatches(parsed.value?.key, process.env.FOUNDER_KEY)) {
    recordAuthFailure(ip);
    audit("brief.auth_failed", { ip });
    return json(403, { error: "invalid key" });
  }
  recordAuthSuccess(ip);

  const dir = await findBriefsDir();
  if (!dir) return json(200, { briefs: [] });

  // Only date-prefixed markdown from the bundled directory is ever read, and
  // names are never taken from the request — no path is attacker-influenced.
  const files = (await readdir(dir))
    .filter((f) => /^\d{4}-\d{2}-\d{2}[\w.-]*\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, MAX_BRIEFS);

  const briefs = [];
  for (const file of files) {
    const content = await readFile(join(dir, file), "utf8");
    briefs.push({
      file,
      date: file.slice(0, 10),
      title: (content.match(/^#\s+(.+)$/m) || [, file])[1],
      content,
    });
  }
  audit("brief.served", { ip, count: briefs.length });
  return json(200, { briefs });
};
