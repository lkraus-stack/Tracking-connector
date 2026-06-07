create schema if not exists `airbyte_raw`
options (
  description = 'Raw tables written by Airbyte TikTok Marketing and Bing Ads sources'
);

create schema if not exists `marketing_reporting`
options (
  description = 'Looker Studio-ready paid ads reporting views'
);

create table if not exists `marketing_reporting.client_account_map` (
  client_id string not null,
  client_name string not null,
  platform string not null,
  account_id string not null,
  account_name string not null,
  currency string not null,
  active bool not null
);

create or replace view `marketing_reporting.vw_paid_ads_daily` as
with tiktok as (
  select
    date(coalesce(
      json_value(_airbyte_data, '$.stat_time_day'),
      json_value(_airbyte_data, '$.date')
    )) as date,
    'tiktok' as platform,
    coalesce(
      json_value(_airbyte_data, '$.advertiser_id'),
      json_value(_airbyte_data, '$.account_id')
    ) as account_id,
    json_value(_airbyte_data, '$.campaign_id') as campaign_id,
    json_value(_airbyte_data, '$.campaign_name') as campaign_name,
    safe_cast(json_value(_airbyte_data, '$.impressions') as int64) as impressions,
    safe_cast(json_value(_airbyte_data, '$.clicks') as int64) as clicks,
    safe_cast(json_value(_airbyte_data, '$.spend') as numeric) as cost,
    safe_cast(coalesce(json_value(_airbyte_data, '$.conversions'), json_value(_airbyte_data, '$.conversion')) as numeric) as conversions,
    safe_cast(coalesce(json_value(_airbyte_data, '$.revenue'), json_value(_airbyte_data, '$.total_purchase_value')) as numeric) as revenue
  from `airbyte_raw._airbyte_raw_tiktok_ads_reports`
),
bing as (
  select
    date(coalesce(
      json_value(_airbyte_data, '$.TimePeriod'),
      json_value(_airbyte_data, '$.time_period'),
      json_value(_airbyte_data, '$.date')
    )) as date,
    'bing' as platform,
    coalesce(
      json_value(_airbyte_data, '$.AccountId'),
      json_value(_airbyte_data, '$.account_id')
    ) as account_id,
    coalesce(json_value(_airbyte_data, '$.CampaignId'), json_value(_airbyte_data, '$.campaign_id')) as campaign_id,
    coalesce(json_value(_airbyte_data, '$.CampaignName'), json_value(_airbyte_data, '$.campaign_name')) as campaign_name,
    safe_cast(coalesce(json_value(_airbyte_data, '$.Impressions'), json_value(_airbyte_data, '$.impressions')) as int64) as impressions,
    safe_cast(coalesce(json_value(_airbyte_data, '$.Clicks'), json_value(_airbyte_data, '$.clicks')) as int64) as clicks,
    safe_cast(coalesce(json_value(_airbyte_data, '$.Spend'), json_value(_airbyte_data, '$.cost')) as numeric) as cost,
    safe_cast(coalesce(json_value(_airbyte_data, '$.Conversions'), json_value(_airbyte_data, '$.conversions')) as numeric) as conversions,
    safe_cast(coalesce(json_value(_airbyte_data, '$.Revenue'), json_value(_airbyte_data, '$.revenue')) as numeric) as revenue
  from `airbyte_raw._airbyte_raw_bing_campaign_performance_daily`
),
unioned as (
  select * from tiktok
  union all
  select * from bing
)
select
  u.date,
  m.client_id,
  m.client_name,
  u.platform,
  u.account_id,
  m.account_name,
  u.campaign_id,
  u.campaign_name,
  coalesce(u.impressions, 0) as impressions,
  coalesce(u.clicks, 0) as clicks,
  coalesce(u.cost, 0) as cost,
  coalesce(u.conversions, 0) as conversions,
  coalesce(u.revenue, 0) as revenue,
  m.currency
from unioned u
join `marketing_reporting.client_account_map` m
  on m.platform = u.platform
  and m.account_id = u.account_id
  and m.active
where u.date is not null;

create or replace view `marketing_reporting.vw_paid_ads_monthly` as
select
  date_trunc(date, month) as date,
  client_id,
  client_name,
  platform,
  account_id,
  account_name,
  cast(null as string) as campaign_id,
  cast('All campaigns' as string) as campaign_name,
  sum(impressions) as impressions,
  sum(clicks) as clicks,
  sum(cost) as cost,
  sum(conversions) as conversions,
  sum(revenue) as revenue,
  any_value(currency) as currency
from `marketing_reporting.vw_paid_ads_daily`
group by 1, 2, 3, 4, 5, 6;

create or replace view `marketing_reporting.vw_paid_ads_last_complete_month` as
select *
from `marketing_reporting.vw_paid_ads_monthly`
where date = date_trunc(date_sub(current_date(), interval 1 month), month);

create or replace view `marketing_reporting.vw_client_connector_health` as
with latest_data as (
  select
    client_id,
    client_name,
    platform,
    account_id,
    max(date) as max_data_date,
    count(*) as daily_rows
  from `marketing_reporting.vw_paid_ads_daily`
  group by 1, 2, 3, 4
)
select
  m.client_id,
  m.client_name,
  m.platform,
  m.account_id,
  m.account_name,
  coalesce(l.daily_rows, 0) as daily_rows,
  l.max_data_date,
  date_diff(current_date(), l.max_data_date, day) as freshness_days,
  case
    when l.max_data_date is null then 'missing'
    when date_diff(current_date(), l.max_data_date, day) > 7 then 'stale'
    else 'ok'
  end as status
from `marketing_reporting.client_account_map` m
left join latest_data l
  on l.client_id = m.client_id
  and l.platform = m.platform
  and l.account_id = m.account_id
where m.active;
