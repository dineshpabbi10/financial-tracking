import Link from "next/link";
import { ArrowLeft, FileText, Link2, Lock, ShieldCheck } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Add account" };

export default function NewAccountPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Add a manual account."
        description="Give the account a name and a starting balance, then upload its first statement. To connect a bank and sync automatically, use Connections instead."
        actions={
          <>
            <Link href="/connections" className="btn-secondary">
              <Link2 size={14} /> Connect a bank
            </Link>
            <Link href="/accounts" className="btn-ghost">
              <ArrowLeft size={14} /> Back to accounts
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-5 sm:p-6">
          <AccountForm />
        </section>

        <aside className="space-y-4">
          <section className="card bg-surface-raised p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
              Finding your statement
            </h2>
            <ol className="mt-4 space-y-4">
              <Step number="1" title="Open online banking">
                Sign in directly with your bank. Loonie never sees those
                credentials.
              </Step>
              <Step number="2" title="Find transactions or statements">
                Look for “Download transactions”, “Export”, or a statement PDF
                for the account.
              </Step>
              <Step number="3" title="Choose a format">
                CSV or OFX/QFX is most reliable. PDF works, but you&apos;ll review
                every row before importing.
              </Step>
            </ol>
          </section>

          <section className="card p-5">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                <ShieldCheck size={15} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-ink">Private by default</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  This is a manual account. Statement files are parsed in memory
                  and discarded; only the transactions you approve are saved, in
                  your own database.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-[11px] text-muted">
                <FileText size={13} className="text-faint" /> CSV · OFX · QFX · PDF
              </p>
              <p className="flex items-center gap-2 text-[11px] text-muted">
                <Lock size={13} className="text-faint" /> No bank login needed for manual accounts
              </p>
            </div>
          </section>

          <p className="px-1 text-[10px] leading-relaxed text-faint">
            Tip: name the account the same way you think about it — “Everyday
            Chequing”, “Amex Cobalt” — so the dashboard stays easy to scan.
          </p>
        </aside>
      </div>
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
    <li className="flex gap-3">
      <span className="font-display flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[10px] text-muted">
        {number}
      </span>
      <div>
        <p className="text-[12px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
