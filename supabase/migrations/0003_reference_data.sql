-- MWINDA DIGITAL — reference data layer.
--
-- Why a table rather than live API calls at generation time:
--   * A stage already runs 20-120s. Adding external calls inside that window
--     puts a founder's dossier at the mercy of another organisation's uptime.
--   * The same country must yield the same baseline facts today and tomorrow;
--     a dossier that silently changes because an upstream endpoint hiccuped is
--     not a document anyone can take to a bank.
--   * Rate limits and terms of use are respected by fetching once per refresh
--     for everyone, instead of once per user per generation.
--
-- So: a scheduled ingestion writes here, and the engine reads here. If this
-- table is empty the engine simply omits the facts block — exactly as it
-- behaved before this migration. Reference data enriches; it never gates.

-- ------------------------------------------------------ reference_indicators --
-- One row per (country, indicator). Only the most recent observation is kept:
-- the history lives at the source, and a dossier cites a single vintage.
create table if not exists public.reference_indicators (
  iso3        char(3)     not null,
  source      text        not null,          -- wdi | wgi | bready | hdr
  code        text        not null,          -- e.g. NY.GDP.PCAP.CD
  label       text        not null,          -- human-readable series name
  unit        text,
  meaning     text,                          -- how the model should read the number
  value       double precision,
  year        smallint,                      -- vintage of the observation itself
  fetched_at  timestamptz not null default now(),
  primary key (iso3, source, code)
);

create index if not exists reference_indicators_iso3_idx on public.reference_indicators (iso3);

-- A refresh that half-fails must not leave a country describing itself with a
-- mix of vintages and no way to tell. One row per country records the outcome.
create table if not exists public.reference_refresh (
  iso3        char(3) primary key,
  refreshed_at timestamptz not null default now(),
  ok          boolean not null default true,
  detail      text
);

-- ------------------------------------------------- grounding on a project ---
-- Which sources a dossier was built against, and how many verified indicators
-- were available at the time. Stored with the project rather than recomputed on
-- load: reference data is refreshed over time, and a dossier must keep citing
-- the vintage it was actually written from.
alter table public.projects add column if not exists sources   jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists grounding jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------------- RLS ----
-- This data is public at the source, but the browser still has no Supabase
-- credential and never will. Same deny-by-default posture as every other
-- table: service_role only.
alter table public.reference_indicators enable row level security;
alter table public.reference_refresh    enable row level security;

revoke all on public.reference_indicators from anon, authenticated;
revoke all on public.reference_refresh    from anon, authenticated;
