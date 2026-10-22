import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Landmark,
  Link2,
  Plus,
  Upload,
  Wallet,
} from "lucide-react";
import { AccountRowActions } from "@/components/account-row-actions";
import { DemoDataActions } from "@/components/demo-data-actions";
import { GettingStarted } from "@/components/getting-started";
import { PageHeader } from "@/components/page-header";
import { getAccountsOverview } from "@/lib/analytics";
import { getPlaidOverview } from "@/lib/plaid/overview";
import { formatDate, relativeDateLabel, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const TYPE_LABEL: Record<string, string> = {
  chequing: "Chequing",
  savings: "Savings",
  credit: "Credit card",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

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

export default async function AccountsPage() {
  const [data, plaid] = await Promise.all([
    getAccountsOverview(),
    getPlaidOverview(),
  ]);
  const hasDemo = data.accounts.some((account) => account.isDemo);

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="The full picture."
        description="Add every account you want to track — chequing, savings, credit cards, and loans. Balances update from statements or manually."
        actions={
          hasDemo ? undefined : plaid.configured || plaid.totalItems > 0 ? (
            <>
              <Link
                href="/connections"
                className={
                  plaid.totalItems > 0 ? "btn-secondary" : "btn-primary"
                }
              >
                <Link2 size={15} />
                {plaid.totalItems > 0 ? "Banks" : "Connect bank"}
              </Link>
              <Link href="/import" className="btn-secondary">
                <Upload size={15} /> Import
              </Link>
              <Link href="/accounts/new" className="btn-ghost">
                <Plus size={15} /> Add account
              </Link>
            </>
          ) : (
            <>
              <Link href="/import" className="btn-secondary">
                <Upload size={15} /> Import
              </Link>
              <Link href="/accounts/new" className="btn-primary">
                <Plus size={15} /> Add account
              </Link>
            </>
          )
        }
      />

      {data.accounts.length === 0 ? (
        <GettingStarted />
      ) : (
        <>
          {hasDemo && (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gold/25 bg-gold-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-relaxed text-[#6d4f18]">
                <span className="font-semibold">Demo accounts are included.</span>{" "}
                Clear them before adding your own accounts or importing real
                statements.
              </p>
              <DemoDataActions hasDemo compact />
            </div>
          )}

          <section className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="card bg-forest p-5 text-paper">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-paper/50">
                  Net worth
                </p>
                <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-gold">
                  <Wallet size={16} />
                </span>
              </div>
              <p className="tabular font-display mt-3 text-[28px] leading-none">
                {formatMoney(data.netWorthCents)}
              </p>
              <p className="mt-2 text-[10px] text-paper/50">
                {formatMoney(data.cashCents, { whole: true })} in cash ·{" "}
                {formatMoney(data.debtCents, { whole: true })} owed
              </p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Cash & investments
                </p>
                <span className="flex size-8 items-center justify-center rounded-full bg-forest-soft text-forest">
                  <Landmark size={16} />
                </span>
              </div>
              <p className="tabular font-display mt-3 text-[28px] leading-none text-ink">
                {formatMoney(data.cashCents)}
              </p>
              <p className="mt-2 text-[10px] text-muted">
                {data.accounts.filter((a) => ["chequing", "savings", "investment"].includes(a.type)).length}{" "}
                asset accounts
              </p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Credit & loans
                </p>
                <span className="flex size-8 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <CreditCard size={16} />
                </span>
              </div>
              <p className="tabular font-display mt-3 text-[28px] leading-none text-ink">
                {formatMoney(data.debtCents)}
              </p>
              <p className="mt-2 text-[10px] text-muted">
                {data.accounts.filter((a) => ["credit", "loan"].includes(a.type)).length}{" "}
                debt accounts
              </p>
            </div>
          </section>

          <div className="space-y-4">
            {data.groups.map((group) => (
              <section
                key={`${group.institution}-${group.isDemo}`}
                className={`card overflow-hidden ${group.isDemo ? "border-gold/30" : ""}`}
              >
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${
                        group.isDemo
                          ? "bg-gold-soft text-[#7a5718]"
                          : "bg-forest-soft text-forest"
                      }`}
                    >
                      {initials(group.institution)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[13px] font-semibold text-ink">
                        {group.institution}
                      </h2>
                      <p className="text-[10px] text-muted">
                        {group.accounts.length}{" "}
                        {group.accounts.length === 1 ? "account" : "accounts"}
                        {group.latestImportAt
                          ? ` · last import ${relativeDateLabel(group.latestImportAt, today())}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.isDemo && <span className="pill-gold">Demo</span>}
                    {!group.isDemo && (
                      <Link
                        href="/accounts/new"
                        className="hidden items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-forest sm:inline-flex"
                      >
                        <Plus size={11} /> Account
                      </Link>
                    )}
                  </div>
                </header>

                <ul className="divide-row">
                  {group.accounts.map((account) => {
                    const isDebt = ["credit", "loan"].includes(account.type);
                    return (
                      <li
                        key={account.id}
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised text-muted">
                            {isDebt ? <CreditCard size={15} /> : <Landmark size={15} />}
                          </span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                              <span className="truncate">
                                {account.name}
                                {account.mask ? (
                                  <span className="font-normal text-faint">
                                    {" "}
                                    ···{account.mask}
                                  </span>
                                ) : null}
                              </span>
                              {account.plaidItemId && (
                                <span className="pill px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]">
                                  Plaid
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-muted">
                              {TYPE_LABEL[account.type] ?? account.type}
                              {" · "}
                              {account.transactionCount}{" "}
                              {account.transactionCount === 1 ? "transaction" : "transactions"}
                              {account.lastTransactionDate
                                ? ` · to ${formatDate(account.lastTransactionDate)}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-4 pl-12 sm:justify-end sm:pl-0">
                          <div className="text-right">
                            <p className="tabular text-[14px] font-semibold text-ink">
                              {formatMoney(Math.abs(account.currentBalanceCents))}
                            </p>
                            <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-faint">
                              {isDebt ? "owed" : "balance"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {!group.isDemo && !account.plaidItemId && (
                              <Link
                                href={`/import?account=${account.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
                              >
                                <Upload size={11} /> Import
                              </Link>
                            )}
                            <AccountRowActions
                              synced={Boolean(account.plaidItemId)}
                              account={{
                                id: account.id,
                                name: account.name,
                                type: account.type,
                                mask: account.mask,
                                currentBalanceCents: account.currentBalanceCents,
                                transactionCount: account.transactionCount,
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {!hasDemo && (
            <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-line-strong px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                  <Building2 size={15} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">
                    Track another account
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    Add a savings account, a second credit card, or a loan. Each
                    account keeps its own import history.
                  </p>
                </div>
              </div>
              <Link href="/accounts/new" className="btn-secondary shrink-0">
                <Plus size={14} /> Add account <ArrowRight size={13} />
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
