-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Creates a wishlist table scoped to each signed-in user via RLS.
--
-- Stores a denormalised snapshot of the gift rather than a reference: gift
-- candidates come from live merchant search and aren't rows anywhere, so the
-- card has to be reconstructible from this table alone.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  gift_id text not null,
  gift_name text not null,
  gift_image_url text,
  merchant text not null,
  price numeric not null,
  delivery_days integer not null,
  category text,
  emoji text,
  checkout_url text,
  created_at timestamptz not null default now(),

  -- One row per gift per user: hearting the same gift twice is a no-op
  -- upsert rather than a duplicate card on the wishlist page.
  unique (user_id, gift_id)
);

create index if not exists wishlist_items_user_id_created_at_idx
  on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

-- Idempotent: safe to re-run (drop first so "already exists" never errors).
drop policy if exists "wishlist_items_owner_all" on public.wishlist_items;
create policy "wishlist_items_owner_all" on public.wishlist_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
