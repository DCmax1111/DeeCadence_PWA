# DeeCash — Security Threat Model & Requirements

Scope
-----
- Project: DeeCash (finance bookkeeping Next.js app using Supabase)
- Purpose: capture high-level threats, trust boundaries, prioritized mitigations, and short checklist for implementation.

Key assets
----------
- User data: profiles, emails, hashed identifiers
- Financial data: ledger entries, transactions, balances
- Secrets: Supabase service role key, payment provider keys, OWNER_ADMIN_TOKEN
- Infrastructure: Supabase DB, Vercel deployment, webhooks endpoints

Trust boundaries
----------------
- Browser (client) ↔ Server (Next.js API routes)
- Server (Next.js) ↔ Supabase (Postgres / Auth)
- Third-party payment providers ↔ Server (webhooks)

Primary attack surfaces & threats
--------------------------------
1. Secret leakage (git, logs, env) — leads to DB/data exfiltration or privilege escalation.
2. Broken auth / improper RLS — users accessing others' financial data.
3. CSRF / XSRF on state-changing endpoints (checkout, webhooks)
4. XSS in UI leading to token theft or account takeover
5. Injection (SQL or command) from unvalidated inputs
6. Payment fraud via forged webhooks or manipulated client requests
7. Rate-limit / brute-force attacks on login and public APIs
8. Insufficient logging or lack of tamper-resistant audit trail

Mitigations (prioritized)
------------------------
1. Secrets management (Immediate)
   - Move service role keys and payment secrets to Vercel server env; never commit `.env.local`.
   - Rotate keys if exposed; store OWNER_ADMIN_TOKEN in secret manager.

2. Enforce RLS (Immediate)
   - Require Row-Level Security on tables containing user-specific financial data.
   - Use Supabase policies that rely on `auth.uid()` and `profiles` linkage.

3. Webhook & payment security (High)
   - Validate webhook signatures using provider HMAC secrets.
   - Use idempotency keys and verify amounts/currency server-side.

4. Secure Transport & Cookies (High)
   - Enforce HTTPS only in production; set `Secure`, `HttpOnly`, and `SameSite=Strict` for cookies.

5. Headers & Content Security (Medium)
   - Add CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy via Next.js `headers()`.

6. Input validation & parameterized queries (Medium)
   - Validate all client inputs server-side; never construct SQL by concatenation.

7. Rate limiting & brute-force protection (Medium)
   - Apply per-IP and per-account throttles on auth and critical endpoints.

8. Logging & Monitoring (Medium)
   - Emit structured logs for auth, payment events, and admin actions; ship to external log store.

Checklist: first 7-day sprint
----------------------------
- [ ] Move service role and payment keys to Vercel secrets.
- [ ] Verify `.gitignore` prevents `.env.local` commits and run a secret-scan on the repo.
- [ ] Implement and test RLS policies for `ledger_entries` and `transactions`.
- [ ] Add webhook signature verification to `/api/webhook` handler.
- [ ] Configure Next.js `headers()` to add CSP and secure headers.
- [ ] Set secure cookie flags and short TTL for sessions.
- [ ] Run dependency scan (npm audit / Snyk) and fix critical issues.

Next steps I can do now
-----------------------
- Add example RLS policies to `SCHEMA.sql` and commit changes.
- Implement webhook signature verification snippet in `/pages/api/webhook.js`.
- Add Next.js `middleware` or `next.config` headers for CSP and secure headers.

Recent implementations
----------------------
- Added secure HTTP response headers and a basic CSP in `next.config.mjs`
- Added API rate limiting helpers in `lib/rateLimit.js`
- Added audit logging helpers in `lib/auditLog.js` and instrumented the ledger API
- Created a CI workflow (`.github/workflows/ci.yml`) to run `npm audit` and `npm run build`

Operational security notes
--------------------------
- Backups: Use Supabase automated backups plus periodic SQL exports of critical tables (`profiles`, `ledger_entries`, `transactions`, `subscriptions`).
- Key rotation: Store service keys in Vercel production secrets and rotate immediately after any suspected exposure.
- Incident response: define a simple playbook:
  1. Revoke leaked key(s)
  2. Rotate secrets in Supabase/Vercel
  3. Restore from most recent backup if data integrity is compromised
  4. Review audit logs and communications history
- Session security: host production on HTTPS only, and rely on Supabase auth session cookies with `Secure` and `HttpOnly` transport in production environments.
- Post-deployment monitoring: use Vercel deployment logs, error tracking, and Supabase table activity monitoring for high-risk events.
- Bug bounty / testing: schedule periodic penetration testing and invite third-party review once the MVP is stable.
- Secure defaults: require auth before ledger actions, keep public API surfaces minimal, and provide safe fallback messaging for checkout failures.

If you'd like me to continue, tell me which of the remaining security items to prioritize next: webhook verification, RLS validation, or secret rotation guidance.
