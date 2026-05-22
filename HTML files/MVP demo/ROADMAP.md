# MVP Build Roadmap

This roadmap turns the current HTML prototypes into finished, test-ready products with payment and banking integrations using Vercel, Supabase, Cleva, Moniepoint, and Palmpay.

High-level sequence: Finance MVP → Dashboard MVP → Education MVP.

---

## Phases & Milestones

### Phase 0 — Quick audit & prioritization (1 week)
- Deliverables:
  - Finalized list of pages to include per product.
  - Core feature list for each MVP (must-have, nice-to-have).
  - Wireframe priority flows for signup, onboarding, and primary workflows.
- Tasks:
  - Review `HTML files` prototypes and map assets to features.
  - Create simple click-through wireframes (Figma or HTML mockups).

### Phase 1 — Architecture & infra (1 week)
- Deliverables:
  - Supabase project provisioned (dev and prod), basic schema drafted.
  - Vercel project linked to repo, preview deployments enabled.
  - Environment secrets plan (where to store API keys for Cleva/Moniepoint/Palmpay).
- Tasks:
  - Create Supabase project and enable Auth, Database, Storage.
  - Create Vercel project and connect Git repo; set preview branches.

Suggested commands (once you have CLI tools and credentials):

```bash
# Link a directory to a Vercel project
vercel login
vercel link

# Supabase: login and init
supabase login
supabase projects create --name my-project # or create via dashboard
supabase link --project-ref <project-ref>
```

### Phase 2 — Schema, auth, roles (1 week)
- Key tables:
  - `users`, `profiles`
  - `plans` (tier metadata)
  - `subscriptions` (status, provider id, start/end)
  - `transactions` / `ledger_entries` (finance product)
  - `courses`, `lessons`, `attempts` (education product)
  - `sprints`, `tasks`, `kpis` (dashboard product)
  - `webhooks_logs` (payment events)
- Tasks:
  - Design ER diagram and write SQL migrations.
  - Configure Supabase Auth for email + OAuth (if desired).
  - Create RBAC policies (row-level security) for multi-tenant data isolation.

### Phase 3 — Payments & Banking integrations (1–2 weeks)
- Goal: support subscriptions, wallet top-ups, and reconciliation.
- Provider roles:
  - `Cleva`: primary merchant settlement; handle payouts and settlement reconciliation.
  - `Moniepoint`: business bank account connectivity and reconciliation flows.
  - `Palmpay`: mobile-wallet payment option for customers in markets supported by Palmpay.
- Tasks:
  - Register and obtain API credentials for each provider.
  - Build serverless endpoints to create customers, create subscriptions, and handle webhooks.
  - Implement webhooks handler to update `subscriptions` and `webhooks_logs` in Supabase.
  - Implement periodic reconciliation job to match provider payouts to ledger entries.

Security note: Never store raw provider secrets client-side. Use Vercel environment variables and Supabase Edge Functions or Vercel serverless endpoints.

### Phase 4 — Finance MVP build (2–3 sprints)
- Core features:
  - Ledger entry create/edit/delete with audit trails.
  - CSV import/export and PDF reports.
  - Cash sprint snapshots and simple P&L view.
  - Billing integration: Starter/Growth/Operator plans.
- Tasks:
  - Backend API endpoints (via Supabase RPC or Edge Functions).
  - UI: ledger table, entry editor, report exports.
  - Tests: unit tests for core calculations and E2E tests for flows.

### Phase 5 — Dashboard MVP build (2 sprints)
- Core features:
  - Sprint boards (cards), daily check-ins, KPI panels.
  - Team/shared workspace support (Scale/Enterprise plans).
  - Integrations with Finance product for cash sprint metrics.
- Tasks:
  - UI components for boards and KPI graphs.
  - Sync/real-time updates (use Supabase Realtime or polling).
  - E2E tests for team flows.

### Phase 6 — Education MVP build (1–2 sprints)
- Core features:
  - Course bundles, lesson progress, quizzes, flashcards.
  - Student analytics and campus/group plans.
  - Content authoring basics (CSV or admin UI to add materials).
- Tasks:
  - Lessons viewer, quiz engine, progress tracking.
  - Payment gating for Pro and Campus tiers.

### Phase 7 — Billing, subscriptions, and webhooks (1 sprint)
- Tasks:
  - Checkout flows and secure card/wallet tokenization.
  - Subscription lifecycle handling (trial, renewal, cancellations, failed payments).
  - Webhook event handlers to update application state.
  - Retry logic and email notifications for failed charges.

### Phase 8 — Testing, QA, and staging (1–2 sprints)
- Tasks:
  - End-to-end test coverage (Playwright or Cypress recommended).
  - Integration tests with sandbox modes for Cleva/Moniepoint/Palmpay.
  - Accessibility and responsiveness testing.
  - Load test critical endpoints (simulated signups, checkout flows).

### Phase 9 — Deploy & private beta (1 week)
- Tasks:
  - Finalize environment variables in Vercel for production.
  - Run migration scripts to create production schemas.
  - Open a private beta with test accounts; collect feedback and crash reports.

### Phase 10 — Iterate, measure, grow (ongoing)
- Tasks:
  - Monitor metrics: MRR, churn, DAU/MAU, retention cohorts.
  - Experiment with pricing tiers and onboarding flows.
  - Plan next product expansions and integrations.

---

## Integration specifics (Cleva, Moniepoint, Palmpay)

- Onboarding:
  - Create developer/sandbox accounts for each provider.
  - Gather API keys, webhook URLs, and documentation for the needed endpoints.

- Flow examples:
  - User subscribes → create customer in Cleva/Palmpay → store provider customer id in `profiles`.
  - On successful charge webhook → mark `subscriptions` active and provision access in the app.
  - For payouts/reconciliation → use Moniepoint APIs to match incoming/outgoing bank events to product ledger entries.

- Reconciliation job (cron):
  - Run daily: fetch payment events and settlements, reconcile to local `transactions` and flag mismatches.

---

## Security & secrets
- Keep provider API keys in Vercel environment variables and/or Supabase secrets.
- Use Supabase Row-Level Security to prevent cross-tenant data leaks.
- Use HTTPS-only endpoints and validate webhooks by signature.

---

## Suggested sprint cadence & resourcing
- Sprint length: 1 week (recommended) or 2 weeks.
- Team for 3 sprints parallel work (example):
  - 1 Full-stack engineer (Next.js + Supabase)
  - 1 Frontend engineer (UI, components)
  - 1 Backend/infra (Supabase, payments, deployments)
  - 1 Designer (wireframes + styling)
  - QA (part-time during sprints)

## Deliverables per sprint (example)
- Sprint 0: Audit, wireframes, infra setup.
- Sprint 1: Auth, core DB, Finance basic ledger CRUD.
- Sprint 2: Finance reports, billing integration (starter plans).
- Sprint 3: Dashboard basic boards + sprint flows.
- Sprint 4: Dashboard scale features + team support.
- Sprint 5: Education core, quizzes, gating.
- Sprint 6: QA, end-to-end tests, staging deploy.

---

## Quick try commands
- Local preview (static HTML):

```bash
# Python simple server - preview the MVP demo folder
cd "HTML files/MVP demo"
python -m http.server 8000
# open http://localhost:8000 in your browser
```

- Vercel & Supabase basics (see above commands). Use CLI only after creating accounts and installing tools.

---

## Next steps I can take for you
- Break the roadmap into GitHub issues and a sprint backlog.
- Create the Supabase schema SQL migrations for the core tables.
- Scaffold a Next.js starter with authentication and one sample page (Finance ledger list).
- Implement mock webhook handlers for Cleva/Moniepoint/Palmpay to test payments flows locally.

If you want me to proceed, pick one: `create issues`, `scaffold Next.js`, `write SQL migrations`, or `implement mock webhooks` and I'll start immediately.
