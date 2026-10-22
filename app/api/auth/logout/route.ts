import { NextResponse } from "next/server";
import { assertSameOrigin, routeError } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
