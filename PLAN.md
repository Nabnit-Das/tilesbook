# TileBook delivery plan

This is the implementation and acceptance checklist. Checked entries in the final audit describe verified scope. Partial, stubbed, unavailable and unverified items are itemised in SUMMARY.md.

## M1 · Foundation
- [x] Next.js App Router, strict TypeScript, Tailwind, Zod, forms, table, chart, language and test dependencies, lockfile, local environment validation and one-command setup.
- [ ] Local Supabase PostgreSQL, CLI configuration, migrations, seed, generated types, private storage, RLS on all business tables, tenant and role tests, atomic stock and document operations. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [ ] Phone OTP, signed sessions, developer fallback, five roles, multiple firms, branches, trial/Basic/Pro entitlements, checkout interface, audit trail, paise and IST dates. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] Navy collapsible shell, top strip, global search, quick add, notifications, print, menus, switcher, mobile drawer and bottom navigation, six Simple Mode tiles, Pro Mode, language chips and voice.
- [ ] Settings search and ten tabs covering application, transaction switches, multi-firm, godowns, backup, permissions, print, tax, messages and tile-specific options. Plans and pricing. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [ ] Git initialisation, conventional milestone history, GitHub templates, licence placeholder, CI, security scans, deploy workflow, deployment and GitHub setup instructions. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**

## M2 · Catalogue
- [x] Parties with six types, balances, addresses, terms, limits, pricing, detail and activity, referrals, communications and contact import.
- [x] Products, services, categories, item detail, lots and shades, dates, stock activity, units, rates, HSN, tile attributes, low stock and barcode. Add Item.
- [ ] Item and party imports, Excel/barcode/library options, label QR and barcode generation. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**

## M3 · Trading and accounts
- [x] Add Sale with party search, lots, line editor, area converter, discounts, notes, payment, due amount, mixed-lot override, one-lot suggestion, negative-stock and credit checks.
- [ ] Purchase bills, upload, lot and landed cost, purchase orders and conversions, debit notes, supplier price history. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] Payments in/out, allocations, receivables, cash adjustments and day closing, bank balances/reconciliation, cheque lifecycle, loans and EMI, expenses and categories.
- [x] Stock from ledger only, shared atomic mutation path, audit and tenant filtering.

## M4 · Printing
- [x] A4 GST invoice and 80mm thermal, A5 option, multilingual headings, copy labels, metadata, bill/ship addresses, taxes and HSN, QR, bank, terms, signature and template editor.
- [x] Retail bill, room quotation, proforma, order, challan, credit/debit note, receipt, party statement and purchase bill/order PDFs. Share/print/download, IRN and e-way integration stubs.
- [x] Invoice maths, Indian words, INV-113 PDF and thermal width acceptance.

## M5 · Shop workflows
- [ ] Sale invoice, quotation/rooms/combo, proforma, orders/online orders, challans, sale returns, POS scan and print. Date/firm/user filters, totals, search, export, print, empty states and row actions. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] Quotation to order to phased dispatch to invoice, bulk conversions, advance reservation, advance held and overdue; 200 boxes dispatched as 60 and 140.
- [x] Same-lot returns, display/sample movements, damage log/photos, supplier claim, unit-aware reservations and stock.

## M6 · CRM and dashboard
- [x] Home receivable/payable, sale chart, most-used reports, widgets, five shop alerts, interactive shortcuts.
- [ ] Trade partner percentage/fixed commissions, accrual/reversal/payment, inactive partners, follow-ups, offers, clearance, campaigns and WhatsApp Connect. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [ ] Customer portal for quotes/invoices/dispatch/balance, configurable reminders and provider interfaces, daily owner summary. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [ ] Dead-stock days and suggested clearance; per-party price lists, approvals, attendance/advances, catalogue/gallery and complaints. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**

## M7 · Reports and warehouse
- [x] Transaction: Sale, Purchase, Day Book, All Transactions, P&L, Bill Wise Profit, Cash Flow, Trial Balance, Balance Sheet.
- [ ] Party: Statement, Party P&L, All Parties, By Item, Sale/Purchase By Party, By Party Group. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [ ] GST: GSTR-1, 2, 3B, 9, HSN and SAC. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] Stock: Summary, Item By Party, Item/Category P&L, Low Stock, Stock/Item Detail, Sale/Purchase and Stock By Category, Item Discounts.
- [ ] Business status, bank statement and discounts; GST/rate, 27EQ, TCS/TDS; expense/category/item; purchase/sale order and item reports; loan statement. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] Dead stock, lot stock, breakage loss, pending deliveries, advance held, commission payable, partner sales, returns by lot, display, quotation conversion.
- [x] Report filters, print, PDF, Excel and sharing. Transfers, physical counts and variance, reorder suggestions.

## M8 · Administration, offline and utilities
- [ ] User management, roles, language help slots, backups to computer/Drive, scheduling, restore and audit. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] PWA, offline bills/payment/stock via Dexie, retry and idempotent sync, voice/manual fallback, lot and damage photos.
- [x] Marble slab beta with dimensions/area, reservation, vein photo and remnants.
- [ ] Onboarding wizard, accountant access, bulk item change, Tally import/export, salesmen, data verification, financial-year close, item exports. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**

## M9 · Verification and handover
- [x] Demo Bhubaneswar shop, 25 products, 12 lots, two same-design lots, 40-box dead lot, 20 parties including specified trades, 30 invoices incl. INV-113, five orders, two phased challans, three returns, six damages, commissions, two banks, PDC, loan and restricted counter.
- [x] Unit maths/GST/words/HSN/commission/dead stock/ledger, workflow tests, database isolation/price restrictions/RLS, language parity, PDF contents/width.
- [ ] Playwright login to PDF/export, every-route desktop/mobile smoke, offline sync, axe, Lighthouse, production dependency audit and clean build. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [ ] Milestone install/lint/typecheck/test/build and commits, final verify output, README, assumptions, deployment and honest per-screen scope/status. **Partial or externally unverified. See SUMMARY.md and STATUS.md.**
- [x] Board 1 mapping from written inventory. Board 2 A–V mapping: GST/thermal; estimate; proforma; payment-in; challan; credit note; PO; debit note; out/expense; banks/cheques; loans; POS; add item; damage; display; slabs; partners; WhatsApp/portal; transfer/count; GST/P&L; plans; utilities.

## Release checkpoint

- [x] Restore a confirmed, unmodified exported v2 accounting checkpoint into its original tenant, even after its archive payload is removed.
- [x] Test Code 39 encoding, cash voucher export, portal link expiry and original-sale cost reversals.
- [x] Expose the server-enforced credit-limit block in Settings and respect the credit warning preference.
- [x] Complete Windows clean dependency install without a filesystem preload and finish the five-case production Playwright run with successful teardown.
- [ ] Run Storage metadata visibility tests and the full pgTAP suite against Docker Supabase. Verify hosted OTP, Storage transfers and deployment in a designated staging project.
- [ ] Validate voucher compatibility in a real Tally company and print/scan physical labels. Voucher imports, consolidated reports and outstanding product gaps remain listed in SUMMARY.md.
