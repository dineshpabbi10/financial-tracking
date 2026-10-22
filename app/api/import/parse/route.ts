import { NextResponse } from "next/server";
import {
  ApiError,
  assertSameOrigin,
  requireApiSession,
  routeError,
  apiErrorMessage,
} from "@/lib/api";
import { db } from "@/lib/db";
import { parseStatement } from "@/lib/import/parse";
import type { CsvMapping } from "@/lib/import/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const dateFormatSchema = z.enum(["auto", "ymd", "mdy", "dmy", "month-name", "dmy-name"]);

const mappingSchema = z.object({
  date: z.string(),
  description: z.string(),
  description2: z.string().nullable(),
  amount: z.string().nullable(),
  debit: z.string().nullable(),
  credit: z.string().nullable(),
  balance: z.string().nullable(),
  category: z.string().nullable(),
  dateFormat: dateFormatSchema,
  amountConvention: z.enum(["negative-outflow", "positive-outflow"]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("Choose a statement file to upload.");
    }
    if (file.size === 0) throw new ApiError("That file is empty.");
    if (file.size > 20 * 1024 * 1024) {
      throw new ApiError("That file is over 20 MB. Split the statement into smaller files.");
    }

    const accountId = String(form.get("accountId") ?? "");
    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) throw new ApiError("Choose an account first.");
    if (account.isDemo) {
      throw new ApiError(
        "Demo accounts can't receive real imports. Clear the demo data first.",
        409,
      );
    }
    if (account.plaidItemId) {
      throw new ApiError(
        "This account syncs through Plaid. Use Sync now on the Connections page instead of importing a statement.",
        409,
      );
    }

    const bankPresetId = form.get("bankPreset")
      ? String(form.get("bankPreset"))
      : account.bankPreset;
    const password = form.get("password") ? String(form.get("password")) : undefined;
    let mapping: CsvMapping | null = null;
    const mappingRaw = form.get("mapping");
    if (typeof mappingRaw === "string" && mappingRaw.trim()) {
      const parsed = mappingSchema.safeParse(JSON.parse(mappingRaw));
      if (!parsed.success) throw new ApiError("That column mapping is invalid.");
      mapping = parsed.data;
    }

    const buffer = await file.arrayBuffer();
    const parsed = await parseStatement({
      buffer,
      filename: file.name,
      accountKind: account.type,
      bankPresetId,
      savedMapping: mapping ? null : account.csvMapping,
      mapping,
      password,
    });

    if (parsed.rows.length > 2000) {
      throw new ApiError(
        `That statement produced ${parsed.rows.length} rows. Split it into smaller date ranges (under 2,000 transactions).`,
      );
    }

    return NextResponse.json({
      ok: true,
      filename: file.name,
      account: {
        id: account.id,
        name: account.name,
        institution: account.institution,
        type: account.type,
        mask: account.mask,
      },
      ...parsed,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid column mapping." }, { status: 400 });
    }
    if (!(error instanceof ApiError)) {
      return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });
    }
    return routeError(error, 400);
  }
}
