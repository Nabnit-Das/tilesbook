# TileBook verification status

## Completed journeys

The production browser runs against the embedded PostgreSQL demo verified phone OTP, creation of a builder and a tile with opening stock, the 350 sqft converter, a 22-box invoice, a ₹500 receipt, invoice PDF download, the ₹2,096 receivable and a numeric Excel report. A second run created an invoice without network access and confirmed exactly one posting after reconnection and reload.

The desktop and mobile route smoke tests passed on the tested baseline. Axe initially reported low contrast on Home. After the colour fix, its checks passed on Home, Parties, Invoices and Settings. The seeded INV-113 PDF, translated headings and 80 mm receipt were checked separately.

## Outstanding verification

Docker and the GitHub CLI were absent during the run. Embedded SQL tests do not exercise Supabase Auth, PostgREST or Storage services. The hosted Supabase, SMS, GitHub and Vercel steps require operator provisioning. The local source and testing commands are in README.md. Final command results and the feature audit will be recorded here as additional work lands.
