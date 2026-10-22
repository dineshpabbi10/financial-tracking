"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CATEGORY_LIST,
  categoryColor,
  categoryLabel,
  type CategoryId,
} from "@/lib/categories";

export function CategorySelect({
  transactionId,
  category,
  categoryOverride,
}: {
  transactionId: string;
  category: string;
  categoryOverride: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(categoryOverride ?? "auto");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = value === "auto" ? category : value;

  async function update(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryOverride: next === "auto" ? null : next,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setValue(previous);
        setError(data.error ?? "Could not update category.");
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1" title={error ?? undefined}>
      <span className="relative inline-flex items-center">
        <span
          className="pointer-events-none absolute left-2.5 size-2 rounded-full"
          style={{ background: categoryColor(shown) }}
          aria-hidden
        />
        <select
          value={value}
          onChange={(event) => void update(event.target.value)}
          disabled={pending}
          aria-label="Transaction category"
          className="appearance-none rounded-full border border-line bg-surface py-1 pl-6 pr-7 text-[11px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-60"
        >
          <option value="auto">Auto · {categoryLabel(category)}</option>
          {CATEGORY_LIST.map((item: { id: CategoryId; label: string }) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 text-faint"
          aria-hidden
        />
      </span>
      {error && <span className="max-w-[160px] text-[10px] leading-tight text-danger">{error}</span>}
    </span>
  );
}
