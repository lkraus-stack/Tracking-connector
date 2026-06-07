import { z } from "zod";
import {
  type AirbyteJob,
  type ConnectorHealth,
  type ManagedConnector,
  connectorStatusSchema,
  syncStatusSchema
} from "@tracking-connector/shared";
import { mockConnectors, mockJobs } from "@tracking-connector/shared";

const connectionSchema = z.object({
  connectionId: z.string(),
  name: z.string(),
  status: z.string().optional(),
  schedule: z.unknown().optional()
});

const jobSchema = z.object({
  jobId: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  connectionId: z.string().optional(),
  status: z.string().optional(),
  jobType: z.string().optional(),
  startedAt: z.union([z.string(), z.number()]).optional(),
  updatedAt: z.union([z.string(), z.number()]).optional(),
  endedAt: z.union([z.string(), z.number()]).optional(),
  recordsCommitted: z.number().optional(),
  bytesCommitted: z.number().optional(),
  attempts: z.array(z.unknown()).optional()
});

export interface AirbyteClientOptions {
  baseUrl?: string;
  token?: string;
  mock?: boolean;
}

export interface AirbyteClient {
  listConnections(): Promise<ManagedConnector[]>;
  getConnection(connectionId: string): Promise<ManagedConnector | null>;
  listJobs(connectionId?: string): Promise<AirbyteJob[]>;
  getJob(jobId: string): Promise<AirbyteJob | null>;
  triggerSync(connectionId: string): Promise<AirbyteJob>;
  cancelJob(jobId: string): Promise<AirbyteJob>;
  getLatestJobForConnection(connectionId: string): Promise<AirbyteJob | null>;
  getConnectionHealth(connectionId: string): Promise<ConnectorHealth>;
}

export class MockAirbyteClient implements AirbyteClient {
  private readonly connectors = structuredClone(mockConnectors);
  private readonly jobs = structuredClone(mockJobs);

  async listConnections(): Promise<ManagedConnector[]> {
    return structuredClone(this.connectors);
  }

  async getConnection(connectionId: string): Promise<ManagedConnector | null> {
    return this.connectors.find((connection) => connection.airbyteConnectionId === connectionId) ?? null;
  }

  async listJobs(connectionId?: string): Promise<AirbyteJob[]> {
    const jobs = connectionId ? this.jobs.filter((job) => job.connectionId === connectionId) : this.jobs;
    return structuredClone(jobs);
  }

  async getJob(jobId: string): Promise<AirbyteJob | null> {
    return structuredClone(this.jobs.find((job) => job.id === jobId) ?? null);
  }

  async triggerSync(connectionId: string): Promise<AirbyteJob> {
    const job: AirbyteJob = {
      id: `mock-job-${Date.now()}`,
      connectionId,
      status: "running",
      jobType: "sync",
      startedAt: new Date().toISOString(),
      endedAt: null,
      recordsCommitted: 0,
      bytesCommitted: 0
    };

    this.jobs.unshift(job);
    return structuredClone(job);
  }

  async cancelJob(jobId: string): Promise<AirbyteJob> {
    const job = this.jobs.find((item) => item.id === jobId);

    if (!job) {
      throw new Error(`Unknown Airbyte job: ${jobId}`);
    }

    job.status = "cancelled";
    job.endedAt = new Date().toISOString();
    return structuredClone(job);
  }

  async getLatestJobForConnection(connectionId: string): Promise<AirbyteJob | null> {
    const jobs = await this.listJobs(connectionId);
    return jobs.toSorted((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;
  }

  async getConnectionHealth(connectionId: string): Promise<ConnectorHealth> {
    const connection = await this.getConnection(connectionId);
    const latestJob = await this.getLatestJobForConnection(connectionId);

    if (!connection) {
      return {
        connectionId,
        status: "failed",
        latestJob,
        freshnessHours: Number.POSITIVE_INFINITY,
        needsAttention: true,
        message: "Connection is not mapped in the admin database."
      };
    }

    const status = connection.status;
    return {
      connectionId,
      status,
      latestJob,
      freshnessHours: connection.freshnessHours,
      needsAttention: status !== "healthy" || connection.freshnessHours > 48 || latestJob?.status === "failed",
      message:
        status === "healthy"
          ? "Airbyte connection is current."
          : latestJob?.failureReason ?? "Airbyte connection should be checked before reporting."
    };
  }
}

export class AirbyteHttpClient implements AirbyteClient {
  constructor(private readonly options: Required<Pick<AirbyteClientOptions, "baseUrl" | "token">>) {}

  async listConnections(): Promise<ManagedConnector[]> {
    const payload = await this.request("GET", "/connections");
    const rawConnections = z.array(connectionSchema).parse(extractArray(payload, "data", "connections"));

    return rawConnections.map((connection) => ({
      id: connection.connectionId,
      clientId: "unmapped-client",
      accountId: "unmapped-account",
      platform: inferPlatform(connection.name),
      airbyteConnectionId: connection.connectionId,
      connectionName: connection.name,
      destinationDataset: "airbyte_raw",
      destinationTable: inferDestinationTable(connection.name),
      schedule: "manual",
      lookbackDays: 30,
      status: connection.status === "active" ? "healthy" : "paused",
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      nextRecommendedSyncAt: null,
      freshnessHours: 0
    }));
  }

  async getConnection(connectionId: string): Promise<ManagedConnector | null> {
    try {
      const payload = await this.request("GET", `/connections/${connectionId}`);
      const connection = connectionSchema.parse(payload.data ?? payload);
      return {
        id: connection.connectionId,
        clientId: "unmapped-client",
        accountId: "unmapped-account",
        platform: inferPlatform(connection.name),
        airbyteConnectionId: connection.connectionId,
        connectionName: connection.name,
        destinationDataset: "airbyte_raw",
        destinationTable: inferDestinationTable(connection.name),
        schedule: "manual",
        lookbackDays: 30,
        status: connection.status === "active" ? "healthy" : "paused",
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        nextRecommendedSyncAt: null,
        freshnessHours: 0
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }

      throw error;
    }
  }

  async listJobs(connectionId?: string): Promise<AirbyteJob[]> {
    const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
    const payload = await this.request("GET", `/jobs${query}`);
    const rawJobs = z.array(jobSchema).parse(extractArray(payload, "data", "jobs"));

    return rawJobs.map((job) => normalizeJob(job, connectionId));
  }

  async getJob(jobId: string): Promise<AirbyteJob | null> {
    try {
      const payload = await this.request("GET", `/jobs/${jobId}`);
      return normalizeJob(jobSchema.parse(payload.data ?? payload));
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }

      throw error;
    }
  }

  async triggerSync(connectionId: string): Promise<AirbyteJob> {
    const payload = await this.request("POST", "/jobs", {
      jobType: "sync",
      connectionId
    });

    return normalizeJob(jobSchema.parse(payload.data ?? payload), connectionId);
  }

  async cancelJob(jobId: string): Promise<AirbyteJob> {
    const payload = await this.request("POST", `/jobs/${jobId}/cancel`);
    return normalizeJob(jobSchema.parse(payload.data ?? payload));
  }

  async getLatestJobForConnection(connectionId: string): Promise<AirbyteJob | null> {
    const jobs = await this.listJobs(connectionId);
    return jobs.toSorted((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;
  }

  async getConnectionHealth(connectionId: string): Promise<ConnectorHealth> {
    const [connection, latestJob] = await Promise.all([
      this.getConnection(connectionId),
      this.getLatestJobForConnection(connectionId)
    ]);
    const status = latestJob?.status === "failed" ? "failed" : connection?.status ?? "failed";

    return {
      connectionId,
      status,
      latestJob,
      freshnessHours: latestJob?.endedAt ? Math.max(0, Math.round((Date.now() - Date.parse(latestJob.endedAt)) / 3_600_000)) : 999,
      needsAttention: status !== "healthy",
      message: status === "healthy" ? "Airbyte API reports a healthy connection." : "Latest Airbyte job or mapping needs review."
    };
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/api/public/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.options.token}`,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Airbyte API ${method} ${path} failed with ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export function createAirbyteClient(options: AirbyteClientOptions = {}): AirbyteClient {
  const baseUrl = options.baseUrl ?? process.env.AIRBYTE_API_URL;
  const token = options.token ?? process.env.AIRBYTE_API_TOKEN;

  if (options.mock || !baseUrl || !token) {
    return new MockAirbyteClient();
  }

  return new AirbyteHttpClient({ baseUrl, token });
}

function extractArray(payload: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function normalizeJob(job: z.infer<typeof jobSchema>, fallbackConnectionId = "unknown"): AirbyteJob {
  const startedAt = normalizeDate(job.startedAt) ?? new Date().toISOString();
  const endedAt = normalizeDate(job.endedAt ?? job.updatedAt);
  const status = syncStatusSchema.catch("incomplete").parse(job.status);

  return {
    id: String(job.jobId ?? job.id ?? `airbyte-${Date.now()}`),
    connectionId: job.connectionId ?? fallbackConnectionId,
    status,
    jobType: job.jobType === "sync" || job.jobType === "reset" || job.jobType === "clear" ? job.jobType : "unknown",
    startedAt,
    endedAt,
    recordsCommitted: job.recordsCommitted ?? 0,
    bytesCommitted: job.bytesCommitted ?? 0
  };
}

function normalizeDate(value: string | number | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  return new Date(value).toISOString();
}

function inferPlatform(name: string): ManagedConnector["platform"] {
  return name.toLowerCase().includes("bing") || name.toLowerCase().includes("microsoft") ? "bing" : "tiktok";
}

function inferDestinationTable(name: string): string {
  return inferPlatform(name) === "bing"
    ? "_airbyte_raw_bing_campaign_performance_daily"
    : "_airbyte_raw_tiktok_ads_reports";
}

export { connectorStatusSchema };
