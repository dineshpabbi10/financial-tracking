import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Landmark,
  Scale,
  Search,
  SlidersHorizontal,
  Tag,
  Upload,
} from "lucide-react";
import { CategoryDonut, CashflowBars } from "@/components/charts";
import { CategorySelect } from "@/components/category-select";
import { PageHeader } from "@/components/page-header";
import { getTransactionPage } from "@/lib/analytics";
import { CATEGORY_LIST, categoryColor, categoryLabel } from "@/lib/categories";
import {
  formatDate,
  formatMonth,
  lastNMonths,
  monthKeyToDate,
  today,
} from "@/lib/dates";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/money";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const q = first(raw.q);
  const accountId = first(raw.accountId);
  const category = first(raw.category);
  const month = first(raw.month);
  const page = Math.max(1, Number(first(raw.page)) || 1);

  const data = await getTransactionPage({
    q,
    accountId,
    category,
    month,
    page,
  });
  const months = lastNMonths(12, today());
  const hasFilters = Boolean(q || accountId || category || month);
  const analytics = data.analytics;
  const topCategory = analytics.categories[0] ?? null;
  const topCategoryShare =
    topCategory && analytics.spendCents > 0
      ? topCategory.amountCents / analytics.spendCents
      : 0;
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? formatMonth(monthKeyToDate(month))
    : "";
  const scopeLabel = selectedMonth || (hasFilters ? "Matching filters" : "All time");

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const values = { q, accountId, category, month, page, ...overrides };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    return query ? `/transactions?${query}` : "/transactions";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Transactions"
        description="Everything imported from your statements. Fix a category and budgets and totals update immediately."
        actions={
          <Link href="/import" className="btn-primary">
            <Upload size={15} /> Import statement
          </Link>
        }
      />

      <form
        method="get"
        className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:min-w-[220px]">
          <label htmlFor="q" className="label">
            Search
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Merchant or description"
              className="input pl-9"
            />
          </div>
        </div>
        <div className="min-w-0 sm:w-[170px]">
          <label htmlFor="accountId" className="label">
            Account
          </label>
          <select id="accountId" name="accountId" defaultValue={accountId} className="input">
            <option value="">All accounts</option>
            {data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.mask ? ` ···${account.mask}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:w-[170px]">
          <label htmlFor="category" className="label">
            Category
          </label>
          <select id="category" name="category" defaultValue={category} className="input">
            <option value="">All categories</option>
            {CATEGORY_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:w-[150px]">
          <label htmlFor="month" className="label">
            Month
          </label>
          <select id="month" name="month" defaultValue={month} className="input">
            <option value="">All time</option>
            {months.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-secondary">
            <SlidersHorizontal size={14} /> Apply
          </button>
          {hasFilters && (
            <Link href="/transactions" className="btn-ghost">
              Reset
            </Link>
          )}
        </div>
      </form>

      <section aria-labelledby="transaction-analytics" className="mb-5">
        <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="transaction-analytics"
              className="font-display text-[20px] text-ink"
            >
              At a glance
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              {hasFilters
                ? "Based on every transaction matching the filters above, not just this page."
                : "Based on every transaction, not just this page."}
            </p>
          </div>
          <span className="pill-green">{scopeLabel}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AnalyticsCard
            label="Total spend"
            value={formatMoney(analytics.spendCents)}
            icon={<ArrowUpRight size={17} />}
            tone="forest"
            sub={
              <span className="text-paper/60">
                {analytics.spendCount.toLocaleString("en-CA")}{" "}
                {analytics.spendCount === 1
                  ? "spending transaction"
                  : "spending transactions"}
              </span>
            }
          />
          <AnalyticsCard
            label="Income"
            value={formatMoney(analytics.incomeCents)}
            icon={<ArrowDownLeft size={17} />}
            sub={
              <span className="text-muted">
                {analytics.incomeCount.toLocaleString("en-CA")}{" "}
                {analytics.incomeCount === 1
                  ? "income transaction"
                  : "income transactions"}
              </span>
            }
          />
          <AnalyticsCard
            label="Net"
            value={formatMoney(analytics.netCents)}
            icon={<Scale size={17} />}
            sub={
              <span
                className={analytics.netCents < 0 ? "text-danger" : "text-muted"}
              >
                {analytics.netCents < 0
                  ? "Spending exceeds income"
                  : analytics.netCents > 0
                    ? "Income covers spending"
                    : "Income and spending are even"}
              </span>
            }
          />
          <AnalyticsCard
            label="Top category"
            value={topCategory ? formatMoney(topCategory.amountCents) : "—"}
            icon={<Tag size={17} />}
            sub={
              topCategory ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: categoryColor(topCategory.category) }}
                  />
                  {categoryLabel(topCategory.category)} ·{" "}
                  {formatPercent(topCategoryShare * 100, 0)} of spend
                </span>
              ) : (
                <span className="text-muted">No spending in this view</span>
              )
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-[20px] text-ink">By month</h3>
                <p className="mt-1 text-[12px] text-muted">
                  Spending and income in this view.
                  {analytics.monthlyTruncated
                    ? " Showing the latest 12 months."
                    : ""}
                </p>
              </div>
              {analytics.monthly.length > 0 && (
                <span className="pill">
                  {analytics.monthly.length}{" "}
                  {analytics.monthly.length === 1 ? "month" : "months"}
                </span>
              )}
            </div>
            {analytics.monthly.length > 0 ? (
              <CashflowBars
                items={analytics.monthly.map((month) => ({
                  label: month.label,
                  spendCents: month.spendCents,
                  incomeCents: month.incomeCents,
                }))}
              />
            ) : (
              <AnalyticsEmpty>
                No income or spending in this view.
              </AnalyticsEmpty>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-[20px] text-ink">
                  By category
                </h3>
                <p className="mt-1 text-[12px] text-muted">
                  Where the spending went.
                </p>
              </div>
              {analytics.categories.length > 0 && (
                <span className="pill">
                  {analytics.categories.length}{" "}
                  {analytics.categories.length === 1 ? "category" : "categories"}
                </span>
              )}
            </div>
            {analytics.categories.length > 0 ? (
              <CategoryDonut
                items={analytics.categories}
                totalCents={Math.max(0, analytics.spendCents)}
              />
            ) : (
              <AnalyticsEmpty>No spending in this view.</AnalyticsEmpty>
            )}
          </section>
        </div>

        <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">
          Transfers are excluded from spending and income. Pending transactions
          are included so these totals match the list.
          {analytics.pendingCount > 0
            ? ` ${analytics.pendingCount.toLocaleString("en-CA")} pending in this view.`
            : ""}
        </p>
      </section>

      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="text-[12px] font-medium text-muted">
          {data.total.toLocaleString("en-CA")}{" "}
          {data.total === 1 ? "transaction" : "transactions"}
          {hasFilters ? " matching" : ""}
        </p>
        <p className="text-[11px] text-faint">
          Page {data.page} of {data.totalPages}
        </p>
      </div>

      <section className="card overflow-hidden">
        {data.transactions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised text-faint">
              <ArrowUpRight size={20} />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {hasFilters ? "No transactions match those filters" : "No transactions yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
              {hasFilters
                ? "Try a broader search, or clear the filters to see everything."
                : "Upload a CSV, OFX/QFX, or PDF statement from online banking to get started."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {hasFilters ? (
                <Link href="/transactions" className="btn-secondary">
                  Clear filters
                </Link>
              ) : (
                <Link href="/import" className="btn-primary">
                  <Upload size={14} /> Import a statement
                </Link>
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-row">
            {data.transactions.map((tx) => {
              const isCredit = tx.account.type === "credit";
              return (
                <li
                  key={tx.id}
                  className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-surface-raised/60 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised text-muted"
                      aria-hidden
                    >
                      {isCredit ? <CreditCard size={15} /> : <Landmark size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {tx.merchantName ?? tx.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {formatDate(tx.date)} · {tx.account.name}
                        {tx.account.mask ? ` ···${tx.account.mask}` : ""}
                        {tx.pending ? " · pending" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 pl-12 sm:justify-end sm:pl-0">
                    <CategorySelect
                      transactionId={tx.id}
                      category={tx.category}
                      categoryOverride={tx.categoryOverride}
                    />
                    <span
                      className={`tabular min-w-[88px] text-right text-[13px] font-semibold ${
                        tx.amountCents > 0 ? "text-ink" : "text-forest"
                      }`}
                    >
                      {formatSignedMoney(tx.amountCents)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <Link
            href={buildHref({ page: Math.max(1, data.page - 1) })}
            aria-disabled={data.page === 1}
            className={`btn-secondary ${data.page === 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            <ArrowLeft size={14} /> Previous
          </Link>
          <span className="text-[11px] text-muted">
            {data.page} / {data.totalPages}
          </span>
          <Link
            href={buildHref({ page: Math.min(data.totalPages, data.page + 1) })}
            aria-disabled={data.page === data.totalPages}
            className={`btn-secondary ${
              data.page === data.totalPages ? "pointer-events-none opacity-40" : ""
            }`}
          >
            Next <ArrowRight size={14} />
          </Link>
        </nav>
      )}

      <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
        Categories are a best guess from the merchant description. Use the dropdown
        to override one — budgets and totals update immediately.
      </p>
    </div>
  );
}

function AnalyticsCard({
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
  tone?: "plain" | "forest";
}) {
  const shell =
    tone === "forest"
      ? "border-transparent bg-forest text-paper"
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
      <div className="mt-2 min-h-3 text-[10px] leading-relaxed">{sub}</div>
    </div>
  );
}

function AnalyticsEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[190px] items-center justify-center rounded-xl border border-dashed border-line-strong px-5 py-8 text-center text-[12px] text-muted">
      {children}
    </div>
  );
}
