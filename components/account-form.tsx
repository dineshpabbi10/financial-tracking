"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Landmark,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { BANK_PRESETS } from "@/lib/import/banks";
import { parseDollars } from "@/lib/money";

const TYPE_OPTIONS = [
  { value: "chequing", label: "Chequing", icon: Landmark },
  { value: "savings", label: "Savings", icon: Landmark },
  { value: "credit", label: "Credit card", icon: CreditCard },
  { value: "investment", label: "Investment", icon: Building2 },
  { value: "loan", label: "Loan", icon: Building2 },
  { value: "other", label: "Other", icon: Building2 },
];

export function AccountForm() {
  const router = useRouter();
  const [bankPreset, setBankPreset] = useState("rbc");
  const [institution, setInstitution] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("chequing");
  const [mask, setMask] = useState("");
  const [balance, setBalance] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = BANK_PRESETS.find((preset) => preset.id === bankPreset);
  const isOther = bankPreset === "other";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const cents = parseDollars(balance || "0");
    if (cents === null) {
      setError("Enter a valid current balance, or leave it at 0.");
      return;
    }
    const resolvedInstitution = isOther ? institution.trim() : selectedPreset?.name ?? "";
    if (!resolvedInstitution) {
      setError("Enter the bank or institution name.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          institution: resolvedInstitution,
          bankPreset,
          mask: mask.trim() || null,
          type,
          currentBalanceCents: cents,
          currency: "CAD",
        }),
      });
      const data = (await response.json()) as {
        account?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.account) {
        setError(data.error ?? "Could not create that account.");
        return;
      }
      router.push(`/import?account=${data.account.id}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="institution" className="label">
            Bank or institution
          </label>
          <select
            id="institution"
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
          {selectedPreset && !isOther && (
            <p className="mt-1.5 text-[10px] text-faint">{selectedPreset.description}</p>
          )}
        </div>
        {isOther && (
          <div>
            <label htmlFor="custom-institution" className="label">
              Institution name
            </label>
            <input
              id="custom-institution"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              placeholder="e.g. Coast Capital Savings"
              className="input"
              required
            />
          </div>
        )}
        <div>
          <label htmlFor="account-name" className="label">
            Account name
          </label>
          <input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Everyday Chequing"
            className="input"
            required
          />
        </div>
        <div>
          <label htmlFor="account-type" className="label">
            Account type
          </label>
          <select
            id="account-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="input"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="account-mask" className="label">
            Last 4 digits <span className="normal-case tracking-normal text-faint">(optional)</span>
          </label>
          <input
            id="account-mask"
            value={mask}
            onChange={(event) => setMask(event.target.value.replace(/[^A-Za-z0-9]/g, ""))}
            placeholder="0451"
            maxLength={8}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="current-balance" className="label">
            Current balance (CAD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
              $
            </span>
            <input
              id="current-balance"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="input pl-7"
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
            {type === "credit" || type === "loan"
              ? "Enter the amount you currently owe as a positive number."
              : "A snapshot for net worth. Imports can update it later."}
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[#eccfc8] bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-relaxed text-muted">
          Next: upload a statement for this account.
        </p>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          {pending ? "Creating account…" : "Create account"}
          {!pending && <ArrowRight size={14} />}
        </button>
      </div>
    </form>
  );
}
