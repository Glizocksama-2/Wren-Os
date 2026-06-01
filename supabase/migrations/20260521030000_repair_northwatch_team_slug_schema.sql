create extension if not exists pgcrypto;

alter table public.teams add column if not exists slug text;
alter table public.teams add column if not exists owner_id uuid references public.users(id) on delete cascade;
alter table public.teams add column if not exists member_limit integer not null default 10;
alter table public.teams add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

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
    execute 'update public.teams set owner_id = created_by where owner_id is null and exists (select 1 from public.users where users.id = teams.created_by)';
  end if;
end;
$$;

create or replace function public.northwatch_backfill_team_slugs()
returns void
language plpgsql
as $$
begin
  update public.teams
  set slug =
    left(
      coalesce(
        nullif(trim(both '-' from regexp_replace(lower(trim(coalesce(name, 'team'))), '[^a-z0-9]+', '-', 'g')), ''),
        'team'
      ),
      63
    ) || '-' || left(replace(id::text, '-', ''), 8)
  where slug is null or btrim(slug) = '';

  update public.teams
  set slug = trim(both '-' from regexp_replace(lower(trim(slug)), '[^a-z0-9]+', '-', 'g'))
  where slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';

  update public.teams
  set slug = 'team-' || left(replace(id::text, '-', ''), 8)
  where slug is null or slug = '' or slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';

  with ranked as (
    select id, slug, row_number() over (partition by slug order by created_at, id) as slug_rank
    from public.teams
  )
  update public.teams
  set slug = left(ranked.slug, 70) || '-' || left(replace(teams.id::text, '-', ''), 8)
  from ranked
  where teams.id = ranked.id
    and ranked.slug_rank > 1;
end;
$$;

select public.northwatch_backfill_team_slugs();
drop function if exists public.northwatch_backfill_team_slugs();

alter table public.teams alter column slug set not null;
alter table public.teams drop constraint if exists teams_name_check;
alter table public.teams drop constraint if exists teams_name_length_check;
alter table public.teams add constraint teams_name_length_check check (char_length(trim(name)) between 1 and 120);
alter table public.teams drop constraint if exists teams_slug_format_check;
alter table public.teams add constraint teams_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
alter table public.teams drop constraint if exists teams_member_limit_check;
alter table public.teams add constraint teams_member_limit_check check (member_limit between 1 and 100);

create index if not exists teams_owner_id_idx on public.teams(owner_id);
create index if not exists teams_slug_idx on public.teams(slug);
create unique index if not exists teams_slug_unique_idx on public.teams(slug);
