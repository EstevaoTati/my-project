-- 242Konnect marketplace: the shared backend the V1 specifications assume.
--
-- Until now every request, mission and message lived on one phone, so a
-- prestataire could never receive what a client sent. This adds the four
-- things that make it a marketplace, each with the rule the specs give it:
--
--   provider_listings        the directory (Client §11–§13, Prestataire §07)
--                            visible to signed-in users, no phone, no e-mail;
--                            `status` is 242Konnect's to set, never the
--                            prestataire's — pending profiles are visible with
--                            a badge but cannot be booked
--   service_requests         one request per client and prestataire, driven
--                            through its lifecycle only by request_action()
--                            (Commande §01–§11)
--   service_request_private  the exact address, readable by the prestataire
--                            only once the request is accepted (Client §06,
--                            Commande §01, Prestataire §09)
--   request_messages         the chat attached to a request (Client §13)
--
-- Nothing here can be changed by an UPDATE from the app. Clients and
-- prestataires move a request by calling request_action(), which checks who is
-- calling and what state the request is in. That is what makes "un seul
-- Prestataire peut accepter", "aucune libération avant validation" and "les
-- fonds restent bloqués pendant tout litige" properties of the database rather
-- than of a screen.
--
-- Payment is NOT verified here yet. `pay` records the method and reference the
-- app reports; there is no operator merchant account to confirm against. When
-- MTN/Airtel/card collections go live, `pay` must move to the API (service role,
-- after the operator's callback) and be removed from the client's actions.

------------------------------------------------------------------------------
-- Directory
------------------------------------------------------------------------------

create table if not exists public.provider_listings (
  id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name      text not null check (length(full_name) between 2 and 120),
  avatar_url     text check (avatar_url is null or length(avatar_url) <= 400000),
  trade_id       text not null check (length(trade_id) between 1 and 64),
  zone           text not null default '' check (length(zone) <= 200),
  city           text not null default '' check (length(city) <= 120),
  country        text not null default 'CG' check (country in ('CG', 'US')),
  pricing        jsonb,
  durations      text[] not null default '{}',
  bio            text not null default '' check (length(bio) <= 2000),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  refusal_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.provider_listings is
  '242Konnect directory. Public to signed-in users; status is set by 242Konnect (service role) only.';

create or replace function public.provider_listing_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- Prestataire §07: a refused profile "reçoit un motif et une possibilité de
  -- correction". Editing it is the correction, so it goes back to review —
  -- unless this very update is 242Konnect setting the status.
  if tg_op = 'UPDATE' and old.status = 'refused' and new.status = old.status then
    new.status := 'pending';
    new.refusal_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists provider_listing_touch on public.provider_listings;
create trigger provider_listing_touch
  before insert or update on public.provider_listings
  for each row execute function public.provider_listing_touch();

alter table public.provider_listings enable row level security;

drop policy if exists "listings: readable when signed in" on public.provider_listings;
create policy "listings: readable when signed in" on public.provider_listings
  for select to authenticated using (true);

drop policy if exists "listings: create own" on public.provider_listings;
create policy "listings: create own" on public.provider_listings
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "listings: edit own" on public.provider_listings;
create policy "listings: edit own" on public.provider_listings
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.provider_listings from anon, authenticated;
grant select on public.provider_listings to authenticated;
-- status and refusal_reason are deliberately absent: only 242Konnect sets them.
grant insert (id, full_name, avatar_url, trade_id, zone, city, country, pricing, durations, bio)
  on public.provider_listings to authenticated;
grant update (id, full_name, avatar_url, trade_id, zone, city, country, pricing, durations, bio)
  on public.provider_listings to authenticated;

------------------------------------------------------------------------------
-- Requests
------------------------------------------------------------------------------

create table if not exists public.service_requests (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider_id          uuid not null references public.provider_listings (id) on delete cascade,
  client_name          text not null default '',
  trade_id             text not null default '',
  description          text not null default '' check (length(description) <= 2000),
  -- What the prestataire may know before accepting: the quarter, not the door.
  zone_hint            text not null default '' check (length(zone_hint) <= 200),
  slot                 text not null check (length(slot) between 1 and 80),
  duration             text not null default 'hours'
                         check (duration in ('hours', 'days', 'weeks', 'months', 'recurring')),
  contract_accepted_at timestamptz,
  amount               integer not null check (amount > 0 and amount <= 50000000),
  currency             text not null default 'FCFA' check (currency in ('FCFA', 'USD')),
  -- Commande §06: one key per order; a replayed order cannot become a second.
  idempotency_key      text not null unique check (length(idempotency_key) between 8 and 64),
  status               text not null default 'draft'
                         check (status in ('draft', 'sent', 'refused', 'accepted', 'validated', 'disputed', 'cancelled')),
  stage                text check (stage in ('accepted', 'on_the_way', 'arrived', 'in_progress', 'completed')),
  stage_at             jsonb not null default '{}',
  payment_method       text check (payment_method in ('mtn', 'airtel', 'carte', 'virement')),
  payment_ref          text check (length(payment_ref) <= 80),
  paid_at              timestamptz,
  response_deadline    timestamptz,
  accepted_at          timestamptz,
  decided_at           timestamptz,
  validated_at         timestamptz,
  cancelled_at         timestamptz,
  refund_status        text not null default 'none' check (refund_status in ('none', 'full', 'under_review')),
  dispute              jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists service_requests_client_idx on public.service_requests (client_id, created_at desc);
create index if not exists service_requests_provider_idx on public.service_requests (provider_id, created_at desc);

comment on table public.service_requests is
  '242Konnect requests and missions. Inserted as drafts by the client; moved only by request_action().';

create or replace function public.service_request_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing public.provider_listings;
begin
  -- Whatever the app sent for these, the server decides them.
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
  if new.client_id = new.provider_id then
    raise exception 'a prestataire cannot book themselves' using errcode = '22023';
  end if;

  select * into listing from public.provider_listings where id = new.provider_id;
  -- Prestataire §07: visible while pending, bookable only once approved.
  if not found or listing.status <> 'approved' then
    raise exception 'this prestataire cannot be booked yet' using errcode = '22023';
  end if;
  new.trade_id := listing.trade_id;

  -- Commande §02: "Un projet de plus de sept jours déclenche jalons et contrat."
  if new.duration in ('weeks', 'months', 'recurring') and new.contract_accepted_at is null then
    raise exception 'a long project needs the signed project contract' using errcode = '22023';
  end if;
  if new.contract_accepted_at is not null then
    new.contract_accepted_at := now();
  end if;

  -- A snapshot for the prestataire's inbox; '' rather than a failure when the
  -- client's profile row has not synced yet.
  new.client_name := coalesce((select full_name from public.profiles where id = new.client_id), '');
  return new;
end;
$$;

drop trigger if exists service_request_prepare on public.service_requests;
create trigger service_request_prepare
  before insert on public.service_requests
  for each row execute function public.service_request_prepare();

alter table public.service_requests enable row level security;

drop policy if exists "requests: parties read" on public.service_requests;
create policy "requests: parties read" on public.service_requests
  for select to authenticated using (
    (select auth.uid()) = client_id
    -- A draft has not been paid, so it has not been sent: the prestataire
    -- does not see it at all (Commande §07).
    or ((select auth.uid()) = provider_id and status <> 'draft')
  );

drop policy if exists "requests: client drafts" on public.service_requests;
create policy "requests: client drafts" on public.service_requests
  for insert to authenticated with check ((select auth.uid()) = client_id);

revoke all on public.service_requests from anon, authenticated;
grant select on public.service_requests to authenticated;
grant insert (provider_id, description, zone_hint, slot, duration, contract_accepted_at, amount, currency, idempotency_key)
  on public.service_requests to authenticated;
-- No UPDATE and no DELETE: request_action() is the only way a request moves,
-- and a request is never erased — it is the evidence a dispute is judged on.

------------------------------------------------------------------------------
-- The exact address
------------------------------------------------------------------------------

create table if not exists public.service_request_private (
  request_id uuid primary key references public.service_requests (id) on delete cascade,
  address    text not null check (length(address) between 3 and 400)
);

alter table public.service_request_private enable row level security;

drop policy if exists "address: client always, prestataire once accepted" on public.service_request_private;
create policy "address: client always, prestataire once accepted" on public.service_request_private
  for select to authenticated using (
    exists (
      select 1 from public.service_requests r
      where r.id = request_id
        and (
          r.client_id = (select auth.uid())
          or (r.provider_id = (select auth.uid()) and r.status in ('accepted', 'validated', 'disputed'))
        )
    )
  );

drop policy if exists "address: client sets it on the draft" on public.service_request_private;
create policy "address: client sets it on the draft" on public.service_request_private
  for insert to authenticated with check (
    exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.client_id = (select auth.uid()) and r.status = 'draft'
    )
  );

revoke all on public.service_request_private from anon, authenticated;
grant select, insert on public.service_request_private to authenticated;

------------------------------------------------------------------------------
-- Messages
------------------------------------------------------------------------------

create table if not exists public.request_messages (
  id         bigint generated always as identity primary key,
  request_id uuid not null references public.service_requests (id) on delete cascade,
  sender_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists request_messages_request_idx on public.request_messages (request_id, created_at);

create or replace function public.request_message_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sender_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists request_message_stamp on public.request_messages;
create trigger request_message_stamp
  before insert on public.request_messages
  for each row execute function public.request_message_stamp();

alter table public.request_messages enable row level security;

drop policy if exists "messages: parties read" on public.request_messages;
create policy "messages: parties read" on public.request_messages
  for select to authenticated using (
    exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.status <> 'draft'
        and (select auth.uid()) in (r.client_id, r.provider_id)
    )
  );

drop policy if exists "messages: parties write" on public.request_messages;
create policy "messages: parties write" on public.request_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.status in ('sent', 'accepted', 'disputed')
        and (select auth.uid()) in (r.client_id, r.provider_id)
    )
  );

revoke all on public.request_messages from anon, authenticated;
grant select on public.request_messages to authenticated;
grant insert (request_id, body) on public.request_messages to authenticated;

------------------------------------------------------------------------------
-- The state machine
------------------------------------------------------------------------------

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
    -- Same answer as a missing row: a stranger learns nothing.
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  -- Commande §07: an unanswered request expires; it is never auto-accepted.
  expired := r.status = 'sent' and r.response_deadline < now();

  if is_client and p_action = 'pay' then
    if r.status = 'sent' and r.payment_ref is not distinct from (p_payload ->> 'payment_ref') then
      return r; -- the same payment replayed: nothing to do, nothing charged twice
    end if;
    if r.status <> 'draft' then
      raise exception 'this request is already paid' using errcode = '22023';
    end if;
    if coalesce(p_payload ->> 'method', '') not in ('mtn', 'airtel', 'carte', 'virement') then
      raise exception 'unknown payment method' using errcode = '22023';
    end if;
    update public.service_requests set
      status = 'sent',
      payment_method = p_payload ->> 'method',
      payment_ref = left(p_payload ->> 'payment_ref', 80),
      paid_at = now(),
      response_deadline = now() + interval '24 hours',
      updated_at = now()
    where id = r.id returning * into r;

  elsif is_client and p_action = 'cancel' then
    -- Commande §11: full refund before acceptance; after it, the refund
    -- depends on notice and work done, so it goes to review.
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
    -- Commande §09: approval releases the funds, and only once completed.
    if r.status <> 'accepted' or r.stage is distinct from 'completed' then
      raise exception 'only a completed mission can be approved' using errcode = '22023';
    end if;
    update public.service_requests set status = 'validated', validated_at = now(), updated_at = now()
    where id = r.id returning * into r;

  elsif is_client and p_action = 'dispute' then
    -- Commande §10: structured, frozen funds, no promised refund.
    if r.status <> 'accepted' then
      raise exception 'only an accepted mission can be disputed' using errcode = '22023';
    end if;
    if coalesce(p_payload ->> 'reason', '') = ''
       or coalesce(p_payload ->> 'outcome', '') not in ('redo', 'partial_refund', 'full_refund') then
      raise exception 'a dispute needs a reason and a requested outcome' using errcode = '22023';
    end if;
    update public.service_requests set
      status = 'disputed',
      dispute = jsonb_build_object(
        'reason', left(p_payload ->> 'reason', 120),
        'outcome', p_payload ->> 'outcome',
        'details', left(coalesce(p_payload ->> 'details', ''), 2000),
        'at', now()
      ),
      updated_at = now()
    where id = r.id returning * into r;

  elsif is_provider and p_action = 'accept' then
    if r.status <> 'sent' or expired then
      raise exception 'this request can no longer be accepted' using errcode = '22023';
    end if;
    if not exists (select 1 from public.provider_listings l where l.id = uid and l.status = 'approved') then
      raise exception 'your profile is not approved yet' using errcode = '22023';
    end if;
    update public.service_requests set
      status = 'accepted', stage = 'accepted', accepted_at = now(), decided_at = now(),
      stage_at = jsonb_build_object('accepted', now()), updated_at = now()
    where id = r.id returning * into r;

  elsif is_provider and p_action = 'decline' then
    if r.status <> 'sent' then
      raise exception 'this request can no longer be declined' using errcode = '22023';
    end if;
    update public.service_requests set status = 'refused', decided_at = now(), updated_at = now()
    where id = r.id returning * into r;

  elsif is_provider and p_action = 'advance' then
    -- Commande §08 / Prestataire §10: each step timestamped by the server.
    if r.status <> 'accepted' or r.stage = 'completed' then
      raise exception 'nothing to advance' using errcode = '22023';
    end if;
    nxt := stages[array_position(stages, r.stage) + 1];
    update public.service_requests set
      stage = nxt, stage_at = stage_at || jsonb_build_object(nxt, now()), updated_at = now()
    where id = r.id returning * into r;

  else
    raise exception 'action not allowed' using errcode = '42501';
  end if;

  return r;
end;
$$;

revoke all on function public.request_action(uuid, text, jsonb) from public, anon;
grant execute on function public.request_action(uuid, text, jsonb) to authenticated;
