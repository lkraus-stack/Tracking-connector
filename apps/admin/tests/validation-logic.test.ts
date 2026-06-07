import { describe, expect, it } from "vitest";
import {
  aggregatePaidAdsRows,
  aggregateSupermetricsRows,
  calculateDiffPercent,
  compareMonthlyTotals,
  parseSupermetricsCsv
} from "@tracking-connector/shared";
import { mockPaidAdsRows } from "@tracking-connector/shared";

const exampleCsv = `month,platform,account,campaign,impressions,clicks,spend,conversions,revenue
2026-05,TikTok,71122334455,Prospecting,635998,20707,4930.22,131,12183
2026-05,Microsoft Ads,MS-998877,Brand,157497,5128,1220.91,74,6882`;

describe("validation logic", () => {
  it("parses flexible Supermetrics CSV columns", () => {
    const rows = parseSupermetricsCsv(exampleCsv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      month: "2026-05",
      platform: "tiktok",
      spend: 4930.22,
      conversionValue: 12183
    });
    expect(rows[1]?.platform).toBe("bing");
  });

  it("aggregates monthly comparison values by platform", () => {
    const rows = parseSupermetricsCsv(exampleCsv);
    const totals = aggregateSupermetricsRows(rows, "2026-05", "both");
    const airbyte = aggregatePaidAdsRows(mockPaidAdsRows, "2026-05", "both");

    expect(totals.spend).toBeCloseTo(6151.13);
    expect(airbyte.spend).toBeCloseTo(9162.56);
  });

  it("applies default threshold logic", () => {
    const result = compareMonthlyTotals({
      clientId: "client-nordstern",
      platform: "tiktok",
      month: "2026-05",
      airbyte: {
        spend: 100.6,
        clicks: 100,
        impressions: 100,
        conversions: 106,
        conversionValue: 100
      },
      comparison: {
        spend: 100,
        clicks: 100,
        impressions: 100,
        conversions: 100,
        conversionValue: 100
      }
    });

    expect(result.metrics.find((metric) => metric.metric === "spend")?.status).toBe("warning");
    expect(result.metrics.find((metric) => metric.metric === "conversions")?.status).toBe("error");
    expect(result.status).toBe("error");
  });

  it("handles percent deviation for zero comparison values", () => {
    expect(calculateDiffPercent(0, 0)).toBe(0);
    expect(calculateDiffPercent(10, 0)).toBe(100);
  });
});
