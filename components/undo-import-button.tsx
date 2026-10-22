"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Undo2 } from "lucide-react";

export function UndoImportButton({
  batchId,
  imported,
}: {
  batchId: string;
  imported: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function undo() {
    if (
      !window.confirm(
        `Undo this import? ${imported} ${
          imported === 1 ? "transaction" : "transactions"
        } will be removed. Account categories you changed on them will be lost too, and any balance update from this statement will be reversed.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/import/batches/${batchId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not undo this import.");
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
        onClick={() => void undo()}
        disabled={pending}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-danger"
      >
        {pending ? (
          <LoaderCircle size={11} className="animate-spin" />
        ) : (
          <Undo2 size={11} />
        )}
        Undo
      </button>
      {error && <span className="max-w-[150px] text-right text-[10px] text-danger">{error}</span>}
    </span>
  );
}
