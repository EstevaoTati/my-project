-- Proves that a signed-in user can write their own profile row and nobody
-- else's, after the grant in
-- supabase/migrations/20260910012311_grant_authenticated_access_to_profiles.sql.
--
-- Run it against the project (Supabase SQL editor, or the MCP execute_sql
-- tool). Everything happens inside a transaction that rolls back, so it writes
-- nothing. It raises on failure rather than returning a row, so a green run is
-- an actual assertion and not something to eyeball.
--
-- Why this exists: the table had correct RLS policies and *no table grants*,
-- which fails closed in a way that looks exactly like a policy problem. Anyone
-- tempted to "fix" a future permission error by loosening the policies should
-- run this first and see that the policies are not the thing standing in the
-- way.
--
-- `profiles.id` is a foreign key to `auth.users`, so the check borrows two real
-- user ids rather than inventing them. It needs at least two users to exist and
-- says so plainly if they do not.
begin;

do $$
declare
  me            uuid;
  someone_else  uuid;
  refused       boolean;
  visible       integer;
begin
  select id into me           from auth.users order by created_at limit 1;
  select id into someone_else from auth.users where id <> me order by created_at limit 1;

  if me is null or someone_else is null then
    raise notice 'SKIPPED: needs two users in auth.users to test isolation';
    return;
  end if;

  -- Any row this user already has would make the counts ambiguous.
  delete from public.profiles where id in (me, someone_else);

  set local role authenticated;
  perform set_config('request.jwt.claims',
                     format('{"sub":"%s","role":"authenticated"}', me), true);

  ---------------------------------------------------------------------------
  -- 1. The caller can create their own row. This is the write that sign-up and
  --    the launch-time reconciliation perform.
  ---------------------------------------------------------------------------
  insert into public.profiles
    (id, email, phone, phone_country, full_name, country, city,
     profiles, active_profile)
  values (me, 'rls-check@example.test', '242000000901', 'CG', 'RLS check',
          'CG', 'Pointe-Noire', array['particulier']::text[], 'particulier');

  ---------------------------------------------------------------------------
  -- 2. And update it, which is what a profile edit does.
  ---------------------------------------------------------------------------
  update public.profiles set full_name = 'RLS check, edited' where id = me;
  if not found then
    raise exception 'FAIL: a signed-in user could not update their own row';
  end if;

  ---------------------------------------------------------------------------
  -- 3. They see their own row and only their own.
  ---------------------------------------------------------------------------
  select count(*) into visible from public.profiles;
  if visible <> 1 then
    raise exception 'FAIL: expected to see exactly 1 row, saw %', visible;
  end if;

  ---------------------------------------------------------------------------
  -- 4. Writing somebody else's row is refused. The role now holds the INSERT
  --    privilege, so this is the policy's WITH CHECK doing the work — the
  --    property the grant must not have weakened.
  ---------------------------------------------------------------------------
  begin
    insert into public.profiles
      (id, email, phone, phone_country, full_name, country, city,
       profiles, active_profile)
    values (someone_else, 'not-mine@example.test', '242000000902', 'CG',
            'Not mine', 'CG', 'Pointe-Noire',
            array['particulier']::text[], 'particulier');
    refused := false;
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then
    raise exception 'FAIL: a signed-in user could write another user''s profile';
  end if;

  raise notice 'PASS: own row readable, writable and updatable; other rows refused';
end $$;

rollback;
