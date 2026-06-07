import { NextResponse } from "next/server";
import { listValidationRuns } from "@/lib/validation/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const runs = await listValidationRuns(clientId);

  return NextResponse.json({ runs });
}
