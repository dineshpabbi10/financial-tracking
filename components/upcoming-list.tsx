import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categoryLabel } from "@/lib/categories";
import { formatMonth, formatDateShort, relativeDateLabel, shortMonth } from "@/lib/dates";
import { formatAmount } from "@/lib/money";

export interface UpcomingEventView {
  seriesId: string;
  merchantName: string;
  category: string;
  cadence: string;
  date: Date;
  amountCents: number;
}

export function UpcomingList({
  events,
  emptyText = "Nothing due in the next 30 days.",
  showViewAll = false,
}: {
  events: UpcomingEventView[];
  emptyText?: string;
  showViewAll?: boolean;
}) {
  return (
    <div>
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-5 py-7 text-center">
          <p className="text-[13px] text-muted">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-row">
          {events.map((event, index) => (
            <li key={`${event.seriesId}-${event.date.toISOString()}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface-raised leading-none">
                <span className="text-[13px] font-semibold text-ink">
                  {event.date.getUTCDate()}
                </span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">
                  {shortMonth(event.date)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{event.merchantName}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {categoryLabel(event.category)} · {relativeDateLabel(event.date)}
                </p>
              </div>
              <span className="tabular shrink-0 text-[13px] font-semibold text-ink">
                {formatAmount(event.amountCents, { whole: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {showViewAll && events.length > 0 && (
        <Link
          href="/recurring"
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-forest hover:underline"
        >
          See the full forecast <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

export function UpcomingDateLabel({ date }: { date: Date }) {
  return (
    <span className="text-[11px] text-muted">
      {formatDateShort(date)} · {formatMonth(date)}
    </span>
  );
}
