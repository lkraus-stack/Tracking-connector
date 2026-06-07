import { describe, expect, it } from "vitest";
import { getAdminDashboardData, triggerConnectorSync } from "@/lib/admin/repository";

describe("admin dashboard repository", () => {
  it("returns clients, mapped connectors, jobs and Looker view health", async () => {
    const dashboard = await getAdminDashboardData();

    expect(dashboard.clients).toHaveLength(2);
    expect(dashboard.connectors.map((connector) => connector.platform)).toContain("tiktok");
    expect(dashboard.connectors.map((connector) => connector.platform)).toContain("bing");
    expect(dashboard.reportingViews.map((view) => view.viewName)).toContain(
      "marketing_reporting.vw_paid_ads_last_complete_month"
    );
  });

  it("can trigger a mock Airbyte sync", async () => {
    const result = await triggerConnectorSync("ab-conn-tiktok-nordstern");

    expect(result.job.status).toBe("running");
    expect(result.dashboard.jobs[0]?.connectionId).toBe("ab-conn-tiktok-nordstern");
  });
});
