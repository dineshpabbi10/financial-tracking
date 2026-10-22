import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Landmark,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { DemoDataActions } from "@/components/demo-data-actions";
import { PageHeader } from "@/components/page-header";
import { PlaidConnections } from "@/components/plaid-connections";
import { getPlaidOverview } from "@/lib/plaid/overview";

export default async function ConnectionsPage() {
  const overview = await getPlaidOverview();

  return (
    <div>
      <PageHeader
        eyebrow="Connections"
        title="Your banks, in sync."
        description="Connect Canadian accounts with Plaid, then sync balances and transactions whenever you need. Statement imports remain available for accounts you track by hand."
        actions={
          <>
            <Link href="/import" className="btn-secondary">
              <Landmark size={15} /> Import a statement
            </Link>
            <Link href="/accounts" className="btn-ghost">
              Accounts <ArrowRight size={13} />
            </Link>
          </>
        }
      />

      {overview.demo && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gold/25 bg-gold-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-[#6d4f18]">
            <span className="font-semibold">Demo accounts are active.</span>{" "}
            Clear them before connecting a real bank.
          </p>
          <DemoDataActions hasDemo compact />
        </div>
      )}

      <PlaidConnections
        configured={overview.configured}
        env={overview.env}
        maxItems={overview.maxItems}
        demo={overview.demo}
        items={overview.items}
      />

      {overview.configured && !overview.redirectConfigured && (
        <section className="mt-4 rounded-2xl border border-line bg-surface-raised p-5">
          <p className="text-[13px] font-semibold text-ink">
            OAuth redirect is optional
          </p>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">
            Plaid does not currently use OAuth for Canadian institutions, so
            connecting Canadian banks works without a redirect URI. If Plaid
            enables OAuth for a bank later, or you use a mobile webview, set{" "}
            <code>PLAID_REDIRECT_URI</code> to{" "}
            <code>https://your-domain/connections</code> and add the same URL to
            Plaid&apos;s allowed redirect URIs.
          </p>
        </section>
      )}

      {overview.configured && !overview.webhookConfigured && (
        <section className="mt-4 rounded-2xl border border-line bg-surface-raised p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-muted">
              <Webhook size={16} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink">
                Automatic updates are off
              </p>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">
                Sync now works on demand. For automatic transaction updates, set{" "}
                <code>PLAID_WEBHOOK_URL</code> to{" "}
                <code>https://your-domain/api/plaid/webhook</code> and restart
                Loonie. Plaid will notify the app when new transactions are ready.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card bg-surface-raised p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-forest" />
            <h2 className="text-[13px] font-semibold text-ink">
              What Plaid can see
            </h2>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Loonie sends Plaid your bank selection and account data requests. Your
            bank password is entered in Plaid&apos;s Link window, not Loonie. Plaid
            returns account names, masks, balances, and transactions. Loonie never
            receives or stores your banking credentials.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Plaid access tokens are encrypted with AES-256-GCM before they are
            written to the local database. Disconnecting a bank removes the local
            token and asks Plaid to revoke the Item. Synced accounts and
            transactions stay available as manual accounts.
          </p>
          <a
            href="https://plaid.com/legal/#end-user-privacy-policy"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-forest hover:underline"
          >
            Plaid end-user privacy policy <ExternalLink size={10} />
          </a>
        </div>

        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-ink">Production setup</h2>
          <ol className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-muted">
            <li>
              <span className="font-semibold text-ink">1.</span> Create a Plaid
              production app and request Transactions access for Canada.
            </li>
            <li>
              <span className="font-semibold text-ink">2.</span> Add the three
              required environment variables to <code>.env</code>.
            </li>
            <li>
              <span className="font-semibold text-ink">3.</span> Optionally add
              the OAuth redirect URI; add the webhook URL if you want automatic
              updates.
            </li>
            <li>
              <span className="font-semibold text-ink">4.</span> Restart Loonie,
              connect a bank, and run the first sync.
            </li>
          </ol>
          <p className="mt-3 border-t border-line pt-3 text-[10px] leading-relaxed text-faint">
            The connection guard defaults to 10 Items to match Plaid&apos;s free
            tier. Adjust <code>PLAID_MAX_ITEMS</code> only if your plan allows it.
          </p>
        </div>
      </section>
    </div>
  );
}
