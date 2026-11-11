-- Tests for supabase/migrations/20261020000000_verified_payments.sql (F-01).
-- Run by supabase/tests/run-local.sh; also safe to paste into the production
-- SQL editor. Everything rolls back.
begin;
create temp table t (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on t to authenticated;
grant usage on sequence t_n_seq to authenticated;

do $$
declare
  ids uuid[] := (select array_agg(id order by created_at) from (select id, created_at from auth.users order by created_at limit 3) u);
  a uuid := ids[1];
  -- The prestataire: an account with no listing yet, so a real one is never touched.
  b uuid := (select u.id from auth.users u where u.id <> ids[1]
              and not exists (select 1 from public.provider_listings l where l.id = u.id) order by u.created_at limit 1);
  req uuid; req2 uuid; r record; v text; n int;
begin
  insert into public.provider_listings (id, full_name, trade_id, zone, city, pricing, durations, bio, status)
    values (b, 'Test B', 'plombier', 'Mpaka', 'Pointe-Noire', '{"model":"hourly","amount":9000}', '{hours}', 'bio', 'approved');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.service_requests (provider_id, slot, amount, idempotency_key)
    values (b, 'Demain', 9000, 'pay-test-0001') returning id into req;

  begin
    perform public.request_action(req, 'pay', '{"method":"mtn","payment_ref":"I-promise"}');
    insert into t(step, ok) values ('the client can no longer declare a payment', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('the client can no longer declare a payment', true);
  end;
  begin
    perform public.confirm_payment(req, 'mtn', 'FAKE-REF-1', 9000);
    insert into t(step, ok) values ('the client cannot call confirm_payment', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('the client cannot call confirm_payment', true);
  end;
  begin
    select count(*) into n from public.payment_collections;
    insert into t(step, ok) values ('the client cannot read payment collections', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('the client cannot read payment collections', true);
  end;
  begin
    insert into public.payment_collections (request_id, client_id, method, msisdn, amount, status)
      values (req, a, 'mtn', '242061234567', 1, 'successful');
    insert into t(step, ok) values ('the client cannot forge a collection', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('the client cannot forge a collection', true);
  end;
  insert into public.service_requests (provider_id, slot, amount, idempotency_key)
    values (b, 'Demain', 9000, 'pay-test-0002') returning id into req2;
  perform public.request_action(req2, 'cancel');
  execute 'reset role';

  -- A request that reaches 'sent' some other way still cannot be accepted.
  update public.service_requests set status = 'sent', response_deadline = now() + interval '1 day' where id = req2;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.request_action(req2, 'accept');
    insert into t(step, ok) values ('an unverified payment cannot be accepted', false);
  exception when others then
    insert into t(step, ok, detail) values ('an unverified payment cannot be accepted', sqlerrm = 'payment not verified', sqlerrm);
  end;
  execute 'reset role';
  update public.service_requests set status = 'cancelled' where id = req2;

  -- The payment service, after the operator reported SUCCESSFUL:
  select * into r from public.confirm_payment(req, 'mtn', 'MTN-REF-0001', 100);
  insert into t(step, ok, detail) values ('a wrong amount leaves it unpaid', r.status = 'draft' and r.payment_verified_at is null, r.status);
  select * into r from public.confirm_payment(req, 'mtn', 'MTN-REF-0001', 9000);
  insert into t(step, ok, detail) values ('the right amount marks it paid and verified',
    r.status = 'sent' and r.payment_verified_at is not null, r.status);
  select * into r from public.confirm_payment(req, 'mtn', 'MTN-REF-0001', 9000);
  insert into t(step, ok) values ('a repeated operator callback is a no-op', r.status = 'sent');
  select string_agg(kind, ',' order by id) into v from public.security_events where kind like 'payment.%' and at > now() - interval '1 minute';
  insert into t(step, ok, detail) values ('both outcomes are in the security log', v = 'payment.amount_mismatch,payment.confirmed', v);
  select * into r from public.confirm_payment(req2, 'mtn', 'MTN-REF-0002', 9000);
  select count(*) into n from public.security_events where kind = 'payment.orphaned' and detail ->> 'request' = req2::text;
  insert into t(step, ok, detail) values ('money collected for a cancelled request is flagged, not applied',
    r.status = 'cancelled' and n = 1, r.status || ' / ' || n);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select * into r from public.request_action(req, 'accept');
  insert into t(step, ok, detail) values ('the prestataire accepts a verified payment', r.status = 'accepted', r.status);
  execute 'reset role';
  select * into r from public.confirm_payment(req, 'mtn', 'MTN-REF-0001', 9000);
  select count(*) into n from public.security_events where kind = 'payment.orphaned' and detail ->> 'request' = req::text;
  insert into t(step, ok, detail) values ('a repeat confirmation after acceptance is a quiet no-op', r.status = 'accepted' and n = 0, r.status || ' / ' || n);
end;
$$;

select n, ok, step, detail from t order by n;
rollback;
