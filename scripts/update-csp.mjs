#!/usr/bin/env node
// Regenerates the Content-Security-Policy in netlify.toml and _headers.
//
// Why this script exists: the site ships inline <script> blocks (os.html,
// demo.html, preview.html are deliberately self-contained). Allowing them with
// 'unsafe-inline' would defeat the point of a CSP, so we allow them by
// SHA-256 hash instead. Hashes change whenever the script text changes, so
// this must be re-run after editing any inline script — otherwise the browser
// silently blocks it.
//
//   node scripts/update-csp.mjs          # rewrite the policy
//   node scripts/update-csp.mjs --check  # fail if out of date (CI/pre-push)
//
// style-src keeps 'unsafe-inline' on purpose: the pages use style="..."
// attributes, which hashes cannot cover without 'unsafe-hashes'. CSS injection
// is a far lower-severity vector here and there is no untrusted CSS path.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

function scriptHashes() {
  const hashes = new Set();
  for (const file of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(join(ROOT, file), "utf8");
    for (const [, code] of html.matchAll(INLINE_SCRIPT)) {
      hashes.add(`'sha256-${createHash("sha256").update(code, "utf8").digest("base64")}'`);
    }
  }
  return [...hashes].sort();
}

// Two policies: the site frames its own preview in demo.html, so the default
// allows same-origin framing (which still blocks cross-origin clickjacking).
// The OS console holds the founder-key input and is never framed at all.
function buildPolicy(frameAncestors) {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes().join(" ")} https://cdnjs.cloudflare.com https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self' https://wa.me",
    `frame-ancestors ${frameAncestors}`,
    "frame-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ") + ";";
}

export const POLICIES = {
  default: buildPolicy("'self'"),
  strict: buildPolicy("'none'"),
};

const check = process.argv.includes("--check");
let stale = false;

// Lines carry a `# csp:default` / `# csp:strict` marker so this rewrite stays
// anchored even as the files grow.
function sync(path, pattern, render) {
  const before = readFileSync(path, "utf8");
  const after = before.replace(pattern, (_m, indent, kind) => render(indent, kind));
  if (after !== before) {
    stale = true;
    if (!check) writeFileSync(path, after);
  }
}

sync(
  join(ROOT, "netlify.toml"),
  /^( *)Content-Security-Policy = ".*" # csp:(default|strict)$/gm,
  (indent, kind) => `${indent}Content-Security-Policy = "${POLICIES[kind]}" # csp:${kind}`,
);

// _headers — kept in sync so `netlify deploy --dir=.` and Drop behave the same.
sync(
  join(ROOT, "_headers"),
  /^( *)Content-Security-Policy: .* # csp:(default|strict)$/gm,
  (indent, kind) => `${indent}Content-Security-Policy: ${POLICIES[kind]} # csp:${kind}`,
);

if (check && stale) {
  console.error("CSP is out of date — run: node scripts/update-csp.mjs");
  process.exit(1);
}
console.log(check ? "CSP up to date." : `CSP updated (${scriptHashes().length} inline script hashes).`);
