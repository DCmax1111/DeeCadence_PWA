# DeeCee Overview

DeeCee is a local-first personal operating system for tracking daily discipline, focus, learning, money, wellness, faith, and creative output. It turns small logged actions into visible EXP, ranks, quests, and connected stat growth so users can see their life systems improving over time.

## Core Features

### Interwoven Stat System

DeeCee tracks six main stats:

- Body
- Mind
- Spirit
- Knowledge
- Financial
- Dexterity

Actions do not live in isolation. A financial log can improve Financial and give Mind a clarity bonus. A focus session strengthens Mind and may support Knowledge or Dexterity. A prayer or reflection strengthens Spirit and can support Mind or Knowledge. This makes the app feel like one connected system instead of separate trackers.

### Home Dashboard

The Home screen gives the user a quick command-center view:

- Current rank
- EXP progress
- Strongest stat
- Weakest stat
- Attention score
- Daily quests
- Next Best Move
- Recent activity
- Clickable module cards

The dashboard is designed to work on both phone and laptop widths.

### Module Logs

Each module has its own logging flow:

- Financial: income, expenses, personal/business ledger, cashflow
- Spirit: prayers, Bible/reflection logs
- Mind: mood checks, focus logs, DeeCee Focus entry
- Energy: sleep, water, exercise
- Knowledge: reading, vocabulary, skill practice
- Dexterity: creative sessions, quick creative logs, VoxScope preview

Each log updates local state, activity history, and connected EXP.

### DeeCee Focus

The focus system includes:

- Focus session creation
- Live timer
- Four checkpoint segments
- Partial EXP banking at checkpoints
- Pause
- Abandon
- Complete session
- Focus debt tracking
- Attention score
- Floating active timer pill when leaving the Focus page

The four-checkpoint structure lets users benefit from meaningful progress even when real life interrupts a full session.

### DeeCodex Knowledge Lab

DeeCodex is the Knowledge mini-app. It supports:

- Saved vocabulary
- Saved meanings
- Browse mode
- Flashcards
- Click-to-flip cards
- Quiz mode
- Recent vocabulary display with shortened text

It is meant to become the user’s personal learning archive.

### Daily Quests

Daily quests are generated around the user’s selected priority modules from onboarding. They make the system feel more game-like and give the user small daily wins to chase.

### Onboarding And Tutorial

The intended first-run flow is:

1. Onboarding: name, top modules, preferred mode
2. Tutorial: how DeeCee works
3. Sign-in/sign-up: required for cloud-backed subscription and checkout state

Users can still preview the dashboard with local default values.

### Theme System

DeeCee supports:

- Dark theme
- Light theme
- System theme

The interface uses a premium visual style with glassy panels, strong typography, module-colored accents, and responsive layout rules.

### Subscription Checkout

The web app has a Vercel-testable checkout structure:

- Supabase authentication
- Server-side checkout routes
- Sandbox payment provider
- Signed webhook verification
- Persistent payment records
- Payment statuses: pending, successful, failed, abandoned, refunded, expired
- User-facing payment status updates
- Optional Resend notification support
- Manual bank transfer fallback structure

The current default is sandbox mode so the full flow can be tested safely before live payments are enabled.

## User Benefits

### Clarity

Users can see what they are doing across important life areas instead of relying on memory or vague motivation.

### Momentum

Small actions become visible EXP and rank progress. This makes consistency feel rewarding.

### Connected Growth

Because modules affect each other, the user sees how discipline in one area can support another. Money tracking can improve mental clarity. Reading can support Knowledge and Mind. Sleep can support Body and focus.

### Better Focus

The focus system helps users start sessions, recover from interruptions, and reduce focus debt without making the experience feel all-or-nothing.

### Local-First Safety

Core personal logs remain local-first in the browser. Subscription and payment state move to Supabase because those parts need authentication, persistence, and server-side verification.

### Monetization Readiness

The app already has tier cards, locked premium placeholders, payment records, and a subscription activation path. This allows monetization to be added without redesigning the app from scratch.

## Build Architecture

### Frontend

The frontend is a static browser app:

- `index.html`: app shell
- `src/app.js`: routing, state, rendering, logs, focus, onboarding, checkout UI
- `src/config.js`: public browser config
- `src/styles/theme.css`: visual system and responsive styling

The app uses hash-based routing so it can run locally and on Vercel without a heavy framework.

### Local State

Most personal app data is stored in `localStorage`:

- Stats
- Logs
- Focus sessions
- Focus debt
- Activity feed
- Preferences
- Onboarding choices

This allows the app to work quickly and privately without requiring an account for every personal action.

### Backend/API

Server-side logic lives in Vercel-style API routes:

- `api/checkout.js`
- `api/subscription.js`
- `api/sandbox/complete.js`
- `api/webhooks/sandbox-payment.js`
- `api/admin/payments.js`

Shared backend logic lives in:

- `server/manualCheckoutCore.cjs`
- `server/paymentCore.cjs`
- `server/local-dev-server.cjs`

### Database

Supabase is used for cloud-backed account/payment/subscription state:

- `profiles`
- `plans`
- `subscriptions`
- `transactions`
- `webhook_events`

The complete schema is in `server/SCHEMA.complete.sql`.

### Authentication

Supabase Auth provides sign-in/sign-up using magic links. Users can preview the app locally, but checkout and subscription state require authentication.

### Payment Security

Payment confirmation is server-side:

- Secret keys stay out of browser code.
- Checkout routes require bearer auth.
- Admin approval routes require `x-owner-token`.
- Webhooks require HMAC signature verification.
- Payment status changes are stored in Supabase.
- Browser UI only displays payment state; it does not confirm payment by itself.

### Local And Vercel Testing

Primary local commands:

```powershell
npm.cmd run dev:local
npm.cmd run check
```

Vercel-style testing:

```powershell
npm.cmd run dev
```

The local fallback server serves the static app and API handlers on:

```text
http://localhost:3002
```

## Current Limitations

- The sandbox provider is for test payments only.
- Live payment provider wiring still needs a final provider choice.
- User email notifications require Resend environment variables.
- Personal logs are still local-only unless future cloud sync is added.
- The Kivy app is separate and not part of the current production web-app pass.

## Recommended Next Build Steps

1. Run `server/SCHEMA.complete.sql` in Supabase.
2. Confirm Supabase Auth redirect URLs for local and Vercel preview.
3. Test sandbox checkout end-to-end with a signed-in user.
4. Choose the real payment provider for live payments.
5. Add real provider implementation behind the existing payment abstraction.
6. Add cloud backup/sync for local-first logs when the subscription tier allows it.
7. Add a protected owner/admin review page for manual approvals and payment audit history.
