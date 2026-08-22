// MWINDA DIGITAL — private founder console.
//
// Serves everything that is NOT public on the OS page: the kernel/agents/
// routines/memory layers (docs/os-console.html) and the Monday briefs
// (docs/briefs/*.md). Both are bundled into this function via included_files
// in netlify.toml and are never published as static files — /docs/* returns
// 404 on the site. The only way to read them is with FOUNDER_KEY.
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

// Resolve a bundled path across local dev and the deployed Lambda layout.
async function resolve(relative, isDir) {
  const candidates = [
    join(process.cwd(), relative),
    process.env.LAMBDA_TASK_ROOT && join(process.env.LAMBDA_TASK_ROOT, relative),
    new URL(`../../${relative}`, import.meta.url).pathname,
  ].filter(Boolean);
  for (const path of candidates) {
    try {
      if (isDir) await readdir(path);
      else await readFile(path, "utf8");
      return path;
    } catch { /* try next */ }
  }
  return null;
}

export default async (req) => {
  const ip = clientIp(req);

  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  if (originRejected(req)) {
    audit("console.origin_rejected", { ip });
    return json(403, { error: "forbidden" });
  }

  const wait = RATE.check(ip);
  if (wait) {
    audit("console.rate_limited", { ip });
    return json(429, { error: "too many requests" }, { "retry-after": String(wait) });
  }

  const lock = authLockedOut(ip);
  if (lock) {
    audit("console.auth_locked_out", { ip });
    return json(429, { error: "too many attempts — try again later" }, { "retry-after": String(lock) });
  }

  const parsed = await readJson(req, MAX_BODY_BYTES);
  if (parsed.tooLarge) return json(413, { error: "request too large" });
  if (parsed.invalid) return json(400, { error: "invalid JSON body" });

  if (!founderKeyUsable()) {
    audit("console.not_configured", { ip });
    return json(503, { error: "founder console is not configured" });
  }
  if (!secretMatches(parsed.value?.key, process.env.FOUNDER_KEY)) {
    recordAuthFailure(ip);
    audit("console.auth_failed", { ip });
    return json(403, { error: "invalid key" });
  }
  recordAuthSuccess(ip);

  // --- private page fragment ---
  const fragmentPath = await resolve("docs/os-console.html", false);
  const html = fragmentPath ? await readFile(fragmentPath, "utf8") : "";

  // --- Monday briefs ---
  // Filenames come from readdir and are pattern-checked; no path is ever
  // taken from the request.
  const briefs = [];
  const briefsDir = await resolve("docs/briefs", true);
  if (briefsDir) {
    const files = (await readdir(briefsDir))
      .filter((f) => /^\d{4}-\d{2}-\d{2}[\w.-]*\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, MAX_BRIEFS);
    for (const file of files) {
      const content = await readFile(join(briefsDir, file), "utf8");
      briefs.push({
        file,
        date: file.slice(0, 10),
        title: (content.match(/^#\s+(.+)$/m) || [, file])[1],
        content,
      });
    }
  }

  audit("console.served", { ip, briefs: briefs.length, fragment: html.length });
  return json(200, { html, briefs });
};
