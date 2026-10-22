import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  RefreshCw,
  Upload,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RefreshRecurringButton } from "@/components/refresh-recurring-button";
import { RecurringHideButton } from "@/components/recurring-hide-button";
import { UpcomingList } from "@/components/upcoming-list";
import { getRecurringOverview } from "@/lib/analytics";
import { categoryColor, categoryLabel } from "@/lib/categories";
import { formatDate, formatDateShort, relativeDateLabel } from "@/lib/dates";
import { formatAmount, formatMoney } from "@/lib/money";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export default async function RecurringPage() {
  const data = await getRecurringOverview();
  const active = data.series.filter((series) => !series.isDismissed);
  const dismissed = data.series.filter((series) => series.isDismissed);
  const income = active.filter((series) => series.direction === "income");

  return (
    <div>
      <PageHeader
        eyebrow="Recurring"
        title="What's coming next."
        description="Loonie detects repeating merchants and projects them forward. The more statements you import, the sharper the forecast."
        actions={
          <>
            <RefreshRecurringButton />
            <Link href="/import" className="btn-primary">
              <Upload size={15} /> Import statement
            </Link>
          </>
        }
      />

      {data.series.length === 0 ? (
        <section className="card px-6 py-16 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-forest-soft text-forest">
            <RefreshCw size={20} />
          </span>
          <h2 className="mt-4 font-display text-[24px] text-ink">
            Nothing repeating yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">
            Import two or three months of statements and Loonie will start
            spotting rent, subscriptions, insurance, transit passes, and payroll.
            You can hide anything it gets wrong.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/import" className="btn-primary">
              <Upload size={14} /> Import a statement
            </Link>
            <RefreshRecurringButton />
          </div>
        </section>
      ) : (
        <>
          <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card bg-forest p-5 text-paper">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-paper/50">
                  Recurring bills
                </p>
                <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-gold">
                  <CalendarClock size={16} />
                </span>
              </div>
              <p className="tabular font-display mt-3 text-[28px] leading-none">
                {formatMoney(data.estimatedMonthlyCents)}
              </p>
              <p className="mt-2 text-[10px] text-paper/50">
                estimated per month · {data.expenses.length}{" "}
                {data.expenses.length === 1 ? "bill" : "bills"}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Due in 30 days
              </p>
              <p className="tabular font-display mt-3 text-[28px] leading-none text-ink">
                {formatMoney(data.next30TotalCents)}
              </p>
              <p className="mt-2 text-[10px] text-muted">
                Through {formatDate(data.windowEnd)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Next payday
              </p>
              <p className="tabular font-display mt-3 text-[28px] leading-none text-ink">
                {data.nextIncome
                  ? formatMoney(data.nextIncome.amountCents)
                  : "—"}
              </p>
              <p className="mt-2 text-[10px] text-muted">
                {data.nextIncome
                  ? `${relativeDateLabel(data.nextIncome.date)} · ${formatDateShort(data.nextIncome.date)}`
                  : "No recurring income detected"}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Income in 30 days
              </p>
              <p className="tabular font-display mt-3 text-[28px] leading-none text-ink">
                {formatMoney(data.income30Total)}
              </p>
              <p className="mt-2 text-[10px] text-muted">
                {income.length} recurring {income.length === 1 ? "source" : "sources"}
              </p>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="card p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-[20px] text-ink">
                    Detected series
                  </h2>
                  <p className="mt-1 text-[12px] text-muted">
                    Repeating charges and deposits from your imported history.
                  </p>
                </div>
                <span className="pill-green">{active.length} active</span>
              </div>

              <SeriesGroup title="Bills & subscriptions" series={data.expenses} />
              {income.length > 0 && (
                <div className="mt-6">
                  <p className="section-title mb-1">Income</p>
                  <SeriesGroup title="" series={income} />
                </div>
              )}

              {dismissed.length > 0 && (
                <details className="mt-6 border-t border-line pt-4">
                  <summary className="cursor-pointer text-[11px] font-semibold text-muted hover:text-ink">
                    Hidden series ({dismissed.length})
                  </summary>
                  <ul className="mt-3 divide-row">
                    {dismissed.map((series) => (
                      <li
                        key={series.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0 truncate text-[12px] text-muted">
                          {series.merchantName}
                        </span>
                        <RecurringHideButton id={series.id} dismissed />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>

            <aside className="space-y-4">
              <section className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[19px] text-ink">
                      Next 30 days
                    </h2>
                    <p className="mt-1 text-[11px] text-muted">
                      Expected charges.
                    </p>
                  </div>
                  <span className="pill-gold">
                    {formatMoney(data.next30TotalCents, { whole: true })}
                  </span>
                </div>
                <UpcomingList events={data.events} emptyText="Nothing predicted in the next 30 days." />
              </section>

              <section className="rounded-2xl border border-gold/25 bg-gold-soft/50 p-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[#7a5718]">
                    <Wallet size={15} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-[#6d4f18]">
                      Next payday
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#8a6a2a]">
                      {data.nextIncome
                        ? `${data.nextIncome.merchantName} · ${formatDate(data.nextIncome.date)} · ${formatMoney(data.nextIncome.amountCents)}`
                        : "Import a few months of statements with payroll deposits to see this here."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="card p-5">
                <p className="text-[11px] font-semibold text-ink">How detection works</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Loonie groups similar merchants, looks for consistent timing, and
                  checks that amounts stay in a stable range. Three occurrences
                  build a series; more history raises confidence.
                </p>
                <Link
                  href="/transactions"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
                >
                  Review the source transactions <ArrowRight size={11} />
                </Link>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function SeriesGroup({
  title,
  series,
}: {
  title: string;
  series: Array<{
    id: string;
    merchantName: string;
    category: string;
    cadence: string;
    averageAmountCents: number;
    lastAmountCents: number;
    lastDate: Date;
    nextExpectedDate: Date;
    confidence: number;
    transactionCount: number;
  }>;
}) {
  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[11px] text-muted">
        Nothing here yet.
      </div>
    );
  }
  return (
    <>
      {title && <p className="section-title mb-1.5">{title}</p>}
      <ul className="divide-row">
        {series.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 py-3.5 first:pt-2 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                style={{ background: categoryColor(item.category) }}
                aria-hidden
              >
                {item.merchantName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">
                  {item.merchantName}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted">
                  {CADENCE_LABEL[item.cadence] ?? item.cadence} ·{" "}
                  {categoryLabel(item.category)} · {item.transactionCount} charges
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 pl-12 sm:justify-end sm:pl-0">
              <div className="text-left sm:text-right">
                <p className="tabular text-[13px] font-semibold text-ink">
                  {formatAmount(item.averageAmountCents)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  next {formatDateShort(item.nextExpectedDate)} ·{" "}
                  {relativeDateLabel(item.nextExpectedDate)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`pill px-2 py-0.5 text-[9px] ${
                    item.confidence >= 0.7
                      ? "border-transparent bg-forest-soft text-forest"
                      : "border-transparent bg-gold-soft text-[#7a5718]"
                  }`}
                >
                  {Math.round(item.confidence * 100)}%
                </span>
                <RecurringHideButton id={item.id} dismissed={false} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
