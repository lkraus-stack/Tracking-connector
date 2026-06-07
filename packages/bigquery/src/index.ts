import { BigQuery } from "@google-cloud/bigquery";
import {
  getLastCompleteMonth,
  type PaidAdsDailyRow,
  type ReportingViewHealth
} from "@tracking-connector/shared";
import { mockPaidAdsRows, mockReportingViews } from "@tracking-connector/shared";

export interface BigQueryClientOptions {
  projectId?: string;
  location?: string;
  reportingDataset?: string;
  mock?: boolean;
}

export interface BigQueryHealthResult {
  ok: boolean;
  checkedAt: string;
  projectId: string;
  reportingDataset: string;
  views: ReportingViewHealth[];
}

export interface MarketingBigQueryClient {
  runHealthQuery(): Promise<BigQueryHealthResult>;
  listReportingViews(): Promise<string[]>;
  getLookerViewsHealth(): Promise<ReportingViewHealth[]>;
  getPaidAdsDaily(limit?: number): Promise<PaidAdsDailyRow[]>;
  getPaidAdsMonthly(clientId?: string): Promise<PaidAdsDailyRow[]>;
  getLastCompleteMonthSummary(clientId?: string): Promise<PaidAdsDailyRow[]>;
}

export class MockMarketingBigQueryClient implements MarketingBigQueryClient {
  async runHealthQuery(): Promise<BigQueryHealthResult> {
    return {
      ok: mockReportingViews.every((view) => view.status === "ok" || view.status === "stale"),
      checkedAt: new Date().toISOString(),
      projectId: "mock-gcp-project",
      reportingDataset: "marketing_reporting",
      views: structuredClone(mockReportingViews)
    };
  }

  async listReportingViews(): Promise<string[]> {
    return mockReportingViews.map((view) => view.viewName);
  }

  async getLookerViewsHealth(): Promise<ReportingViewHealth[]> {
    return structuredClone(mockReportingViews);
  }

  async getPaidAdsDaily(limit = 100): Promise<PaidAdsDailyRow[]> {
    return structuredClone(mockPaidAdsRows).slice(0, limit);
  }

  async getPaidAdsMonthly(clientId?: string): Promise<PaidAdsDailyRow[]> {
    const rows = clientId ? mockPaidAdsRows.filter((row) => row.clientId === clientId) : mockPaidAdsRows;
    return structuredClone(rows);
  }

  async getLastCompleteMonthSummary(clientId?: string): Promise<PaidAdsDailyRow[]> {
    return this.getPaidAdsMonthly(clientId);
  }
}

export class GoogleMarketingBigQueryClient implements MarketingBigQueryClient {
  private readonly bigQuery: BigQuery;
  private readonly projectId: string;
  private readonly reportingDataset: string;

  constructor(options: Required<Pick<BigQueryClientOptions, "projectId" | "location" | "reportingDataset">>) {
    this.projectId = options.projectId;
    this.reportingDataset = options.reportingDataset;
    this.bigQuery = new BigQuery({ projectId: options.projectId, location: options.location });
  }

  async runHealthQuery(): Promise<BigQueryHealthResult> {
    const views = await this.getLookerViewsHealth();

    return {
      ok: views.every((view) => view.status === "ok"),
      checkedAt: new Date().toISOString(),
      projectId: this.projectId,
      reportingDataset: this.reportingDataset,
      views
    };
  }

  async listReportingViews(): Promise<string[]> {
    const [rows] = await this.bigQuery.query({
      query: `
        select table_name
        from \`${this.projectId}.${this.reportingDataset}.INFORMATION_SCHEMA.VIEWS\`
        where table_name in (
          'vw_paid_ads_daily',
          'vw_paid_ads_monthly',
          'vw_paid_ads_last_complete_month',
          'vw_client_connector_health'
        )
        order by table_name
      `
    });

    return rows.map((row) => `${this.reportingDataset}.${String(row.table_name)}`);
  }

  async getLookerViewsHealth(): Promise<ReportingViewHealth[]> {
    const viewNames = [
      "vw_paid_ads_daily",
      "vw_paid_ads_monthly",
      "vw_paid_ads_last_complete_month",
      "vw_client_connector_health"
    ];

    return Promise.all(
      viewNames.map(async (viewName) => {
        try {
          const [rows] = await this.bigQuery.query({
            query: `
              select
                count(1) as row_count,
                cast(max(date) as string) as max_date
              from \`${this.projectId}.${this.reportingDataset}.${viewName}\`
            `
          });
          const row = rows[0] as { row_count?: number | string; max_date?: string | null } | undefined;
          const rowCount = Number(row?.row_count ?? 0);
          const maxDate = row?.max_date ?? null;
          const status = rowCount === 0 ? "empty" : maxDate && isDateStale(maxDate) ? "stale" : "ok";

          return {
            viewName: `${this.reportingDataset}.${viewName}`,
            rowCount,
            maxDate,
            status,
            message: status === "ok" ? "View is populated and fresh." : "View should be checked before reporting."
          };
        } catch (error) {
          return {
            viewName: `${this.reportingDataset}.${viewName}`,
            rowCount: 0,
            maxDate: null,
            status: "missing",
            message: error instanceof Error ? error.message : "View is unavailable."
          };
        }
      })
    );
  }

  async getPaidAdsDaily(limit = 100): Promise<PaidAdsDailyRow[]> {
    const [rows] = await this.bigQuery.query({
      query: `
        select *
        from \`${this.projectId}.${this.reportingDataset}.vw_paid_ads_daily\`
        order by date desc, client_name, platform
        limit @limit
      `,
      params: { limit }
    });

    return rows.map(normalizePaidAdsRow);
  }

  async getPaidAdsMonthly(clientId?: string): Promise<PaidAdsDailyRow[]> {
    const [rows] = await this.bigQuery.query({
      query: `
        select *
        from \`${this.projectId}.${this.reportingDataset}.vw_paid_ads_monthly\`
        where @clientId is null or client_id = @clientId
        order by date desc, client_name, platform
      `,
      params: { clientId: clientId ?? null }
    });

    return rows.map(normalizePaidAdsRow);
  }

  async getLastCompleteMonthSummary(clientId?: string): Promise<PaidAdsDailyRow[]> {
    const month = getLastCompleteMonth();
    const [rows] = await this.bigQuery.query({
      query: `
        select *
        from \`${this.projectId}.${this.reportingDataset}.vw_paid_ads_last_complete_month\`
        where (@clientId is null or client_id = @clientId)
          and date between @startDate and @endDate
        order by client_name, platform
      `,
      params: { clientId: clientId ?? null, startDate: month.start, endDate: month.end }
    });

    return rows.map(normalizePaidAdsRow);
  }
}

export function createMarketingBigQueryClient(options: BigQueryClientOptions = {}): MarketingBigQueryClient {
  const projectId = options.projectId ?? process.env.BIGQUERY_PROJECT_ID;
  const location = options.location ?? process.env.BIGQUERY_LOCATION ?? "EU";
  const reportingDataset = options.reportingDataset ?? process.env.BIGQUERY_REPORTING_DATASET ?? "marketing_reporting";
  const useMock = options.mock ?? (!projectId || process.env.BIGQUERY_MOCK === "true");

  if (useMock || !projectId) {
    return new MockMarketingBigQueryClient();
  }

  return new GoogleMarketingBigQueryClient({ projectId, location, reportingDataset });
}

function normalizePaidAdsRow(row: Record<string, unknown>): PaidAdsDailyRow {
  return {
    date: String(row.date),
    clientId: String(row.client_id),
    clientName: String(row.client_name),
    platform: String(row.platform) === "bing" ? "bing" : "tiktok",
    accountId: String(row.account_id),
    accountName: String(row.account_name),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    campaignName: row.campaign_name ? String(row.campaign_name) : null,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    cost: Number(row.cost ?? 0),
    conversions: Number(row.conversions ?? 0),
    revenue: Number(row.revenue ?? 0),
    currency: String(row.currency ?? "EUR")
  };
}

function isDateStale(value: string): boolean {
  const maxDate = new Date(`${value}T00:00:00.000Z`);
  return Date.now() - maxDate.getTime() > 96 * 3_600_000;
}
