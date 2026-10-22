# DeeCadence

DeeCadence is a local-first attention and focus app. It helps people start at a sustainable pace, keep partial progress, and see their own attention practice over time.

## Included

- Structured focus sessions, task planning, saved-session recovery, and progress history
- A selective-attention check for personal trend tracking
- On-device storage and backup export/import
- Optional email sign-in and cross-device sync through Supabase

## Local-first and sync behavior

The app works without an account or network connection. Tasks, completed sessions, attention checks, settings, and progress stay in this browser until sync is enabled. When signed in and online, those records sync to the account. A running timer and pending feedback delivery queue remain on the device where they were created.

If this device and the cloud copy both change since the last sync, DeeCadence asks which version to keep. It saves a local recovery copy before applying cloud data. Signing out leaves local data in place. Resetting data clears the local copy and reconciles with the cloud snapshot on the next sync. If both copies changed, DeeCadence asks you to choose.

The browser uses only the Supabase publishable key. User data is protected by row-level security and the save function checks a revision before writing. Never put a service-role key in this app.

## Supabase setup

The current DeeCadence Supabase project has the sync table, row policies, and revision-checked save function applied. The supabase/setup_sync.sql file records the schema for another environment. Keep the project URL and publishable key in the two deecadence-sync meta tags in index.html; never put a secret key there.

Add the local development URL and eventual HTTPS production URL to Supabase Auth's allowed redirect URLs. The sign-in link returns to the current page, so the local port and deployed domain must be allowlisted. Configure an SMTP sender before public launch so sign-in links are reliable and branded. The current Supabase project is on the Free plan and was restored for this integration; Free projects with low activity over a 7-day period can be paused, so monitor it or upgrade before relying on continuous availability.

## Run locally

Serve this folder over localhost or HTTPS when testing sign-in and cloud sync. Opening index.html with a file URL still permits local use but cannot complete the account callback.

## Checks

Run npm run check and npm test in a Node.js environment. The first checks the shipped app, sync module, source copy, and service worker; the second runs the existing session-flow and root-app audits.