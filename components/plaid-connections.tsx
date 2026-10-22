"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  usePlaidLink,
  type PlaidLinkError,
  type PlaidLinkOnExitMetadata,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import {
  AlertCircle,
  Building2,
  Check,
  Landmark,
  Link2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { PlaidConnectionSummary } from "@/lib/plaid/types";

const LINK_TOKEN_KEY = "loonie.plaid.link-token";

interface ApiErrorPayload {
  error?: string;
}

async function apiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  return payload?.error ?? `Request failed (${response.status}).`;
}

function setStoredToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(LINK_TOKEN_KEY, token);
    else sessionStorage.removeItem(LINK_TOKEN_KEY);
  } catch {
    // sessionStorage can be unavailable in hardened/privacy browsers.
  }
}

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(LINK_TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearOauthQuery(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("oauth_state_id")) return;
  url.searchParams.delete("oauth_state_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function initials(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

interface SyncPayload {
  added?: number;
  modified?: number;
  removed?: number;
  accounts?: number;
  results?: Array<{ warnings?: string[] }>;
  errors?: Array<{ institutionName?: string; message?: string }>;
  warning?: string | null;
}

function syncMessage(payload: SyncPayload): string {
  const parts: string[] = [];
  if (payload.added) parts.push(`${payload.added} new`);
  if (payload.modified) parts.push(`${payload.modified} updated`);
  if (payload.removed) parts.push(`${payload.removed} removed`);
  const warnings = (payload.results ?? []).flatMap(
    (result) => result.warnings ?? [],
  );
  if (payload.errors?.length) {
    warnings.push(
      ...payload.errors.map((error) =>
        error.institutionName
          ? `${error.institutionName}: ${error.message ?? "Sync failed."}`
          : error.message ?? "Sync failed.",
      ),
    );
  }
  if (warnings.length) {
    return `${parts.length ? `${parts.join(", ")}. ` : ""}${warnings[0]}${
      warnings.length > 1 ? ` (+${warnings.length - 1} more warning${warnings.length > 2 ? "s" : ""})` : ""
    }`;
  }
  return parts.length
    ? `Sync complete: ${parts.join(", ")}.`
    : "Everything is up to date.";
}

function PlaidConnector({
  disabled,
  label = "Connect a bank",
}: {
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [oauth, setOauth] = useState(false);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const oauthOpened = useRef(false);

  const fetchToken = useCallback(async () => {
    setLoadingToken(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/link-token", { method: "POST" });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = (await response.json()) as { linkToken?: string };
      if (!payload.linkToken) throw new Error("Plaid did not return a Link token.");
      setLinkToken(payload.linkToken);
      setStoredToken(payload.linkToken);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not start Plaid Link.",
      );
    } finally {
      setLoadingToken(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("oauth_state_id")) {
      setOauth(true);
      setReceivedRedirectUri(window.location.href);
      const stored = getStoredToken();
      if (stored) {
        setLinkToken(stored);
        setLoadingToken(false);
        return;
      }
    }
    void fetchToken();
  }, [fetchToken]);

  const finishExchange = useCallback(
    async (
      publicToken: string,
      institutionName: string | undefined,
    ): Promise<void> => {
      setBusy(true);
      setError(null);
      setWarning(null);
      try {
        const response = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, institutionName }),
        });
        if (!response.ok) throw new Error(await apiError(response));
        const payload = (await response.json()) as { syncWarning?: string | null };
        setStoredToken(null);
        setLinkToken(null);
        setReceivedRedirectUri(undefined);
        clearOauthQuery();
        setOauth(false);
        router.refresh();
        if (payload.syncWarning) {
          setWarning(
            `Bank connected, but the first sync needs attention: ${payload.syncWarning}`,
          );
        }
        void fetchToken();
      } catch (exchangeError) {
        setStoredToken(null);
        setLinkToken(null);
        setReceivedRedirectUri(undefined);
        clearOauthQuery();
        setOauth(false);
        setError(
          exchangeError instanceof Error
            ? exchangeError.message
            : "Could not finish connecting the bank.",
        );
      } finally {
        setBusy(false);
      }
    },
    [router, fetchToken],
  );

  const onSuccess = useCallback(
    (publicToken: string | null, metadata: PlaidLinkOnSuccessMetadata) => {
      if (!publicToken) {
        setError("Plaid did not return a public token. Please try again.");
        return;
      }
      void finishExchange(publicToken, metadata.institution?.name);
    },
    [finishExchange],
  );

  const onExit = useCallback(
    (exitError: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
      // Keep the Link token across an OAuth redirect. For a normal exit there is
      // nothing to resume, so clear the short-lived token from storage.
      if (!oauth) setStoredToken(null);
      if (!exitError) return;

      setStoredToken(null);
      setLinkToken(null);
      setReceivedRedirectUri(undefined);
      if (oauth) {
        clearOauthQuery();
        setOauth(false);
      }
      const references = [exitError.error_code, metadata.request_id]
        .filter(Boolean)
        .join(" · ");
      setError(
        `${exitError.display_message ?? exitError.error_message}${
          references ? ` (${references})` : ""
        }`,
      );
    },
    [oauth],
  );

  const { open, ready, error: linkError } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
    ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
  });

  useEffect(() => {
    if (!oauth || !linkToken || !ready || oauthOpened.current) return;
    oauthOpened.current = true;
    open();
  }, [oauth, linkToken, ready, open]);

  const openLink = () => {
    if (!linkToken) return;
    setStoredToken(linkToken);
    setError(null);
    setWarning(null);
    open();
  };

  const reset = () => {
    setStoredToken(null);
    setLinkToken(null);
    setOauth(false);
    setReceivedRedirectUri(undefined);
    setError(null);
    oauthOpened.current = false;
    clearOauthQuery();
    void fetchToken();
  };

  const message = error ?? (linkError ? linkError.message : null);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className="btn-primary"
        onClick={message ? reset : openLink}
        disabled={disabled || busy || loadingToken || (!message && !ready)}
      >
        {busy || loadingToken ? (
          <LoaderCircle size={15} className="animate-spin" />
        ) : message ? (
          <RefreshCw size={15} />
        ) : (
          <Link2 size={15} />
        )}
        {busy ? "Finishing…" : loadingToken ? "Preparing…" : message ? "Try again" : label}
      </button>
      {message && (
        <p className="max-w-sm text-right text-[11px] leading-relaxed text-danger">
          {message}
        </p>
      )}
      {warning && (
        <p className="max-w-sm text-right text-[11px] leading-relaxed text-[#8a6a2a]">
          {warning}
        </p>
      )}
      {!ready && !loadingToken && !message && !oauth && (
        <p className="text-right text-[10px] text-faint">Loading secure Link…</p>
      )}
    </div>
  );
}

export function PlaidConnections({
  configured,
  env,
  maxItems,
  demo,
  items,
}: {
  configured: boolean;
  env: "sandbox" | "production";
  maxItems: number;
  demo: boolean;
  items: PlaidConnectionSummary[];
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState<string | "all" | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atLimit = items.length >= maxItems;
  const canConnect = configured && !demo && !atLimit;

  async function sync(connectionId?: string) {
    setSyncing(connectionId ?? "all");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectionId ? { connectionId } : {}),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = (await response.json()) as SyncPayload;
      setMessage(syncMessage(payload));
      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Could not sync.",
      );
    } finally {
      setSyncing(null);
    }
  }

  async function disconnect(item: PlaidConnectionSummary) {
    const confirmed = window.confirm(
      `Disconnect ${item.institutionName}?\n\nSynced accounts and transactions will stay in Loonie as manual accounts. Future automatic updates will stop.`,
    );
    if (!confirmed) return;
    setDisconnecting(item.id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/plaid/items/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = (await response.json()) as { warning?: string | null };
      setMessage(
        payload.warning ??
          `${item.institutionName} was disconnected. Its accounts remain available as manual accounts.`,
      );
      router.refresh();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Could not disconnect that bank.",
      );
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="space-y-4">
      {!configured && (
        <section className="rounded-2xl border border-gold/25 bg-gold-soft/50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-[#7a5718]" />
            <div>
              <p className="text-[13px] font-semibold text-[#6d4f18]">
                Plaid is not configured yet
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#8a6a2a]">
                Add <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>, and{" "}
                <code>PLAID_TOKEN_ENCRYPTION_KEY</code> to <code>.env</code>, then
                restart Loonie. See <code>.env.example</code> and the README for
                the full production setup.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="pill capitalize">{env}</span>
          <span>
            {items.length} of {maxItems} connections used
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => sync()}
              disabled={!configured || Boolean(syncing) || demo}
            >
              <RefreshCw
                size={14}
                className={syncing === "all" ? "animate-spin" : ""}
              />
              {syncing === "all" ? "Syncing…" : "Sync all"}
            </button>
          )}
          {canConnect && items.length > 0 && (
            <PlaidConnector label="Connect another" />
          )}
        </div>
      </div>

      {atLimit && configured && !demo && (
        <p className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-[11px] text-muted">
          You have reached the configured Plaid connection limit. Disconnect a
          bank before adding another.
        </p>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-forest/20 bg-forest-soft px-4 py-3 text-[11px] leading-relaxed text-forest">
          <Check size={14} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[11px] leading-relaxed text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 ? (
        <section className="card relative overflow-hidden p-7 sm:p-9">
          <div
            className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(194,145,58,.16) 0%, rgba(194,145,58,0) 70%)",
            }}
            aria-hidden
          />
          <span className="flex size-12 items-center justify-center rounded-full bg-forest-soft text-forest">
            <ShieldCheck size={21} />
          </span>
          <h2 className="mt-4 font-display text-[25px] text-ink">
            Connect your bank once.
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            Plaid Link signs you in with your bank in a secure Plaid window.
            Loonie receives the account names, balances, and transactions you
            approve — never your online banking password. Transactions sync when
            you ask, and Plaid webhooks can update them automatically.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {canConnect ? (
              <PlaidConnector />
            ) : (
              <Link2 size={17} className="text-faint" />
            )}
            <span className="text-[10px] text-faint">
              Canadian accounts · CAD balances · statement imports remain
              available for manual accounts
            </span>
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <section key={item.id} className="card overflow-hidden">
              <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest-soft text-[11px] font-bold text-forest">
                    {initials(item.institutionName)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[13px] font-semibold text-ink">
                      {item.institutionName}
                    </h2>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {item.accountCount}{" "}
                      {item.accountCount === 1 ? "account" : "accounts"} ·{" "}
                      {item.lastSyncedExact
                        ? `last synced ${item.lastSyncedLabel}`
                        : "not synced yet"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => sync(item.id)}
                    disabled={!configured || Boolean(syncing) || demo}
                  >
                    <RefreshCw
                      size={13}
                      className={syncing === item.id ? "animate-spin" : ""}
                    />
                    {syncing === item.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs text-danger"
                    onClick={() => disconnect(item)}
                    disabled={Boolean(disconnecting) || Boolean(syncing)}
                  >
                    {disconnecting === item.id ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    Disconnect
                  </button>
                </div>
              </header>

              <div className="px-4 py-3 sm:px-5">
                {item.accounts.length === 0 ? (
                  <p className="text-[11px] text-muted">
                    No CAD accounts were imported from this connection yet.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {item.accounts.map((account) => (
                      <li
                        key={account.id}
                        className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2.5"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-muted">
                          {account.type === "credit" || account.type === "loan" ? (
                            <Building2 size={13} />
                          ) : (
                            <Landmark size={13} />
                          )}
                        </span>
                        <span className="min-w-0 truncate text-[11px] font-medium text-ink">
                          {account.name}
                          {account.mask ? (
                            <span className="font-normal text-faint"> ···{account.mask}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {item.lastSyncError && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[10px] leading-relaxed text-danger">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {item.lastSyncError}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard
          icon={<ShieldCheck size={15} />}
          title="Encrypted at rest"
          body="Plaid access tokens are encrypted with AES-256-GCM using a key that stays outside the SQLite database."
        />
        <InfoCard
          icon={<RefreshCw size={15} />}
          title="Manual or automatic"
          body={
            configured
              ? "Use Sync now any time. Add a public webhook URL to let Plaid trigger syncs when new transactions arrive."
              : "Once configured, sync from here or let Plaid webhooks keep transactions up to date."
          }
        />
        <InfoCard
          icon={<AlertCircle size={15} />}
          title="CAD only for now"
          body="Non-CAD accounts are skipped so Loonie never displays a foreign balance as Canadian dollars."
        />
      </section>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-surface text-forest">
        {icon}
      </span>
      <p className="mt-2.5 text-[11px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
