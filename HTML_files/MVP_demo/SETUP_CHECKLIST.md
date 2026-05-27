# Infrastructure Setup Checklist

Complete this checklist to prepare the production infrastructure for the MVP products.

---

## 0. Prerequisites

- [ ] Git and GitHub account (or GitLab/Bitbucket)
- [ ] Node.js 18+ installed locally
- [ ] Code editor (VS Code, etc.)
- [ ] Terminal / CLI comfort

---

## 1. Create & Configure Git Repository

- [ ] Create a new GitHub repo called `deecadence-mvp-backend` (or similar)
- [ ] Clone locally: `git clone <repo-url>`
- [ ] Create initial directory structure:
  ```bash
  mkdir pages api supabase/migrations supabase/functions public
  ```
- [ ] Commit and push.

---

## 2. Create Vercel Account & Project

### 2a. Account setup
- [ ] Go to [vercel.com](https://vercel.com) and sign up with GitHub.
- [ ] Authorize GitHub integration.

### 2b. Create project
- [ ] In Vercel dashboard, click "Add new" → "Project".
- [ ] Select your GitHub repo (`deecadence-mvp-backend`).
- [ ] Leave Framework as "Next.js".
- [ ] Click "Deploy".
- [ ] Vercel will deploy a blank Next.js app. Note the preview URL.

### 2c. Configure environment variables in Vercel
- [ ] Go to project settings → "Environment Variables".
- [ ] Add the following (leave values blank for now; we'll fill them after Supabase):
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  CLEVA_API_KEY
  CLEVA_WEBHOOK_SECRET
  CLEVA_MERCHANT_ID
  MONIEPOINT_API_KEY
  MONIEPOINT_WEBHOOK_SECRET
  MONIEPOINT_ACCOUNT_ID
  PALMPAY_API_KEY
  PALMPAY_WEBHOOK_SECRET
  PALMPAY_MERCHANT_ID
  SENTRY_DSN
  NEXT_PUBLIC_APP_URL
  ```
- [ ] Set the "NEXT_PUBLIC_" ones to "Production, Preview, Development".
- [ ] Set the secret keys to "Production, Preview" (not Development for safety).

---

## 3. Create Supabase Project

### 3a. Account setup
- [ ] Go to [supabase.com](https://supabase.com) and sign up.
- [ ] Verify email.

### 3b. Create project
- [ ] Click "New Project".
- [ ] Select your organization.
- [ ] Name: `deecadence-mvp-prod` (or staging variant).
- [ ] Database password: generate a strong one (save securely).
- [ ] Region: pick closest to your market (e.g., us-east-1 or eu-west-1).
- [ ] Click "Create new project". Wait ~2 minutes for provisioning.

### 3c. Enable & configure Auth
- [ ] Go to project → "Authentication" → "Providers".
- [ ] Enable "Email" (already on by default).
- [ ] Enable "Google" if desired (requires OAuth credentials from Google Cloud).
- [ ] Go to "Auth settings" and configure:
  - Site URL: your Vercel app URL (e.g., `https://app.yourproduct.com`)
  - Redirect URLs: add `https://app.yourproduct.com/auth/callback`
- [ ] Save.

### 3d. Copy connection details
- [ ] Go to project → "Settings" → "API".
- [ ] Copy:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` in Vercel
  - `Anon Public Key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
  - `Service Role Key` → `SUPABASE_SERVICE_ROLE_KEY` in Vercel (keep secret!)
- [ ] Go to "Database" → "Connection strings".
- [ ] Copy the "Connection string" (URI format) for local dev.

### 3e. Enable Storage (for files)
- [ ] Go to project → "Storage".
- [ ] Create a new bucket called `user-uploads`.
- [ ] Set access to "Public" for now (you can restrict later).

### 3f. Enable Realtime (optional, for live dashboards)
- [ ] Go to project → "Realtime" → "Replication".
- [ ] Enable for the tables that need live updates (e.g., `tasks`, `kpi_entries`).

---

## 4. Set Up Local Environment

### 4a. Install CLI tools
```bash
# Supabase CLI
npm install -g supabase

# Vercel CLI (optional but helpful)
npm install -g vercel
```

### 4b. Create `.env.local` in your repo
```
NEXT_PUBLIC_SUPABASE_URL=<from Supabase dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4c. Link Supabase project locally
```bash
cd <repo-root>
supabase link --project-ref <project-ref>
# You'll be prompted to paste your database password.
```

### 4d. Start local Supabase (optional)
```bash
supabase start
# This starts Docker containers locally for dev/testing.
# Access local Supabase at http://localhost:54323
```

---

## 5. Set Up Payment Provider Accounts

### 5a. Cleva
- [ ] Sign up at [Cleva dashboard](https://cleva.app) (or provided link from Cleva team).
- [ ] Verify identity and complete KYC.
- [ ] Go to Developers → API Keys.
- [ ] Create a new API key and note the secret.
- [ ] Set webhook URL to: `https://<your-vercel-domain>/api/webhook/cleva`
- [ ] Copy API key and secret to Vercel environment variables.

### 5b. Moniepoint
- [ ] Sign up at [Moniepoint dashboard](https://moniepoint.com).
- [ ] Verify business account.
- [ ] Go to Settings → API Keys.
- [ ] Create API key; note the secret.
- [ ] Set webhook URL to: `https://<your-vercel-domain>/api/webhook/moniepoint`
- [ ] Copy to Vercel environment variables.

### 5c. Palmpay
- [ ] Sign up at [Palmpay dashboard](https://palmpay.com).
- [ ] Complete KYC.
- [ ] Go to Developer Settings → API Keys.
- [ ] Create key; note the secret.
- [ ] Set webhook URL to: `https://<your-vercel-domain>/api/webhook/palmpay`
- [ ] Copy to Vercel environment variables.

---

## 6. Create Database Schema

### 6a. Create migration file
```bash
supabase migration new init_schema
# Creates: supabase/migrations/<timestamp>_init_schema.sql
```

### 6b. Add schema SQL
- [ ] Copy the SQL schema from `SCHEMA.sql` (see section below) into the migration file.
- [ ] Or write the tables manually using Supabase SQL editor.

### 6c. Apply migration
```bash
supabase db push
# Deploys to remote Supabase project
```

### 6d. Verify in Supabase dashboard
- [ ] Go to Supabase project → "SQL Editor".
- [ ] Run: `SELECT * FROM information_schema.tables WHERE table_schema='public';`
- [ ] Confirm all tables exist.

---

## 7. Set Up Row-Level Security (RLS)

### 7a. Enable RLS on all tables
```bash
# Go to Supabase SQL Editor and run:
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
-- ... (all tables)
```

### 7b. Create RLS policies
- [ ] Use the example policies from `ARCHITECTURE.md`.
- [ ] Test policies with a sample user.

---

## 8. Update Vercel Environment Variables

- [ ] Go to Vercel project → Settings → Environment Variables.
- [ ] Update all payment provider keys (Cleva, Moniepoint, Palmpay).
- [ ] Update Supabase keys (from step 3d).
- [ ] Add Sentry DSN (if using error tracking; can add later).
- [ ] Add production app URL: `NEXT_PUBLIC_APP_URL=https://app.yourproduct.com`.

---

## 9. Test End-to-End

### 9a. Local development
```bash
npm install
npm run dev
# Opens http://localhost:3000
```

### 9b. Test Supabase connection
```bash
# Create a simple API route to test:
# pages/api/test.js
export default async function handler(req, res) {
  const { supabase } = req;
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  res.json({ data, error });
}
# Visit http://localhost:3000/api/test
```

### 9c. Test Auth
- [ ] Sign up with email on your local app.
- [ ] Verify that a row appears in Supabase `auth.users`.

### 9d. Test Preview deploy
```bash
git push
# Vercel auto-deploys. Visit preview URL from Vercel dashboard.
```

---

## 10. Set Up CI/CD (optional but recommended)

### 10a. Add GitHub Actions workflow
- [ ] Create `.github/workflows/test-and-deploy.yml`.
- [ ] Example:
  ```yaml
  name: Test & Deploy
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: '18'
        - run: npm install
        - run: npm run lint
        - run: npm run test
    deploy:
      if: github.ref == 'refs/heads/main'
      runs-on: ubuntu-latest
      needs: test
      steps:
        - run: vercel deploy --prod
          env:
            VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  ```
- [ ] Commit and push. GitHub Actions will run on next push.

---

## 11. Configure Monitoring (optional)

### 11a. Sentry (error tracking)
- [ ] Sign up at [Sentry.io](https://sentry.io).
- [ ] Create a project for "Next.js".
- [ ] Copy the DSN.
- [ ] Add to Vercel environment variables: `SENTRY_DSN=<dsn>`.
- [ ] Install Sentry SDK:
  ```bash
  npm install @sentry/nextjs
  ```

### 11b. Vercel Analytics (built-in)
- [ ] Go to Vercel project → "Analytics".
- [ ] Enable "Web Analytics" (free tier available).

---

## 12. Final Pre-Launch Checks

- [ ] All environment variables populated in Vercel.
- [ ] Database migrations applied to production.
- [ ] Auth working (can sign up / log in).
- [ ] Payment webhooks tested in sandbox mode.
- [ ] SSL certificate auto-configured by Vercel (HTTPS enabled).
- [ ] Backup enabled in Supabase (see Supabase settings).
- [ ] Error monitoring (Sentry) integrated.

---

## Next Steps

Once this checklist is complete:

1. **Start Phase 3**: Design the full DB schema and apply migrations.
2. **Start Phase 4**: Implement Finance MVP core workflows (ledger CRUD, reports).
3. **Start Phase 5**: Build the dashboard MVP.
4. **Start Phase 6**: Implement education product.

---

## Quick Reference: Key URLs

| Service | URL | Purpose |
|---------|-----|---------|
| GitHub | `https://github.com` | Source control |
| Vercel | `https://vercel.com` | Frontend hosting |
| Supabase | `https://app.supabase.com` | Database + auth |
| Cleva | `https://cleva.app` | Payments |
| Moniepoint | `https://dashboard.moniepoint.com` | Bank reconciliation |
| Palmpay | `https://merchant.palmpay.com` | Mobile wallet |

---

## Troubleshooting

**Supabase connection fails locally?**
- Check `.env.local` has correct keys.
- Run `supabase projects list` to verify linked project.
- Check database password is correct.

**Vercel deployment fails?**
- Check all environment variables are set.
- Run `npm run build` locally to debug.
- Check GitHub repo has write access from Vercel.

**Webhook not firing?**
- Verify webhook URL in payment provider dashboard matches Vercel URL.
- Check API route exists and returns 200.
- Manually trigger webhook via provider's dashboard (most have a "send test" button).

---

**Status**: Once complete, move to Phase 3 (DB schema & auth setup).
