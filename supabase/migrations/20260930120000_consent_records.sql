-- Traceable consent (Parcours Client §10, Parcours Prestataire §06).
--
-- The specs ask for the date, the time, the accepted version and — for the
-- provider contract — the "adresse technique" and a proof of signature. None
-- of those can be trusted from the client: a phone's clock and its idea of its
-- own IP are both whatever the phone says. So the row is stamped here, by the
-- database, from the request PostgREST is serving:
--
--   accepted_at  now(), not a client timestamp
--   user_id      auth.uid(), not a client-supplied id
--   ip           first hop of x-forwarded-for
--   user_agent   the request's user-agent
--
-- Append-only by construction: `authenticated` is granted SELECT and INSERT and
-- nothing else, so a consent can be superseded by a newer row (a withdrawn
-- marketing opt-in, a re-accepted contract version) but never edited or erased.
-- That is what makes it an audit trail rather than a preference.

create table if not exists public.consent_records (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('terms', 'privacy', 'marketing', 'provider_contract')),
  version     text not null check (length(version) between 1 and 32),
  granted     boolean not null default true,
  -- Provider contract only: the full name typed as a signature.
  signature   text check (signature is null or length(signature) between 2 and 200),
  accepted_at timestamptz not null default now(),
  ip          inet,
  user_agent  text
);

comment on table public.consent_records is
  '242Konnect consent audit trail. Append-only; stamped server-side (time, user, IP, user agent).';

create index if not exists consent_records_user_kind_idx
  on public.consent_records (user_id, kind, accepted_at desc);

create or replace function public.stamp_consent_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  headers jsonb;
  forwarded text;
begin
  -- Whatever the client sent for these, the server's values win.
  new.user_id := auth.uid();
  new.accepted_at := now();

  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;

  forwarded := split_part(coalesce(headers ->> 'x-forwarded-for', ''), ',', 1);
  begin
    new.ip := nullif(trim(forwarded), '')::inet;
  exception when others then
    new.ip := null;
  end;
  new.user_agent := left(headers ->> 'user-agent', 400);

  if new.user_id is null then
    raise exception 'consent must be recorded by a signed-in user';
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_consent_record on public.consent_records;
create trigger stamp_consent_record
  before insert on public.consent_records
  for each row execute function public.stamp_consent_record();

alter table public.consent_records enable row level security;

drop policy if exists "consent: read own" on public.consent_records;
create policy "consent: read own" on public.consent_records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "consent: record own" on public.consent_records;
create policy "consent: record own" on public.consent_records
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.consent_records from anon, authenticated;
grant select, insert on public.consent_records to authenticated;
