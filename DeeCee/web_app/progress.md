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

## 2026-06-06

### Supabase Schema Compatibility
- Investigated Supabase error `ERROR: 42703: column "id" referenced in foreign key constraint does not exist`.
- Identified the likely cause as an existing Supabase project with older `profiles`, `plans`, `subscriptions`, or `transactions` tables that do not match DeeCee's expected schema.
- Updated `server/SCHEMA.complete.sql` with guarded compatibility repairs that add missing `id` and app columns before foreign-key-dependent tables are created.
- Changed DeeCee plan seeding away from `ON CONFLICT (product, tier)` so it can run even if an older `plans` table does not have that unique constraint yet.
- Updated `22_HOUR_LAUNCH_STEPS.txt` to clarify publishable Supabase keys versus private service-role keys and explain what to do if the `id` foreign-key error appears.

### Subscription Pricing Update
- Replaced the old Starter/Growth/Operator plan set with:
  - 6-Day Pass: $0.99 for 6 days
  - Monthly: $3.99 for 30 days
  - Yearly: $39.99 for 365 days
  - One-Time: $99.99 for long-term access
- Kept subscription plan cards USD-first by default while allowing NGN estimates and Nigerian bank details through likely-Nigeria detection or an explicit Other Currency button.
- Updated server plan metadata so subscription activation uses each plan's access duration instead of always granting one month.
- Updated Supabase plan seeding and browser fallback plans to match the new pricing.
- Verified `npm.cmd run check` passes after the pricing change.

### Focus And Wiring Audit
- Re-ran the full web app check suite and verified API syntax, payment tests, static leak checks, and browser bundle parsing.
- Added `tests/staticWiring.test.cjs` to catch rendered forms that do not have matching `handleForm` branches.
- Improved DeeCee Focus block tracking:
  - Sessions are split into four visible blocks.
  - The active timer now shows `Block X/4`.
  - Checkpoints display as `Block 1` through `Block 4`.
  - Ending a session records the block reached and elapsed time.
  - Cancelling/abandoning a session now creates a focus session record with the block reached and no XP.
  - Manual ending only awards newly completed/unbanked blocks, preventing unearned remaining-block XP.
- Verified `npm.cmd run check` passes after the focus and wiring changes.

### Focus Strength And Beta Testing Mode
- Added Supabase schema support for `focus_sessions` with block/duration check constraints.
- Added Supabase schema support for global `app_config` with `beta_testing_active` initialized to `true`.
- Added standalone SQL file `server/SCHEMA.focus_strength_and_app_config.sql` so this feature can be applied without rerunning the complete schema.
- Added `api/focus-strength.js`:
  - `POST` records signed-in user focus sessions with attempted/completed blocks.
  - `GET ?group=week|month` returns chart-ready Focus Strength scores.
- Added `api/app-config.js` with short-lived server-side caching for the beta testing flag.
- Updated `api/subscription.js` so beta testing mode grants signed-in users full access without standard subscription validation.
- Added `server/beta_access.py` for Python services using `supabase-py`, with TTL caching and a subscription-bypass helper.
- Added a Home dashboard beta marquee that appears only when backend `beta_testing_active` is true.
- Added a responsive premium SVG Focus Strength line graph with weekly/monthly toggle.
- Added tests for the Focus Strength formula and grouping.
- Verified `npm.cmd run check` passes after the Focus Strength and beta mode changes.
# 2026-06-08 Onboarding Continue Fix

- Fixed onboarding Continue by routing both button click and form submit through one `finishOnboarding()` function.
- Added immediate cadence-mode behavior:
  - Balanced selects Financial, Mind, Knowledge.
  - Focus selects Mind, Energy, Knowledge.
  - Wellness selects Mind, Energy, Spirit.
  - Creative selects Mind, Dexterity, Knowledge.
  - Scholar selects Mind, Knowledge, Spirit.
- Added a short visible mode note so the selector explains what it is doing.
- Preserved typed onboarding name across mode changes.
- Verified `npm.cmd run check` and `npm.cmd run build` pass.
# 2026-06-08 Password Account Portal

- Replaced the magic-link-only path with a dedicated Account route.
- Added Gmail-only Create Account and Sign In forms.
- Added username/display name profile persistence through Supabase `profiles`.
- Added server-side password auth endpoint:
  - register creates a Supabase Auth user with Gmail/password,
  - creates/updates `profiles`,
  - returns a Supabase session for browser persistence.
- Added username or Gmail sign-in through the server route.
- Added `SCHEMA.account_profiles.sql` for profile email/username columns, constraints, and indexes.
- Added auth validation tests and included new auth/profile routes in `npm run check`.
- Verified `npm.cmd run check` and `npm.cmd run build` pass.
# 2026-06-09 Account Flow And Admin Gate Hardening

- Hid Settings from signed-out users; signed-out navigation now uses Account instead.
- Settings route now redirects to Account unless the user is signed in.
- Admin panel is hidden unless `/api/admin/me` confirms the signed-in account matches owner env values.
- Admin payment endpoints now require both:
  - authenticated owner session,
  - valid `OWNER_ADMIN_TOKEN`.
- Added stronger password rules:
  - 8+ characters,
  - at least one letter,
  - at least one number,
  - at least one symbol.
- Added live password checklist and confirm-password matching without saving passwords to localStorage.
- Create Account now creates the Supabase Auth user/profile and then moves to Sign In instead of silently auto-logging in.
- Subscription plan price typography is now more minimal and numeric.
- Verified local smoke check, `npm.cmd run check`, and `npm.cmd run build`.
