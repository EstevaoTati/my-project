-- The parts of a Supabase project the 242Konnect migrations rely on, rebuilt
-- on a plain PostgreSQL so the security tests can run anywhere — locally, in
-- CI — without touching the live database.
--
-- Mirrors the platform's behaviour that matters for security:
--   roles anon / authenticated / service_role (the last bypasses RLS)
--   auth.uid() and auth.jwt() read the request's JWT claims, like PostgREST
--   new tables in public are granted to nobody but the service role
--   new functions are executable by PUBLIC unless revoked
--   rls_auto_enable(): the SECURITY DEFINER event-trigger helper present in
--   the live project
-- Roles are cluster-wide, so they may exist from an earlier run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now(),
  raw_app_meta_data jsonb default '{}'::jsonb
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

-- Tables: in the live project new tables in public are NOT granted to anon
-- or authenticated (that is why public.profiles once refused every write), so
-- each migration grants what it needs. Only the service role gets them all.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- pg_cron stand-in: enough for cron.schedule / cron.unschedule / cron.job.
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create function cron.unschedule(p_name text) returns boolean language sql as $$
  with d as (delete from cron.job where jobname = p_name returning 1) select exists (select 1 from d)
$$;

create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
             where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
               and object_type in ('table', 'partitioned table') loop
    if cmd.schema_name = 'public' then
      execute format('alter table if exists %s enable row level security', cmd.object_identity);
    end if;
  end loop;
end;
$$;
grant execute on function public.rls_auto_enable() to anon, authenticated;
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
