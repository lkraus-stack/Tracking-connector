import { NextResponse } from "next/server";
import { getAdminDashboardData } from "@/lib/admin/repository";

export async function GET() {
  const data = await getAdminDashboardData();
  const failed = data.health.filter((item) => item.status === "failed").length;
  const warning = data.health.filter((item) => item.status === "warning").length;

  return NextResponse.json({
    status: failed > 0 ? "degraded" : "ok",
    checkedAt: new Date().toISOString(),
    connectors: {
      total: data.connectors.length,
      failed,
      warning,
      healthy: data.health.filter((item) => item.status === "healthy").length,
      needsAttention: data.health.filter((item) => item.needsAttention).length
    },
    reportingViews: data.reportingViews
  });
}
