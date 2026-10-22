"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

export function RefreshRecurringButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/recurring/refresh", { method: "POST" });
      const data = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) {
        setError(data.error ?? "Could not re-scan.");
        return;
      }
      setMessage(`${data.count ?? 0} series found`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="btn-secondary"
      >
        {pending ? (
          <LoaderCircle size={15} className="animate-spin" />
        ) : (
          <RefreshCw size={15} />
        )}
        {pending ? "Scanning…" : "Re-scan history"}
      </button>
      {(error || message) && (
        <span className={`text-[11px] ${error ? "text-danger" : "text-muted"}`}>
          {error ?? message}
        </span>
      )}
    </div>
  );
}
