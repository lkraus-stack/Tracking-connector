import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDashboardData, triggerConnectorSync } from "@/lib/admin/repository";
import { logger } from "@/lib/logger";

const triggerSchema = z.object({
  connectionId: z.string().min(1)
});

export async function GET() {
  const data = await getAdminDashboardData();

  return NextResponse.json({ jobs: data.jobs });
}

export async function POST(request: Request) {
  const body = triggerSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "connectionId is required", issues: body.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await triggerConnectorSync(body.data.connectionId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error({ error, connectionId: body.data.connectionId }, "Unable to trigger Airbyte sync");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to trigger sync" },
      { status: 404 }
    );
  }
}
