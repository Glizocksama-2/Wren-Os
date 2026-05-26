create extension if not exists pgcrypto;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references users(id) on delete cascade,
  member_limit integer not null default 10 check (member_limit between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table teams add column if not exists slug text;
alter table teams add column if not exists owner_id uuid references users(id) on delete cascade;
alter table teams add column if not exists member_limit integer not null default 10;
alter table teams add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'teams'
      and column_name = 'created_by'
  ) then
    execute 'alter table teams alter column created_by drop not null';
    execute 'alter table teams drop constraint if exists teams_created_by_fkey';
    execute 'update teams set owner_id = created_by where owner_id is null and exists (select 1 from users where users.id = teams.created_by)';
  end if;
end;
$$;

create or replace function northwatch_backfill_team_slugs()
returns void
language plpgsql
as $$
begin
  update teams
  set slug =
    left(
      coalesce(
        nullif(trim(both '-' from regexp_replace(lower(trim(coalesce(name, 'team'))), '[^a-z0-9]+', '-', 'g')), ''),
        'team'
      ),
      63
    ) || '-' || left(replace(id::text, '-', ''), 8)
  where slug is null or btrim(slug) = '';

  update teams
  set slug = trim(both '-' from regexp_replace(lower(trim(slug)), '[^a-z0-9]+', '-', 'g'))
  where slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';

  update teams
  set slug = 'team-' || left(replace(id::text, '-', ''), 8)
  where slug is null or slug = '' or slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';

  with ranked as (
    select id, slug, row_number() over (partition by slug order by created_at, id) as slug_rank
    from teams
  )
  update teams
  set slug = left(ranked.slug, 70) || '-' || left(replace(teams.id::text, '-', ''), 8)
  from ranked
  where teams.id = ranked.id
    and ranked.slug_rank > 1;
end;
$$;

select northwatch_backfill_team_slugs();
drop function if exists northwatch_backfill_team_slugs();

alter table teams alter column slug set not null;
alter table teams drop constraint if exists teams_name_check;
alter table teams drop constraint if exists teams_name_length_check;
alter table teams add constraint teams_name_length_check check (char_length(trim(name)) between 1 and 120);
alter table teams drop constraint if exists teams_slug_format_check;
alter table teams add constraint teams_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
alter table teams drop constraint if exists teams_member_limit_check;
alter table teams add constraint teams_member_limit_check check (member_limit between 1 and 100);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  invited_by uuid references users(id) on delete set null,
  unique (team_id, user_id)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  token uuid not null unique,
  role text not null check (role in ('admin', 'member', 'viewer')),
  invited_by uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  accepted_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on teams(owner_id);
create index if not exists teams_slug_idx on teams(slug);
create unique index if not exists teams_slug_unique_idx on teams(slug);
create index if not exists team_members_team_id_idx on team_members(team_id);
create index if not exists team_members_user_id_idx on team_members(user_id);
create index if not exists team_invites_team_id_status_idx on team_invites(team_id, status);
create index if not exists team_invites_email_idx on team_invites(email);
create index if not exists notifications_user_read_idx on notifications(user_id, is_read, created_at desc);

drop trigger if exists teams_set_updated_at on teams;
create trigger teams_set_updated_at before update on teams for each row execute function set_northwatch_updated_at();

create or replace function northwatch_current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

create or replace function northwatch_current_invite_token()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_invite_token', true), '')::uuid;
$$;

create or replace function northwatch_team_role(check_team_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from team_members tm
  where tm.team_id = check_team_id
    and tm.user_id = northwatch_current_user_id()
  limit 1;
$$;

create or replace function northwatch_team_role_allowed(check_team_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(northwatch_team_role(check_team_id) = any(allowed_roles), false);
$$;

create or replace function northwatch_team_owner_is_current(check_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from teams t
    where t.id = check_team_id
      and t.owner_id = northwatch_current_user_id()
  );
$$;

create or replace function northwatch_team_owner_count(check_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from team_members
  where team_id = check_team_id and role = 'owner';
$$;

alter table kanban_cards add column if not exists workspace_type text not null default 'personal';
alter table kanban_cards add column if not exists team_id uuid references teams(id) on delete cascade;
alter table projects add column if not exists workspace_type text not null default 'personal';
alter table projects add column if not exists team_id uuid references teams(id) on delete cascade;
alter table documents add column if not exists workspace_type text not null default 'personal';
alter table documents add column if not exists team_id uuid references teams(id) on delete cascade;
alter table content_queue add column if not exists workspace_type text not null default 'personal';
alter table content_queue add column if not exists team_id uuid references teams(id) on delete cascade;
alter table activity_feed add column if not exists workspace_type text not null default 'personal';
alter table activity_feed add column if not exists team_id uuid references teams(id) on delete cascade;
alter table agent_configs add column if not exists workspace_type text not null default 'personal';
alter table agent_configs add column if not exists team_id uuid references teams(id) on delete cascade;

create index if not exists kanban_cards_team_workspace_idx on kanban_cards(team_id, updated_at desc) where workspace_type = 'team';
create index if not exists projects_team_workspace_idx on projects(team_id, updated_at desc) where workspace_type = 'team';
create index if not exists documents_team_workspace_idx on documents(team_id, updated_at desc) where workspace_type = 'team';
create index if not exists content_queue_team_workspace_idx on content_queue(team_id, updated_at desc) where workspace_type = 'team';
create index if not exists activity_feed_team_workspace_idx on activity_feed(team_id, updated_at desc) where workspace_type = 'team';
create index if not exists agent_configs_team_workspace_idx on agent_configs(team_id, updated_at desc) where workspace_type = 'team';

-- The dynamic policy block below creates:
-- kanban_cards_select_workspace, kanban_cards_insert_workspace, kanban_cards_update_workspace, kanban_cards_delete_workspace
-- projects_select_workspace, projects_insert_workspace, projects_update_workspace, projects_delete_workspace
-- documents_select_workspace, documents_insert_workspace, documents_update_workspace, documents_delete_workspace
-- content_queue_select_workspace, content_queue_insert_workspace, content_queue_update_workspace, content_queue_delete_workspace
-- activity_feed_select_workspace, activity_feed_insert_workspace, activity_feed_update_workspace, activity_feed_delete_workspace
-- agent_configs_select_workspace, agent_configs_insert_workspace, agent_configs_update_workspace, agent_configs_delete_workspace

do $$
declare
  table_name text;
begin
  foreach table_name in array array['kanban_cards', 'projects', 'documents', 'content_queue', 'activity_feed', 'agent_configs']
  loop
    execute format('alter table %I add column if not exists workspace_type text not null default ''personal'' check (workspace_type in (''personal'', ''team''))', table_name);
    execute format('alter table %I add column if not exists team_id uuid references teams(id) on delete cascade', table_name);
    execute format('create index if not exists %I on %I(team_id, updated_at desc) where workspace_type = ''team''', table_name || '_team_workspace_idx', table_name);
    execute format('create index if not exists %I on %I(user_id, updated_at desc) where workspace_type = ''personal''', table_name || '_personal_workspace_idx', table_name);
    execute format('alter table %I drop constraint if exists %I', table_name, table_name || '_workspace_scope_check');
    execute format(
      'alter table %I add constraint %I check ((workspace_type = ''personal'' and team_id is null) or (workspace_type = ''team'' and team_id is not null))',
      table_name,
      table_name || '_workspace_scope_check'
    );
  end loop;
end;
$$;

alter table kanban_cards add column if not exists assignee_id uuid references users(id) on delete set null;
alter table projects add column if not exists assignee_id uuid references users(id) on delete set null;
alter table documents add column if not exists last_edited_by uuid references users(id) on delete set null;
alter table content_queue add column if not exists added_by uuid references users(id) on delete set null;
alter table activity_feed add column if not exists actor_id uuid references users(id) on delete set null;

alter table teams enable row level security;
alter table teams force row level security;
alter table team_members enable row level security;
alter table team_members force row level security;
alter table team_invites enable row level security;
alter table team_invites force row level security;
alter table notifications enable row level security;
alter table notifications force row level security;

drop policy if exists teams_select_member on teams;
create policy teams_select_member on teams
for select
using (northwatch_team_role_allowed(id, array['owner', 'admin', 'member', 'viewer']));

drop policy if exists teams_insert_owner on teams;
create policy teams_insert_owner on teams
for insert
with check (owner_id = northwatch_current_user_id());

drop policy if exists teams_update_admin on teams;
create policy teams_update_admin on teams
for update
using (northwatch_team_role_allowed(id, array['owner', 'admin']))
with check (northwatch_team_role_allowed(id, array['owner', 'admin']));

drop policy if exists teams_delete_owner on teams;
create policy teams_delete_owner on teams
for delete
using (northwatch_team_role_allowed(id, array['owner']));

drop policy if exists team_members_select_member on team_members;
create policy team_members_select_member on team_members
for select
using (northwatch_team_role_allowed(team_id, array['owner', 'admin', 'member', 'viewer']));

drop policy if exists team_members_insert_owner_or_invited_user on team_members;
create policy team_members_insert_owner_or_invited_user on team_members
for insert
with check (
  (user_id = northwatch_current_user_id() and role = 'owner' and northwatch_team_owner_is_current(team_id))
  or (
    user_id = northwatch_current_user_id()
    and role <> 'owner'
    and exists (
      select 1
      from team_invites ti
      join users u on u.id = northwatch_current_user_id()
      where ti.team_id = team_members.team_id
        and ti.token::text = current_setting('app.current_invite_token', true)
        and ti.status = 'pending'
        and ti.expires_at > now()
        and lower(ti.email) = lower(u.email)
    )
  )
  or northwatch_team_role_allowed(team_id, array['owner', 'admin'])
);

drop policy if exists team_members_update_admin on team_members;
create policy team_members_update_admin on team_members
for update
using (northwatch_team_role_allowed(team_id, array['owner', 'admin']))
with check (
  northwatch_team_role_allowed(team_id, array['owner', 'admin'])
  and (role <> 'owner' or northwatch_team_owner_count(team_id) >= 1)
);

drop policy if exists team_members_delete_admin_or_self on team_members;
create policy team_members_delete_admin_or_self on team_members
for delete
using (
  (user_id = northwatch_current_user_id() and role <> 'owner')
  or (northwatch_team_role_allowed(team_id, array['owner', 'admin']) and role <> 'owner')
);

drop policy if exists team_invites_select_admin on team_invites;
create policy team_invites_select_admin on team_invites
for select
using (northwatch_team_role_allowed(team_id, array['owner', 'admin']));

drop policy if exists team_invites_select_pending_by_token on team_invites;
create policy team_invites_select_pending_by_token on team_invites
for select
using (
  status in ('pending', 'accepted')
  and token::text = current_setting('app.current_invite_token', true)
);

drop policy if exists team_invites_insert_admin on team_invites;
create policy team_invites_insert_admin on team_invites
for insert
with check (invited_by = northwatch_current_user_id() and northwatch_team_role_allowed(team_id, array['owner', 'admin']));

drop policy if exists team_invites_update_admin on team_invites;
drop policy if exists team_invites_update_admin_or_accepting_user on team_invites;
create policy team_invites_update_admin_or_accepting_user on team_invites
for update
using (
  northwatch_team_role_allowed(team_id, array['owner', 'admin'])
  or (
    status = 'pending'
    and expires_at > now()
    and token::text = current_setting('app.current_invite_token', true)
    and exists (
      select 1
      from users u
      where u.id = northwatch_current_user_id()
        and lower(u.email) = lower(team_invites.email)
    )
  )
)
with check (
  northwatch_team_role_allowed(team_id, array['owner', 'admin'])
  or (
    status = 'accepted'
    and token::text = current_setting('app.current_invite_token', true)
    and exists (
      select 1
      from users u
      where u.id = northwatch_current_user_id()
        and lower(u.email) = lower(team_invites.email)
    )
  )
);

drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
for select
using (user_id = northwatch_current_user_id());

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
for update
using (user_id = northwatch_current_user_id())
with check (user_id = northwatch_current_user_id());

drop policy if exists notifications_insert_system on notifications;
create policy notifications_insert_system on notifications
for insert
with check (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['kanban_cards', 'projects', 'documents', 'content_queue', 'activity_feed', 'agent_configs']
  loop
    execute format('drop policy if exists %I on %I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on %I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on %I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on %I', table_name || '_delete_own', table_name);

    execute format('drop policy if exists %I on %I', table_name || '_select_workspace', table_name);
    execute format(
      'create policy %I on %I for select using ((workspace_type = ''personal'' and user_id = northwatch_current_user_id()) or (workspace_type = ''team'' and northwatch_team_role_allowed(team_id, array[''owner'', ''admin'', ''member'', ''viewer''])))',
      table_name || '_select_workspace',
      table_name
    );

    execute format('drop policy if exists %I on %I', table_name || '_insert_workspace', table_name);
    execute format(
      'create policy %I on %I for insert with check ((workspace_type = ''personal'' and team_id is null and user_id = northwatch_current_user_id()) or (workspace_type = ''team'' and team_id is not null and user_id = northwatch_current_user_id() and northwatch_team_role_allowed(team_id, array[''owner'', ''admin'', ''member''])))',
      table_name || '_insert_workspace',
      table_name
    );

    execute format('drop policy if exists %I on %I', table_name || '_update_workspace', table_name);
    execute format(
      'create policy %I on %I for update using ((workspace_type = ''personal'' and user_id = northwatch_current_user_id()) or (workspace_type = ''team'' and northwatch_team_role_allowed(team_id, array[''owner'', ''admin'', ''member'']))) with check ((workspace_type = ''personal'' and user_id = northwatch_current_user_id()) or (workspace_type = ''team'' and northwatch_team_role_allowed(team_id, array[''owner'', ''admin'', ''member''])))',
      table_name || '_update_workspace',
      table_name
    );

    execute format('drop policy if exists %I on %I', table_name || '_delete_workspace', table_name);
    execute format(
      'create policy %I on %I for delete using ((workspace_type = ''personal'' and user_id = northwatch_current_user_id()) or (workspace_type = ''team'' and northwatch_team_role_allowed(team_id, array[''owner'', ''admin''])))',
      table_name || '_delete_workspace',
      table_name
    );
  end loop;
end;
$$;
