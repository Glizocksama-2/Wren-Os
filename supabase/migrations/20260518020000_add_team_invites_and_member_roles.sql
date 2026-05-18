create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz
);

alter table public.team_memberships
  add column if not exists invite_id uuid references public.team_invites(id) on delete set null,
  add column if not exists member_email text;

create index if not exists team_invites_team_id_idx on public.team_invites(team_id);
create index if not exists team_invites_created_by_idx on public.team_invites(created_by);
create index if not exists team_memberships_invite_id_idx on public.team_memberships(invite_id);

create or replace function private.is_team_owner(check_team_id uuid, check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = check_team_id
      and membership.user_id = check_user_id
      and membership.role = 'owner'
  );
$$;

create or replace function private.team_owner_count(check_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.team_memberships as membership
  where membership.team_id = check_team_id
    and membership.role = 'owner';
$$;

create or replace function private.is_active_team_invite(check_invite_id uuid, check_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_invites as invite
    where invite.id = check_invite_id
      and invite.team_id = check_team_id
      and invite.revoked_at is null
      and invite.expires_at > now()
  );
$$;

revoke all on function private.is_team_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function private.team_owner_count(uuid) from public, anon, authenticated;
revoke all on function private.is_active_team_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_team_owner(uuid, uuid) to authenticated;
grant execute on function private.team_owner_count(uuid) to authenticated;
grant execute on function private.is_active_team_invite(uuid, uuid) to authenticated;

alter table public.team_invites enable row level security;

revoke all on table public.team_invites from anon;
revoke all on table public.team_invites from authenticated;
grant select, insert, update on table public.team_invites to authenticated;
revoke update, delete on table public.team_memberships from authenticated;
grant update (role) on table public.team_memberships to authenticated;
grant delete on table public.team_memberships to authenticated;

drop policy if exists "team_memberships_select_self" on public.team_memberships;
create policy "team_memberships_select_self_or_owner"
on public.team_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_team_owner(team_id, (select auth.uid()))
);

drop policy if exists "team_memberships_insert_self" on public.team_memberships;
create policy "team_memberships_insert_self"
on public.team_memberships
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (
      role = 'owner'
      and exists (
        select 1
        from public.teams as team
        where team.id = team_id
          and team.created_by = (select auth.uid())
      )
    )
    or (
      role = 'member'
      and invite_id is not null
      and private.is_active_team_invite(invite_id, team_id)
    )
  )
);

drop policy if exists "team_memberships_update_owner" on public.team_memberships;
create policy "team_memberships_update_owner"
on public.team_memberships
for update
to authenticated
using (private.is_team_owner(team_id, (select auth.uid())))
with check (
  private.is_team_owner(team_id, (select auth.uid()))
  and (
    role = 'owner'
    or private.team_owner_count(team_id) > 1
  )
);

drop policy if exists "team_memberships_delete_owner" on public.team_memberships;
create policy "team_memberships_delete_owner"
on public.team_memberships
for delete
to authenticated
using (
  (
    private.is_team_owner(team_id, (select auth.uid()))
    and (
      role <> 'owner'
      or private.team_owner_count(team_id) > 1
    )
  )
  or (
    user_id = (select auth.uid())
    and role <> 'owner'
  )
);

drop policy if exists "team_invites_select_owner" on public.team_invites;
create policy "team_invites_select_owner"
on public.team_invites
for select
to authenticated
using (private.is_team_owner(team_id, (select auth.uid())));

drop policy if exists "team_invites_insert_owner" on public.team_invites;
create policy "team_invites_insert_owner"
on public.team_invites
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_team_owner(team_id, (select auth.uid()))
);

drop policy if exists "team_invites_update_owner" on public.team_invites;
create policy "team_invites_update_owner"
on public.team_invites
for update
to authenticated
using (private.is_team_owner(team_id, (select auth.uid())))
with check (private.is_team_owner(team_id, (select auth.uid())));
