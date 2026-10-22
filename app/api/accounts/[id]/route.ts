import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  readJson,
  requireApiSession,
  routeError,
} from "@/lib/api";
import { db } from "@/lib/db";
import { clearDemoBudgets } from "@/lib/demo-data";
import { refreshRecurringSeries } from "@/lib/recurring-store";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  mask: z.string().trim().max(8).nullable().optional(),
  type: z.enum(["chequing", "savings", "credit", "investment", "loan", "other"]).optional(),
  currentBalanceCents: z
    .number()
    .int()
    .min(-100_000_000_000)
    .max(100_000_000_000)
    .optional(),
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
    const existing = await db.account.findUnique({
      where: { id },
      select: {
        id: true,
        isDemo: true,
        plaidItemId: true,
      },
    });
    if (!existing) throw new ApiError("Account not found.", 404);
    if (existing.plaidItemId && body.currentBalanceCents !== undefined) {
      throw new ApiError(
        "This account's balance comes from Plaid. Use Sync now on its bank connection instead.",
        409,
      );
    }
    const account = await db.account.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.mask !== undefined ? { mask: body.mask || null } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.currentBalanceCents !== undefined
          ? { currentBalanceCents: body.currentBalanceCents }
          : {}),
      },
    });
    return NextResponse.json({ account });
  } catch (error) {
    return routeError(error, 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const { id } = await params;
    const account = await db.account.findUnique({
      where: { id },
      select: { id: true, isDemo: true, plaidItemId: true },
    });
    if (!account) throw new ApiError("Account not found.", 404);
    if (account.plaidItemId) {
      throw new ApiError(
        "Disconnect the bank on the Connections page before deleting a synced account.",
        409,
      );
    }
    await db.account.delete({ where: { id } });
    if (account.isDemo) {
      const remainingDemo = await db.account.count({
        where: { isDemo: true },
      });
      if (remainingDemo === 0) await clearDemoBudgets();
    }
    await refreshRecurringSeries();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
