# Cash Coach + Groq setup guide

This guide adds optional natural-language explanations while keeping Cash Coach’s local rules as the calculation and fallback layer. It does not add a database or connect Cashflow to Supabase. Keep the Groq key on a server.

## Before connecting real user data

Cashflow is a static browser app. A key embedded in JavaScript, HTML, localStorage, or a downloadable app can be copied. Do not call Groq directly from the browser with a private key.

Add a stateless same-origin route such as `POST /api/cash-coach`. It forwards a limited request to Groq and returns the answer; it needs no database. A page opened as `file://` has no API route, so run through a local server or deploy beside a serverless function.

Ask a beta user separately before sending any financial context off-device. Show what will be sent. Send computed summaries and only the matching facts needed. Do not send statements, account numbers, credentials, full histories, or raw merchant descriptions by default. Groq says inference content is not retained by default, but inputs/outputs may be temporarily logged for reliability or abuse investigations for up to 30 days. Data Controls offers Zero Data Retention. Review current terms and account settings before using tester data.

## Step by step

1. **Create a Groq account and key:** use the [Groq Console](https://console.groq.com/keys). Keep the key private; never paste it into chat or commit it.
2. **Choose a model:** use `openai/gpt-oss-20b` as a configurable starting point, then verify it remains available in the [supported-model list](https://console.groq.com/docs/models).
3. **Set server environment variables:** `GROQ_API_KEY` and `GROQ_MODEL` belong in the local server and hosting provider’s server-side settings. Never use browser-exposed names such as `VITE_GROQ_API_KEY` or `NEXT_PUBLIC_GROQ_API_KEY`.
4. **Create `POST /api/cash-coach`:** validate the request, cap its size, rate-limit it, set a timeout, and do not log request bodies. Read the secret only in this route.
5. **Call Groq server-side:** use `https://api.groq.com/openai/v1/chat/completions` with a model, short messages, low temperature, and modest output limit. Keep the model in `GROQ_MODEL` so it can change without editing the UI.
6. **Keep calculations local:** existing Cash Coach rules should calculate balances, totals, goals, runway, and date ranges. Send a small facts object; ask Groq to explain it, say when facts are missing, and never invent numbers. Do not let it import/edit/delete transactions or move money.
7. **Keep remote use optional:** retain the local coach. Show an “Ask online coach” action and the exact data summary before sending. On decline, timeout, rate limit, or service error, use the local coach and say the online answer was unavailable.
8. **Test with synthetic values:** greetings, goal count, known totals, no-data and stale-import cases, unsupported questions, malicious text in a merchant description, oversized input, missing key, timeout, and Groq 429/5xx. Verify no key or raw statement appears in browser storage or server logs.

## Minimal request example

Send only what the user approved:

    {
      "question": "Can I afford the laptop goal this month?",
      "facts": {
        "currency": "NGN",
        "coverageThrough": "2026-10-14",
        "confirmedBalance": 265000,
        "safeToSpend": 190000,
        "mainGoal": {
          "name": "Replace work laptop",
          "saved": 250000,
          "target": 1200000,
          "deadline": null
        }
      }
    }

Reject unknown fields and oversized payloads. Add a session/auth check before external beta use; an anonymous endpoint can be abused and incur API costs.

## Server-side call outline

This is an outline, not a deploy-ready route. Add validation, authentication, rate limits, timeouts, safe errors, and tests for the hosting platform.

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: "Explain only supplied facts. Never calculate or invent missing data." },
          { role: "user", content: JSON.stringify({ question, facts }) }
        ],
        temperature: 0.2,
        max_tokens: 350
      })
    });

The official [Quickstart](https://console.groq.com/docs/quickstart) covers keys and first requests; see [OpenAI compatibility](https://console.groq.com/docs/openai) and [Groq data controls](https://console.groq.com/docs/your-data).

## Cashflow rollout order

1. Keep the local deterministic coach as default.
2. Build one stateless proxy with a server-side key and no database.
3. Send user-approved summaries, not statements.
4. Compare answers to known Cashflow facts and reject invented values.
5. Start with a few informed testers; monitor errors/cost without financial payload logs.
6. Expand context only when a real question needs it and the user agrees.
