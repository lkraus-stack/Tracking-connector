import { describe, expect, it } from "vitest";
import { MockAirbyteClient } from "@tracking-connector/airbyte";
import { MockMarketingBigQueryClient } from "@tracking-connector/bigquery";
import { getLastCompleteMonth } from "@tracking-connector/shared";

describe("provider clients", () => {
  it("implements Airbyte connection and job operations in mock mode", async () => {
    const client = new MockAirbyteClient();
    const connections = await client.listConnections();
    const latest = await client.getLatestJobForConnection("ab-conn-tiktok-nordstern");
    const health = await client.getConnectionHealth("ab-conn-tiktok-nordstern");

    expect(connections).toHaveLength(3);
    expect(latest?.status).toBe("succeeded");
    expect(health.needsAttention).toBe(false);
  });

  it("returns BigQuery reporting views and last complete month rows in mock mode", async () => {
    const client = new MockMarketingBigQueryClient();
    const views = await client.listReportingViews();
    const rows = await client.getLastCompleteMonthSummary();

    expect(views).toContain("marketing_reporting.vw_paid_ads_daily");
    expect(rows.length).toBeGreaterThan(0);
    expect(getLastCompleteMonth(new Date("2026-06-07T00:00:00Z")).label).toBe("May 2026");
  });
});
