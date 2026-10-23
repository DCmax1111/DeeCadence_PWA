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
- Optional email sign-in and cross-device sync through Supabase
- Installable PWA with an offline app shell
- Vercel-ready static deployment configuration

## Local-first and sync behavior

DeeCadence works without an account or a network connection. Tasks, saved sessions, attention checks, settings, and progress stay in this browser until sync is enabled. When signed in and online, those records sync to the account. A running timer and pending feedback delivery queue remain on the device where they were created.

If this device and the cloud copy both change since the last sync, DeeCadence asks which version to keep. It saves a local recovery copy before applying cloud data. Signing out leaves local data in place. Resetting data clears the local copy and reconciles with the cloud snapshot on the next sync. If both copies changed, DeeCadence asks you to choose.

The browser uses only the Supabase publishable key. User data is protected by row-level security, and the save function checks a revision before writing. Never put a service-role key in this app.

To keep traffic light, the Supabase SDK loads only when a stored sign-in exists or an email sign-in is being started. Local saves are debounced, and background cloud checks run at most once every five minutes; **Sync now** is immediate.

## Supabase setup

The `supabase/setup_sync.sql` file creates the `public.deecadence_sync_state` table, row-level security policies, and the revision-checked `deecadence_save_sync_snapshot` function. Run it once in the Supabase SQL editor for a new project.

The current project is `https://rmzaxfsaezegahwfignu.supabase.co`. Its URL and publishable key are stored in the two `deecadence-sync-*` meta tags in `index.html`. These are public browser values; never put a secret or service-role key there.

In Supabase Authentication:

1. Add the local and deployed callback URLs to the allowed redirect list. The sign-in link returns to the current page, so allowlist `http://localhost:8321/**`, `http://localhost:8324/**`, and `https://<your-vercel-domain>/**`.
2. Configure a custom SMTP sender before public launch so sign-in links are reliable and branded.
3. Keep email authentication enabled. The app does not use anonymous sign-ins.

Feedback delivery currently uses WhatsApp and email. The `deecadence-supabase-*` feedback tags remain empty until the Supabase feedback table exists and includes `sender_name`, so feedback is not silently routed to a missing table.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set **Root Directory** to `OpenCode/DeeCee/DeeCadence-3.3.0`.
3. Choose **Other** as the framework preset. There is no build step; Vercel serves the folder as static files.
4. Deploy, then add the production URL and its `/**` callback path to Supabase Auth's redirect allowlist.
5. Open the deployed site, sign in with email, and confirm the snapshot appears in `public.deecadence_sync_state`.

`vercel.json` keeps `service-worker.js` and `index.html` revalidated so app updates land immediately, and adds basic security headers. The service worker continues to use network-first delivery for app code and stale-while-revalidate for media.

## Run locally

Serve this folder over localhost or HTTPS when testing sign-in and cloud sync:

```powershell
python -m http.server 8321
```

Open `http://localhost:8321/`. Use a second port for QA without touching the local profile on 8321:

```powershell
python -m http.server 8324
```

Opening `index.html` directly still works for local use, but service-worker, PWA install, and the Supabase sign-in callback need localhost or HTTPS. Testing from a phone over a plain LAN HTTP address will not enable the service worker or install prompt.

## Checks

```powershell
npm run check
```

This validates `app.js`, `sync.js`, and `service-worker.js`. There is no automated test script in this release yet.

## Coming Soon

- **Pet Dee** — not available in this build. The learning engine is already running and records compact behavioural events locally so Pet Dee can be enabled later. Status: **Coming Soon.**
- **Pricing and paywalls** — intentionally out of scope for 3.3.0.

## Release notes

- Service-worker cache revisions are asset revisions, not semantic versions. The app version is `3.3.0`.
- Cloud sync is included in this release. It uses Supabase email sign-in, a revision-checked cloud snapshot, conflict handling, and a local recovery copy before a cloud copy is applied.
- The 7-day Progress view runs Sunday to Saturday; 3, 14, and 30-day views are rolling windows ending today. Arrow buttons step backward through earlier periods for every range, and future days only appear as blank placeholders inside the current week. The 30-day view uses a calendar heatmap instead of thirty narrow columns.
- The optional Personal setup answers live in the Progress tab and can be changed anytime.
- Pet Dee and pricing are intentionally out of scope for 3.3.0.
- The temporary rank-preview and splash-preview QA controls have been removed.
