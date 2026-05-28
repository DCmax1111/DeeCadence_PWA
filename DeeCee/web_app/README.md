# DeeCee Web App

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

Manual checkout state is stored in Supabase `transactions`, so refreshes do not
reset pending payment windows. OTPs expire after 30 minutes and must be refreshed
by starting a new checkout.

## Checkout Setup

1. Copy `.env.example` into the Vercel project environment variables.
2. Fill the public browser values in `src/config.js`:
   - `supabaseUrl`
   - `supabaseAnonKey`
   - `appUrl`
3. Run `server/SCHEMA.manual_payments.sql` in Supabase after the base schema.
4. Deploy `web_app` as the project root so `/api/checkout`, `/api/subscription`,
   and `/api/admin/payments` are available.

## Local Checks

```bash
npm run check
```

This validates the serverless API syntax and runs the checkout core tests.
