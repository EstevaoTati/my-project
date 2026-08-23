-- MWINDA DIGITAL — data retention
--
-- `leads` holds personal data (name, email, message). Storing it indefinitely
-- is neither necessary nor defensible: docs/supabase-setup.md promises short
-- retention, and nothing enforced it. This makes the promise real.
--
-- Run once in the Supabase SQL editor, after 0001_init.sql.

-- 1. Erasure on request (GDPR art. 17) without hand-written SQL.
create or replace function public.erase_lead(p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed integer;
begin
  delete from public.leads where lower(email) = lower(p_email);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Revoking from anon and authenticated is NOT enough: Postgres grants EXECUTE
-- on every new function to PUBLIC, and that grant is what PostgREST honours at
-- /rest/v1/rpc/erase_lead. Without the PUBLIC revoke, anyone holding the anon
-- key — which is public by design — could delete a customer's record.
revoke execute on function public.erase_lead(text) from public, anon, authenticated;

-- 2. Retention. Eighteen months is long enough for a sales cycle and short
--    enough to defend. Call it from a scheduled job, or run it periodically.
create or replace function public.purge_expired()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.leads  where created_at < now() - interval '18 months';
  delete from public.events where created_at < now() - interval '12 months';
end;
$$;

-- Same reasoning as above: without the PUBLIC revoke this is a mass-deletion
-- button any visitor can press.
revoke execute on function public.purge_expired() from public, anon, authenticated;

-- Scheduled in 0004_reference_refresh.sql via pg_cron, alongside the reference
-- data refresh. Until that migration runs, this function exists but nothing
-- calls it — and the retention promise on the contact form is not being kept.
