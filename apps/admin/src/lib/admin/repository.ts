import { createAirbyteClient } from "@tracking-connector/airbyte";
import { createMarketingBigQueryClient } from "@tracking-connector/bigquery";
import {
  type AdminDashboardData,
  type AirbyteJob,
  type ConnectorHealth,
  type ManagedConnector
} from "@tracking-connector/shared";
import { mockAccounts, mockClients, mockConnectors, mockJobs } from "@tracking-connector/shared";

const mutableJobs: AirbyteJob[] = structuredClone(mockJobs);

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const airbyte = createAirbyteClient();
  const bigQuery = createMarketingBigQueryClient();

  const [connections, reportingViews, paidAdsLastCompleteMonth] = await Promise.all([
    airbyte.listConnections().catch(() => structuredClone(mockConnectors)),
    bigQuery.getLookerViewsHealth(),
    bigQuery.getLastCompleteMonthSummary()
  ]);

  const connectors = mergeAdminConnectors(connections);
  const health = await Promise.all(
    connectors.map((connector) =>
      airbyte
        .getConnectionHealth(connector.airbyteConnectionId)
        .catch(() => fallbackHealth(connector))
    )
  );

  return {
    clients: structuredClone(mockClients),
    accounts: structuredClone(mockAccounts),
    connectors,
    jobs: structuredClone(mutableJobs),
    health,
    reportingViews,
    paidAdsLastCompleteMonth,
    generatedAt: new Date().toISOString(),
    mockMode: {
      airbyte: !process.env.AIRBYTE_API_URL || !process.env.AIRBYTE_API_TOKEN,
      bigquery: !process.env.BIGQUERY_PROJECT_ID || process.env.BIGQUERY_MOCK === "true",
      supabase: !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  };
}

export async function triggerConnectorSync(connectionId: string): Promise<{ job: AirbyteJob; dashboard: AdminDashboardData }> {
  const airbyte = createAirbyteClient();
  const job = await airbyte.triggerSync(connectionId);

  mutableJobs.unshift(job);

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

  return {
    job,
    dashboard: await getAdminDashboardData()
  };
}

function mergeAdminConnectors(connections: ManagedConnector[]): ManagedConnector[] {
  const byConnectionId = new Map(connections.map((connection) => [connection.airbyteConnectionId, connection]));

  return mockConnectors.map((mappedConnector) => ({
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
