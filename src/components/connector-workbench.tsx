"use client";

import React, { useMemo, useState, useTransition } from "react";
import type { Connector, DashboardData, SyncRun, WarehouseTable } from "@/lib/reporting/types";

interface ConnectorWorkbenchProps {
  initialData: DashboardData;
}

const statusCopy = {
  healthy: "Healthy",
  degraded: "Degraded",
  paused: "Paused",
  failed: "Failed",
  running: "Running",
  succeeded: "Succeeded",
  warning: "Warning"
};

const statusRank: Record<Connector["status"], number> = {
  failed: 0,
  degraded: 1,
  healthy: 2,
  paused: 3
};

const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact" });

function formatTime(value: string | null): string {
  if (!value) {
    return "In progress";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatBytes(value: number): string {
  if (value < 1_000_000) {
    return `${Math.round(value / 1_000)} KB`;
  }

  if (value < 1_000_000_000) {
    return `${(value / 1_000_000).toFixed(1)} MB`;
  }

  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

function findLatestRun(runs: SyncRun[], connectorId: string): SyncRun | undefined {
  return runs.find((run) => run.connectorId === connectorId);
}

function findTable(tables: WarehouseTable[], connectorId: string): WarehouseTable | undefined {
  return tables.find((table) => table.connectorId === connectorId);
}

export function ConnectorWorkbench({ initialData }: ConnectorWorkbenchProps) {
  const [dashboard, setDashboard] = useState(initialData);
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<"all" | "bigquery" | "supabase">("all");
  const [selectedId, setSelectedId] = useState(initialData.connectors[0]?.id ?? "");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const connectors = useMemo(() => {
    return dashboard.connectors
      .filter((connector) => destination === "all" || connector.destination === destination)
      .filter((connector) => {
        const haystack = `${connector.name} ${connector.source} ${connector.owner} ${connector.tags.join(" ")}`;
        return haystack.toLowerCase().includes(query.toLowerCase());
      })
      .sort((a, b) => statusRank[a.status] - statusRank[b.status]);
  }, [dashboard.connectors, destination, query]);

  const selected = connectors.find((connector) => connector.id === selectedId) ?? connectors[0];
  const latestRun = selected ? findLatestRun(dashboard.syncRuns, selected.id) : undefined;
  const selectedTable = selected ? findTable(dashboard.tables, selected.id) : undefined;

  async function triggerSync(connectorId: string) {
    setLastAction(null);
    startTransition(async () => {
      const response = await fetch("/api/sync-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId })
      });

      const payload = (await response.json()) as
        | { run: SyncRun; dashboard: DashboardData }
        | { error: string };

      if (!response.ok || "error" in payload) {
        setLastAction("Sync could not be triggered.");
        return;
      }

      setDashboard(payload.dashboard);
      setSelectedId(connectorId);
      setLastAction(`Triggered ${payload.run.id} for ${selected?.name ?? "connector"}.`);
    });
  }

  return (
    <main className="console-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Reporting Connector</p>
          <h1>Pipeline ledger</h1>
        </div>
        <div className="secret-strip" aria-label="Credential checks">
          {dashboard.secretChecks.map((check) => (
            <span className={`secret-pill ${check.status}`} key={check.id} title={check.description}>
              {check.name}
            </span>
          ))}
        </div>
      </header>

      <section className="summary-band" aria-label="Connector summary">
        <Metric label="Active connectors" value={dashboard.summary.total.toString()} />
        <Metric label="Healthy" value={dashboard.summary.healthy.toString()} tone="ok" />
        <Metric label="At risk" value={(dashboard.summary.degraded + dashboard.summary.failed).toString()} tone="risk" />
        <Metric label="Rows in 24h" value={compactFormat.format(dashboard.summary.records24h)} />
        <Metric label="Avg freshness" value={`${dashboard.summary.avgFreshnessMinutes}m`} />
      </section>

      <section className="workbench-grid">
        <aside className="ledger-panel" aria-label="Connector ledger">
          <div className="filter-row">
            <input
              aria-label="Search connectors"
              placeholder="Search source, owner, tag"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Destination filter"
              value={destination}
              onChange={(event) => setDestination(event.target.value as "all" | "bigquery" | "supabase")}
            >
              <option value="all">All destinations</option>
              <option value="bigquery">BigQuery</option>
              <option value="supabase">Supabase</option>
            </select>
          </div>

          <div className="ledger-list">
            {connectors.map((connector) => {
              const run = findLatestRun(dashboard.syncRuns, connector.id);
              const isSelected = selected?.id === connector.id;

              return (
                <button
                  className={`ledger-row ${isSelected ? "selected" : ""}`}
                  key={connector.id}
                  onClick={() => setSelectedId(connector.id)}
                  type="button"
                >
                  <span className={`status-rail ${connector.status}`} />
                  <span>
                    <strong>{connector.name}</strong>
                    <small>{connector.source}</small>
                  </span>
                  <span className="row-meta">
                    <strong>{statusCopy[connector.status]}</strong>
                    <small>{run ? formatTime(run.finishedAt) : "No run"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="detail-panel" aria-label="Connector detail">
          {selected ? (
            <>
              <div className="detail-head">
                <div>
                  <p className="eyebrow">{selected.destination.toUpperCase()}</p>
                  <h2>{selected.name}</h2>
                  <p>{selected.destinationTable}</p>
                </div>
                <button
                  className="primary-action"
                  disabled={isPending}
                  onClick={() => triggerSync(selected.id)}
                  type="button"
                >
                  {isPending ? "Triggering" : "Run sync"}
                </button>
              </div>

              {lastAction ? <p className="action-note">{lastAction}</p> : null}

              <div className="detail-metrics">
                <Metric label="Freshness" value={`${selected.freshnessMinutes}m`} tone={selected.status === "failed" ? "risk" : "ok"} />
                <Metric label="SLA" value={`${selected.slaMinutes}m`} />
                <Metric label="Error rate" value={`${(selected.errorRate * 100).toFixed(1)}%`} />
                <Metric label="Latency" value={`${selected.latencyMs}ms`} />
              </div>

              <div className="audit-lane">
                <h3>Latest sync receipt</h3>
                {latestRun ? (
                  <div className={`receipt ${latestRun.status}`}>
                    <div>
                      <strong>{statusCopy[latestRun.status]}</strong>
                      <span>{latestRun.message}</span>
                    </div>
                    <dl>
                      <dt>Extracted</dt>
                      <dd>{numberFormat.format(latestRun.recordsExtracted)}</dd>
                      <dt>Loaded</dt>
                      <dd>{numberFormat.format(latestRun.recordsLoaded)}</dd>
                      <dt>Bytes</dt>
                      <dd>{formatBytes(latestRun.bytesLoaded)}</dd>
                      <dt>Finished</dt>
                      <dd>{formatTime(latestRun.finishedAt)}</dd>
                    </dl>
                  </div>
                ) : (
                  <p className="empty-state">No sync receipt is available yet.</p>
                )}
              </div>

              <div className="destination-ledger">
                <h3>Destination checks</h3>
                {selectedTable ? (
                  <div className="destination-row">
                    <span>{selectedTable.name}</span>
                    <strong>{compactFormat.format(selectedTable.rowCount)} rows</strong>
                    <span>{selectedTable.freshnessMinutes}m fresh</span>
                    <span className={`drift ${selectedTable.schemaDrift}`}>{selectedTable.schemaDrift}</span>
                    <span className={`checksum ${selectedTable.checksumStatus}`}>{selectedTable.checksumStatus}</span>
                  </div>
                ) : (
                  <p className="empty-state">No destination metadata found.</p>
                )}
              </div>
            </>
          ) : (
            <p className="empty-state">No connector matches the current filter.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "risk";
}) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
