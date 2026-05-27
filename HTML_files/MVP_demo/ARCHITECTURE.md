# Architecture & Infrastructure Plan

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         End Users                               │
│              (Web browser, mobile wallet apps)                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS
                        ▼
        ┌───────────────────────────────────┐
        │       Next.js Frontend (Vercel)   │
        │  ├─ Auth pages (login/signup)     │
        │  ├─ Finance product               │
        │  ├─ Dashboard product             │
        │  ├─ Education product             │
        │  └─ Billing / account settings    │
        └───────┬───────────────────────────┘
                │
      ┌─────────┴─────────┐
      ▼                   ▼
┌──────────────┐   ┌──────────────────────┐
│ Supabase     │   │ Vercel Serverless    │
│ (Database)   │   │ Functions (API)      │
│              │   │                      │
│ ├─ Auth      │   │ ├─ Payment webhooks  │
│ ├─ DB        │   │ ├─ Auth middleware   │
│ ├─ Storage   │   │ └─ Bank reconcile    │
│ └─ Realtime  │   │    crons             │
└──────┬───────┘   └──────┬───────────────┘
       │                  │
       └──────────┬───────┘
                  │
          ┌───────▼──────────┐
          │  Payment         │
          │  Providers       │
          ├─ Cleva           │
          ├─ Moniepoint      │
          └─ Palmpay         │
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14+ | React framework with built-in API routes, SSR, static generation |
| **Frontend Hosting** | Vercel | Edge network, serverless functions, auto-deployments |
| **Database** | Supabase (PostgreSQL) | Relational DB + Auth + Realtime + Storage |
| **Backend API** | Vercel Functions + Supabase Edge Functions | Serverless compute for webhooks and heavy logic |
| **Auth** | Supabase Auth (JWT) | Email/password + OAuth + multi-factor auth |
| **Payments** | Cleva, Moniepoint, Palmpay | Merchant settlement, wallet, mobile payments |
| **File Storage** | Supabase Storage | CSV uploads, PDF reports, user assets |
| **Monitoring** | Vercel Analytics + Sentry | Performance, errors, user insights |

---

## Data Flow Architecture

### 1. User Authentication Flow
```
User → Vercel Frontend
    ↓ (email/password)
Supabase Auth
    ↓ (JWT token issued)
Browser localStorage + API calls
    ↓ (token included in headers)
Protected endpoints validated by JWT
```

### 2. Subscription / Payment Flow
```
User selects plan → Checkout page (Vercel)
    ↓
Cleva/Palmpay Tokenization SDK
    ↓
Vercel API Route calls provider API
    ↓
Provider creates subscription/charge
    ↓
Webhook event → Vercel Function listener
    ↓
Update Supabase `subscriptions` table
    ↓
Grant product access in app
```

### 3. Finance Ledger Flow
```
User creates entry → Vercel UI
    ↓
Supabase RPC stored procedure / API
    ↓
Create row in `ledger_entries`
    ↓ (realtime trigger)
Update user's dashboard view
    ↓
Recalculate P&L, cash flow snapshots
```

### 4. Reconciliation Flow (nightly)
```
Cron job (Vercel Cron or external scheduler)
    ↓
Query Moniepoint API for bank transactions
    ↓
Query Cleva API for settlement/payouts
    ↓
Compare to Supabase `transactions` table
    ↓
Flag mismatches, audit log
```

---

## Database Architecture

### Core Schemas

#### Authentication & Users
```sql
-- auth.users (managed by Supabase Auth, auto-created)
-- id, email, email_confirmed_at, created_at, etc.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  subscription_plan TEXT, -- 'starter', 'growth', 'operator', etc.
  stripe_customer_id TEXT, -- or cleva_customer_id, palmpay_id
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

#### Plans & Subscriptions
```sql
CREATE TABLE public.plans (
  id SERIAL PRIMARY KEY,
  product TEXT, -- 'finance', 'dashboard', 'education'
  tier TEXT, -- 'starter', 'growth', 'operator'
  price_monthly DECIMAL,
  price_yearly DECIMAL,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  plan_id INT REFERENCES plans(id),
  status TEXT, -- 'active', 'trialing', 'past_due', 'canceled'
  provider TEXT, -- 'cleva', 'moniepoint', 'palmpay'
  provider_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

#### Finance Product
```sql
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  entry_type TEXT, -- 'income', 'expense', 'transfer'
  amount DECIMAL,
  currency TEXT DEFAULT 'NGN',
  description TEXT,
  category TEXT,
  entry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  entity_type TEXT, -- 'ledger_entry', 'subscription', etc.
  entity_id UUID,
  action TEXT, -- 'create', 'update', 'delete'
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Dashboard Product
```sql
CREATE TABLE public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  workspace_id UUID, -- for team support
  name TEXT,
  start_date DATE,
  end_date DATE,
  target_cash DECIMAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID REFERENCES sprints(id),
  title TEXT,
  status TEXT, -- 'todo', 'in_progress', 'done'
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID REFERENCES sprints(id),
  metric_name TEXT,
  value DECIMAL,
  target_value DECIMAL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
```

#### Education Product
```sql
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  tier TEXT, -- 'free', 'pro', 'campus'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  title TEXT,
  content_url TEXT,
  lesson_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  lesson_id UUID REFERENCES lessons(id),
  status TEXT, -- 'not_started', 'in_progress', 'completed'
  completed_at TIMESTAMPTZ
);
```

#### Payments & Webhooks
```sql
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  subscription_id UUID REFERENCES subscriptions(id),
  provider TEXT, -- 'cleva', 'moniepoint', 'palmpay'
  provider_transaction_id TEXT,
  amount DECIMAL,
  currency TEXT DEFAULT 'NGN',
  status TEXT, -- 'pending', 'succeeded', 'failed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE public.webhooks_logs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT,
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Environment Variables & Secrets

### Vercel Environment Variables (production)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Payments
CLEVA_API_KEY=<key>
CLEVA_WEBHOOK_SECRET=<secret>
CLEVA_MERCHANT_ID=<id>

MONIEPOINT_API_KEY=<key>
MONIEPOINT_WEBHOOK_SECRET=<secret>
MONIEPOINT_ACCOUNT_ID=<id>

PALMPAY_API_KEY=<key>
PALMPAY_WEBHOOK_SECRET=<secret>
PALMPAY_MERCHANT_ID=<id>

# Monitoring
SENTRY_DSN=<dsn>
NEXT_PUBLIC_ANALYTICS_ID=<id>

# App
NEXT_PUBLIC_APP_URL=https://app.yourproduct.com
```

### Supabase Secrets (stored in Supabase dashboard)
```
# Same provider keys as above (for Edge Functions)
# These are stored in Supabase project settings, not in environment
```

---

## Deployment Architecture

### Development
- Git repository: GitHub / GitLab / Bitbucket
- Local dev environment: `npm run dev` (Next.js dev server)
- Local Supabase: `supabase start` (Docker-based local Supabase)
- Testing database: separate Supabase branch/project

### Preview / Staging
- Auto-deployed on pull request creation to Vercel.
- Uses staging Supabase project (or separate branch in same project).
- Webhook URLs point to staging endpoints for payment testing.

### Production
- Deployed to Vercel on merge to `main`.
- Production Supabase project with backups enabled.
- All secrets stored in Vercel and Supabase dashboards.
- CDN + edge caching via Vercel.

---

## API Routes & Serverless Functions

### Vercel Functions (TypeScript)
Location: `pages/api/` (or `app/api/` in App Router)

Key endpoints:
- `POST /api/auth/register` – create new user
- `POST /api/auth/login` – authentication
- `GET /api/user/profile` – fetch user data
- `POST /api/ledger/entry` – create ledger entry
- `GET /api/ledger/entries` – list entries
- `GET /api/dashboard/sprint` – fetch sprint data
- `POST /api/billing/checkout` – initiate checkout
- `POST /api/webhook/cleva` – Cleva webhook handler
- `POST /api/webhook/moniepoint` – Moniepoint webhook handler
- `POST /api/webhook/palmpay` – Palmpay webhook handler

### Supabase Edge Functions (optional)
Location: `supabase/functions/`

Examples:
- `reconcile-payments/` – nightly reconciliation job
- `calculate-p-l/` – compute P&L snapshots
- `send-reminder-email/` – daily digest mailer

---

## Security & Access Control

### Row-Level Security (RLS) in Supabase
Every table uses RLS policies to ensure users can only access their own data:

```sql
-- Example for ledger_entries
CREATE POLICY "Users can only view their own entries"
  ON ledger_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create entries only for themselves"
  ON ledger_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### API Route Protection
All API routes validate the JWT token from the Authorization header and extract `user_id` from the JWT payload.

### Webhook Signature Validation
Each webhook handler verifies the signature from the payment provider (Cleva/Moniepoint/Palmpay) to ensure authenticity.

---

## CI/CD Pipeline

### GitHub Actions (or Vercel native)
```yaml
# On push to main:
# 1. Run tests (Jest, Playwright)
# 2. Lint and format checks
# 3. Build Next.js app
# 4. Deploy to Vercel production
# 5. Run smoke tests against prod
```

---

## Monitoring & Observability

### Vercel Analytics
- Page views, performance metrics, Core Web Vitals.
- Integrated in Vercel dashboard.

### Sentry (Error Tracking)
- Captures frontend and backend errors.
- Alerts on critical issues.
- SourceMaps uploaded for production.

### Supabase Monitoring
- Query logs in Supabase dashboard.
- Performance metrics and index recommendations.

### Custom Metrics (optional)
- Send key events to PostHog or Amplitude for product analytics.
- Track: signups, trial conversions, subscription renewals, churn.

---

## Scalability Considerations

### Database
- Supabase (PostgreSQL) can handle millions of rows.
- Use indexes on frequently-queried columns (user_id, created_at, etc.).
- Archive old ledger entries to a separate table after 2 years.

### Serverless Functions
- Vercel Functions scale automatically.
- Long-running tasks (reconciliation) use cron via external scheduler or Supabase functions.

### Frontend
- Static generation (ISG) for public pages.
- Incremental Static Regeneration (ISR) for user dashboards.
- Optimize images and code splitting via Next.js built-ins.

---

## Summary: What You Need to Do

1. **Create a GitHub repo** for the Next.js project.
2. **Create a Vercel account** and link the repo.
3. **Create a Supabase project** and get connection details.
4. **Create accounts** with Cleva, Moniepoint, and Palmpay; gather API keys.
5. **Configure environment variables** in Vercel and Supabase.
6. **Run SQL migrations** to set up tables and RLS policies.
7. **Create GitHub Actions** or use Vercel native CI/CD.

See `SETUP_CHECKLIST.md` for the step-by-step setup process.
