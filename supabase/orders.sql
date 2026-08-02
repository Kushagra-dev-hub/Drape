-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Creates an orders table scoped to each signed-in user via RLS.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  gift_id text not null,
  gift_name text not null,
  gift_image_url text,
  merchant text not null,
  price numeric not null,
  delivery_days integer not null,
  status text not null default 'Processing', -- Processing, On the way, Delivered, Cancelled
  delivery_date timestamptz,
  prava_txn text,   -- Prava transaction ref for a real (sandbox) payment
  prava_order text, -- Prava order id (proof of the settled checkout)
  created_at timestamptz not null default now()
);

-- If the orders table already exists, add the Prava columns:
alter table public.orders add column if not exists prava_txn text;
alter table public.orders add column if not exists prava_order text;

create index if not exists orders_user_id_created_at_idx on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

-- Idempotent: safe to re-run (drop first so "already exists" never errors).
drop policy if exists "orders_owner_all" on public.orders;
create policy "orders_owner_all" on public.orders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
