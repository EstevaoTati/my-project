-- LES ÉLITES PUBLISHING HOUSE — contact + manuscript submissions.
--
-- Access model (same as MWINDA DIGITAL):
--   * RLS ON, NO policies on every table → `anon` and `authenticated` read
--     and write nothing. Only the server (service_role, which bypasses RLS)
--     touches these tables, from netlify/functions/submit.mjs.
--   * The team works in Supabase Studio (MFA on every team account) until a
--     dedicated admin exists. Status changes are logged by a trigger.
--   * Manuscripts live in a PRIVATE bucket with a 20 MB cap and a MIME
--     allow-list enforced by Storage itself.

create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  name        text not null check (char_length(name) <= 120),
  email       text not null check (char_length(email) <= 200),
  country     text check (char_length(country) <= 80),
  subject     text check (char_length(subject) <= 200),
  message     text not null check (char_length(message) <= 4000),
  handled     boolean not null default false,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_ip_time on public.contact_messages (ip_hash, created_at desc);

-- REÇU → EN ÉVALUATION → INFORMATIONS COMPLÉMENTAIRES → DÉCISION COMMUNIQUÉE
-- `pending_upload` exists only between the form and the file landing.
create type public.submission_status as enum ('pending_upload', 'received', 'in_review', 'more_info', 'decision_sent');

create table if not exists public.manuscript_submissions (
  id           uuid primary key default gen_random_uuid(),
  ref          text not null unique,
  status       public.submission_status not null default 'pending_upload',
  name         text not null check (char_length(name) <= 120),
  email        text not null check (char_length(email) <= 200),
  phone        text check (char_length(phone) <= 40),
  country      text not null check (char_length(country) <= 80),
  title        text not null check (char_length(title) <= 200),
  genre        text not null check (char_length(genre) <= 80),
  language     text not null check (char_length(language) <= 60),
  summary      text not null check (char_length(summary) <= 3000),
  length       text check (char_length(length) <= 60),
  message      text check (char_length(message) <= 3000),
  file_path    text not null,
  file_name    text not null,
  file_size    integer not null check (file_size > 0 and file_size <= 20971520),
  file_type    text not null,
  claim_hash   text,            -- sha256 of the browser's one-time claim; cleared once received
  team_notes   text,
  ip_hash      text not null,
  created_at   timestamptz not null default now(),
  received_at  timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists manuscript_ip_time on public.manuscript_submissions (ip_hash, created_at desc);
create index if not exists manuscript_status on public.manuscript_submissions (status, created_at desc);

-- Audit trail of every status change (who/when), written by trigger so a
-- change made in Studio is recorded too.
create table if not exists public.submission_events (
  id             bigint generated always as identity primary key,
  submission_id  uuid not null references public.manuscript_submissions(id) on delete cascade,
  status         public.submission_status not null,
  actor          text not null default coalesce(current_setting('request.jwt.claim.email', true), current_user),
  created_at     timestamptz not null default now()
);

create or replace function public.log_submission_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'received' then
    insert into public.submission_events (submission_id, status) values (new.id, new.status);
  end if;
  return new;
end $$;
drop trigger if exists submission_status_log on public.manuscript_submissions;
create trigger submission_status_log before update on public.manuscript_submissions
  for each row execute function public.log_submission_status();

alter table public.contact_messages        enable row level security;
alter table public.manuscript_submissions  enable row level security;
alter table public.submission_events       enable row level security;
-- (deliberately no policies)

-- Abandoned uploads: purge rows that never received their file after 24 h.
-- Schedule with pg_cron if enabled:  select cron.schedule('le-purge', '17 3 * * *', $$select public.purge_abandoned_submissions()$$);
create or replace function public.purge_abandoned_submissions() returns integer
language sql security definer set search_path = public as $$
  with d as (delete from public.manuscript_submissions
             where status = 'pending_upload' and created_at < now() - interval '24 hours' returning 1)
  select count(*)::int from d;
$$;

-- Private bucket, enforced limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manuscripts', 'manuscripts', false, 20971520, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/rtf'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- No storage.objects policies for this bucket: only service_role reads it,
-- and visitors write only through a single-use signed upload URL.
