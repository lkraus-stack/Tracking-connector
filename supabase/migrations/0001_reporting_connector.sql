create type public.ad_platform as enum ('tiktok', 'bing');
create type public.connector_runtime_status as enum ('healthy', 'warning', 'failed', 'paused');
create type public.connector_schedule as enum ('manual', 'daily', 'weekly', 'monthly');
create type public.airbyte_job_status as enum ('running', 'succeeded', 'failed', 'cancelled', 'incomplete');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner text not null,
  timezone text not null default 'Europe/Berlin',
  monthly_report_day integer not null default 3 check (monthly_report_day between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform public.ad_platform not null,
  external_account_id text not null,
  display_name text not null,
  currency text not null default 'EUR',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_account_id)
);

create table public.airbyte_connector_mappings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  marketing_account_id uuid not null references public.marketing_accounts(id) on delete cascade,
  platform public.ad_platform not null,
  airbyte_connection_id text not null unique,
  airbyte_connection_name text not null,
  destination_dataset text not null default 'airbyte_raw',
  destination_table text not null,
  schedule public.connector_schedule not null default 'monthly',
  lookback_days integer not null default 45 check (lookback_days >= 0),
  status public.connector_runtime_status not null default 'paused',
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  next_recommended_sync_at timestamptz,
  freshness_hours integer not null default 999 check (freshness_hours >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.airbyte_sync_jobs (
  id text primary key,
  connection_id text not null references public.airbyte_connector_mappings(airbyte_connection_id) on delete cascade,
  status public.airbyte_job_status not null,
  job_type text not null default 'sync',
  started_at timestamptz not null,
  ended_at timestamptz,
  records_committed bigint not null default 0 check (records_committed >= 0),
  bytes_committed bigint not null default 0 check (bytes_committed >= 0),
  failure_reason text,
  created_at timestamptz not null default now()
);

create table public.connector_status_events (
  id bigint generated always as identity primary key,
  connection_id text not null references public.airbyte_connector_mappings(airbyte_connection_id) on delete cascade,
  status public.connector_runtime_status not null,
  message text not null,
  observed_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index airbyte_connector_mappings_client_idx on public.airbyte_connector_mappings(client_id);
create index airbyte_sync_jobs_connection_started_idx on public.airbyte_sync_jobs(connection_id, started_at desc);
create index connector_status_events_connection_observed_idx on public.connector_status_events(connection_id, observed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger marketing_accounts_updated_at before update on public.marketing_accounts for each row execute function public.set_updated_at();
create trigger connector_mappings_updated_at before update on public.airbyte_connector_mappings for each row execute function public.set_updated_at();
create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();

create or replace view public.vw_admin_connector_health as
select
  c.id as client_id,
  c.name as client_name,
  m.platform,
  m.airbyte_connection_id,
  m.airbyte_connection_name,
  m.destination_dataset,
  m.destination_table,
  m.status,
  m.freshness_hours,
  m.last_successful_sync_at,
  j.id as latest_job_id,
  j.status as latest_job_status,
  j.ended_at as latest_job_ended_at,
  case
    when m.status = 'failed' then true
    when m.freshness_hours > 72 then true
    when j.status = 'failed' then true
    else false
  end as needs_attention
from public.airbyte_connector_mappings m
join public.clients c on c.id = m.client_id
left join lateral (
  select *
  from public.airbyte_sync_jobs j
  where j.connection_id = m.airbyte_connection_id
  order by j.started_at desc
  limit 1
) j on true;

alter table public.clients enable row level security;
alter table public.marketing_accounts enable row level security;
alter table public.airbyte_connector_mappings enable row level security;
alter table public.airbyte_sync_jobs enable row level security;
alter table public.connector_status_events enable row level security;
alter table public.user_profiles enable row level security;

create policy "authenticated users can read admin metadata"
on public.clients for select
to authenticated
using (true);

create policy "authenticated users can read marketing accounts"
on public.marketing_accounts for select
to authenticated
using (true);

create policy "authenticated users can read connector mappings"
on public.airbyte_connector_mappings for select
to authenticated
using (true);

create policy "authenticated users can read sync jobs"
on public.airbyte_sync_jobs for select
to authenticated
using (true);

create policy "authenticated users can read connector events"
on public.connector_status_events for select
to authenticated
using (true);

create policy "service role can manage clients"
on public.clients for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage marketing accounts"
on public.marketing_accounts for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage connector mappings"
on public.airbyte_connector_mappings for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage sync jobs"
on public.airbyte_sync_jobs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage connector events"
on public.connector_status_events for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
