create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  is_active boolean not null default true,
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_format check (position('@' in email) > 1)
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_jti text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  remember_me boolean not null default true,
  ip_address text,
  user_agent text
);

create index if not exists user_sessions_user_id_idx on user_sessions(user_id);
create index if not exists user_sessions_token_jti_idx on user_sessions(token_jti);
create index if not exists user_sessions_active_idx on user_sessions(user_id, expires_at) where revoked_at is null;

create table if not exists auth_login_failures (
  id bigserial primary key,
  ip_address text not null,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_failures_ip_created_at_idx on auth_login_failures(ip_address, created_at desc);

create or replace function set_northwatch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Untitled',
  token_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table kanban_cards add column if not exists user_id uuid;
alter table projects add column if not exists user_id uuid;
alter table content_queue add column if not exists user_id uuid;
alter table documents add column if not exists user_id uuid;
alter table activity_feed add column if not exists user_id uuid;
alter table agent_configs add column if not exists user_id uuid;
alter table api_tokens add column if not exists user_id uuid;

alter table kanban_cards alter column user_id set not null;
alter table projects alter column user_id set not null;
alter table content_queue alter column user_id set not null;
alter table documents alter column user_id set not null;
alter table activity_feed alter column user_id set not null;
alter table agent_configs alter column user_id set not null;
alter table api_tokens alter column user_id set not null;

create index if not exists kanban_cards_user_id_idx on kanban_cards(user_id);
create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists content_queue_user_id_idx on content_queue(user_id);
create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists activity_feed_user_id_idx on activity_feed(user_id);
create index if not exists agent_configs_user_id_idx on agent_configs(user_id);
create unique index if not exists agent_configs_user_telegram_unique on agent_configs(user_id) where title = 'telegram_bot';
create index if not exists api_tokens_user_id_idx on api_tokens(user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['kanban_cards', 'projects', 'content_queue', 'documents', 'activity_feed', 'agent_configs', 'api_tokens']
  loop
    if not exists (
      select 1
      from pg_constraint
      where conname = table_name || '_user_id_fkey'
    ) then
      execute format('alter table %I add constraint %I foreign key (user_id) references users(id) on delete cascade', table_name, table_name || '_user_id_fkey');
    end if;

    execute format('create index if not exists %I on %I(user_id)', table_name || '_user_id_idx', table_name);
    execute format('drop trigger if exists %I on %I', table_name || '_set_updated_at', table_name);
    execute format('create trigger %I before update on %I for each row execute function set_northwatch_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end;
$$;

alter table kanban_cards enable row level security;
alter table kanban_cards force row level security;
drop policy if exists kanban_cards_select_own on kanban_cards;
create policy kanban_cards_select_own on kanban_cards
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists kanban_cards_insert_own on kanban_cards;
create policy kanban_cards_insert_own on kanban_cards
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists kanban_cards_update_own on kanban_cards;
create policy kanban_cards_update_own on kanban_cards
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists kanban_cards_delete_own on kanban_cards;
create policy kanban_cards_delete_own on kanban_cards
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table projects enable row level security;
alter table projects force row level security;
drop policy if exists projects_select_own on projects;
create policy projects_select_own on projects
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists projects_insert_own on projects;
create policy projects_insert_own on projects
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists projects_update_own on projects;
create policy projects_update_own on projects
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists projects_delete_own on projects;
create policy projects_delete_own on projects
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table content_queue enable row level security;
alter table content_queue force row level security;
drop policy if exists content_queue_select_own on content_queue;
create policy content_queue_select_own on content_queue
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists content_queue_insert_own on content_queue;
create policy content_queue_insert_own on content_queue
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists content_queue_update_own on content_queue;
create policy content_queue_update_own on content_queue
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists content_queue_delete_own on content_queue;
create policy content_queue_delete_own on content_queue
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table documents enable row level security;
alter table documents force row level security;
drop policy if exists documents_select_own on documents;
create policy documents_select_own on documents
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists documents_insert_own on documents;
create policy documents_insert_own on documents
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists documents_update_own on documents;
create policy documents_update_own on documents
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists documents_delete_own on documents;
create policy documents_delete_own on documents
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table activity_feed enable row level security;
alter table activity_feed force row level security;
drop policy if exists activity_feed_select_own on activity_feed;
create policy activity_feed_select_own on activity_feed
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists activity_feed_insert_own on activity_feed;
create policy activity_feed_insert_own on activity_feed
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists activity_feed_update_own on activity_feed;
create policy activity_feed_update_own on activity_feed
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists activity_feed_delete_own on activity_feed;
create policy activity_feed_delete_own on activity_feed
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table agent_configs enable row level security;
alter table agent_configs force row level security;
drop policy if exists agent_configs_select_own on agent_configs;
create policy agent_configs_select_own on agent_configs
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists agent_configs_insert_own on agent_configs;
create policy agent_configs_insert_own on agent_configs
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists agent_configs_update_own on agent_configs;
create policy agent_configs_update_own on agent_configs
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists agent_configs_delete_own on agent_configs;
create policy agent_configs_delete_own on agent_configs
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table api_tokens enable row level security;
alter table api_tokens force row level security;
drop policy if exists api_tokens_select_own on api_tokens;
create policy api_tokens_select_own on api_tokens
for select
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists api_tokens_insert_own on api_tokens;
create policy api_tokens_insert_own on api_tokens
for insert
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists api_tokens_update_own on api_tokens;
create policy api_tokens_update_own on api_tokens
for update
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists api_tokens_delete_own on api_tokens;
create policy api_tokens_delete_own on api_tokens
for delete
using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

create or replace function public.northwatch_legacy_command_deck_for_email(check_email text)
returns table(deck jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  select cd.deck, cd.updated_at
  from public.command_decks cd
  join auth.users au on au.id = cd.user_id
  where lower(au.email) = lower(check_email)
  order by cd.updated_at desc
  limit 1;
$$;

grant execute on function public.northwatch_legacy_command_deck_for_email(text) to northwatch_app;
