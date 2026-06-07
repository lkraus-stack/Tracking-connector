import { describe, expect, it } from "vitest";
import { getDashboardSnapshot, triggerMockSync } from "@/lib/reporting/store";

describe("reporting store", () => {
  it("summarizes connector health and volume", () => {
    const dashboard = getDashboardSnapshot();

    expect(dashboard.summary.total).toBe(4);
    expect(dashboard.summary.healthy).toBe(2);
    expect(dashboard.summary.failed).toBe(1);
    expect(dashboard.summary.records24h).toBeGreaterThan(2_000_000);
  });

  it("creates a sync run and updates connector freshness", () => {
    const run = triggerMockSync("conn-ga4-events");
    const dashboard = getDashboardSnapshot();
    const connector = dashboard.connectors.find((item) => item.id === "conn-ga4-events");

    expect(run.connectorId).toBe("conn-ga4-events");
    expect(run.status).toBe("warning");
    expect(connector?.status).toBe("degraded");
    expect(connector?.freshnessMinutes).toBe(0);
  });
});
