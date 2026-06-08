# DeeCee

DeeCee is a personal growth web app built around one core idea: your habits should connect. Money discipline should sharpen mental clarity. Focus sessions should improve your Mind score. Reading should build Knowledge and quietly support your overall cadence.

The app combines a local-first life dashboard, gamified module progression, DeeCadence focus training, vocabulary tools, daily quests, and subscription-ready cloud checkout into one responsive web experience.

## What DeeCee Does

DeeCee tracks six connected life modules:

- **Financial**: income, expenses, cashflow, and intentional money logs.
- **Spirit**: prayer, reflection, Bible study, and leadership habits.
- **Mind**: focus, mood, DeeCadence sessions, and Focus Strength.
- **Energy**: sleep, water, movement, and body-care logs.
- **Knowledge**: reading, vocabulary, skills, flashcards, quizzes, and DeeCodex.
- **Dexterity**: creative practice, craft sessions, and VoxScope-style creative growth.

Each action updates its primary module and can trigger smaller cross-module bonuses. The result is a system where the user is not just filling forms, but building a visible personal rank over time.

## Core Experience

- Responsive dashboard for phone, tablet, and laptop screens.
- Local-first logs and stats for fast private use.
- Gamified EXP, rank, daily quests, and upgrade animations.
- DeeCadence focus timer with four progress blocks.
- Focus Strength score based on weekly/monthly completion and consistency.
- DeeCodex knowledge lab with saved vocabulary, flashcards, quizzes, and browse mode.
- Theme support for dark, light, and system preference.
- Supabase-backed authentication, subscription status, and payment records.
- Vercel-ready serverless API routes for checkout, webhooks, app config, and focus analytics.

## Subscription Checkout

DeeCee is prepared for sandbox-first subscription testing. The checkout flow is designed so payment state cannot be faked from the browser:

- Users sign in before starting checkout.
- Payment records are stored server-side.
- Webhooks verify signatures before changing payment status.
- The app shows pending, successful, failed, abandoned, expired, or refunded states.
- Beta Testing Mode can be toggled from Supabase using the `app_config` table.

Current plans:

- **6-Day**: `$0.99`
- **Monthly**: `$3.99`
- **Yearly**: `$39.99`
- **Lifetime**: `$99.99`

## Project Structure

```text
web_app/
  index.html
  src/
    app.js
    config.js
    styles/
  api/
    checkout.js
    payment-status.js
    subscription.js
    focus-strength.js
    app-config.js
    webhooks/
  server/
    SCHEMA.complete.sql
    SCHEMA.focus_strength_and_app_config.sql
    local-dev-server.cjs
    paymentCore.cjs
    focusStrengthCore.cjs
  tests/
```

## Local Development

```powershell
cd DeeCee/web_app
npm install
npm run dev:local
```

Then open:

```text
http://localhost:3002
```

Run checks:

```powershell
npm run check
```

## Deployment

The web app is designed to deploy on Vercel from:

```text
DeeCee/web_app
```

Database setup is handled through Supabase SQL files in `server/`. Environment variables are required for Supabase, payment verification, owner access, and optional email notifications.

Private deployment notes and environment-variable guidance should stay out of the public README and out of Git history.

## Status

DeeCee is currently in production-readiness testing for the authenticated web app, sandbox checkout flow, focus analytics, and Supabase-backed feature flags.
