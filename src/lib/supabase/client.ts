import { mockTables } from "@/lib/reporting/mock-data";
import type { WarehouseTable } from "@/lib/reporting/types";

export interface SupabaseMetadataClient {
  listDestinationTables(): Promise<WarehouseTable[]>;
  getConnectorAuditRows(): Promise<Array<Record<string, unknown>>>;
}

export class MockSupabaseMetadataClient implements SupabaseMetadataClient {
  async listDestinationTables(): Promise<WarehouseTable[]> {
    return structuredClone(mockTables.filter((table) => table.destination === "supabase"));
  }

  async getConnectorAuditRows(): Promise<Array<Record<string, unknown>>> {
    return [
      {
        connector_id: "conn-hubspot-companies",
        last_loaded_at: "2026-06-07T05:33:00.000Z",
        row_count: 119402
      }
    ];
  }
}

export class SupabaseRestMetadataClient implements SupabaseMetadataClient {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string
  ) {}

  async listDestinationTables(): Promise<WarehouseTable[]> {
    const rows = await this.request("/rest/v1/reporting_connector_tables?select=*");

    return rows.map((row) => ({
      id: String(row.id),
      connectorId: String(row.connector_id),
      destination: "supabase",
      name: String(row.table_name),
      rowCount: Number(row.row_count ?? 0),
      freshnessMinutes: Number(row.freshness_minutes ?? 0),
      schemaDrift: row.schema_drift === "breaking" ? "breaking" : row.schema_drift === "additive" ? "additive" : "none",
      checksumStatus: row.checksum_status === "error" ? "error" : row.checksum_status === "warning" ? "warning" : "ok"
    }));
  }

  async getConnectorAuditRows(): Promise<Array<Record<string, unknown>>> {
    return this.request("/rest/v1/reporting_connector_audit?select=*&order=loaded_at.desc&limit=50");
  }

  private async request(path: string): Promise<Array<Record<string, unknown>>> {
    const response = await fetch(`${this.url.replace(/\/$/, "")}${path}`, {
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed with ${response.status}`);
    }

    return (await response.json()) as Array<Record<string, unknown>>;
  }
}

export function createSupabaseMetadataClient(): SupabaseMetadataClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return new MockSupabaseMetadataClient();
  }

  return new SupabaseRestMetadataClient(url, key);
}
