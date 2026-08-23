#!/usr/bin/env node
// MWINDA DIGITAL — reference data ingestion.
//
// Pulls the machine-readable sources once, for every country the MVP offers,
// and writes them where the engine can read them. Run it on a schedule, not
// per generation — see supabase/migrations/0003_reference_data.sql for why.
//
//   node scripts/fetch-reference-data.mjs                   # fetch, write snapshot
//   node scripts/fetch-reference-data.mjs --push            # …and upsert to Supabase
//   node scripts/fetch-reference-data.mjs --bready file.csv # add B-READY scores
//   node scripts/fetch-reference-data.mjs --only COD,KEN    # a subset
//   node scripts/fetch-reference-data.mjs --check           # no network: report state
//
// Environment:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY   required only for --push
//   HDR_API_KEY                          optional; without it, HDR is skipped
//
// Design notes worth keeping:
//   * One request per indicator for ALL countries (the World Bank API takes a
//     semicolon-separated country list). 17 requests, not 986.
//   * A partial failure is recorded, never silently merged. A country whose
//     refresh failed keeps its previous values and is flagged in the summary.
//   * The snapshot on disk is the source of truth for --push, so a fetch and a
//     push can be run separately, and a bad fetch can be inspected before it
//     ever reaches the database.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "..", "data", "reference");
const SNAPSHOT = resolve(DATA, "snapshot.json");

const read = (name) => JSON.parse(readFileSync(resolve(DATA, name), "utf8"));
const COUNTRIES = read("countries.json").countries;
const INDICATORS = read("indicators.json");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const only = valueOf("--only");
const targets = only
  ? COUNTRIES.filter((c) => only.split(",").map((s) => s.trim().toUpperCase()).includes(c.iso3))
  : COUNTRIES;

const log = (...m) => console.log(...m);
const warn = (...m) => console.warn(...m);

// ------------------------------------------------------------- World Bank --
// Documented, keyless, and stable.
//
// `mrnev=1` — most recent NON-EMPTY value per country — not `mrv=1`, which
// means "the most recent year" and returns null for every country that has
// not reported it yet. Running this against the live API, mrv=1 filled 5 of
// 58 countries for internet usage; mrnev=1 filled 58. per_page must also
// exceed the country count or sparse series come back mostly empty.
async function fetchWorldBank(indicator, isoList) {
  const url = `https://api.worldbank.org/v2/country/${isoList.join(";")}`
    + `/indicator/${indicator.code}?format=json&mrnev=1&per_page=${isoList.length * 4}`;

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();

  // The API answers [metadata, rows]; an error answers [{message:[…]}].
  if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[1])) {
    throw new Error("unexpected response shape");
  }

  const out = [];
  for (const row of body[1]) {
    const iso3 = row?.countryiso3code;
    if (!iso3 || row.value === null || row.value === undefined) continue;
    out.push({
      iso3,
      source: indicator.source,
      code: indicator.code,
      label: indicator.label,
      unit: indicator.unit,
      meaning: indicator.meaning,
      value: Number(row.value),
      year: Number(row.date) || null,
    });
  }
  return out;
}

// -------------------------------------------------------------------- HDR --
// Requires a free key. Skipped entirely without one rather than half-working.
async function fetchHdr(isoList) {
  const key = process.env.HDR_API_KEY;
  if (!key) {
    warn("· HDR skipped (set HDR_API_KEY to include human development data)");
    return [];
  }
  const byCode = new Map(INDICATORS.hdr.map((i) => [i.code, i]));
  const url = "https://hdrdata.org/api/CompositeIndices/query"
    + `?apikey=${encodeURIComponent(key)}&countryOrAggregation=${isoList.join(",")}`;

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("unexpected response shape");

  // Keep the latest year per (country, indicator).
  const latest = new Map();
  for (const row of rows) {
    const meta = byCode.get(row?.indicatorCode);
    const iso3 = row?.countryCode;
    const value = Number(row?.value);
    const year = Number(row?.year);
    if (!meta || !iso3 || !Number.isFinite(value)) continue;
    const k = `${iso3}:${meta.code}`;
    if (!latest.has(k) || year > latest.get(k).year) {
      latest.set(k, {
        iso3, source: "hdr", code: meta.code, label: meta.label,
        unit: meta.unit, meaning: meta.meaning, value, year: year || null,
      });
    }
  }
  return [...latest.values()];
}

// ---------------------------------------------------------------- B-READY --
// Published as bulk files, not an API. Export the country-score sheet to CSV
// and pass it in. Expected columns (case-insensitive): an ISO3 or economy
// column, an indicator/topic column, and a score column.
function readBready(path) {
  if (!existsSync(path)) throw new Error(`file not found: ${path}`);
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("no rows");

  const split = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)
    .map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim())
    .slice(0, -1);

  const header = split(lines[0]).map((h) => h.toLowerCase());
  const find = (...names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iIso = find("iso3", "iso_3", "country code", "economy code");
  const iName = find("economy", "country");
  const iTopic = find("indicator", "topic", "pillar", "series");
  const iScore = find("score", "value");

  if (iScore < 0 || (iIso < 0 && iName < 0)) {
    throw new Error("could not find the score and country columns — check the export");
  }

  const byName = new Map(COUNTRIES.map((c) => [c.label.toLowerCase(), c.iso3]));
  const known = new Set(COUNTRIES.map((c) => c.iso3));
  const out = [];

  for (const line of lines.slice(1)) {
    const cells = split(line);
    const iso3 = (iIso >= 0 ? cells[iIso] : "").toUpperCase()
      || byName.get((cells[iName] || "").toLowerCase()) || "";
    const value = Number(cells[iScore]);
    if (!known.has(iso3) || !Number.isFinite(value)) continue;

    const topic = (iTopic >= 0 ? cells[iTopic] : "Overall") || "Overall";
    out.push({
      iso3, source: "bready",
      code: "BREADY." + topic.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40),
      label: `B-READY — ${topic}`,
      unit: "score (0-100)",
      meaning: "World Bank Business Ready score. Higher means the regulatory framework and public services around this topic work better for a firm.",
      value,
      year: null,
    });
  }
  return out;
}

// ------------------------------------------------------------------- push --
async function push(rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required for --push");

  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/reference_indicators`;
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    // Upsert on the composite primary key: a refresh replaces values in place
    // rather than accumulating vintages the engine would then have to choose
    // between.
    prefer: "resolution=merge-duplicates,return=minimal",
  };

  // Chunked: one 986-row body is needlessly fragile over a flaky link.
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(slice) });
    if (!res.ok) throw new Error(`upsert failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    log(`  pushed ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
}

// ------------------------------------------------------------------- main --
async function main() {
  if (has("--check")) {
    if (!existsSync(SNAPSHOT)) return log("No snapshot yet. Run without --check to fetch one.");
    const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    const countries = new Set(snap.rows.map((r) => r.iso3));
    log(`Snapshot from ${snap.fetchedAt}`);
    log(`  ${snap.rows.length} values across ${countries.size}/${COUNTRIES.length} countries`);
    for (const s of ["wdi", "wgi", "hdr", "bready"]) {
      const n = snap.rows.filter((r) => r.source === s).length;
      log(`  ${s.padEnd(7)} ${n || "— not ingested"}`);
    }
    const missing = COUNTRIES.filter((c) => !countries.has(c.iso3)).map((c) => c.iso3);
    if (missing.length) log(`  no data: ${missing.join(", ")}`);
    return;
  }

  const isoList = targets.map((c) => c.iso3);
  log(`Fetching reference data for ${isoList.length} countries…`);

  const rows = [];
  const failures = [];

  for (const indicator of INDICATORS.worldbank) {
    try {
      const got = await fetchWorldBank(indicator, isoList);
      rows.push(...got);
      log(`· ${indicator.code.padEnd(18)} ${got.length}/${isoList.length}`);
    } catch (error) {
      failures.push(`${indicator.code}: ${error.message}`);
      warn(`· ${indicator.code.padEnd(18)} FAILED — ${error.message}`);
    }
  }

  try {
    const got = await fetchHdr(isoList);
    if (got.length) { rows.push(...got); log(`· HDR${" ".repeat(15)} ${got.length} values`); }
  } catch (error) {
    failures.push(`hdr: ${error.message}`);
    warn(`· HDR FAILED — ${error.message}`);
  }

  const breadyFile = valueOf("--bready");
  if (breadyFile) {
    try {
      const got = readBready(breadyFile);
      rows.push(...got);
      log(`· B-READY${" ".repeat(11)} ${got.length} values`);
    } catch (error) {
      failures.push(`bready: ${error.message}`);
      warn(`· B-READY FAILED — ${error.message}`);
    }
  } else {
    warn("· B-READY skipped (pass --bready <file.csv> from the data catalogue)");
  }

  if (!rows.length) {
    warn("\nNothing fetched. The snapshot was NOT overwritten — an empty file would");
    warn("silently strip every dossier of its grounding.");
    process.exitCode = 1;
    return;
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    countries: isoList.length,
    failures,
    rows,
  };
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");
  log(`\nWrote ${rows.length} values to data/reference/snapshot.json`);
  if (failures.length) warn(`${failures.length} source(s) failed — previous values for those series stay in the database.`);

  if (has("--push")) {
    log("\nUpserting to Supabase…");
    await push(rows);
    log("Done.");
  } else {
    log("Not pushed. Re-run with --push to load it into Supabase.");
  }
}

main().catch((error) => {
  console.error("\nfetch-reference-data failed:", error.message);
  process.exitCode = 1;
});
