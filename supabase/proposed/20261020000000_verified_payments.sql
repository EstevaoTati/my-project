-- PROPOSED — not in supabase/migrations on purpose. Needs a product decision
-- before it is applied, because it changes the live booking flow.
--
-- F-01 (Critical): a client can declare its own payment.
--   request_action(id, 'pay', {"method":"mtn","payment_ref":"anything"})
--   moves a draft to 'sent' — "paid" — on the client's word alone. Nothing
--   checks with MTN, Airtel or a card processor that money moved, nor that the
--   amount matches. The request then reaches the prestataire as a paid job.
--   Today no real money flows, so the damage is fake paid jobs; the day escrow
--   goes live it is theft of service.
--
-- Fix: only a trusted server may mark a request paid, and only for the exact
-- amount, after the operator confirmed the collection.
--   - the client's 'pay' action is removed from request_action()
--   - confirm_payment() is callable by the service role only — the payment
--     backend (242konnect-api, or an Edge Function receiving the operator's
--     callback) calls it once the collection is SUCCESSFUL
--   - every confirmation is in public.security_events
--
-- Consequence: until a payment backend is deployed with operator credentials,
-- no request can leave 'draft'. Applying this before that switches booking
-- off. See docs/security/assessment.md, F-01, for the interim option.

alter table public.service_requests
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_amount_confirmed integer;

create or replace function public.confirm_payment(
  p_request     uuid,
  p_method      text,
  p_operator_ref text,
  p_amount      integer
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.service_requests;
begin
  if coalesce(p_method, '') not in ('mtn', 'airtel', 'carte', 'virement') then
    raise exception 'unknown payment method' using errcode = '22023';
  end if;
  if coalesce(length(p_operator_ref), 0) not between 4 and 80 then
    raise exception 'operator reference required' using errcode = '22023';
  end if;

  select * into r from public.service_requests where id = p_request for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  -- Idempotent: the operator may call back more than once for one collection.
  if r.status = 'sent' and r.payment_ref = p_operator_ref then
    return r;
  end if;
  if r.status <> 'draft' then
    raise exception 'request is not awaiting payment' using errcode = '22023';
  end if;
  if p_amount is distinct from r.amount then
    -- Logged and returned unchanged rather than raised: an exception would roll
    -- the security event back with it, and this is exactly the evidence an
    -- investigation needs. The caller sees status still 'draft'.
    perform public.log_security_event('payment.amount_mismatch', 'high', r.client_id,
      jsonb_build_object('request', r.id, 'expected', r.amount, 'received', p_amount, 'method', p_method));
    return r;
  end if;

  update public.service_requests
     set status = 'sent', payment_method = p_method, payment_ref = p_operator_ref,
         paid_at = now(), payment_verified_at = now(), payment_amount_confirmed = p_amount,
         response_deadline = now() + interval '24 hours', updated_at = now()
   where id = r.id
  returning * into r;

  perform public.log_security_event('payment.confirmed', 'info', r.client_id,
    jsonb_build_object('request', r.id, 'amount', p_amount, 'method', p_method));
  return r;
end;
$$;

revoke execute on function public.confirm_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, text, integer) to service_role;

-- request_action() without the client 'pay' branch. Everything else is
-- unchanged from the live version (marketplace migration).
create or replace function public.request_action(p_request uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  r      public.service_requests;
  stages text[] := array['accepted', 'on_the_way', 'arrived', 'in_progress', 'completed'];
  nxt    text;
  is_client   boolean;
  is_provider boolean;
  expired     boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select * into r from public.service_requests where id = p_request for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  is_client := r.client_id = uid;
  is_provider := r.provider_id = uid and r.status <> 'draft';
  if not is_client and not is_provider then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  expired := r.status = 'sent' and r.response_deadline < now();

  if is_client and p_action = 'pay' then
    raise exception 'payments are confirmed by the payment service, not by the app' using errcode = '42501';
  elsif is_client and p_action = 'cancel' then
    if r.status = 'draft' then
      update public.service_requests set status = 'cancelled', cancelled_at = now(), refund_status = 'none', updated_at = now()
      where id = r.id returning * into r;
    elsif r.status in ('sent', 'refused') then
      update public.service_requests set status = 'cancelled', cancelled_at = now(), refund_status = 'full', updated_at = now()
      where id = r.id returning * into r;
    elsif r.status = 'accepted' then
      update public.service_requests set status = 'cancelled', cancelled_at = now(), refund_status = 'under_review', updated_at = now()
      where id = r.id returning * into r;
    else
      raise exception 'this request can no longer be cancelled' using errcode = '22023';
    end if;
  elsif is_client and p_action = 'validate' then
    if r.status <> 'accepted' or r.stage is distinct from 'completed' then
      raise exception 'only a completed mission can be approved' using errcode = '22023';
    end if;
    update public.service_requests set status = 'validated', validated_at = now(), updated_at = now()
    where id = r.id returning * into r;
  elsif is_client and p_action = 'dispute' then
    if r.status <> 'accepted' then
      raise exception 'only an accepted mission can be disputed' using errcode = '22023';
    end if;
    if coalesce(p_payload ->> 'reason', '') = ''
       or coalesce(p_payload ->> 'outcome', '') not in ('redo', 'partial_refund', 'full_refund') then
      raise exception 'a dispute needs a reason and a requested outcome' using errcode = '22023';
    end if;
    update public.service_requests set status = 'disputed',
      dispute = jsonb_build_object('reason', left(p_payload ->> 'reason', 120), 'outcome', p_payload ->> 'outcome',
        'details', left(coalesce(p_payload ->> 'details', ''), 2000), 'at', now()),
      updated_at = now()
    where id = r.id returning * into r;
  elsif is_provider and p_action = 'accept' then
    if r.status <> 'sent' or expired then
      raise exception 'this request can no longer be accepted' using errcode = '22023';
    end if;
    if r.payment_verified_at is null then
      raise exception 'payment not verified' using errcode = '22023';
    end if;
    if not exists (select 1 from public.provider_listings l where l.id = uid and l.status = 'approved') then
      raise exception 'your profile is not approved yet' using errcode = '22023';
    end if;
    update public.service_requests set status = 'accepted', stage = 'accepted', accepted_at = now(), decided_at = now(),
      stage_at = jsonb_build_object('accepted', now()), updated_at = now()
    where id = r.id returning * into r;
  elsif is_provider and p_action = 'decline' then
    if r.status <> 'sent' then
      raise exception 'this request can no longer be declined' using errcode = '22023';
    end if;
    update public.service_requests set status = 'refused', decided_at = now(), updated_at = now()
    where id = r.id returning * into r;
  elsif is_provider and p_action = 'advance' then
    if r.status <> 'accepted' or r.stage = 'completed' then
      raise exception 'nothing to advance' using errcode = '22023';
    end if;
    nxt := stages[array_position(stages, r.stage) + 1];
    update public.service_requests set stage = nxt, stage_at = stage_at || jsonb_build_object(nxt, now()), updated_at = now()
    where id = r.id returning * into r;
  else
    raise exception 'action not allowed' using errcode = '42501';
  end if;
  return r;
end;
$$;

revoke execute on function public.request_action(uuid, text, jsonb) from public, anon;
grant execute on function public.request_action(uuid, text, jsonb) to authenticated;
