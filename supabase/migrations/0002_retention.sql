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

revoke all on function public.erase_lead(text) from anon, authenticated;

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

revoke all on function public.purge_expired() from anon, authenticated;

-- If pg_cron is available on your plan, schedule it:
--   select cron.schedule('mwinda-purge', '0 3 * * 0', 'select public.purge_expired()');
-- Otherwise call it manually, or from a scheduled Netlify function.
