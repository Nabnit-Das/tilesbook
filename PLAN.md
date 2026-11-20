# TileBook implementation checklist

MISSION
Build, in this repository and in one continuous run, a complete full-stack web app called "TileBook" (working name): a GST billing + ERP + CRM SaaS for tile, sanitaryware and marble dealers in India. It must have everything a normal professional billing app (like Vyapar or Tally Prime) has: parties, items, sales, purchases, cash and bank, GST and stock reports, users, backup, settings, AND professional printable bills, PLUS our extra features that normal apps miss (section 9). Target users are small shopkeepers, some of whom cannot read English well, using low-cost Android phones with weak internet. The app must be mobile-first, simple, and still professional.

REFERENCE IMAGES (attached, follow them closely)
- [ ] - TileBook_UI_Reference.png (Board 1): app shell, Simple Mode mobile screens, Home, Parties, Items with LOTS tab, Sale Invoices, Add Sale with Sqft Converter and lot picker, Sale Order with phase-wise delivery, Purchase Bills, Cash & Bank, Reports menu, Settings, Users/Backup/Imports, and the gap-feature panel.
- [ ] - TileBook_UI_Reference_2.png (Board 2): the A4 GST Tax Invoice and 80mm thermal receipt, Estimate (room-by-room), Proforma, Payment-In, Delivery Challan, Credit Note, Purchase Order, Debit Note, Payment-Out/Expenses, Banks/Cheques, Loans, POS, Add Item form, Damage Log, Display stock, Marble slabs, Trade Partners/follow-ups/campaigns, WhatsApp Connect/customer portal, Godown transfer/stock count, GSTR-1/HSN/P&L, Plans & Pricing, Imports/Utilities.
- [ ] - Dashed teal outlines in the images mark OUR custom gap features. Build every screen shown in the images. Where this text and the images differ in small visual details, follow the images; where they differ in functionality, follow this text.

WORKING RULES (follow strictly)
- [ ] 1. Do not ask me questions. Make sensible assumptions and write them in ASSUMPTIONS.md.
- [ ] 2. First create PLAN.md with a checklist of every item in this prompt and every screen in the two images. Tick items off as you finish them. Do not stop until every item is ticked or documented as blocked.
- [ ] 3. Work in milestones (M1 to M9, section 15). After each milestone: install, lint, typecheck, test, build. Fix all failures before moving on. Commit with a clear message.
- [ ] 4. Prefer working, tested features over decoration. No dead screens: every page reads and writes real data.
- [ ] 5. No secrets in code. Provide .env.example and docker-compose.yml for PostgreSQL.
- [ ] 6. Write README.md (setup, run, test, seed, demo logins).

TECH STACK
- [ ] - Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [ ] - PostgreSQL + Prisma (migrations + seed)
- [ ] - Auth: phone number + OTP (dev OTP 123456; SMS behind an interface), signed session cookies
- [ ] - Zod validation; react-hook-form; TanStack Table; Recharts
- [ ] - i18n: next-intl with en, hi, or (Odia) files; every UI string comes from these files
- [ ] - PDF: server-side generation (e.g. Playwright/Chromium HTML-to-PDF or @react-pdf/renderer) for all print documents
- [ ] - Offline: PWA (manifest + service worker) + IndexedDB (Dexie) queue for new bills, payments and stock entries, auto-sync when online
- [ ] - Voice: Web Speech API wrapper with fallback; photo input for lot labels via camera/file upload (store image, manual lot entry always possible)
- [ ] - Tests: Vitest (business rules, invoice maths) and Playwright (end-to-end flows)

MULTI-TENANT SAAS RULES
- [ ] - Every business table has businessId. Enforce tenant isolation in one central data-access layer. Test proving shop A cannot read shop B.
- [ ] - Roles: Owner, Manager, Counter, Godown, Accountant (read-only CA). Permission matrix. Counter and Godown cannot see purchase prices or profit.
- [ ] - Plans: 14-day free trial, Basic, Pro (crown icon on premium features, friendly upgrade prompt). Payment gateway is a stub behind an interface.
- [ ] - Audit log (user, time, before/after) with an Audit Trail toggle.
- [ ] - Multiple firms per login; multiple godowns/branches.
- [ ] - Money stored as integer paise. Dates stored UTC, shown IST dd/mm/yyyy.

DESIGN SYSTEM (own brand; do NOT copy any other product's logo, name, illustrations or ads; no promo banners)
- [ ] - Sidebar navy #14183F, white content, teal primary #0FA3A3, coral #F0583F for the main Add Sale button, yellow #F5B921 accents, green money in, red money out.
- [ ] - Min 16px body text on mobile, big tap targets, an icon on every menu label, friendly SVG empty states with a big call-to-action.
- [ ] - Two modes (Settings toggle):
  - Simple Mode (default for new shops): Home shows 6 big colour tiles (New Bill, Sqft Calculator, Orders, Stock, Who Owes Me, Reports), a "Speak a bill" voice button, language chips (Odia/Hindi/English). Plain words: "Who owes me" (receivable), "I owe" (payable), "Money received" (Payment-In), "Money paid" (Payment-Out).
  - Pro Mode: full sidebar and all screens.

APP SHELL
- [ ] - Top strip: Company, Help, Shortcuts, Refresh, support phone.
- [ ] - Top bar: global "Search Transactions"; [+ Add Sale] coral, [+ Add Purchase] blue outline, round [+] quick-add menu, notifications, print, three-dot menu.
- [ ] - Left sidebar (collapsible): "Open Anything (Ctrl+F)" command search, then Home | Parties (Party Details, WhatsApp Connect) | Items | Sale (Sale Invoices, Estimate/Quotation, Proforma Invoice, Payment-In, Sale Order, Delivery Challan, Sale Return/Credit Note, POS) | Purchase & Expense (Purchase Bills, Payment-Out, Expenses, Purchase Order, Purchase Return/Debit Note) | Grow Your Business (Trade Partners, Follow-ups, Offers, WhatsApp Campaigns) | Cash & Bank (Bank Accounts, Cash In Hand, Cheques, Loan Accounts) | Reports | Sync, Share & Backup (Sync & Share/Users, Auto Backup, Backup To Computer, Backup To Drive, Restore Backup) | Utilities | Settings | Plans & Pricing. Groups expand with chevrons; sub-items have "+" quick-add; active item has a coral left border. Bottom: business switcher card.
- [ ] - Every list page: title with dropdown, filter bar (This Month / date range, All Firms, All Users), summary cards, search, column filters, Excel export, print, three-dot row menu, empty state.
- [ ] - Mobile: drawer sidebar; bottom bar (Home, New Bill, Sqft Calculator, Who Owes Me, Reports); tables become cards.

DATA MODEL (Prisma; all with businessId, createdAt, updatedAt)
Business, Branch/Godown, User, Membership(role), Party (customer, supplier, mason, contractor, architect, builder; phone, addresses (billing and shipping), GSTIN, opening balance, credit limit, price list), Product (name, brand, design, size, finish, category, HSN, gstRate, baseUnit, sqftPerPiece, piecesPerBox, salePrice, purchasePrice, lowStockLevel, barcode), Service, Category, Lot (productId, lotNo, shade, supplierId, receivedDate, lastSoldDate), StockMovement (ledger), SaleDoc (invoice, estimate, proforma, order, challan, return) with lines (product, lot, room, qty, unit, sqft, price, discount, gst), Payment (in/out; cash, bank, UPI, cheque), Cheque, BankAccount, LoanAccount, Expense, ExpenseCategory, PurchaseDoc/Line (with landed cost), DamageLog, DisplayStock, Slab (marble), TradePartnerRule, Commission, CommissionPayment, FollowUp, Reminder, Campaign, PrintTemplate, Subscription, AuditLog, BackupRecord, Setting.
Stock is ALWAYS derived from StockMovement, never stored as one number.

BUSINESS RULES (pure, unit-tested functions)
- [x] 1. Sqft converter: requiredArea = sqft x (1 + wastage/100); pieces = ceil(requiredArea / sqftPerPiece); boxes = floor(pieces / piecesPerBox); loose = pieces mod piecesPerBox; option "round up to full boxes". Example: 350 sqft, 4 sqft/piece, 4 pcs/box, 0% wastage = 22 boxes, 0 loose; with 5% wastage = 23 boxes, 0 loose (check this rounding in a test).
- [x] 2. Lot rule: every purchase, stock row, sale line, return and damage entry stores lot and shade. Two lots of the same product in one document show a shade-mismatch warning (owner can override with a reason). Suggest "ship from one lot" when a single lot has enough stock.
- [x] 3. Advance booking reserves stock without reducing physical stock; physical stock reduces only at dispatch (challan). "Advance Held" shows paid material still in the shop.
- [x] 4. Phase-wise delivery: one Sale Order, many Delivery Challans; per-line ordered, delivered and balance; order stays open until balance is zero; overdue shows an orange "Order Overdue".
- [x] 5. Returns: unopened boxes go back under their ORIGINAL lot only; wrong-lot return is blocked or warned.
- [x] 6. Display stock: opened boxes moved to Display/Sample are excluded from sellable stock; samples given to architects are tracked.
- [ ] 7. GST: per-product rate, defaults 18% tiles, sanitaryware and finished marble/granite slabs, 5% raw marble/granite blocks; admin-editable; CGST+SGST vs IGST by state of supply. Show a UI note and README note that rates must be verified with a CA.
- [ ] 8. Commission: rule per partner (percentage of sale or fixed per box); accrues on tagged sales, reduces on returns; payable = accrued minus paid.
- [ ] 9. Dead stock: per lot days since lastSoldDate; flag beyond a configurable threshold (default 180 days) with plain sentences like "Lot 2416: 40 boxes unsold 6 months".
- [x] 10. Invoice maths: line taxable = qty x rate - discount; tax per line by rate; totals by summing paise, round-off to nearest rupee shown as a separate line; HSN-wise tax summary; amount in words using Indian numbering (lakh/crore), e.g. 90,421 = "Ninety Thousand Four Hundred Twenty One Rupees Only".

INVOICE AND PRINT DOCUMENTS (match Board 2, slide A)
Generate printable PDFs (and WhatsApp share, print, download) for: Tax Invoice, Retail/Cash Bill, Estimate/Quotation (room-by-room), Proforma Invoice, Sale Order, Delivery Challan, Credit Note, Debit Note, Payment Receipt, Party Statement, Purchase Bill/Order. Layout like Tally Prime / Vyapar:
- [ ] - A4 GST Tax Invoice: business header (logo, name, address, GSTIN, phone); title "TAX INVOICE" with copy label ORIGINAL FOR RECIPIENT / DUPLICATE / TRIPLICATE selectable; invoice no., date, place of supply, vehicle no., e-way bill no., challan and order references, Referred-by partner, salesperson; Bill To and Ship To (with GSTIN).
- [ ] - Item table columns: #, Description, HSN, Lot/Shade, Qty with unit (Box/Bag/Piece), Sqft, Rate, Discount, Taxable value, CGST % and amount, SGST % and amount (IGST columns when interstate), Amount. Totals row (quantity, sqft, taxable, taxes, total).
- [ ] - HSN-wise tax summary table; amount in words; round-off; received and balance due with due date; bank details; UPI QR code; editable terms and conditions (defaults: shade can differ between lots, report breakage at delivery, returns only unopened and same lot); signature block ("For <business>, Authorised Signatory"); "Prepared by".
- [ ] - 80mm thermal receipt template (shop name, GSTIN, bill no., items with lot, GST included, total, payment mode, UPI QR, thank-you line).
- [ ] - Print templates are editable in Settings > PRINT: logo, accent colour, which columns show (lot, sqft, discount, HSN), terms, footer, paper size A4 / A5 / 80mm thermal, copies, language of headings (en/hi/or).
- [ ] - E-invoice IRN/QR and e-way bill generation are integration stubs behind interfaces; leave labelled placeholder boxes for IRN and QR. Add a README note that statutory e-invoice formats must be verified with a CA.

SCREENS (all must work with real data; see the images)
- [ ] 1. Home: Total Receivable (green down-arrow) and Total Payable (red up-arrow, empty state "You don't have any payables as of now"); right column cards (WhatsApp reminders, Google Business, Add Widget); Total Sale chart with This Month dropdown; Most Used Reports tiles. Our alert cards: Dead Stock, Commission Payable, Pending Deliveries, Today's Breakage, Advance Held.
- [ ] 2. Parties: split view (list with amounts; detail with name, phone, addresses, SMS/WhatsApp/reminder icons, transactions table). Types include Mason, Contractor, Architect, Builder. Trade partners show referred sales, commission rate, earned and paid. Add Party form. Import contacts helper.
- [ ] 3. Items: tabs PRODUCTS, SERVICES, CATEGORY; split list/detail (sale price excl., purchase price excl., available for sale, transactions with colour dots and units like "1 Box"). Add Item form with the tile fields (size, finish, brand, design, sqft per piece, pieces per box, unit conversion Box/Piece/Sqft, low-stock level, barcode, HSN, GST). LOTS tab per item (lot, shade, boxes, received date, last sold).
- [ ] 4. Sale pages: Sale Invoices, Estimate/Quotation (rooms), Proforma, Payment-In, Sale Order (tabs SALE ORDERS and ONLINE ORDERS; Convert To Sale; Bulk Convert), Delivery Challan (Bulk Convert, Excel Report), Sale Return/Credit Note (with lot-mismatch warning), POS counter mode (barcode scan, thermal print). Each with filter bar, summary cards, table, empty state.
- [ ] 5. Add Sale form: party search or voice, invoice no., date, items grid (item, lot picker, qty, unit, price, discount, GST, amount), Sqft Converter button, mixed-lot warning, notes, payment type, received, balance, Save / Save & Print / Share on WhatsApp. One-click conversion: estimate to order to challan to invoice.
- [ ] 6. Purchase & Expense: Purchase Bills (Upload Bill; tiles Paid + Unpaid = Total; lot and shade per line; landed cost), Payment-Out, Expenses (categories such as freight, unloading, rent), Purchase Order (reorder suggestions, convert to bill), Purchase Return/Debit Note (supplier claims for breakage).
- [ ] 7. Cash & Bank: Bank Accounts (feature cards, UPI QR, balances), Cash In Hand (balance, Adjust Cash), Cheques (Open/Deposited/Bounced, post-dated, Withdraw), Loan Accounts (dashboard, EMI calculation), bank statement import and reconciliation.
- [ ] 8. Reports (grouped menu, every report with date and firm/user filters, Excel, print, PDF, share): Transaction (Sale, Purchase, Day book, All Transactions, Profit and Loss, Bill Wise Profit, Cash flow, Trial Balance, Balance Sheet); Party (Party Statement, Party wise P&L, All parties, Party Report By Item, Sale Purchase By Party, By Party Group); GST (GSTR 1, 2, 3B, 9, Sale Summary By HSN, SAC Report); Item/Stock (Stock summary, Item Report By Party, Item Wise P&L, Item Category Wise P&L, Low Stock Summary, Stock Detail, Item Detail, Sale/Purchase By Item Category, Stock Summary By Item Category, Item Wise Discount); Business Status (Bank Statement, Discount Report); Taxes (GST Report, GST Rate Report, Form 27EQ, TCS Receivable, TDS Payable, TDS Receivable); Expense (Expense, Expense Category, Expense Item); Orders (Sale/Purchase Orders, Order Item); Loan Statement. Our "Tile & Marble Reports": Dead Stock by Lot, Lot-wise Stock, Breakage Loss, Pending Deliveries (phase-wise), Advance Held, Commission Payable, Trade Partner Sales, Returns by Lot, Display/Sample Stock, Quotation Conversion.
- [ ] 9. Grow Your Business: Trade Partners (commission rules, sales, owed, last contact), Follow-ups (pending quotations, dues, inactive partners), Offers (e.g. clearance discount on a dead lot), WhatsApp Campaigns (festival messages).
- [ ] 10. WhatsApp Connect and customer portal: auto messages (invoice PDF on save, payment reminder before due, delivery update on dispatch, daily owner summary); customer portal link showing quotation, invoices, delivery status, balance.
- [ ] 11. Stock tools: Godown transfer, physical stock count with difference report, low-stock and reorder suggestions.
- [ ] 12. Sync, Share & Backup: users (roles, permissions, empty state "You have not added any users till now", Hindi/English/Odia help-video slots), Auto Backup, Backup To Computer, Backup To Drive (stub), Restore Backup.
- [ ] 13. Utilities: Import Items (Barcode [recommended], Excel, Library), Set Up My Business wizard, Accountant Access, Barcode/QR Generator for lot labels, Update Items In Bulk, Import From Tally, Import Parties, Track Your Salesmen, Exports To Tally, Export Items, Verify My Data, Close Financial Year.
- [ ] 14. Settings (full-screen modal with search, tabs GENERAL, TRANSACTION, PRINT, TAXES & GST, TRANSACTION MESSAGE, PARTY, ITEM, SERVICE REMINDERS, ACCOUNTING, MULTI CURRENCY). GENERAL: Application (Enable Passcode, currency, decimals, GSTIN Number, Stop Sale on Negative Stock, Block New Items/Parties from Txn Form), More Transactions (Estimate, Proforma, Orders, Other Income, Fixed Assets, Delivery Challan), Multi Firm, Stock Transfer Between Godowns, Backup & History (Auto Backup, last backup, Audit Trail). Our toggles: Simple/Pro Mode, Language (English, Hindi, Odia), Sqft Converter, Force Lot on Every Sale, Warn on Mixed Lots, Display Stock, Trade Partner Commission.
- [ ] 15. Plans & Pricing: free trial, Basic, Pro (stub checkout).

OUR 6 CORE GAPS (fully working; our differentiators)
- [ ] 1. Shade and batch mismatch: lot and shade on every sale line, mixed-lot warning, lot capture by voice, photo or scan.
- [ ] 2. Sqft-to-box math: Sqft Converter in Add Sale and Quotation and as a Home tile, also in the mobile bottom bar.
- [ ] 3. Unlogged transit breakage: Damage Log (qty, lot, reason: factory transit / godown handling / delivery / showroom, responsible person, photo), monthly breakage-loss report, supplier claim via Debit Note.
- [ ] 4. Hidden dead stock: per-lot last-sold tracking, dead-stock report and plain alerts, suggested discount, one-tap WhatsApp clearance message.
- [ ] 5. Delayed advance deliveries: Order Flow Advance Booking > Pending Delivery > Final Dispatch, reservation without reducing physical stock until dispatch, "Advance Held" report.
- [ ] 6. Unique marble slabs: working Version-2 beta screen with slab number, length x width, area, remnants, reservation after advance, vein-match photo (see Board 2, slide P), clearly labelled Beta.

OUR 5 EXTRA GAPS
- [ ] 7. Trade Partner CRM and commissions: tag referring partner on each sale and invoice, rules, Commission Payable report, commission payments, inactive-partner reminders.
- [ ] 8. Phase-wise deliveries against one order.
- [ ] 9. Customer returns with lot matching.
- [ ] 10. Showroom Display vs godown stock.
- [ ] 11. Room-by-room quotation and combo estimate: rooms (living room floor in sqft, bathroom wall in boxes, adhesive in bags, sanitaryware in pieces), each line with its own GST, phone-friendly editing, one-tap conversion to Order and Invoice.

ADDITIONAL STANDARD ERP FEATURES
POS with barcode scan and thermal print; price lists (retail, contractor, builder, dealer) and per-party special rates; line and bill discounts, round-off; credit limit warning or block; payment reminders by WhatsApp/SMS; UPI QR on invoices; reorder levels and PO suggestions; landed cost on purchases; supplier price history; cheque register; TDS/TCS fields; e-way bill and e-invoice fields (stubs); day-end cash closing; simple staff attendance and advances; approval workflow (discount above a limit needs owner approval); daily owner summary on WhatsApp (stub); product catalogue and design gallery shareable on WhatsApp; complaint log (shade, damage, delivery).

SEED DATA (realistic demo)
Business "Demo Marbles & Tiles", Bhubaneswar. 25 products (2x2 vitrified, 2x4 glossy, wall tiles, adhesive bags, sanitaryware, a raw marble block, marble slabs), 12 lots including one dead lot (40 boxes unsold 6+ months) and two lots of the same design, 20 parties including 3 masons, 2 contractors, 2 architects, 30 invoices, 5 orders (one split into two challans), 3 returns, 6 damage entries, commissions, 2 bank accounts, 1 post-dated cheque, 1 loan. Include invoice INV-113 for Sai Builders matching Board 2 (23 boxes 2x2 Glossy White lot 2531 shade A3 at 3,196, 6 bags adhesive at 520, GST 18%, total 90,421, received 50,000, balance 40,421). Demo owner login 9999999999, OTP 123456; also a restricted Counter user.

TESTS AND ACCEPTANCE (all must pass)
- [x] - Unit: sqft converter (350 sqft, 4 sqft/piece, 4 pcs/box = 22 boxes with no wastage; 23 boxes with 5% wastage; a loose-pieces case); GST split CGST/SGST/IGST; invoice totals and round-off; HSN summary; amount in words (Indian numbering, including lakh and crore); commission calculation; dead-stock days; stock from ledger.
- [x] - INV-113 renders as a PDF whose totals match the numbers above; PDF contains lot/shade column, HSN summary, amount in words, bank details, UPI QR, terms and signature. Thermal receipt renders at 80mm width.
- [x] - Mixed lots of the same design on one invoice warn.
- [x] - Advance booking reserves stock; physical stock unchanged until dispatch.
- [x] - A 200-box order delivered 60 then 140 shows balance 140 then 0 and closes.
- [x] - Returned box goes back to its original lot; wrong-lot return blocked or warned.
- [x] - Display boxes never appear in sellable stock.
- [ ] - Commission payable per partner = rule-based commissions on tagged sales minus payments.
- [x] - Shop A cannot read shop B (test). Counter role cannot see purchase price or profit (test).
- [ ] - Language switch en/hi/or works on every page and every PDF heading (no missing keys).
- [x] - Playwright flow: login, create party, create product with lot, make an invoice using the Sqft Converter, record payment, download PDF, view Who Owes Me, export a report.
- [ ] - Lighthouse PWA check passes; creating a bill offline works and syncs later.
- [ ] - Visual check: each screen in the two reference images exists and is reachable from the sidebar or Simple Mode (list this mapping in SUMMARY.md).

MILESTONES (commit after each)
- [ ] M1: setup, Docker Postgres, Prisma schema, tenant data layer, OTP auth, roles, i18n, design system, app shell (desktop and mobile), Simple/Pro mode, Settings, Plans & Pricing.
- [ ] M2: Parties, Items with Lots, Categories, Add Item form, imports (Excel, barcode), barcode/QR generator.
- [ ] M3: Purchase flow with lots and landed cost, stock ledger, Add Sale with lot picker and Sqft Converter, Payment-In/Out, Who Owes Me, Cash In Hand, Banks, Cheques, Loans, Expenses.
- [ ] M4: PRINT ENGINE: Tax Invoice A4 PDF, thermal receipt, quotation, challan, credit and debit notes, receipts, statements; print template editor; WhatsApp share; amount-in-words; HSN summary; invoice tests.
- [ ] M5: Quotation (room-by-room), Proforma, Sale Order, phase-wise Delivery Challan, Returns, Damage Log, Display stock, Order Flow and reservations, POS mode.
- [ ] M6: Trade Partner CRM, commissions, follow-ups, offers, WhatsApp campaigns and Connect, customer portal, Dead Stock alerts, Home dashboard.
- [ ] M7: Reports (all groups), Excel/PDF exports, GST reports, stock tools (godown transfer, stock count, reorder).
- [ ] M8: Users and roles screens, audit log, backup/restore, offline PWA, voice and photo input, marble slab beta, remaining utilities.
- [ ] M9: seed data, tests, accessibility pass (contrast, tap targets), README, final PLAN.md check, SUMMARY.md.

FINAL DELIVERABLE
A runnable repository: `docker compose up -d`, `npm install`, `npx prisma migrate dev`, `npm run seed`, `npm run dev` gives a working app with the demo login; `npm test` and `npm run build` pass. SUMMARY.md lists every feature and screen from this prompt and the two images as Done, Stub or Not done, honestly.


## Milestone closeout

| Milestone | Status | Implemented and remaining |
| --- | --- | --- |
| M1 | Partial | Local stack, database migration, signed demo sessions, tenant and role checks, responsive shell, settings and plan screens. Full i18n and subscription enforcement remain. |
| M2 | Partial | Parties, products, categories, services and stock lots with barcode lookup in POS. Imports and barcode label generation remain. |
| M3 | Partial | Sale, purchase, stock ledger, core payment, cash and bank screens. Bank reconciliation, tender settlement and richer purchase features remain. |
| M4 | Partial | A4 and 80 mm, HSN and GST totals, trade partner reference, amount in words, UPI QR and the main document types. Full template editor and outbound document delivery remain. |
| M5 | Partial | Room estimate, proforma, order reservations, per-lot dispatch, invoicing conversion, returns, damage, display and POS. Bulk operations and some purchase-side conversions remain. |
| M6 | Partial | Dashboard alerts, dead-stock age, commission accrual, returns and payment records, offers and follow-up records. Customer portal and outbound automations remain. |
| M7 | Partial | HSN, receivables and selected tile operations reports, Excel output, ledger transfers and physical counts. Full statutory/accounting and report catalogs remain. |
| M8 | Partial | Role enforcement, creation audit, device queue, camera and file inputs, voice fallback, marble slab records and JSON export. User management, restore and other utility flows remain. |
| M9 | Partial | Demo seed, test suites, setup guide and screen mapping. Full accessibility and Lighthouse audits and visual inspection of every screen remain. |

Use SUMMARY.md for the feature-by-feature and Board 2 screen mapping. The unchecked scope in the original prompt includes partially implemented and unfinished requirements. No milestone is marked complete where requested items remain.

## Verification run

- Dependency installation and Prisma client generation succeeded.
- Prisma migration and seed succeeded on a temporary native PostgreSQL 18 instance. Docker Compose is included and was not run because Docker is unavailable on this host.
- ESLint, strict TypeScript, Vitest and the production build passed. Vitest ran five tests.
- Six Playwright tests passed against the production build in Chrome, covering invoice creation and payment with Excel/PDF download, role restrictions, tenant isolation, A4 and thermal PDF output, inventory and phase-wise shipment rules, and offline invoice synchronization.
- The exact INV-113 total, payment, balance, HSN, lot/shade, amount in words, UPI QR, bank details, terms and signature were checked in the generated PDF.
- Screens reviewed in Chrome include the desktop Home and Sale Invoices views and mobile Simple Mode. Board 1 was referenced by the prompt and was not supplied as an image.

- Git initialized the workspace. The sandbox denied creation of `.git/index.lock`, so no milestone commit was created here.
