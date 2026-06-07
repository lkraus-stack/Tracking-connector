import { NextResponse } from "next/server";
import { z } from "zod";
import { createValidationRun } from "@/lib/validation/repository";
import { normalizeMonth, validationPlatformSchema } from "@tracking-connector/shared";

const totalsSchema = z.object({
  spend: z.number(),
  clicks: z.number(),
  impressions: z.number(),
  conversions: z.number(),
  conversionValue: z.number()
});

const bodySchema = z.object({
  clientId: z.string().min(1),
  platform: validationPlatformSchema,
  month: z.string().min(7).transform(normalizeMonth),
  comparison: totalsSchema.nullable(),
  rawPayload: z.unknown().optional(),
  source: z.enum(["supermetrics_csv", "manual", "mock"]).default("supermetrics_csv")
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid validation run payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const run = await createValidationRun(parsed.data);
  return NextResponse.json(run, { status: 201 });
}
