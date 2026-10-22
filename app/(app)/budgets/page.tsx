import Link from "next/link";
import { ArrowRight, Target, Upload } from "lucide-react";
import { BudgetManager } from "@/components/budget-manager";
import { PageHeader } from "@/components/page-header";
import { getBudgetOverview } from "@/lib/analytics";
import { BUDGETABLE_CATEGORIES, categoryColor, categoryLabel } from "@/lib/categories";
import { formatMoney, formatPercent } from "@/lib/money";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const data = await getBudgetOverview(month);
  const budgetedIds = new Set(data.budgets.map((budget) => budget.category));
  const availableCategories = BUDGETABLE_CATEGORIES.filter(
    (category) => !budgetedIds.has(category.id),
  ).map((category) => ({ id: category.id, label: category.label }));

  const remaining = data.totalLimitCents - data.totalSpentCents;
  const overall = data.totalLimitCents > 0 ? data.totalSpentCents / data.totalLimitCents : 0;
  const currentMonthIndex = data.months.findIndex((item) => item.key === data.month);
  const previousMonth = currentMonthIndex > 0 ? data.months[currentMonthIndex - 1] : null;
  const nextMonth =
    currentMonthIndex >= 0 && currentMonthIndex < data.months.length - 1
      ? data.months[currentMonthIndex + 1]
      : null;

  return (
    <div>
      <PageHeader
        eyebrow="Budgets"
        title="Give every dollar a job."
        description="Set monthly limits for the categories that matter. Spending is matched to your imported transactions in real time."
        actions={
          <Link href="/import" className="btn-primary">
            <Upload size={15} /> Import statement
          </Link>
        }
      />

      <section className="card mb-4 p-4 sm:p-5">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label htmlFor="budget-month" className="label">
              Month
            </label>
            <div className="flex items-center gap-2">
              {previousMonth ? (
                <Link
                  href={`/budgets?month=${previousMonth.key}`}
                  className="btn-icon"
                  aria-label="Previous month"
                >
                  ←
                </Link>
              ) : (
                <span className="btn-icon pointer-events-none opacity-30" aria-hidden>
                  ←
                </span>
              )}
              <select
                id="budget-month"
                name="month"
                defaultValue={data.month}
                className="input min-w-[170px]"
              >
                {data.months.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              {nextMonth ? (
                <Link
                  href={`/budgets?month=${nextMonth.key}`}
                  className="btn-icon"
                  aria-label="Next month"
                >
                  →
                </Link>
              ) : (
                <span className="btn-icon pointer-events-none opacity-30" aria-hidden>
                  →
                </span>
              )}
              <button type="submit" className="btn-secondary">
                Show
              </button>
            </div>
          </div>
          <p className="max-w-sm text-[11px] leading-relaxed text-muted">
            Budgets only count spending categories. Transfers, credit-card payments,
            and income are left out so the numbers stay honest.
          </p>
        </form>
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card bg-forest p-5 text-paper">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-paper/50">
            Budgeted
          </p>
          <p className="tabular font-display mt-3 text-[28px] leading-none">
            {formatMoney(data.totalLimitCents)}
          </p>
          <p className="mt-2 text-[10px] text-paper/50">
            {data.budgets.length} {data.budgets.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Spent against budgets
          </p>
          <p className="tabular font-display mt-3 text-[28px] leading-none text-ink">
            {formatMoney(data.totalSpentCents)}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee9de]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, overall * 100)}%`,
                background: overall > 1 ? "#ad3b2b" : overall >= 0.8 ? "#c2913a" : "#1c5a42",
              }}
            />
          </div>
          <p className="mt-2 text-[10px] text-muted">
            {formatPercent(overall * 100)} of the plan used
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {remaining >= 0 ? "Left to spend" : "Over plan"}
          </p>
          <p
            className={`tabular font-display mt-3 text-[28px] leading-none ${
              remaining >= 0 ? "text-ink" : "text-danger"
            }`}
          >
            {formatMoney(Math.abs(remaining))}
          </p>
          <p className="mt-2 text-[10px] text-muted">
            {formatMoney(data.spentAcrossAllCategories)} spent across all spending
            categories
          </p>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[20px] text-ink">Monthly limits</h2>
              <p className="mt-1 text-[12px] text-muted">
                {data.budgets.length === 0
                  ? "Add your first category budget below."
                  : "Green is comfortable, gold is close, red is over."}
              </p>
            </div>
            <span className="pill-green">{data.month}</span>
          </div>
          <BudgetManager
            budgets={data.budgets}
            availableCategories={availableCategories}
          />
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Unbudgeted spending
                </h2>
                <p className="mt-1 text-[11px] text-muted">This month.</p>
              </div>
              <span className="pill">{data.unbudgetedTotals.length}</span>
            </div>
            {data.unbudgetedTotals.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
                <Target size={17} className="mx-auto text-faint" />
                <p className="mt-2 text-[12px] font-medium text-ink">
                  Everything is budgeted
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Or there hasn&apos;t been spending outside your limits yet.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-row">
                {data.unbudgetedTotals.slice(0, 8).map((item) => (
                  <li key={item.category} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 items-center gap-2 text-[12px] text-ink">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: categoryColor(item.category) }}
                      />
                      <span className="truncate">{categoryLabel(item.category)}</span>
                    </span>
                    <span className="tabular text-[12px] font-medium text-ink">
                      {formatMoney(item.amountCents, { whole: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/transactions?month=${data.month}`}
              className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
            >
              Review transactions <ArrowRight size={11} />
            </Link>
          </section>

          <section className="rounded-2xl border border-line bg-surface-raised px-4 py-4">
            <p className="text-[11px] font-semibold text-ink">A budget is a guardrail</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Set limits you can live with, not limits that make you feel bad. The
              goal is fewer surprises at the end of the month.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {BUDGETABLE_CATEGORIES.slice(0, 6).map((category) => (
                <span key={category.id} className="pill px-2 py-0.5 text-[9px]">
                  {category.label}
                </span>
              ))}
              <span className="pill px-2 py-0.5 text-[9px]">+ more</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
