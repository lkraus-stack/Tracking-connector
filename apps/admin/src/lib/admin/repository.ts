import { createAirbyteClient } from "@tracking-connector/airbyte";
import { createMarketingBigQueryClient } from "@tracking-connector/bigquery";
import {
  type AdminDashboardData,
  type AirbyteJob,
  type ConnectorHealth,
  type ManagedConnector
} from "@tracking-connector/shared";
import { mockAccounts, mockClients, mockConnectors, mockJobs } from "@tracking-connector/shared";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const mutableJobs: AirbyteJob[] = structuredClone(mockJobs);

interface AdminMetadata {
  clients: typeof mockClients;
  accounts: typeof mockAccounts;
  connectors: ManagedConnector[];
  jobs: AirbyteJob[];
  usingSupabase: boolean;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const airbyte = createAirbyteClient();
  const bigQuery = createMarketingBigQueryClient();
  const metadata = await loadAdminMetadata();

  const [connections, reportingViews, paidAdsLastCompleteMonth] = await Promise.all([
    airbyte.listConnections().catch((error) => {
      logger.warn({ error }, "Falling back to mock Airbyte connections");
      return structuredClone(metadata.connectors);
    }),
    bigQuery.getLookerViewsHealth(),
    bigQuery.getLastCompleteMonthSummary()
  ]);

  const connectors = mergeAdminConnectors(metadata.connectors, connections);
  const health = await Promise.all(
    connectors.map((connector) =>
      airbyte
        .getConnectionHealth(connector.airbyteConnectionId)
        .catch((error) => {
          logger.warn({ error, connectionId: connector.airbyteConnectionId }, "Falling back to local connector health");
          return fallbackHealth(connector);
        })
    )
  );

  return {
    clients: structuredClone(metadata.clients),
    accounts: structuredClone(metadata.accounts),
    connectors,
    jobs: structuredClone(metadata.jobs),
    health,
    reportingViews,
    paidAdsLastCompleteMonth,
    generatedAt: new Date().toISOString(),
    mockMode: {
      airbyte: !process.env.AIRBYTE_API_URL || !process.env.AIRBYTE_API_TOKEN,
      bigquery: !process.env.BIGQUERY_PROJECT_ID || process.env.BIGQUERY_MOCK === "true",
      supabase: !metadata.usingSupabase
    }
  };
}

export async function triggerConnectorSync(connectionId: string): Promise<{ job: AirbyteJob; dashboard: AdminDashboardData }> {
  const airbyte = createAirbyteClient();
  const job = await airbyte.triggerSync(connectionId);

  mutableJobs.unshift(job);
  await persistJob(job);

  return {
    job,
    dashboard: await getAdminDashboardData()
  };
}

export async function cancelConnectorJob(jobId: string): Promise<{ job: AirbyteJob; dashboard: AdminDashboardData }> {
  const airbyte = createAirbyteClient();
  const job = await airbyte.cancelJob(jobId);
  const index = mutableJobs.findIndex((item) => item.id === jobId);

  if (index >= 0) {
    mutableJobs[index] = job;
  }
  await persistJob(job);

  return {
    job,
    dashboard: await getAdminDashboardData()
  };
}

async function loadAdminMetadata(): Promise<AdminMetadata> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      clients: structuredClone(mockClients),
      accounts: structuredClone(mockAccounts),
      connectors: structuredClone(mockConnectors),
      jobs: structuredClone(mutableJobs),
      usingSupabase: false
    };
  }

  try {
    const [clientsResult, accountsResult, connectorsResult, jobsResult] = await Promise.all([
      supabase.from("clients").select("*").eq("active", true).order("name"),
      supabase.from("marketing_accounts").select("*").eq("active", true).order("display_name"),
      supabase.from("airbyte_connector_mappings").select("*").order("airbyte_connection_name"),
      supabase.from("airbyte_sync_jobs").select("*").order("started_at", { ascending: false }).limit(50)
    ]);

    for (const result of [clientsResult, accountsResult, connectorsResult, jobsResult]) {
      if (result.error) {
        throw result.error;
      }
    }

    return {
      clients: (clientsResult.data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        slug: String(row.slug),
        owner: String(row.owner),
        timezone: String(row.timezone ?? "Europe/Berlin"),
        monthlyReportDay: Number(row.monthly_report_day ?? 3)
      })),
      accounts: (accountsResult.data ?? []).map((row) => ({
        id: String(row.id),
        clientId: String(row.client_id),
        platform: row.platform === "bing" ? "bing" : "tiktok",
        externalAccountId: String(row.external_account_id),
        displayName: String(row.display_name),
        currency: String(row.currency ?? "EUR")
      })),
      connectors: (connectorsResult.data ?? []).map((row) => ({
        id: String(row.id),
        clientId: String(row.client_id),
        accountId: String(row.marketing_account_id),
        platform: row.platform === "bing" ? "bing" : "tiktok",
        airbyteConnectionId: String(row.airbyte_connection_id),
        connectionName: String(row.airbyte_connection_name),
        destinationDataset: String(row.destination_dataset ?? "airbyte_raw"),
        destinationTable: String(row.destination_table),
        schedule: parseSchedule(row.schedule),
        lookbackDays: Number(row.lookback_days ?? 45),
        status: parseConnectorStatus(row.status),
        lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
        lastSuccessfulSyncAt: row.last_successful_sync_at ? String(row.last_successful_sync_at) : null,
        nextRecommendedSyncAt: row.next_recommended_sync_at ? String(row.next_recommended_sync_at) : null,
        freshnessHours: Number(row.freshness_hours ?? 999)
      })),
      jobs: (jobsResult.data ?? []).map((row) => ({
        id: String(row.id),
        connectionId: String(row.connection_id),
        status: parseJobStatus(row.status),
        jobType:
          row.job_type === "sync" || row.job_type === "reset" || row.job_type === "clear"
            ? row.job_type
            : "unknown",
        startedAt: String(row.started_at),
        endedAt: row.ended_at ? String(row.ended_at) : null,
        recordsCommitted: Number(row.records_committed ?? 0),
        bytesCommitted: Number(row.bytes_committed ?? 0),
        failureReason: row.failure_reason ? String(row.failure_reason) : undefined
      })),
      usingSupabase: true
    };
  } catch (error) {
    logger.warn({ error }, "Falling back to mock admin metadata");
    return {
      clients: structuredClone(mockClients),
      accounts: structuredClone(mockAccounts),
      connectors: structuredClone(mockConnectors),
      jobs: structuredClone(mutableJobs),
      usingSupabase: false
    };
  }
}

async function persistJob(job: AirbyteJob) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("airbyte_sync_jobs").upsert({
    id: job.id,
    connection_id: job.connectionId,
    status: job.status,
    job_type: job.jobType,
    started_at: job.startedAt,
    ended_at: job.endedAt,
    records_committed: job.recordsCommitted,
    bytes_committed: job.bytesCommitted,
    failure_reason: job.failureReason ?? null
  });

  if (error) {
    logger.warn({ error, jobId: job.id }, "Unable to persist Airbyte job in Supabase");
  }
}

function mergeAdminConnectors(mappedConnectors: ManagedConnector[], connections: ManagedConnector[]): ManagedConnector[] {
  const byConnectionId = new Map(connections.map((connection) => [connection.airbyteConnectionId, connection]));

  return mappedConnectors.map((mappedConnector) => ({
    ...mappedConnector,
    ...(byConnectionId.get(mappedConnector.airbyteConnectionId) ?? {})
  }));
}

function fallbackHealth(connector: ManagedConnector): ConnectorHealth {
  const latestJob = mutableJobs.find((job) => job.connectionId === connector.airbyteConnectionId) ?? null;

  return {
    connectionId: connector.airbyteConnectionId,
    status: connector.status,
    latestJob,
    freshnessHours: connector.freshnessHours,
    needsAttention: connector.status !== "healthy" || connector.freshnessHours > 48,
    message:
      connector.status === "healthy"
        ? "Connector metadata is healthy in mock mode."
        : latestJob?.failureReason ?? "Connector needs review before the monthly report."
  };
}

function parseSchedule(value: unknown): ManagedConnector["schedule"] {
  return value === "manual" || value === "daily" || value === "weekly" || value === "monthly"
    ? value
    : "monthly";
}

function parseConnectorStatus(value: unknown): ManagedConnector["status"] {
  return value === "healthy" || value === "warning" || value === "failed" || value === "paused"
    ? value
    : "paused";
}

function parseJobStatus(value: unknown): AirbyteJob["status"] {
  return value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "incomplete"
    ? value
    : "incomplete";
}
