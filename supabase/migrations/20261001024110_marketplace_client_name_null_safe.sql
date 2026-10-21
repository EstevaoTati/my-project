-- Copied from production on 2026-10-19 (applied live, never committed).
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
  if new.client_id = new.provider_id then
    raise exception 'a prestataire cannot book themselves' using errcode = '22023';
  end if;
  select * into listing from public.provider_listings where id = new.provider_id;
  if not found or listing.status <> 'approved' then
    raise exception 'this prestataire cannot be booked yet' using errcode = '22023';
  end if;
  new.trade_id := listing.trade_id;
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
