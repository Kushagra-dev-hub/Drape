-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Creates a saved_addresses table scoped to each signed-in user via RLS.

create table if not exists public.saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Home',
  name text not null,
  phone text not null,
  street text not null,
  city text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists saved_addresses_user_id_idx on public.saved_addresses (user_id);

alter table public.saved_addresses enable row level security;

create policy "saved_addresses_owner_all" on public.saved_addresses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
