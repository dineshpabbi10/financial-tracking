"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSetup = mode === "setup";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSetup && passcode !== confirm) {
      setError("The passcodes don't match.");
      return;
    }
    if (isSetup && passcode.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        isSetup ? "/api/auth/setup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        setPending(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Is it running?");
      setPending(false);
    }
  }

  return (
    <div className="animate-rise">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {isSetup ? "First-run setup" : "Welcome back"}
      </p>
      <h1 className="mt-3 font-display text-[34px] leading-tight text-ink sm:text-[38px]">
        {isSetup ? "Make it yours." : "Your money, in focus."}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {isSetup
          ? "Set a passcode for this Loonie instance. It's stored on your server as a salted hash — never in the browser."
          : "Enter your passcode to open the dashboard."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="passcode" className="label">
            {isSetup ? "Create a passcode" : "Passcode"}
          </label>
          <div className="relative">
            <input
              id="passcode"
              type={showPasscode ? "text" : "password"}
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoComplete={isSetup ? "new-password" : "current-password"}
              autoFocus
              className="input pr-12"
              placeholder={isSetup ? "At least 8 characters" : "••••••••"}
              required
              minLength={isSetup ? 8 : 1}
            />
            <button
              type="button"
              onClick={() => setShowPasscode((value) => !value)}
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-ink"
              aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
            >
              {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {isSetup && (
          <div>
            <label htmlFor="confirm" className="label">
              Confirm passcode
            </label>
            <input
              id="confirm"
              type={showPasscode ? "text" : "password"}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              className="input"
              placeholder="Type it once more"
              required
              minLength={8}
            />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#eccfc8] bg-danger-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-danger"
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          {pending
            ? isSetup
              ? "Setting up…"
              : "Checking…"
            : isSetup
              ? "Create my dashboard"
              : "Open dashboard"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-muted">
        <span>
          {isSetup ? "Already set up?" : "Need a hint?"}
        </span>
        {isSetup ? (
          <Link href="/login" className="font-semibold text-forest hover:underline">
            Sign in
          </Link>
        ) : (
          <span className="text-faint">
            Your passcode was set during first-run setup.
          </span>
        )}
      </div>
    </div>
  );
}
