# FinMax Personal Beta v1

FinMax Beta v1 is a small, local-first personal finance prototype for people who use several bank accounts, mobile wallets, cash balances, and investments.

Its promise is simple: **bring in recent money activity, confirm what happened, and leave with a clearer next step.**

## Included in this beta

- Three-step personal onboarding and a short product tour
- Multiple manually managed accounts
- Fast income, spending, savings/investment, and internal-transfer logging
- Local imports for CSV, JSON, TXT, and supported text-based PalmPay/Moniepoint PDFs
- A review queue that keeps imports out of totals until confirmation
- Local category rules learned from user corrections
- A compact dashboard with one contextual recommendation
- One financial goal with five visible checkpoints
- A printable/downloadable monthly Money Snapshot
- Full JSON backup, restore, and destructive reset
- Light, dark, and system themes
- Manual-transfer plan prototype with honest pending status

## Run locally

Open [index.html](./index.html) in a modern browser. It is designed to work from a `file://` URL without a server.

For a local HTTP address, from this folder run:

```powershell
npx serve .
```

Then open the address printed in the terminal.

## Important beta limits

- Data lives in this browser's `localStorage`; use **More > Full backup** regularly.
- Imported history never changes an account balance automatically.
- PDF support is intentionally limited to text-based PalmPay and Moniepoint statements. Scanned images need OCR in a later version.
- Classification is deterministic and local. It suggests; the user confirms.
- The payment screen is a manual-transfer prototype. It stores a local `pending verification` note only. It cannot verify transfers, notify the owner, unlock access, or recover payment state on another device.
- NGN checkout uses the code-level offline fallback rate of `NGN 1,400` per USD. Customers cannot edit it. Update `FALLBACK_USD_NGN_RATE` and `FX_RATE_UPDATED` in `app.js` when publishing a refreshed beta build.
- Bank details are visible in this static build's source. Move them behind authenticated server endpoints before public deployment.

## Production boundary

Vercel and Supabase come after usability validation. Before public launch, move authentication, plans, bank instructions, transaction references, proof uploads, owner review, notifications, and subscription activation to server-side routes with database policies and audit logs.
