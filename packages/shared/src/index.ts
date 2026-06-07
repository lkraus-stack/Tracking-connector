import { z } from "zod";

export const adPlatformSchema = z.enum(["tiktok", "bing"]);
export const connectorStatusSchema = z.enum(["healthy", "warning", "failed", "paused"]);
export const syncStatusSchema = z.enum(["running", "succeeded", "failed", "cancelled", "incomplete"]);

export type AdPlatform = z.infer<typeof adPlatformSchema>;
export type ConnectorStatus = z.infer<typeof connectorStatusSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export interface AgencyClient {
  id: string;
  name: string;
  slug: string;
  owner: string;
  timezone: string;
  monthlyReportDay: number;
}

export interface MarketingAccount {
  id: string;
  clientId: string;
  platform: AdPlatform;
  externalAccountId: string;
  displayName: string;
  currency: string;
}

export interface ManagedConnector {
  id: string;
  clientId: string;
  accountId: string;
  platform: AdPlatform;
  airbyteConnectionId: string;
  connectionName: string;
  destinationDataset: string;
  destinationTable: string;
  schedule: "manual" | "daily" | "weekly" | "monthly";
  lookbackDays: number;
  status: ConnectorStatus;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  nextRecommendedSyncAt: string | null;
  freshnessHours: number;
}

export interface AirbyteJob {
  id: string;
  connectionId: string;
  status: SyncStatus;
  jobType: "sync" | "reset" | "clear" | "unknown";
  startedAt: string;
  endedAt: string | null;
  recordsCommitted: number;
  bytesCommitted: number;
  failureReason?: string;
}

export interface ConnectorHealth {
  connectionId: string;
  status: ConnectorStatus;
  latestJob: AirbyteJob | null;
  freshnessHours: number;
  needsAttention: boolean;
  message: string;
}

export interface PaidAdsDailyRow {
  date: string;
  clientId: string;
  clientName: string;
  platform: AdPlatform;
  accountId: string;
  accountName: string;
  campaignId: string | null;
  campaignName: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  currency: string;
}

export interface ReportingViewHealth {
  viewName: string;
  rowCount: number;
  maxDate: string | null;
  status: "ok" | "empty" | "stale" | "missing";
  message: string;
}

export interface ClientConnectorOverview {
  client: AgencyClient;
  accounts: MarketingAccount[];
  connectors: ManagedConnector[];
  health: ConnectorHealth[];
  monthlyRows: PaidAdsDailyRow[];
}

export interface AdminDashboardData {
  clients: AgencyClient[];
  accounts: MarketingAccount[];
  connectors: ManagedConnector[];
  jobs: AirbyteJob[];
  health: ConnectorHealth[];
  reportingViews: ReportingViewHealth[];
  paidAdsLastCompleteMonth: PaidAdsDailyRow[];
  generatedAt: string;
  mockMode: {
    airbyte: boolean;
    bigquery: boolean;
    supabase: boolean;
  };
}

export function getLastCompleteMonth(referenceDate = new Date()): { start: string; end: string; label: string } {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 0));
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label
  };
}

export function isMockEnabled(value: string | undefined): boolean {
  return value === undefined || value === "" || value === "true";
}

export * from "./validation";
export * from "./mock-data";
