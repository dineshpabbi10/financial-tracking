import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  readJson,
  requireApiSession,
  routeError,
} from "@/lib/api";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/categories";
import { db } from "@/lib/db";

const upsertSchema = z.object({
  category: z.enum(CATEGORY_IDS),
  monthlyLimitCents: z.number().int().min(0).max(100_000_000),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const body = await readJson(request, upsertSchema);
    if (!CATEGORIES[body.category].budgetable) {
      throw new ApiError("That category can't be budgeted.", 400);
    }
    const budget = await db.budget.upsert({
      where: { category: body.category },
      update: { monthlyLimitCents: body.monthlyLimitCents },
      create: body,
    });
    return NextResponse.json({ budget });
  } catch (error) {
    return routeError(error, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const category = new URL(request.url).searchParams.get("category");
    if (!category || !CATEGORY_IDS.includes(category as never)) {
      throw new ApiError("Unknown category.", 400);
    }
    await db.budget.deleteMany({ where: { category } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
