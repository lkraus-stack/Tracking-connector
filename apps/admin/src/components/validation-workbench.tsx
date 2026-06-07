"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import type {
  AgencyClient,
  MetricComparison,
  MonthlyValidationResult,
  ValidationPlatform,
  ValidationRunRecord,
  ValidationTotals
} from "@tracking-connector/shared";
import { compareMonthlyTotals } from "@tracking-connector/shared";

interface ValidationWorkbenchProps {
  clients: AgencyClient[];
  defaultClientId: string;
  defaultMonth: string;
}

const platformOptions: Array<{ value: ValidationPlatform; label: string }> = [
  { value: "both", label: "TikTok + Bing" },
  { value: "tiktok", label: "TikTok" },
  { value: "bing", label: "Bing" }
];

const metricLabels: Record<MetricComparison["metric"], string> = {
  spend: "Spend",
  clicks: "Clicks",
  impressions: "Impressions",
  conversions: "Conversions",
  conversionValue: "Conversion Value"
};

const statusLabels = {
  ok: "OK",
  warning: "WARNUNG",
  error: "FEHLER"
};

const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

export function ValidationWorkbench({ clients, defaultClientId, defaultMonth }: ValidationWorkbenchProps) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [platform, setPlatform] = useState<ValidationPlatform>("both");
  const [month, setMonth] = useState(defaultMonth);
  const [comparison, setComparison] = useState<ValidationTotals | null>(null);
  const [result, setResult] = useState<MonthlyValidationResult | null>(null);
  const [runs, setRuns] = useState<ValidationRunRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clientId, clients]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    void loadMonthly();
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, platform, month]);

  async function loadMonthly(nextComparison = comparison) {
    const params = new URLSearchParams({ clientId, platform, month });
    const response = await fetch(`/api/validation/monthly?${params.toString()}`);
    const payload = (await response.json()) as MonthlyValidationResult | { error: string };

    if (!response.ok || "error" in payload) {
      setNotice("Monatswerte konnten nicht geladen werden.");
      return;
    }

    if (nextComparison) {
      setResult(
        compareMonthlyTotals({
          clientId,
          platform,
          month,
          airbyte: payload.airbyte,
          comparison: nextComparison
        })
      );
      return;
    }

    setResult(payload);
  }

  async function loadRuns() {
    const params = new URLSearchParams({ clientId });
    const response = await fetch(`/api/validation/runs?${params.toString()}`);
    const payload = (await response.json()) as { runs: ValidationRunRecord[] };
    setRuns(payload.runs ?? []);
  }

  function uploadCsv(file: File | null) {
    if (!file) {
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("month", month);
      formData.set("platform", platform);

      const response = await fetch("/api/validation/supermetrics-csv", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as
        | { totals: ValidationTotals; rowCount: number }
        | { error: string };

      if (!response.ok || "error" in payload) {
        setNotice("CSV konnte nicht verarbeitet werden.");
        return;
      }

      setComparison(payload.totals);
      const runResponse = await fetch("/api/validation/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          platform,
          month,
          comparison: payload.totals,
          source: "supermetrics_csv",
          rawPayload: { rowCount: payload.rowCount }
        })
      });
      const run = (await runResponse.json()) as ValidationRunRecord | { error: string };

      if (!runResponse.ok || "error" in run) {
        setNotice("Vergleich wurde berechnet, aber der Validation Run konnte nicht gespeichert werden.");
        return;
      }

      setResult(run);
      await loadRuns();
      setNotice(`${payload.rowCount} Supermetrics-Zeilen temporär verarbeitet.`);
    });
  }

  function saveManualRun() {
    if (!comparison) {
      setNotice("Bitte zuerst eine Supermetrics CSV hochladen.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/validation/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, platform, month, comparison, source: "supermetrics_csv" })
      });
      const run = (await response.json()) as ValidationRunRecord | { error: string };

      if (!response.ok || "error" in run) {
        setNotice("Validation Run konnte nicht gespeichert werden.");
        return;
      }

      setResult(run);
      await loadRuns();
      setNotice("Validation Run gespeichert.");
    });
  }

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a className="text-sm text-amber-300 hover:text-amber-200" href="/">
              Dashboard
            </a>
            <p className="mt-4 text-xs font-semibold uppercase tracking-normal text-amber-400">
              Live-Abnahme gegen Supermetrics
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-white lg:text-6xl">
              Validation cockpit
            </h1>
          </div>
          <StatusBadge status={result?.status ?? "ok"} />
        </header>

        <section className="grid gap-4 rounded-lg border border-stone-800 bg-stone-900/70 p-4 lg:grid-cols-4">
          <label className="grid gap-2 text-sm">
            <span className="text-stone-400">Kunde</span>
            <select
              className="h-11 rounded-md border border-stone-700 bg-stone-950 px-3 text-stone-100"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-stone-400">Plattform</span>
            <select
              className="h-11 rounded-md border border-stone-700 bg-stone-950 px-3 text-stone-100"
              value={platform}
              onChange={(event) => setPlatform(event.target.value as ValidationPlatform)}
            >
              {platformOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-stone-400">Monat</span>
            <input
              className="h-11 rounded-md border border-stone-700 bg-stone-950 px-3 text-stone-100"
              pattern="\d{4}-\d{2}"
              placeholder="YYYY-MM"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-stone-400">Supermetrics CSV</span>
            <input
              accept=".csv,text/csv"
              className="h-11 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-stone-100 file:mr-3 file:rounded file:border-0 file:bg-amber-400 file:px-2 file:py-1 file:text-stone-950"
              disabled={isPending}
              onChange={(event) => uploadCsv(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </section>

        {notice ? <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">{notice}</p> : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Monatsvergleich</h2>
                <p className="text-sm text-stone-400">
                  {selectedClient?.name} · {platformOptions.find((option) => option.value === platform)?.label} · {month}
                </p>
              </div>
              <button
                className="h-10 rounded-md bg-amber-400 px-4 text-sm font-semibold text-stone-950 disabled:cursor-wait disabled:opacity-60"
                disabled={isPending || !comparison}
                onClick={saveManualRun}
                type="button"
              >
                Run speichern
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-800 text-left text-stone-400">
                    <th className="py-3 pr-4">Metrik</th>
                    <th className="py-3 pr-4">Airbyte/BigQuery</th>
                    <th className="py-3 pr-4">Supermetrics</th>
                    <th className="py-3 pr-4">Abweichung</th>
                    <th className="py-3 pr-4">Abweichung %</th>
                    <th className="py-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.metrics ?? []).map((metric) => (
                    <tr className="border-b border-stone-800/70" key={metric.metric}>
                      <td className="py-3 pr-4 font-medium text-stone-100">{metricLabels[metric.metric]}</td>
                      <td className="py-3 pr-4">{formatMetric(metric.metric, metric.airbyte)}</td>
                      <td className="py-3 pr-4">
                        {metric.comparison === null ? "Noch kein CSV" : formatMetric(metric.metric, metric.comparison)}
                      </td>
                      <td className="py-3 pr-4">{metric.diff === null ? "-" : formatMetric(metric.metric, metric.diff)}</td>
                      <td className="py-3 pr-4">
                        {metric.diffPercent === null ? "-" : `${numberFormat.format(metric.diffPercent)}%`}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={metric.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-stone-800 bg-stone-900/70 p-4">
            <h2 className="text-lg font-semibold text-white">Letzte Validation Runs</h2>
            <div className="mt-4 grid gap-3">
              {runs.length === 0 ? (
                <p className="text-sm text-stone-500">Noch keine Runs für diesen Kunden.</p>
              ) : (
                runs.map((run) => (
                  <div className="rounded-md border border-stone-800 bg-stone-950 p-3" key={run.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-stone-100">{run.month}</span>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      {run.platform} · {new Date(run.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: "ok" | "warning" | "error" }) {
  const className =
    status === "ok"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-red-500/15 text-red-300";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{statusLabels[status]}</span>;
}

function formatMetric(metric: MetricComparison["metric"], value: number) {
  if (metric === "spend" || metric === "conversionValue") {
    return `${numberFormat.format(value)} €`;
  }

  return numberFormat.format(value);
}
