import { z } from "zod";
import { mockConnectors, mockSyncRuns } from "@/lib/reporting/mock-data";
import type { Connector, SyncRun } from "@/lib/reporting/types";

const airbyteConnectionSchema = z.object({
  connectionId: z.string(),
  name: z.string(),
  status: z.string().optional()
});

export interface AirbyteClient {
  listConnections(): Promise<Connector[]>;
  listJobs(connectionId?: string): Promise<SyncRun[]>;
  triggerSync(connectionId: string): Promise<{ jobId: string; status: string }>;
}

export class MockAirbyteClient implements AirbyteClient {
  async listConnections(): Promise<Connector[]> {
    return structuredClone(mockConnectors);
  }

  async listJobs(connectionId?: string): Promise<SyncRun[]> {
    const jobs = connectionId
      ? mockSyncRuns.filter((run) => run.connectorId === connectionId)
      : mockSyncRuns;

    return structuredClone(jobs);
  }

  async triggerSync(connectionId: string): Promise<{ jobId: string; status: string }> {
    return {
      jobId: `mock-airbyte-${connectionId}-${Date.now()}`,
      status: "started"
    };
  }
}

export class AirbyteHttpClient implements AirbyteClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async listConnections(): Promise<Connector[]> {
    const response = await this.request("/api/public/v1/connections");
    const records = z.array(airbyteConnectionSchema).parse(response.data ?? response.connections ?? []);

    return records.map((connection) => ({
      id: connection.connectionId,
      name: connection.name,
      source: "Airbyte",
      destination: "bigquery",
      destinationTable: "configured_in_airbyte",
      status: connection.status === "active" ? "healthy" : "paused",
      owner: "Data Platform",
      cadence: "Configured in Airbyte",
      lastSyncAt: new Date().toISOString(),
      nextSyncAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      slaMinutes: 60,
      freshnessMinutes: 0,
      records24h: 0,
      errorRate: 0,
      latencyMs: 0,
      tags: ["airbyte"]
    }));
  }

  async listJobs(_connectionId?: string): Promise<SyncRun[]> {
    const response = await this.request("/api/public/v1/jobs?limit=20");
    const jobs = z.array(z.unknown()).parse(response.data ?? response.jobs ?? []);

    return jobs.map((job, index) => ({
      id: `airbyte-job-${index}`,
      connectorId: "external-airbyte",
      status: "succeeded",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      recordsExtracted: 0,
      recordsLoaded: 0,
      bytesLoaded: 0,
      message: `External Airbyte job received: ${JSON.stringify(job).slice(0, 120)}`
    }));
  }

  async triggerSync(connectionId: string): Promise<{ jobId: string; status: string }> {
    const response = await this.request("/api/public/v1/jobs", {
      method: "POST",
      body: JSON.stringify({ jobType: "sync", connectionId })
    });

    return {
      jobId: String(response.jobId ?? response.id ?? "unknown"),
      status: String(response.status ?? "started")
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
        ...init.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Airbyte request failed with ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export function createAirbyteClient(): AirbyteClient {
  const baseUrl = process.env.AIRBYTE_API_URL;
  const token = process.env.AIRBYTE_API_TOKEN;

  if (!baseUrl || !token) {
    return new MockAirbyteClient();
  }

  return new AirbyteHttpClient(baseUrl, token);
}
