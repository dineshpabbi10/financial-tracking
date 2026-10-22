import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Landmark,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { CategoryDonut, CashflowBars } from "@/components/charts";
import { DemoDataActions } from "@/components/demo-data-actions";
import { GettingStarted } from "@/components/getting-started";
import { PageHeader } from "@/components/page-header";
import { UpcomingList } from "@/components/upcoming-list";
import { getDashboardData } from "@/lib/analytics";
import { categoryColor, categoryLabel } from "@/lib/categories";
import { formatMonth, today } from "@/lib/dates";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/money";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const monthLabel = formatMonth(today());
  const hasDemo = data.accounts.some((account) => account.isDemo);

  if (data.accounts.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow={`Overview · ${monthLabel}`}
          title="Your money, in focus."
          description="Start by adding the account you use most. Then upload a statement and Loonie will take it from there."
        />
        <GettingStarted />
      </div>
    );
  }

  const change = data.currentMonth.spendChange;
  const changePercent = change === null ? null : Math.abs(change) * 100;

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow={`Overview · ${monthLabel}`}
        title="Here's the shape of your month."
        description="Spending, income, and the bills still to come — all in one place."
        actions={
          hasDemo ? undefined : (
            <>
              <Link href="/accounts/new" className="btn-secondary">
                <Plus size={15} /> Add account
              </Link>
              <Link href="/import" className="btn-primary">
                <Upload size={15} /> Import statement
              </Link>
            </>
          )
        }
      />

      {hasDemo && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gold/25 bg-gold-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 size-2 shrink-0 rounded-full bg-gold" />
            <p className="text-[12px] leading-relaxed text-[#6d4f18]">
              <span className="font-semibold">You&apos;re viewing demo data.</span>{" "}
              Clear the demo before adding your own accounts or importing real
              statements.
            </p>
          </div>
          <DemoDataActions hasDemo compact />
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net worth"
          value={formatMoney(data.netWorthCents)}
          icon={<Wallet size={17} />}
          sub={
            <span className="text-muted">
              {formatMoney(data.cashCents, { whole: true })} cash ·{" "}
              {formatMoney(data.debtCents, { whole: true })} owed
            </span>
          }
          tone="forest"
        />
        <StatCard
          label="Spent this month"
          value={formatMoney(data.currentMonth.spendCents)}
          icon={<ArrowUpRight size={17} />}
          sub={
            changePercent === null ? (
              <span className="text-muted">No full month to compare yet</span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 ${
                  change! >= 0 ? "text-danger" : "text-forest"
                }`}
              >
                {change! >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatPercent(changePercent, 0)} {change! >= 0 ? "more" : "less"} than
                last month
              </span>
            )
          }
        />
        <StatCard
          label="Money in"
          value={formatMoney(data.currentMonth.incomeCents)}
          icon={<ArrowDownLeft size={17} />}
          sub={
            <span className="text-muted">
              Last month {formatMoney(data.currentMonth.previousIncomeCents, { whole: true })}
            </span>
          }
        />
        <StatCard
          label="Due in 30 days"
          value={formatMoney(data.upcomingTotalCents)}
          icon={<CalendarClock size={17} />}
          sub={
            <span className="text-muted">
              {data.upcomingCount} {data.upcomingCount === 1 ? "bill" : "bills"} detected
              {data.nextIncome
                ? ` · payday ${formatMoney(data.nextIncome.amountCents, { whole: true })}`
                : ""}
            </span>
          }
          tone="gold"
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[20px] text-ink">Cash flow</h2>
              <p className="mt-1 text-[12px] text-muted">
                Income and spending over the last six months.
              </p>
            </div>
            <span className="pill-green hidden sm:inline-flex">
              {formatMonth(today())}
            </span>
          </div>
          <CashflowBars
            items={data.trend.map((month) => ({
              label: month.label,
              spendCents: month.spendCents,
              incomeCents: month.incomeCents,
            }))}
          />
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[20px] text-ink">Where it went</h2>
              <p className="mt-1 text-[12px] text-muted">
                This month, by category.
              </p>
            </div>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
            >
              Activity <ArrowRight size={12} />
            </Link>
          </div>
          <CategoryDonut
            items={data.categories.map((category) => ({
              category: category.category,
              amountCents: category.amountCents,
            }))}
            totalCents={data.currentMonth.spendCents}
          />
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[20px] text-ink">Upcoming</h2>
              <p className="mt-1 text-[12px] text-muted">Next 30 days.</p>
            </div>
            <span className="pill-gold">
              {formatMoney(data.upcomingTotalCents, { whole: true })}
            </span>
          </div>
          <UpcomingList events={data.upcoming} showViewAll />
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[20px] text-ink">Budgets</h2>
              <p className="mt-1 text-[12px] text-muted">How the month is tracking.</p>
            </div>
            <Link
              href="/budgets"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
            >
              All <ArrowRight size={12} />
            </Link>
          </div>
          {data.budgets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-5 py-7 text-center">
              <Target size={18} className="mx-auto text-faint" />
              <p className="mt-2 text-[13px] font-medium text-ink">No budgets yet</p>
              <Link
                href="/budgets"
                className="mt-2 inline-flex text-[11px] font-semibold text-forest hover:underline"
              >
                Set your first monthly limit
              </Link>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {data.budgets.slice(0, 4).map((budget) => {
                const pct = Math.round(budget.progress * 100);
                const over = budget.progress > 1;
                const near = budget.progress >= 0.8 && !over;
                return (
                  <li key={budget.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-ink">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: categoryColor(budget.category) }}
                        />
                        <span className="truncate">{categoryLabel(budget.category)}</span>
                      </span>
                      <span className="tabular shrink-0 text-[11px] text-muted">
                        {formatMoney(budget.spentCents, { whole: true })}{" "}
                        <span className="text-faint">
                          / {formatMoney(budget.limitCents, { whole: true })}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eee9de]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: over ? "#ad3b2b" : near ? "#c2913a" : "#1c5a42",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[20px] text-ink">Recent</h2>
              <p className="mt-1 text-[12px] text-muted">Latest activity.</p>
            </div>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
            >
              All <ArrowRight size={12} />
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-5 py-7 text-center">
              <ArrowUpRight size={18} className="mx-auto text-faint" />
              <p className="mt-2 text-[13px] font-medium text-ink">
                No transactions yet
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Import a statement to bring your history in.
              </p>
            </div>
          ) : (
            <ul className="divide-row">
              {data.recentTransactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised text-muted"
                    aria-hidden
                  >
                    {tx.account.type === "credit" ? (
                      <CreditCard size={15} />
                    ) : (
                      <Landmark size={15} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">
                      {tx.merchantName ?? tx.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">
                      {tx.account.name}
                      {tx.account.mask ? ` ···${tx.account.mask}` : ""} ·{" "}
                      {categoryLabel(tx.categoryOverride ?? tx.category)}
                    </p>
                  </div>
                  <span
                    className={`tabular shrink-0 text-[12px] font-semibold ${
                      tx.amountCents > 0 ? "text-ink" : "text-forest"
                    }`}
                  >
                    {formatSignedMoney(tx.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
            <Upload size={15} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">
              Keep the picture current
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Download a CSV, OFX/QFX, or PDF statement from online banking and
              import it here. Duplicates are skipped automatically.
            </p>
          </div>
        </div>
        <Link href="/import" className="btn-secondary shrink-0">
          Import a statement <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  icon: React.ReactNode;
  tone?: "plain" | "forest" | "gold";
}) {
  const shell =
    tone === "forest"
      ? "border-transparent bg-forest text-paper"
      : tone === "gold"
        ? "border-gold/30 bg-gold-soft/50"
        : "border-line bg-surface";
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${shell}`}>
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
            tone === "forest" ? "text-paper/50" : "text-muted"
          }`}
        >
          {label}
        </p>
        <span
          className={`flex size-8 items-center justify-center rounded-full ${
            tone === "forest"
              ? "bg-white/10 text-gold"
              : tone === "gold"
                ? "bg-gold/15 text-[#7a5718]"
                : "bg-forest-soft text-forest"
          }`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`tabular font-display mt-3 text-[27px] leading-none ${
          tone === "forest" ? "text-paper" : "text-ink"
        }`}
      >
        {value}
      </p>
      <div className="mt-2 text-[10px] leading-relaxed">{sub}</div>
    </div>
  );
}
