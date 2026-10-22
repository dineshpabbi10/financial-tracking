import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  readJson,
  requireApiSession,
  routeError,
} from "@/lib/api";
import {
  changePasscode,
  createSession,
  verifyLoginPasscode,
} from "@/lib/auth";

const schema = z.object({
  current: z.string().min(1, "Enter your current passcode."),
  next: z.string().min(8, "Use at least 8 characters.").max(200),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const { current, next } = await readJson(request, schema);
    if (!(await verifyLoginPasscode(current))) {
      throw new ApiError("Current passcode is incorrect.", 400);
    }
    if (current === next) {
      throw new ApiError("Choose a different passcode.", 400);
    }
    await changePasscode(current, next);
    await createSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
