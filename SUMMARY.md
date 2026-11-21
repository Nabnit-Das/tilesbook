# TileBook delivery audit

Done denotes an implemented workflow. Stub denotes a partial implementation or an integration boundary. Browser and database verification are identified separately in STATUS.md. Board 1 was described in the brief; only Board 2 was supplied as an image.

| Reference or workflow | Status | Location and scope |
|---|---|---|
| Board 1 shell and mobile navigation | Done | Home, collapsible navigation, global search, add actions, firm switcher, notifications, help and mobile bottom bar |
| Board 1 Simple/Pro Home | Done | Six shortcuts, voice entry, language chips, balances, period chart, shop alerts, recent invoices, widgets and reports |
| Board 1 parties | Done | Party and referral types, credit limits, addresses, balances, contact import, split details and transactions |
| Board 1 products, services, categories and lots; Board 2 M | Done | Item fields, barcodes, prices, conversion factors, opening lots, shades, stock ledger and low-stock thresholds |
| Board 1 sale invoices/Add Sale | Done | Item/lot selection, converter, line/bill discounts, GST, credit warning, approval, received amount, print/share |
| Board 1 purchase bills and cash/bank | Done | Purchase posting, allocation of landed cost, evidence attachment, payments, balances and cash adjustments |
| Board 1 settings and plans; Board 2 U | Stub | Ten settings tabs, device passcode, Simple Mode, language, printing, trial and premium gates. Sales now respect the credit-warning switch and expose the existing server-side credit-limit block. Some other switches only save preferences. Billing checkout is a preview; accounting runs in INR. |
| Board 2 A | Done | A4, A5 and 80 mm documents, localised headings, HSN, tax split, Indian words, original/copy labels, round-off, balance, bank/UPI QR, terms and signature |
| Statutory IRN, signed QR and e-way bill | Stub | Fields, placeholders and provider interfaces; no statutory submission |
| Board 2 B–C | Done | Room and mixed-unit quotations, proforma, document conversion |
| Board 2 D–F and Board 1 orders | Done | Receipts, advance reservation, staged dispatch, open balances, bulk conversion and original-lot credit notes |
| Board 2 G–I | Done | Purchase orders, reorder suggestions, purchase returns, breakage claims, payments out and expenses |
| Board 2 J–K | Done | Banks, cheques, CSV statement import and reconciliation, loan register and calculated EMI |
| Board 2 L | Done | POS scan entry and thermal bill |
| Board 2 N–P | Done | Damage logs and photos, display/sample exclusion, slab measurements, advance-backed reservation, vein photo and area-conserving remnant cuts |
| Board 2 Q | Done | Trade referrals, commission rules, adjustments on returns, payments, follow-ups, inactive-partner reminders, offers and campaigns |
| Board 2 R | Stub | Customer-scoped expiring portal, message preparation, manual sharing, due reminders and scheduled summary queue. Live WhatsApp/SMS provider delivery needs integration. |
| Board 2 S | Done | Multiple godowns, transfers, count variances and reorder reports |
| Board 2 T and report menu | Stub | Transaction, party, item, GST, tax, expense, orders, bank, loan and all ten tile/marble report groups. P&L, trial balance and balance sheet use derived journal entries. GST/TDS/TCS are review worksheets. SAC is a service master listing. Item/party profitability uses estimated costs. |
| Standard report actions | Done | Date and user scope, active firm, selected-column search, Excel, print and PDF. Consolidated multi-firm reporting is unavailable. |
| Board 2 V | Done | Excel item/party imports, contact picker/vCard, sample item library, bulk edits, lot QR, Tally master XML exchange, exports, verification, onboarding, accountant access and financial-year close |
| Cash voucher XML export | Done | Receipt and Payment exports use the Cash ledger, party ledger and linked bill reference. Validate with the target Tally company before import. |
| Tally voucher import and other voucher exports | Not done | Stock and party master exchange remains available. |
| Linear lot labels | Done | Code 39 print action for supported lot numbers, plus existing QR labels and scanner lookup. Hardware acceptance remains pending. |
| Users, audit and backups | Stub | Five roles, memberships, audit toggle, daily pre-write archives, owner file export, confirmed same-firm v2 file recovery, checkpoint restore and configurable help-video links. Drive upload and bundled help videos are unavailable. Restore requires the original database proof. |
| Additional staff and counter features | Done | Day closing records, attendance, staff advances, complaints, special prices, high-discount approval, printable/shareable design gallery |
| Offline/mobile | Done | Installable manifest and service worker, IndexedDB queues for billing/payment/stock, authenticated replay, idempotent operations, speech/manual fallback and camera/file inputs |
| Data and seed | Done | PostgreSQL migrations, private storage policy definitions, Supabase client types, tenant-scoped RPC, atomic ledger posting and realistic Bhubaneswar demo records |
| External provisioning | Stub | Local repository, setup scripts, Actions templates and deployment guide provided. Hosted services and paid providers require accounts. |
| Verification limits | Stub | See STATUS.md for actual command results. No production certification, device-specific speech/camera validation or Board 1 visual comparison. |

The source inventory of individual documents and report IDs is in src/features/catalog.ts. English, Hindi and Odia dictionary parity is tested. User-entered names, some validation errors and seeded descriptive text remain in their original language.
