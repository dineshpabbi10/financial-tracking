"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Info,
  LoaderCircle,
  Lock,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { BANK_PRESETS } from "@/lib/import/banks";
import { parseDollars } from "@/lib/money";
import type {
  CsvMapping,
  ImportFileKind,
  ParsedRow,
  ParseWarning,
} from "@/lib/import/types";

interface AccountOption {
  id: string;
  name: string;
  institution: string;
  mask: string | null;
  type: string;
  bankPreset: string | null;
}

interface ParseResponse {
  ok: true;
  filename: string;
  account: AccountOption;
  kind: ImportFileKind;
  rows: ParsedRow[];
  warnings: ParseWarning[];
  totalRows: number;
  rowsSkipped: number;
  headers?: string[];
  mapping?: CsvMapping;
  rawText?: string;
  pageCount?: number;
  accountBalanceCents?: number | null;
  bankPreset?: string | null;
}

interface CommitResponse {
  ok: true;
  batchId: string | null;
  imported: number;
  skipped: number;
  periodStart: string | null;
  periodEnd: string | null;
  balanceUpdated: boolean;
}

interface ReviewRow extends ParsedRow {
  id: string;
  include: boolean;
  amountInput: string;
}

const dateFormatOptions = [
  { value: "auto", label: "Auto-detect" },
  { value: "ymd", label: "YYYY-MM-DD" },
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "month-name", label: "Jan 5, 2026" },
] as const;

function formatDollarsForInput(cents: number): string {
  return (-cents / 100).toFixed(2);
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Math.abs(cents) / 100);
}

function fileLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toReviewRows(rows: ParsedRow[]): ReviewRow[] {
  return rows.map((row, index) => ({
    ...row,
    id: `row-${index}-${Math.random().toString(36).slice(2, 8)}`,
    include: true,
    amountInput: formatDollarsForInput(row.amountCents),
  }));
}

function guessHeader(headers: string[], candidates: string[]): string | null {
  return (
    headers.find((header) => {
      const normalized = header.toLowerCase();
      return candidates.some((candidate) => normalized.includes(candidate));
    }) ?? null
  );
}

export function ImportWizard({
  accounts,
  initialAccountId,
}: {
  accounts: AccountOption[];
  initialAccountId?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialAccount =
    accounts.find((account) => account.id === initialAccountId) ?? accounts[0];
  const [accountId, setAccountId] = useState(initialAccount?.id ?? "");
  const [bankPreset, setBankPreset] = useState(initialAccount?.bankPreset ?? "other");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<"parse" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [step, setStep] = useState<"choose" | "review" | "done">("choose");
  const [summary, setSummary] = useState<CommitResponse | null>(null);
  const [updateBalance, setUpdateBalance] = useState(true);
  const [showMapping, setShowMapping] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  const account = accounts.find((item) => item.id === accountId);
  const isPdf =
    file?.name.toLowerCase().endsWith(".pdf") ||
    parsed?.kind === "pdf";

  const included = useMemo(() => rows.filter((row) => row.include), [rows]);
  const totals = useMemo(() => {
    let out = 0;
    let incoming = 0;
    let invalid = 0;
    for (const row of included) {
      const cents = parseDollars(row.amountInput);
      if (cents === null || cents === 0) {
        invalid++;
      } else if (cents < 0) {
        out += -cents;
      } else {
        incoming += cents;
      }
    }
    return { out, incoming, invalid };
  }, [included]);
  const dateRange = useMemo(() => {
    const dates = included.map((row) => row.date).sort();
    return dates.length > 0 ? [dates[0], dates[dates.length - 1]] : null;
  }, [included]);
  const hasBalance =
    parsed?.accountBalanceCents != null ||
    parsed?.rows.some((row) => row.balanceCents != null) ||
    false;

  function selectAccount(nextId: string) {
    setAccountId(nextId);
    const nextAccount = accounts.find((item) => item.id === nextId);
    setBankPreset(nextAccount?.bankPreset ?? "other");
  }

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    setParsed(null);
    setRows([]);
    setSummary(null);
    setError(null);
    setShowMapping(false);
    setShowWarnings(false);
    setShowRawText(false);
    setStep("choose");
    if (nextFile && nextFile.size > 20 * 1024 * 1024) {
      setError("That file is over 20 MB. Split the statement into smaller files.");
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) chooseFile(dropped);
  }

  async function runParse(mappingOverride?: CsvMapping): Promise<boolean> {
    if (!file) {
      setError("Choose a statement file first.");
      return false;
    }
    if (!account) {
      setError("Choose an account first.");
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("That file is over 20 MB. Split the statement into smaller files.");
      return false;
    }
    setPending("parse");
    setError(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("accountId", account.id);
      form.set("bankPreset", bankPreset);
      if (isPdf && password) form.set("password", password);
      const mappingToSend = mappingOverride ?? (parsed?.mapping ? mapping : null);
      if (mappingToSend) form.set("mapping", JSON.stringify(mappingToSend));

      const response = await fetch("/api/import/parse", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as ParseResponse & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Couldn't read that statement.");
        return false;
      }
      setParsed(data);
      setRows(toReviewRows(data.rows));
      setShowWarnings(data.warnings.length > 0);
      setShowRawText(false);
      if (data.mapping) {
        setMapping(data.mapping);
        setAmountMode(data.mapping.amount ? "single" : "split");
      } else {
        setMapping(null);
      }
      setShowMapping(data.kind === "csv" && data.rows.length === 0);
      setUpdateBalance(true);
      setStep("review");
      router.refresh();
      return true;
    } catch {
      setError("Couldn't reach the server. Try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function applyMapping() {
    if (!mapping) return;
    const headers = parsed?.headers ?? [];
    const normalized: CsvMapping =
      amountMode === "single"
        ? {
            ...mapping,
            debit: null,
            credit: null,
            amount:
              mapping.amount ??
              guessHeader(headers, ["amount", "cad$", "montant", "amt", "value"]),
          }
        : {
            ...mapping,
            amount: null,
            debit:
              mapping.debit ??
              guessHeader(headers, ["debit", "withdraw", "retrait"]),
            credit:
              mapping.credit ??
              guessHeader(headers, ["credit", "deposit", "depot", "dépôt"]),
          };
    setMapping(normalized);
    const ok = await runParse(normalized);
    if (ok) setShowMapping(false);
  }

  function changeAmountMode(mode: "single" | "split") {
    setAmountMode(mode);
    setMapping((current) => {
      if (!current) return current;
      const headers = parsed?.headers ?? [];
      if (mode === "single") {
        return {
          ...current,
          debit: null,
          credit: null,
          amount:
            current.amount ??
            guessHeader(headers, ["amount", "cad$", "montant", "amt", "value"]),
        };
      }
      return {
        ...current,
        amount: null,
        debit:
          current.debit ??
          guessHeader(headers, ["debit", "withdraw", "retrait"]),
        credit:
          current.credit ??
          guessHeader(headers, ["credit", "deposit", "depot", "dépôt"]),
      };
    });
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function flipSigns() {
    setRows((current) =>
      current.map((row) => {
        if (!row.include) return row;
        const amountCents = -row.amountCents;
        return {
          ...row,
          amountCents,
          amountInput: formatDollarsForInput(amountCents),
        };
      }),
    );
  }

  function addRow() {
    const last = rows[rows.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
    setRows((current) => [
      ...current,
      {
        id: `row-manual-${Date.now()}`,
        date: last,
        description: "",
        merchantName: null,
        amountCents: 0,
        balanceCents: null,
        externalId: null,
        sourceCategory: null,
        include: true,
        amountInput: "0.00",
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function commit() {
    if (!parsed || !account) return;
    if (included.length === 0) {
      setError("Select at least one transaction to import.");
      return;
    }
    const payloadRows: ParsedRow[] = [];
    for (const [index, row] of included.entries()) {
      const cents = parseDollars(row.amountInput);
      if (cents === null || cents === 0) {
        setError(`Row ${index + 1}: enter a non-zero amount.`);
        return;
      }
      if (!row.description.trim()) {
        setError(`Row ${index + 1}: add a description.`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        setError(`Row ${index + 1}: choose a valid date.`);
        return;
      }
      payloadRows.push({
        date: row.date,
        description: row.description.trim(),
        merchantName: row.merchantName,
        amountCents: -cents,
        balanceCents: row.balanceCents,
        externalId: row.externalId,
        sourceCategory: row.sourceCategory,
      });
    }

    setPending("commit");
    setError(null);
    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          filename: parsed.filename,
          fileKind: parsed.kind,
          bankPreset: parsed.bankPreset ?? bankPreset,
          mapping: parsed.kind === "csv" ? mapping : null,
          updateBalance,
          accountBalanceCents: parsed.accountBalanceCents ?? null,
          rows: payloadRows,
        }),
      });
      const data = (await response.json()) as CommitResponse & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Couldn't import those transactions.");
        return;
      }
      setSummary(data);
      setStep("done");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setPending(null);
    }
  }

  function reset() {
    setFile(null);
    setPassword("");
    setParsed(null);
    setRows([]);
    setMapping(null);
    setSummary(null);
    setError(null);
    setStep("choose");
    setShowMapping(false);
    setShowRawText(false);
    setShowWarnings(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {step === "choose" && (
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[22px] text-ink">Upload a statement</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Choose the account, then drop in a file from online banking. Your
                file is parsed in memory and never saved.
              </p>
            </div>
            <span className="pill-green hidden sm:inline-flex">Step 1 of 2</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="import-account" className="label">
                Account
              </label>
              <select
                id="import-account"
                value={accountId}
                onChange={(event) => selectAccount(event.target.value)}
                className="input"
              >
                {accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.mask ? ` ···${item.mask}` : ""} — {item.institution}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="import-bank" className="label">
                Bank preset
              </label>
              <select
                id="import-bank"
                value={bankPreset}
                onChange={(event) => setBankPreset(event.target.value)}
                className="input"
              >
                {BANK_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-4 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
              dragging
                ? "border-forest-mid bg-forest-soft"
                : "border-line-strong bg-surface-raised"
            }`}
          >
            <input
              ref={fileInputRef}
              id="statement-file"
              type="file"
              accept=".csv,.ofx,.qfx,.pdf,text/csv,application/pdf,application/x-ofx"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-forest shadow-soft">
                  <FileText size={20} />
                </span>
                <div className="min-w-0 text-center sm:text-left">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {file.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {fileLabel(file.size)} ·{" "}
                    {file.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsed(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="btn-icon"
                  aria-label="Remove file"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div>
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-forest-soft text-forest">
                  <Upload size={20} />
                </span>
                <p className="mt-3 text-[13px] font-semibold text-ink">
                  Drag a statement here, or{" "}
                  <label
                    htmlFor="statement-file"
                    className="cursor-pointer text-forest underline underline-offset-2"
                  >
                    choose a file
                  </label>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  CSV, OFX/QFX, or PDF · up to 20 MB
                </p>
              </div>
            )}
          </div>

          {isPdf && (
            <div className="mt-4">
              <label htmlFor="pdf-password" className="label">
                PDF password <span className="normal-case tracking-normal text-faint">(only if protected)</span>
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                />
                <input
                  id="pdf-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Statement password"
                  className="input pl-9"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-[#eccfc8] bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Lock size={12} /> Parsed in memory · file never stored
            </p>
            <button
              type="button"
              onClick={() => void runParse()}
              disabled={!file || pending !== null}
              className="btn-primary"
            >
              {pending === "parse" ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <SlidersHorizontal size={15} />
              )}
              {pending === "parse" ? "Reading statement…" : "Read statement"}
            </button>
          </div>
        </section>
      )}

      {step === "review" && parsed && (
        <>
          <section className="card p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[22px] text-ink">Review the rows</h2>
                  <span className="pill">
                    {parsed.kind.toUpperCase()}
                    {parsed.pageCount ? ` · ${parsed.pageCount} pages` : ""}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  {account?.name} · {parsed.filename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsed(null);
                  setRows([]);
                  setStep("choose");
                  setError(null);
                }}
                className="btn-ghost shrink-0 self-start"
              >
                <ArrowLeft size={14} /> Change file
              </button>
            </div>

            {parsed.kind === "pdf" && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gold/30 bg-gold-soft/60 px-3.5 py-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#7a5718]" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#6d4f18]">
                    PDF parsing is best-effort
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#8a6a2a]">
                    Check dates, descriptions, and signs before importing. Use{" "}
                    <span className="font-semibold">Flip signs</span> if spending
                    looks inverted. Delete anything that isn&apos;t a transaction.
                  </p>
                  {parsed.rawText && (
                    <button
                      type="button"
                      onClick={() => setShowRawText((value) => !value)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#6d4f18] hover:underline"
                    >
                      <ChevronDown
                        size={12}
                        className={showRawText ? "rotate-180 transition-transform" : "transition-transform"}
                      />
                      {showRawText ? "Hide extracted text" : "View extracted text"}
                    </button>
                  )}
                  {showRawText && parsed.rawText && (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-gold/20 bg-surface p-3 text-[10px] leading-relaxed whitespace-pre-wrap text-muted">
                      {parsed.rawText}
                    </pre>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryTile label="Selected" value={`${included.length} / ${rows.length}`} />
              <SummaryTile label="Money out" value={formatCents(totals.out)} />
              <SummaryTile label="Money in" value={formatCents(totals.incoming)} />
              <SummaryTile
                label="Date range"
                value={
                  dateRange
                    ? `${dateRange[0].slice(5)} → ${dateRange[1].slice(5)}`
                    : "—"
                }
              />
            </div>

            {(parsed.warnings.length > 0 || parsed.rowsSkipped > 0) && (
              <div className="mt-4 rounded-xl border border-line bg-surface-raised px-3.5 py-3">
                <button
                  type="button"
                  onClick={() => setShowWarnings((value) => !value)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-medium text-ink">
                    <Info size={14} className="text-muted" />
                    {parsed.rowsSkipped > 0
                      ? `${parsed.rowsSkipped} statement ${parsed.rowsSkipped === 1 ? "row was" : "rows were"} skipped`
                      : `${parsed.warnings.length} parser ${parsed.warnings.length === 1 ? "note" : "notes"}`}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-faint transition-transform ${showWarnings ? "rotate-180" : ""}`}
                  />
                </button>
                {showWarnings && (
                  <ul className="mt-2 space-y-1.5 border-t border-line pt-2.5">
                    {parsed.warnings.slice(0, 10).map((warning, index) => (
                      <li key={index} className="text-[11px] leading-relaxed text-muted">
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={flipSigns} className="btn-secondary">
                <RefreshCw size={14} /> Flip signs
              </button>
              <button
                type="button"
                onClick={() =>
                  setRows((current) => current.map((row) => ({ ...row, include: true })))
                }
                className="btn-ghost"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() =>
                  setRows((current) => current.map((row) => ({ ...row, include: false })))
                }
                className="btn-ghost"
              >
                Clear all
              </button>
              <button type="button" onClick={addRow} className="btn-ghost">
                <Plus size={14} /> Add row
              </button>
              {parsed.kind === "csv" && parsed.headers && mapping && (
                <button
                  type="button"
                  onClick={() => setShowMapping((value) => !value)}
                  className="btn-ghost ml-auto"
                >
                  <SlidersHorizontal size={14} /> Columns
                </button>
              )}
            </div>
          </section>

          {parsed.kind === "csv" && parsed.headers && mapping && showMapping && (
            <MappingPanel
              headers={parsed.headers}
              mapping={mapping}
              amountMode={amountMode}
              onAmountModeChange={changeAmountMode}
              setMapping={setMapping}
              pending={pending === "parse"}
              onApply={() => void applyMapping()}
            />
          )}

          <section className="card overflow-hidden">
            {rows.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText size={22} className="mx-auto text-faint" />
                <p className="mt-3 text-sm font-semibold text-ink">
                  No transactions found
                </p>
                <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted">
                  Try the column mapping if this is a CSV, or export a CSV from
                  online banking instead of a PDF. You can also add rows manually.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {parsed.kind === "csv" && parsed.headers && mapping && (
                    <button
                      type="button"
                      onClick={() => setShowMapping(true)}
                      className="btn-secondary"
                    >
                      <SlidersHorizontal size={14} /> Column mapping
                    </button>
                  )}
                  <button type="button" onClick={addRow} className="btn-primary">
                    <Plus size={14} /> Add a row
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsed(null);
                      setRows([]);
                      setStep("choose");
                      setError(null);
                    }}
                    className="btn-ghost"
                  >
                    <ArrowLeft size={14} /> Choose another file
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-raised/70 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                      <th className="w-10 px-3 py-2.5">
                        <span className="sr-only">Include</span>
                      </th>
                      <th className="w-[132px] px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="w-[130px] px-3 py-2.5">Amount</th>
                      <th className="w-12 px-3 py-2.5">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-line last:border-0 ${
                          row.include ? "" : "opacity-45"
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(event) =>
                              updateRow(row.id, { include: event.target.checked })
                            }
                            className="mt-2 size-4 rounded border-line-strong accent-[#0f3d2c]"
                            aria-label={`Include ${row.description || "row"}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(event) =>
                              updateRow(row.id, { date: event.target.value })
                            }
                            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] text-ink"
                            aria-label="Transaction date"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            value={row.description}
                            onChange={(event) =>
                              updateRow(row.id, { description: event.target.value })
                            }
                            placeholder="Description"
                            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-ink"
                            aria-label="Transaction description"
                          />
                          {row.sourceCategory && (
                            <p className="mt-1 text-[10px] text-faint">
                              Bank category: {row.sourceCategory}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-faint">
                              $
                            </span>
                            <input
                              value={row.amountInput}
                              onChange={(event) => {
                                const value = event.target.value;
                                const cents = parseDollars(value);
                                updateRow(row.id, {
                                  amountInput: value,
                                  ...(cents !== null
                                    ? { amountCents: -cents }
                                    : {}),
                                });
                              }}
                              onBlur={() => {
                                if (parseDollars(row.amountInput) === null) {
                                  updateRow(row.id, {
                                    amountInput: formatDollarsForInput(row.amountCents),
                                  });
                                }
                              }}
                              inputMode="decimal"
                              className="w-full rounded-lg border border-line bg-surface py-1.5 pl-6 pr-2 text-right text-[12px] tabular text-ink"
                              aria-label="Amount, negative is money out"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="mt-1 inline-flex size-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                            aria-label="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[#eccfc8] bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
            >
              {error}
            </p>
          )}

          <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-semibold text-ink">
                  {included.length} ready to import
                </h3>
                {totals.invalid > 0 && (
                  <span className="pill-danger">
                    {totals.invalid} {totals.invalid === 1 ? "row needs" : "rows need"} an
                    amount
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Negative amounts are money out. Duplicates from earlier imports are
                skipped automatically.
              </p>
              {hasBalance && (
                <label className="mt-2.5 flex items-start gap-2 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={updateBalance}
                    onChange={(event) => setUpdateBalance(event.target.checked)}
                    className="mt-0.5 size-3.5 rounded border-line-strong accent-[#0f3d2c]"
                  />
                  Update the account balance from this statement
                </label>
              )}
            </div>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={pending !== null || included.length === 0}
              className="btn-primary shrink-0"
            >
              {pending === "commit" ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {pending === "commit"
                ? "Importing…"
                : `Import ${included.length} ${included.length === 1 ? "transaction" : "transactions"}`}
            </button>
          </section>
        </>
      )}

      {step === "done" && summary && (
        <section className="card p-7 sm:p-9">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-forest-soft text-forest">
              <Check size={26} />
            </span>
            <h2 className="mt-4 font-display text-[28px] text-ink">
              {summary.imported > 0 ? "Statement imported." : "Nothing new to import."}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {summary.imported > 0
                ? `${summary.imported} ${
                    summary.imported === 1 ? "transaction" : "transactions"
                  } added to ${account?.name ?? "your account"}.`
                : "Every row matched something already in this account."}
              {summary.skipped > 0
                ? ` ${summary.skipped} duplicate ${
                    summary.skipped === 1 ? "row was" : "rows were"
                  } skipped.`
                : ""}
            </p>
            {summary.periodStart && summary.periodEnd && (
              <p className="mt-2 text-[11px] text-faint">
                {summary.periodStart} → {summary.periodEnd}
                {summary.balanceUpdated ? " · account balance updated" : ""}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/transactions" className="btn-primary">
                View transactions <ArrowRight size={14} />
              </Link>
              <button type="button" onClick={reset} className="btn-secondary">
                <Upload size={14} /> Import another
              </button>
              <Link href="/" className="btn-ghost">
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="tabular mt-1 truncate text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function MappingPanel({
  headers,
  mapping,
  amountMode,
  onAmountModeChange,
  setMapping,
  pending,
  onApply,
}: {
  headers: string[];
  mapping: CsvMapping;
  amountMode: "single" | "split";
  onAmountModeChange: (value: "single" | "split") => void;
  setMapping: (mapping: CsvMapping) => void;
  pending: boolean;
  onApply: () => void;
}) {
  const columnValue = (value: string | null) => value ?? "";
  const setColumn = (key: keyof CsvMapping, value: string) => {
    setMapping({ ...mapping, [key]: value || null });
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[19px] text-ink">Column mapping</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Match the statement columns to Loonie. Saved to this account for next
            time.
          </p>
        </div>
        <span className="pill">CSV</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ColumnSelect
          id="map-date"
          label="Date column"
          headers={headers}
          value={columnValue(mapping.date)}
          onChange={(value) => setColumn("date", value)}
          required
        />
        <ColumnSelect
          id="map-description"
          label="Description"
          headers={headers}
          value={columnValue(mapping.description)}
          onChange={(value) => setColumn("description", value)}
          required
        />
        <ColumnSelect
          id="map-description2"
          label="Description 2 (optional)"
          headers={headers}
          value={columnValue(mapping.description2)}
          onChange={(value) => setColumn("description2", value)}
          placeholder="None"
        />
        <div>
          <span className="label">Amount style</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAmountModeChange("single")}
              className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium ${
                amountMode === "single"
                  ? "border-forest bg-forest-soft text-forest"
                  : "border-line bg-surface text-muted"
              }`}
            >
              One amount
            </button>
            <button
              type="button"
              onClick={() => onAmountModeChange("split")}
              className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium ${
                amountMode === "split"
                  ? "border-forest bg-forest-soft text-forest"
                  : "border-line bg-surface text-muted"
              }`}
            >
              Debit / credit
            </button>
          </div>
        </div>
        {amountMode === "single" ? (
          <ColumnSelect
            id="map-amount"
            label="Amount"
            headers={headers}
            value={columnValue(mapping.amount)}
            onChange={(value) => setColumn("amount", value)}
            required
          />
        ) : (
          <>
            <ColumnSelect
              id="map-debit"
              label="Debit (money out)"
              headers={headers}
              value={columnValue(mapping.debit)}
              onChange={(value) => setColumn("debit", value)}
              placeholder="None"
            />
            <ColumnSelect
              id="map-credit"
              label="Credit (money in)"
              headers={headers}
              value={columnValue(mapping.credit)}
              onChange={(value) => setColumn("credit", value)}
              placeholder="None"
            />
          </>
        )}
        <ColumnSelect
          id="map-balance"
          label="Balance (optional)"
          headers={headers}
          value={columnValue(mapping.balance)}
          onChange={(value) => setColumn("balance", value)}
          placeholder="None"
        />
        <div>
          <label htmlFor="map-date-format" className="label">
            Date format
          </label>
          <select
            id="map-date-format"
            value={mapping.dateFormat}
            onChange={(event) =>
              setMapping({ ...mapping, dateFormat: event.target.value as CsvMapping["dateFormat"] })
            }
            className="input"
          >
            {dateFormatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="map-convention" className="label">
            Sign convention
          </label>
          <select
            id="map-convention"
            value={mapping.amountConvention}
            onChange={(event) =>
              setMapping({
                ...mapping,
                amountConvention: event.target.value as CsvMapping["amountConvention"],
              })
            }
            className="input"
          >
            <option value="negative-outflow">Negative = money out</option>
            <option value="positive-outflow">Positive = money out</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onApply} disabled={pending} className="btn-secondary">
          {pending ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Apply mapping
        </button>
      </div>
    </section>
  );
}

function ColumnSelect({
  id,
  label,
  headers,
  value,
  onChange,
  required = false,
  placeholder = "Choose column",
}: {
  id: string;
  label: string;
  headers: string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
        required={required}
      >
        <option value="">{placeholder}</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </div>
  );
}
