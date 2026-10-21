-- Objects that exist in the live project but were created outside the
-- migration history. Shapes read from information_schema on 2026-10-19.

-- From revoke_public_execute_on_functions (Mwinda Digital, same project).
alter default privileges in schema public revoke execute on functions from public;

create table if not exists public.user_pin (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  pin_hash   text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_pin enable row level security;
