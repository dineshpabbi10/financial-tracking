import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Link2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { DemoDataActions } from "@/components/demo-data-actions";
import { isPlaidConfigured } from "@/lib/plaid/config";

export function GettingStarted() {
  const plaidReady = isPlaidConfigured();
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="card relative overflow-hidden p-7 sm:p-9">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(194,145,58,.18) 0%, rgba(194,145,58,0) 70%)",
          }}
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
          Welcome to Loonie
        </p>
        <h2 className="mt-3 max-w-md font-display text-[30px] leading-[1.12] text-ink">
          Connect your bank. Or bring a statement.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Connect a Canadian account with Plaid for synced balances and
          transactions, or add an account by hand and import a CSV, OFX/QFX, or
          PDF statement. Either way, Loonie categorizes spending and starts
          finding bills before they land.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {plaidReady ? (
            <>
              <Link href="/connections" className="btn-primary">
                <Link2 size={16} /> Connect a bank
              </Link>
              <Link href="/accounts/new" className="btn-secondary">
                <Upload size={16} /> Add a manual account
              </Link>
            </>
          ) : (
            <>
              <Link href="/accounts/new" className="btn-primary">
                <Upload size={16} /> Add your first account
              </Link>
              <Link href="/connections" className="btn-secondary">
                <Link2 size={16} /> Set up bank sync
              </Link>
            </>
          )}
          <DemoDataActions hasDemo={false} />
        </div>

        <div className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
          <Benefit icon={<FileText size={15} />} title="CSV, OFX, or PDF">
            PDF parsing is best-effort, with a review step before importing.
          </Benefit>
          <Benefit icon={<CalendarClock size={15} />} title="Bills ahead">
            Recurring charges and paydays projected forward.
          </Benefit>
          <Benefit icon={<ShieldCheck size={15} />} title="Private by design">
            Bank logins happen in Plaid Link. Statement files are parsed in
            memory and never written to disk.
          </Benefit>
        </div>
      </section>

      <aside className="card flex flex-col justify-between bg-forest p-7 text-paper sm:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
            How it works
          </p>
          <ol className="mt-5 space-y-5">
            <Step number="1" title="Connect or add an account">
              Link a bank with Plaid, or name a manual account and enter its
              current balance.
            </Step>
            <Step number="2" title="Sync or upload">
              Sync bank transactions from Connections, or drop in a statement
              for a manual account.
            </Step>
            <Step number="3" title="Review the month">
              Check categories, set budgets, and let recurring bills surface.
            </Step>
          </ol>
        </div>
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-paper/40">
            Privacy note
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-paper/55">
            Loonie is single-user and self-hosted. Transactions live in your own
            database. Connecting a bank is optional and uses Plaid Link; Loonie
            never sees your banking password and stores only encrypted Plaid
            tokens. No analytics or ad trackers.
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold hover:underline"
          >
            Review settings <ArrowRight size={12} />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Benefit({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="flex size-8 items-center justify-center rounded-full bg-forest-soft text-forest">
        {icon}
      </span>
      <p className="mt-2.5 text-[12px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-full border border-paper/20 text-[12px] text-gold">
        {number}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-paper/90">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-paper/45">{children}</p>
      </div>
    </li>
  );
}
