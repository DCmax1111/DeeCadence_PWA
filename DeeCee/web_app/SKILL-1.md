---
name: premium-deecee-web-app-creation
version: 2.0.0
description: Use this skill to design, build, audit, and refine DeeCee as a premium local-first personal operating system web app. The standard is product-grade, founder-grade, and better than ordinary agency websites: strategic, fast, beautiful, secure, maintainable, and commercially ready.
---

# Premium DeeCee Web App Creation Skill

## 1. Mission

Build DeeCee as a premium local-first personal operating system, not a generic productivity app, habit tracker, finance tracker, or pretty landing page.

DeeCee exists to help users track daily discipline, focus, learning, money, wellness, faith, and creative output. Small logged actions become visible EXP, ranks, quests, connected stat growth, and momentum. The product must make the user feel that their life systems are becoming measurable, structured, and stronger over time.

The standard is not “nice website.” The standard is:

- product-grade interface
- premium brand perception
- fast local-first experience
- strong mobile and laptop usability
- clean architecture
- credible monetization path
- secure checkout and subscription handling
- emotionally rewarding daily use
- maintainable code that Codex can continue improving

A premium DeeCee build must feel like a private command center, not a toy dashboard.

---

## 2. Core Product Identity

DeeCee is a local-first personal operating system with six interwoven stats:

- Body
- Mind
- Spirit
- Knowledge
- Financial
- Dexterity

The system must avoid isolated trackers. Actions should affect the relevant primary stat and, where logical, create secondary stat effects.

Examples:

- A financial log strengthens Financial and may give Mind a clarity bonus.
- A focus session strengthens Mind and may support Knowledge or Dexterity.
- A prayer or reflection strengthens Spirit and may support Mind or Knowledge.
- Sleep, water, or exercise strengthens Body and improves the conditions for focus.
- Creative sessions strengthen Dexterity and may increase Mind or Knowledge depending on the action.

The product metaphor is connected growth. A user should feel that one disciplined action can strengthen more than one part of life.

---

## 3. When to Use This Skill

Use this skill whenever working on DeeCee or a DeeCee-related web app task, including:

- product planning
- landing page creation
- dashboard design
- module design
- onboarding flow
- tutorial flow
- stat system logic
- EXP and rank logic
- focus timer system
- daily quest system
- DeeCodex Knowledge Lab
- finance/money logs
- faith/reflection logs
- creative output logs
- localStorage architecture
- Supabase authentication
- subscription checkout
- payment records
- admin/payment review
- premium UI improvements
- accessibility and responsive audits
- Codex implementation prompts
- repo audits
- bug fixes
- production readiness checks

Do not use generic website advice when DeeCee-specific product logic is needed.

---

## 4. Non-Negotiable Product Principles

### 4.1 Product Before Decoration

Every design decision must support one of these outcomes:

- help the user know what to do next
- make logged progress visible
- reduce friction in daily use
- strengthen trust in the product
- make DeeCee feel premium and serious
- support monetization without cheapening the experience

Avoid decorative complexity that does not improve clarity, retention, trust, or conversion.

### 4.2 Local-First by Default

Core personal logs should remain local-first unless cloud sync is intentionally added.

Local-first data includes:

- stats
- personal logs
- focus sessions
- focus debt
- activity feed
- preferences
- onboarding choices
- daily quest state

Subscription/payment/account state belongs in Supabase because it requires authentication, persistence, server verification, and auditability.

### 4.3 Premium Means Controlled

Premium DeeCee UI should feel:

- focused
- quiet
- elegant
- slightly cinematic
- intelligent
- structured
- powerful without shouting

Avoid:

- random gradients
- childish gamification
- weak mobile spacing
- cluttered cards
- cheap gold overuse
- inconsistent icons
- generic SaaS copy
- dashboards that show many numbers but no meaning

### 4.4 The App Must Reward Partial Progress

Real life interrupts users. DeeCee should not be all-or-nothing.

The focus system especially must reward meaningful progress through checkpoint EXP banking, partial completion, and clear session recovery.

### 4.5 Design for Daily Return

The user must have a reason to open DeeCee every day.

The daily return loop is:

1. See current state.
2. See the Next Best Move.
3. Log one small action.
4. Watch stats/EXP/activity update.
5. Feel momentum.
6. Return later to continue.

If a feature does not strengthen this loop, question whether it belongs now.

---

## 5. Product Architecture Summary

### 5.1 Frontend

Current frontend architecture:

- `index.html` — app shell
- `src/app.js` — routing, state, rendering, logs, focus, onboarding, checkout UI
- `src/config.js` — public browser config
- `src/styles/theme.css` — visual system and responsive styling

The app uses hash-based routing so it can run locally and on Vercel without a heavy framework.

### 5.2 Backend/API

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

### 5.3 Database

Supabase is used for cloud-backed account/payment/subscription state:

- `profiles`
- `plans`
- `subscriptions`
- `transactions`
- `webhook_events`

The complete schema is in:

- `server/SCHEMA.complete.sql`

### 5.4 Authentication

Supabase Auth provides sign-in/sign-up using magic links.

Users may preview the app locally, but checkout and subscription state require authentication.

### 5.5 Local and Vercel Testing

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

---

## 6. Premium UX Requirements

### 6.1 Home Dashboard

The Home dashboard is the command center. It should show:

- current rank
- EXP progress
- strongest stat
- weakest stat
- attention score
- daily quests
- Next Best Move
- recent activity
- clickable module cards

The dashboard must answer these questions within seconds:

- Where am I now?
- What is improving?
- What is weak?
- What should I do next?
- What did I recently complete?
- Which module needs attention?

Do not make the dashboard a pile of cards. It needs hierarchy.

Recommended dashboard order:

1. Identity/rank/status header
2. EXP and attention overview
3. Next Best Move
4. Daily quests
5. Stat grid
6. Module cards
7. Recent activity

### 6.2 Module Logs

Each module needs a fast logging flow.

Modules:

- Financial: income, expenses, personal/business ledger, cashflow
- Spirit: prayers, Bible/reflection logs
- Mind: mood checks, focus logs, DeeCee Focus entry
- Energy: sleep, water, exercise
- Knowledge: reading, vocabulary, skill practice
- Dexterity: creative sessions, quick creative logs, VoxScope preview

Logging rules:

- The shortest useful log should take less than 20 seconds.
- Forms should not feel like spreadsheets unless the module requires structure.
- Every successful log should update stats, EXP, activity history, and relevant connected bonuses.
- The user should receive immediate feedback after logging.
- Empty states should guide action, not merely say “nothing here.”

### 6.3 DeeCee Focus

The focus system must include:

- focus session creation
- live timer
- four checkpoint segments
- partial EXP banking at checkpoints
- pause
- abandon
- complete session
- focus debt tracking
- attention score
- floating active timer pill when leaving the Focus page

Focus UX rules:

- Starting a session must be fast.
- The timer must remain visible or recoverable.
- The user must understand checkpoint progress.
- Abandoning should not feel catastrophic, but it should have a consequence.
- Completing should feel rewarding without becoming childish.
- Partial EXP banking must be clear and honest.

### 6.4 DeeCodex Knowledge Lab

DeeCodex is the Knowledge mini-app. It supports:

- saved vocabulary
- saved meanings
- browse mode
- flashcards
- click-to-flip cards
- quiz mode
- recent vocabulary display with shortened text

DeeCodex should feel like a personal learning archive, not a random notes page.

UX priorities:

- quick add
- easy review
- clear recent items
- flashcard interaction that works on mobile
- short meanings displayed cleanly
- longer meanings accessible without clutter

### 6.5 Daily Quests

Daily quests are generated around selected priority modules from onboarding.

Quest rules:

- Quests should be small enough to complete.
- Quests should not overload the user.
- Quests should connect to stats.
- Quest completion should create momentum.
- Quests should avoid fake motivation language.

### 6.6 Onboarding and Tutorial

Intended first-run flow:

1. Onboarding: name, top modules, preferred mode
2. Tutorial: how DeeCee works
3. Sign-in/sign-up: required for cloud-backed subscription and checkout state

Users can still preview the dashboard with local default values.

Onboarding must not be too long. Capture only what changes the first experience.

---

## 7. Premium Visual System

### 7.1 Visual Direction

Default DeeCee visual direction:

- dark-first interface
- premium glassy panels
- strong typography
- module-colored accents
- responsive layout rules
- restrained animation
- crisp cards
- confident spacing
- cinematic but usable

The product should look like a private operating system for a disciplined person.

### 7.2 Color Rules

Use restrained palettes.

Recommended base:

- near-black / deep charcoal background
- off-white primary text
- muted secondary text
- subtle glass panel surfaces
- one premium accent system
- module-specific accents used carefully

Module accent colors should help orientation, not create visual noise.

Rules:

- Use one dominant background system.
- Use accents sparingly.
- Avoid bright rainbow dashboards.
- Avoid gold everywhere.
- Ensure text contrast is readable.
- Light theme must not feel like an afterthought.
- System theme should respect user preference.

### 7.3 Typography Rules

Use typography to create authority.

Rules:

- clear heading scale
- readable body text
- consistent font weights
- strong numeric styling for stats
- short labels
- no tiny low-contrast text for important data
- no excessive uppercase
- no massive paragraphs inside cards

### 7.4 Layout Rules

Premium layout is controlled rhythm.

Rules:

- strong max-width containers
- mobile-first stacking
- laptop/tablet layout that uses space intelligently
- consistent card spacing
- predictable module grid
- no cramped tap targets
- no misaligned cards
- no inconsistent radii/shadows

### 7.5 Motion Rules

Use motion only to clarify or reward.

Good motion:

- subtle progress animation
- checkpoint feedback
- card hover elevation
- timer state transitions
- flashcard flip
- route transition restraint

Bad motion:

- constant glowing
- slow decorative animations
- random bouncing
- effects that make the app feel cheap
- motion that hides slow performance

---

## 8. Conversion and Monetization Requirements

DeeCee already has monetization readiness through:

- tier cards
- locked premium placeholders
- payment records
- subscription activation path
- sandbox checkout structure
- manual bank transfer fallback structure

### 8.1 Subscription UX

Subscription pages must clearly explain:

- what is free
- what is premium
- what gets unlocked
- why premium exists
- payment status
- next action after payment
- what to do if payment fails or is pending

Avoid desperate sales language. DeeCee premium should feel like unlocking deeper systems, not buying shiny extras.

### 8.2 Payment Status States

The app must handle:

- pending
- successful
- failed
- abandoned
- refunded
- expired

Each state should have a clear user-facing message and next action.

### 8.3 Manual Transfer Fallback

Manual bank transfer should feel legitimate and controlled.

It should include:

- clear instructions
- reference/identifier where needed
- payment proof guidance
- pending review state
- admin approval path
- audit history

Do not make manual payments feel like informal chat-based chaos.

---

## 9. Security and Backend Rules

### 9.1 Payment Security

Payment confirmation must be server-side.

Rules:

- Secret keys must stay out of browser code.
- Checkout routes require bearer auth.
- Admin approval routes require `x-owner-token`.
- Webhooks require HMAC signature verification.
- Payment status changes must be stored in Supabase.
- Browser UI only displays payment state; it must not confirm payment by itself.

### 9.2 API Rules

API routes should:

- validate required inputs
- return clear error messages
- avoid leaking secrets
- avoid trusting browser-provided payment status
- log important server-side events where appropriate
- handle missing env vars gracefully in local/sandbox mode

### 9.3 Supabase Rules

When working with Supabase:

- run `server/SCHEMA.complete.sql` before relying on tables
- confirm RLS policies where applicable
- confirm auth redirect URLs for local and Vercel preview
- separate public browser config from private server secrets
- treat payment records as audit data

---

## 10. Engineering Rules for Codex

### 10.1 Before Editing

Before making code changes, inspect:

- current file structure
- relevant existing functions
- current state shape
- current localStorage keys
- current routing pattern
- current CSS variables/classes
- current API routes if backend-related
- current tests/check scripts

Do not rewrite large files blindly.

### 10.2 Change Strategy

Prefer surgical improvements over destructive rewrites.

Good changes:

- isolate new helpers
- preserve existing state where possible
- add migration handling for localStorage shape changes
- improve naming without breaking routes
- add UI states for loading/error/empty/success
- keep components or render sections readable

Bad changes:

- replacing the whole app with a different framework without instruction
- deleting existing payment flow
- changing localStorage schema without migration
- putting secrets in frontend config
- turning a static app into a complex architecture prematurely
- making UI beautiful while breaking core flows

### 10.3 State Management

Local state must remain understandable.

When adding data:

- define the shape clearly
- provide defaults
- handle old/missing values
- avoid circular data structures
- avoid storing huge unnecessary objects
- update activity history consistently
- update EXP/stat effects consistently

### 10.4 Routing

The app uses hash-based routing.

Rules:

- preserve route compatibility
- ensure direct route reload works where possible
- active nav state should match the route
- missing routes should fail gracefully
- checkout/subscription routes should handle auth state clearly

### 10.5 CSS and Theme

When editing `src/styles/theme.css`:

- use existing variables where possible
- keep dark/light/system theme support
- maintain responsive rules
- avoid one-off styles unless necessary
- keep card, button, input, and layout styles consistent
- test phone width and laptop width

---

## 11. Quality Bar

A DeeCee feature is not done until it passes these checks.

### 11.1 Product Check

- Does this help the user act, understand, or return?
- Does it strengthen the DeeCee operating-system feeling?
- Does it avoid unnecessary complexity?
- Does it fit the six-stat system?
- Does it make progress more visible?

### 11.2 UX Check

- Can a user understand the page in 5 seconds?
- Is the primary action obvious?
- Are empty states useful?
- Are error states clear?
- Are success states satisfying?
- Does it work on phone and laptop?
- Are tap targets comfortable?

### 11.3 Visual Check

- Does it feel premium, not decorative?
- Is spacing consistent?
- Is typography strong?
- Are colors restrained?
- Are module accents helpful?
- Are cards aligned?
- Does light theme still look intentional?

### 11.4 Technical Check

- Does `npm.cmd run check` pass?
- Does `npm.cmd run dev:local` work?
- Does `npm.cmd run dev` work for Vercel-style testing where relevant?
- Are console errors removed?
- Are localStorage migrations safe?
- Are API errors handled?
- Are secrets kept server-side?

### 11.5 Monetization Check

- Does auth gating work?
- Does sandbox checkout work end-to-end?
- Are payment statuses represented clearly?
- Are subscription states accurate?
- Is manual transfer fallback controlled?
- Is admin review protected?

---

## 12. Recommended Next Build Steps

When continuing DeeCee, prioritize in this order:

1. Run `server/SCHEMA.complete.sql` in Supabase.
2. Confirm Supabase Auth redirect URLs for local and Vercel preview.
3. Test sandbox checkout end-to-end with a signed-in user.
4. Tighten dashboard visual hierarchy and Next Best Move logic.
5. Audit all module logging flows for speed and consistency.
6. Strengthen DeeCee Focus checkpoint UX and floating timer behavior.
7. Improve DeeCodex review/flashcard/quiz polish.
8. Choose the real payment provider for live payments.
9. Add real provider implementation behind the existing payment abstraction.
10. Add cloud backup/sync for local-first logs when the subscription tier allows it.
11. Add a protected owner/admin review page for manual approvals and payment audit history.

Do not jump to cloud sync or live payments before sandbox checkout, auth redirects, and local app stability are proven.

---

## 13. Premium Landing Page Rules for DeeCee

If building a public-facing DeeCee landing page, structure it like this:

1. Hero: DeeCee as a personal operating system, not a habit tracker.
2. Problem: scattered life tracking, lost momentum, invisible progress.
3. Product demo: dashboard, stat system, focus, quests, logs.
4. Core loop: log action → gain EXP → grow stats → see next move.
5. Feature sections: interwoven stats, DeeCee Focus, DeeCodex, finance/wellness/faith/creative logs.
6. Local-first trust: personal logs stay local by default.
7. Premium tiers: free preview vs premium unlocks.
8. Final CTA: start preview, sign in, or join premium.

Landing page copy should be sharp and specific. Avoid generic phrases like “boost your productivity” unless explained through DeeCee’s actual system.

Better phrasing:

- “Turn small daily actions into visible growth.”
- “A private operating system for discipline, focus, learning, money, faith, wellness, and creative output.”
- “Track the work your future self is built from.”
- “Not another habit tracker. A connected growth system.”

Avoid:

- “Unlock your potential.”
- “Be your best self.”
- “Transform your life today.”
- “Revolutionary productivity app.”

---

## 14. Codex Prompt Template

Use this prompt when asking Codex to work on DeeCee:

```text
You are working on DeeCee, a premium local-first personal operating system web app.

Product identity:
- DeeCee tracks Body, Mind, Spirit, Knowledge, Financial, and Dexterity.
- Small logged actions become EXP, ranks, quests, connected stat growth, and activity history.
- Core personal logs are local-first in localStorage.
- Auth, checkout, subscriptions, transactions, and webhook events use Supabase and Vercel-style API routes.
- The UI should feel premium, controlled, dark-first, glassy, responsive, and serious.

Architecture:
- index.html = app shell
- src/app.js = routing, state, rendering, logs, focus, onboarding, checkout UI
- src/config.js = public browser config
- src/styles/theme.css = visual system and responsive styling
- api/*.js = Vercel-style API routes
- server/*.cjs = backend shared logic/local dev server
- server/SCHEMA.complete.sql = Supabase schema

Task:
[INSERT TASK]

Rules:
- Inspect relevant files before editing.
- Preserve existing hash-based routing.
- Preserve local-first behavior for personal logs.
- Do not put secrets in browser code.
- Do not confirm payments from the browser.
- Keep dark/light/system theme support.
- Make changes surgically and explain what changed.
- Run or recommend the relevant checks, especially `npm.cmd run check`.
- Protect existing checkout/subscription logic unless the task specifically modifies it.

Quality bar:
- Premium visual hierarchy.
- Fast mobile logging.
- Clear empty/loading/error/success states.
- Consistent EXP/stat/activity updates.
- No generic productivity-app feel.
```

---

## 15. Ruthless Pre-Mortem

These are the most likely ways DeeCee fails.

### 15.1 It Becomes Too Complicated

Risk: The system becomes impressive in theory but too heavy to use daily.

Countermeasure:

- Keep logging fast.
- Keep the home dashboard decisive.
- Hide advanced detail until needed.
- Prioritize daily loop over feature count.

### 15.2 It Looks Premium but Feels Empty

Risk: The UI looks beautiful but does not create useful behavior.

Countermeasure:

- Every screen must answer “what should I do next?”
- Every log must produce visible feedback.
- Activity history and stat growth must feel alive.

### 15.3 Gamification Becomes Childish

Risk: EXP, ranks, quests, and stats feel like a toy instead of a serious system.

Countermeasure:

- Use mature language.
- Keep effects restrained.
- Make stats meaningful.
- Avoid childish badges and noisy animations.

### 15.4 Local-First Data Becomes Fragile

Risk: localStorage changes break older user data.

Countermeasure:

- Use defaults and migrations.
- Avoid destructive schema changes.
- Add export/backup later.
- Consider premium cloud sync only after local state is stable.

### 15.5 Payment Flow Damages Trust

Risk: Checkout, manual transfer, or subscription status feels unreliable.

Countermeasure:

- Keep confirmation server-side.
- Show clear status states.
- Preserve audit records.
- Protect admin routes.
- Test sandbox end-to-end before live provider work.

### 15.6 The Product Has No Clear First Market

Risk: DeeCee tries to serve everyone and becomes vague.

Countermeasure:

- Position first for disciplined builders, students, creators, and people who think in systems.
- Later broaden the copy only after the core product loop is strong.

---

## 16. Final Standard

A DeeCee build is only acceptable if it feels like:

- a private command center
- a serious self-management system
- a premium web app
- a local-first product
- a disciplined daily companion
- a monetizable SaaS foundation

Reject anything that feels like:

- a generic habit tracker
- a template dashboard
- a childish game
- a fragile prototype
- a pretty but empty landing page
- a payment flow that depends on trust instead of verification

Build DeeCee like it is meant to become a real product, not a school project and not a demo.
