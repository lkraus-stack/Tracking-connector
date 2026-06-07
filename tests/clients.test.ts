import { describe, expect, it } from "vitest";
import { MockAirbyteClient } from "@/lib/airbyte/client";
import { MockBigQueryMetadataClient } from "@/lib/bigquery/client";
import { MockSupabaseMetadataClient } from "@/lib/supabase/client";

describe("mock provider clients", () => {
  it("returns Airbyte connectors and jobs without credentials", async () => {
    const client = new MockAirbyteClient();

    await expect(client.listConnections()).resolves.toHaveLength(4);
    await expect(client.listJobs("conn-shopify-orders")).resolves.toHaveLength(1);
  });

  it("separates Supabase and BigQuery destination metadata", async () => {
    const supabase = await new MockSupabaseMetadataClient().listDestinationTables();
    const bigQuery = await new MockBigQueryMetadataClient().listDestinationTables();

    expect(supabase.every((table) => table.destination === "supabase")).toBe(true);
    expect(bigQuery.every((table) => table.destination === "bigquery")).toBe(true);
  });
});
