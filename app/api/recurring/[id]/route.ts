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

const schema = z.object({ isDismissed: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const { id } = await params;
    const body = await readJson(request, schema);
    const series = await db.recurringSeries.findUnique({ where: { id } });
    if (!series) throw new ApiError("Recurring series not found.", 404);
    await db.recurringSeries.update({
      where: { id },
      data: { isDismissed: body.isDismissed },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
