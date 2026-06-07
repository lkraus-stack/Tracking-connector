import {
  mockConnectors,
  mockSecretChecks,
  mockSyncRuns,
  mockTables
} from "./mock-data";
import type { Connector, DashboardData, SyncRun } from "./types";

const connectors: Connector[] = structuredClone(mockConnectors);
const syncRuns: SyncRun[] = structuredClone(mockSyncRuns);

function summarize(items: Connector[]): DashboardData["summary"] {
  const total = items.length;
  const records24h = items.reduce((sum, connector) => sum + connector.records24h, 0);
  const avgFreshnessMinutes =
    total === 0
      ? 0
      : Math.round(
          items.reduce((sum, connector) => sum + connector.freshnessMinutes, 0) / total
        );

  return {
    total,
    healthy: items.filter((connector) => connector.status === "healthy").length,
    degraded: items.filter((connector) => connector.status === "degraded").length,
    failed: items.filter((connector) => connector.status === "failed").length,
    paused: items.filter((connector) => connector.status === "paused").length,
    records24h,
    avgFreshnessMinutes
  };
}

export function getDashboardSnapshot(): DashboardData {
  return {
    summary: summarize(connectors),
    connectors: structuredClone(connectors),
    syncRuns: structuredClone(syncRuns),
    tables: structuredClone(mockTables),
    secretChecks: structuredClone(mockSecretChecks).map((check) => ({
      ...check,
      status: check.requiredEnv.every((key) => Boolean(process.env[key])) ? "ok" : check.status,
      description: check.requiredEnv.every((key) => Boolean(process.env[key]))
        ? "Credentials detected. The API client will use the configured provider."
        : check.description
    }))
  };
}

export function triggerMockSync(connectorId: string): SyncRun {
  const connector = connectors.find((item) => item.id === connectorId);

  if (!connector) {
    throw new Error(`Unknown connector: ${connectorId}`);
  }

  const now = new Date();
  const finishedAt = new Date(now.getTime() + 42_000);
  const recordBase = Math.max(250, Math.round(connector.records24h / 24));
  const loaded = connector.status === "failed" ? Math.round(recordBase * 0.96) : recordBase;

  const run: SyncRun = {
    id: `run-${Date.now()}`,
    connectorId,
    status: connector.status === "failed" ? "warning" : "succeeded",
    startedAt: now.toISOString(),
    finishedAt: finishedAt.toISOString(),
    recordsExtracted: recordBase,
    recordsLoaded: loaded,
    bytesLoaded: loaded * 512,
    message:
      connector.status === "failed"
        ? "Mock sync completed with warnings after refreshing the local source token."
        : "Mock sync completed and destination checksum matched."
  };

  connector.status = run.status === "succeeded" ? "healthy" : "degraded";
  connector.lastSyncAt = finishedAt.toISOString();
  connector.nextSyncAt = new Date(finishedAt.getTime() + connector.slaMinutes * 60_000).toISOString();
  connector.freshnessMinutes = 0;
  connector.records24h += loaded;
  syncRuns.unshift(run);

  return structuredClone(run);
}
