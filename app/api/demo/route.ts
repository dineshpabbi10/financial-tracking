import { NextResponse } from "next/server";
import {
  ApiError,
  assertSameOrigin,
  requireApiSession,
  routeError,
} from "@/lib/api";
import { clearDemoData, seedDemoData } from "@/lib/demo-data";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const [realAccounts, plaidItems] = await Promise.all([
      db.account.count({ where: { isDemo: false } }),
      db.plaidItem.count(),
    ]);
    if (realAccounts > 0 || plaidItems > 0) {
      throw new ApiError(
        "Demo data is for exploring before you add your own accounts or connect a bank. Start with an empty account list, or use a separate Loonie database for the demo.",
        409,
      );
    }
    const result = await seedDemoData();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const result = await clearDemoData();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
