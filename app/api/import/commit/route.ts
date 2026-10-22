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
import { commitImport } from "@/lib/import/store";
import { parseStatementDate } from "@/lib/import/statement-date";

export const runtime = "nodejs";

const dateFormatSchema = z.enum(["auto", "ymd", "mdy", "dmy", "month-name", "dmy-name"]);

const mappingSchema = z.object({
  date: z.string().max(200),
  description: z.string().max(200),
  description2: z.string().max(200).nullable(),
  amount: z.string().max(200).nullable(),
  debit: z.string().max(200).nullable(),
  credit: z.string().max(200).nullable(),
  balance: z.string().max(200).nullable(),
  category: z.string().max(200).nullable(),
  dateFormat: dateFormatSchema,
  amountConvention: z.enum(["negative-outflow", "positive-outflow"]),
});

const rowSchema = z.object({
  date: z
    .string()
    .refine((value) => parseStatementDate(value) !== null, "Invalid date."),
  description: z.string().trim().min(1, "Description is required.").max(500),
  merchantName: z.string().max(200).nullable().optional(),
  amountCents: z
    .number()
    .int()
    .min(-100_000_000)
    .max(100_000_000)
    .refine((value) => value !== 0, "Amount cannot be zero."),
  balanceCents: z.number().int().min(-100_000_000_000).max(100_000_000_000).nullable().optional(),
  externalId: z.string().max(200).nullable().optional(),
  sourceCategory: z.string().max(100).nullable().optional(),
});

const schema = z.object({
  accountId: z.string().min(1),
  filename: z.string().min(1).max(255),
  fileKind: z.enum(["csv", "ofx", "pdf"]),
  bankPreset: z.string().max(40).nullable().optional(),
  mapping: mappingSchema.nullable().optional(),
  updateBalance: z.boolean().default(true),
  accountBalanceCents: z
    .number()
    .int()
    .min(-100_000_000_000)
    .max(100_000_000_000)
    .nullable()
    .optional(),
  rows: z.array(rowSchema).min(1, "No rows to import.").max(2000),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const body = await readJson(request, schema);
    const account = await db.account.findUnique({
      where: { id: body.accountId },
      select: { isDemo: true, plaidItemId: true },
    });
    if (!account) throw new ApiError("Account not found.", 404);
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
    const result = await commitImport({
      accountId: body.accountId,
      filename: body.filename,
      fileKind: body.fileKind,
      bankPreset: body.bankPreset ?? null,
      mapping: body.mapping ?? null,
      updateBalance: body.updateBalance ?? true,
      accountBalanceCents: body.accountBalanceCents ?? null,
      rows: body.rows,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error, 400);
  }
}
