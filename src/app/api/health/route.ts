import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/reporting/repository";

export async function GET() {
  const data = await getDashboardData();
  const failed = data.summary.failed;

  return NextResponse.json({
    status: failed > 0 ? "degraded" : "ok",
    checkedAt: new Date().toISOString(),
    connectors: data.summary
  });
}
