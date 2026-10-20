-- The marketplace's rules, proved against the database as three real users:
-- A (client), B (prestataire: the oldest account with no listing), C (stranger).
--
-- Runs inside a transaction and ROLLS BACK, so it is safe against production:
-- the listing, request, address and message it creates never persist.
-- Every row of the result should read ok = true.
--
--   Supabase SQL editor, or the MCP execute_sql tool, with this file's contents.

begin;
create temp table t (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on t to authenticated;
grant usage on sequence t_n_seq to authenticated;

do $$
declare
  ids uuid[] := (select array_agg(id order by created_at) from (select id, created_at from auth.users order by created_at limit 3) u);
  a uuid := ids[1];
  -- B must have no listing yet, so a real prestataire's listing is never touched.
  b uuid := (select u.id from auth.users u where u.id <> ids[1]
              and not exists (select 1 from public.provider_listings l where l.id = u.id) order by u.created_at limit 1);
  c uuid := (select u.id from auth.users u where u.id not in (ids[1], b) order by u.created_at limit 1);
  req uuid; r record; n int; v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.provider_listings (id, full_name, trade_id, zone, city, pricing, durations, bio)
    values (b, 'Test Prestataire', 'plombier', 'Mpaka', 'Pointe-Noire', '{"model":"hourly","amount":9000}', '{hours}', 'bio');
  insert into t(step, ok) values ('B creates own listing', true);
  begin
    update public.provider_listings set status = 'approved' where id = b;
    insert into t(step, ok, detail) values ('B cannot self-approve', false, 'update allowed');
  exception when insufficient_privilege then
    insert into t(step, ok) values ('B cannot self-approve', true);
  end;
  select status into v from public.provider_listings where id = b;
  insert into t(step, ok, detail) values ('listing starts pending', v = 'pending', v);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.service_requests (provider_id, slot, amount, idempotency_key) values (b, 'Demain', 9000, 'key-pending-0001');
    insert into t(step, ok) values ('pending prestataire not bookable', false);
  exception when others then
    insert into t(step, ok, detail) values ('pending prestataire not bookable', true, sqlerrm);
  end;

  execute 'reset role';
  update public.provider_listings set status = 'approved' where id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.service_requests (provider_id, description, zone_hint, slot, amount, idempotency_key)
    values (b, 'Fuite', 'Mpaka', 'Demain 09h', 9000, 'key-approved-0001') returning id into req;
  insert into public.service_request_private (request_id, address) values (req, 'Avenue Tiboti 12');
  select status, client_id = a as own into r from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('A drafts a request', r.status = 'draft' and r.own, r.status);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('B cannot see an unpaid draft', n = 0, n::text);
  begin
    perform public.request_action(req, 'accept');
    insert into t(step, ok) values ('B cannot accept a draft', false);
  exception when others then
    insert into t(step, ok, detail) values ('B cannot accept a draft', true, sqlerrm);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.request_action(req, 'pay', '{"method":"carte","payment_ref":"242K-TEST01"}');
    insert into t(step, ok) values ('A cannot declare its own payment', false);
  exception when others then
    insert into t(step, ok, detail) values ('A cannot declare its own payment', true, sqlerrm);
  end;
  -- The payment service, once the operator reported the collection successful.
  execute 'reset role';
  perform public.confirm_payment(req, 'mtn', 'MTN-TEST-0001', 9000);
  perform public.confirm_payment(req, 'mtn', 'MTN-TEST-0001', 9000);
  select status into v from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('payment confirmed once; replay is a no-op', v = 'sent', v);
  perform public.confirm_payment(req, 'mtn', 'MTN-TEST-0002', 9000);
  select payment_ref into v from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('a second, different payment does not replace the first', v = 'MTN-TEST-0001', v);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.request_action(req, 'validate');
    insert into t(step, ok) values ('A cannot release funds before completion', false);
  exception when others then
    insert into t(step, ok, detail) values ('A cannot release funds before completion', true, sqlerrm);
  end;
  begin
    perform public.request_action(req, 'accept');
    insert into t(step, ok) values ('A cannot accept on B''s behalf', false);
  exception when others then
    insert into t(step, ok, detail) values ('A cannot accept on B''s behalf', true, sqlerrm);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok) values ('B sees the paid request', n = 1);
  select count(*) into n from public.service_request_private where request_id = req;
  insert into t(step, ok, detail) values ('address hidden before acceptance', n = 0, n::text);
  insert into public.request_messages (request_id, body) values (req, 'Bonjour, je peux passer demain.');
  insert into t(step, ok) values ('B can message on a sent request', true);

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('stranger sees no request', n = 0, n::text);
  select count(*) into n from public.request_messages where request_id = req;
  insert into t(step, ok, detail) values ('stranger sees no messages', n = 0, n::text);
  begin
    perform public.request_action(req, 'cancel');
    insert into t(step, ok) values ('stranger cannot act', false);
  exception when others then
    insert into t(step, ok, detail) values ('stranger cannot act', true, sqlerrm);
  end;
  begin
    insert into public.request_messages (request_id, body) values (req, 'spam');
    insert into t(step, ok) values ('stranger cannot post', false);
  exception when others then
    insert into t(step, ok, detail) values ('stranger cannot post', true, sqlerrm);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.request_action(req, 'accept');
  select address into v from public.service_request_private where request_id = req;
  insert into t(step, ok, detail) values ('address revealed after acceptance', v = 'Avenue Tiboti 12', v);
  perform public.request_action(req, 'advance');
  perform public.request_action(req, 'advance');
  perform public.request_action(req, 'advance');
  perform public.request_action(req, 'advance');
  select stage, (select count(*) from jsonb_object_keys(stage_at)) as k into r from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('stages advance to completed, each timestamped', r.stage = 'completed' and r.k = 5, r.stage);
  begin
    perform public.request_action(req, 'validate');
    insert into t(step, ok) values ('B cannot release funds to themselves', false);
  exception when others then
    insert into t(step, ok, detail) values ('B cannot release funds to themselves', true, sqlerrm);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.request_action(req, 'validate');
  select status into v from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('A approves and releases', v = 'validated', v);
  begin
    update public.service_requests set status = 'sent' where id = req;
    insert into t(step, ok) values ('no direct UPDATE on requests', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('no direct UPDATE on requests', true);
  end;
  begin
    delete from public.service_requests where id = req;
    insert into t(step, ok) values ('no DELETE on requests', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('no DELETE on requests', true);
  end;
  begin
    insert into public.service_requests (provider_id, slot, amount, idempotency_key, duration) values (b, 'Lundi', 9000, 'key-long-00001', 'months');
    insert into t(step, ok) values ('long project needs a contract', false);
  exception when others then
    insert into t(step, ok, detail) values ('long project needs a contract', true, sqlerrm);
  end;
  execute 'reset role';
end $$;

select step, ok, detail from t order by n;
rollback;
