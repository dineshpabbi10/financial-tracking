"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Database, LoaderCircle, Trash2 } from "lucide-react";

export function DemoDataActions({
  hasDemo,
  compact = false,
}: {
  hasDemo: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"seed" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "seed" | "clear") {
    if (
      action === "clear" &&
      !window.confirm(
        "Remove the demo accounts, their transactions, and any budgets created by the demo? Your own data won't be touched.",
      )
    ) {
      return;
    }
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: action === "seed" ? "POST" : "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That didn't work.");
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
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "flex-col items-stretch sm:items-end"}`}>
      {hasDemo ? (
        <>
          <button
            type="button"
            onClick={() => run("seed")}
            disabled={pending !== null}
            className="btn-secondary"
          >
            {pending === "seed" ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Database size={15} />
            )}
            Reset demo
          </button>
          <button
            type="button"
            onClick={() => run("clear")}
            disabled={pending !== null}
            className="btn-ghost text-xs text-muted"
          >
            {pending === "clear" ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Clear demo data
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => run("seed")}
          disabled={pending !== null}
          className="btn-secondary"
        >
          {pending === "seed" ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <Database size={15} />
          )}
          Explore with demo data
        </button>
      )}
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
