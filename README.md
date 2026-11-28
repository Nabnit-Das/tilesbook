# TileBook

TileBook helps Indian tile, sanitaryware and marble dealers bill by box or piece, keep track of shades, reserve orders and collect payments. The demo opens with the books of **Demo Marbles & Tiles, Bhubaneswar**. English, Hindi and Odia are available in the app and in print headings.

## Start a local shop

Install Node 24 LTS and enable Docker Desktop or Docker Engine. Run the following from the directory containing `package.json`.

```sh
npm run setup
npm run dev
```

Open [TileBook on localhost](http://localhost:3000). Setup installs the locked dependencies, starts local Supabase, picks up its local API URL and public key, applies pending migrations, generates database types and installs the Chromium PDF renderer. The first local stack uses `supabase/seed.sql`. Existing `.env.local` files take precedence, so check their project URL when changing installations.

For customer registration and recovery with real email, follow **Customer authentication on localhost** below.

### Run the embedded demo without Docker

```sh
npm ci
npx playwright install chromium
npm run demo
```

Open [the loopback demo](http://127.0.0.1:3000). Choose Owner or Counter on the demo screen. This mode runs the same SQL migrations and seed on embedded PostgreSQL (PGlite), persists the books in `.tilebook/data` and uses local signed sessions. The local demo key is generated in `.tilebook`. Leave hosted Supabase variables unset for this mode. A Chromium or Edge installation on Windows can also supply the PDF renderer.

## Try a bill

1. Open **Sale invoices**, search for `INV-113` and open its row. Sai Builders bought 23 boxes of Glossy White from lot 2531, shade A3, and six bags of adhesive. The taxable amount is ₹76,628, GST is ₹13,793.04 and the round-off is −₹0.04. The bill total is **₹90,421**, with ₹50,000 received and **₹40,421** due.
2. Open the PDF, download it or choose the 80 mm receipt. Print options include paper size, copy label and heading language. On phones with file sharing, prepare the PDF and tap again to choose a destination such as WhatsApp. Browsers without file sharing download the PDF for manual attachment.
3. For a new sale, add a party and an item with a lot number, shade and opening quantity. Use **Sqft Calculator** on the sale line. An area of 350 sqft at four sqft per piece and four pieces per box needs 22 boxes, or 23 boxes with 5% wastage.
4. Record a payment against the invoice. Reopen **Who owes me** to see the balance. Open a sales report and export the filtered rows to Excel.

The seed includes 25 items, 12 lots, 20 parties, 30 invoices, five orders, two partial-delivery challans, three returns, six damage entries, two banks, a post-dated cheque and a loan. The 40 boxes in lot 2416 illustrate the dead-stock report.

## Verification

| Command                              | Purpose                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`                       | ESLint with zero warning allowance                                                                                 |
| `npm run typecheck`                  | Generate Next route types and run strict TypeScript                                                                |
| `npm test`                           | Vitest checks including billing rules, PostgreSQL permissions and workflows, translations and server-rendered PDFs |
| `npm run db:test`                    | Run the pgTAP suite against local Supabase                                                                         |
| `npm run build`                      | Build the production Next.js app                                                                                   |
| `npm run e2e`                        | Playwright application flows, route smoke tests, accessibility and offline checks                                  |
| `npm run verify`                     | Run lint, typecheck, unit/integration tests, Supabase DB tests, build and end-to-end tests in sequence             |
| `npm run db:types`                   | Regenerate the local Supabase database types                                                                       |
| `npm run db:reset` or `npm run seed` | Rebuild the **local** Supabase database and reload the demo data. This replaces existing local books               |

The full verification gate requires a running Docker-backed local Supabase stack and Chromium. Playwright normally starts the production embedded demo on port 3150. Set `TEST_SUPABASE=1` to exercise the local Supabase Auth and REST services, or set `BASE_URL` to an already running **test installation**. Browser tests create records there. On Linux CI, install Chromium system dependencies with `npx playwright install --with-deps chromium`. After a production build, `npm start` serves the real Supabase configuration, and `npm run demo -- --production` serves the embedded demo.

The build-specific results and outstanding work are recorded in [STATUS.md](STATUS.md) and [SUMMARY.md](SUMMARY.md). The screen inventory and design assumptions are in [PLAN.md](PLAN.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md).

## How the books work

- **Data and access.** Next.js uses the active Supabase user session to call tenant-scoped PostgreSQL functions. Membership determines which shop and role may act. Stock postings, document numbering, order fulfillment and commission accrual run inside transactions. An idempotency key protects retried mutations.
- **Stock.** Available stock is derived from ledger movements. Booking reserves goods, dispatch reduces physical stock, and displayed goods leave sellable stock. Returns refer to the original document line and lot.
- **Money and dates.** Amounts are integer paise. GST is calculated per line, grouped by HSN and reconciled to the rounded rupee total. Dates are displayed in Indian Standard Time.
- **Print.** Chromium produces the PDFs on the server with embedded Indic fonts. Settings control the bank and UPI details, colour, terms, columns, copies and heading language. The UPI QR carries payment instructions. E-invoice IRN, statutory QR and e-way issuing are provider integration points.
- **Offline.** The production app registers a service worker. Open the shop and required screens online before going offline. Supported new records enter a Dexie queue and replay when connectivity returns. Review pending sync entries before clearing browser data.

The included 18% and 5% rates are editable sample defaults. Have a chartered accountant verify classifications, applicable rates, the intended statutory e-invoice format and reporting requirements for the dealer before using these documents for filing. GST reports are worksheets for review.

## Repository map

| Path                             | Contents                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app`                        | App Router routes, customer portal and HTTP endpoints                               |
| `src/components`, `src/features` | Shop shell, dashboard, forms, ledgers, reports and tools                            |
| `src/domain`, `src/print`        | Pure business calculations, translated templates and server-side PDF generation     |
| `src/server`, `src/types`        | Session verification, Supabase and embedded transports, shared/generated data types |
| `supabase`                       | Local configuration, migrations, private bucket policies, seed and pgTAP tests      |
| `tests`, `e2e`                   | Vitest and Playwright suites                                                        |
| `.github/workflows`              | CI, database rebuild, security and manually triggered deployment                    |

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosted setup and [GITHUB_SETUP.md](GITHUB_SETUP.md) for repository publication.

## Restoring a shop checkpoint

In Backups, the owner can download a v2 JSON file and select it for a confirmed restore to the same shop. Restore verifies the file against the database's export digest, serializes writes for the shop and saves a rollback point. Keep exports private. They contain customer and financial data. The 20 MB limit applies to the accounting snapshot. Back up Storage objects separately. Losing the database and its proof register requires infrastructure-level recovery.

Utilities supports printable Code 39 lot numbers using uppercase letters, digits and standard Code 39 punctuation. Use QR for other lot numbers. The Tally cash voucher export covers cash receipts and cash payments. Import party masters and referenced bills into a test company first and reconcile voucher counts, debit/credit totals and bill references before posting to a live ledger. Bank, UPI, cheque and inventory vouchers are outside this export. [Tally XML reference](https://help.tallysolutions.com/sample-xml/)

## Customer authentication on localhost

Open Windows PowerShell in this repository with Docker Desktop running. Keep the existing database volume. In the Git-ignored `.env.providers.local`, set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `AUTHORIZED_TEST_EMAIL`. With `onboarding@resend.dev`, the recipient must be the email address on the Resend account. The app reads only the recipient setting for the restricted test. The SMTP credential belongs to the local Auth service.

```powershell
node scripts/provider-config.mjs --apply
if ($LASTEXITCODE -eq 0) { node scripts/auth-local.mjs --resend }
```

The apply command compares the active Auth configuration, reloads the existing local Supabase stack if required, and runs pending migrations. Stop an older TileBook process on port 3000 before starting the app. To check settings without restarting, run `node scripts/provider-config.mjs --check`. To apply migrations separately, run `npx supabase migration up --local`.

1. Open [registration](http://127.0.0.1:3000/register) and enter your name, business, category and authorized email. Enter the six-digit code from the verification email, choose a password, accept the terms and privacy policy, and finish business setup.
2. Save a test record, sign out, and open [password recovery](http://127.0.0.1:3000/forgot-password). Enter the new code from the recovery email, set a different password, and sign in to confirm that the same record is present. Codes expire after ten minutes. The resend interval is sixty seconds. The verified reset step expires after five minutes.
3. For a missing message, compare its timestamp in [Resend Emails](https://resend.com/emails) with the request. Check the destination, delivered, delayed, suppressed or bounced status, then check the inbox and spam folder. A sending-only key cannot read delivery events. Recovery sends only for an existing email account.
4. A signed-in legacy user without a verified email can open [link email](http://127.0.0.1:3000/account/email) and verify an address on their existing identity. A signed-out phone-only user needs identity-checked operator assistance linking an email to the original Supabase user ID. Keep that ID and its memberships.

Run `npm run verify` for the standard regression suite. For isolated email end-to-end testing, switch the local profile to Mailpit and run the dedicated test from PowerShell:

```powershell
node scripts/provider-config.mjs --mailpit --apply
if ($LASTEXITCODE -ne 0) { throw "Mailpit profile did not activate" }
$env:TEST_SUPABASE='1'
try { npx playwright test e2e/customer.spec.ts } finally { Remove-Item Env:TEST_SUPABASE }
node scripts/provider-config.mjs --apply
```

The Mailpit flow creates isolated test accounts and checks registration, recovery, record persistence and tenant isolation. External delivery requires the live inbox test above.
