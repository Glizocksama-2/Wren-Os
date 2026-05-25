create extension if not exists pgcrypto;

alter table public.teams add column if not exists slug text;
alter table public.teams add column if not exists owner_id uuid;
alter table public.teams add column if not exists member_limit integer not null default 10;
alter table public.teams add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());
alter table public.teams add column if not exists created_by uuid;

update public.teams
set owner_id = coalesce(owner_id, created_by)
where owner_id is null and created_by is not null;

update public.teams
set created_by = coalesce(created_by, owner_id)
where created_by is null and owner_id is not null;

create or replace function public.northwatch_app_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    (select auth.uid())
  );
$$;

grant execute on function public.northwatch_app_user_id() to authenticated;
grant select, insert, update, delete on table public.teams to authenticated;

alter table public.teams enable row level security;

drop policy if exists "teams_select_member_or_creator" on public.teams;
drop policy if exists "teams_select_member_or_owner" on public.teams;
create policy "teams_select_member_or_owner"
on public.teams
for select
to authenticated
using (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
  or id in (
    select membership.team_id
    from public.team_memberships as membership
    where membership.user_id = public.northwatch_app_user_id()
  )
);

drop policy if exists "teams_insert_creator" on public.teams;
drop policy if exists "teams_insert_owner_or_creator" on public.teams;
create policy "teams_insert_owner_or_creator"
on public.teams
for insert
to authenticated
with check (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
);

drop policy if exists "teams_update_owner" on public.teams;
drop policy if exists "teams_update_owner_or_creator" on public.teams;
create policy "teams_update_owner_or_creator"
on public.teams
for update
to authenticated
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
to authenticated
using (
  created_by = public.northwatch_app_user_id()
  or owner_id = public.northwatch_app_user_id()
);
