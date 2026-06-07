import { describe, expect, it } from "vitest";
import { GET as getMonthly } from "@/app/api/validation/monthly/route";
import { POST as postCsv } from "@/app/api/validation/supermetrics-csv/route";

const csv = `date,platform,account,impressions,clicks,cost,conversions,conversion_value
2026-05-01,tiktok,71122334455,1000,100,100.50,10,900`;

describe("validation API mapping", () => {
  it("maps monthly query parameters to validation result", async () => {
    const response = await getMonthly(
      new Request("http://localhost/api/validation/monthly?clientId=client-nordstern&platform=tiktok&month=2026-05")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clientId).toBe("client-nordstern");
    expect(payload.platform).toBe("tiktok");
    expect(payload.airbyte.spend).toBeGreaterThan(0);
  });

  it("maps JSON CSV upload payload to temporary Supermetrics totals", async () => {
    const response = await postCsv(
      new Request("http://localhost/api/validation/supermetrics-csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, month: "2026-05", platform: "tiktok" })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rowCount).toBe(1);
    expect(payload.totals.spend).toBe(100.5);
    expect(payload.totals.conversionValue).toBe(900);
  });
});
