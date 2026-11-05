# MYHUB

**Your Money. Your Goals. Your Life.**

MYHUB is a private, single-user-per-account web app for managing personal finances, planning your days and running your developer side projects. It is built for Kenya by default (KES, Africa/Nairobi, M-Pesa-style accounts), and the currency and timezone can be changed per user.

- **Money:** accounts, transactions and transfers, recurring entries, budgets with alerts and rollover, savings goals with an emergency fund, loans (borrowed and lent, with principal and interest kept separate), investments (manual prices), bills, subscriptions and net worth.
- **Planner:** calendar (month, week, day and agenda views, drag to reschedule) and tasks, with every bill, loan instalment, renewal and deadline shown on the calendar. In-app notifications.
- **Developer:** projects, backlog, kanban board, bookmarks, code snippets, learning tracker and developer goals.
- **Workspace:** markdown notes, a private document vault, reports with CSV export, and settings with an activity log.

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui-style components (Radix primitives), Lucide icons, Geist font |
| Database | PostgreSQL with Prisma ORM (migrations in `prisma/migrations`) |
| Auth | Auth.js (next-auth v5) credentials provider, bcrypt, JWT sessions |
| Validation | Zod (shared by forms and server), React Hook Form |
| Charts and UI | Recharts, FullCalendar 6, dnd-kit, react-markdown, prism-react-renderer, Sonner toasts |
| Money maths | `Prisma.Decimal` (decimal.js) on the server, `NUMERIC(14,2)` in the database |
| Tests | Vitest (calculation unit tests) |

---

## Quick start (local)

Requirements: Node.js 20 or newer, and PostgreSQL 14 or newer.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#    then set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)

# 3. Create the database schema
npx prisma migrate deploy        # or: npm run db:migrate:dev while developing

# 4. (Optional) load the demo account
npm run db:seed                  # creates demo@myhub.local / demo-password-123

# 5. Run
npm run dev                      # http://localhost:3000
```

Register your own account at `/register`. Each new account starts empty, with a default set of income and expense categories. Once you have your account, set `ALLOW_REGISTRATION=false` so nobody else can sign up.

### Demo data is kept separate

`npm run db:seed` only ever touches the user `demo@myhub.local`. It deletes and recreates that one user and its records, which are flagged `isDemo`, and never reads or changes any other account. The app shows a banner while you are signed in as the demo user. Its password can't be changed because the credentials are public. Don't run the seed on a production database you share with others unless you want that demo login to exist.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (pooled is fine). |
| `DATABASE_URL_UNPOOLED` | yes | Direct connection used for migrations. Neon's Vercel integration sets it; elsewhere use the same value as `DATABASE_URL`. |
| `AUTH_SECRET` | yes | Signs and encrypts session tokens. Generate with `openssl rand -base64 32`. |
| `AUTH_TRUST_HOST` | on most hosts | `true` when running behind Vercel, Docker or a reverse proxy. |
| `ALLOW_REGISTRATION` | no | `true` allows new sign-ups; anything else disables `/register`. |
| `SHOW_DEMO_HINT` | no | `true` shows the demo credentials on the sign-in page. |
| `CRON_SECRET` | recommended | At least 16 characters. Protects `/api/cron/run` (see Scheduled jobs). |
| `STORAGE_DRIVER` | no | `local`, `database` or `supabase`. Defaults to `database` on Vercel and `local` elsewhere. `database` keeps vault files in Postgres, so it needs no extra service. |
| `LOCAL_STORAGE_DIR` | no | Folder for vault files when using `local`. Default `./storage`. Needs a persistent disk. |
| `MAX_UPLOAD_MB` | no | Per-file upload limit. Default `10`, or `4` on Vercel, which rejects request bodies over 4.5 MB. |
| `SUPABASE_URL` | if `supabase` | Your Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | if `supabase` | Service-role key. Only read on the server; never prefix it with `NEXT_PUBLIC_`. |
| `SUPABASE_STORAGE_BUCKET` | no | Private bucket name. Default `myhub-documents`. |

No secret is ever sent to the browser. The app has no `NEXT_PUBLIC_*` variables.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests for money, date, loan, savings, subscription, investment and CSV calculations |
| `npm run check` | Typecheck, lint and tests together |
| `npm run db:migrate` | Apply migrations (production) |
| `npm run db:migrate:dev` | Create and apply migrations (development) |
| `npm run db:seed` | Recreate the demo account |
| `npm run db:studio` | Prisma Studio |

---

## Deployment

### Vercel with Neon (recommended)

1. Push the code to a GitHub repository.
2. In Vercel choose **Add New → Project**, import the repository and leave the framework as Next.js. Don't deploy yet.
3. In the project's **Storage** tab, add **Neon** (Serverless Postgres) and connect it to the project. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
4. In **Settings → Environment Variables** add `AUTH_SECRET` (run `openssl rand -base64 32`), `CRON_SECRET` (any random string of 16 or more characters) and `ALLOW_REGISTRATION=true`.
5. Deploy. The `vercel-build` script runs `prisma migrate deploy` before `next build`, so every deploy applies new migrations.
6. Open the site, register your own account, then set `ALLOW_REGISTRATION=false` and redeploy so nobody else can sign up.
7. Vault files are stored in Postgres by default on Vercel (`STORAGE_DRIVER=database`). To use Supabase Storage instead, set `STORAGE_DRIVER=supabase` with a **private** bucket and `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_STORAGE_BUCKET`.
8. `vercel.json` already schedules `/api/cron/run` daily at 04:00 UTC (07:00 in Nairobi). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. On a paid plan you can make it hourly (`0 * * * *`) for more timely reminders.

To try the demo account on a deployment, run the seed once against the production database from your machine: `DATABASE_URL=… DATABASE_URL_UNPOOLED=… npm run db:seed`. Leave it out if the site is only for you.

### A VPS or Docker host

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start          # listens on PORT (default 3000)
```

Put it behind HTTPS (Caddy, Nginx or a load balancer), set `AUTH_TRUST_HOST=true`, keep `LOCAL_STORAGE_DIR` on a persistent, backed-up volume, and add a cron entry:

```cron
0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/run > /dev/null
```

Back up the PostgreSQL database and the storage folder together.

---

## Scheduled jobs and notifications: what actually runs

MYHUB does not pretend to run background jobs that don't exist. The same maintenance routine runs in two places:

1. **When you use the app.** It runs at most once every 2 minutes per user, from the app layout.
2. **From `/api/cron/run`.** This only runs if you schedule it (see Deployment) and set `CRON_SECRET`. Without the secret the endpoint returns 503.

The routine:

- Creates due recurring transactions. This is idempotent: each occurrence is unique per rule and date, so running it twice never duplicates anything.
- Generates in-app notifications for:
  - bills that are upcoming or overdue
  - loan instalments
  - subscription renewals
  - budget warnings and overspends
  - savings milestones
  - tasks and events
  - project deadlines

  Each notification has a dedupe key, so it is created once. Dismissing one keeps a hidden record so it isn't re-created.
- Records the month's net-worth snapshot (one row per month, updated in place).

Notifications are **in-app only**. There is no email, SMS or push delivery. To add one, create a sender (for example Resend for email, or Africa's Talking for SMS). Call it from `syncNotifications` in `src/lib/services/maintenance.ts` for newly created rows, and add its API key as a server-only environment variable.

---

## How the money works (and why there's no double counting)

Every amount is stored as `NUMERIC(14,2)` and calculated with decimal arithmetic on the server. Account balances are **never stored**. They are always computed from the ledger:

```
balance = opening balance + INCOME + INFLOW + transfers in − EXPENSE − OUTFLOW − transfers out
```

| Transaction type | Meaning | In income/expense reports? |
| --- | --- | --- |
| `INCOME` / `EXPENSE` | Real earnings and spending | Yes |
| `TRANSFER` | Between two of your accounts (one row, `accountId` → `toAccountId`) | No |
| `INFLOW` / `OUTFLOW` | Money moving that isn't income or spending: loan principal received or repaid, investment buys and sales | No |

Each module writes these rows itself and tags them with a `source` (BILL, LOAN, INVESTMENT, SAVINGS, SUBSCRIPTION, RECURRING). Managed rows are locked in the Transactions screen, so you can only change their description, notes and category. To change the amount or delete one, use the module that created it, which keeps both sides consistent.

- **Transfers** are one row, so they can never be counted twice and never touch income or expense totals.
- **Loans** (borrowed):
  - The disbursement is an `INFLOW` into your account, and each repayment is split into a principal `OUTFLOW` plus an interest `EXPENSE` ("Loan interest").
  - Only principal reduces the outstanding balance.
  - For money you lent, the directions are reversed and interest is `INCOME`.
  - The repayment schedule uses reducing-balance amortization.
  - A loan is marked paid off automatically when nothing is outstanding.
- **Savings goals** earmark money that already sits in an account.
  - A contribution from another account is a `TRANSFER` into the goal's account. A contribution recorded against money that's already there creates no transaction.
  - A goal can't earmark more than its account holds, and a withdrawal can't exceed what's saved.
  - Net worth counts the account balance once and never adds goals on top.
- **Investments** use the average-cost method.
  - A buy is an `OUTFLOW` of amount plus fees; a sale is an `INFLOW` of proceeds minus fees, with the realized gain stored on the sale.
  - Dividends and interest are `INCOME`.
  - Unrealized profit or loss uses the price **you** last entered. MYHUB never fetches or invents market prices (see below).
- **Bills:**
  - Paying a bill creates one `EXPENSE`, or links an expense you already recorded instead of creating a duplicate.
  - A bill can be paid only once per due date (enforced by a database constraint).
  - Undoing a payment removes its expense and moves the due date back.
  - A loan-repayment bill pays through the loan module, so principal and interest are split correctly.
- **Subscriptions:** recording a charge creates one `EXPENSE`, with one charge per billing date.
- **Net worth** = account balances + investment value + money lent out + other assets − borrowed outstanding − other liabilities − overdrawn accounts.

### Market data

Investment prices are manual, by design. To add live prices:

1. Write a server-only fetcher that reads an API key from the environment, for example an NSE data vendor, Alpha Vantage or Twelve Data.
2. Call it from a scheduled job.
3. Write results through the same path as `updatePrice` in `src/server/actions/investments.ts`, which records an `InvestmentPrice` row with its source and date.

The UI already shows each price's source and the date it was last updated.

---

## Security

- **Authentication:** credentials via Auth.js.
  - Passwords are hashed with bcrypt (cost 12).
  - Login timing is constant whether or not the email exists.
  - Sign-in is rate limited per IP and per email; registration is rate limited per IP.
  - Sessions are JWT cookies that expire after 7 days.
  - Changing your password signs out every device: sessions carry a version number that is checked on each request.
  - Sign-ins and failed sign-ins are recorded in the activity log.
- **Authorization:** the middleware redirects unauthenticated page requests. Every server action and API route also loads the session user and scopes **every** query by `userId`. IDs from the client must be plain id strings, and are always looked up together with the owner, so another user's ID returns "not found".
- **Validation:** every server action and API route validates input with Zod. Monetary amounts are bounded and never parsed as floats.
- **Integrity:**
  - Multi-record financial changes run inside database transactions.
  - Unique constraints prevent duplicate bill payments, subscription charges and recurring occurrences.
  - Financial changes are written to an audit log, shown under Settings → Activity log.
- **Uploads:**
  - Only allow-listed extensions are accepted. File contents are checked against magic bytes, and the browser-sent MIME type is ignored.
  - There is a size cap and a rate limit.
  - Files get random keys under a per-user prefix and live outside the web root, or in a private bucket.
  - Downloads go through an authenticated route that checks ownership and sends `X-Content-Type-Options: nosniff`, a sandboxing CSP and `Content-Disposition`.
- **Headers:** a Content Security Policy, `X-Frame-Options: DENY`, `nosniff`, a Referrer-Policy, a Permissions-Policy and HSTS (in production).
- **CSV export:** cells that start with `=`, `+`, `-` or `@` are escaped to prevent spreadsheet formula injection.
- **Secrets:** all are server-only environment variables. `.env` and `/storage` are git-ignored, and `.env.example` contains no real values.

Limits to be aware of:

- The rate limiter is in-memory. That is fine for one server instance; use Redis or Upstash if you scale out.
- There is no two-factor authentication or email verification yet.
- The register page says when an email is already registered. That is acceptable for a personal server, and it is rate limited. Turn registration off once your account exists.

Dependency advisories as of November 2026 (`npm audit --omit=dev`). The fixable ones were applied, including next-auth 5.0.0-beta.32. The rest need major upgrades, so they're tracked here rather than forced:

- **Next.js 15 bundles an older PostCSS.** PostCSS only processes the app's own stylesheets at build time, never user input. Fixed by upgrading to Next 16.
- **Zod 3 can use too much memory on huge arrays.** Every array schema here has a maximum size, and server-action bodies are capped at 1 MB. Fixed by upgrading to Zod 4.
- **The Prisma 6 CLI depends on deepmerge-ts.** This is developer tooling only and isn't used at runtime. Fixed by upgrading to Prisma 7.

---

## Project layout

```
prisma/              schema.prisma, migrations/, seed.ts (demo account only)
src/app/(auth)/      login and register
src/app/(app)/       every signed-in page (one folder per module: page.tsx loads data, view.tsx renders it)
src/app/api/         auth, calendar feed, CSV export, document upload/download, cron
src/server/actions/  server actions (mutations), one file per area
src/server/ops/      shared transactional operations (loan repayments)
src/lib/services/    calculations and queries: ledger, loans, savings, investments, budgets, net worth, maintenance…
src/lib/validation/  Zod schemas shared by client and server
src/components/      ui primitives, shared building blocks, forms, charts, layout
tests/               Vitest unit tests
```

---

## Build status and what remains

All five build phases are complete. Typecheck, lint, unit tests, the browser tests and `next build` all pass.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: schema, auth, layout, design system, dashboard | Done |
| 2 | Accounts, transactions, transfers, recurring, budgets | Done |
| 3 | Savings, loans, investments, bills, subscriptions, net worth | Done |
| 4 | Calendar, tasks, notifications, developer workspace | Done |
| 5 | Notes, document vault, reports, settings, scheduled job | Done |

### Review pass (November 2026)

After the build, every module went through a product, financial, functional and security review. The main changes:

- **Money integrity.** A funded savings goal can't be moved to another account, and a loan with repayments can't switch between borrowed and lent. Investment prices keep the date you entered. Bills and subscriptions remember their billing day, so a bill due on the 31st returns to the 31st after a short month. Savings contributions can't earmark more than the account holds. Deleting a goal keeps the transfers it made.
- **Security.** Every server action rejects record ids that aren't plain strings. Changing your password signs out every other session (`User.sessionVersion`). Unauthenticated API calls get a 401, not a login page. Uploads are checked by extension and file signature and rate-limited, downloads are attachment-only with a sandbox CSP, and the app sends CSP, HSTS, frame and referrer headers.
- **Interface.** A Ctrl/⌘ K page switcher, tighter dashboard cards that fit on a phone, a month-on-month change on net worth, chart legends that don't truncate, filter toolbars that wrap cleanly, keyboard drag between Kanban columns with readable screen-reader announcements, a Tasks page, a Notifications page with dismiss, and Notes opening the first note on desktop.
- **Functional tests.** Browser tests in `tests/e2e/` click through every module: forms, filters, search, edit, delete, undo, CSV export, uploads, user isolation and every navigation link (see below).

### End-to-end browser tests

`tests/e2e/fresh.js` registers a new user and checks transfers, dashboards, CSV export isolation, 401s on the API and sign-out after a password change. `tests/e2e/demo.js` signs in as the demo user and exercises every module. They need Playwright (`npm i -D playwright && npx playwright install chromium`) and a running server:

```bash
npm run build && npm start &          # or npm run dev
npm run db:seed                       # demo.js expects fresh demo data
node tests/e2e/fresh.js && node tests/e2e/demo.js
npm run db:seed                       # the demo run changes demo data; reset it afterwards
```

Set `E2E_BASE_URL` to test another host.

Not built yet, in rough priority order:

1. **Email, SMS or push reminders.** Notifications are in-app only (see above).
2. **Live market prices.** Prices are manual; the integration point is documented above.
3. **Bank or M-Pesa statement import.** A CSV import would slot into `src/server/actions/transactions.ts`. Daraja API sync would need Safaricom credentials.
4. **Multi-currency per account** with FX conversion. Each user currently has a single currency.
5. **Two-factor authentication, email verification and password reset by email.** These need an email provider.
6. **A shared rate limiter** for multi-instance deployments.
7. **Recurring calendar events with per-occurrence exceptions.** Recurring events repeat as a series; you can't edit one occurrence on its own.
8. **Running the browser tests in CI.** They run locally (above) but aren't wired into a CI pipeline, because there is no repository yet.
