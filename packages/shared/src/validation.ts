import { z } from "zod";
import type { AdPlatform, PaidAdsDailyRow } from "./index";

export const validationStatusSchema = z.enum(["ok", "warning", "error"]);
export type ValidationStatus = z.infer<typeof validationStatusSchema>;

export const validationPlatformSchema = z.enum(["tiktok", "bing", "both"]);
export type ValidationPlatform = z.infer<typeof validationPlatformSchema>;

export const validationMetricSchema = z.enum([
  "spend",
  "clicks",
  "impressions",
  "conversions",
  "conversionValue"
]);
export type ValidationMetric = z.infer<typeof validationMetricSchema>;

export const validationThresholds: Record<ValidationMetric, { warnPercent: number; errorPercent: number }> = {
  spend: { warnPercent: 0.5, errorPercent: 1 },
  clicks: { warnPercent: 0.5, errorPercent: 1 },
  impressions: { warnPercent: 0.5, errorPercent: 1 },
  conversions: { warnPercent: 2, errorPercent: 5 },
  conversionValue: { warnPercent: 2, errorPercent: 5 }
};

export interface ValidationTotals {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
}

export interface ParsedSupermetricsRow {
  month: string;
  platform: AdPlatform;
  account: string;
  campaign: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
}

export interface MetricComparison {
  metric: ValidationMetric;
  airbyte: number;
  comparison: number | null;
  diff: number | null;
  diffPercent: number | null;
  status: ValidationStatus;
}

export interface MonthlyValidationResult {
  clientId: string;
  platform: ValidationPlatform;
  month: string;
  airbyte: ValidationTotals;
  comparison: ValidationTotals | null;
  metrics: MetricComparison[];
  status: ValidationStatus;
}

export interface ValidationRunRecord extends MonthlyValidationResult {
  id: string;
  source: "supermetrics_csv" | "manual" | "mock";
  createdAt: string;
}

const emptyTotals: ValidationTotals = {
  spend: 0,
  clicks: 0,
  impressions: 0,
  conversions: 0,
  conversionValue: 0
};

const aliases = {
  month: ["month", "date"],
  platform: ["platform"],
  account: ["account", "account_id", "account id", "account name", "account_name"],
  campaign: ["campaign", "campaign_id", "campaign id", "campaign name", "campaign_name"],
  impressions: ["impressions", "impr"],
  clicks: ["clicks"],
  spend: ["cost", "spend"],
  conversions: ["conversions", "conversion"],
  conversionValue: ["conversion_value", "conversion value", "revenue", "conv. value", "conv value"]
} as const;

export function parseSupermetricsCsv(csv: string): ParsedSupermetricsRow[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const indices = resolveColumnIndices(headers);

  return rows.slice(1).flatMap((cells) => {
    if (cells.every((cell) => cell.trim() === "")) {
      return [];
    }

    const platform = normalizePlatform(readCell(cells, indices.platform));
    if (!platform) {
      throw new Error(`Unsupported platform in CSV row: ${readCell(cells, indices.platform)}`);
    }

    return [
      {
        month: normalizeMonth(readCell(cells, indices.month)),
        platform,
        account: readCell(cells, indices.account),
        campaign: indices.campaign === null ? null : readCell(cells, indices.campaign) || null,
        impressions: parseNumber(readCell(cells, indices.impressions)),
        clicks: parseNumber(readCell(cells, indices.clicks)),
        spend: parseNumber(readCell(cells, indices.spend)),
        conversions: parseNumber(readCell(cells, indices.conversions)),
        conversionValue: parseNumber(readCell(cells, indices.conversionValue))
      }
    ];
  });
}

export function aggregateSupermetricsRows(
  rows: ParsedSupermetricsRow[],
  month: string,
  platform: ValidationPlatform
): ValidationTotals {
  return rows
    .filter((row) => row.month === month)
    .filter((row) => platform === "both" || row.platform === platform)
    .reduce(addTotalsFromSupermetricsRow, { ...emptyTotals });
}

export function aggregatePaidAdsRows(
  rows: PaidAdsDailyRow[],
  month: string,
  platform: ValidationPlatform
): ValidationTotals {
  return rows
    .filter((row) => row.date.slice(0, 7) === month)
    .filter((row) => platform === "both" || row.platform === platform)
    .reduce(
      (totals, row) => ({
        spend: totals.spend + row.cost,
        clicks: totals.clicks + row.clicks,
        impressions: totals.impressions + row.impressions,
        conversions: totals.conversions + row.conversions,
        conversionValue: totals.conversionValue + row.revenue
      }),
      { ...emptyTotals }
    );
}

export function compareMonthlyTotals({
  clientId,
  platform,
  month,
  airbyte,
  comparison,
  thresholds = validationThresholds
}: {
  clientId: string;
  platform: ValidationPlatform;
  month: string;
  airbyte: ValidationTotals;
  comparison: ValidationTotals | null;
  thresholds?: typeof validationThresholds;
}): MonthlyValidationResult {
  const metrics = validationMetricSchema.options.map((metric) =>
    compareMetric(metric, airbyte[metric], comparison?.[metric] ?? null, thresholds[metric])
  );

  return {
    clientId,
    platform,
    month,
    airbyte,
    comparison,
    metrics,
    status: combineStatuses(metrics.map((metric) => metric.status))
  };
}

export function calculateDiffPercent(airbyte: number, comparison: number): number {
  if (comparison === 0) {
    return airbyte === 0 ? 0 : 100;
  }

  return (Math.abs(airbyte - comparison) / Math.abs(comparison)) * 100;
}

export function normalizeMonth(value: string): string {
  const trimmed = value.trim();
  const monthMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 7);
  }

  throw new Error(`Invalid month/date value: ${value}`);
}

export function monthToDate(month: string): string {
  const normalized = normalizeMonth(month);
  return `${normalized}-01`;
}

function compareMetric(
  metric: ValidationMetric,
  airbyte: number,
  comparison: number | null,
  threshold: { warnPercent: number; errorPercent: number }
): MetricComparison {
  if (comparison === null) {
    return {
      metric,
      airbyte,
      comparison,
      diff: null,
      diffPercent: null,
      status: "ok"
    };
  }

  const diff = airbyte - comparison;
  const diffPercent = calculateDiffPercent(airbyte, comparison);
  const status: ValidationStatus =
    diffPercent >= threshold.errorPercent ? "error" : diffPercent >= threshold.warnPercent ? "warning" : "ok";

  return {
    metric,
    airbyte,
    comparison,
    diff,
    diffPercent,
    status
  };
}

function combineStatuses(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes("error")) {
    return "error";
  }

  if (statuses.includes("warning")) {
    return "warning";
  }

  return "ok";
}

function addTotalsFromSupermetricsRow(totals: ValidationTotals, row: ParsedSupermetricsRow): ValidationTotals {
  return {
    spend: totals.spend + row.spend,
    clicks: totals.clicks + row.clicks,
    impressions: totals.impressions + row.impressions,
    conversions: totals.conversions + row.conversions,
    conversionValue: totals.conversionValue + row.conversionValue
  };
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

function resolveColumnIndices(headers: string[]) {
  return {
    month: requireColumn(headers, aliases.month),
    platform: requireColumn(headers, aliases.platform),
    account: requireColumn(headers, aliases.account),
    campaign: findColumn(headers, aliases.campaign),
    impressions: requireColumn(headers, aliases.impressions),
    clicks: requireColumn(headers, aliases.clicks),
    spend: requireColumn(headers, aliases.spend),
    conversions: requireColumn(headers, aliases.conversions),
    conversionValue: requireColumn(headers, aliases.conversionValue)
  };
}

function requireColumn(headers: string[], possibleNames: readonly string[]): number {
  const index = findColumn(headers, possibleNames);
  if (index === null) {
    throw new Error(`Missing CSV column. Expected one of: ${possibleNames.join(", ")}`);
  }

  return index;
}

function findColumn(headers: string[], possibleNames: readonly string[]): number | null {
  const normalized = possibleNames.map(normalizeHeader);
  const index = headers.findIndex((header) => normalized.includes(header));
  return index >= 0 ? index : null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readCell(cells: string[], index: number): string {
  return cells[index]?.trim() ?? "";
}

function parseNumber(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const withoutCurrency = trimmed.replace(/\s/g, "").replace(/€/g, "");
  const commaIndex = withoutCurrency.lastIndexOf(",");
  const dotIndex = withoutCurrency.lastIndexOf(".");
  let normalized = withoutCurrency;

  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized =
      commaIndex > dotIndex
        ? withoutCurrency.replace(/\./g, "").replace(",", ".")
        : withoutCurrency.replace(/,/g, "");
  } else if (commaIndex >= 0) {
    normalized = withoutCurrency.replace(",", ".");
  } else if (dotIndex >= 0) {
    const fraction = withoutCurrency.slice(dotIndex + 1);
    normalized = fraction.length > 2 ? withoutCurrency.replace(/\./g, "") : withoutCurrency;
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function normalizePlatform(value: string): AdPlatform | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("tiktok")) {
    return "tiktok";
  }

  if (normalized.includes("bing") || normalized.includes("microsoft")) {
    return "bing";
  }

  return null;
}
