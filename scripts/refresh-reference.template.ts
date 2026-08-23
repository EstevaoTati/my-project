// MWINDA DIGITAL — reference data refresh, running on Supabase.
//
// This exists because the ingestion has to run somewhere with outbound network
// access to api.worldbank.org. Rather than depending on a laptop being open,
// it runs next to the database and can be scheduled with pg_cron.
//
// scripts/fetch-reference-data.mjs remains the local equivalent, and the two
// share the same registry files — data/reference/*.json is the single source
// of truth for which countries and series are pulled. Regenerate this file
// with scripts/build-edge-function.mjs after editing them.
//
// Auth: the caller must present the service_role key as a bearer token. The
// anon key is public, so verify_jwt alone would leave a database write open to
// anyone who has ever viewed the site.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const COUNTRIES = __COUNTRIES__;

const INDICATORS: { code: string; source: string; label: string; unit: string; meaning: string }[] =
__INDICATORS__;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Length-safe comparison so the key is not probeable by timing. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function fetchIndicator(ind: typeof INDICATORS[number]) {
  const url = `https://api.worldbank.org/v2/country/${COUNTRIES.join(";")}`
    + `/indicator/${ind.code}?format=json&mrnev=1&per_page=${COUNTRIES.length * 4}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[1])) {
    throw new Error("unexpected response shape");
  }
  const rows = [];
  for (const row of body[1]) {
    const iso3 = row?.countryiso3code;
    if (!iso3 || row.value === null || row.value === undefined) continue;
    rows.push({
      iso3, source: ind.source, code: ind.code, label: ind.label,
      unit: ind.unit, meaning: ind.meaning,
      value: Number(row.value), year: Number(row.date) || null,
    });
  }
  return rows;
}

async function upsert(rows: unknown[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reference_indicators`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  if (!SERVICE_KEY || !secretMatches(bearer, SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const rows: unknown[] = [];
  const failures: string[] = [];
  for (const ind of INDICATORS) {
    try {
      rows.push(...await fetchIndicator(ind));
    } catch (e) {
      failures.push(`${ind.code}: ${(e as Error).message}`);
    }
  }

  // An empty fetch must never be treated as a successful refresh: silently
  // stripping every dossier of its grounding is the one failure nobody sees.
  if (!rows.length) {
    return new Response(JSON.stringify({ ok: false, error: "nothing fetched", failures }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) await upsert(rows.slice(i, i + CHUNK));

  const countries = new Set(rows.map((r) => (r as { iso3: string }).iso3));
  return new Response(JSON.stringify({
    ok: true, values: rows.length, countries: countries.size,
    indicators: INDICATORS.length - failures.length, failures,
  }), { headers: { "content-type": "application/json" } });
});
