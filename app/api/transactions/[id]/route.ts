import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  readJson,
  requireApiSession,
  routeError,
} from "@/lib/api";
import { CATEGORY_IDS } from "@/lib/categories";
import { db } from "@/lib/db";

const schema = z.object({
  categoryOverride: z.enum(CATEGORY_IDS).nullable(),
  notes: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const { id } = await params;
    const body = await readJson(request, schema);
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Transaction not found.", 404);
    const updated = await db.transaction.update({
      where: { id },
      data: {
        categoryOverride: body.categoryOverride,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    return NextResponse.json({ transaction: updated });
  } catch (error) {
    return routeError(error, 400);
  }
}
