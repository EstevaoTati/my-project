-- MWINDA DIGITAL — reference data refresh, in the database.
--
-- 0003 created the table the engine reads. This fills it, on a schedule, with
-- no external trigger and no key to manage.
--
-- Why in the database rather than a script or a serverless function: the
-- refresh needs outbound network access and a scheduler. Postgres has both
-- (http + pg_cron), so this needs nothing to be deployed, invoked or
-- authenticated. scripts/fetch-reference-data.mjs stays the local equivalent
-- for development and for B-READY, which arrives as a CSV the database cannot
-- parse.

-- Outbound HTTP is a capability, not a convenience: kept out of the public
-- schema and out of reach of the client roles.
create extension if not exists http with schema extensions;

revoke all on schema extensions from anon, authenticated;
revoke all on all functions in schema extensions from anon, authenticated;

-- ------------------------------------------------------------- registries --
-- Loaded from data/reference/*.json, which stays the authoring source. Held in
-- the database so the scheduled job learns about a new country or series
-- without a deploy.
create table if not exists public.reference_countries (
  iso3  char(3) primary key,
  iso2  char(2) not null,
  label text    not null,
  fr    text    not null
);

create table if not exists public.reference_series (
  source  text not null,
  code    text primary key,
  label   text not null,
  unit    text,
  meaning text
);

alter table public.reference_countries enable row level security;
alter table public.reference_series    enable row level security;
revoke all on public.reference_countries from anon, authenticated;
revoke all on public.reference_series    from anon, authenticated;

insert into public.reference_countries (iso3, iso2, label, fr) values
  ('COD', 'CD', 'Democratic Republic of Congo', 'République démocratique du Congo'),
  ('COG', 'CG', 'Republic of Congo', 'République du Congo'),
  ('AGO', 'AO', 'Angola', 'Angola'),
  ('RWA', 'RW', 'Rwanda', 'Rwanda'),
  ('BDI', 'BI', 'Burundi', 'Burundi'),
  ('UGA', 'UG', 'Uganda', 'Ouganda'),
  ('KEN', 'KE', 'Kenya', 'Kenya'),
  ('TZA', 'TZ', 'Tanzania', 'Tanzanie'),
  ('ZMB', 'ZM', 'Zambia', 'Zambie'),
  ('ZAF', 'ZA', 'South Africa', 'Afrique du Sud'),
  ('NGA', 'NG', 'Nigeria', 'Nigéria'),
  ('GHA', 'GH', 'Ghana', 'Ghana'),
  ('CIV', 'CI', 'Ivory Coast', 'Côte d''Ivoire'),
  ('SEN', 'SN', 'Senegal', 'Sénégal'),
  ('CMR', 'CM', 'Cameroon', 'Cameroun'),
  ('GAB', 'GA', 'Gabon', 'Gabon'),
  ('BEN', 'BJ', 'Benin', 'Bénin'),
  ('TGO', 'TG', 'Togo', 'Togo'),
  ('MLI', 'ML', 'Mali', 'Mali'),
  ('BFA', 'BF', 'Burkina Faso', 'Burkina Faso'),
  ('NER', 'NE', 'Niger', 'Niger'),
  ('TCD', 'TD', 'Chad', 'Tchad'),
  ('CAF', 'CF', 'Central African Republic', 'République centrafricaine'),
  ('ETH', 'ET', 'Ethiopia', 'Éthiopie'),
  ('MAR', 'MA', 'Morocco', 'Maroc'),
  ('DZA', 'DZ', 'Algeria', 'Algérie'),
  ('TUN', 'TN', 'Tunisia', 'Tunisie'),
  ('EGY', 'EG', 'Egypt', 'Égypte'),
  ('MOZ', 'MZ', 'Mozambique', 'Mozambique'),
  ('ZWE', 'ZW', 'Zimbabwe', 'Zimbabwe'),
  ('BWA', 'BW', 'Botswana', 'Botswana'),
  ('NAM', 'NA', 'Namibia', 'Namibie'),
  ('MDG', 'MG', 'Madagascar', 'Madagascar'),
  ('MUS', 'MU', 'Mauritius', 'Maurice'),
  ('FRA', 'FR', 'France', 'France'),
  ('BEL', 'BE', 'Belgium', 'Belgique'),
  ('GBR', 'GB', 'United Kingdom', 'Royaume-Uni'),
  ('DEU', 'DE', 'Germany', 'Allemagne'),
  ('NLD', 'NL', 'Netherlands', 'Pays-Bas'),
  ('ESP', 'ES', 'Spain', 'Espagne'),
  ('ITA', 'IT', 'Italy', 'Italie'),
  ('PRT', 'PT', 'Portugal', 'Portugal'),
  ('CHE', 'CH', 'Switzerland', 'Suisse'),
  ('LUX', 'LU', 'Luxembourg', 'Luxembourg'),
  ('IRL', 'IE', 'Ireland', 'Irlande'),
  ('USA', 'US', 'United States', 'États-Unis'),
  ('CAN', 'CA', 'Canada', 'Canada'),
  ('BRA', 'BR', 'Brazil', 'Brésil'),
  ('MEX', 'MX', 'Mexico', 'Mexique'),
  ('ARE', 'AE', 'United Arab Emirates', 'Émirats arabes unis'),
  ('SAU', 'SA', 'Saudi Arabia', 'Arabie saoudite'),
  ('QAT', 'QA', 'Qatar', 'Qatar'),
  ('TUR', 'TR', 'Turkey', 'Turquie'),
  ('IND', 'IN', 'India', 'Inde'),
  ('CHN', 'CN', 'China', 'Chine'),
  ('SGP', 'SG', 'Singapore', 'Singapour'),
  ('JPN', 'JP', 'Japan', 'Japon'),
  ('AUS', 'AU', 'Australia', 'Australie')
on conflict (iso3) do update
  set iso2 = excluded.iso2, label = excluded.label, fr = excluded.fr;

-- The WGI codes here are GOV_WGI_<X>.SC. The percentile-rank codes that look
-- right (RL.PER.RNK and friends) do not exist in the v2 indicator API — it
-- answers "the indicator was not found". Verified against the live API.
insert into public.reference_series (source, code, label, unit, meaning) values
  ('wdi', 'NY.GDP.PCAP.CD', 'GDP per capita', 'current US$', 'Average income level. Anchors pricing and willingness to pay.'),
  ('wdi', 'NY.GDP.PCAP.PP.CD', 'GDP per capita, PPP', 'international $', 'Income adjusted for local prices. Better than nominal for judging affordability.'),
  ('wdi', 'NY.GDP.MKTP.KD.ZG', 'GDP growth', '% per year', 'Direction of the economy. A growth assumption above this needs justifying.'),
  ('wdi', 'FP.CPI.TOTL.ZG', 'Inflation', '% per year', 'Consumer price inflation. Cost lines and price lists must account for it.'),
  ('wdi', 'SP.POP.TOTL', 'Population', 'people', 'Total addressable population — a ceiling, never a market size.'),
  ('wdi', 'SP.URB.TOTL.IN.ZS', 'Urban population', '% of total', 'How concentrated customers are. Drives distribution and logistics cost.'),
  ('wdi', 'IT.NET.USER.ZS', 'Internet users', '% of population', 'Hard ceiling on any purely online model.'),
  ('wdi', 'IT.CEL.SETS.P2', 'Mobile subscriptions', 'per 100 people', 'Reach of mobile channels, including mobile money.'),
  ('wdi', 'EG.ELC.ACCS.ZS', 'Access to electricity', '% of population', 'Operational constraint. Low values imply generator or solar cost lines.'),
  ('wdi', 'FS.AST.PRVT.GD.ZS', 'Domestic credit to private sector', '% of GDP', 'How available bank financing realistically is. Low values mean self-funding or informal credit.'),
  ('wdi', 'SL.UEM.TOTL.ZS', 'Unemployment', '% of labour force', 'Labour availability and wage pressure.'),
  ('wgi', 'GOV_WGI_RL.SC', 'Rule of law', 'governance score (0-100)', 'Contract enforceability and property rights. Low values raise the cost of every agreement.'),
  ('wgi', 'GOV_WGI_CC.SC', 'Control of corruption', 'governance score (0-100)', 'Likelihood of informal payments being demanded. Affects timelines and budget.'),
  ('wgi', 'GOV_WGI_RQ.SC', 'Regulatory quality', 'governance score (0-100)', 'How workable the rules are for private business.'),
  ('wgi', 'GOV_WGI_GE.SC', 'Government effectiveness', 'governance score (0-100)', 'Quality of public services a business depends on — registration, utilities, courts.'),
  ('wgi', 'GOV_WGI_PV.SC', 'Political stability', 'governance score (0-100)', 'Continuity risk. Low values justify shorter planning horizons.'),
  ('wgi', 'GOV_WGI_VA.SC', 'Voice and accountability', 'governance score (0-100)', 'Openness of the civic environment.')
on conflict (code) do update
  set source = excluded.source, label = excluded.label,
      unit = excluded.unit, meaning = excluded.meaning;

-- ------------------------------------------------------------- the refresh --
create or replace function public.refresh_reference_data()
returns table (series text, loaded integer, note text)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  s        record;
  isolist  text;
  n        integer;
  resp     extensions.http_response;
  payload  jsonb;
  inserted integer;
begin
  select string_agg(iso3, ';' order by iso3), count(*)
    into isolist, n
    from public.reference_countries;
  if isolist is null then
    raise exception 'reference_countries is empty — seed it before refreshing';
  end if;

  for s in select * from public.reference_series order by code loop
    begin
      -- One request per series for ALL countries: ~17 requests, not ~986.
      --
      -- mrnev=1 is "most recent NON-EMPTY value per country". mrv=1 means "the
      -- most recent year" and returns null for every country that has not
      -- reported it yet — against the live API it filled 5 of 58 countries for
      -- internet usage where mrnev filled 58. per_page must exceed the country
      -- count for the same reason.
      select * into resp from extensions.http_get(
        'https://api.worldbank.org/v2/country/' || isolist ||
        '/indicator/' || s.code ||
        '?format=json&mrnev=1&per_page=' || (n * 4)::text
      );

      if resp.status <> 200 then
        series := s.code; loaded := 0; note := 'HTTP ' || resp.status;
        return next; continue;
      end if;

      payload := resp.content::jsonb;

      -- The API answers [metadata, rows]; an error answers [{message:[...]}].
      if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) < 2
         or jsonb_typeof(payload -> 1) <> 'array' then
        series := s.code; loaded := 0;
        note := coalesce(left(payload -> 0 -> 'message' -> 0 ->> 'value', 90), 'unexpected response shape');
        return next; continue;
      end if;

      with rows as (
        select
          r ->> 'countryiso3code'           as iso3,
          (r ->> 'value')::double precision as value,
          nullif(r ->> 'date', '')::smallint as year
        from jsonb_array_elements(payload -> 1) as r
        where coalesce(r ->> 'countryiso3code', '') <> ''
          and r -> 'value' <> 'null'::jsonb
      )
      insert into public.reference_indicators
        (iso3, source, code, label, unit, meaning, value, year, fetched_at)
      select rows.iso3, s.source, s.code, s.label, s.unit, s.meaning,
             rows.value, rows.year, now()
      from rows
      join public.reference_countries c on c.iso3 = rows.iso3
      on conflict (iso3, source, code) do update
        set value = excluded.value, year = excluded.year,
            label = excluded.label, unit = excluded.unit,
            meaning = excluded.meaning, fetched_at = excluded.fetched_at;

      get diagnostics inserted = row_count;
      series := s.code; loaded := inserted; note := 'ok';
      return next;

    -- One bad series must not abandon the other sixteen.
    exception when others then
      series := s.code; loaded := 0; note := left(sqlerrm, 120);
      return next;
    end;
  end loop;
end;
$fn$;

-- ------------------------------------------------------------- scheduling --
create extension if not exists pg_cron;
revoke all on schema cron from anon, authenticated;

-- These series update annually at best; monthly catches a revision without
-- being noise.
select cron.schedule(
  'mwinda-refresh-reference',
  '0 4 1 * *',
  $cron$select public.refresh_reference_data()$cron$
);

-- 0002 created purge_expired() and nothing ever called it, so the retention
-- promise on the contact form was not being kept. This keeps it.
select cron.schedule(
  'mwinda-purge-expired',
  '0 3 * * 0',
  $cron$select public.purge_expired()$cron$
);

-- ------------------------------------------------------- function grants ----
-- Postgres grants EXECUTE on every new function to PUBLIC. Revoking from anon
-- and authenticated does NOT remove that grant, so PostgREST kept exposing
-- these at /rest/v1/rpc/<name> to anyone holding the anon key — which is public
-- by design. Before this, any visitor could call erase_lead() to delete a
-- customer record, purge_expired() to trigger mass deletion, or
-- refresh_reference_data() to force 17 outbound API calls on demand.
--
-- Revoking from PUBLIC is the only thing that closes it. service_role keeps its
-- explicit grant and the owner keeps its rights, so the Netlify functions and
-- the cron jobs are unaffected.
revoke execute on function public.erase_lead(text)         from public;
revoke execute on function public.purge_expired()          from public;
revoke execute on function public.refresh_reference_data() from public;
revoke execute on function public.touch_updated_at()       from public, anon, authenticated;

-- Same trap for anything added later.
alter default privileges in schema public revoke execute on functions from public;
