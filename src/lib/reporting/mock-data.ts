import type { Connector, SecretCheck, SyncRun, WarehouseTable } from "./types";

export const mockConnectors: Connector[] = [
  {
    id: "conn-shopify-orders",
    name: "Shopify Orders",
    source: "Airbyte Shopify",
    destination: "bigquery",
    destinationTable: "analytics.shopify_orders",
    status: "healthy",
    owner: "Revenue Ops",
    cadence: "Every 30 min",
    lastSyncAt: "2026-06-07T06:42:00.000Z",
    nextSyncAt: "2026-06-07T07:12:00.000Z",
    slaMinutes: 45,
    freshnessMinutes: 18,
    records24h: 184203,
    errorRate: 0.001,
    latencyMs: 812,
    tags: ["orders", "revenue", "daily-close"]
  },
  {
    id: "conn-stripe-balance",
    name: "Stripe Balance Transactions",
    source: "Airbyte Stripe",
    destination: "bigquery",
    destinationTable: "finance.stripe_balance_transactions",
    status: "degraded",
    owner: "Finance Data",
    cadence: "Hourly",
    lastSyncAt: "2026-06-07T05:51:00.000Z",
    nextSyncAt: "2026-06-07T07:00:00.000Z",
    slaMinutes: 60,
    freshnessMinutes: 69,
    records24h: 48122,
    errorRate: 0.027,
    latencyMs: 1410,
    tags: ["finance", "settlement", "reconciliation"]
  },
  {
    id: "conn-hubspot-companies",
    name: "HubSpot Companies",
    source: "Airbyte HubSpot",
    destination: "supabase",
    destinationTable: "public.crm_companies",
    status: "healthy",
    owner: "Growth",
    cadence: "Every 2 hours",
    lastSyncAt: "2026-06-07T05:33:00.000Z",
    nextSyncAt: "2026-06-07T07:33:00.000Z",
    slaMinutes: 150,
    freshnessMinutes: 87,
    records24h: 9214,
    errorRate: 0,
    latencyMs: 622,
    tags: ["crm", "accounts", "sales"]
  },
  {
    id: "conn-ga4-events",
    name: "GA4 Events",
    source: "Airbyte Google Analytics",
    destination: "bigquery",
    destinationTable: "product.ga4_events",
    status: "failed",
    owner: "Product Analytics",
    cadence: "Every 15 min",
    lastSyncAt: "2026-06-07T03:04:00.000Z",
    nextSyncAt: "2026-06-07T07:15:00.000Z",
    slaMinutes: 30,
    freshnessMinutes: 238,
    records24h: 2271903,
    errorRate: 0.116,
    latencyMs: 3220,
    tags: ["events", "activation", "incident"]
  }
];

export const mockSyncRuns: SyncRun[] = [
  {
    id: "run-1007",
    connectorId: "conn-shopify-orders",
    status: "succeeded",
    startedAt: "2026-06-07T06:40:12.000Z",
    finishedAt: "2026-06-07T06:42:00.000Z",
    recordsExtracted: 4261,
    recordsLoaded: 4261,
    bytesLoaded: 9238874,
    message: "Loaded incremental order window and verified row checksum."
  },
  {
    id: "run-1006",
    connectorId: "conn-stripe-balance",
    status: "warning",
    startedAt: "2026-06-07T05:48:01.000Z",
    finishedAt: "2026-06-07T05:51:00.000Z",
    recordsExtracted: 1391,
    recordsLoaded: 1354,
    bytesLoaded: 1804402,
    message: "37 records deferred because Stripe returned transient rate-limit responses."
  },
  {
    id: "run-1005",
    connectorId: "conn-hubspot-companies",
    status: "succeeded",
    startedAt: "2026-06-07T05:30:07.000Z",
    finishedAt: "2026-06-07T05:33:00.000Z",
    recordsExtracted: 822,
    recordsLoaded: 822,
    bytesLoaded: 743291,
    message: "Upserted companies and refreshed Supabase materialized rollup."
  },
  {
    id: "run-1004",
    connectorId: "conn-ga4-events",
    status: "failed",
    startedAt: "2026-06-07T03:02:44.000Z",
    finishedAt: "2026-06-07T03:04:00.000Z",
    recordsExtracted: 0,
    recordsLoaded: 0,
    bytesLoaded: 0,
    message: "Airbyte source authentication failed. Refresh Google Analytics OAuth grant."
  }
];

export const mockTables: WarehouseTable[] = [
  {
    id: "tbl-shopify-orders",
    connectorId: "conn-shopify-orders",
    destination: "bigquery",
    name: "analytics.shopify_orders",
    rowCount: 3288421,
    freshnessMinutes: 18,
    schemaDrift: "none",
    checksumStatus: "ok"
  },
  {
    id: "tbl-stripe-balance",
    connectorId: "conn-stripe-balance",
    destination: "bigquery",
    name: "finance.stripe_balance_transactions",
    rowCount: 902118,
    freshnessMinutes: 69,
    schemaDrift: "additive",
    checksumStatus: "warning"
  },
  {
    id: "tbl-hubspot-companies",
    connectorId: "conn-hubspot-companies",
    destination: "supabase",
    name: "public.crm_companies",
    rowCount: 119402,
    freshnessMinutes: 87,
    schemaDrift: "none",
    checksumStatus: "ok"
  },
  {
    id: "tbl-ga4-events",
    connectorId: "conn-ga4-events",
    destination: "bigquery",
    name: "product.ga4_events",
    rowCount: 48120331,
    freshnessMinutes: 238,
    schemaDrift: "breaking",
    checksumStatus: "error"
  }
];

export const mockSecretChecks: SecretCheck[] = [
  {
    id: "secret-airbyte",
    name: "Airbyte API",
    provider: "airbyte",
    status: "missing",
    description: "Using mock Airbyte job and connection data.",
    requiredEnv: ["AIRBYTE_API_URL", "AIRBYTE_API_TOKEN"]
  },
  {
    id: "secret-supabase",
    name: "Supabase REST",
    provider: "supabase",
    status: "missing",
    description: "Using local mock rows for Supabase destination checks.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
  },
  {
    id: "secret-bigquery",
    name: "BigQuery Metadata",
    provider: "bigquery",
    status: "missing",
    description: "Using mock table freshness and checksum metadata.",
    requiredEnv: ["BIGQUERY_PROJECT_ID", "GOOGLE_APPLICATION_CREDENTIALS"]
  }
];
