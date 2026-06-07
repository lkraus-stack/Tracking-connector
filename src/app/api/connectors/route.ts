import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/reporting/repository";

export async function GET() {
  const data = await getDashboardData();

  return NextResponse.json({
    summary: data.summary,
    connectors: data.connectors,
    tables: data.tables,
    secretChecks: data.secretChecks
  });
}
