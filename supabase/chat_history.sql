-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Creates conversations + messages tables, scoped to each signed-in user via RLS.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  gifts jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists conversations_user_id_updated_at_idx on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations_owner_all" on public.conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "messages_owner_all" on public.messages
  for all
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  ));

-- Bumps conversations.updated_at whenever a new message lands, so the
-- sidebar list can sort by "most recently active" without an extra query.
create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_updated_at();
