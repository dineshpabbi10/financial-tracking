"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Link2, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { parseDollars } from "@/lib/money";

const TYPE_OPTIONS = [
  { value: "chequing", label: "Chequing" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit card" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

export function AccountRowActions({
  account,
  synced = false,
}: {
  synced?: boolean;
  account: {
    id: string;
    name: string;
    type: string;
    mask: string | null;
    currentBalanceCents: number;
    transactionCount: number;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [type, setType] = useState(account.type);
  const [mask, setMask] = useState(account.mask ?? "");
  const [balance, setBalance] = useState((account.currentBalanceCents / 100).toFixed(2));
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const cents = synced ? null : parseDollars(balance);
    if (!synced && cents === null) {
      setError("Enter a valid balance.");
      return;
    }
    setPending("save");
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          mask: mask.trim() || null,
          ...(!synced ? { currentBalanceCents: cents } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save the account.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete ${account.name}? This removes its ${
          account.transactionCount
        } imported transactions and import history. This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending("delete");
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not delete the account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {!editing ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setError(null);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-forest"
          >
            <Pencil size={11} /> Edit
          </button>
          {synced ? (
            <Link
              href="/connections"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-forest"
            >
              <Link2 size={11} /> Bank
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={pending !== null}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-danger"
            >
              {pending === "delete" ? (
                <LoaderCircle size={11} className="animate-spin" />
              ) : (
                <Trash2 size={11} />
              )}
              Delete
            </button>
          )}
        </div>
      ) : (
        <form
          onSubmit={(event) => void save(event)}
          className="w-full min-w-[260px] rounded-xl border border-line bg-surface-raised p-3 sm:w-[420px]"
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`name-${account.id}`}>
                Account name
              </label>
              <input
                id={`name-${account.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input py-1.5 text-[12px]"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor={`type-${account.id}`}>
                Type
              </label>
              <select
                id={`type-${account.id}`}
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="input py-1.5 text-[12px]"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`mask-${account.id}`}>
                Last digits
              </label>
              <input
                id={`mask-${account.id}`}
                value={mask}
                onChange={(event) => setMask(event.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                maxLength={8}
                className="input py-1.5 text-[12px]"
                placeholder="0451"
              />
            </div>
            {!synced && (
              <div>
                <label className="label" htmlFor={`balance-${account.id}`}>
                  Balance (CAD)
                </label>
                <input
                  id={`balance-${account.id}`}
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  inputMode="decimal"
                  className="input py-1.5 text-[12px]"
                />
              </div>
            )}
          </div>
          {synced && (
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Balance and transactions update from Plaid. You can still rename
              the account or adjust its type.
            </p>
          )}
          {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="btn-ghost min-h-8 px-2 text-[11px]"
            >
              <X size={12} /> Cancel
            </button>
            <button
              type="submit"
              disabled={pending !== null}
              className="btn-primary min-h-8 px-3 text-[11px]"
            >
              {pending === "save" ? (
                <LoaderCircle size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Save
            </button>
          </div>
        </form>
      )}
      {error && !editing && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
