# DeeCee Payments Setup

DeeCee now uses a server-verified payment flow that is safe to test on Vercel before live money is enabled. The default provider is `sandbox_pay`, a local test provider that simulates a hosted checkout page and confirms payment through a signed webhook path.

## Required Environment Variables

Set these in `.env` for local fallback testing and in Vercel Project Settings for Vercel testing:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

PAYMENT_PROVIDER=sandbox
PAYMENT_WEBHOOK_SECRET=generate-a-long-random-secret
PAYMENT_SANDBOX_BASE_URL=http://localhost:3002

OWNER_NOTIFICATION_EMAIL=dominiquecreations24@gmail.com
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=DeeCee <verified-sender@your-domain.com>
OWNER_ADMIN_TOKEN=generate-a-long-random-owner-token
```

Never place `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_WEBHOOK_SECRET`, `RESEND_API_KEY`, or `OWNER_ADMIN_TOKEN` in `src/`, `index.html`, or any browser bundle.

## Database Setup

Run `server/SCHEMA.complete.sql` in Supabase SQL Editor before testing checkout. It creates:

- `profiles`
- `plans`
- `subscriptions`
- `transactions`
- `webhook_events`

Payment states are stored as `pending`, `successful`, `failed`, `abandoned`, `refunded`, or `expired`. The schema still accepts old `succeeded` rows so older manual-transfer tests do not break.

## Local Test

From `DeeCee/web_app`:

```powershell
npm.cmd install
npm.cmd run dev:local
```

Open:

```text
http://localhost:3002
```

PowerShell may block `npm`; use `npm.cmd` if you see an execution policy error.

## Sandbox Payment Flow

1. Start the local server.
2. Sign in with Supabase magic link.
3. Go to `Settings`.
4. Pick 6-Day Pass, Monthly, Yearly, or One-Time.
5. Click `Pay in Sandbox`.
6. The sandbox checkout page opens.
7. Click `Complete Test Payment`, `Fail Test Payment`, or `Abandon Payment`.
8. DeeCee returns to Settings and shows the latest payment status.
9. On success, the server activates the subscription and writes a notification marker to the payment metadata.

The sandbox completion endpoint signs an internal webhook payload and sends it through the same signature-verified payment processor used by `/api/webhooks/sandbox-payment`.

## Smoke Checklist

- `npm.cmd run check` passes.
- `npm.cmd run dev:local` starts on `http://localhost:3002`.
- `http://localhost:3002` returns the DeeCee app.
- `http://localhost:3002/sandbox-checkout.html` returns the sandbox checkout page.
- A signed-in user can start checkout from Settings.
- A sandbox completion changes the transaction from `pending` to `successful`, `failed`, or `abandoned`.
- A successful sandbox payment creates or refreshes an active subscription row.
- Refreshing Settings shows the latest payment/subscription state from Supabase, not browser memory.
- Browser files do not contain service keys, owner tokens, webhook secrets, Resend keys, or manual bank account numbers.

## Vercel Test

Use the same environment variables in Vercel, with:

```env
NEXT_PUBLIC_APP_URL=https://your-vercel-preview-url.vercel.app
PAYMENT_SANDBOX_BASE_URL=https://your-vercel-preview-url.vercel.app
```

Then run locally with Vercel CLI:

```powershell
npm.cmd run dev
```

If `vercel` is not installed:

```powershell
npm.cmd i -g vercel
vercel login
```

## Manual Transfer Fallback

Set this only when you want the old manual bank-transfer checkout:

```env
PAYMENT_PROVIDER=manual_bank
```

Manual transfer approval is still owner-token protected through `/api/admin/payments`. Sandbox checkout is recommended before live payment provider wiring.

## Known Limitations

- `sandbox_pay` is a test provider, not a real card processor.
- User email notification uses Resend only if `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` are configured; otherwise DeeCee provides an in-app confirmed payment status.
- Real provider integration should be added behind the same provider abstraction. Keep subscription cards USD-first; local-currency equivalents and Nigerian bank details should appear only through location-aware or explicit Other Currency flows.
