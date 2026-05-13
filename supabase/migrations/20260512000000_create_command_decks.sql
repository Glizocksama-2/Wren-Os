create table if not exists public.command_decks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  deck jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.command_decks enable row level security;

revoke all on table public.command_decks from anon;
grant select, insert, update on table public.command_decks to authenticated;

drop policy if exists "command_decks_select_own" on public.command_decks;
create policy "command_decks_select_own"
on public.command_decks
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "command_decks_insert_own" on public.command_decks;
create policy "command_decks_insert_own"
on public.command_decks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "command_decks_update_own" on public.command_decks;
create policy "command_decks_update_own"
on public.command_decks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
