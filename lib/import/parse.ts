import "server-only";
import { getBankPreset, detectBankPreset } from "@/lib/import/banks";
import { csvMappingFromJson, parseCsvStatement } from "@/lib/import/csv";
import { parseOfxStatement } from "@/lib/import/ofx";
import { parsePdfStatement } from "@/lib/import/pdf";
import { decodeText } from "@/lib/import/text";
import type {
  CsvMapping,
  ImportFileKind,
  ParsedStatement,
  ParseWarning,
} from "@/lib/import/types";

export function detectFileKind(buffer: ArrayBuffer, filename: string): ImportFileKind {
  const bytes = new Uint8Array(buffer.slice(0, 8));
  const pdfMagic = new TextDecoder("latin1").decode(bytes);
  if (pdfMagic.startsWith("%PDF")) return "pdf";

  const head = new TextDecoder("latin1").decode(buffer.slice(0, 1200));
  if (/OFXHEADER|<\?OFX|<OFX/i.test(head)) return "ofx";

  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf") return "pdf";
  if (extension === "ofx" || extension === "qfx") return "ofx";
  return "csv";
}

export async function parseStatement(input: {
  buffer: ArrayBuffer;
  filename: string;
  accountKind: string;
  bankPresetId?: string | null;
  savedMapping?: string | null;
  mapping?: CsvMapping | null;
  password?: string;
}): Promise<ParsedStatement> {
  const kind = detectFileKind(input.buffer, input.filename);
  const preset =
    getBankPreset(input.bankPresetId) ??
    detectBankPreset(input.filename, []) ??
    getBankPreset("other");

  if (kind === "pdf") {
    const parsed = await parsePdfStatement(input.buffer, {
      accountKind: input.accountKind,
      dateFormat: preset?.dateFormat,
      password: input.password,
    });
    return {
      kind: "pdf",
      rows: parsed.rows,
      warnings: parsed.warnings,
      totalRows: parsed.totalRows,
      rowsSkipped: parsed.rowsSkipped,
      rawText: parsed.rawText,
      pageCount: parsed.pageCount,
      bankPreset: input.bankPresetId ?? null,
    };
  }

  if (kind === "ofx") {
    const text = decodeText(input.buffer);
    const parsed = parseOfxStatement(text);
    return {
      kind: "ofx",
      rows: parsed.rows,
      warnings: parsed.warnings,
      totalRows: parsed.totalRows,
      rowsSkipped: parsed.rowsSkipped,
      accountBalanceCents: parsed.accountBalanceCents,
      bankPreset: input.bankPresetId ?? null,
    };
  }

  const text = decodeText(input.buffer);
  const explicitMapping = input.mapping ?? null;
  const savedMapping = explicitMapping
    ? null
    : csvMappingFromJson(input.savedMapping);
  let mappingWarning: ParseWarning | null = null;

  let parsed;
  try {
    parsed = parseCsvStatement(text, {
      mapping: explicitMapping ?? savedMapping,
      accountKind: input.accountKind,
      presetConvention: preset?.amountConvention,
      presetDateFormat: preset?.dateFormat,
    });
  } catch (error) {
    // CSV layouts change. A mapping saved from an older export should never
    // trap someone in a dead end; retry with auto-detection and tell them.
    if (!savedMapping) throw error;
    parsed = parseCsvStatement(text, {
      mapping: null,
      accountKind: input.accountKind,
      presetConvention: preset?.amountConvention,
      presetDateFormat: preset?.dateFormat,
    });
    mappingWarning = {
      message:
        "The column mapping saved on this account no longer matched this file, so the columns were auto-detected. Review the mapping before importing.",
    };
  }

  const detected = detectBankPreset(input.filename, parsed.headers);
  return {
    kind: "csv",
    rows: parsed.rows,
    warnings: mappingWarning
      ? [mappingWarning, ...parsed.warnings]
      : parsed.warnings,
    totalRows: parsed.totalRows,
    rowsSkipped: parsed.rowsSkipped,
    headers: parsed.headers,
    mapping: parsed.mapping,
    bankPreset: input.bankPresetId ?? detected?.id ?? null,
  };
}
