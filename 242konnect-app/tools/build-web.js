#!/usr/bin/env node
/**
 * Builds the web export, then makes it **path-independent**.
 *
 * This step is not cosmetic, and skipping it produces a blank page rather than
 * a visible error. `expo export` writes absolute URLs — `/_expo/static/js/…`,
 * `/assets/…`, `/favicon.ico` — which resolve against the *origin*, not against
 * the folder the app is served from. That is fine at a site root and broken
 * everywhere else:
 *
 *   https://host/242konnect-web/index.html  → asks for https://host/_expo/…  ✗
 *   https://rawcdn.githack.com/o/r/sha/242konnect-web/index.html
 *                                           → asks for githack.com/_expo/…   ✗
 *
 * Both are exactly how this build is shared. Rewriting the references to `./…`
 * makes them resolve against the document's own directory, which is correct at
 * a root, at a sub-path, and inside the standalone zip alike.
 *
 * It was done by hand once and lost the next time the app was rebuilt, which
 * shipped two broken preview links. Hence a script, and hence `verify-paths`
 * asserting no absolute reference survives.
 *
 * Usage:  npm run build:web -- --output-dir ../242konnect-web
 *         (any further arguments are passed through to `expo export`)
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const outIndex = args.indexOf("--output-dir");
const outDir = path.resolve(outIndex === -1 ? "dist" : args[outIndex + 1]);

console.log(`Exporting to ${outDir} …`);
execFileSync(
  "npx",
  ["expo", "export", "--platform", "web", "--clear", ...args],
  { stdio: "inherit" }
);

/** Absolute references Expo emits, and what each becomes. */
const REWRITES = [
  // index.html: the bundle and the favicon.
  [/(src|href)="\/(_expo\/|favicon)/g, '$1="./$2'],
];

const indexPath = path.join(outDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
for (const [find, replace] of REWRITES) html = html.replace(find, replace);
fs.writeFileSync(indexPath, html);

// The bundle carries its own absolute asset URLs — fonts and images resolved
// through Expo's asset registry. Relative URLs inside JS resolve against the
// *document*, not the script, so `./assets/…` is right at every depth.
const bundles = fs
  .readdirSync(path.join(outDir, "_expo/static/js/web"))
  .filter((f) => f.endsWith(".js"));

let assetRefs = 0;
for (const file of bundles) {
  const p = path.join(outDir, "_expo/static/js/web", file);
  const js = fs.readFileSync(p, "utf8");
  const next = js.replace(/"\/assets\//g, '"./assets/');
  assetRefs += (js.match(/"\/assets\//g) || []).length;
  if (next !== js) fs.writeFileSync(p, next);
}

console.log(`Rewrote ${bundles.length} bundle(s), ${assetRefs} asset reference(s).`);

// Fail loudly rather than shipping a build that only works at a root.
const leftover = fs.readFileSync(indexPath, "utf8").match(/(src|href)="\/[^"]*"/g);
if (leftover) {
  console.error("Absolute references survived in index.html:", leftover);
  process.exit(1);
}
console.log("Build is path-independent.");
