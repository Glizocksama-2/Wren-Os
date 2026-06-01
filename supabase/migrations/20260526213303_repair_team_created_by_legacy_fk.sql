do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teams'
      and column_name = 'created_by'
  ) then
    execute 'alter table public.teams alter column created_by drop not null';
  end if;
end;
$$;

alter table public.teams drop constraint if exists teams_created_by_fkey;

drop policy if exists "teams_insert_creator" on public.teams;
drop policy if exists "teams_insert_owner_or_creator" on public.teams;
create policy "teams_insert_owner_or_creator"
on public.teams
for insert
with check (
  owner_id = public.northwatch_app_user_id()
  or created_by = public.northwatch_app_user_id()
);
