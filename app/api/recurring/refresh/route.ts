import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiSession, routeError } from "@/lib/api";
import { refreshRecurringSeries } from "@/lib/recurring-store";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const count = await refreshRecurringSeries();
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return routeError(error);
  }
}
