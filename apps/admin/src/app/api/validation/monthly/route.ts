import { NextResponse } from "next/server";
import { z } from "zod";
import { getMonthlyValidation } from "@/lib/validation/repository";
import { normalizeMonth, validationPlatformSchema } from "@tracking-connector/shared";

const querySchema = z.object({
  clientId: z.string().min(1),
  platform: validationPlatformSchema.default("both"),
  month: z.string().min(7).transform(normalizeMonth)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    clientId: url.searchParams.get("clientId"),
    platform: url.searchParams.get("platform") ?? "both",
    month: url.searchParams.get("month")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid validation query", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await getMonthlyValidation({
    clientId: parsed.data.clientId,
    platform: parsed.data.platform,
    month: parsed.data.month
  });

  return NextResponse.json(result);
}
