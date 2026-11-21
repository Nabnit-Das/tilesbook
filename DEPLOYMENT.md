# Deploy TileBook

Use separate Supabase projects and Vercel environments for staging and live books. The repository includes a manually triggered deployment workflow. Hosted credentials, SMS delivery, DNS and a production PDF renderer require operator configuration.

## 1. Prepare and verify the migration

With Node 24 and Docker running, use a clean checkout and local test data.

```sh
npm run setup
npm run verify
npm audit --omit=dev --audit-level=high
```

Create a Supabase project and record its project reference, URL and publishable or legacy anon key. Authenticate the CLI, link the intended project, inspect the planned migration list and apply it. Replace `YOUR_PROJECT_REF` with the actual reference.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

A normal `db push` applies schema migrations. Keep `supabase/seed.sql`, the two fixed OTP users and the Bhubaneswar sample ledger in local/test databases. The migrations create tenant-scoped RPCs and private `lot-photos`, `damage-photos`, `logos`, `generated-pdfs`, `backups` and `vein-match-photos` buckets when Supabase Storage is present. Storage keys start with the owning business UUID. Verify the bucket access policies in the hosted project. Current form photos and logos may be embedded in the saved record, and PDFs are streamed on request. [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## 2. Configure staff sign-in

In Supabase Authentication, enable **Phone** and configure an SMS provider. Choose Twilio and enter the account, messaging service and auth credentials issued by Twilio, or select MessageBird or Vonage and enter that provider's account credentials and sender details. Configure the OTP template and sender for the intended recipients. Set the project Site URL and allowed redirects to the real HTTPS origin. Test with a staff handset. The fixed numbers in `supabase/config.toml` belong to local development. [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login)

Provision the owner's verified E.164 phone in Supabase Auth using a trusted admin session. TileBook requests OTPs for existing Auth users. From the signed-in app, create the first firm with its real name, state and address through the firm setup action. The `tilebook_new_business` RPC assigns the current user the Owner membership, creates the main godown and opens a 14-day trial. If provisioning before a UI session, the authenticated owner can POST the following JSON to `/api/firms` using their same-origin session.

```json
{
  "name": "Dealer's registered name",
  "state": "Odisha",
  "address": "Dealer's billing address"
}
```

Provision each staff phone in Supabase Auth and use the firm's Users screen to grant its intended role. Developer email/password sign-in is available with `ENABLE_DEV_EMAIL_AUTH=1` and a pre-provisioned Auth user and membership. Keep local demo mode disabled in hosted environments.

## 3. Configure Vercel and PDF rendering

Create a Vercel project from the private repository. Select the **Next.js** preset, the repository directory containing `package.json` and Node 24. Use `npm ci` to install and `npm run build` to build. Set scoped environment variables for each target before building it. [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)

| Vercel variable                             | Value and scope                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                  | HTTPS project API URL for the environment                                                                                                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | Publishable/anon key for that project. RLS and the session determine access                                                                            |
| `APP_URL`                                   | Canonical HTTPS application origin                                                                                                                     |
| `TILEBOOK_LOCAL_DEMO`                       | `0` for hosting                                                                                                                                        |
| `ENABLE_DEV_EMAIL_AUTH`                     | `0` for ordinary staff deployments                                                                                                                     |
| `PLAYWRIGHT_CDP_ENDPOINT`                   | Server-only authenticated HTTPS/WSS endpoint for a trusted Chromium service supporting Chrome DevTools Protocol. Use this for serverless PDF rendering |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`       | Alternative on a self-managed Node host with Chromium installed. Provide the executable's absolute path                                                |
| `SMS_PROVIDER_KEY`, `WHATSAPP_PROVIDER_KEY` | Reserved for application messaging adapters. Supabase Auth SMS credentials are configured in Supabase                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`                 | Optional for privileged operator tooling outside the app. The normal server and browser use the public client key and the authenticated user's session |

The PDF renderer transmits invoice markup to the configured Chromium process. Use a private authenticated renderer authorised to process the shop's customer data. The fonts and generated UPI QR travel inside the document. Check at least one invoice in all three heading languages and one 80 mm receipt on the hosted renderer. The standalone Node option uses Playwright's installed Chromium if no explicit executable path is set. Linux hosts can install it with `npx playwright install --with-deps chromium`.

## 4. Configure GitHub and deploy

Create the GitHub Actions **production** environment and set the six secrets read by `.github/workflows/deploy.yml`.

| Secret                  | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN` | Authorises the CLI deployment identity                 |
| `SUPABASE_PROJECT_REF`  | Identifies the destination Supabase project            |
| `SUPABASE_DB_PASSWORD`  | Database credential for linking and migration commands |
| `VERCEL_TOKEN`          | Authorises the workflow in the target Vercel team      |
| `VERCEL_ORG_ID`         | Target Vercel team or account ID                       |
| `VERCEL_PROJECT_ID`     | Target Vercel project ID                               |

Run Actions → **Deploy production** → **Run workflow** against the reviewed commit. The workflow links Supabase, pulls Vercel's production configuration, builds the application, pushes the database migrations and deploys the prebuilt output. Keep schema changes compatible with the previous app release while traffic switches. Follow the job logs for each stage. [GitHub setup](GITHUB_SETUP.md)

Add the desired domain under the Vercel project's **Domains** settings. Enter the DNS records displayed for that domain at its DNS provider. After certificate verification, update `APP_URL`, the Supabase Site URL and allowed redirects, then redeploy. Check that `GET /api/health` on the canonical domain returns HTTP 200 and `{"status":"ok","database":"connected"}`. Exercise an owner login, a restricted-role login, a test bill, an export, a PDF download and a customer portal link in staging before opening the production shop. [Vercel domains](https://vercel.com/docs/domains)

## Recovery, observability and integration work

Enable the required backup retention and point-in-time recovery for the hosted Supabase plan. Database backups contain Storage metadata. Arrange separate backups for stored objects and rehearse a restore in an isolated project. TileBook's owner-controlled business restore points and local exports provide additional business-level recovery. [Supabase backups and PITR](https://supabase.com/docs/guides/platform/backups)

Monitor `/api/health`, HTTP errors, database and Auth logs, SMS delivery and the PDF renderer. Sentry is a future integration point. Configuring an error-reporting DSN also requires adding and initialising the SDK. The feature matrix distinguishes implemented workflows from provider stubs, including scheduled WhatsApp dispatch, payment checkout, Drive backup and statutory invoice services. [Feature and verification status](STATUS.md)

The seed's GST rates, HSN codes and sample invoice are demonstration data. Before issuing statutory documents, have the dealer's chartered accountant verify the applicable tax classification, rates, reporting obligations and current e-invoice and e-way formats. A UPI payment QR is a merchant payment request. Actual statutory IRN and signed QR values must come from an authorised integration.

Preserve the private tilebook.export_proofs table in database backups. Accounting exports contain sensitive financial data and do not include Storage objects. Rehearse v2 restore in a copy of the same firm with its proof register. Run the database Storage policy tests in a disposable Supabase stack before enabling customer uploads. The authenticated connector listed projects without an explicit TileBook staging designation. No existing hosted database was selected or modified.
