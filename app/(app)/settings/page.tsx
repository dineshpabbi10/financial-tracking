import Link from "next/link";
import {
  CalendarClock,
  Database,
  Download,
  FileText,
  Fingerprint,
  HardDrive,
  Landmark,
  Link2,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { DemoDataActions } from "@/components/demo-data-actions";
import { InstallPrompt } from "@/components/install-prompt";
import { PageHeader } from "@/components/page-header";
import { PasscodeForm } from "@/components/passcode-form";
import { SignOutButton } from "@/components/sign-out";
import { getSession } from "@/lib/auth";
import { APP_TIMEZONE, formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { BANK_PRESETS } from "@/lib/import/banks";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [
    session,
    accounts,
    transactions,
    imports,
    budgets,
    recurring,
    demoCount,
    plaidItems,
  ] = await Promise.all([
    getSession(),
    db.account.count(),
    db.transaction.count(),
    db.importBatch.count(),
    db.budget.count(),
    db.recurringSeries.count(),
    db.account.count({ where: { isDemo: true } }),
    db.plaidItem.count(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Make it yours."
        description="Your passcode, your data, and the details of this Loonie instance."
        actions={
          <>
            <Link href="/connections" className="btn-secondary">
              <Link2 size={15} /> Connections
            </Link>
            <Link href="/import" className="btn-ghost">
              <Upload size={15} /> Import statement
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                <Fingerprint size={16} />
              </span>
              <div>
                <h2 className="font-display text-[20px] text-ink">Passcode</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  One passcode protects this instance. It is stored on the server as
                  a salted scrypt hash, never in the browser.
                </p>
              </div>
            </div>
            <PasscodeForm />
            {session && (
              <p className="mt-4 border-t border-line pt-3 text-[10px] text-faint">
                This session started {formatDate(session.createdAt)}. Sessions last 30
                days.
              </p>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-[#7a5718]">
                <Database size={16} />
              </span>
              <div>
                <h2 className="font-display text-[20px] text-ink">Demo data</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Explore with four sample Canadian accounts and nine months of
                  transactions. Demo data can&apos;t be combined with your own
                  accounts or bank connections — clear it before adding accounts,
                  importing statements, or connecting a bank.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {accounts === 0 || demoCount > 0 ? (
                <DemoDataActions hasDemo={demoCount > 0} />
              ) : (
                <p className="text-[11px] leading-relaxed text-muted">
                  Demo data is only available before your first real account.
                </p>
              )}
              {demoCount > 0 && (
                <p className="text-[11px] text-muted">
                  {demoCount} demo {demoCount === 1 ? "account" : "accounts"} active
                </p>
              )}
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                <ShieldCheck size={16} />
              </span>
              <div>
                <h2 className="font-display text-[20px] text-ink">
                  Privacy & data sources
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Statement imports stay local. Optional bank sync uses Plaid and
                  never gives Loonie your banking password.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PrivacyCard
                icon={<Lock size={14} />}
                title="Bank logins stay with Plaid"
                body="If you connect a bank, Plaid Link handles the login. Loonie receives account and transaction data from Plaid, never your online banking password."
              />
              <PrivacyCard
                icon={<ShieldCheck size={14} />}
                title="Encrypted bank tokens"
                body="Plaid access tokens are encrypted with AES-256-GCM before storage. The encryption key stays in your server environment, not the database."
              />
              <PrivacyCard
                icon={<FileText size={14} />}
                title="Files aren't stored"
                body="CSV, OFX/QFX, and PDF files are parsed in memory. The file itself is discarded after import."
              />
              <PrivacyCard
                icon={<HardDrive size={14} />}
                title="Local database"
                body="Transactions and synced account data are stored in the SQLite database on your server. Back up the database and encryption key regularly."
              />
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted">
                <Download size={16} />
              </span>
              <div>
                <h2 className="font-display text-[20px] text-ink">Install the app</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Loonie is a PWA. Install it for a faster, full-screen view and an
                  offline app shell.
                </p>
              </div>
            </div>
            <InstallPrompt />
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
              Session
            </h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-muted">
                Signing out clears the session cookie on this device. Your data stays
                in the database.
              </p>
              <SignOutButton />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
              At a glance
            </h2>
            <dl className="mt-3 divide-row">
              <Stat label="Accounts" value={accounts.toString()} />
              <Stat label="Transactions" value={transactions.toLocaleString("en-CA")} />
              <Stat label="Bank connections" value={plaidItems.toString()} />
              <Stat label="Statement imports" value={imports.toString()} />
              <Stat label="Budgets" value={budgets.toString()} />
              <Stat label="Recurring series" value={recurring.toString()} />
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <CalendarClock size={15} className="text-forest" />
              <h2 className="text-[13px] font-semibold text-ink">App details</h2>
            </div>
            <dl className="mt-3 space-y-2.5 text-[11px]">
              <DetailRow label="Timezone" value={APP_TIMEZONE.replace("_", " ")} />
              <DetailRow label="Currency" value="CAD" />
              <DetailRow label="Storage" value="SQLite (local)" />
              <DetailRow label="Imports" value="CSV · OFX/QFX · PDF" />
              <DetailRow label="Bank sync" value="Plaid (optional)" />
              <DetailRow label="Version" value="0.1.0" />
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Landmark size={15} className="text-forest" />
              <h2 className="text-[13px] font-semibold text-ink">Bank presets</h2>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
              Hints for CSV column detection and PDF dates. You can always remap
              columns during an import.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {BANK_PRESETS.filter((preset) => preset.id !== "other").map((preset) => (
                <span key={preset.id} className="pill px-2 py-0.5 text-[9px]">
                  {preset.shortName}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface-raised px-4 py-4">
            <div className="flex items-start gap-2.5">
              <Settings size={15} className="mt-0.5 shrink-0 text-muted" />
              <p className="text-[10px] leading-relaxed text-muted">
                Self-hosted and single-user by design. Put this behind HTTPS and a
                reverse proxy if you expose it outside your home network.
              </p>
            </div>
          </section>

          <Link
            href="/connections"
            className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[11px] font-semibold text-forest shadow-soft transition-colors hover:border-forest"
          >
            Manage bank connections
            <Link2 size={13} />
          </Link>
          <Link
            href="/import"
            className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[11px] font-semibold text-forest shadow-soft transition-colors hover:border-forest"
          >
            View import history
            <LogOut size={13} className="rotate-180" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function PrivacyCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-3.5">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-ink">
        <span className="text-forest">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="tabular text-[12px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
