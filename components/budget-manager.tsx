"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { formatMoney, parseDollars } from "@/lib/money";
import { categoryColor, categoryLabel, type CategoryId } from "@/lib/categories";

interface BudgetItem {
  id: string;
  category: CategoryId;
  limitCents: number;
  spentCents: number;
  progress: number;
}

interface CategoryOption {
  id: string;
  label: string;
}

export function BudgetManager({
  budgets,
  availableCategories,
}: {
  budgets: BudgetItem[];
  availableCategories: CategoryOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [newCategory, setNewCategory] = useState(availableCategories[0]?.id ?? "");
  const [newAmount, setNewAmount] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(category: string, dollars: string, key: string) {
    const cents = parseDollars(dollars);
    if (cents === null || cents < 0) {
      setError("Enter a valid dollar amount.");
      return;
    }
    setPending(key);
    setError(null);
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, monthlyLimitCents: cents }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save that budget.");
        return;
      }
      setEditing(null);
      setNewAmount("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(null);
    }
  }

  async function remove(category: string) {
    if (!window.confirm(`Remove the ${categoryLabel(category)} budget?`)) return;
    setPending(`delete-${category}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/budgets?category=${encodeURIComponent(category)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not remove that budget.");
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
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {budgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center">
          <p className="text-sm font-medium text-ink">No budgets yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Set a monthly limit for the categories that matter. Loonie compares it
            with posted spending as the month rolls on.
          </p>
        </div>
      ) : (
        <div className="divide-row">
          {budgets.map((budget) => {
            const pct = Math.round(budget.progress * 100);
            const over = budget.progress > 1;
            const near = budget.progress >= 0.8 && !over;
            const barColor = over ? "#ad3b2b" : near ? "#c2913a" : "#1c5a42";
            const key = `save-${budget.category}`;
            return (
              <div key={budget.id} className="py-4 first:pt-1 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: categoryColor(budget.category) }}
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {categoryLabel(budget.category)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {over
                          ? `${formatMoney(budget.spentCents - budget.limitCents)} over`
                          : `${formatMoney(budget.limitCents - budget.spentCents)} left`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-[13px] font-semibold text-ink">
                      {formatMoney(budget.spentCents, { whole: true })}
                      <span className="font-normal text-faint">
                        {" "}
                        / {formatMoney(budget.limitCents, { whole: true })}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{pct}%</p>
                  </div>
                </div>

                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#eee9de]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: barColor,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-end gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(budget.category);
                      setEditAmount((budget.limitCents / 100).toFixed(0));
                      setError(null);
                    }}
                    className="font-semibold text-muted transition-colors hover:text-forest"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(budget.category)}
                    disabled={pending !== null}
                    className="inline-flex items-center gap-1 text-faint transition-colors hover:text-danger"
                  >
                    {pending === `delete-${budget.category}` ? (
                      <LoaderCircle size={11} className="animate-spin" />
                    ) : (
                      <Trash2 size={11} />
                    )}
                    Remove
                  </button>
                </div>

                {editing === budget.category && (
                  <form
                    className="mt-3 flex items-end gap-2 rounded-xl bg-surface-raised p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(budget.category, editAmount, key);
                    }}
                  >
                    <div className="flex-1">
                      <label className="label" htmlFor={`edit-${budget.category}`}>
                        Monthly limit
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
                          $
                        </span>
                        <input
                          id={`edit-${budget.category}`}
                          value={editAmount}
                          onChange={(event) => setEditAmount(event.target.value)}
                          inputMode="decimal"
                          className="input pl-7"
                          autoFocus
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={pending === key}
                      className="btn-primary"
                    >
                      {pending === key ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="btn-icon"
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {availableCategories.length > 0 && (
        <form
          className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-surface-raised p-3.5 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newCategory) return;
            void save(newCategory, newAmount, "save-new");
          }}
        >
          <div className="flex-1">
            <label className="label" htmlFor="new-budget-category">
              Add a budget
            </label>
            <select
              id="new-budget-category"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              className="input"
            >
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-32">
            <label className="label" htmlFor="new-budget-amount">
              Per month
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
                $
              </span>
              <input
                id="new-budget-amount"
                value={newAmount}
                onChange={(event) => setNewAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="input pl-7"
                required
              />
            </div>
          </div>
          <button type="submit" disabled={pending === "save-new"} className="btn-primary">
            {pending === "save-new" ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add
          </button>
        </form>
      )}
    </div>
  );
}
