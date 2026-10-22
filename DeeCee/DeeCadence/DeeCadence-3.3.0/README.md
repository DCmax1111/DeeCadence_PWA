# DeeCadence

DeeCadence is a local-first attention and focus app. It helps people start at a sustainable pace, keep partial progress, and see their own attention practice over time.

**Current release:** 3.3.0

## Included

- Structured focus sessions with pause, resume, saved-session recovery, and block feedback
- Task planning, repeat tasks, custom repeat days, and a Sunday-first weekly view
- Sunday-first Progress week, rolling 3/14/30-day views, and an optional Personal setup card for focus area, rhythm, and natural block length
- Progress history, attention baseline, streaks, XP, ranks, and daily goals
- Time-aware Today hero mark (morning sun through evening crescent)
- Dark and light themes, plus a Reduce motion & glow setting
- Ambient focus audio (brown noise, rain and thunder, classical, and wind) that only plays while a focus block is running
- Task reminders where browser notifications are permitted
- On-device storage with automatic save, manual save, and backup export/import
- Installable PWA with an offline app shell

## Coming Soon

- **Pet Dee** — not available in this build. The learning engine is already running and records compact behavioural events locally so Pet Dee can be enabled when DeeCadence goes online. Status: **Coming Soon.**
- **Cloud backup & sync** — this build is local-only. The Settings card remains **Coming Soon**, and the Supabase keys are intentionally empty until the online release.

## Learning engine

The learning engine records a capped set of behavioural events and builds an aggregate profile on the device. It never blocks the app, and the data stays in local storage in this build. It supports adaptive ambient behaviour today and is the foundation for Pet Dee later. Deleting local data clears it.

## Local-first behaviour

DeeCadence works without an account or a network connection. Tasks, sessions, settings, progress, attention checks, and learning events stay in the browser until a future sync feature is enabled. Use Export in Settings to keep a manual backup before switching browsers or devices.

## Run locally

Serve this folder over localhost or HTTPS:

```powershell
python -m http.server 8321
```

Then open `http://localhost:8321/`. Opening `index.html` directly still works for local use, but service-worker and PWA install features need localhost or HTTPS. Testing from a phone over a plain LAN HTTP address will not enable the service worker or install prompt.

## Checks

```powershell
npm run check
```

This validates `app.js`, `sync.js`, and `service-worker.js`. There is no automated test script in this release yet.

## Release notes

- Service-worker cache revisions are asset revisions, not semantic versions. The app version is `3.3.0`.
- The 7-day Progress view runs Sunday to Saturday; 3, 14, and 30-day views are rolling windows ending today. Arrow buttons step backward through earlier periods for every range, and future days only appear as blank placeholders inside the current week. The 30-day view uses a calendar heatmap instead of thirty narrow columns.
- The optional Personal setup answers live in the Progress tab and can be changed anytime.
- Pet Dee, cloud sync, and pricing are intentionally out of scope for 3.3.0.
- The temporary rank-preview and splash-preview QA controls have been removed.
