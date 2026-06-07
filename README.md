# Reporting Connector

Operational console for reporting pipelines that move source data through Airbyte into Supabase or BigQuery. The project ships with typed API clients, mock provider data, SQL migration scripts, a working UI, and tests.

## What Is Included

- Next.js app with a connector ledger, destination checks, credential status, search/filtering, and a functional "Run sync" action.
- Airbyte, Supabase, and BigQuery client adapters with mock fallbacks when credentials are absent.
- Supabase migration for connector metadata, sync receipts, destination table checks, audit rows, RLS, and a health view.
- BigQuery SQL for partitioned run and freshness tables plus a health view.
- Vitest tests for store behavior, provider mocks, and UI rendering.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works without external credentials. Missing Airbyte, Supabase, and BigQuery settings are shown in the credential strip, and provider clients use deterministic mock data.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Environment

Copy `.env.example` to `.env.local` and fill in the providers you want to use:

```bash
AIRBYTE_API_URL=
AIRBYTE_API_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BIGQUERY_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
BIGQUERY_MOCK=true
```

If a provider is not configured, the app keeps using its mock client. Set `BIGQUERY_MOCK=true` unless you are adding a concrete Google SDK adapter.

## Database Setup

Supabase:

```bash
supabase db push
psql "$DATABASE_URL" -f sql/seed_mock_data.sql
```

The migration is in `supabase/migrations/0001_reporting_connector.sql`.

BigQuery:

```bash
bq query --use_legacy_sql=false < sql/bigquery/create_reporting_dataset.sql
```

## API

- `GET /api/health` returns service health and connector summary.
- `GET /api/connectors` returns connector, destination, and credential data.
- `GET /api/sync-runs` returns recent sync receipts.
- `POST /api/sync-runs` with `{ "connectorId": "conn-shopify-orders" }` triggers a provider sync and records a local sync receipt.

## Project Structure

```text
src/app                  Next.js pages, layout, API routes
src/components           Interactive connector workbench
src/lib/airbyte          Airbyte HTTP and mock clients
src/lib/supabase         Supabase REST and mock metadata clients
src/lib/bigquery         BigQuery metadata adapter and mock client
src/lib/reporting        Domain types, mock data, repository, store
supabase/migrations      Supabase schema migration
sql                      BigQuery and seed SQL
tests                    Vitest test suite
```

## Notes

The current BigQuery adapter intentionally avoids adding a heavyweight Google SDK dependency while credentials are not available. The SQL scripts define the BigQuery-side schema, and the mock metadata client keeps development and tests fully runnable.
