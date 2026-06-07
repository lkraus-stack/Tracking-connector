"use client";

import React, { useMemo, useState, useTransition } from "react";
import type {
  AdPlatform,
  AdminDashboardData,
  AirbyteJob,
  ManagedConnector
} from "@tracking-connector/shared";
import { getLastCompleteMonth } from "@tracking-connector/shared";

interface ConnectorWorkbenchProps {
  initialData: AdminDashboardData;
}

const platformLabel: Record<AdPlatform, string> = {
  tiktok: "TikTok Marketing",
  bing: "Microsoft Ads"
};

const statusLabel = {
  healthy: "Healthy",
  warning: "Check",
  failed: "Failed",
  paused: "Paused",
  running: "Running",
  succeeded: "Succeeded",
  cancelled: "Cancelled",
  incomplete: "Incomplete"
};

const currency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const number = new Intl.NumberFormat("de-DE");

export function ConnectorWorkbench({ initialData }: ConnectorWorkbenchProps) {
  const [dashboard, setDashboard] = useState(initialData);
  const [selectedClientId, setSelectedClientId] = useState(initialData.clients[0]?.id ?? "");
  const [platform, setPlatform] = useState<"all" | AdPlatform>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastCompleteMonth = getLastCompleteMonth();

  const selectedClient = dashboard.clients.find((client) => client.id === selectedClientId) ?? dashboard.clients[0];
  const selectedConnectors = useMemo(() => {
    return dashboard.connectors
      .filter((connector) => !selectedClient || connector.clientId === selectedClient.id)
      .filter((connector) => platform === "all" || connector.platform === platform)
      .toSorted((a, b) => statusWeight(a.status) - statusWeight(b.status));
  }, [dashboard.connectors, platform, selectedClient]);

  const monthlyRows = dashboard.paidAdsLastCompleteMonth.filter(
    (row) => !selectedClient || row.clientId === selectedClient.id
  );
  const totals = monthlyRows.reduce(
    (acc, row) => ({
      cost: acc.cost + row.cost,
      conversions: acc.conversions + row.conversions,
      revenue: acc.revenue + row.revenue,
      clicks: acc.clicks + row.clicks
    }),
    { cost: 0, conversions: 0, revenue: 0, clicks: 0 }
  );

  async function triggerSync(connectionId: string) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/sync-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId })
      });
      const payload = (await response.json()) as
        | { job: AirbyteJob; dashboard: AdminDashboardData }
        | { error: string };

      if (!response.ok || "error" in payload) {
        setMessage("Sync konnte nicht gestartet werden. Prüfe Airbyte-Verbindung und Credentials.");
        return;
      }

      setDashboard(payload.dashboard);
      setMessage(`Airbyte Sync ${payload.job.id} wurde gestartet.`);
    });
  }

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a className="text-sm text-amber-300 hover:text-amber-200" href="/validation">
              Validation
            </a>
            <p className="text-xs font-semibold uppercase tracking-normal text-amber-400">
              Performance Marketing Data Ops
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-white lg:text-6xl">
              Monthly reporting control
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <ModePill label="Airbyte" active={!dashboard.mockMode.airbyte} />
            <ModePill label="BigQuery" active={!dashboard.mockMode.bigquery} />
            <ModePill label="Supabase" active={!dashboard.mockMode.supabase} />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4" aria-label="Monthly performance summary">
          <Metric label={`Spend ${lastCompleteMonth.label}`} value={currency.format(totals.cost)} />
          <Metric label="Conversions" value={number.format(totals.conversions)} />
          <Metric label="Revenue" value={currency.format(totals.revenue)} />
          <Metric label="Clicks" value={number.format(totals.clicks)} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-stone-800 bg-stone-900/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-200">Clients</h2>
              <span className="rounded-full bg-stone-800 px-2 py-1 text-xs text-stone-400">
                {dashboard.clients.length}
              </span>
            </div>
            <div className="grid gap-2">
              {dashboard.clients.map((client) => {
                const clientHealth = dashboard.health.filter((health) =>
                  dashboard.connectors.some(
                    (connector) =>
                      connector.clientId === client.id && connector.airbyteConnectionId === health.connectionId
                  )
                );
                const needsAttention = clientHealth.some((health) => health.needsAttention);

                return (
                  <button
                    className={`rounded-md border p-3 text-left transition ${
                      selectedClient?.id === client.id
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-stone-800 bg-stone-950 hover:border-stone-700"
                    }`}
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    type="button"
                  >
                    <span className="block font-semibold text-stone-100">{client.name}</span>
                    <span className="mt-1 block text-xs text-stone-400">{client.owner}</span>
                    <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs ${needsAttention ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                      {needsAttention ? "Needs review" : "Ready"}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="grid gap-5">
            <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Selected client</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{selectedClient?.name ?? "No client"}</h2>
                  <p className="mt-1 text-sm text-stone-400">
                    Monthly reports close on day {selectedClient?.monthlyReportDay ?? "-"} in {selectedClient?.timezone ?? "UTC"}.
                  </p>
                </div>
                <div className="flex rounded-md border border-stone-800 bg-stone-950 p-1">
                  {(["all", "tiktok", "bing"] as const).map((value) => (
                    <button
                      className={`rounded px-3 py-2 text-sm ${platform === value ? "bg-amber-500 text-stone-950" : "text-stone-300"}`}
                      key={value}
                      onClick={() => setPlatform(value)}
                      type="button"
                    >
                      {value === "all" ? "All" : platformLabel[value]}
                    </button>
                  ))}
                </div>
              </div>

              {message ? (
                <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                  {message}
                </p>
              ) : null}

              <div className="mt-5 grid gap-3">
                {selectedConnectors.map((connector) => (
                  <ConnectorRow
                    connector={connector}
                    disabled={isPending}
                    health={dashboard.health.find((item) => item.connectionId === connector.airbyteConnectionId)}
                    job={dashboard.jobs.find((job) => job.connectionId === connector.airbyteConnectionId)}
                    key={connector.id}
                    onRun={() => triggerSync(connector.airbyteConnectionId)}
                  />
                ))}
              </div>
            </div>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-4">
                <h2 className="text-lg font-semibold text-white">Looker Studio BigQuery views</h2>
                <div className="mt-4 grid gap-2">
                  {dashboard.reportingViews.map((view) => (
                    <div className="grid gap-2 rounded-md border border-stone-800 bg-stone-950 p-3 md:grid-cols-[minmax(0,1fr)_90px_120px]" key={view.viewName}>
                      <div>
                        <p className="font-medium text-stone-100">{view.viewName}</p>
                        <p className="mt-1 text-sm text-stone-500">{view.message}</p>
                      </div>
                      <span className="text-sm text-stone-300">{number.format(view.rowCount)} rows</span>
                      <StatusPill status={view.status === "ok" ? "healthy" : view.status === "stale" ? "warning" : "failed"} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-4">
                <h2 className="text-lg font-semibold text-white">Last complete month</h2>
                <p className="mt-1 text-sm text-stone-400">
                  {lastCompleteMonth.start} to {lastCompleteMonth.end}
                </p>
                <div className="mt-4 grid gap-3">
                  {monthlyRows.map((row) => (
                    <div className="rounded-md border border-stone-800 bg-stone-950 p-3" key={`${row.clientId}-${row.platform}-${row.campaignId}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-stone-100">{platformLabel[row.platform]}</span>
                        <span className="text-sm text-stone-400">{currency.format(row.cost)}</span>
                      </div>
                      <p className="mt-2 text-sm text-stone-400">{row.campaignName}</p>
                      <p className="mt-2 text-xs text-stone-500">
                        {number.format(row.clicks)} clicks · {number.format(row.conversions)} conversions
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}

function ConnectorRow({
  connector,
  disabled,
  health,
  job,
  onRun
}: {
  connector: ManagedConnector;
  disabled: boolean;
  health: AdminDashboardData["health"][number] | undefined;
  job: AirbyteJob | undefined;
  onRun: () => void;
}) {
  return (
    <article className="grid gap-4 rounded-md border border-stone-800 bg-stone-950 p-4 xl:grid-cols-[minmax(0,1fr)_180px_132px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={health?.status ?? connector.status} />
          <span className="rounded-full bg-stone-800 px-2 py-1 text-xs text-stone-300">
            {platformLabel[connector.platform]}
          </span>
          <span className="rounded-full bg-stone-800 px-2 py-1 text-xs text-stone-300">
            {connector.schedule}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold text-white">{connector.connectionName}</h3>
        <p className="mt-1 text-sm text-stone-400">
          {connector.destinationDataset}.{connector.destinationTable}
        </p>
        <p className="mt-3 text-sm text-stone-500">{health?.message ?? "No health check available."}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-1">
        <div>
          <dt className="text-stone-500">Freshness</dt>
          <dd className="font-semibold text-stone-100">{connector.freshnessHours}h</dd>
        </div>
        <div>
          <dt className="text-stone-500">Lookback</dt>
          <dd className="font-semibold text-stone-100">{connector.lookbackDays} days</dd>
        </div>
        <div>
          <dt className="text-stone-500">Last job</dt>
          <dd className="font-semibold text-stone-100">{job ? statusLabel[job.status] : "None"}</dd>
        </div>
      </dl>
      <button
        className="h-11 rounded-md bg-amber-400 px-4 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
        disabled={disabled}
        onClick={onRun}
        type="button"
      >
        {disabled ? "Starting" : "Run sync"}
      </button>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-4">
      <span className="text-sm text-stone-500">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold text-white">{value}</strong>
    </div>
  );
}

function ModePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded-full px-3 py-2 text-center ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-stone-800 text-stone-400"}`}>
      {label} {active ? "live" : "mock"}
    </span>
  );
}

function StatusPill({ status }: { status: "healthy" | "warning" | "failed" | "paused" }) {
  const className =
    status === "healthy"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-300"
        : status === "paused"
          ? "bg-stone-700 text-stone-300"
          : "bg-red-500/15 text-red-300";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>{statusLabel[status]}</span>;
}

function statusWeight(status: ManagedConnector["status"]) {
  return status === "failed" ? 0 : status === "warning" ? 1 : status === "healthy" ? 2 : 3;
}
