# TileBook delivery plan

This is the implementation and acceptance checklist. Checked entries in the final audit describe verified scope. Partial, stubbed, unavailable and unverified items are itemised in SUMMARY.md.

## M1 · Foundation
- [ ] Next.js App Router, strict TypeScript, Tailwind, Zod, forms, table, chart, language and test dependencies, lockfile, local environment validation and one-command setup.
- [ ] Local Supabase PostgreSQL, CLI configuration, migrations, seed, generated types, private storage, RLS on all business tables, tenant and role tests, atomic stock and document operations.
- [ ] Phone OTP, signed sessions, developer fallback, five roles, multiple firms, branches, trial/Basic/Pro entitlements, checkout interface, audit trail, paise and IST dates.
- [ ] Navy collapsible shell, top strip, global search, quick add, notifications, print, menus, switcher, mobile drawer and bottom navigation, six Simple Mode tiles, Pro Mode, language chips and voice.
- [ ] Settings search and ten tabs covering application, transaction switches, multi-firm, godowns, backup, permissions, print, tax, messages and tile-specific options. Plans and pricing.
- [ ] Git initialisation, conventional milestone history, GitHub templates, licence placeholder, CI, security scans, deploy workflow, deployment and GitHub setup instructions.

## M2 · Catalogue
- [ ] Parties with six types, balances, addresses, terms, limits, pricing, detail and activity, referrals, communications and contact import.
- [ ] Products, services, categories, item detail, lots and shades, dates, stock activity, units, rates, HSN, tile attributes, low stock and barcode. Add Item.
- [ ] Item and party imports, Excel/barcode/library options, label QR and barcode generation.

## M3 · Trading and accounts
- [ ] Add Sale with party search, lots, line editor, area converter, discounts, notes, payment, due amount, mixed-lot override, one-lot suggestion, negative-stock and credit checks.
- [ ] Purchase bills, upload, lot and landed cost, purchase orders and conversions, debit notes, supplier price history.
- [ ] Payments in/out, allocations, receivables, cash adjustments and day closing, bank balances/reconciliation, cheque lifecycle, loans and EMI, expenses and categories.
- [ ] Stock from ledger only, shared atomic mutation path, audit and tenant filtering.

## M4 · Printing
- [ ] A4 GST invoice and 80mm thermal, A5 option, multilingual headings, copy labels, metadata, bill/ship addresses, taxes and HSN, QR, bank, terms, signature and template editor.
- [ ] Retail bill, room quotation, proforma, order, challan, credit/debit note, receipt, party statement and purchase bill/order PDFs. Share/print/download, IRN and e-way integration stubs.
- [ ] Invoice maths, Indian words, INV-113 PDF and thermal width acceptance.

## M5 · Shop workflows
- [ ] Sale invoice, quotation/rooms/combo, proforma, orders/online orders, challans, sale returns, POS scan and print. Date/firm/user filters, totals, search, export, print, empty states and row actions.
- [ ] Quotation to order to phased dispatch to invoice, bulk conversions, advance reservation, advance held and overdue; 200 boxes dispatched as 60 and 140.
- [ ] Same-lot returns, display/sample movements, damage log/photos, supplier claim, unit-aware reservations and stock.

## M6 · CRM and dashboard
- [ ] Home receivable/payable, sale chart, most-used reports, widgets, five shop alerts, interactive shortcuts.
- [ ] Trade partner percentage/fixed commissions, accrual/reversal/payment, inactive partners, follow-ups, offers, clearance, campaigns and WhatsApp Connect.
- [ ] Customer portal for quotes/invoices/dispatch/balance, configurable reminders and provider interfaces, daily owner summary.
- [ ] Dead-stock days and suggested clearance; per-party price lists, approvals, attendance/advances, catalogue/gallery and complaints.

## M7 · Reports and warehouse
- [ ] Transaction: Sale, Purchase, Day Book, All Transactions, P&L, Bill Wise Profit, Cash Flow, Trial Balance, Balance Sheet.
- [ ] Party: Statement, Party P&L, All Parties, By Item, Sale/Purchase By Party, By Party Group.
- [ ] GST: GSTR-1, 2, 3B, 9, HSN and SAC.
- [ ] Stock: Summary, Item By Party, Item/Category P&L, Low Stock, Stock/Item Detail, Sale/Purchase and Stock By Category, Item Discounts.
- [ ] Business status, bank statement and discounts; GST/rate, 27EQ, TCS/TDS; expense/category/item; purchase/sale order and item reports; loan statement.
- [ ] Dead stock, lot stock, breakage loss, pending deliveries, advance held, commission payable, partner sales, returns by lot, display, quotation conversion.
- [ ] Report filters, print, PDF, Excel and sharing. Transfers, physical counts and variance, reorder suggestions.

## M8 · Administration, offline and utilities
- [ ] User management, roles, language help slots, backups to computer/Drive, scheduling, restore and audit.
- [ ] PWA, offline bills/payment/stock via Dexie, retry and idempotent sync, voice/manual fallback, lot and damage photos.
- [ ] Marble slab beta with dimensions/area, reservation, vein photo and remnants.
- [ ] Onboarding wizard, accountant access, bulk item change, Tally import/export, salesmen, data verification, financial-year close, item exports.

## M9 · Verification and handover
- [ ] Demo Bhubaneswar shop, 25 products, 12 lots, two same-design lots, 40-box dead lot, 20 parties including specified trades, 30 invoices incl. INV-113, five orders, two phased challans, three returns, six damages, commissions, two banks, PDC, loan and restricted counter.
- [ ] Unit maths/GST/words/HSN/commission/dead stock/ledger, workflow tests, database isolation/price restrictions/RLS, language parity, PDF contents/width.
- [ ] Playwright login to PDF/export, every-route desktop/mobile smoke, offline sync, axe, Lighthouse, production dependency audit and clean build.
- [ ] Milestone install/lint/typecheck/test/build and commits, final verify output, README, assumptions, deployment and honest per-screen scope/status.
- [ ] Board 1 mapping from written inventory. Board 2 A–V mapping: GST/thermal; estimate; proforma; payment-in; challan; credit note; PO; debit note; out/expense; banks/cheques; loans; POS; add item; damage; display; slabs; partners; WhatsApp/portal; transfer/count; GST/P&L; plans; utilities.
