-- The prestataire's workspace (docs/242konnect-prestataire-v1-plan.md, phase 1).
--
-- 1. Availability: a prestataire who is not available keeps their missions
--    but receives no new open requests (Jobs §1.1).
-- 2. Open requests: a client may address a request to every eligible
--    prestataire — same trade, same city, approved and available — instead of
--    to one. provider_id stays null until one of them claims it.
--    claim_request() locks the row, so the first claim wins and the others
--    are told "already assigned" (Jobs §1.2). Directed requests are unchanged.
-- 3. History: request_dismissals keeps a snapshot of open requests a
--    prestataire declined or lost, since they can no longer read the request.
-- 4. Messages: request_reads + mark_read() + my_conversations() give the
--    conversation list with unread counts in one call (Messages §3.1).
-- 5. Phone numbers, e-mail addresses and links are masked in messages and the
--    event logged: payments and contacts stay inside 242Konnect (§3.3).
--
-- Additive: no existing row changes meaning. Tests: supabase/tests/
-- provider_workspace_tests.sql, run by run-local.sh.

-- 1 ------------------------------------------------------------------------
alter table public.provider_listings
  add column if not exists available boolean not null default true;
grant insert (available), update (available) on public.provider_listings to authenticated;

-- 2 ------------------------------------------------------------------------
alter table public.service_requests alter column provider_id drop not null;
alter table public.service_requests
  add column if not exists city text not null default '' check (length(city) <= 120);
grant insert (trade_id, city) on public.service_requests to authenticated;
create index if not exists service_requests_open_idx
  on public.service_requests (trade_id, lower(city)) where provider_id is null and status = 'sent';

-- Whether the caller may see and claim an open request of this trade and city.
create or replace function public.can_claim(p_trade text, p_city text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.provider_listings l
    where l.id = (select auth.uid())
      and l.status = 'approved'
      and l.available
      and l.trade_id = p_trade
      and lower(btrim(l.city)) = lower(btrim(p_city))
      and btrim(p_city) <> ''
  );
$$;
revoke execute on function public.can_claim(text, text) from public, anon;
grant execute on function public.can_claim(text, text) to authenticated;

create or replace function public.service_request_prepare()
returns trigger language plpgsql set search_path = '' as $$
declare
  listing public.provider_listings;
begin
  new.client_id := auth.uid();
  new.status := 'draft';
  new.stage := null;
  new.stage_at := '{}';
  new.payment_method := null;
  new.payment_ref := null;
  new.paid_at := null;
  new.response_deadline := null;
  new.accepted_at := null;
  new.decided_at := null;
  new.validated_at := null;
  new.cancelled_at := null;
  new.refund_status := 'none';
  new.dispute := null;
  new.created_at := now();
  new.updated_at := now();
  if new.client_id is null then
    raise exception 'a request must come from a signed-in user' using errcode = '28000';
  end if;
  if new.provider_id is null then
    -- Open request: the trade and city say who may see it.
    if coalesce(length(btrim(new.trade_id)), 0) not between 1 and 64 then
      raise exception 'an open request needs a trade' using errcode = '22023';
    end if;
    if coalesce(length(btrim(new.city)), 0) not between 1 and 120 then
      raise exception 'an open request needs a city' using errcode = '22023';
    end if;
    new.city := btrim(new.city);
  else
    if new.client_id = new.provider_id then
      raise exception 'a prestataire cannot book themselves' using errcode = '22023';
    end if;
    select * into listing from public.provider_listings where id = new.provider_id;
    if not found or listing.status <> 'approved' then
      raise exception 'this prestataire cannot be booked yet' using errcode = '22023';
    end if;
    new.trade_id := listing.trade_id;
    new.city := listing.city;
  end if;
  if new.duration in ('weeks', 'months', 'recurring') and new.contract_accepted_at is null then
    raise exception 'a long project needs the signed project contract' using errcode = '22023';
  end if;
  if new.contract_accepted_at is not null then
    new.contract_accepted_at := now();
  end if;
  new.client_name := coalesce((select full_name from public.profiles where id = new.client_id), '');
  return new;
end;
$$;

-- 3 ------------------------------------------------------------------------
create table if not exists public.request_dismissals (
  request_id  uuid not null references public.service_requests (id) on delete cascade,
  provider_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('declined', 'assigned', 'expired')),
  -- Snapshot: once declined or lost, the request itself is no longer readable.
  trade_id    text not null default '',
  zone_hint   text not null default '',
  slot        text not null default '',
  amount      integer not null default 0,
  currency    text not null default 'FCFA',
  at          timestamptz not null default now(),
  primary key (request_id, provider_id)
);
alter table public.request_dismissals enable row level security;
drop policy if exists "dismissals: own" on public.request_dismissals;
create policy "dismissals: own" on public.request_dismissals
  for select to authenticated using (provider_id = (select auth.uid()));
revoke all on public.request_dismissals from anon, authenticated;
grant select on public.request_dismissals to authenticated;

drop policy if exists "requests: open to eligible prestataires" on public.service_requests;
create policy "requests: open to eligible prestataires" on public.service_requests
  for select to authenticated using (
    provider_id is null
    and status = 'sent'
    and response_deadline > now()
    and client_id <> (select auth.uid())
    and public.can_claim(trade_id, city)
    and not exists (
      select 1 from public.request_dismissals d
      where d.request_id = service_requests.id and d.provider_id = (select auth.uid())
    )
  );

create or replace function public.record_dismissal(r public.service_requests, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.request_dismissals (request_id, provider_id, reason, trade_id, zone_hint, slot, amount, currency)
  values (r.id, auth.uid(), p_reason, r.trade_id, r.zone_hint, r.slot, r.amount, r.currency)
  on conflict (request_id, provider_id) do nothing;
$$;
revoke execute on function public.record_dismissal(public.service_requests, text) from public, anon, authenticated;

-- 'claimed', 'already_assigned', 'expired' or 'not_found'. Answers, not
-- errors, so the losing prestataire's History entry is not rolled back.
create or replace function public.claim_request(p_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r   public.service_requests;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select * into r from public.service_requests where id = p_request for update;
  -- Someone who could never have seen it learns nothing about it.
  if not found or r.client_id = uid or not public.can_claim(r.trade_id, r.city) then
    return 'not_found';
  end if;
  if r.provider_id = uid then
    return 'claimed';
  end if;
  if r.provider_id is not null then
    perform public.record_dismissal(r, 'assigned');
    return 'already_assigned';
  end if;
  if r.status <> 'sent' or r.response_deadline < now() then
    perform public.record_dismissal(r, 'expired');
    return 'expired';
  end if;
  if r.payment_verified_at is null then
    return 'not_found';
  end if;
  update public.service_requests
     set provider_id = uid, status = 'accepted', stage = 'accepted', accepted_at = now(), decided_at = now(),
         stage_at = jsonb_build_object('accepted', now()), updated_at = now()
   where id = r.id;
  perform public.log_security_event('request.claimed', 'info', uid, jsonb_build_object('request', r.id));
  return 'claimed';
end;
$$;
revoke execute on function public.claim_request(uuid) from public, anon;
grant execute on function public.claim_request(uuid) to authenticated;

create or replace function public.dismiss_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.service_requests;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select * into r from public.service_requests where id = p_request;
  if found and r.provider_id is null and r.client_id <> auth.uid() and public.can_claim(r.trade_id, r.city) then
    perform public.record_dismissal(r, 'declined');
  end if;
end;
$$;
revoke execute on function public.dismiss_request(uuid) from public, anon;
grant execute on function public.dismiss_request(uuid) to authenticated;

-- 4 ------------------------------------------------------------------------
create table if not exists public.request_reads (
  request_id   uuid not null references public.service_requests (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
alter table public.request_reads enable row level security;
revoke all on public.request_reads from anon, authenticated;

create or replace function public.mark_read(p_request uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.request_reads (request_id, user_id, last_read_at)
  select r.id, auth.uid(), now() from public.service_requests r
  where r.id = p_request and auth.uid() in (r.client_id, r.provider_id)
  on conflict (request_id, user_id) do update set last_read_at = excluded.last_read_at;
$$;
revoke execute on function public.mark_read(uuid) from public, anon;
grant execute on function public.mark_read(uuid) to authenticated;

-- The caller's conversations, newest first. A request is a conversation once
-- it has left draft and has a second party (Messages §3.2: no cold messages).
create or replace function public.my_conversations()
returns table (
  request_id   uuid,
  trade_id     text,
  status       text,
  stage        text,
  slot         text,
  counterpart  text,
  i_am         text,
  last_body    text,
  last_at      timestamptz,
  last_mine    boolean,
  unread       integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.trade_id, r.status, r.stage, r.slot,
         case when r.client_id = auth.uid()
              then coalesce((select l.full_name from public.provider_listings l where l.id = r.provider_id), '')
              else r.client_name end,
         case when r.client_id = auth.uid() then 'client' else 'prestataire' end,
         m.body, coalesce(m.created_at, r.updated_at), m.sender_id = auth.uid(),
         (select count(*)::integer from public.request_messages x
           where x.request_id = r.id and x.sender_id <> auth.uid()
             and x.created_at > coalesce((select rr.last_read_at from public.request_reads rr
                                           where rr.request_id = r.id and rr.user_id = auth.uid()), '-infinity'))
  from public.service_requests r
  left join lateral (
    select body, created_at, sender_id from public.request_messages
    where request_id = r.id order by created_at desc, id desc limit 1
  ) m on true
  where auth.uid() in (r.client_id, r.provider_id)
    and r.provider_id is not null
    and r.status <> 'draft'
  order by coalesce(m.created_at, r.updated_at) desc
  limit 200;
$$;
revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- 5 ------------------------------------------------------------------------
alter table public.request_messages add column if not exists flagged boolean not null default false;

create or replace function public.request_message_mask()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  masked text := new.body;
begin
  -- Nine digits or more, spaces/dots/dashes allowed between them: a phone
  -- number (Congo: 06 123 45 67). Prices are shorter.
  masked := regexp_replace(masked, '\+?[0-9]([ .()-]?[0-9]){8,}', '•••', 'g');
  masked := regexp_replace(masked, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '•••', 'g');
  masked := regexp_replace(masked, '(https?://|www\.)\S+', '•••', 'gi');
  if masked is distinct from new.body then
    new.body := masked;
    new.flagged := true;
    perform public.log_security_event('message.contact_masked', 'low', new.sender_id,
      jsonb_build_object('request', new.request_id));
  end if;
  return new;
end;
$$;
revoke execute on function public.request_message_mask() from public, anon, authenticated;
-- Named to sort after request_message_stamp, so sender_id is already set.
drop trigger if exists request_message_zmask on public.request_messages;
create trigger request_message_zmask
  before insert on public.request_messages
  for each row execute function public.request_message_mask();
