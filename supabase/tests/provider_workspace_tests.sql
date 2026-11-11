-- Tests for supabase/migrations/20261021000000_provider_workspace.sql.
-- Run by supabase/tests/run-local.sh; also safe to paste into the production
-- SQL editor. Everything rolls back.
--   A: client (oldest account). B, C: two accounts with no listing yet, made
--   prestataires of the same trade and city for the test.
begin;
create temp table t (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on t to authenticated;
grant usage on sequence t_n_seq to authenticated;

do $$
declare
  a uuid := (select id from auth.users order by created_at limit 1);
  free uuid[] := (select array_agg(id order by created_at) from (
                    select u.id, u.created_at from auth.users u
                    where u.id <> (select id from auth.users order by created_at limit 1)
                      and not exists (select 1 from public.provider_listings l where l.id = u.id)
                    order by u.created_at limit 2) x);
  b uuid := free[1]; c uuid := free[2];
  req uuid; req2 uuid; req3 uuid; v text; n int; ok boolean;
  claims constant text := 'request.jwt.claims';
begin
  insert into public.provider_listings (id, full_name, trade_id, zone, city, pricing, durations, bio, status) values
    (b, 'Prestataire B', 'plombier-test', 'Mpaka', 'Pointe-Noire', null, '{hours}', 'bio', 'approved'),
    (c, 'Prestataire C', 'plombier-test', 'Tié-Tié', 'pointe-noire ', null, '{hours}', 'bio', 'approved');

  -- Availability --------------------------------------------------------
  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.provider_listings set available = false where id = b;
  select (not available)::text into v from public.provider_listings where id = b;
  update public.provider_listings set available = true where id = b;
  insert into t(step, ok, detail) values ('a prestataire switches their own availability', v = 'true', v);
  begin
    update public.provider_listings set available = false where id = c;
    get diagnostics n = row_count;
    insert into t(step, ok, detail) values ('nor someone else''s', n = 0, n::text);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('nor someone else''s', true);
  end;

  -- Open request --------------------------------------------------------
  perform set_config(claims, json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.service_requests (provider_id, trade_id, city, slot, amount, idempotency_key)
      values (null, 'plombier-test', '', 'Demain', 9000, 'open-test-0000');
    insert into t(step, ok) values ('an open request needs a city', false);
  exception when others then
    insert into t(step, ok, detail) values ('an open request needs a city', sqlerrm = 'an open request needs a city', sqlerrm);
  end;
  insert into public.service_requests (provider_id, trade_id, city, description, zone_hint, slot, amount, idempotency_key)
    values (null, 'plombier-test', 'Pointe-Noire', 'Fuite', 'Mpaka', 'Demain', 9000, 'open-test-0001') returning id into req;
  insert into public.service_request_private (request_id, address) values (req, 'Avenue Tiboti 12');
  insert into public.service_requests (provider_id, trade_id, city, slot, amount, idempotency_key)
    values (null, 'plombier-test', 'Pointe-Noire', 'Lundi', 5000, 'open-test-0002') returning id into req2;
  insert into public.service_requests (provider_id, trade_id, city, slot, amount, idempotency_key)
    values (null, 'plombier-test', 'Pointe-Noire', 'Mardi', 5000, 'open-test-0003') returning id into req3;

  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('an unpaid open request is invisible', n = 0, n::text);

  execute 'reset role';
  perform public.confirm_payment(req, 'mtn', 'MTN-OPEN-0001', 9000);
  perform public.confirm_payment(req2, 'mtn', 'MTN-OPEN-0002', 5000);
  -- req3 reaches 'sent' without a verified payment.
  update public.service_requests set status = 'sent', response_deadline = now() + interval '1 day' where id = req3;

  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.service_requests where id in (req, req2);
  insert into t(step, ok, detail) values ('a paid open request reaches an eligible prestataire', n = 2, n::text);
  select count(*) into n from public.service_request_private where request_id = req;
  insert into t(step, ok, detail) values ('the address stays hidden before acceptance', n = 0, n::text);

  perform set_config(claims, json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('the city matches whatever the case and spaces', n = 1, n::text);
  update public.provider_listings set available = false where id = c;
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('an unavailable prestataire receives nothing new', n = 0, n::text);
  update public.provider_listings set available = true where id = c;
  update public.provider_listings set trade_id = 'electricien-test' where id = c;
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('another trade receives nothing', n = 0, n::text);
  update public.provider_listings set trade_id = 'plombier-test' where id = c;

  perform set_config(claims, json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.claim_request(req) into v;
  insert into t(step, ok, detail) values ('the client cannot claim their own request', v = 'not_found', v);

  -- The race --------------------------------------------------------------
  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select public.claim_request(req) into v;
  insert into t(step, ok, detail) values ('the first prestataire to accept gets the mission', v = 'claimed', v);
  select status into v from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('the request is now accepted', v = 'accepted', v);
  select count(*) into n from public.service_request_private where request_id = req;
  insert into t(step, ok, detail) values ('the winner sees the address', n = 1, n::text);

  perform set_config(claims, json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select public.claim_request(req) into v;
  insert into t(step, ok, detail) values ('the second is told it is already assigned', v = 'already_assigned', v);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('it disappears from the second''s list', n = 0, n::text);
  select reason into v from public.request_dismissals where request_id = req;
  insert into t(step, ok, detail) values ('and stays in their History', v = 'assigned', v);

  select public.claim_request(req3) into v;
  insert into t(step, ok, detail) values ('an unverified payment cannot be claimed', v = 'not_found', v);

  perform public.dismiss_request(req2);
  select count(*) into n from public.service_requests where id = req2;
  insert into t(step, ok, detail) values ('a declined open request leaves the decliner''s list', n = 0, n::text);
  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req2;
  insert into t(step, ok, detail) values ('but not the others''', n = 1, n::text);
  select count(*) into n from public.request_dismissals;
  insert into t(step, ok, detail) values ('a History is private to its prestataire', n = 0, n::text);
  begin
    perform public.record_dismissal(r, 'declined') from public.service_requests r where r.id = req2;
    insert into t(step, ok) values ('History is written by the server only', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('History is written by the server only', true);
  end;

  -- Messages ----------------------------------------------------------------
  perform set_config(claims, json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.request_messages (request_id, body)
    values (req, 'Appelez-moi au 06 123 45 67, ou payez sur www.pay-me.cg, ou a.b@mail.cg');
  insert into public.request_messages (request_id, body) values (req, 'Le prix est de 25 000 FCFA, rendez-vous à 14h30.');
  select body, flagged::text into v, v from public.request_messages where request_id = req order by id limit 1;
  select body into v from public.request_messages where request_id = req order by id limit 1;
  ok := v not like '%123 45 67%' and v not like '%pay-me%' and v not like '%@mail%';
  ok := ok and v like 'Appelez-moi au •••, ou%';
  insert into t(step, ok, detail) values ('phone numbers, links and e-mails are masked', ok, v);
  select body into v from public.request_messages where request_id = req order by id desc limit 1;
  insert into t(step, ok, detail) values ('prices and times are not', v = 'Le prix est de 25 000 FCFA, rendez-vous à 14h30.', v);
  execute 'reset role';
  select count(*) into n from public.security_events where kind = 'message.contact_masked' and user_id = a;
  insert into t(step, ok, detail) values ('a masked message is in the security log', n = 1, n::text);

  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select unread into n from public.my_conversations() where request_id = req;
  insert into t(step, ok, detail) values ('the prestataire sees 2 unread messages', n = 2, coalesce(n::text, 'none'));
  perform public.mark_read(req);
  select unread into n from public.my_conversations() where request_id = req;
  insert into t(step, ok, detail) values ('reading clears them', n = 0, coalesce(n::text, 'none'));
  select counterpart into v from public.my_conversations() where request_id = req;
  insert into t(step, ok, detail) values ('the conversation names the client', v is not null, v);
  begin
    select count(*) into n from public.request_reads;
    insert into t(step, ok) values ('read receipts are not readable directly', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('read receipts are not readable directly', true);
  end;

  perform set_config(claims, json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.my_conversations();
  insert into t(step, ok, detail) values ('the losing prestataire has no conversation', n = 0, n::text);
  perform public.mark_read(req);
  execute 'reset role';
  select count(*) into n from public.request_reads where request_id = req and user_id = c;
  insert into t(step, ok, detail) values ('nor can they mark it read', n = 0, n::text);

  -- Directed requests still work -------------------------------------------
  perform set_config(claims, json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.service_requests (provider_id, slot, amount, idempotency_key)
    values (b, 'Jeudi', 7000, 'open-test-0004') returning id into req;
  select city || '|' || trade_id into v from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('a directed request takes the prestataire''s trade and city', v = 'Pointe-Noire|plombier-test', v);
  execute 'reset role';
end;
$$;

select n, ok, step, detail from t order by n;
rollback;
