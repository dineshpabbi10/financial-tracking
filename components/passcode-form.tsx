"use client";

import { useState } from "react";
import { Check, LoaderCircle, ShieldCheck } from "lucide-react";

export function PasscodeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("The new passcodes don't match.");
      return;
    }
    if (next.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update your passcode.");
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="current-passcode" className="label">
          Current passcode
        </label>
        <input
          id="current-passcode"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          className="input"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-passcode" className="label">
            New passcode
          </label>
          <input
            id="new-passcode"
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            className="input"
            minLength={8}
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-passcode" className="label">
            Confirm new passcode
          </label>
          <input
            id="confirm-passcode"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            className="input"
            minLength={8}
            required
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {done && (
        <p className="flex items-center gap-1.5 rounded-lg bg-forest-soft px-3 py-2 text-xs text-forest">
          <Check size={13} /> Passcode updated. Other devices were signed out.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck size={13} /> Stored as a salted scrypt hash.
        </p>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : null}
          Update passcode
        </button>
      </div>
    </form>
  );
}
