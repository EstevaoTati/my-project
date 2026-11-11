-- 242Konnect — Prestataire workspace, parts 3 to 5 (production).
--
-- Parts 1 and 2 of supabase/migrations/20261021000000_provider_workspace.sql
-- were applied on 2026-10-21 through the Supabase MCP. Parts 3 to 5 create
-- tables, which that tool no longer lets through, so they are applied by
-- hand: Supabase dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. Idempotent: running it twice changes nothing.
--
-- Same statements as the migration file, tested on the local replica
-- (87/87, supabase/tests/run-local.sh). The last query prints what exists.

begin;

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

commit;

select
  to_regclass('public.request_dismissals') is not null as history_table,
  to_regclass('public.request_reads') is not null     as read_receipts,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('claim_request', 'dismiss_request', 'record_dismissal', 'mark_read', 'my_conversations', 'request_message_mask')) as functions_6,
  (select count(*) from pg_trigger where tgname = 'request_message_zmask') as mask_trigger_1;
