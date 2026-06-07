# Tracking Connector

Produktionsnahes MVP für eine interne Performance-Marketing-Agentur-Datenpipeline. Ziel ist, monatliche TikTok- und Microsoft Ads/Bing Ads Reportings ohne Supermetrics zu betreiben:

```text
TikTok Marketing / Microsoft Ads
  -> Airbyte OSS / self-managed Airbyte
  -> BigQuery airbyte_raw
  -> BigQuery marketing_reporting views
  -> Looker Studio

Next.js Admin App
  -> Airbyte Public API
  -> BigQuery health checks
  -> Supabase Admin metadata and Auth
```

## Doku-Basis

Die Implementierung orientiert sich an den offiziellen Quellen:

- Airbyte abctl: https://docs.airbyte.com/platform/deploying-airbyte/abctl
- Airbyte OSS Quickstart: https://docs.airbyte.com/platform/using-airbyte/getting-started/oss-quickstart
- Airbyte Public API: https://docs.airbyte.com/developers/api-documentation
- Airbyte TikTok Marketing Source: https://docs.airbyte.com/integrations/sources/tiktok-marketing
- Airbyte Bing Ads Source: https://docs.airbyte.com/integrations/sources/bing-ads
- Airbyte BigQuery Destination: https://docs.airbyte.com/integrations/destinations/bigquery
- Looker Studio BigQuery Connector: https://docs.cloud.google.com/data-studio/connect-to-google-bigquery

Wichtig: Dieses Repo enthält kein Airbyte-Docker-Compose-Deployment. Airbyte wird über `abctl` oder eine bestehende self-managed Airbyte-Instanz betrieben.

## Struktur

```text
apps/admin
  Next.js App Router Admin-Webapp

packages/airbyte
  Airbyte API Client mit Mock-Fallback

packages/bigquery
  BigQuery Client und Looker-View-Health-Checks mit Mock-Fallback

packages/shared
  Gemeinsame Types, Zod-Schemas und Mock-Daten

supabase/migrations
  Admin-Metadaten, Account-Mapping, Status, Logs, User-Profile

sql/bigquery
  airbyte_raw + marketing_reporting Datasets und Looker-Studio-Views

scripts
  abctl Setup-Helfer
```

## Quickstart

```bash
npm install
npm run dev
```

Admin-App: http://localhost:3000

Ohne Airbyte-, Supabase- oder BigQuery-Credentials läuft die App mit sinnvollen Mocks. Die UI zeigt oben, welche Provider live oder mock sind. Sobald Supabase-Variablen gesetzt sind, liest die Admin-App `clients`, `marketing_accounts`, `airbyte_connector_mappings` und `airbyte_sync_jobs` aus Supabase und schreibt neu gestartete Airbyte-Jobs zurück nach `airbyte_sync_jobs`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run format
```

## Environment

```bash
cp .env.example .env.local
```

Wichtige Variablen:

```bash
AIRBYTE_API_URL=http://localhost:8000
AIRBYTE_API_TOKEN=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_BASIC_AUTH_USER=
ADMIN_BASIC_AUTH_PASSWORD=

BIGQUERY_PROJECT_ID=
BIGQUERY_LOCATION=EU
BIGQUERY_RAW_DATASET=airbyte_raw
BIGQUERY_REPORTING_DATASET=marketing_reporting
GOOGLE_APPLICATION_CREDENTIALS=
BIGQUERY_MOCK=true
```

`ADMIN_BASIC_AUTH_USER` und `ADMIN_BASIC_AUTH_PASSWORD` aktivieren optional Basic Auth vor der Admin-App. Für lokale Entwicklung können sie leer bleiben. Supabase Auth ist schema- und clientseitig vorbereitet; echte Login-Flows können auf `user_profiles` und Supabase Auth aufbauen.

## Airbyte Mit abctl

Installiere Airbyte OSS mit abctl:

```bash
curl -LsfS https://get.airbyte.com | bash -
scripts/setup-airbyte-abctl.sh
```

Nützliche Befehle:

```bash
abctl local status
abctl local credentials
```

Danach:

1. Airbyte UI öffnen.
2. BigQuery Destination erstellen.
3. Default Dataset auf `airbyte_raw` setzen.
4. TikTok Marketing Source anlegen.
5. Bing Ads Source anlegen.
6. Connections nach BigQuery erstellen.
7. Die Airbyte `connectionId`s in Supabase `airbyte_connector_mappings` hinterlegen.
8. `AIRBYTE_API_URL` und `AIRBYTE_API_TOKEN` in `.env.local` setzen.

## Supabase Setup

```bash
supabase db push
psql "$DATABASE_URL" -f sql/seed_mock_data.sql
```

Die Migration erstellt:

- `clients`
- `marketing_accounts`
- `airbyte_connector_mappings`
- `airbyte_sync_jobs`
- `connector_status_events`
- `user_profiles`
- `vw_admin_connector_health`

Supabase ist bewusst Admin-Metadaten-Schicht, nicht Reporting-Ziel.

## BigQuery Setup

```bash
bq query --use_legacy_sql=false < sql/bigquery/create_marketing_reporting_views.sql
```

Das SQL erzeugt:

- Dataset `airbyte_raw`
- Dataset `marketing_reporting`
- Mapping-Tabelle `marketing_reporting.client_account_map`
- View `marketing_reporting.vw_paid_ads_daily`
- View `marketing_reporting.vw_paid_ads_monthly`
- View `marketing_reporting.vw_paid_ads_last_complete_month`
- View `marketing_reporting.vw_client_connector_health`

Die Views lesen Airbyte Legacy Raw Tables mit `_airbyte_data`. Falls deine Airbyte BigQuery Destination direkt typisierte Tabellen schreibt, passe die Feldreferenzen im SQL entsprechend an.

## Looker Studio

In Looker Studio den BigQuery Connector verwenden und bevorzugt diese Views anbinden:

- `marketing_reporting.vw_paid_ads_last_complete_month` für das Standard-Monatsreporting
- `marketing_reporting.vw_paid_ads_monthly` für historische Monatsvergleiche
- `marketing_reporting.vw_paid_ads_daily` für Drilldowns
- `marketing_reporting.vw_client_connector_health` für interne Datenqualitätsseiten

## Live-Abnahme Gegen Supermetrics

Die Seite `/validation` ist für die Pilotkunden-Abnahme gedacht. Sie vergleicht Airbyte/BigQuery-Monatswerte mit einem temporär hochgeladenen Supermetrics-CSV und bewertet Abweichungen mit zentralen Thresholds.

Ablauf:

1. Pilotkunde in der Admin-App wählen.
2. TikTok und Bing Airbyte Sync für den gewünschten Monat ausführen.
3. BigQuery Mapping in `marketing_reporting.client_account_map` prüfen.
4. Supermetrics CSV für denselben Monat exportieren.
5. CSV in der Admin-App unter `/validation` hochladen.
6. Abweichungen für Spend, Clicks, Impressions, Conversions und Conversion Value prüfen.
7. Fehler korrigieren, zum Beispiel Account-Mapping, Währungslogik, Zeiträume oder Airbyte Source-Konfiguration.
8. Einen zweiten Monat prüfen.
9. Danach entscheiden, ob der Kunde von Supermetrics auf Airbyte/BigQuery/Looker Studio umgestellt werden kann.

Default-Thresholds:

- Spend, Clicks und Impressions: Warnung ab `0,5%`, Fehler ab `1%`
- Conversions und Conversion Value: Warnung ab `2%`, Fehler ab `5%`

Der CSV Upload wird nur temporär verarbeitet. Ein gespeicherter Validation Run enthält aggregierte Metriken und ein kleines `raw_payload`, aber keine Secrets.

Erwartete CSV-Spalten sind flexibel gemappt:

- `date` oder `month`
- `platform`
- `account`
- `campaign` optional
- `impressions`
- `clicks`
- `cost` oder `spend`
- `conversions`
- `conversion_value` oder `revenue`

## API Der Admin-App

- `GET /api/health`
- `GET /api/connectors`
- `GET /api/sync-runs`
- `POST /api/sync-runs` mit `{ "connectionId": "ab-conn-tiktok-nordstern" }`
- `GET /api/validation/monthly?clientId=...&platform=...&month=YYYY-MM`
- `POST /api/validation/supermetrics-csv`
- `POST /api/validation/run`
- `GET /api/validation/runs?clientId=...`

## Package-Funktionen

`@tracking-connector/airbyte`:

- `listConnections()`
- `getConnection(connectionId)`
- `listJobs(connectionId?)`
- `getJob(jobId)`
- `triggerSync(connectionId)`
- `cancelJob(jobId)`
- `getLatestJobForConnection(connectionId)`
- `getConnectionHealth(connectionId)`

`@tracking-connector/bigquery`:

- `runHealthQuery()`
- `listReportingViews()`
- `getLookerViewsHealth()`
- `getPaidAdsDaily(limit?)`
- `getPaidAdsMonthly(clientId?)`
- `getLastCompleteMonthSummary(clientId?)`

## Tests

```bash
npm run lint
npm run test
```

Die Tests decken Provider-Mocks, Repository-Daten und die Admin-UI ab.
