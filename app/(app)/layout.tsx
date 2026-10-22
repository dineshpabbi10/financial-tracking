import Link from "next/link";
import { Settings, Upload } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  const [demoCount, accountCount] = await Promise.all([
    db.account.count({ where: { isDemo: true } }),
    db.account.count(),
  ]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-forest px-4 py-6 text-paper lg:flex">
        <Link href="/" className="px-2">
          <Wordmark light />
        </Link>
        <p className="mt-2 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-paper/40">
          Your money, in focus
        </p>

        <NavLinks variant="sidebar" />

        <div className="mt-auto space-y-4 pt-8">
          {demoCount > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
              <p className="text-[11px] font-semibold text-paper/85">Demo dataset</p>
              <p className="mt-1 text-[11px] leading-relaxed text-paper/45">
                Sample Canadian accounts and bills. Clear it anytime in Settings.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/10 px-1 pt-5">
            <Link
              href="/settings"
              className="flex items-center gap-2 text-xs font-medium text-paper/60 transition-colors hover:text-paper"
            >
              <Settings size={15} />
              Settings
            </Link>
            <SignOutButton iconOnly />
          </div>
          <p className="px-1 text-[10px] leading-relaxed text-paper/30">
            {accountCount} {accountCount === 1 ? "account" : "accounts"} · Stored
            locally
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-5">
            <Link href="/">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/import"
                className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-muted"
                aria-label="Import a statement"
              >
                <Upload size={16} />
              </Link>
              <Link
                href="/settings"
                className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-muted"
                aria-label="Settings"
              >
                <Settings size={17} />
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1180px] px-5 pb-28 pt-7 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      <NavLinks variant="bottom" />
    </div>
  );
}
