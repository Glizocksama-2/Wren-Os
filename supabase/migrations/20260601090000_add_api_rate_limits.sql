create table if not exists public.api_rate_limits (
  bucket_key text not null,
  route_group text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, route_group)
);

create index if not exists api_rate_limits_updated_at_idx
on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon, authenticated;

comment on table public.api_rate_limits is
  'Northwatch backend-owned shared API rate-limit buckets. Direct client access is denied by RLS and revoked grants.';
