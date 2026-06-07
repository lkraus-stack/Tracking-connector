create schema if not exists `reporting_connector`
options (
  description = 'Operational metadata for Airbyte reporting connectors'
);

create table if not exists `reporting_connector.connector_runs` (
  run_id string not null,
  connector_id string not null,
  connector_name string not null,
  source_name string not null,
  destination_table string not null,
  status string not null,
  started_at timestamp not null,
  finished_at timestamp,
  records_extracted int64 not null,
  records_loaded int64 not null,
  bytes_loaded int64 not null,
  message string
)
partition by date(started_at)
cluster by connector_id, status;

create table if not exists `reporting_connector.destination_freshness` (
  connector_id string not null,
  destination_table string not null,
  observed_at timestamp not null,
  row_count int64 not null,
  freshness_minutes int64 not null,
  schema_drift string not null,
  checksum_status string not null
)
partition by date(observed_at)
cluster by connector_id, checksum_status;

create or replace view `reporting_connector.connector_health` as
select
  connector_id,
  any_value(connector_name) as connector_name,
  any_value(source_name) as source_name,
  any_value(destination_table) as destination_table,
  array_agg(status order by started_at desc limit 1)[offset(0)] as latest_status,
  max(finished_at) as latest_finished_at,
  sum(records_loaded) as records_loaded_24h,
  safe_divide(
    countif(status in ('failed', 'warning')),
    count(*)
  ) as warning_or_failure_rate_24h
from `reporting_connector.connector_runs`
where started_at >= timestamp_sub(current_timestamp(), interval 24 hour)
group by connector_id;
