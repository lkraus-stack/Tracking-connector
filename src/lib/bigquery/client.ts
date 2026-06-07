import { mockTables } from "@/lib/reporting/mock-data";
import type { WarehouseTable } from "@/lib/reporting/types";

export interface BigQueryMetadataClient {
  listDestinationTables(): Promise<WarehouseTable[]>;
  estimateDailyBytes(): Promise<number>;
}

export class MockBigQueryMetadataClient implements BigQueryMetadataClient {
  async listDestinationTables(): Promise<WarehouseTable[]> {
    return structuredClone(mockTables.filter((table) => table.destination === "bigquery"));
  }

  async estimateDailyBytes(): Promise<number> {
    return 84_352_901_120;
  }
}

export class BigQueryRestMetadataClient implements BigQueryMetadataClient {
  constructor(private readonly projectId: string) {}

  async listDestinationTables(): Promise<WarehouseTable[]> {
    throw new Error(
      `BigQuery project ${this.projectId} is configured, but the optional Google SDK adapter is not installed. Use the SQL scripts or keep mock mode enabled.`
    );
  }

  async estimateDailyBytes(): Promise<number> {
    return 0;
  }
}

export function createBigQueryMetadataClient(): BigQueryMetadataClient {
  const projectId = process.env.BIGQUERY_PROJECT_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId || !credentialsPath || process.env.BIGQUERY_MOCK === "true") {
    return new MockBigQueryMetadataClient();
  }

  return new BigQueryRestMetadataClient(projectId);
}
