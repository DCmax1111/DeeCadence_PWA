# DatumCamp

DatumCamp is an academy-grade DeeCee web app for turning study into measured action. It combines DeeCee's local-first stats, focus system, Knowledge lab, account flow, and subscription-ready backend with elite learning paths for wealth, family education, resilience, stewardship, and mastery.

## Core Experience

- Local-first dashboard with Body, Mind, Spirit, Knowledge, Financial, and Dexterity stats.
- DatumCamp Academy inside the Knowledge module.
- Five academy paths: Trillionaire Path, Family Legacy Academy, Kingdom Stewardship, Civilization Resilience, and Mind & Mastery Lab.
- Lessons and missions that award DeeCee EXP across connected stats.
- Legal/open resource vault using official, public-domain, and open-license sources.
- DeeCodex vocabulary, quotes, flashcards, and quizzes.
- DeeCee Focus with checkpoint banking and Focus Strength analytics.
- Supabase-ready authentication, subscription, checkout, and admin payment APIs.

## Local Development

```powershell
npm install
npm run dev:local
```

Then open:

```text
http://localhost:3002/#datumcamp
```

Run checks:

```powershell
npm run check
npm run build
```

## Source Policy

DatumCamp should not depend on pirated ebook sources. Public-domain, official, open-license, and user-owned materials are acceptable. Copyrighted modern books can be tracked as metadata, reading assignments, notes, or purchase/library links.

## Deployment

This folder is designed to deploy from:

```text
DeeCee/DatumCamp
```

Use `.env.example` as the environment-variable template. Keep real secrets out of source control.
