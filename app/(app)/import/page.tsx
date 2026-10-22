import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Landmark,
  Link2,
  Lock,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { DemoDataActions } from "@/components/demo-data-actions";
import { GettingStarted } from "@/components/getting-started";
import { ImportWizard } from "@/components/import-wizard";
import { PageHeader } from "@/components/page-header";
import { UndoImportButton } from "@/components/undo-import-button";
import { getAccounts, getImportHistory } from "@/lib/analytics";
import { formatDate } from "@/lib/dates";

const KIND_LABEL: Record<string, string> = {
  csv: "CSV",
  ofx: "OFX/QFX",
  pdf: "PDF",
  demo: "Demo",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialAccountId = Array.isArray(params.account)
    ? params.account[0]
    : params.account;
  const [accounts, history] = await Promise.all([
    getAccounts(),
    getImportHistory(14),
  ]);
  const realAccounts = accounts.filter((account) => !account.isDemo);
  const importableAccounts = realAccounts.filter(
    (account) => !account.plaidItemId,
  );
  const demoOnly = accounts.length > 0 && realAccounts.length === 0;
  const plaidOnly =
    realAccounts.length > 0 && importableAccounts.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Bring in a statement."
        description="Upload CSV, OFX/QFX, or PDF statements from Canadian banks. Review everything before it's saved — PDF extraction always needs a human eye."
        actions={
          demoOnly ? undefined : (
            <>
              {realAccounts.length > 0 && (
                <Link href="/connections" className="btn-secondary">
                  <Link2 size={15} /> Bank connections
                </Link>
              )}
              <Link href="/accounts/new" className="btn-secondary">
                <Plus size={15} /> Add account
              </Link>
              {accounts.length > 0 && (
                <Link href="/accounts" className="btn-ghost">
                  <Landmark size={15} /> Accounts
                </Link>
              )}
            </>
          )
        }
      />

      {accounts.length === 0 ? (
        <GettingStarted />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {demoOnly ? (
            <DemoImportNotice />
          ) : plaidOnly ? (
            <PlaidImportNotice />
          ) : (
            <ImportWizard
              accounts={importableAccounts.map((account) => ({
                id: account.id,
                name: account.name,
                institution: account.institution,
                mask: account.mask,
                type: account.type,
                bankPreset: account.bankPreset,
              }))}
              initialAccountId={initialAccountId}
            />
          )}

          <aside className="space-y-4">
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Recent imports
                </h2>
                {history.length > 0 && (
                  <span className="pill">{history.length}</span>
                )}
              </div>
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong px-4 py-7 text-center">
                  <Upload size={18} className="mx-auto text-faint" />
                  <p className="mt-2 text-[12px] font-medium text-ink">
                    No imports yet
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Your import history and undo controls will show up here.
                  </p>
                </div>
              ) : (
                <ul className="divide-row">
                  {history.map((batch) => (
                    <li key={batch.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-raised text-muted">
                          {batch.fileKind === "pdf" ? (
                            <FileText size={14} />
                          ) : (
                            <FileSpreadsheet size={14} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-ink">
                            {batch.filename}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-muted">
                            {batch.account.name}
                            {batch.account.mask ? ` ···${batch.account.mask}` : ""} ·{" "}
                            {formatDate(batch.createdAt)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="pill px-1.5 py-0.5 text-[9px]">
                              {KIND_LABEL[batch.fileKind] ?? batch.fileKind}
                            </span>
                            <span className="text-[10px] text-muted">
                              {batch.transactionsImported} imported
                            </span>
                            {batch.transactionsSkipped > 0 && (
                              <span className="text-[10px] text-faint">
                                · {batch.transactionsSkipped} skipped
                              </span>
                            )}
                            {batch.isDemo && (
                              <span className="pill-gold px-1.5 py-0.5 text-[9px]">
                                demo
                              </span>
                            )}
                          </div>
                        </div>
                        <UndoImportButton
                          batchId={batch.id}
                          imported={batch.transactionsImported}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card bg-surface-raised p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                Good to know
              </h2>
              <ul className="mt-3 space-y-3">
                <InfoRow icon={<ShieldCheck size={14} />} title="Files aren't stored">
                  Statements are parsed in memory. Only the transactions you
                  approve are written to your database.
                </InfoRow>
                <InfoRow icon={<Lock size={14} />} title="Imports stay manual">
                  Statement files are for accounts you track by hand. If a bank is
                  connected with Plaid, use its Sync now action instead.
                </InfoRow>
                <InfoRow icon={<FileText size={14} />} title="PDF needs review">
                  Layouts vary, even within one bank. Verify each PDF row and flip
                  signs if spending looks backwards.
                </InfoRow>
              </ul>
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-[10px] leading-relaxed text-faint">
                  Best results: CSV export from online banking. OFX/QFX includes
                  stable transaction IDs, which makes duplicate detection reliable.
                </p>
              </div>
            </section>

            {accounts.some((account) => account.isDemo) && (
              <section className="rounded-2xl border border-gold/25 bg-gold-soft/50 p-4">
                <p className="text-[11px] font-semibold text-[#6d4f18]">
                  Demo imports included
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#8a6a2a]">
                  Undoing a demo import removes its transactions. Reset the demo in
                  Settings to put them back.
                </p>
                <Link
                  href="/settings"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6d4f18] hover:underline"
                >
                  Open settings <ArrowRight size={10} />
                </Link>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function PlaidImportNotice() {
  return (
    <section className="card p-7 sm:p-9">
      <span className="flex size-12 items-center justify-center rounded-full bg-forest-soft text-forest">
        <Link2 size={20} />
      </span>
      <h2 className="mt-4 font-display text-[26px] text-ink">
        These accounts sync with Plaid.
      </h2>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
        Statement imports are reserved for manual accounts. Use Sync now on the
        Connections page for bank-synced balances and transactions, or add a
        manual account if you want to import a statement by hand.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href="/connections" className="btn-primary">
          <Link2 size={14} /> Open connections
        </Link>
        <Link href="/accounts/new" className="btn-secondary">
          <Plus size={14} /> Add a manual account
        </Link>
      </div>
    </section>
  );
}

function DemoImportNotice() {
  return (
    <section className="card p-7 sm:p-9">
      <span className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-[#7a5718]">
        <Lock size={20} />
      </span>
      <h2 className="mt-4 font-display text-[26px] text-ink">
        You&apos;re exploring demo data.
      </h2>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
        Demo accounts are read-only for imports so your real statements can never
        mix with sample data. Clear the demo when you&apos;re ready, then add your
        own account and import your first statement.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <DemoDataActions hasDemo />
        <Link href="/accounts" className="btn-ghost">
          Back to accounts <ArrowRight size={13} />
        </Link>
      </div>
    </section>
  );
}

function InfoRow({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
