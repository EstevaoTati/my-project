// MWINDA DIGITAL — reference data layer for the AI Business Intelligence engine.
//
// The engine has two kinds of grounding, and conflating them would be the whole
// mistake:
//
//   FACTS  — numbers from sources with a documented API or bulk download
//            (World Bank WDI/WGI/B-READY, UNDP HDR). Ingested on a schedule
//            into `reference_indicators`, then injected into the prompt as
//            ground truth the model must use instead of guessing.
//
//   PORTALS — human-facing legal databases with no public API (UNCTAD, WIPO
//            Lex, NATLEX, UHRI, UN Treaty Collection). These are NEVER scraped
//            and NEVER paraphrased into the prompt as fact. They tell the model
//            which obligations are checkable and by what kind of body, so each
//            checklist item can name who settles it. A model that has not read
//            the law must not sound like it has — and the list of databases
//            itself is never shown to the reader.
//
// This registry is INTERNAL and stays that way. Which official databases the
// engine consults is methodology — the part of the product that took work to
// assemble — so it shapes the prompt and never crosses to the browser. Nothing
// here is sent to the client, rendered in a dossier, or stored on a project
// row. The audit log is the only place its use is recorded.
//
// Everything here degrades to nothing. No database, no key, no network: the
// engine emits exactly what it emitted before this module existed.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { select, configured } from "./_db.mjs";

// The registries are bundled through netlify.toml's included_files rather than
// imported as JSON modules: import attributes depend on the platform's bundler
// version, and console.mjs already proves this path works in both the local
// layout and the deployed one. Read once, cached for the life of the instance.
let registries = null;

async function loadJson(relative) {
  const candidates = [
    join(process.cwd(), relative),
    new URL(`../../${relative}`, import.meta.url).pathname,
  ];
  for (const path of candidates) {
    try { return JSON.parse(await readFile(path, "utf8")); } catch { /* try the next */ }
  }
  return null;
}

async function load() {
  if (registries) return registries;
  const [countries, sources] = await Promise.all([
    loadJson("data/reference/countries.json"),
    loadJson("data/reference/sources.json"),
  ]);
  registries = {
    countries: countries?.countries || [],
    sources: sources?.sources || [],
    byLabel: new Map((countries?.countries || []).map((c) => [c.label.toLowerCase(), c])),
    byIso3: new Map((countries?.countries || []).map((c) => [c.iso3, c])),
  };
  return registries;
}

/** Resolve a free-text country label to an ISO record, or null. */
export async function resolveCountry(label) {
  if (typeof label !== "string") return null;
  const key = label.trim().toLowerCase();
  if (!key) return null;
  const reg = await load();
  return reg.byLabel.get(key) || reg.byIso3.get(label.trim().toUpperCase()) || null;
}

/**
 * Indicator values for one country. Returns [] whenever the data is not there —
 * no database, empty table, or a country outside the list.
 */
export async function factsFor(country) {
  if (!country || !configured()) return [];
  try {
    const rows = await select(
      "reference_indicators",
      `iso3=eq.${encodeURIComponent(country.iso3)}&select=source,code,label,unit,meaning,value,year&order=source.asc,code.asc`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    // Reference data is an enrichment. A storage blip must not fail a paid
    // generation, so this is swallowed exactly like analytics are.
    return [];
  }
}

// Values reaching the prompt come from our own ingestion, not from a user —
// but the fence is applied anyway. The rule in this codebase is that no string
// reaches a prompt boundary unsanitised, regardless of how trustworthy today's
// producer of that string happens to be.
const fence = (v, n = 200) => String(v ?? "").slice(0, n).replace(/[<>]/g, "");
const num = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  // Two significant decimals is as much precision as any of these series
  // deserve, and it stops 15-digit floats eating tokens.
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : Number(v.toFixed(2)).toString();
};

/**
 * Render the facts as a prompt block. Empty string when there is nothing —
 * an empty section header would invite the model to fill it in.
 */
export function factsBlock(country, facts) {
  if (!country || !facts || !facts.length) return "";
  const lines = facts
    .map((f) => {
      const value = num(f.value);
      if (value === null) return null;
      const year = f.year ? ` (${f.year})` : "";
      return `- ${fence(f.label, 80)}: ${value} ${fence(f.unit, 40)}${year} — ${fence(f.meaning, 200)}`;
    })
    .filter(Boolean);

  if (!lines.length) return "";

  return `

<reference_data country="${fence(country.label, 80)}">
Verified statistics for this country, published by the World Bank and UNDP.
These are facts, not estimates. Use them instead of guessing, cite the figure
when it supports a point, and never contradict one. Where a number is absent
from this list, say so rather than substituting one from memory.

${lines.join("\n")}
</reference_data>`;
}

/**
 * Render the portal links as a prompt block for the compliance stage.
 * The wording is load-bearing: the model is told these are places to send the
 * user, not sources it has read.
 */
export async function linksBlock(country, stage) {
  const reg = await load();
  const portals = reg.sources.filter(
    (s) => s.kind === "portal" && (s.feeds || []).includes(stage),
  );
  if (!portals.length) return "";

  const lines = portals.map((s) => `- ${fence(s.name, 80)} (${fence(s.publisher, 60)}): ${fence(s.use, 240)}`);

  return `

<verification_sources>
Official databases where the founder can verify this jurisdiction's rules.
You have NOT read them. Do not quote, summarise or cite their contents, and do
not invent article numbers, fees or deadlines because these exist. Their only
role is to tell you which obligations are checkable and where — reflect that by
naming, in each checklist item, the kind of source that would settle it.

${lines.join("\n")}
</verification_sources>`;
}

/** Everything the engine needs for one stage, in one call. */
export async function referenceFor(countryLabel, stage) {
  const country = await resolveCountry(countryLabel);
  if (!country) return { country: null, facts: [], block: "" };

  const wantsFacts = ["analyze", "plan", "financials", "compliance"].includes(stage);
  const facts = wantsFacts ? await factsFor(country) : [];
  const links = await linksBlock(country, stage);

  return {
    country,
    facts,
    block: (wantsFacts ? factsBlock(country, facts) : "") + links,
  };
}
