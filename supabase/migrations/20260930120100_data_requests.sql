-- Correction and deletion requests (Parcours Client §10: "les demandes de
-- correction ou suppression").
--
-- A request, not an action: deleting an account that holds blocked funds or an
-- open dispute would destroy the evidence the transaction rules depend on, so a
-- person asks and 242Konnect processes. Same stamping and append-only grants as
-- consent_records; `status` is moved on by staff with the service role.

create table if not exists public.data_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('correction', 'deletion')),
  details    text check (details is null or length(details) <= 2000),
  status     text not null default 'received' check (status in ('received', 'in_review', 'done', 'refused')),
  created_at timestamptz not null default now()
);

create index if not exists data_requests_user_idx on public.data_requests (user_id, created_at desc);

create or replace function public.stamp_data_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  new.status := 'received';
  if new.user_id is null then
    raise exception 'a data request must come from a signed-in user';
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_data_request on public.data_requests;
create trigger stamp_data_request
  before insert on public.data_requests
  for each row execute function public.stamp_data_request();

alter table public.data_requests enable row level security;

drop policy if exists "data requests: read own" on public.data_requests;
create policy "data requests: read own" on public.data_requests
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "data requests: file own" on public.data_requests;
create policy "data requests: file own" on public.data_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.data_requests from anon, authenticated;
grant select, insert on public.data_requests to authenticated;
