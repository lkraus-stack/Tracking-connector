import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardData, triggerConnectorSync } from "@/lib/reporting/repository";

const triggerSchema = z.object({
  connectorId: z.string().min(1)
});

export async function GET() {
  const data = await getDashboardData();

  return NextResponse.json({ syncRuns: data.syncRuns });
}

export async function POST(request: Request) {
  const body = triggerSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "connectorId is required", issues: body.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const run = await triggerConnectorSync(body.data.connectorId);
    const data = await getDashboardData();

    return NextResponse.json({ run, dashboard: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to trigger sync" },
      { status: 404 }
    );
  }
}
