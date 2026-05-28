# DeeCash — Git Security & Deployment Guide

This guide explains how to safely push DeeCash to your main repository without exposing API keys or secrets.

---

## TL;DR — The Safe Way

1. **Local development**: Use `.env.local` (ignored by Git — safe to fill with real keys).
2. **Push to GitHub**: Git will skip `.env.local` automatically.
3. **Production (Vercel)**: Add environment variables in Vercel dashboard (separate from Git).
4. **Never commit**: `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, or any payment provider keys.

---

## Git Setup (Already Done)

The `.gitignore` file is configured to exclude:

```
.env.local         # Local development secrets (NEVER committed)
.env               # Production secrets (NEVER committed)
node_modules/      # Dependencies (reinstalled on deploy)
.next/             # Build output
```

**Check**: Run this to verify safe patterns:

```bash
cd "HTML_files/MVP_demo/finance-app"
git status
# You should see: .gitignore, README.md, package.json, src/
# You should NOT see: .env.local, node_modules/, .next/
```

---

## Step 1: Set up local environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**This file will never be committed.** Verify:

```bash
git check-ignore .env.local
# Output: .env.local
# (means it's safely ignored)
```

---

## Step 2: Push to your main repo (GitHub)

```bash
cd "HTML_files/MVP_demo/finance-app"
git add .
git commit -m "Initial DeeCash finance app scaffold"
git push origin main
```

**On GitHub**, you will see:
- ✅ All source code (`.js`, `.css`, `pages/`, `components/`)
- ✅ `.env.local.example` (template for others to copy)
- ❌ `.env.local` (not present — safe!)
- ❌ `node_modules/` (not present — reinstalled on deploy)

---

## Step 3: Deploy to Vercel (Production)

### 3a. Create Vercel project

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project" and link your GitHub repo
3. Vercel auto-detects Next.js and configures the build

### 3b. Add environment variables in Vercel (NOT in Git)

1. In Vercel project → Settings → Environment Variables
2. Add each key individually:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...  (secret only — not in Preview/Development)
CLEVA_API_KEY=xxxx
CLEVA_WEBHOOK_SECRET=xxxx
MONIEPOINT_API_KEY=xxxx
MONIEPOINT_WEBHOOK_SECRET=xxxx
PALMPAY_API_KEY=xxxx
PALMPAY_WEBHOOK_SECRET=xxxx
NEXT_PUBLIC_APP_URL=https://deecash.yourcompany.com
```

**Important**: 
- Set `SUPABASE_SERVICE_ROLE_KEY` and payment keys to "Production" only (not Preview/Development for safety).
- Set `NEXT_PUBLIC_*` vars to "Production, Preview, Development" (they're public anyway).

### 3c. Deploy

```bash
git push origin main
# Vercel auto-deploys. Check Vercel dashboard for live URL.
```

---

## Step 4: Testing in production

Once deployed to Vercel:

1. Visit your production URL (e.g., `https://deecash.yourcompany.com`)
2. Test sign-up, ledger creation, auth flow
3. Monitor errors in Vercel → Deployments → Logs

---

## Best Practices

| Do | Don't |
|----|-------|
| ✅ Use `.env.local` for local dev | ❌ Hardcode keys in code |
| ✅ Use Vercel dashboard for production secrets | ❌ Commit `.env.local` to Git |
| ✅ Keep `.env.local.example` as a template | ❌ Check in `SUPABASE_SERVICE_ROLE_KEY` |
| ✅ Rotate keys if accidentally exposed | ❌ Share keys via Slack/email |
| ✅ Use different keys for dev/prod | ❌ Reuse keys across environments |

---

## If You Accidentally Commit a Secret

1. **Immediately rotate the key** in Supabase / payment provider dashboard.
2. Remove from Git history:
   ```bash
   git filter-branch --tree-filter 'rm -f .env.local' HEAD
   git push --force-with-lease
   ```
3. Update Vercel with new keys.

---

## Folder structure for main repo

If you want to include DeeCash in your main `DeeCadence_PWA` repo:

```
DeeCadence_PWA/
├── HTML_files/
│   ├── MVP_demo/
│   │   ├── finance-app/          ← DeeCash app (Git-tracked)
│   │   │   ├── .gitignore        ✅ Excludes .env.local
│   │   │   ├── .env.local.example ✅ Template (safe)
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   ├── ARCHITECTURE.md
│   │   ├── SCHEMA.sql
│   │   └── index.html
│   └── ...other files
├── .gitignore                     (main repo level)
└── README.md
```

**Main repo `.gitignore`** should also have:

```
**/node_modules/
**/.env.local
**/.env
**/.next/
```

---

## Quick checklist

- [ ] `.env.local` exists and is gitignored
- [ ] `.env.local.example` is in the repo (safe template)
- [ ] No keys hardcoded in JavaScript files
- [ ] Vercel has all environment variables added
- [ ] `git check-ignore .env.local` returns `.env.local` (confirmed safe)
- [ ] Production URL works and Supabase connection is live

---

## Questions?

- **Can I share `.env.local.example`?** Yes — it's a template with no real values.
- **What if I need to change keys?** Update Vercel dashboard; no Git push needed.
- **How do team members get `.env.local`?** They run `cp .env.local.example .env.local` and fill in their own keys.
- **What about CI/CD?** Use Vercel's native CI/CD (recommended) or GitHub Actions with environment secrets.
