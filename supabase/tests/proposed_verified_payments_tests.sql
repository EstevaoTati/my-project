-- Tests for supabase/proposed/20261020000000_verified_payments.sql (F-01).
-- Run on the local replica after that file; rolls back.
--   PROPOSED=1 bash supabase/tests/run-local.sh
begin;
create temp table t (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on t to authenticated;
grant usage on sequence t_n_seq to authenticated;

do $$
declare
  ids uuid[] := (select array_agg(id order by created_at) from (select id, created_at from auth.users order by created_at limit 3) u);
  a uuid := ids[1]; b uuid := ids[2];
  req uuid; r record; v text;
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
  execute 'reset role';

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

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select * into r from public.request_action(req, 'accept');
  insert into t(step, ok, detail) values ('the prestataire accepts a verified payment', r.status = 'accepted', r.status);
end;
$$;

select n, ok, step, detail from t order by n;
rollback;
