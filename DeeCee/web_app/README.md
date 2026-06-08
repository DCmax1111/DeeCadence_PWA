# DeeCee Web App

## Vercel Deployment Notes

DeeCee's production web app should be deployed from this folder:

```text
DeeCee/web_app
```

In Vercel, set the project **Root Directory** to `DeeCee/web_app`. If another old Vercel project is still connected to this repository and points to a removed folder such as `admin_web`, disconnect that old project or update its root directory. Otherwise GitHub may show a failed Vercel check even when the real DeeCee deployment succeeds.

Environment variables are managed inside **Project Settings -> Environments -> Production -> Environment Variables** in the current Vercel dashboard. Public browser keys may use the `NEXT_PUBLIC_` prefix, but private server keys must not.

Safe public variables:

```env
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Server-only variables:

```env
SUPABASE_SERVICE_ROLE_KEY
PAYMENT_PROVIDER
PAYMENT_WEBHOOK_SECRET
PAYMENT_SANDBOX_BASE_URL
OWNER_ADMIN_TOKEN
OWNER_NOTIFICATION_EMAIL
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL
```

After changing Vercel environment variables or the root directory, redeploy the latest deployment so the changes take effect.

DeeCee is the main local-first browser app. It still opens directly from
`index.html`, while server-only payment work lives outside the public `src/`
bundle.

## Shape

- `index.html` is the app shell.
- `src/styles/theme.css` holds the design system.
- `src/app.js` holds routing, local state, scoring, focus, and module rendering.
- `api/` holds deploy-time serverless functions. Do not expose these as static files.
- `server/` holds shared backend-only checkout logic and SQL support files.
- `tests/` holds Node tests for server logic.
- `public/` is reserved for icons, manifest, and static assets.

## Security Boundary

The browser app must never contain `SUPABASE_SERVICE_ROLE_KEY`,
`OWNER_ADMIN_TOKEN`, `RESEND_API_KEY`, or bank-verification logic. The browser
may request `/api/checkout`, but the API must run on a serverless host such as
Vercel with environment variables configured.

Payment state is stored in Supabase `transactions`, so refreshes do not reset
pending checkout windows. Sandbox checkout is the default; manual transfer can
be enabled later with `PAYMENT_PROVIDER=manual_bank`.

## Checkout Setup

1. Rotate any service-role key that was ever stored in a tracked file.
2. Copy `.env.example` into the Vercel project environment variables.
2. Fill the public browser values in `src/config.js`:
   - `supabaseUrl`
   - `supabaseAnonKey`
   - `appUrl`
3. Run `server/SCHEMA.complete.sql` in Supabase SQL Editor.
4. Set the old Vercel project root directory to this folder: `DeeCee/web_app`.
5. Deploy `web_app` as the project root so `/api/checkout`, `/api/subscription`,
   `/api/sandbox/complete`, `/api/webhooks/sandbox-payment`, and
   `/api/admin/payments` are available.
6. See `PAYMENTS_SETUP.md` for sandbox payment test steps, webhook verification,
   and live-provider limitations.

## Local Running

Vercel-style local runtime, closest to production:

```bash
cd "DeeCee/web_app"
npm install
vercel dev --listen 3002
```

Fallback local runtime, useful if Vercel CLI is not available:

```bash
cd "DeeCee/web_app"
copy .env.example .env.local
npm run dev:local
```

The fallback server serves `index.html` and the same `/api/*` handlers, but Vercel
dev should be treated as the primary pre-deploy check.

## Local Checks

```bash
npm run check
```

This validates the serverless API syntax and runs the checkout core tests.
