import type {
  AdPlatform,
  AgencyClient,
  AirbyteJob,
  ConnectorHealth,
  ManagedConnector,
  MarketingAccount,
  PaidAdsDailyRow,
  ReportingViewHealth
} from "./index";

export const mockClients: AgencyClient[] = [
  {
    id: "client-nordstern",
    name: "Nordstern Bikes",
    slug: "nordstern-bikes",
    owner: "Performance Team A",
    timezone: "Europe/Berlin",
    monthlyReportDay: 3
  },
  {
    id: "client-atelier",
    name: "Atelier Forma",
    slug: "atelier-forma",
    owner: "Performance Team B",
    timezone: "Europe/Berlin",
    monthlyReportDay: 4
  }
];

export const mockAccounts: MarketingAccount[] = [
  {
    id: "acct-tiktok-nordstern",
    clientId: "client-nordstern",
    platform: "tiktok",
    externalAccountId: "71122334455",
    displayName: "Nordstern TikTok DE",
    currency: "EUR"
  },
  {
    id: "acct-bing-nordstern",
    clientId: "client-nordstern",
    platform: "bing",
    externalAccountId: "MS-998877",
    displayName: "Nordstern Microsoft Ads",
    currency: "EUR"
  },
  {
    id: "acct-tiktok-atelier",
    clientId: "client-atelier",
    platform: "tiktok",
    externalAccountId: "70099112233",
    displayName: "Atelier TikTok DACH",
    currency: "EUR"
  }
];

export const mockConnectors: ManagedConnector[] = [
  {
    id: "connector-tiktok-nordstern",
    clientId: "client-nordstern",
    accountId: "acct-tiktok-nordstern",
    platform: "tiktok",
    airbyteConnectionId: "ab-conn-tiktok-nordstern",
    connectionName: "TikTok Marketing - Nordstern",
    destinationDataset: "airbyte_raw",
    destinationTable: "_airbyte_raw_tiktok_ads_reports",
    schedule: "daily",
    lookbackDays: 30,
    status: "healthy",
    lastSyncAt: "2026-06-07T04:20:00.000Z",
    lastSuccessfulSyncAt: "2026-06-07T04:20:00.000Z",
    nextRecommendedSyncAt: "2026-06-08T04:20:00.000Z",
    freshnessHours: 3
  },
  {
    id: "connector-bing-nordstern",
    clientId: "client-nordstern",
    accountId: "acct-bing-nordstern",
    platform: "bing",
    airbyteConnectionId: "ab-conn-bing-nordstern",
    connectionName: "Bing Ads - Nordstern",
    destinationDataset: "airbyte_raw",
    destinationTable: "_airbyte_raw_bing_campaign_performance_daily",
    schedule: "weekly",
    lookbackDays: 45,
    status: "warning",
    lastSyncAt: "2026-06-05T01:14:00.000Z",
    lastSuccessfulSyncAt: "2026-06-05T01:14:00.000Z",
    nextRecommendedSyncAt: "2026-06-08T01:14:00.000Z",
    freshnessHours: 55
  },
  {
    id: "connector-tiktok-atelier",
    clientId: "client-atelier",
    accountId: "acct-tiktok-atelier",
    platform: "tiktok",
    airbyteConnectionId: "ab-conn-tiktok-atelier",
    connectionName: "TikTok Marketing - Atelier Forma",
    destinationDataset: "airbyte_raw",
    destinationTable: "_airbyte_raw_tiktok_ads_reports",
    schedule: "monthly",
    lookbackDays: 60,
    status: "failed",
    lastSyncAt: "2026-06-02T23:06:00.000Z",
    lastSuccessfulSyncAt: "2026-05-31T23:06:00.000Z",
    nextRecommendedSyncAt: "2026-06-07T23:06:00.000Z",
    freshnessHours: 127
  }
];

export const mockJobs: AirbyteJob[] = [
  {
    id: "job-2451",
    connectionId: "ab-conn-tiktok-nordstern",
    status: "succeeded",
    jobType: "sync",
    startedAt: "2026-06-07T04:14:00.000Z",
    endedAt: "2026-06-07T04:20:00.000Z",
    recordsCommitted: 8421,
    bytesCommitted: 6290000
  },
  {
    id: "job-2439",
    connectionId: "ab-conn-bing-nordstern",
    status: "succeeded",
    jobType: "sync",
    startedAt: "2026-06-05T01:04:00.000Z",
    endedAt: "2026-06-05T01:14:00.000Z",
    recordsCommitted: 3192,
    bytesCommitted: 2784000
  },
  {
    id: "job-2422",
    connectionId: "ab-conn-tiktok-atelier",
    status: "failed",
    jobType: "sync",
    startedAt: "2026-06-02T23:01:00.000Z",
    endedAt: "2026-06-02T23:06:00.000Z",
    recordsCommitted: 0,
    bytesCommitted: 0,
    failureReason: "TikTok access token expired. Re-authenticate the source in Airbyte."
  }
];

export const mockHealth: ConnectorHealth[] = mockConnectors.map((connector) => {
  const latestJob = mockJobs.find((job) => job.connectionId === connector.airbyteConnectionId) ?? null;
  const needsAttention = connector.status !== "healthy" || connector.freshnessHours > 48;

  return {
    connectionId: connector.airbyteConnectionId,
    status: connector.status,
    latestJob,
    freshnessHours: connector.freshnessHours,
    needsAttention,
    message: needsAttention
      ? latestJob?.failureReason ?? "Review freshness and run a backfill sync if needed."
      : "Connector is current and ready for monthly reporting."
  };
});

function row(
  clientId: string,
  platform: AdPlatform,
  accountId: string,
  campaignName: string,
  cost: number,
  conversions: number
): PaidAdsDailyRow {
  const client = mockClients.find((item) => item.id === clientId);
  const account = mockAccounts.find((item) => item.id === accountId);

  return {
    date: "2026-05-31",
    clientId,
    clientName: client?.name ?? clientId,
    platform,
    accountId,
    accountName: account?.displayName ?? accountId,
    campaignId: campaignName.toLowerCase().replaceAll(" ", "-"),
    campaignName,
    impressions: Math.round(cost * 129),
    clicks: Math.round(cost * 4.2),
    cost,
    conversions,
    revenue: conversions * 93,
    currency: "EUR"
  };
}

export const mockPaidAdsRows: PaidAdsDailyRow[] = [
  row("client-nordstern", "tiktok", "acct-tiktok-nordstern", "Bike Launch Prospecting", 4930.22, 131),
  row("client-nordstern", "bing", "acct-bing-nordstern", "Brand Search Exact", 1220.91, 74),
  row("client-atelier", "tiktok", "acct-tiktok-atelier", "Summer Capsule Retargeting", 3011.43, 59)
];

export const mockReportingViews: ReportingViewHealth[] = [
  {
    viewName: "marketing_reporting.vw_paid_ads_daily",
    rowCount: 98244,
    maxDate: "2026-06-06",
    status: "ok",
    message: "Daily paid ads view is populated."
  },
  {
    viewName: "marketing_reporting.vw_paid_ads_monthly",
    rowCount: 812,
    maxDate: "2026-05-31",
    status: "ok",
    message: "Monthly rollup is ready for Looker Studio."
  },
  {
    viewName: "marketing_reporting.vw_paid_ads_last_complete_month",
    rowCount: 34,
    maxDate: "2026-05-31",
    status: "ok",
    message: "Last complete month view resolves to May 2026."
  },
  {
    viewName: "marketing_reporting.vw_client_connector_health",
    rowCount: 3,
    maxDate: "2026-06-07",
    status: "stale",
    message: "One client connector needs attention."
  }
];
