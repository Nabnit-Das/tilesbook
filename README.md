# TileBook

TileBook helps Indian tile, sanitaryware and marble dealers bill by box or piece, keep track of shades, reserve orders and collect payments. The demo opens with the books of **Demo Marbles & Tiles, Bhubaneswar**. English, Hindi and Odia are available in the app and in print headings.

## Start a local shop

Install Node 24 LTS and enable Docker Desktop or Docker Engine. Run the following from the directory containing `package.json`.

```sh
npm run setup
npm run dev
```

Open [TileBook on localhost](http://localhost:3000). Setup installs the locked dependencies, starts local Supabase, picks up its local API URL and public key, applies pending migrations, generates database types and installs the Chromium PDF renderer. The first local stack uses `supabase/seed.sql`. Existing `.env.local` files take precedence, so check their project URL when changing installations.

| Demo login | Ten-digit phone | Test OTP |
| ---------- | --------------- | -------- |
| Owner      | `9999999999`    | `123456` |
| Counter    | `9999999998`    | `123456` |

The login form adds India's `+91` prefix. The owner manages the shop. Counter staff can issue customer bills and receive payments. The database restricts supplier prices, profit and owner administration.

### Run the embedded demo without Docker

```sh
npm ci
npx playwright install chromium
npm run demo
```

Open [the loopback demo](http://127.0.0.1:3000). This mode runs the same SQL migrations and seed on embedded PostgreSQL (PGlite), persists the books in `.tilebook/data` and uses local signed sessions. The local demo key is generated in `.tilebook`. Leave hosted Supabase variables unset for this mode. A Chromium or Edge installation on Windows can also supply the PDF renderer.

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
