---
name: App Security Auditor
description: >
  Activate this skill whenever DC is writing, reviewing, or deploying code across
  any surface — web (PWA/Vercel), mobile (Android/Kivy), or backend (Supabase,
  serverless functions, APIs). This skill enforces security best practices
  automatically during code generation, code review, and architecture decisions.
  Trigger on: any new feature involving user data, authentication, payments,
  file handling, API calls, environment variables, or external services.
  Trigger on: any deployment, launch, or "this is ready" moment.
  Trigger on: any time DC asks about storing, sending, or receiving data.
  This skill does not slow down building — it makes what gets built safe to ship.
---

# APP SECURITY AUDITOR
### DC's Code Safety Layer — Web · Mobile · Backend

---

## CORE PRINCIPLE

Security is not a feature you add later.
It is a property of how you build from the start.
A single vulnerability in a real product with real users is a liability —
legal, financial, and reputational. Build it right the first time.

Atlas enforces this skill silently during code generation.
If a security issue is detected, flag it immediately before proceeding.

---

## LAYER 1 — AUTHENTICATION & SESSIONS

### Rules
- NEVER store passwords in plaintext — always hash with bcrypt or argon2
- NEVER store auth tokens in localStorage → use httpOnly cookies or secure session storage
- ALWAYS set token expiry (access tokens: 15–60 min; refresh tokens: 7–30 days)
- ALWAYS validate tokens server-side on every protected request
- NEVER trust client-side role or permission claims without server verification
- Use Supabase Auth for all auth flows — do not roll custom auth from scratch

### Kivy/Mobile specific
- Store session tokens in encrypted local storage (not plaintext SQLite fields)
- Never hardcode user credentials or API keys in Python source files
- Treat the mobile client as untrusted — always verify server-side

### Checklist
- [ ] Passwords hashed before storage?
- [ ] Tokens stored securely (not localStorage)?
- [ ] Token expiry set?
- [ ] Server-side validation on all protected routes?
- [ ] No hardcoded credentials in source code?

---

## LAYER 2 — DATA HANDLING & STORAGE

### Rules
- NEVER log sensitive user data (passwords, tokens, payment info, personal details)
- ALWAYS sanitize and validate ALL user inputs before processing or storing
- NEVER construct SQL queries with string concatenation → use parameterized queries
- ALWAYS use Supabase Row Level Security (RLS) — every table, every time
- Encrypt sensitive fields at rest (e.g. financial data in THE SYSTEM's ledger)
- Do not store more data than you need — data minimization is both security and compliance

### SQLite (Kivy/THE SYSTEM)
- Use parameterized queries exclusively:
  ```python
  # WRONG
  cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

  # CORRECT
  cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
  ```
- Encrypt the SQLite database file for any app storing financial or personal data
- Never expose the raw database file path in logs or error messages

### Supabase (Web/Backend)
- Enable RLS on every table — default deny, explicit allow
- Use service role key ONLY in server-side functions — never in client code
- Use anon key on the client — scoped to what the user should see only

### Checklist
- [ ] All inputs validated and sanitized?
- [ ] Parameterized queries used everywhere?
- [ ] RLS enabled on all Supabase tables?
- [ ] No sensitive data in logs?
- [ ] Data minimization applied?

---

## LAYER 3 — API & BACKEND SECURITY

### Rules
- NEVER expose secret keys, API keys, or service role keys in client-side code
- ALL secrets go in environment variables (.env) — never committed to GitHub
- Add .env to .gitignore before the first commit — not after
- ALWAYS validate and sanitize inputs on the server, even if validated on client
- Rate limit all public-facing endpoints (Vercel serverless supports this)
- Use HTTPS everywhere — Vercel enforces this by default, never disable it
- Set CORS headers explicitly — never use wildcard (*) in production

### Environment Variables
```
# .env (never commit this)
SUPABASE_SERVICE_KEY=your_key_here
STRIPE_SECRET_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# .gitignore (always include)
.env
.env.local
.env.production
```

### Vercel Serverless Functions
- Store all secrets in Vercel Environment Variables dashboard
- Access via process.env.KEY_NAME — never hardcode
- Validate request origin and method before processing
- Return generic error messages to client — never expose stack traces

### Checklist
- [ ] All secrets in environment variables?
- [ ] .env in .gitignore?
- [ ] Server-side input validation present?
- [ ] Rate limiting on public endpoints?
- [ ] CORS headers explicitly set?
- [ ] No stack traces exposed to client?

---

## LAYER 4 — FRONTEND & PWA SECURITY

### Rules
- NEVER store sensitive data in localStorage (tokens, user PII, payment info)
- Use Content Security Policy (CSP) headers to prevent XSS
- Sanitize all dynamic HTML rendering — never use innerHTML with user data
- Validate all form inputs client-side (UX) AND server-side (security)
- Use HTTPS-only cookies with Secure and SameSite=Strict flags
- Do not expose internal API routes or Supabase table names unnecessarily

### XSS Prevention
```javascript
// WRONG — opens XSS attack vector
element.innerHTML = userInput;

// CORRECT
element.textContent = userInput;
// OR use a sanitization library like DOMPurify for rich content
```

### PWA Specific
- Service workers must not cache authenticated responses
- Never store auth tokens in the service worker cache
- Validate all data received from cache before rendering

### Checklist
- [ ] No sensitive data in localStorage?
- [ ] CSP headers set?
- [ ] No innerHTML with user-controlled data?
- [ ] Cookies flagged Secure + SameSite?
- [ ] Service worker not caching auth data?

---

## LAYER 5 — PAYMENTS (STRIPE / CLEVA)

### Rules
- NEVER handle raw card data — always use Stripe's hosted elements or Cleva's SDK
- NEVER log payment info, card numbers, or CVVs — this violates PCI DSS
- ALWAYS verify payment webhooks using the webhook signature secret
- Process payments server-side only — never trust client-side payment confirmation
- Use Stripe's test mode for all development — never run real transactions in dev

### Webhook Verification (Stripe)
```javascript
// Always verify webhook signatures
const sig = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  request.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### Checklist
- [ ] Raw card data never touches your server?
- [ ] Payment webhooks verified by signature?
- [ ] Payment processing server-side only?
- [ ] No payment data in logs?
- [ ] Test mode used in development?

---

## LAYER 6 — MOBILE APP SECURITY (KIVY / ANDROID)

### Rules
- Never hardcode API keys or secrets in Python source files
- Store sensitive config in a separate untracked config file or encrypted store
- Validate all data received from backend before rendering or storing locally
- Do not log user data, tokens, or financial info to console in production builds
- Use HTTPS for all API calls — reject HTTP connections
- Obfuscate production builds where possible (Buildozer supports this)

### Config Pattern (safe)
```python
# config.py (add to .gitignore)
SUPABASE_URL = "your_url"
SUPABASE_ANON_KEY = "your_anon_key"

# main.py
from config import SUPABASE_URL, SUPABASE_ANON_KEY
```

### Checklist
- [ ] No hardcoded secrets in source?
- [ ] config.py / secrets file in .gitignore?
- [ ] HTTPS enforced for all API calls?
- [ ] No sensitive logging in production?
- [ ] Input validation on all received data?

---

## LAYER 7 — DEPLOYMENT & LAUNCH SECURITY

### Pre-Launch Security Checklist (run this before every deployment)

**Code**
- [ ] No hardcoded secrets, keys, or credentials anywhere in codebase
- [ ] .env and config files confirmed in .gitignore
- [ ] All dependencies up to date (no known vulnerabilities)
- [ ] Error messages are generic to users, detailed only in server logs

**Auth & Data**
- [ ] Authentication tested end-to-end
- [ ] RLS policies tested with a non-admin user account
- [ ] Password reset flow works and is secure
- [ ] No test accounts or debug backdoors left in production code

**API & Backend**
- [ ] All environment variables set in Vercel dashboard
- [ ] CORS configured for production domain only
- [ ] Rate limiting active on all public endpoints
- [ ] Webhook signatures verified

**Payments**
- [ ] Switched from Stripe test mode to live mode
- [ ] Webhook endpoint updated for production URL
- [ ] Test transaction completed successfully

**General**
- [ ] HTTPS confirmed active
- [ ] No console.log or print() statements exposing sensitive data
- [ ] GitHub repository reviewed — no secrets in commit history

---

## COMMON VULNERABILITIES — QUICK REFERENCE

| Vulnerability | What it is | DC's fix |
|---|---|---|
| **SQL Injection** | Malicious input breaks your query | Parameterized queries always |
| **XSS** | Injected scripts run in user's browser | Never innerHTML with user data |
| **CSRF** | Fake requests made on behalf of user | SameSite cookies + CSRF tokens |
| **Exposed secrets** | API keys in client code or GitHub | Environment variables only |
| **Broken auth** | Weak session management | Supabase Auth + httpOnly cookies |
| **Insecure direct object reference** | User accesses another user's data | RLS on all tables |
| **Sensitive data exposure** | Logging or returning private data | Sanitize all outputs and logs |
| **Unvalidated inputs** | Trusting what users send | Validate client AND server side |

---

## ATLAS ENFORCEMENT RULES

When generating code for DC, Atlas must:

1. **Flag** any pattern from the vulnerability table above before writing it
2. **Default** to the secure implementation without being asked
3. **Refuse** to write code that stores secrets in client-side code
4. **Always** include RLS reminder when generating Supabase table schemas
5. **Always** include .gitignore reminder when introducing a new secrets file
6. **Prompt** DC to run the Pre-Launch Security Checklist before any deployment

Security is not optional. It is the baseline.

---

*App Security Auditor v1.0 — Built for DC's stack: Python/Kivy · PWA · Vercel · Supabase · Stripe · Cleva*
