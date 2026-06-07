create type public.reporting_destination as enum ('bigquery', 'supabase');
create type public.reporting_connector_status as enum ('healthy', 'degraded', 'paused', 'failed');
create type public.reporting_sync_status as enum ('running', 'succeeded', 'warning', 'failed');
create type public.reporting_schema_drift as enum ('none', 'additive', 'breaking');
create type public.reporting_check_status as enum ('ok', 'warning', 'error', 'missing');

create table public.reporting_connectors (
  id text primary key,
  name text not null,
  source text not null,
  destination public.reporting_destination not null,
  destination_table text not null,
  status public.reporting_connector_status not null default 'paused',
  owner text not null,
  cadence text not null,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  sla_minutes integer not null check (sla_minutes > 0),
  freshness_minutes integer not null default 0 check (freshness_minutes >= 0),
  records_24h bigint not null default 0 check (records_24h >= 0),
  error_rate numeric(8, 6) not null default 0 check (error_rate >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reporting_sync_runs (
  id text primary key,
  connector_id text not null references public.reporting_connectors(id) on delete cascade,
  status public.reporting_sync_status not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  records_extracted bigint not null default 0 check (records_extracted >= 0),
  records_loaded bigint not null default 0 check (records_loaded >= 0),
  bytes_loaded bigint not null default 0 check (bytes_loaded >= 0),
  message text not null default '',
  created_at timestamptz not null default now()
);

create table public.reporting_connector_tables (
  id text primary key,
  connector_id text not null references public.reporting_connectors(id) on delete cascade,
  destination public.reporting_destination not null,
  table_name text not null,
  row_count bigint not null default 0 check (row_count >= 0),
  freshness_minutes integer not null default 0 check (freshness_minutes >= 0),
  schema_drift public.reporting_schema_drift not null default 'none',
  checksum_status public.reporting_check_status not null default 'ok',
  observed_at timestamptz not null default now()
);

create table public.reporting_connector_audit (
  id bigint generated always as identity primary key,
  connector_id text not null references public.reporting_connectors(id) on delete cascade,
  loaded_at timestamptz not null default now(),
  row_count bigint not null default 0,
  checksum text,
  notes text
);

create index reporting_sync_runs_connector_started_idx
  on public.reporting_sync_runs (connector_id, started_at desc);

create index reporting_connector_tables_connector_idx
  on public.reporting_connector_tables (connector_id);

create or replace function public.set_reporting_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reporting_connectors_updated_at
before update on public.reporting_connectors
for each row
execute function public.set_reporting_updated_at();

create or replace view public.reporting_connector_health as
select
  c.id,
  c.name,
  c.source,
  c.destination,
  c.destination_table,
  c.status,
  c.owner,
  c.freshness_minutes,
  c.sla_minutes,
  case
    when c.status = 'failed' then 'incident'
    when c.freshness_minutes > c.sla_minutes then 'late'
    when c.status = 'degraded' then 'watch'
    else 'clear'
  end as operational_state,
  max(r.finished_at) as latest_finished_at,
  count(r.id) filter (where r.started_at > now() - interval '24 hours') as runs_24h
from public.reporting_connectors c
left join public.reporting_sync_runs r on r.connector_id = c.id
group by c.id;

alter table public.reporting_connectors enable row level security;
alter table public.reporting_sync_runs enable row level security;
alter table public.reporting_connector_tables enable row level security;
alter table public.reporting_connector_audit enable row level security;

create policy "service role can manage reporting connectors"
on public.reporting_connectors
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage reporting sync runs"
on public.reporting_sync_runs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage reporting tables"
on public.reporting_connector_tables
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role can manage reporting audit"
on public.reporting_connector_audit
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
