# Loonie

A private, single-user, self-hosted personal finance PWA for Canadian bank
accounts. Connect a bank with Plaid for synced balances and transactions, or
import the statements you download from online banking. Either way, Loonie turns
the data into a calm view of spending, budgets, and upcoming bills.

Bank sync is optional. Plaid Link handles the bank login, so Loonie never sees
your online banking password. Plaid access tokens are encrypted before they are
stored. The app ships with a guardrail for Plaid's free tier of 10 connected
Items, and statement imports remain available for accounts you track by hand.

## Features

- **Plaid bank sync** — connect Canadian accounts with Plaid Link, auto-create
  local accounts, sync balances and transactions, and inspect connection health.
  Access tokens are encrypted with AES-256-GCM. The default guardrail is 10
  connected Items.
- **Statement imports** — CSV with editable column mapping, OFX/QFX with stable
  FITID duplicate detection, and best-effort PDF extraction with a required
  human review step. Plaid-linked accounts reject statement imports so the two
  sources cannot double-import.
- **Account overview** — chequing, savings, credit cards, investments, and loans,
  with Plaid-synced balances or manual/statement-driven balances.
- **Transactions** — search, account/category/month filters, editable
  categories, and pagination.
- **Budgets** — monthly limits for spending categories, with progress and
  unbudgeted-spending views.
- **Recurring & upcoming** — detects repeating bills and payroll, projects the
  next 30 days, and lets you hide false positives.
- **Dashboard** — net worth, monthly cash flow, spending by category, budget
  snapshots, and recent activity.
- **Import history & undo** — every committed import is recorded and can be
  reversed, including the account balance snapshot when that import was the
  latest one to update it.
- **Demo mode** — four realistic Canadian demo accounts and nine months of data,
  available before you add real accounts or connect a bank. Demo data cannot be
  combined with real accounts, imports, or Plaid connections.
- **Installable PWA** — offline app shell only. Authenticated pages and API
  responses are deliberately never cached.
- **Bank presets** — RBC, TD, Scotiabank, BMO, CIBC, American Express, and
  Desjardins hints for headers and date/amount conventions. You can always
  remap columns manually.

## Quick start

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first launch you will be
asked to create a passcode (minimum 8 characters). Then connect a bank from
**Connections**, add a manual account and import a statement, or load the demo
dataset from the dashboard/settings.

`npm install` runs `prisma generate` automatically. The default SQLite database
lives at `prisma/dev.db` and is ignored by git.

### Demo data

The dashboard and Settings offer four fictional Canadian accounts with nine
months of transactions. Demo data is for exploring before you add your own
accounts: the app will ask you to clear it before adding an account, importing a
statement, or connecting a Plaid bank. Clearing the demo removes its accounts, transactions,
import history, and any budgets the demo created; your own budgets are left
alone. The demo never needs a second database, but you can also run it against a
separate `DATABASE_URL` if you prefer.

### Environment variables

```dotenv
DATABASE_URL="file:./dev.db"
APP_TIMEZONE="America/Toronto"

# Optional Plaid bank sync
PLAID_CLIENT_ID=""
PLAID_SECRET=""
PLAID_ENV="production"
PLAID_TOKEN_ENCRYPTION_KEY=""
PLAID_REDIRECT_URI="https://loonie.example.com/connections"
PLAID_WEBHOOK_URL="https://loonie.example.com/api/plaid/webhook"
PLAID_MAX_ITEMS="10"
```

- `DATABASE_URL` — SQLite path by default. Prisma resolves `file:./dev.db`
  relative to `prisma/schema.prisma`.
- `APP_TIMEZONE` — IANA timezone used for "today", month boundaries, and
  recurring projections. Set this to your own timezone, e.g.
  `America/Vancouver` or `America/Halifax`.
- `PLAID_ENV` — `production` or `sandbox`. Plaid's current Node SDK maps only
  those two environments.
- `PLAID_REDIRECT_URI` — optional. Plaid does not currently use OAuth for
  Canadian institutions, so it is not needed for normal Canadian connections.
  If OAuth is enabled for a bank later, use a public HTTPS URL without query
  parameters and allowlist it in the Plaid dashboard. Use `/connections` on your
  Loonie host.
- `PLAID_WEBHOOK_URL` — optional. When set, Link tokens register it with Plaid
  and verified webhooks trigger transaction syncs automatically.
- `PLAID_MAX_ITEMS` — local guardrail matching your plan. Defaults to `10`.

## Plaid setup

Plaid bank sync is disabled until all three required values are present:
`PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_TOKEN_ENCRYPTION_KEY`. The app
keeps running normally without them; statement imports are unaffected.

1. Create a Plaid account and request production access for **Transactions** in
   **Canada**. Plaid's free tier allows up to 10 Items, which is the default
   `PLAID_MAX_ITEMS` guardrail here.
2. Generate an encryption key and keep it safe:

   ```bash
   openssl rand -base64 32
   ```

   Put the result in `PLAID_TOKEN_ENCRYPTION_KEY`. This key encrypts Plaid access
   tokens with AES-256-GCM. Do not put it in the database, commit it, or lose it.
   If it changes, existing connections cannot be decrypted and must be linked
   again.
3. Add `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV=production` to `.env`.
4. OAuth is not currently used by Canadian institutions. If Plaid enables it
   for one of your banks, set `PLAID_REDIRECT_URI` to
   `https://your-domain/connections` and add the exact URL to **Dashboard → Team
   → API → Allowed redirect URIs**. Production OAuth requires HTTPS.
5. For automatic updates, set `PLAID_WEBHOOK_URL` to
   `https://your-domain/api/plaid/webhook`. Loonie verifies Plaid's webhook JWT
   against Plaid's published verification key and checks the raw-body SHA-256
   before syncing. Without a webhook, use **Sync now** on Connections.
6. Restart the app, open **Connections**, and choose **Connect a bank**.

Plaid creates local accounts for the CAD accounts it returns. Account names and
types are editable; later syncs preserve your edits while updating balances and
transactions. Non-CAD accounts and transactions are skipped with a warning.
Disconnecting a bank asks Plaid to revoke the Item, removes the local encrypted
token, and leaves the synced accounts and transactions in Loonie as manual
accounts. Statement imports then become available for those accounts again.

This integration uses Plaid's `/transactions/sync` cursor API. Initial history
can arrive over several pages; if Plaid is still preparing a new Item, sync
again in a minute. The app does not implement Plaid Link update mode yet, so a
bank that requires re-authentication must be disconnected and linked again.

### If Link says the bank's MFA is unsupported

Plaid may return `MFA_NOT_SUPPORTED` or `ITEM_NOT_SUPPORTED` when the bank
requires a sign-in method that Plaid cannot automate. This is a bank/Plaid
limitation, not a Loonie error. Common cases are hardware keys, authenticator
apps, or a one-time code required on every login.

1. In the bank's online-banking security settings, enable a supported method
   such as SMS one-time codes and, if available, "remember this device".
2. Approve any pending sign-in request in the bank's mobile app, then retry Link.
3. If the error persists, use **Add a manual account** and import statements for
   that bank. The import path remains fully supported.
4. As the app owner, check Plaid Dashboard → Developers → Logs for the
   `request_id`, `link_session_id`, and exact Link error. Plaid Support can
   investigate an institution-specific MFA issue with those identifiers.

The Link error shown in Loonie also includes the Plaid error code and request ID
when available, which makes a support ticket easier.

### Useful commands

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # production server
npm run typecheck    # TypeScript only
npm test             # Vitest unit/integration tests
npm run db:push      # sync Prisma schema to the database
npm run db:studio    # inspect data locally (do not expose publicly)
```

## Statement formats

Money is stored as integer cents. Internally, **positive cents mean money out**
and **negative cents mean money in**. The import review table displays the
opposite sign (`−$84.23` for a purchase), which is what people expect to see.

### CSV

CSV is the most reliable import format. Upload the export, check the
auto-detected columns, adjust if needed, and import. Loonie saves the successful
column mapping on the account so the next import from that account is one step.
If the bank changes its layout, Loonie falls back to auto-detection and warns
you instead of failing.

Supported conventions include:

- One signed amount column (negative or positive outflows)
- Separate debit and credit columns
- `CR`/`DR` markers and parenthesized negatives
- Comma or period decimals, semicolon/tab delimiters, French headers
- YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and month-name dates

Auto-detection guesses ambiguous slash dates as month-first (Canadian default);
the mapping panel lets you change that.

### OFX / QFX

OFX and QFX files are parsed directly. Their FITID is used as the stable
transaction identity, so re-importing overlapping statements is safe. The ledger
balance, when present, can update the account balance after review.

### PDF

PDF extraction is intentionally **best-effort**. Loonie reads positioned text,
reconstructs lines, looks for dates plus trailing amounts, and then shows every
row in an editable review table. Layouts vary widely, even within one bank:

- Always verify dates, descriptions, and signs before importing.
- Use **Flip signs** if spending looks inverted.
- Delete summary lines or anything that is not a transaction.
- Add rows manually if a few transactions were missed.
- Prefer the CSV or OFX/QFX export when your bank offers it.

Password-protected PDFs can be opened by entering the statement password during
upload. Loonie never stores the password or the file.

### Sample files

The `samples/` directory contains fixtures used by the test suite:

- `rbc-chequing.csv`
- `td-chequing.csv`
- `amex-cobalt.csv`
- `rbc-chequing.ofx`
- `rbc-chequing-statement.pdf`

They contain fictional data and are safe to import while trying the app.

## Duplicate detection

Non-OFX rows are fingerprinted with SHA-256 using account, date, signed amount,
and normalized description. Fingerprints include an occurrence number. Plaid
transactions use a SHA-256 fingerprint of their Plaid transaction ID, so a
re-sync updates the same local row instead of duplicating it. As a result:

- Re-importing the same statement skips every row.
- Two genuinely identical purchases on the same day both import the first time.
- Import records can be undone from the import history, which removes exactly
  the transactions created by that batch. If that import was the latest one to
  set the account balance, undoing it restores the previous balance.
- Plaid transactions are idempotent across syncs. Plaid is the source of truth
  for linked accounts; statement imports are blocked for them.

OFX/QFX rows use the bank's FITID as their identity instead.

## Privacy and security

- **Bank sync is optional.** If you connect a bank, Plaid Link handles the login
  and Loonie never receives your online banking password. Plaid is a third-party
  data provider; its handling of your data is governed by Plaid's end-user
  privacy policy (`https://plaid.com/legal/#end-user-privacy-policy`).
- **Plaid tokens are encrypted.** Access tokens are encrypted with AES-256-GCM
  using `PLAID_TOKEN_ENCRYPTION_KEY` before storage. The key lives in the server
  environment, not the SQLite database. Disconnecting asks Plaid to revoke the
  Item. Access tokens are never returned to the browser or written to logs.
- **Files are not retained.** Statements are parsed in memory; only reviewed
  transactions and import metadata are written to the database.
- **Passcode hashing.** The passcode is stored as a salted scrypt hash in the
  `Setting` table. Session tokens are random 32-byte values stored hashed, with a
  thirty-day expiry.
- **Cookie protection.** Sessions are httpOnly, SameSite=Lax, and Secure in
  production (so production must be served over HTTPS).
- **CSRF guard.** Cookie-authenticated mutations reject a missing Origin and
  require any supplied Origin to match the Host.
- **Security headers.** `X-Content-Type-Options`, `X-Frame-Options: DENY`, a
  referrer policy, and a restrictive permissions policy are set in
  `next.config.ts`.
- **PWA cache boundaries.** The service worker caches only the offline page,
  manifest, icons, and hashed static assets. It never caches authenticated HTML
  or `/api/*` responses.
- **Single-user by design.** There are no sharing, roles, or multi-tenant
  concepts. Run one instance per person.

### Forgot passcode

If you lose the passcode, stop the server, back up the database, and remove the
passcode setting and any sessions:

```bash
sqlite3 prisma/dev.db \
  "delete from Setting where key = 'auth.passcode'; delete from Session;"
```

Then restart and visit `/setup` to create a new passcode. This does not touch
accounts or transactions. Treat database access as full access to the app.

## Backups

Everything lives in the SQLite database file (plus your `.env`).

Safe hot backup with the SQLite CLI:

```bash
sqlite3 prisma/dev.db ".backup 'loonie-backup-$(date +%F).db'"
```

If `sqlite3` is unavailable, stop the app and copy `prisma/dev.db` instead:

```bash
cp prisma/dev.db "loonie-backup-$(date +%F).db"
```

Restore by stopping the app, replacing `prisma/dev.db` with a backup, checking
file ownership/permissions, and starting the app again. Test restores
periodically; an untested backup is only a hope.

Keep backups outside the web root and restrict access. They contain your full
financial history, Plaid connection metadata, and the passcode hash. Back up
`PLAID_TOKEN_ENCRYPTION_KEY` separately with your secrets; a database backup
without the matching key cannot decrypt existing Plaid connections.

## Production

A minimal production run:

```bash
npm ci
npm run db:push
npm run build
NODE_ENV=production npm run start -- -H 127.0.0.1 -p 3000
```

Put it behind HTTPS with a reverse proxy. For example, Caddy:

```caddyfile
loonie.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Checklist:

- [ ] Serve over HTTPS. Secure session cookies require it in production.
- [ ] Set `APP_TIMEZONE` to your actual timezone.
- [ ] Use a long, unique passcode stored in a password manager.
- [ ] Configure Plaid credentials, optionally allowlist an OAuth redirect URI,
      and register the webhook URL if you want automatic updates.
- [ ] Back up `PLAID_TOKEN_ENCRYPTION_KEY` separately from the database.
- [ ] Keep `prisma/dev.db` on persistent storage and back it up on a schedule.
- [ ] Run the app as a non-root user with least privilege.
- [ ] Do not expose Prisma Studio, the database file, or `.env`.
- [ ] Restrict network access (home LAN, VPN, or authenticated proxy) if the app
      does not need to be public.
- [ ] Keep Node.js and npm dependencies updated; rebuild and re-run tests after
      upgrades.
- [ ] Test a restore before trusting the backup.

### Switching to Postgres

The schema is plain Prisma and has no SQLite-specific column types. For a fresh
production instance:

1. Change the datasource provider in `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Point `DATABASE_URL` at your database:

   ```dotenv
   DATABASE_URL="postgresql://loonie:password@localhost:5432/loonie?schema=public"
   ```

3. Generate the client and create the schema:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

For a long-lived deployment, move from `db push` to checked-in Prisma migrations
(`prisma migrate dev` locally, `prisma migrate deploy` in production) once the
schema stabilizes.

`db push` does **not** copy existing SQLite rows into Postgres. To carry data
over, migrate the tables explicitly (for example with `pgloader`, or export each
table to CSV/JSON and import it after the schema exists). Do this on a copy and
verify transaction counts, balances, categories, and import hashes before
cutting over.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

The suite covers date/amount parsing, CSV layouts, OFX/QFX, PDF line extraction
(including an end-to-end sample PDF), saved-mapping fallback, fingerprints and
occurrence-aware duplicate handling, recurring detection, text decoding, the
CSRF Origin check, and Plaid token encryption/account/amount/category mapping.

## Project layout

```text
app/                 Next.js App Router pages and API routes
components/          UI and client-side interactions
lib/import/          CSV, OFX, PDF parsers, bank presets, fingerprints, commit
lib/plaid/           Plaid client config, token crypto, mapping, sync, overview
lib/analytics.ts     Dashboard, transactions, budgets, accounts, import history
lib/recurring.ts     Pure recurring-series detection and projection
lib/auth.ts          Passcode, sessions, and route protection
prisma/schema.prisma Data model (accounts, transactions, batches, budgets)
public/              Manifest, service worker, icons
samples/             Fictional statement fixtures
```

## Known limitations

- PDF layouts are inherently variable. Some statements will need manual editing,
  and a few may extract poorly enough that CSV export is the better path.
- Bank CSV exports change. Remap columns when needed; saved mappings fall back to
  auto-detection rather than blocking the import.
- Recurring detection needs roughly three occurrences and works best with
  several months of history.
- The app is single-user. Do not run it as a shared multi-tenant service.
- Bank sync is limited to CAD accounts. Non-CAD accounts and transactions are
  skipped; there is no foreign-exchange conversion.
- Plaid production access and Canadian institution coverage depend on your
  Plaid account. OAuth is not currently used by Canadian institutions; if that
  changes, it requires a public HTTPS redirect URI and dashboard allowlisting.
  Webhook-driven sync requires a public HTTPS webhook URL.
- Without a webhook, transactions update only when you press **Sync now** or
  **Sync all**. There is no built-in cron scheduler.
- The app does not yet support Plaid Link update mode for re-authenticating an
  existing Item. Disconnect and reconnect the bank if Plaid reports that login
  is required.
- Connecting a bank auto-creates local accounts. If you previously tracked the
  same account manually, you may want to remove or ignore the manual copy before
  linking.
