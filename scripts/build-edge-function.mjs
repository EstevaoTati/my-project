#!/usr/bin/env node
// Regenerates supabase/functions/refresh-reference/index.ts from the registry
// files, so the scheduled refresh and the local script can never disagree about
// which countries and series are pulled.
//
//   node scripts/build-edge-function.mjs
//
// Deploy the result with the Supabase CLI or MCP. It requires the service_role
// key as a bearer token — the anon key is public, and this endpoint writes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "..", "data", "reference");
const OUT_DIR = resolve(HERE, "..", "supabase", "functions", "refresh-reference");

const countries = JSON.parse(readFileSync(resolve(DATA, "countries.json"), "utf8")).countries.map((c) => c.iso3);
const indicators = JSON.parse(readFileSync(resolve(DATA, "indicators.json"), "utf8")).worldbank
  .map(({ code, source, label, unit, meaning }) => ({ code, source, label, unit, meaning }));

const template = readFileSync(resolve(HERE, "refresh-reference.template.ts"), "utf8")
  .replace("__COUNTRIES__", JSON.stringify(countries))
  .replace("__INDICATORS__", JSON.stringify(indicators, null, 2));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "index.ts"), template);
console.log(`Wrote supabase/functions/refresh-reference/index.ts — ${countries.length} countries, ${indicators.length} indicators`);
