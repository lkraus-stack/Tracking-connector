import { NextResponse } from "next/server";
import {
  aggregateSupermetricsRows,
  normalizeMonth,
  parseSupermetricsCsv,
  validationPlatformSchema
} from "@tracking-connector/shared";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let csv = "";
  let month = "";
  let platform = "both";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const csvField = formData.get("csv");
    month = String(formData.get("month") ?? "");
    platform = String(formData.get("platform") ?? "both");

    if (file instanceof File) {
      csv = await file.text();
    } else if (typeof csvField === "string") {
      csv = csvField;
    }
  } else {
    const body = (await request.json()) as { csv?: string; month?: string; platform?: string };
    csv = body.csv ?? "";
    month = body.month ?? "";
    platform = body.platform ?? "both";
  }

  const parsedPlatform = validationPlatformSchema.safeParse(platform);
  if (!csv.trim() || !month || !parsedPlatform.success) {
    return NextResponse.json({ error: "CSV, month and platform are required" }, { status: 400 });
  }

  try {
    const normalizedMonth = normalizeMonth(month);
    const rows = parseSupermetricsCsv(csv);
    const totals = aggregateSupermetricsRows(rows, normalizedMonth, parsedPlatform.data);

    return NextResponse.json({
      rows,
      totals,
      rowCount: rows.length,
      month: normalizedMonth,
      platform: parsedPlatform.data
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to parse Supermetrics CSV" },
      { status: 400 }
    );
  }
}
