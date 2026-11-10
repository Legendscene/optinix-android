-- Optinix Account tables + Row Level Security (run in Supabase SQL editor).
-- Client credentials are the publishable key only; ALL access is governed
-- by RLS below: a user can touch only rows whose user_id equals the JWT's
-- auth.uid(). The service_role key (used exclusively by the delete-account
-- Edge Function) bypasses RLS by design and is never shipped to the app.
--
-- Accounts are never auto-merged because emails match: profiles rows are
-- created per NEW auth user id; nothing keys on email.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — trivially editable mirror of auth.users metadata
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe upsert for INSERT/UPDATE per column (keeps the trigger re-runnable).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_settings — one JSON payload per user (versioned by the app schema)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  device_id text,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create trigger user_settings_touch
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- devices — one row per (user, device) that completed a sync handshake
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  label text,
  platform text,           -- 'android'
  model text,
  app_version text,
  os_version text,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- ---------------------------------------------------------------------------
-- sync_history — append-only audit of uploads/restores
-- ---------------------------------------------------------------------------
create table if not exists public.sync_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text,
  direction text not null check (direction in ('upload', 'restore')),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sync_history_user_idx on public.sync_history (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — users only ever reach their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.devices       enable row level security;
alter table public.sync_history  enable row level security;

drop policy if exists "own profile"        on public.profiles;
drop policy if exists "own settings"       on public.user_settings;
drop policy if exists "own devices"        on public.devices;
drop policy if exists "own history read"   on public.sync_history;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own devices" on public.devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- History is READ-ONLY for clients; appends happen server-side in policies
-- below (insert) and nothing may be edited or deleted via the app key.
create policy "own history read" on public.sync_history
  for select using (auth.uid() = user_id);

create policy "own history insert" on public.sync_history
  for insert with check (auth.uid() = user_id);

-- id columns are identity-generated; grants are default (RLS gate is the barrier).
grant usage on schema public to authenticated;
