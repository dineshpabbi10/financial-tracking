import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSameOrigin,
  jsonError,
  readJson,
  routeError,
} from "@/lib/api";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  createSession,
  verifyLoginPasscode,
} from "@/lib/auth";

const schema = z.object({
  passcode: z.string().min(1, "Enter your passcode.").max(200),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "local";
    if (!checkLoginRateLimit(ip)) {
      return jsonError("Too many attempts. Try again in a minute.", 429);
    }
    const { passcode } = await readJson(request, schema);
    if (!(await verifyLoginPasscode(passcode))) {
      return jsonError("Incorrect passcode.", 401);
    }
    clearLoginRateLimit(ip);
    await createSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
