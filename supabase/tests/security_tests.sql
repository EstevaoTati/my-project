-- 242Konnect — adversarial security tests for the database.
--
-- Runs as three real accounts — A (client), B (prestataire), C (stranger),
-- the three oldest rows of auth.users — plus anon and the service role, inside
-- a transaction that ROLLS BACK: nothing it creates or changes persists, so it
-- is safe to run against production.
--
-- Usage: paste into the Supabase SQL editor, or the MCP execute_sql tool.
-- Every row of the result must read ok = true. Requires the migration
-- 20261019120000_security_hardening.sql.

begin;
create temp table t (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on t to authenticated, anon;
grant usage on sequence t_n_seq to authenticated, anon;

do $$
declare
  ids uuid[] := (select array_agg(id order by created_at)
                   from (select id, created_at from auth.users order by created_at limit 3) u);
  a uuid := ids[1]; b uuid := ids[2]; c uuid := ids[3];
  a_email text := (select lower(email) from auth.users where id = ids[1]);
  req uuid; n int; v text; j jsonb; ok boolean; i int;
  st record;
begin
  if c is null then
    raise exception 'needs three users in auth.users';
  end if;

  -- Known starting state for the three accounts, inside the rolled-back tx.
  delete from public.service_requests where client_id in (a, b, c) or provider_id in (a, b, c);
  delete from public.provider_listings where id in (a, b, c);
  delete from public.user_pin_security where user_id = a;
  insert into public.profiles (id, email, phone, phone_country, full_name, country, city, profiles, active_profile)
    values (a, a_email, '242000000981', 'CG', 'Test A', 'CG', 'Pointe-Noire', array['particulier'], 'particulier')
    on conflict (id) do nothing;

  ---------------------------------------------------------------------------
  -- Anonymous caller: nothing private is reachable
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  foreach v in array array['profiles', 'provider_listings', 'service_requests', 'service_request_private',
                           'request_messages', 'consent_records', 'data_requests', 'user_pin',
                           'user_pin_security', 'security_events'] loop
    begin
      execute format('select count(*) from public.%I', v) into n;
      insert into t(step, ok, detail) values ('anon reads nothing from ' || v, n = 0, n::text);
    exception when insufficient_privilege then
      insert into t(step, ok) values ('anon reads nothing from ' || v, true);
    when undefined_table then
      insert into t(step, ok, detail) values ('anon reads nothing from ' || v, true, 'table absent');
    end;
  end loop;
  foreach v in array array['rls_auto_enable()', 'purge_security_events()', 'pin_lock_state(''' || a || ''')'] loop
    begin
      execute 'select public.' || v;
      insert into t(step, ok) values ('anon cannot call ' || v, false);
    exception when insufficient_privilege then
      insert into t(step, ok) values ('anon cannot call ' || v, true);
    when undefined_function then
      insert into t(step, ok, detail) values ('anon cannot call ' || v, false, 'function missing');
    when others then
      -- Got past the privilege check: the call was allowed.
      insert into t(step, ok, detail) values ('anon cannot call ' || v, false, 'callable: ' || sqlerrm);
    end;
  end loop;
  execute 'reset role';

  ---------------------------------------------------------------------------
  -- Signed in as A
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'email', a_email)::text, true);
  execute 'set local role authenticated';

  -- Secrets and the security log are not reachable with a user token.
  foreach v in array array['user_pin', 'user_pin_security', 'security_events'] loop
    begin
      execute format('select count(*) from public.%I', v) into n;
      insert into t(step, ok, detail) values ('A reads nothing from ' || v, n = 0, n::text);
    exception when insufficient_privilege then
      insert into t(step, ok) values ('A reads nothing from ' || v, true);
    when undefined_table then
      insert into t(step, ok, detail) values ('A reads nothing from ' || v, true, 'table absent');
    end;
  end loop;
  foreach v in array array['rls_auto_enable()', 'pin_register_attempt(''' || a || ''', true)',
                           'log_security_event(''forged.event'')', 'purge_security_events()'] loop
    begin
      execute 'select public.' || v;
      insert into t(step, ok) values ('A cannot call ' || v, false);
    exception when insufficient_privilege then
      insert into t(step, ok) values ('A cannot call ' || v, true);
    when undefined_function then
      insert into t(step, ok, detail) values ('A cannot call ' || v, false, 'function missing');
    when others then
      -- Got past the privilege check: the call was allowed.
      insert into t(step, ok, detail) values ('A cannot call ' || v, false, 'callable: ' || sqlerrm);
    end;
  end loop;

  -- Own row only (BOLA).
  select count(*) into n from public.profiles;
  insert into t(step, ok, detail) values ('A sees only their own profile', n = 1, n::text);
  update public.profiles set full_name = 'Pwned' where id = b;
  get diagnostics n = row_count;
  insert into t(step, ok, detail) values ('A cannot update B''s profile', n = 0, n::text);

  -- Server-owned fields (mass assignment), each tried on its own.
  update public.profiles set email = 'someone.else@example.test' where id = a;
  select email into v from public.profiles where id = a;
  insert into t(step, ok, detail) values ('A cannot squat another e-mail', v = a_email, v);

  begin
    update public.profiles set id = b where id = a;
    select count(*) into n from public.profiles where id = a;
    insert into t(step, ok, detail) values ('A cannot change their id', n = 1, n::text);
  exception when others then
    insert into t(step, ok, detail) values ('A cannot change their id', true, sqlerrm);
  end;

  update public.profiles set created_at = '2000-01-01' where id = a;
  select (created_at > '2001-01-01')::text into v from public.profiles where id = a;
  insert into t(step, ok, detail) values ('A cannot backdate created_at', v = 'true', v);

  update public.profiles set prestataire = '{"tradeId":"plombier","verified":true}' where id = a;
  select coalesce(prestataire ->> 'verified', 'null') into v from public.profiles where id = a;
  insert into t(step, ok, detail) values ('A cannot self-verify as prestataire', v <> 'true', v);

  -- Unsafe avatar values are refused.
  begin
    update public.profiles set avatar_url = 'javascript:alert(1)' where id = a;
    insert into t(step, ok) values ('javascript: avatar refused', false);
  exception when check_violation then
    insert into t(step, ok) values ('javascript: avatar refused', true);
  end;
  begin
    update public.profiles set avatar_url = 'data:text/html;base64,PHNjcmlwdD4=' where id = a;
    insert into t(step, ok) values ('data:text/html avatar refused', false);
  exception when check_violation then
    insert into t(step, ok) values ('data:text/html avatar refused', true);
  end;

  ---------------------------------------------------------------------------
  -- Listings: pending ones are private to their owner
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.provider_listings (id, full_name, trade_id, zone, city, pricing, durations, bio)
    values (b, 'Test B', 'plombier', 'Mpaka', 'Pointe-Noire', '{"model":"hourly","amount":9000}', '{hours}', 'bio');
  select count(*) into n from public.provider_listings where id = b;
  insert into t(step, ok, detail) values ('B sees their own pending listing', n = 1, n::text);
  begin
    update public.provider_listings set status = 'approved' where id = b;
    insert into t(step, ok) values ('B cannot self-approve', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('B cannot self-approve', true);
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'email', a_email)::text, true);
  select count(*) into n from public.provider_listings where id = b;
  insert into t(step, ok, detail) values ('A cannot see B''s pending listing', n = 0, n::text);

  execute 'reset role';
  update public.provider_listings set status = 'refused', refusal_reason = 'Pièce illisible' where id = b;
  update public.provider_listings set status = 'approved' where id = b;
  select refusal_reason into v from public.provider_listings where id = b;
  insert into t(step, ok, detail) values ('approval clears the refusal reason', v is null, coalesce(v, 'null'));
  execute 'set local role authenticated';
  select count(*) into n from public.provider_listings where id = b;
  insert into t(step, ok, detail) values ('A sees B once approved', n = 1, n::text);

  ---------------------------------------------------------------------------
  -- Requests: isolation between parties, and quotas
  ---------------------------------------------------------------------------
  insert into public.service_requests (provider_id, description, zone_hint, slot, amount, idempotency_key)
    values (b, 'Fuite', 'Mpaka', 'Demain 09h', 9000, 'sec-test-0000') returning id into req;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('C cannot see A''s request', n = 0, n::text);
  begin
    perform public.request_action(req, 'cancel');
    insert into t(step, ok) values ('C cannot act on A''s request', false);
  exception when others then
    insert into t(step, ok, detail) values ('C cannot act on A''s request', true, sqlerrm);
  end;
  begin
    insert into public.service_request_private (request_id, address) values (req, 'Adresse de C');
    insert into t(step, ok) values ('C cannot attach an address to A''s request', false);
  exception when others then
    insert into t(step, ok) values ('C cannot attach an address to A''s request', true);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('B cannot see A''s unpaid draft', n = 0, n::text);

  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'email', a_email)::text, true);
  ok := false;
  begin
    for i in 1..25 loop
      insert into public.service_requests (provider_id, slot, amount, idempotency_key)
        values (b, 'Demain', 9000, 'sec-test-' || lpad(i::text, 4, '0'));
    end loop;
  exception when others then
    ok := sqlerrm like 'rate_limited%';
    insert into t(step, ok, detail) values ('request quota stops a flood', ok, sqlerrm);
  end;
  if not ok and not exists (select 1 from t where step = 'request quota stops a flood') then
    insert into t(step, ok, detail) values ('request quota stops a flood', false, '25 inserted');
  end if;

  begin
    for i in 1..6 loop
      insert into public.data_requests (kind, details) values ('correction', 'test ' || i);
    end loop;
    insert into t(step, ok) values ('data request quota', false);
  exception when others then
    insert into t(step, ok, detail) values ('data request quota', sqlerrm like 'rate_limited%', sqlerrm);
  end;

  execute 'reset role';

  ---------------------------------------------------------------------------
  -- PIN lock state (service role, as the Edge Function calls it)
  ---------------------------------------------------------------------------
  if to_regprocedure('public.pin_register_attempt(uuid, boolean)') is null
     or to_regclass('public.security_events') is null then
    insert into t(step, ok, detail) values
      ('PIN lock state is shared and persistent', false, 'pin_register_attempt() missing'),
      ('the lock is in the security log', false, 'security_events missing');
  else
    for i in 1..4 loop
      execute 'select * from public.pin_register_attempt($1, false)' into st using a;
    end loop;
    insert into t(step, ok, detail) values ('4 wrong PINs: not locked yet', st.locked_until is null, st.failed_attempts::text);
    execute 'select * from public.pin_register_attempt($1, false)' into st using a;
    insert into t(step, ok, detail) values ('5th wrong PIN locks for ~15 min',
      st.locked_until between now() + interval '14 minutes' and now() + interval '16 minutes', st.locked_until::text);
    execute 'select * from public.pin_register_attempt($1, true)' into st using a;
    insert into t(step, ok) values ('a correct PIN clears the lock', st.locked_until is null and st.failed_attempts = 0);
    execute $q$select count(*) from public.security_events where kind = 'pin.locked' and user_id = $1 and at > now() - interval '1 minute'$q$ into n using a;
    insert into t(step, ok, detail) values ('the lock is in the security log', n >= 1, n::text);

    -- Evidence cannot be rewritten.
    begin
      execute $q$update public.security_events set severity = 'info' where user_id = $1$q$ using a;
      insert into t(step, ok) values ('security log is append-only', false);
    exception when insufficient_privilege then
      insert into t(step, ok) values ('security log is append-only', true);
    end;
  end if;
end;
$$;

select n, ok, step, detail from t order by n;
rollback;
