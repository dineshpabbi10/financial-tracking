export type ImportFileKind = "csv" | "ofx" | "pdf";
export type AccountKind =
  | "chequing"
  | "savings"
  | "credit"
  | "investment"
  | "loan"
  | "other";

export type DateFormatId =
  | "auto"
  | "ymd"
  | "mdy"
  | "dmy"
  | "month-name"
  | "dmy-name";

export type AmountConvention = "negative-outflow" | "positive-outflow";

export interface ParsedRow {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  merchantName: string | null;
  /** Positive = money out. */
  amountCents: number;
  balanceCents: number | null;
  externalId: string | null;
  sourceCategory: string | null;
}

export interface CsvMapping {
  date: string;
  description: string;
  description2: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
  category: string | null;
  dateFormat: DateFormatId;
  amountConvention: AmountConvention;
}

export interface ParseWarning {
  row?: number;
  message: string;
}

export interface ParsedStatement {
  kind: ImportFileKind;
  rows: ParsedRow[];
  warnings: ParseWarning[];
  totalRows: number;
  rowsSkipped: number;
  /** CSV only */
  headers?: string[];
  mapping?: CsvMapping;
  /** PDF only */
  rawText?: string;
  pageCount?: number;
  /** OFX ledger balance, when present. */
  accountBalanceCents?: number | null;
  bankPreset?: string | null;
}

export interface EditableImportRow extends ParsedRow {
  id: string;
  include: boolean;
}

export interface BankPreset {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Header-name fragments likely to appear in this bank's CSV export. */
  csvSignatures: string[][];
  /** Default interpretation of ambiguous dates and amounts. */
  dateFormat: DateFormatId;
  amountConvention: AmountConvention;
}
