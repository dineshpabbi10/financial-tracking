import Link from "next/link";
import { CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-forest p-12 text-paper lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -right-40 -top-32 size-[540px] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(194,145,58,.45) 0%, rgba(194,145,58,0) 68%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 size-[420px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(255,253,248,.16) 0%, rgba(255,253,248,0) 70%)",
          }}
          aria-hidden
        />

        <div className="relative">
          <Wordmark light />
        </div>

        <div className="relative my-auto max-w-md py-16">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Canadian personal finance
          </p>
          <h1 className="font-display text-[46px] leading-[1.05] text-paper xl:text-[54px]">
            Know what&apos;s coming,
            <br />
            not just what went.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-paper/55">
            One calm place for your chequing, savings, and credit cards. See the
            bills before they land, and keep the month on your side.
          </p>

          <div className="mt-10 space-y-4">
            <Feature
              icon={<CalendarClock size={16} />}
              title="Upcoming, not hindsight"
              body="Recurring rent, subscriptions, and paydays projected ahead."
            />
            <Feature
              icon={<Sparkles size={16} />}
              title="Your spending, decoded"
              body="Canadian merchants categorized automatically. Fix anything in one tap."
            />
            <Feature
              icon={<ShieldCheck size={16} />}
              title="Private by design"
              body="You upload statements. Bank credentials never touch Loonie."
            />
          </div>
        </div>

        <p className="relative text-[11px] font-medium uppercase tracking-[0.16em] text-paper/30">
          Self-hosted · Single-user · Built for Canada
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col bg-paper">
        <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-[390px]">{children}</div>
        </div>
        <p className="px-6 pb-8 text-center text-[11px] text-faint lg:text-left">
          Loonie runs on your own server. There are no accounts, ads, or data
          brokers.
        </p>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-paper/15 bg-paper/5 text-gold">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-paper/90">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-paper/45">{body}</p>
      </div>
    </div>
  );
}
