import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  readJson,
  requireApiSession,
  routeError,
} from "@/lib/api";
import { BANK_PRESETS } from "@/lib/import/banks";
import { db } from "@/lib/db";

const presetIds = BANK_PRESETS.map((preset) => preset.id) as [string, ...string[]];

const accountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(80),
  institution: z.string().trim().min(1, "Choose a bank.").max(80),
  bankPreset: z.enum(presetIds).nullable().optional(),
  mask: z
    .string()
    .trim()
    .max(8)
    .regex(/^[A-Za-z0-9]*$/, "Last 4 should be letters or numbers.")
    .nullable()
    .optional(),
  type: z.enum(["chequing", "savings", "credit", "investment", "loan", "other"]),
  currentBalanceCents: z.number().int().min(-100_000_000_000).max(100_000_000_000),
  currency: z.literal("CAD").default("CAD"),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    if (await db.account.count({ where: { isDemo: true } })) {
      throw new ApiError(
        "Clear the demo data before adding your own accounts.",
        409,
      );
    }
    const body = await readJson(request, accountSchema);
    if (!body.institution) throw new ApiError("Choose a bank.");
    const account = await db.account.create({
      data: {
        name: body.name,
        institution: body.institution,
        bankPreset: body.bankPreset ?? null,
        mask: body.mask || null,
        type: body.type,
        currentBalanceCents: body.currentBalanceCents,
        currency: body.currency,
      },
    });
    return NextResponse.json({ account });
  } catch (error) {
    return routeError(error, 400);
  }
}
