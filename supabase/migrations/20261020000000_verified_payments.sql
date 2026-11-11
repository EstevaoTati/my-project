-- Verified payments (security finding F-01, Critical). Applied 2026-10-20 on
-- the founder's go-ahead; production had no service requests at the time, so
-- nothing in flight was affected.
--
-- Before: a client could declare its own payment.
--   request_action(id, 'pay', {"method":"mtn","payment_ref":"anything"})
--   moved a draft to 'sent' — "paid" — on the client's word alone. Nothing
--   checked with MTN or Airtel that money moved, nor that the amount matched.
--
-- Now only the payment service may mark a request paid, and only for the
-- exact amount, after the operator reported the collection successful:
--   - the client's 'pay' action is gone from request_action()
--   - public.payment_collections records each collection the `payment` Edge
--     Function starts. RLS on, no policies: only the service role reads or
--     writes it. The amount is copied from the request, never from the app.
--   - confirm_payment() is callable by the service role only; the function
--     calls it once the operator reports SUCCESSFUL
--   - every confirmation, mismatch and orphaned debit is in security_events
--   - a prestataire can accept only a verified payment
--
-- Until the operators' credentials are set as function secrets, the function
-- answers payments_unavailable and requests stay in 'draft': booking is paused
-- rather than unverified.

alter table public.service_requests
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_amount_confirmed integer;

create table if not exists public.payment_collections (
  -- Also the operator transaction id we send (MTN X-Reference-Id, Airtel
  -- transaction.id), so a retried call can never become a second debit.
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.service_requests (id) on delete cascade,
  client_id    uuid not null references auth.users (id) on delete cascade,
  method       text not null check (method in ('mtn', 'airtel')),
  msisdn       text not null check (msisdn ~ '^[0-9]{6,15}$'),
  amount       integer not null check (amount > 0),
  -- What the operator reports it collected (MTN does; Airtel does not). This,
  -- not the request amount, is what confirm_payment() checks.
  amount_collected integer,
  status       text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'expired')),
  operator_ref text check (length(operator_ref) <= 80),
  reason       text check (length(reason) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One live collection per request: a double tap cannot prompt twice.
create unique index if not exists payment_collections_one_live
  on public.payment_collections (request_id) where status in ('pending', 'successful');
create index if not exists payment_collections_client_recent
  on public.payment_collections (client_id, created_at desc);

alter table public.payment_collections enable row level security;
revoke all on public.payment_collections from public, anon, authenticated;
grant select, insert, update on public.payment_collections to service_role;

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

  -- Idempotent: the same collection may be confirmed more than once (a
  -- repeated poll), including after the prestataire accepted.
  if r.payment_verified_at is not null and r.payment_ref = p_operator_ref then
    return r;
  end if;
  if r.status <> 'draft' then
    -- Money was collected for a request that was cancelled, or already paid
    -- another way, while the payer typed their PIN. Kept as evidence for a
    -- manual refund; returned unchanged for the same reason as a mismatch.
    perform public.log_security_event('payment.orphaned', 'high', r.client_id,
      jsonb_build_object('request', r.id, 'status', r.status, 'amount', p_amount, 'method', p_method, 'operator_ref', p_operator_ref));
    return r;
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
