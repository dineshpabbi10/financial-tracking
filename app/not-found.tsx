import Link from "next/link";
import { Wordmark } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
          404
        </p>
        <h1 className="mt-2 font-display text-[34px] leading-tight text-ink">
          That page isn&apos;t on the ledger.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The link may be old, or the page may have moved. Your accounts and
          transactions are still safe.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">
            Back to overview
          </Link>
          <Link href="/transactions" className="btn-secondary">
            Transactions
          </Link>
          <Link href="/import" className="btn-ghost">
            Import a statement
          </Link>
        </div>
      </div>
    </main>
  );
}
