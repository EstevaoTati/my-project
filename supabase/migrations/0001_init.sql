-- MWINDA DIGITAL — initial schema
--
-- Run this once in the Supabase SQL editor (or via the CLI) on a new project.
--
-- Security model, deliberately:
--   * The browser NEVER talks to Supabase. Every read and write goes through a
--     Netlify function holding the service_role key, so no Supabase credential
--     ever reaches a client.
--   * RLS is enabled on every table with NO policies. The service_role key
--     bypasses RLS; the anon and authenticated roles therefore get nothing,
--     even if the anon key leaks or is published. Deny-by-default.
--   * Business plans are confidential. Without user accounts, a project is
--     owned by whoever holds its unguessable id AND its secret token. Only the
--     SHA-256 of that token is stored, so a database dump does not hand over
--     API access to the projects.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- projects --
-- One row per AI Business Intelligence project.
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text        not null,          -- sha256(owner token), never the token
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- context (also useful as anonymous product analytics)
  intent        text,
  country       text,
  region        text,
  city          text,
  sector        text,
  business_type text,
  budget        text,

  idea          text,
  answers       jsonb       not null default '{}'::jsonb,
  stages        jsonb       not null default '{}'::jsonb,  -- analyze/model/plan/…
  tasks_done    jsonb       not null default '{}'::jsonb,
  checked       jsonb       not null default '{}'::jsonb,

  progress      smallint    not null default 0,            -- 0-100
  constraint projects_progress_range check (progress between 0 and 100)
);

create index if not exists projects_token_hash_idx on public.projects (token_hash);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);
create index if not exists projects_country_idx    on public.projects (country);

-- ------------------------------------------------------------------- leads --
-- Contact-form submissions. Until now a visitor who abandoned the WhatsApp
-- handoff was lost silently; this records the lead before that hop.
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  topic      text,
  message    text not null,
  source     text not null default 'website',
  handed_off boolean not null default false,   -- did WhatsApp actually open
  notes      text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ------------------------------------------------------------------ events --
-- Minimal product analytics for the MVP KPIs (projects created, completion
-- rate, dossiers exported). No IP addresses, no personal data, no tracking
-- across sites — only what is needed to answer "is this being used?".
create table if not exists public.events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  event      text not null,
  project_id uuid references public.projects (id) on delete set null,
  meta       jsonb not null default '{}'::jsonb
);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_event_idx      on public.events (event);

-- --------------------------------------------------------- updated_at hook --
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- RLS ----
-- Enabled with no policies on purpose: anon and authenticated can do nothing.
-- Only service_role (server side, in Netlify env vars) has access.
alter table public.projects enable row level security;
alter table public.leads    enable row level security;
alter table public.events   enable row level security;

revoke all on public.projects from anon, authenticated;
revoke all on public.leads    from anon, authenticated;
revoke all on public.events   from anon, authenticated;

-- ------------------------------------------------------- founder dashboard --
-- Aggregates for the MVP KPIs, queried by the founder console.
create or replace view public.kpi_overview
with (security_invoker = true) as
select
  (select count(*) from public.projects)                                      as projects_total,
  (select count(*) from public.projects where progress >= 100)                as projects_complete,
  (select count(*) from public.projects where created_at > now() - interval '7 days') as projects_last_7d,
  (select count(*) from public.leads)                                         as leads_total,
  (select count(*) from public.leads where created_at > now() - interval '7 days')    as leads_last_7d,
  (select count(*) from public.events where event = 'dossier_exported')       as dossiers_exported,
  (select round(avg(progress)) from public.projects)                          as avg_progress;
