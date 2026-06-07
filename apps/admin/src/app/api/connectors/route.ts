import { NextResponse } from "next/server";
import { getAdminDashboardData } from "@/lib/admin/repository";

export async function GET() {
  const data = await getAdminDashboardData();

  return NextResponse.json(data);
}
