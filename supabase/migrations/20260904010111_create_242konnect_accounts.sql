-- Copied from production (supabase_migrations.schema_migrations) on 2026-10-19:
-- this migration was applied to the live project but never committed, so the
-- repository could not rebuild the schema it runs against.

-- 242Konnect account data, held in Supabase rather than only on the device.
--
-- One row per account, keyed to the auth user that owns it. The app used to
-- keep everything in AsyncStorage, which meant an account existed on exactly
-- one phone and could not be reached from another. This is the shared record.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Identity. Both are unique across the platform, which is the cahier des
  -- charges rule (§9.10) that a device-local store could never enforce.
  email        text not null unique,
  phone        text not null unique,
  phone_country text not null default 'CG',
  full_name    text not null,

  -- Where the person is. Congo uses a city; the United States a state and city.
  country      text not null default 'CG',
  city         text,
  state        text,

  -- Which profiles this one account has activated, and which is in use.
  profiles       text[] not null default array['particulier'],
  active_profile text   not null default 'particulier',

  bio        text,
  avatar_url text,

  -- Per-profile detail, kept as JSON so the shape can follow the spec without a
  -- migration for every field. The app owns the schema of these.
  particulier jsonb,
  prestataire jsonb,
  business    jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_active_profile_valid
    check (active_profile in ('particulier', 'prestataire', 'business'))
);

comment on table public.profiles is
  '242Konnect accounts. One row per auth user; e-mail and phone are unique platform-wide (cahier des charges 9.10).';

create index if not exists profiles_phone_idx on public.profiles (phone);

-- Keep updated_at honest without the app having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Row level security: a person reads and writes their own row and nobody
-- else's. Without this the anon key would expose every account on the
-- platform, which is precisely what the correction note warns against.
alter table public.profiles enable row level security;

drop policy if exists "own profile is readable" on public.profiles;
create policy "own profile is readable"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "own profile is insertable" on public.profiles;
create policy "own profile is insertable"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "own profile is updatable" on public.profiles;
create policy "own profile is updatable"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
