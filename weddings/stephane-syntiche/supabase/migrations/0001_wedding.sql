-- STEPHANE & SYNTICHE — wedding site schema.
--
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to run on
-- the existing MWINDA project: every table is prefixed `wed_`.
--
-- Security model (same as the MWINDA site, deliberately):
--   * The browser NEVER talks to Supabase. Every read and write goes through a
--     Netlify function holding the service_role key.
--   * RLS is enabled on every table with NO policies. service_role bypasses
--     RLS; anon and authenticated get nothing, even if the anon key leaks.
--   * No invitation secret is stored. A guest link is `CODE.SIG` where SIG is
--     HMAC(INVITE_SECRET, CODE), recomputed server-side. A database dump alone
--     cannot open anyone's invitation.

create extension if not exists pgcrypto;

-- -------------------------------------------------------------- settings --
-- Editable site content (venues, times, program, story, FAQ, gifts…) as one
-- jsonb document, deep-merged over the bundled content.json defaults.
create table if not exists public.wed_settings (
  key        text primary key,
  value      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- tables --
-- Seating planner. Optional: nothing requires a table to exist.
create table if not exists public.wed_tables (
  id         uuid primary key default gen_random_uuid(),
  name       text     not null,
  capacity   smallint not null default 8 check (capacity between 1 and 60),
  sort       smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------- invitations --
-- One row per invitation: an individual, a couple or a household.
create table if not exists public.wed_invitations (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,            -- public half of the link
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  label            text not null,                   -- "Marie & Paul Dupont"
  greeting         text,                            -- "Marie" — shown as WELCOME, MARIE
  kind             text not null default 'individual'
                   check (kind in ('individual','couple','household')),
  party            jsonb not null default '[]'::jsonb, -- known names, prefilled in RSVP
  max_guests       smallint not null default 1 check (max_guests between 1 and 20),
  lang             text not null default 'fr' check (lang in ('fr','en')),
  group_name       text,                            -- "Family — Syntiche", "Work"…
  email            text,
  phone            text,
  notes            text,                            -- private, admin only
  personal_message text,                            -- shown on the invitation card

  -- delivery
  sent_at          timestamptz,
  sent_via         text,                            -- whatsapp/email/sms/link/print
  send_status      text,                            -- provider outcome, never assumed
  opened_at        timestamptz,

  -- response
  rsvp_status      text not null default 'pending'
                   check (rsvp_status in ('pending','attending','declined')),
  rsvp_seats       smallint not null default 0 check (rsvp_seats between 0 and 20),
  rsvp_attendees   jsonb not null default '[]'::jsonb, -- [{name, meal, dietary}]
  rsvp_message     text,
  rsvp_at          timestamptz,

  -- day-of
  table_id         uuid references public.wed_tables(id) on delete set null,
  checked_in_at    timestamptz,
  checked_in_count smallint not null default 0 check (checked_in_count between 0 and 20)
);

create index if not exists wed_invitations_status_idx on public.wed_invitations (rsvp_status);
create index if not exists wed_invitations_group_idx  on public.wed_invitations (group_name);

-- ------------------------------------------------------------- guestbook --
create table if not exists public.wed_guestbook (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  invitation_id uuid references public.wed_invitations(id) on delete set null,
  name          text not null,
  message       text not null,
  lang          text,
  approved      boolean not null default false     -- moderated before publication
);

create index if not exists wed_guestbook_approved_idx on public.wed_guestbook (approved, created_at desc);

-- -------------------------------------------------------------------- RLS --
alter table public.wed_settings    enable row level security;
alter table public.wed_tables      enable row level security;
alter table public.wed_invitations enable row level security;
alter table public.wed_guestbook   enable row level security;

revoke all on public.wed_settings, public.wed_tables, public.wed_invitations, public.wed_guestbook
  from anon, authenticated;

-- ---------------------------------------------------------------- storage --
-- Public bucket for photos uploaded from the dashboard. Uploads go through the
-- admin function (service_role); the public can read, never write.
insert into storage.buckets (id, name, public)
values ('wedding-media', 'wedding-media', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------- retention --
-- Guest personal data has no reason to outlive the celebration. After the
-- couple has exported what they want to keep, run:
--   select public.wed_purge_guest_data();
create or replace function public.wed_purge_guest_data() returns void
language sql security definer set search_path = public as $$
  update public.wed_invitations
     set email = null, phone = null, notes = null,
         rsvp_attendees = '[]'::jsonb, rsvp_message = null;
  delete from public.wed_guestbook where approved = false;
$$;
revoke all on function public.wed_purge_guest_data() from public, anon, authenticated;
