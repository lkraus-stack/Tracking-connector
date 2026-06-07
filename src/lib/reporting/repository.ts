import { createAirbyteClient } from "@/lib/airbyte/client";
import { createBigQueryMetadataClient } from "@/lib/bigquery/client";
import { createSupabaseMetadataClient } from "@/lib/supabase/client";
import { getDashboardSnapshot, triggerMockSync } from "./store";
import type { DashboardData, SyncRun } from "./types";

export async function getDashboardData(): Promise<DashboardData> {
  const snapshot = getDashboardSnapshot();
  const supabase = createSupabaseMetadataClient();
  const bigQuery = createBigQueryMetadataClient();

  const [supabaseTables, bigQueryTables] = await Promise.allSettled([
    supabase.listDestinationTables(),
    bigQuery.listDestinationTables()
  ]);

  const destinationTables = [
    ...(supabaseTables.status === "fulfilled" ? supabaseTables.value : []),
    ...(bigQueryTables.status === "fulfilled" ? bigQueryTables.value : [])
  ];

  return {
    ...snapshot,
    tables: destinationTables.length > 0 ? destinationTables : snapshot.tables
  };
}

export async function triggerConnectorSync(connectorId: string): Promise<SyncRun> {
  const airbyte = createAirbyteClient();

  await airbyte.triggerSync(connectorId);
  return triggerMockSync(connectorId);
}
