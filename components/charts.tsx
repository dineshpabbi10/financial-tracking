import { categoryColor, categoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/money";

export function CategoryDonut({
  items,
  totalCents,
}: {
  items: Array<{ category: string; amountCents: number }>;
  totalCents: number;
}) {
  const positive = items
    .filter((item) => item.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);
  const top = positive.slice(0, 5);
  const rest = positive.slice(5).reduce((sum, item) => sum + item.amountCents, 0);
  const segments: Array<{ category: string; amountCents: number; isRest?: boolean }> = [
    ...top,
    ...(rest > 0 ? [{ category: "other", amountCents: rest, isRest: true }] : []),
  ];
  const total = segments.reduce((sum, item) => sum + item.amountCents, 0) || totalCents;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Spending by category">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#eee9de" strokeWidth="15" />
          <g transform="rotate(-90 75 75)">
            {segments.map((segment, index) => {
              const length = total > 0 ? (segment.amountCents / total) * circumference : 0;
              const dash = Math.max(0, length - (segments.length > 1 ? 2.5 : 0));
              const element = (
                <circle
                  key={`${segment.category}-${index}`}
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="none"
                  stroke={categoryColor(segment.category)}
                  strokeWidth="15"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>
                    {segment.isRest ? "Other" : categoryLabel(segment.category)}:{" "}
                    {formatMoney(segment.amountCents, { whole: true })}
                  </title>
                </circle>
              );
              offset += length;
              return element;
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Spent
          </span>
          <span className="tabular font-display text-[23px] leading-tight text-ink">
            {formatMoney(totalCents, { whole: true })}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2.5">
        {segments.map((segment, index) => {
          const percent = total > 0 ? Math.round((segment.amountCents / total) * 100) : 0;
          return (
            <li key={`${segment.category}-${index}`} className="flex items-center gap-2.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: categoryColor(segment.category) }}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                {segment.isRest ? "Everything else" : categoryLabel(segment.category)}
              </span>
              <span className="tabular text-[12px] font-medium text-ink">
                {formatMoney(segment.amountCents, { whole: true })}
              </span>
              <span className="tabular w-8 text-right text-[10px] text-faint">{percent}%</span>
            </li>
          );
        })}
        {segments.length === 0 && (
          <li className="text-[12px] text-muted">No posted spending this month yet.</li>
        )}
      </ul>
    </div>
  );
}

export function CashflowBars({
  items,
}: {
  items: Array<{ label: string; spendCents: number; incomeCents: number }>;
}) {
  const max = Math.max(
    1,
    ...items.flatMap((item) => [item.spendCents, item.incomeCents]),
  );
  const gridLabels = [1, 0.5, 0];
  const maxWhole = formatMoney(max, { whole: true });

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-[11px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-forest-mid" /> Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gold" /> Spending
        </span>
        <span className="ml-auto text-faint">max {maxWhole}</span>
      </div>
      <div className="relative flex gap-3">
        <div className="tabular flex h-40 w-10 shrink-0 flex-col justify-between pb-6 text-right text-[9px] text-faint">
          {gridLabels.map((value) => (
            <span key={value}>
              {formatMoney(max * value, { whole: true })}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32">
            {gridLabels.map((value) => (
              <span
                key={value}
                className="absolute inset-x-0 border-t border-dashed border-line"
                style={{ top: `${(1 - value) * 100}%` }}
              />
            ))}
          </div>
          <div className="relative flex h-40 items-end gap-1.5">
            {items.map((item) => {
              const incomeHeight = Math.max(
                item.incomeCents > 0 ? 2 : 0,
                (item.incomeCents / max) * 128,
              );
              const spendHeight = Math.max(
                item.spendCents > 0 ? 2 : 0,
                (item.spendCents / max) * 128,
              );
              return (
                <div
                  key={item.label}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={`${item.label}: income ${formatMoney(
                    item.incomeCents,
                    { whole: true },
                  )}, spending ${formatMoney(item.spendCents, { whole: true })}`}
                >
                  <div className="flex items-end justify-center gap-[3px]">
                    <div
                      className="w-1/2 max-w-[15px] rounded-t-[3px] bg-forest-mid/85"
                      style={{ height: `${incomeHeight}px` }}
                      title={`Income ${formatMoney(item.incomeCents, { whole: true })}`}
                    />
                    <div
                      className="w-1/2 max-w-[15px] rounded-t-[3px] bg-gold"
                      style={{ height: `${spendHeight}px` }}
                      title={`Spending ${formatMoney(item.spendCents, { whole: true })}`}
                    />
                  </div>
                  <span className="mt-2 truncate text-center text-[10px] font-medium text-muted">
                    {item.label.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
