# TileBook verification status

## Completed journeys

The production browser runs against the embedded PostgreSQL demo verified phone OTP, creation of a builder and a tile with opening stock, the 350 sqft converter, a 22-box invoice, a ₹500 receipt, invoice PDF download, the ₹2,096 receivable and a numeric Excel report. A second run created an invoice without network access and confirmed exactly one posting after reconnection and reload.

The desktop and mobile route smoke tests passed on the tested baseline. Axe initially reported low contrast on Home. After the colour fix, its checks passed on Home, Parties, Invoices and Settings. The seeded INV-113 PDF, translated headings and 80 mm receipt were checked separately.

## Clean-checkout results

The clean checkout was cloned from a local Git bundle. It reused the existing npm cache. A Windows sandbox directory-creation workaround was applied to the Node process during build and install.

| Command or check | Result |
|---|---|
| npm ci | Passed, 617 packages installed |
| npm run lint | Passed with zero warnings |
| npm run typecheck | Passed after fixing a case-insensitive catalogue import collision |
| npm test | Passed, 63 tests across eight files, including real SQL migrations and seeded PDF checks |
| npm run verify | Exited 1 at npm run db:test. The CLI reported ECONNREFUSED on 127.0.0.1:54322. Earlier lint, typecheck and unit/integration stages passed. |
| npm run build | Clean checkout compiled the production app without cloud credentials |
| Lighthouse 11.7.1 PWA | Score 1.00 on the production login page; all scored PWA audits passed |
| Offline billing | Cold-start run timed out waiting for the demo seed. The harness now waits for database health. The targeted replay passed and checked for a single posting after reconnect. |
| Production dependency audit | Earlier npm audit --omit=dev returned zero high or critical issues and two moderate advisories. |
| Live infrastructure | Docker-backed Supabase Auth, PostgREST and Storage, remote GitHub Actions, live SMS/WhatsApp, Vercel hosting and external payment processing were not verified. |

With Docker running, use npm run setup then npm run verify to exercise the full Supabase gate. Production provisioning and secret names are in DEPLOYMENT.md. Use GITHUB_SETUP.md to publish the private repository.

Feature and reference-screen statuses are maintained in SUMMARY.md. The initial implementation was recovered as a consolidated commit. Separate M1–M9 release builds and one historical branch per milestone were not performed.
## Final fixes and browser evidence

The clean production run passed the billing-to-PDF/Excel journey and the four-screen accessibility audit. Its desktop and mobile smoke checks identified a missing heading on the item library. The final production build passed after adding that heading. The targeted desktop and mobile checks then passed across every sidebar route in 2.9 minutes. The Windows test harness stalled during teardown of the initial five-case run and was interrupted after the individual cases reported their results.

Two additional targeted regression tests passed for public catalogue fields, photo isolation, signed stock movements and salesperson totals. Together with the 63-test clean run, 65 distinct Vitest tests were observed passing. The full Supabase verification command still requires Docker.
