create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  platform text,
  report_month date,
  source text default 'supermetrics_csv',
  status text,
  spend_airbyte numeric,
  spend_comparison numeric,
  spend_diff numeric,
  spend_diff_percent numeric,
  clicks_airbyte bigint,
  clicks_comparison bigint,
  clicks_diff bigint,
  clicks_diff_percent numeric,
  impressions_airbyte bigint,
  impressions_comparison bigint,
  impressions_diff bigint,
  impressions_diff_percent numeric,
  conversions_airbyte numeric,
  conversions_comparison numeric,
  conversions_diff numeric,
  conversions_diff_percent numeric,
  conversion_value_airbyte numeric,
  conversion_value_comparison numeric,
  conversion_value_diff numeric,
  conversion_value_diff_percent numeric,
  raw_payload jsonb,
  created_at timestamptz default now()
);

create index validation_runs_client_created_idx on public.validation_runs(client_id, created_at desc);
create index validation_runs_client_month_platform_idx on public.validation_runs(client_id, report_month, platform);

alter table public.validation_runs enable row level security;

create policy "authenticated users can read validation runs"
on public.validation_runs for select
to authenticated
using (true);

create policy "service role can manage validation runs"
on public.validation_runs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
