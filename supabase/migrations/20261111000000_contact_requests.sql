-- Contact requests ("Contacter", "Demander un devis").
--
-- Until now the only way to reach a prestataire was a paid booking: the
-- request left 'draft' only once the payment service confirmed the money.
-- With Mobile Money not live yet, and no payment method at all in the United
-- States, nobody could contact anybody — and a prestataire priced "sur devis"
-- could not be asked for that quote. The first field test (Utah, 2026-11)
-- ran straight into it.
--
-- A contact request is a service request of kind 'inquiry': no amount, no
-- payment, sent at once, with a first message. It opens the conversation and
-- nothing else:
--   - it can never be accepted as a mission (accept needs a verified payment)
--     nor paid (the payment service only takes drafts);
--   - phone numbers, e-mails and links are masked like in any conversation,
--     in the message and in the summary on the prestataire's card, so contact
--     and payment stay inside 242Konnect;
--   - one open contact per client and prestataire: writing again continues it;
--   - same country only, an approved prestataire only, never oneself;
--   - the 20-per-hour request quota applies.
-- Booking and paying remain the existing flow, unchanged.
--
-- Additive. Tests: supabase/tests/contact_tests.sql.

alter table public.service_requests
  add column if not exists kind text not null default 'booking' check (kind in ('booking', 'inquiry'));
alter table public.service_requests alter column amount drop not null;

create unique index if not exists service_requests_one_open_inquiry
  on public.service_requests (client_id, provider_id) where kind = 'inquiry' and status = 'sent';

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
  -- A request made by the app is a booking with an amount. Only
  -- contact_provider() turns one into a contact request, afterwards.
  new.kind := 'booking';
  if new.amount is null then
    raise exception 'a request needs an amount' using errcode = '22023';
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


-- One definition of what is hidden in a conversation, used by the message
-- trigger and by the summary a contact request shows on the prestataire's
-- card: without the second, the phone number masked in the chat would sit in
-- clear on the card above it.
create or replace function public.mask_contact_details(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Nine digits or more, spaces/dots/dashes allowed between them: a phone
  -- number (Congo: 06 123 45 67; USA: 801 555 0100). Prices are shorter.
  select regexp_replace(
           regexp_replace(
             regexp_replace(p_text, '\+?[0-9]([ .()-]?[0-9]){8,}', '•••', 'g'),
             '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '•••', 'g'),
           '(https?://|www\.)\S+', '•••', 'gi');
$$;
revoke execute on function public.mask_contact_details(text) from public, anon, authenticated;

-- Same behaviour as before (provider workspace migration), now through the
-- shared definition above.
create or replace function public.request_message_mask()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  masked text := public.mask_contact_details(new.body);
begin
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

create or replace function public.contact_provider(p_provider uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  listing public.provider_listings;
  mine    text;
  req     uuid;
  body    text := btrim(coalesce(p_message, ''));
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if length(body) not between 1 and 2000 then
    raise exception 'a message is required' using errcode = '22023';
  end if;
  if uid = p_provider then
    raise exception 'a prestataire cannot book themselves' using errcode = '22023';
  end if;
  select * into listing from public.provider_listings where id = p_provider;
  if not found or listing.status <> 'approved' then
    raise exception 'this prestataire cannot be booked yet' using errcode = '22023';
  end if;
  -- Client §11: a prestataire of another country is not offered.
  select country into mine from public.profiles where id = uid;
  if mine is not null and mine <> listing.country then
    raise exception 'this prestataire is not available in your country' using errcode = '22023';
  end if;

  select id into req from public.service_requests
   where client_id = uid and provider_id = p_provider and kind = 'inquiry' and status = 'sent'
   for update;
  if req is null then
    -- Inserted as any request (the insert trigger stamps the client and the
    -- trade), then turned into a contact request and sent.
    insert into public.service_requests (provider_id, description, slot, amount, idempotency_key)
      values (p_provider, public.mask_contact_details(body), 'À convenir', 1, 'inq-' || replace(gen_random_uuid()::text, '-', ''))
      returning id into req;
    update public.service_requests
       set kind = 'inquiry', amount = null, status = 'sent', updated_at = now()
     where id = req;
    perform public.log_security_event('request.inquiry', 'info', uid,
      jsonb_build_object('request', req, 'provider', p_provider));
  else
    update public.service_requests set updated_at = now() where id = req;
  end if;

  insert into public.request_messages (request_id, body) values (req, body);
  return req;
end;
$$;
revoke execute on function public.contact_provider(uuid, text) from public, anon;
grant execute on function public.contact_provider(uuid, text) to authenticated;
