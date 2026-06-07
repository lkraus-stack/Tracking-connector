import { createMarketingBigQueryClient } from "@tracking-connector/bigquery";
import {
  compareMonthlyTotals,
  monthToDate,
  parseSupermetricsCsv,
  validationPlatformSchema,
  type MonthlyValidationResult,
  type ParsedSupermetricsRow,
  type ValidationPlatform,
  type ValidationRunRecord,
  type ValidationTotals
} from "@tracking-connector/shared";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const inMemoryRuns: ValidationRunRecord[] = [];

export async function getMonthlyValidation({
  clientId,
  platform,
  month,
  comparison
}: {
  clientId: string;
  platform: ValidationPlatform;
  month: string;
  comparison?: ValidationTotals | null;
}): Promise<MonthlyValidationResult> {
  const bigQuery = createMarketingBigQueryClient();
  const airbyte = await bigQuery.getMonthlyValidationSummary(clientId, platform, month);

  return compareMonthlyTotals({
    clientId,
    platform,
    month,
    airbyte,
    comparison: comparison ?? null
  });
}

export function parseSupermetricsCsvUpload(csv: string): ParsedSupermetricsRow[] {
  return parseSupermetricsCsv(csv);
}

export async function createValidationRun({
  clientId,
  platform,
  month,
  comparison,
  rawPayload,
  source = "supermetrics_csv"
}: {
  clientId: string;
  platform: ValidationPlatform;
  month: string;
  comparison: ValidationTotals | null;
  rawPayload?: unknown;
  source?: ValidationRunRecord["source"];
}): Promise<ValidationRunRecord> {
  const result = await getMonthlyValidation({ clientId, platform, month, comparison });
  const record: ValidationRunRecord = {
    id: crypto.randomUUID(),
    ...result,
    source,
    createdAt: new Date().toISOString()
  };

  await persistValidationRun(record, rawPayload);
  inMemoryRuns.unshift(record);

  return record;
}

export async function listValidationRuns(clientId?: string): Promise<ValidationRunRecord[]> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return structuredClone(clientId ? inMemoryRuns.filter((run) => run.clientId === clientId) : inMemoryRuns);
  }

  try {
    let query = supabase
      .from("validation_runs")
      .select(
        "id,client_id,platform,report_month,source,status,spend_airbyte,spend_comparison,clicks_airbyte,clicks_comparison,impressions_airbyte,impressions_comparison,conversions_airbyte,conversions_comparison,conversion_value_airbyte,conversion_value_comparison,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (clientId) {
      query = query.eq("client_id", clientId);
    }
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: String(row.id),
      clientId: String(row.client_id),
      platform: validationPlatformSchema.catch("both").parse(row.platform),
      month: String(row.report_month).slice(0, 7),
      source: row.source === "manual" || row.source === "mock" ? row.source : "supermetrics_csv",
      status: row.status === "error" ? "error" : row.status === "warning" ? "warning" : "ok",
      createdAt: String(row.created_at),
      airbyte: {
        spend: Number(row.spend_airbyte ?? 0),
        clicks: Number(row.clicks_airbyte ?? 0),
        impressions: Number(row.impressions_airbyte ?? 0),
        conversions: Number(row.conversions_airbyte ?? 0),
        conversionValue: Number(row.conversion_value_airbyte ?? 0)
      },
      comparison: {
        spend: Number(row.spend_comparison ?? 0),
        clicks: Number(row.clicks_comparison ?? 0),
        impressions: Number(row.impressions_comparison ?? 0),
        conversions: Number(row.conversions_comparison ?? 0),
        conversionValue: Number(row.conversion_value_comparison ?? 0)
      },
      metrics: compareMonthlyTotals({
        clientId: String(row.client_id),
        platform: validationPlatformSchema.catch("both").parse(row.platform),
        month: String(row.report_month).slice(0, 7),
        airbyte: {
          spend: Number(row.spend_airbyte ?? 0),
          clicks: Number(row.clicks_airbyte ?? 0),
          impressions: Number(row.impressions_airbyte ?? 0),
          conversions: Number(row.conversions_airbyte ?? 0),
          conversionValue: Number(row.conversion_value_airbyte ?? 0)
        },
        comparison: {
          spend: Number(row.spend_comparison ?? 0),
          clicks: Number(row.clicks_comparison ?? 0),
          impressions: Number(row.impressions_comparison ?? 0),
          conversions: Number(row.conversions_comparison ?? 0),
          conversionValue: Number(row.conversion_value_comparison ?? 0)
        }
      }).metrics
    }));
  } catch (error) {
    logger.warn({ error, clientId }, "Falling back to in-memory validation runs");
    return structuredClone(clientId ? inMemoryRuns.filter((run) => run.clientId === clientId) : inMemoryRuns);
  }
}

async function persistValidationRun(record: ValidationRunRecord, rawPayload: unknown) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const row = toValidationRunRow(record, rawPayload);
  const { error } = await supabase.from("validation_runs").insert(row);

  if (error) {
    logger.warn({ error, runId: record.id }, "Unable to persist validation run");
  }
}

function toValidationRunRow(record: ValidationRunRecord, rawPayload: unknown) {
  const byMetric = Object.fromEntries(record.metrics.map((metric) => [metric.metric, metric]));

  return {
    id: record.id,
    client_id: record.clientId,
    platform: record.platform,
    report_month: monthToDate(record.month),
    source: record.source,
    status: record.status,
    spend_airbyte: record.airbyte.spend,
    spend_comparison: record.comparison?.spend ?? null,
    spend_diff: byMetric.spend?.diff ?? null,
    spend_diff_percent: byMetric.spend?.diffPercent ?? null,
    clicks_airbyte: record.airbyte.clicks,
    clicks_comparison: record.comparison?.clicks ?? null,
    clicks_diff: byMetric.clicks?.diff ?? null,
    clicks_diff_percent: byMetric.clicks?.diffPercent ?? null,
    impressions_airbyte: record.airbyte.impressions,
    impressions_comparison: record.comparison?.impressions ?? null,
    impressions_diff: byMetric.impressions?.diff ?? null,
    impressions_diff_percent: byMetric.impressions?.diffPercent ?? null,
    conversions_airbyte: record.airbyte.conversions,
    conversions_comparison: record.comparison?.conversions ?? null,
    conversions_diff: byMetric.conversions?.diff ?? null,
    conversions_diff_percent: byMetric.conversions?.diffPercent ?? null,
    conversion_value_airbyte: record.airbyte.conversionValue,
    conversion_value_comparison: record.comparison?.conversionValue ?? null,
    conversion_value_diff: byMetric.conversionValue?.diff ?? null,
    conversion_value_diff_percent: byMetric.conversionValue?.diffPercent ?? null,
    raw_payload: rawPayload ?? null
  };
}
