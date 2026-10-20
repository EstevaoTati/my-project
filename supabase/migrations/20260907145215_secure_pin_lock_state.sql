-- Copied from production on 2026-10-19 (applied live, never committed).
-- public.user_pin itself predates the migration history; its definition is in
-- supabase/tests/local/pre_migration_objects.sql.
create table if not exists public.user_pin_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts smallint not null default 0 check (failed_attempts >= 0 and failed_attempts <= 5),
  locked_until timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_pin_security enable row level security;

revoke all on table public.user_pin_security from anon, authenticated;
revoke all on table public.user_pin from anon, authenticated;
