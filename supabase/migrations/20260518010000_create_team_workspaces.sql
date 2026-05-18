create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default timezone('utc'::text, now()),
  primary key (team_id, user_id)
);

create table if not exists public.team_command_decks (
  team_id uuid primary key references public.teams(id) on delete cascade,
  deck jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists team_memberships_user_id_idx on public.team_memberships(user_id);
create index if not exists team_command_decks_updated_by_idx on public.team_command_decks(updated_by);

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_command_decks enable row level security;

revoke all on table public.teams from anon;
revoke all on table public.team_memberships from anon;
revoke all on table public.team_command_decks from anon;

revoke all on table public.teams from authenticated;
revoke all on table public.team_memberships from authenticated;
revoke all on table public.team_command_decks from authenticated;

grant select, insert on table public.teams to authenticated;
grant select, insert on table public.team_memberships to authenticated;
grant select, insert, update on table public.team_command_decks to authenticated;

drop policy if exists "teams_select_member_or_creator" on public.teams;
create policy "teams_select_member_or_creator"
on public.teams
for select
to authenticated
using (
  created_by = (select auth.uid())
  or id in (
    select membership.team_id
    from public.team_memberships as membership
    where membership.user_id = (select auth.uid())
  )
);

drop policy if exists "teams_insert_creator" on public.teams;
create policy "teams_insert_creator"
on public.teams
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "team_memberships_select_self" on public.team_memberships;
create policy "team_memberships_select_self"
on public.team_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "team_memberships_insert_self" on public.team_memberships;
create policy "team_memberships_insert_self"
on public.team_memberships
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    role = 'member'
    or (
      role = 'owner'
      and exists (
        select 1
        from public.teams as team
        where team.id = team_id
          and team.created_by = (select auth.uid())
      )
    )
  )
);

drop policy if exists "team_command_decks_select_member" on public.team_command_decks;
create policy "team_command_decks_select_member"
on public.team_command_decks
for select
to authenticated
using (
  team_id in (
    select membership.team_id
    from public.team_memberships as membership
    where membership.user_id = (select auth.uid())
  )
);

drop policy if exists "team_command_decks_insert_member" on public.team_command_decks;
create policy "team_command_decks_insert_member"
on public.team_command_decks
for insert
to authenticated
with check (
  team_id in (
    select membership.team_id
    from public.team_memberships as membership
    where membership.user_id = (select auth.uid())
  )
);

drop policy if exists "team_command_decks_update_member" on public.team_command_decks;
create policy "team_command_decks_update_member"
on public.team_command_decks
for update
to authenticated
using (
  team_id in (
    select membership.team_id
    from public.team_memberships as membership
    where membership.user_id = (select auth.uid())
  )
)
with check (
  team_id in (
    select membership.team_id
    from public.team_memberships as membership
    where membership.user_id = (select auth.uid())
  )
);
