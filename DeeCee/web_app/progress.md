# DeeCee Progress Log

## 2026-05-28

### Starting State
- Confirmed the active DeeCee folder is `DeeCee/web_app`.
- Confirmed the folder contains the app shell, browser code, serverless APIs, checkout core, schema support, and tests.
- Ran `npm run check`; API syntax checks and checkout/security tests passed.

### Security Cleanup
- Found real-looking Supabase and owner secrets inside `.env.example`.
- Replaced `.env.example` values with placeholders and set the owner notification email to `dominiquecreations24@gmail.com`.
- Added `.gitignore` so `.env.local`, Vercel metadata, dependency folders, and build artifacts stay out of source control.

### Remaining Work In This Pass
- Added `server/SCHEMA.complete.sql` so Supabase can be set up from scratch.
- Added `.gitignore`.
- Added `vercel.json` for Vercel routing.
- Added `npm run dev` / `npm run dev:vercel` for Vercel-style local runtime.
- Added `npm run dev:local` and `server/local-dev-server.cjs` as a fallback runtime for static files plus `/api/*`.
- Updated README with the old Vercel project root path and local run modes.

### Decisions Confirmed By User
- Use the existing Supabase project unless it becomes cleaner to replace it later.
- Sanitize `.env.example` and keep real secrets local/server-side only.
- Prepare a complete schema because the base schema has not been run.
- Prefer Vercel dev/serverless style first; local fallback is acceptable too.
- Edit the old Vercel project to point at `DeeCee/web_app`.
- Send payment proof notifications to `dominiquecreations24@gmail.com`.

### Final Verification Pending
- Re-run `npm run check`.
- Confirm public static files still do not expose server secrets or bank account numbers. 

## 2026-05-30

### Production-Ready Payment Pass
- Inspected the current `DeeCee/web_app` architecture: static shell, Supabase auth in the browser, Vercel-style API routes, Supabase-backed subscriptions/transactions, and local fallback server.
- Confirmed `npm run check` passes when launched through `npm.cmd` on Windows; plain `npm` can be blocked by PowerShell execution policy.
- Added a default sandbox payment provider so DeeCee can be tested end-to-end before live money is enabled.
- Added server-side HMAC webhook verification in `api/webhooks/sandbox-payment.js`.
- Added `api/sandbox/complete.js` and `sandbox-checkout.html` so a sandbox payment can be completed, failed, or abandoned locally/Vercel without exposing webhook secrets to the browser.
- Added `server/paymentCore.cjs` for provider selection, payment statuses, public checkout config, webhook signing/verification, subscription activation, and user notification status.
- Updated `/api/checkout` so payment records persist in Supabase with `pending`, `successful`, `failed`, `abandoned`, `refunded`, or `expired` states.
- Updated Settings checkout UI to show sandbox checkout status, open the hosted test page, and display confirmed/failed/abandoned states to the user.
- Kept manual transfer as a fallback through `PAYMENT_PROVIDER=manual_bank`; owner approval now uses `successful` as the production status while still tolerating legacy `succeeded` rows in SQL.
- Added `webhook_events` to the schema for webhook audit trails.
- Added `PAYMENTS_SETUP.md` with environment variables, Supabase setup, local/Vercel test steps, sandbox limitations, and live-provider notes.
- Added payment core tests for public config, status normalization, and webhook signature verification.
- Verified `npm.cmd run check` passes after the payment changes.
- Verified the fallback local server starts at `http://localhost:3002` and serves both `/` and `/sandbox-checkout.html`.

### Browser Runtime Fix
- Added a local Supabase UMD fallback in `index.html` so external browsers can still load auth when the CDN script fails.
- Confirmed `http://localhost:3002/src/config.js` serves the expected public Supabase config.
- Confirmed the local Supabase fallback bundle is reachable at `/node_modules/@supabase/supabase-js/dist/umd/supabase.js`.
- Added `state.ui.authEmail` so the email typed into the login form survives re-renders/clicks instead of clearing.
- Changed the first-run flow to onboarding first, tutorial second, then sign-in/settings.
