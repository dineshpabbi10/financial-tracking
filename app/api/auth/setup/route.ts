import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSameOrigin,
  readJson,
  routeError,
  ApiError,
} from "@/lib/api";
import {
  createSession,
  isSetupComplete,
  setInitialPasscode,
} from "@/lib/auth";

const schema = z.object({
  passcode: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That passcode is too long."),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (await isSetupComplete()) {
      throw new ApiError("Setup has already been completed.", 409);
    }
    const { passcode } = await readJson(request, schema);
    await setInitialPasscode(passcode);
    await createSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
