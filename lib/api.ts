import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { getSession } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ApiError("Invalid JSON body.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(first?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/**
 * CSRF protection for cookie-authenticated mutations. Browsers send Origin on
 * POSTs; reject requests that omit it instead of treating "unknown" as trusted.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new ApiError("Missing request origin.", 403);
  }
  const host = request.headers.get("host");
  try {
    if (new URL(origin).host !== host) {
      throw new ApiError("Cross-origin request rejected.", 403);
    }
  } catch {
    throw new ApiError("Invalid origin.", 403);
  }
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) throw new ApiError("Unauthorized. Please sign in again.", 401);
  return session;
}

export function routeError(error: unknown, fallbackStatus = 500) {
  const status = error instanceof ApiError ? error.status : fallbackStatus;
  if (!(error instanceof ApiError) && status >= 500) {
    console.error(error);
    return jsonError("Something went wrong.", 500);
  }
  return jsonError(apiErrorMessage(error), status);
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
