"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

export function RecurringHideButton({
  id,
  dismissed,
}: {
  id: string;
  dismissed: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDismissed: !dismissed }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not update.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-ink"
        title={dismissed ? "Show in upcoming bills" : "Hide from upcoming bills"}
      >
        {pending ? (
          <LoaderCircle size={12} className="animate-spin" />
        ) : dismissed ? (
          <Eye size={12} />
        ) : (
          <EyeOff size={12} />
        )}
        {dismissed ? "Restore" : "Hide"}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  );
}
