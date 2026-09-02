/**
 * Which strings on screen have no English?
 *
 * The French text is the translation key, which keeps the source readable but
 * has one failure mode: edit a French sentence and its English quietly falls
 * back to the new French. Nothing breaks, nothing warns, and the screen is
 * half-translated. This is what catches that.
 *
 * It also catches the subtler version — a dictionary line whose key differs
 * from the source by a straight apostrophe against a typographic one, which is
 * invisible in review and fails at runtime.
 *
 *   node tools/i18n-check.js          list untranslated strings
 *   node tools/i18n-check.js --strict exit non-zero if any are missing
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "src");
const EN = path.join(SRC, "locales", "en.ts");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "locales" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) && e.name !== "i18n.tsx" ? [p] : [];
  });
}

/** Every t('…') / t("…") key used in the app. */
const used = new Map();
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, "utf8");
  // `t(...)` translates now; `T(...)` marks a module-level string that is
  // translated later at the point of use. Both are strings on screen.
  const re = /\b[tT]\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const key = m[2].replace(/\\(['"])/g, "$1");
    if (!used.has(key)) used.set(key, path.relative(SRC, file));
  }
}

// The dictionary's own keys, read as text rather than imported: this runs
// without a TypeScript toolchain, and the file is a plain object literal.
const dict = fs
  .readFileSync(EN, "utf8")
  // Drop the declaration line, or `export const en` is read as a key.
  .replace(/^export const en[^{]*\{/m, "{");
const translated = new Set();
const keyRe = /^\s*(?:(['"])((?:\\.|(?!\1)[^\\])*)\1|([A-Za-zÀ-ÿ][\w À-ÿ]*?))\s*:/gm;
let k;
while ((k = keyRe.exec(dict))) {
  translated.add((k[2] ?? k[3]).replace(/\\(['"])/g, "$1"));
}

/**
 * Strings that reach t() through a variable rather than a literal.
 *
 * The service catalogue is data — `t(trade.label)` — so a scan for t('…') can
 * never see it, and every catalogue line would look stale.
 *
 * This asks the simpler question: does the data contain this exact quoted
 * string? An earlier version tried to tokenise the data's literals instead and
 * quietly desynchronised, because a double-quoted French sentence containing an
 * apostrophe looks like the start of a single-quoted string to a regex with no
 * notion of context.
 */
const dataText = walk(path.join(SRC, "data"))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const inData = (key) => dataText.includes(`'${key}'`) || dataText.includes(`"${key}"`);

const missing = [...used.entries()].filter(([key]) => !translated.has(key));
const orphans = [...translated].filter((key) => !used.has(key) && !inData(key));

if (missing.length) {
  console.log(`\n${missing.length} string(s) with no English:\n`);
  for (const [key, file] of missing) console.log(`  ${file}\n    ${JSON.stringify(key)}`);
}
if (orphans.length) {
  console.log(`\n${orphans.length} dictionary line(s) matching nothing in the code:`);
  console.log("(usually a changed apostrophe or a reworded sentence)\n");
  for (const key of orphans) console.log(`  ${JSON.stringify(key)}`);
}
if (!missing.length && !orphans.length) {
  console.log(`\n✓ all ${used.size} strings have English, and no dictionary line is stale`);
}

process.exit(process.argv.includes("--strict") && (missing.length || orphans.length) ? 1 : 0);
