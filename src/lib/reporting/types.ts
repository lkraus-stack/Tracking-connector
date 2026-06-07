export type ConnectorStatus = "healthy" | "degraded" | "paused" | "failed";
export type SyncStatus = "running" | "succeeded" | "warning" | "failed";
export type DestinationKind = "bigquery" | "supabase";
export type CheckStatus = "ok" | "warning" | "error" | "missing";

export interface Connector {
  id: string;
  name: string;
  source: string;
  destination: DestinationKind;
  destinationTable: string;
  status: ConnectorStatus;
  owner: string;
  cadence: string;
  lastSyncAt: string;
  nextSyncAt: string;
  slaMinutes: number;
  freshnessMinutes: number;
  records24h: number;
  errorRate: number;
  latencyMs: number;
  tags: string[];
}

export interface SyncRun {
  id: string;
  connectorId: string;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  recordsExtracted: number;
  recordsLoaded: number;
  bytesLoaded: number;
  message: string;
}

export interface WarehouseTable {
  id: string;
  connectorId: string;
  destination: DestinationKind;
  name: string;
  rowCount: number;
  freshnessMinutes: number;
  schemaDrift: "none" | "additive" | "breaking";
  checksumStatus: CheckStatus;
}

export interface SecretCheck {
  id: string;
  name: string;
  provider: "airbyte" | "supabase" | "bigquery";
  status: CheckStatus;
  description: string;
  requiredEnv: string[];
}

export interface ConnectorSummary {
  total: number;
  healthy: number;
  degraded: number;
  failed: number;
  paused: number;
  records24h: number;
  avgFreshnessMinutes: number;
}

export interface DashboardData {
  summary: ConnectorSummary;
  connectors: Connector[];
  syncRuns: SyncRun[];
  tables: WarehouseTable[];
  secretChecks: SecretCheck[];
}

export interface TriggerSyncRequest {
  connectorId: string;
}
