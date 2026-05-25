create extension if not exists pgcrypto;

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  invited_by uuid references public.users(id) on delete set null,
  unique (team_id, user_id)
);

create index if not exists team_members_team_id_idx on public.team_members(team_id);
create index if not exists team_members_user_id_idx on public.team_members(user_id);

alter table public.team_invites add column if not exists email text;
alter table public.team_invites add column if not exists token uuid;
alter table public.team_invites add column if not exists role text not null default 'member';
alter table public.team_invites add column if not exists invited_by uuid references public.users(id) on delete cascade;
alter table public.team_invites add column if not exists accepted_at timestamptz;
alter table public.team_invites add column if not exists status text not null default 'pending';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_invites'
      and column_name = 'created_by'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.team_invites alter column created_by drop not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_invites'
      and column_name = 'token'
  ) then
    execute 'update public.team_invites set token = gen_random_uuid() where token is null';
    execute 'alter table public.team_invites alter column token set not null';
  end if;
end;
$$;

alter table public.team_invites drop constraint if exists team_invites_role_check;
alter table public.team_invites add constraint team_invites_role_check check (role in ('admin', 'member', 'viewer'));

alter table public.team_invites drop constraint if exists team_invites_status_check;
alter table public.team_invites add constraint team_invites_status_check check (status in ('pending', 'accepted', 'expired', 'revoked'));

create unique index if not exists team_invites_token_unique_idx on public.team_invites(token);
create index if not exists team_invites_team_id_status_idx on public.team_invites(team_id, status);
create index if not exists team_invites_email_idx on public.team_invites(email);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read, created_at desc);

grant select, insert, update, delete on table public.team_members to authenticated;
grant select, insert, update, delete on table public.team_invites to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'northwatch_app') then
    execute 'grant select, insert, update, delete on table public.team_members to northwatch_app';
    execute 'grant select, insert, update, delete on table public.team_invites to northwatch_app';
    execute 'grant select, insert, update, delete on table public.notifications to northwatch_app';
  end if;
end;
$$;

alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "teams_select_member_or_owner" on public.teams;
create policy "teams_select_member_or_owner"
on public.teams
for select
using (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
  or public.northwatch_team_membership_exists(id)
  or exists (
    select 1
    from public.team_invites as invite
    where invite.team_id = teams.id
      and invite.token::text = current_setting('app.current_invite_token', true)
      and invite.status in ('pending', 'accepted')
  )
);

drop policy if exists team_members_select_member on public.team_members;
create policy team_members_select_member
on public.team_members
for select
using (
  user_id = public.northwatch_app_user_id()
  or public.northwatch_team_membership_exists(team_id)
  or public.northwatch_team_owner_matches(team_id)
);

drop policy if exists team_members_insert_owner_or_invited_user on public.team_members;
create policy team_members_insert_owner_or_invited_user
on public.team_members
for insert
with check (
  (user_id = public.northwatch_app_user_id() and role = 'owner' and public.northwatch_team_owner_matches(team_id))
  or public.northwatch_team_membership_exists(team_id)
);

drop policy if exists team_members_update_admin on public.team_members;
create policy team_members_update_admin
on public.team_members
for update
using (public.northwatch_team_membership_exists(team_id))
with check (public.northwatch_team_membership_exists(team_id));

drop policy if exists team_members_delete_admin_or_self on public.team_members;
create policy team_members_delete_admin_or_self
on public.team_members
for delete
using (
  user_id = public.northwatch_app_user_id()
  or public.northwatch_team_membership_exists(team_id)
);

drop policy if exists team_invites_select_admin on public.team_invites;
drop policy if exists team_invites_select_owner on public.team_invites;
create policy team_invites_select_admin
on public.team_invites
for select
using (
  public.northwatch_team_membership_exists(team_id)
  or token::text = current_setting('app.current_invite_token', true)
);

drop policy if exists team_invites_insert_admin on public.team_invites;
drop policy if exists team_invites_insert_owner on public.team_invites;
create policy team_invites_insert_admin
on public.team_invites
for insert
with check (
  invited_by = public.northwatch_app_user_id()
  and public.northwatch_team_membership_exists(team_id)
);

drop policy if exists team_invites_update_admin on public.team_invites;
drop policy if exists team_invites_update_owner on public.team_invites;
drop policy if exists team_invites_update_admin_or_accepting_user on public.team_invites;
create policy team_invites_update_admin_or_accepting_user
on public.team_invites
for update
using (
  public.northwatch_team_membership_exists(team_id)
  or token::text = current_setting('app.current_invite_token', true)
)
with check (
  public.northwatch_team_membership_exists(team_id)
  or token::text = current_setting('app.current_invite_token', true)
);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (user_id = public.northwatch_app_user_id());

drop policy if exists notifications_insert_system on public.notifications;
create policy notifications_insert_system
on public.notifications
for insert
with check (user_id is not null);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
using (user_id = public.northwatch_app_user_id())
with check (user_id = public.northwatch_app_user_id());
