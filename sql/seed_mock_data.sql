insert into public.clients (id, name, slug, owner, timezone, monthly_report_day)
values
  ('11111111-1111-1111-1111-111111111111', 'Nordstern Bikes', 'nordstern-bikes', 'Performance Team A', 'Europe/Berlin', 3),
  ('22222222-2222-2222-2222-222222222222', 'Atelier Forma', 'atelier-forma', 'Performance Team B', 'Europe/Berlin', 4)
on conflict (slug) do update set
  name = excluded.name,
  owner = excluded.owner,
  updated_at = now();

insert into public.marketing_accounts (
  id,
  client_id,
  platform,
  external_account_id,
  display_name,
  currency
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    'tiktok',
    '71122334455',
    'Nordstern TikTok DE',
    'EUR'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '11111111-1111-1111-1111-111111111111',
    'bing',
    'MS-998877',
    'Nordstern Microsoft Ads',
    'EUR'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '22222222-2222-2222-2222-222222222222',
    'tiktok',
    '70099112233',
    'Atelier TikTok DACH',
    'EUR'
  )
on conflict (platform, external_account_id) do update set
  display_name = excluded.display_name,
  updated_at = now();

insert into public.airbyte_connector_mappings (
  client_id,
  marketing_account_id,
  platform,
  airbyte_connection_id,
  airbyte_connection_name,
  destination_dataset,
  destination_table,
  schedule,
  lookback_days,
  status,
  last_sync_at,
  last_successful_sync_at,
  next_recommended_sync_at,
  freshness_hours
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'tiktok',
    'ab-conn-tiktok-nordstern',
    'TikTok Marketing - Nordstern',
    'airbyte_raw',
    '_airbyte_raw_tiktok_ads_reports',
    'daily',
    30,
    'healthy',
    '2026-06-07T04:20:00Z',
    '2026-06-07T04:20:00Z',
    '2026-06-08T04:20:00Z',
    3
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'bing',
    'ab-conn-bing-nordstern',
    'Bing Ads - Nordstern',
    'airbyte_raw',
    '_airbyte_raw_bing_campaign_performance_daily',
    'weekly',
    45,
    'warning',
    '2026-06-05T01:14:00Z',
    '2026-06-05T01:14:00Z',
    '2026-06-08T01:14:00Z',
    55
  )
on conflict (airbyte_connection_id) do update set
  status = excluded.status,
  freshness_hours = excluded.freshness_hours,
  updated_at = now();

insert into public.airbyte_sync_jobs (
  id,
  connection_id,
  status,
  job_type,
  started_at,
  ended_at,
  records_committed,
  bytes_committed,
  failure_reason
)
values
  (
    'job-2451',
    'ab-conn-tiktok-nordstern',
    'succeeded',
    'sync',
    '2026-06-07T04:14:00Z',
    '2026-06-07T04:20:00Z',
    8421,
    6290000,
    null
  ),
  (
    'job-2439',
    'ab-conn-bing-nordstern',
    'succeeded',
    'sync',
    '2026-06-05T01:04:00Z',
    '2026-06-05T01:14:00Z',
    3192,
    2784000,
    null
  )
on conflict (id) do update set
  status = excluded.status,
  records_committed = excluded.records_committed,
  bytes_committed = excluded.bytes_committed;
