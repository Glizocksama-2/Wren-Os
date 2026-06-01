-- Northwatch now uses the Express JWT API as the team auth boundary.
-- The API sets app.current_user_id inside each DB transaction, so RLS helpers
-- used by the backend must not touch Supabase's auth schema.

create or replace function public.northwatch_app_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

create or replace function public.northwatch_team_membership_exists(check_team_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  membership_found boolean := false;
begin
  if public.northwatch_app_user_id() is null then
    return false;
  end if;

  if to_regclass('public.team_members') is not null then
    execute
      'select exists (
        select 1
        from public.team_members
        where team_id = $1 and user_id = public.northwatch_app_user_id()
      )'
      into membership_found
      using check_team_id;

    if membership_found then
      return true;
    end if;
  end if;

  if to_regclass('public.team_memberships') is not null then
    execute
      'select exists (
        select 1
        from public.team_memberships
        where team_id = $1 and user_id = public.northwatch_app_user_id()
      )'
      into membership_found
      using check_team_id;
  end if;

  return coalesce(membership_found, false);
end;
$$;

create or replace function public.northwatch_team_owner_matches(check_team_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owns_team boolean := false;
begin
  if public.northwatch_app_user_id() is null then
    return false;
  end if;

  execute
    'select exists (
      select 1
      from public.teams
      where id = $1
        and (
          owner_id = public.northwatch_app_user_id()
          or created_by = public.northwatch_app_user_id()
        )
    )'
    into owns_team
    using check_team_id;

  return coalesce(owns_team, false);
end;
$$;

grant execute on function public.northwatch_app_user_id() to authenticated;
grant execute on function public.northwatch_team_membership_exists(uuid) to authenticated;
grant execute on function public.northwatch_team_owner_matches(uuid) to authenticated;
grant select, insert, update, delete on table public.teams to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'northwatch_app') then
    execute 'grant execute on function public.northwatch_app_user_id() to northwatch_app';
    execute 'grant execute on function public.northwatch_team_membership_exists(uuid) to northwatch_app';
    execute 'grant execute on function public.northwatch_team_owner_matches(uuid) to northwatch_app';
    execute 'grant select, insert, update, delete on table public.teams to northwatch_app';
  end if;
end;
$$;

alter table public.teams enable row level security;

drop policy if exists "teams_select_member_or_creator" on public.teams;
drop policy if exists "teams_select_member_or_owner" on public.teams;
create policy "teams_select_member_or_owner"
on public.teams
for select
using (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
  or public.northwatch_team_membership_exists(id)
);

drop policy if exists "teams_insert_creator" on public.teams;
drop policy if exists "teams_insert_owner_or_creator" on public.teams;
create policy "teams_insert_owner_or_creator"
on public.teams
for insert
with check (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
);

drop policy if exists "teams_update_owner" on public.teams;
drop policy if exists "teams_update_owner_or_creator" on public.teams;
create policy "teams_update_owner_or_creator"
on public.teams
for update
using (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
)
with check (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
);

drop policy if exists "teams_delete_owner" on public.teams;
drop policy if exists "teams_delete_owner_or_creator" on public.teams;
create policy "teams_delete_owner_or_creator"
on public.teams
for delete
using (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
);

do $$
begin
  if to_regclass('public.team_members') is not null then
    execute 'grant select, insert, update, delete on table public.team_members to authenticated';

    if exists (select 1 from pg_roles where rolname = 'northwatch_app') then
      execute 'grant select, insert, update, delete on table public.team_members to northwatch_app';
    end if;

    execute 'alter table public.team_members enable row level security';
    execute 'drop policy if exists team_members_select_member on public.team_members';
    execute 'create policy team_members_select_member on public.team_members for select using (
      user_id = public.northwatch_app_user_id()
      or public.northwatch_team_membership_exists(team_id)
      or public.northwatch_team_owner_matches(team_id)
    )';
    execute 'drop policy if exists team_members_insert_owner_or_invited_user on public.team_members';
    execute 'create policy team_members_insert_owner_or_invited_user on public.team_members for insert with check (
      (user_id = public.northwatch_app_user_id() and role = ''owner'' and public.northwatch_team_owner_matches(team_id))
      or public.northwatch_team_membership_exists(team_id)
    )';
  end if;
end;
$$;
