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

## Release verification on 21 November 2026

| Check | Observed result |
| --- | --- |
| Fresh Git clone from a local bundle, npm ci with the local npm cache | Passed on Windows, 617 packages installed without the earlier filesystem preload. No dependency changes between checkout and final build. |
| npm run lint, npm run typecheck, npm test, npm run build | All passed in the clean checkout at eb36a88. Vitest reported 70 tests in 12 files. The production build used no cloud credentials or filesystem preload. |
| npm run e2e | Five passed in 3.5 minutes on the local production demo. Billing, PDF, payment, Excel, offline replay, mobile and desktop routes, and the axe scan passed. The new server teardown returned exit code 0. |
| npm run e2e -- e2e/checkpoint.spec.ts | One additional test passed in the clean production checkout. An owner downloaded a private v2 checkpoint. The counter was denied. The production server started and exited normally. |
| Targeted backup and financial checks | Confirmed same-tenant file recovery from a deleted archive row, rejection of changed files and missing/null confirmation, original-sale return cost and trial balance opening balances. Fixtures were isolated. |
| npm audit --omit=dev --audit-level=high | Zero high, zero critical, two moderate. |
| Docker Supabase and hosted services | The full verify gate retains its previously recorded failure at db:test. Docker and gh are absent. No repeat reset or full verify was run. Storage policy tests now check object visibility and foreign-prefix writes. These assertions await Docker. No remote CI or staging deployment ran. |

For the outstanding gate, start Docker, use a disposable local installation, run `npm run setup`, then in PowerShell run `$env:TEST_SUPABASE='1'` and `npm run verify`. The connector can identify the signed-in GitHub user, but this checkout has no remote. Use GITHUB_SETUP.md to publish with its commit history. No hosted Supabase project was identified as the TileBook staging target.

## Dual-contact registration, 27 November 2026

Resumed from 9776ada. The additive migration wraps the original atomic provisioning function. New owners need verified email and Indian mobile contacts. Existing memberships and authorized staff invitations retain their existing access paths.

Lint and typecheck passed. Vitest passed 87 tests across 14 files. Production compilation passed. Seven Playwright tests passed locally, including the previously failing customer interface, localization, desktop and mobile navigation, accessibility, offline replay, staff backup permissions and billing.

The full verify command stopped at db:test because PostgreSQL refused connections on port 54332. Auth and Mailpit also refused connections. The Docker engine pipe remained unavailable after attempting to launch Docker Desktop. With TEST_SUPABASE=1 the real customer test ran and failed at registration. Actual mailbox verification, both login methods restoring the same records, and the cross-customer browser demonstration remain unverified. The migration was exercised in the isolated PostgreSQL fixture.
