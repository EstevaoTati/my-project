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

const COUNTRIES = ["COD","COG","AGO","RWA","BDI","UGA","KEN","TZA","ZMB","ZAF","NGA","GHA","CIV","SEN","CMR","GAB","BEN","TGO","MLI","BFA","NER","TCD","CAF","ETH","MAR","DZA","TUN","EGY","MOZ","ZWE","BWA","NAM","MDG","MUS","FRA","BEL","GBR","DEU","NLD","ESP","ITA","PRT","CHE","LUX","IRL","USA","CAN","BRA","MEX","ARE","SAU","QAT","TUR","IND","CHN","SGP","JPN","AUS"];

const INDICATORS: { code: string; source: string; label: string; unit: string; meaning: string }[] =
[
  {
    "code": "NY.GDP.PCAP.CD",
    "source": "wdi",
    "label": "GDP per capita",
    "unit": "current US$",
    "meaning": "Average income level. Anchors pricing and willingness to pay."
  },
  {
    "code": "NY.GDP.PCAP.PP.CD",
    "source": "wdi",
    "label": "GDP per capita, PPP",
    "unit": "international $",
    "meaning": "Income adjusted for local prices. Better than nominal for judging affordability."
  },
  {
    "code": "NY.GDP.MKTP.KD.ZG",
    "source": "wdi",
    "label": "GDP growth",
    "unit": "% per year",
    "meaning": "Direction of the economy. A growth assumption above this needs justifying."
  },
  {
    "code": "FP.CPI.TOTL.ZG",
    "source": "wdi",
    "label": "Inflation",
    "unit": "% per year",
    "meaning": "Consumer price inflation. Cost lines and price lists must account for it."
  },
  {
    "code": "SP.POP.TOTL",
    "source": "wdi",
    "label": "Population",
    "unit": "people",
    "meaning": "Total addressable population — a ceiling, never a market size."
  },
  {
    "code": "SP.URB.TOTL.IN.ZS",
    "source": "wdi",
    "label": "Urban population",
    "unit": "% of total",
    "meaning": "How concentrated customers are. Drives distribution and logistics cost."
  },
  {
    "code": "IT.NET.USER.ZS",
    "source": "wdi",
    "label": "Internet users",
    "unit": "% of population",
    "meaning": "Hard ceiling on any purely online model."
  },
  {
    "code": "IT.CEL.SETS.P2",
    "source": "wdi",
    "label": "Mobile subscriptions",
    "unit": "per 100 people",
    "meaning": "Reach of mobile channels, including mobile money."
  },
  {
    "code": "EG.ELC.ACCS.ZS",
    "source": "wdi",
    "label": "Access to electricity",
    "unit": "% of population",
    "meaning": "Operational constraint. Low values imply generator or solar cost lines."
  },
  {
    "code": "FS.AST.PRVT.GD.ZS",
    "source": "wdi",
    "label": "Domestic credit to private sector",
    "unit": "% of GDP",
    "meaning": "How available bank financing realistically is. Low values mean self-funding or informal credit."
  },
  {
    "code": "SL.UEM.TOTL.ZS",
    "source": "wdi",
    "label": "Unemployment",
    "unit": "% of labour force",
    "meaning": "Labour availability and wage pressure."
  },
  {
    "code": "GOV_WGI_RL.SC",
    "source": "wgi",
    "label": "Rule of law",
    "unit": "governance score (0-100)",
    "meaning": "Contract enforceability and property rights. Low values raise the cost of every agreement."
  },
  {
    "code": "GOV_WGI_CC.SC",
    "source": "wgi",
    "label": "Control of corruption",
    "unit": "governance score (0-100)",
    "meaning": "Likelihood of informal payments being demanded. Affects timelines and budget."
  },
  {
    "code": "GOV_WGI_RQ.SC",
    "source": "wgi",
    "label": "Regulatory quality",
    "unit": "governance score (0-100)",
    "meaning": "How workable the rules are for private business."
  },
  {
    "code": "GOV_WGI_GE.SC",
    "source": "wgi",
    "label": "Government effectiveness",
    "unit": "governance score (0-100)",
    "meaning": "Quality of public services a business depends on — registration, utilities, courts."
  },
  {
    "code": "GOV_WGI_PV.SC",
    "source": "wgi",
    "label": "Political stability",
    "unit": "governance score (0-100)",
    "meaning": "Continuity risk. Low values justify shorter planning horizons."
  },
  {
    "code": "GOV_WGI_VA.SC",
    "source": "wgi",
    "label": "Voice and accountability",
    "unit": "governance score (0-100)",
    "meaning": "Openness of the civic environment."
  }
];

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
