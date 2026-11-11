-- 242Konnect — backend security hardening (audit of 2026-10-19).
--
-- Every change here is non-destructive: no table, column or row is dropped,
-- and the data in production was checked against each new rule before it was
-- written (see docs/security/assessment.md, "Pre-flight").
--
-- Findings addressed (ids from docs/security/assessment.md):
--   F-03  PIN lockout lived in one Edge Function isolate's memory, so a PIN
--         could be brute-forced across isolates. → atomic lock state in
--         user_pin_security, reachable only by the service role.
--   F-04  profiles: the account could write any e-mail into its own row
--         (squatting someone else's address) and set prestataire.verified.
--         → server-owned fields are forced by trigger.
--   F-05  provider_listings was readable in full by every signed-in user,
--         including pending and refused profiles and the refusal reason.
--         → others see approved listings only; the reason is cleared on
--         approval.
--   F-07  No quotas: one account could create requests, messages, consents
--         or data requests without limit. → per-user rate limits in the DB.
--   F-08  rls_auto_enable() (SECURITY DEFINER) was executable by anon and
--         authenticated, and new functions are executable by default.
--         → revoked, and default privileges now deny.
--   F-09  No security event log. → append-only public.security_events.
--   F-10  profiles had no size or format limits (a 50 MB avatar would be
--         accepted). → CHECK constraints.
--
-- Applied to production on 2026-10-20 in nine parts (supabase_migrations:
-- security_hardening_0 … _8), so that a refusal would name its part. Part 6
-- first failed on the 20 KB JSON limit: prestataires' supporting documents
-- live inline in profiles.prestataire (up to 28 KB today, finding F-16), so
-- the cap is 2 MB — a bound against abuse, not a storage design.

-- ---------------------------------------------------------------------------
-- F-08 · Function privileges: default deny
-- ---------------------------------------------------------------------------

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Supabase grants EXECUTE on every new function in `public` to anon and
-- authenticated. From now on a function is callable over the API only when a
-- migration grants it explicitly, as request_action() already is.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- F-09 · Security event log
-- ---------------------------------------------------------------------------

create table if not exists public.security_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  kind      text not null check (kind ~ '^[a-z][a-z0-9_.]{2,63}$'),
  severity  text not null default 'info'
            check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  -- No foreign key: deleting an account must not erase the evidence about it.
  user_id   uuid,
  ip        inet,
  detail    jsonb not null default '{}'::jsonb
            check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4000)
);

comment on table public.security_events is
  '242Konnect security log. Append-only; written by the service role and by SECURITY DEFINER functions. Never holds secrets, PINs, codes or tokens.';

create index if not exists security_events_at_idx   on public.security_events (at desc);
create index if not exists security_events_kind_idx on public.security_events (kind, at desc);
create index if not exists security_events_user_idx on public.security_events (user_id, at desc);

alter table public.security_events enable row level security;
-- No policies: not readable or writable through the API by anyone but the
-- service role.
revoke all on public.security_events from public, anon, authenticated;

-- Evidence is not edited. Rows leave only through the retention purge below,
-- which sets a transaction-local flag this trigger recognises.
create or replace function public.security_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('konnect.purging_security_events', true) = 'on' then
    return old;
  end if;
  raise exception 'security_events is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists security_events_append_only on public.security_events;
create trigger security_events_append_only
  before update or delete on public.security_events
  for each row execute function public.security_events_append_only();

create or replace function public.log_security_event(
  p_kind     text,
  p_severity text default 'info',
  p_user     uuid default null,
  p_detail   jsonb default '{}'::jsonb,
  p_ip       inet default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.security_events (kind, severity, user_id, ip, detail)
  values (p_kind, p_severity, p_user, p_ip, coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke execute on function public.log_security_event(text, text, uuid, jsonb, inet) from public, anon, authenticated;
grant execute on function public.log_security_event(text, text, uuid, jsonb, inet) to service_role;

-- Retention: 400 days covers a yearly review plus a margin.
create or replace function public.purge_security_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform set_config('konnect.purging_security_events', 'on', true);
  delete from public.security_events where at < now() - interval '400 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_security_events() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'konnect-purge-security-events') then
    perform cron.unschedule('konnect-purge-security-events');
  end if;
  perform cron.schedule('konnect-purge-security-events', '17 3 * * *', 'select public.purge_security_events()');
end;
$$;

-- ---------------------------------------------------------------------------
-- F-03 · PIN lock state, atomic and shared by every function instance
-- ---------------------------------------------------------------------------

-- The lock and the attempt counter are decided here, in one row lock, rather
-- than in an isolate's memory: a second isolate, or a restart, sees the same
-- count. Five wrong PINs lock the PIN for fifteen minutes; a third lockout
-- within 24 hours locks it for 24 hours.
create or replace function public.pin_register_attempt(p_user uuid, p_success boolean)
returns table (failed_attempts smallint, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.user_pin_security;
  recent_locks integer;
begin
  insert into public.user_pin_security (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into s from public.user_pin_security where user_id = p_user for update;

  if p_success then
    update public.user_pin_security
       set failed_attempts = 0, locked_until = null, last_verified_at = now(), updated_at = now()
     where user_id = p_user returning * into s;
  elsif s.locked_until is not null and s.locked_until > now() then
    -- Still locked: nothing to count, and nothing to extend.
    null;
  elsif s.failed_attempts + 1 >= 5 then
    select count(*) into recent_locks
      from public.security_events e
     where e.kind = 'pin.locked' and e.user_id = p_user and e.at > now() - interval '24 hours';
    update public.user_pin_security
       set failed_attempts = 0,
           locked_until = now() + case when recent_locks >= 2 then interval '24 hours' else interval '15 minutes' end,
           updated_at = now()
     where user_id = p_user returning * into s;
    perform public.log_security_event('pin.locked', 'high', p_user,
      jsonb_build_object('until', s.locked_until, 'previous_locks_24h', recent_locks));
  else
    update public.user_pin_security
       set failed_attempts = s.failed_attempts + 1, updated_at = now()
     where user_id = p_user returning * into s;
  end if;

  return query select s.failed_attempts, s.locked_until;
end;
$$;

create or replace function public.pin_lock_state(p_user uuid)
returns table (failed_attempts smallint, locked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.failed_attempts, s.locked_until
    from public.user_pin_security s
   where s.user_id = p_user;
$$;

revoke execute on function public.pin_register_attempt(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.pin_lock_state(uuid) from public, anon, authenticated;
grant execute on function public.pin_register_attempt(uuid, boolean) to service_role;
grant execute on function public.pin_lock_state(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- F-04 / F-10 · profiles: server-owned fields and sane limits
-- ---------------------------------------------------------------------------

-- An account writes its own row (RLS), but some fields in that row are not
-- the account's to choose:
--   email     the address Supabase Auth verified, from the signed JWT — not
--             whatever the client sends, which let one account reserve
--             another person's address (it is UNIQUE platform-wide)
--   id, created_at                       immutable after creation
--   prestataire.verified                 awarded by 242Konnect only
-- The service role (dashboard, back office) is not constrained.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    return new;
  end if;

  if jwt_email is not null then
    new.email := jwt_email;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    if jsonb_typeof(new.prestataire) = 'object' then
      new.prestataire := jsonb_set(new.prestataire, '{verified}',
        coalesce(case when jsonb_typeof(old.prestataire) = 'object' then old.prestataire -> 'verified' end,
                 'false'::jsonb));
    end if;
  else
    new.created_at := now();
    if jsonb_typeof(new.prestataire) = 'object' then
      new.prestataire := jsonb_set(new.prestataire, '{verified}', 'false'::jsonb);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles
  drop constraint if exists profiles_full_name_len,
  drop constraint if exists profiles_email_len,
  drop constraint if exists profiles_phone_format,
  drop constraint if exists profiles_place_len,
  drop constraint if exists profiles_bio_len,
  drop constraint if exists profiles_avatar_safe,
  drop constraint if exists profiles_details_size;

alter table public.profiles
  add constraint profiles_full_name_len check (length(full_name) between 2 and 120),
  add constraint profiles_email_len     check (email is null or length(email) <= 254),
  add constraint profiles_phone_format  check (phone is null or phone ~ '^[0-9]{6,15}$'),
  add constraint profiles_place_len     check (length(coalesce(city, '')) <= 120 and length(coalesce(state, '')) <= 120),
  add constraint profiles_bio_len       check (length(coalesce(bio, '')) <= 2000),
  -- Images only, inline or over https: no javascript:, no data:text/html.
  add constraint profiles_avatar_safe   check (
    avatar_url is null
    or (length(avatar_url) <= 400000
        and avatar_url ~ '^(data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+|https://[^\s"''<>]+)$')),
  add constraint profiles_details_size  check (
    pg_column_size(particulier) <= 2000000 and pg_column_size(prestataire) <= 2000000 and pg_column_size(business) <= 2000000);

-- ---------------------------------------------------------------------------
-- F-05 · provider_listings: others see approved listings only
-- ---------------------------------------------------------------------------

drop policy if exists "listings: readable when signed in" on public.provider_listings;
drop policy if exists "listings: approved, or your own" on public.provider_listings;
create policy "listings: approved, or your own" on public.provider_listings
  for select to authenticated
  using (status = 'approved' or (select auth.uid()) = id);

alter table public.provider_listings drop constraint if exists provider_listings_avatar_safe;
alter table public.provider_listings add constraint provider_listings_avatar_safe check (
  avatar_url is null
  or avatar_url ~ '^(data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+|https://[^\s"''<>]+)$');

create or replace function public.provider_listing_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- Prestataire §07: a refused profile "reçoit un motif et une possibilité de
  -- correction". Editing it is the correction, so it goes back to review —
  -- unless this very update is 242Konnect setting the status.
  if tg_op = 'UPDATE' and old.status = 'refused' and new.status = old.status then
    new.status := 'pending';
    new.refusal_reason := null;
  end if;
  -- An approved listing is visible to every client; a reason left over from
  -- an earlier refusal must not travel with it.
  if new.status = 'approved' then
    new.refusal_reason := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- F-07 · Per-user quotas
-- ---------------------------------------------------------------------------

-- Generic: TG_ARGV = (owner column, time column, window, max rows).
-- Counts the caller's own rows in the window, as the caller (RLS applies, and
-- every table here lets a user read their own rows). The service role is not
-- limited.
create or replace function public.enforce_user_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n   integer;
begin
  if uid is null then
    return new;
  end if;
  execute format('select count(*) from %s where %I = $1 and %I > now() - $2::interval',
                 tg_relid::regclass, tg_argv[0], tg_argv[1])
     into n
    using uid, tg_argv[2];
  if n >= tg_argv[3]::integer then
    raise exception 'rate_limited: too many % in %', tg_table_name, tg_argv[2]
      using errcode = 'P0001', hint = 'Réessayez plus tard.';
  end if;
  return new;
end;
$$;

create index if not exists request_messages_sender_idx on public.request_messages (sender_id, created_at);
create index if not exists consent_records_user_idx   on public.consent_records (user_id, accepted_at);
create index if not exists data_requests_user_idx     on public.data_requests (user_id, created_at);

drop trigger if exists enforce_quota on public.service_requests;
create trigger enforce_quota before insert on public.service_requests
  for each row execute function public.enforce_user_quota('client_id', 'created_at', '1 hour', '20');

drop trigger if exists enforce_quota on public.request_messages;
create trigger enforce_quota before insert on public.request_messages
  for each row execute function public.enforce_user_quota('sender_id', 'created_at', '1 minute', '20');

drop trigger if exists enforce_quota on public.consent_records;
create trigger enforce_quota before insert on public.consent_records
  for each row execute function public.enforce_user_quota('user_id', 'accepted_at', '1 day', '60');

drop trigger if exists enforce_quota on public.data_requests;
create trigger enforce_quota before insert on public.data_requests
  for each row execute function public.enforce_user_quota('user_id', 'created_at', '1 day', '5');
