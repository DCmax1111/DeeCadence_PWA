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

DeeCadence works without an account or a network connection. Tasks, saved sessions, attention checks, settings, and progress stay in this browser until sync is enabled. When signed in and online, those records sync to the account. A running timer and pending feedback delivery queue remain on the device where they were created. The account profile (name, focus area, and daily goal) is part of the synced copy, so a second device receives it after sign-in.

If this device and the cloud copy both change since the last sync, DeeCadence asks which version to keep. It saves a local recovery copy before applying cloud data. Signing out leaves local data in place. Resetting data clears the local copy and reconciles with the cloud snapshot on the next sync. If both copies changed, DeeCadence asks you to choose.

The browser uses only the Supabase publishable key. User data is protected by row-level security, and the save function checks both the snapshot revision and the active device before writing. Never put a service-role key in this app.

To keep traffic light, the Supabase SDK loads only when a stored sign-in exists or an email sign-in is being started. Local saves are debounced, and background cloud checks run at most once every five minutes; **Sync now** is immediate. A signed-in user never has to press **Sync now** to recover from a transient failure: the app retries automatically with a short backoff, and again when the tab becomes visible, the connection returns, or the profile is saved. A short network or device-check failure does not sign the user out: local work stays available.

## Supabase setup

The `supabase/setup_sync.sql` file creates the `public.deecadence_sync_state` table, the one-device `public.deecadence_sync_devices` table, row-level security policies, and the device-checked revision save function. It also creates the `public.deecadence_profiles` and `public.deecadence_accounts` views, which expose the saved name, focus area, daily goal, email, last sign-in, and active device without duplicating the profile data. The same file creates the passive-learning tables, the batch ingestion function, and the observed-pattern views described below. Run the whole file in the Supabase SQL editor for a new project. Re-run it after upgrading an earlier 3.3.0 build; the file is safe to run again and revokes the old two-argument save function so an old client cannot bypass the device check.

The current project is `https://rmzaxfsaezegahwfignu.supabase.co`. Its URL and publishable key are stored in the two `deecadence-sync-*` meta tags in `index.html`. These are public browser values; never put a secret or service-role key there.

In **Supabase → Authentication → URL Configuration**:

1. Set **Site URL** to the stable production app URL, for example `https://your-app.vercel.app/`.
2. Add redirect URLs for production and local testing: `https://your-app.vercel.app/**`, `http://localhost:8321/**`, and `http://localhost:8324/**`. Supabase will not return to a URL that is not on this list.
3. Keep email authentication enabled. The app does not use anonymous sign-ins.
4. Configure a custom SMTP sender before public launch so sign-in links are reliable and branded.
5. To support the app's **Have a 6-digit code?** option, edit **Authentication → Email Templates → Magic Link** and include `{{ .Token }}` in the message. If template editing is not available on the current Supabase plan, the link flow still works and the code panel remains optional. For example:

   ```html
   <h2>Your DeeCadence sign-in code</h2>
   <p style="font-size: 28px; letter-spacing: 6px;"><strong>{{ .Token }}</strong></p>
   <p>Or open this link on the same device: <a href="{{ .ConfirmationURL }}">Sign in to DeeCadence</a></p>
   ```

   The link signs in the device that opens it. If the link is opened on a phone while the laptop is waiting, the phone is signed in, not the laptop; use the code on the laptop instead. If the email contains only a link and no code, the template is missing `{{ .Token }}`; the default Magic Link template does not include it. The app treats the code as optional, so a link-only email does not block sign-in.

The app asks Supabase to return to the current page by default. To force a stable production return even when sign-in starts from a preview deployment, set `deecadence-sync-redirect-url` in `index.html` to the production URL and allowlist that exact URL in Supabase. Leave it empty to keep same-page behavior.

### First sign-in and one active device

After the magic link returns, DeeCadence asks for a name, main focus, and daily goal before it writes the first cloud snapshot. The main focus list includes a **Custom** option with a 40-character limit; custom text is stored as `focus: "custom"` plus `focusCustom` in the synced snapshot, and as `focus_custom` in auth metadata. The profile is stored in the synced state so it follows the account to another device, and it is also copied to Supabase auth metadata (`display_name`, `full_name`, `focus_area`, `focus_custom`, `daily_goal_minutes`) so the Users table is readable. A blank display name in Supabase is not a sign-in failure; it just means this profile step has not run yet. Once signed in, **Profile** in the sync card reopens the same form so the name, focus, or daily goal can be changed later.

To inspect saved profiles in the SQL editor, run:

```sql
select * from public.deecadence_profiles order by updated_at desc;
```

To see sign-in, device, and profile details together, run:

```sql
select * from public.deecadence_accounts order by last_sign_in_at desc nulls last;
```

The authoritative sign-in list is still **Authentication → Users** in the Supabase dashboard (or `auth.users` in SQL). `deecadence_sync_devices` only shows the account UUID, device label, and claim timestamps; `deecadence_profiles` only has a row after the first successful sync snapshot.

Only one device can be active for an account. A second device signs in, sees which device currently holds the account, and can choose **Use this device instead**. The previous device signs out locally on its next check but keeps its local work, so it can take the account back later. Normal sign-out releases the device claim. If the release or Supabase call stalls, this device still signs out locally and clears its stored session; the device claim can be recovered later with **Use this device instead**. If a claim or save is interrupted, the app continues locally and retries; it does not discard local data.

Feedback delivery currently uses WhatsApp and email. The `deecadence-supabase-*` feedback tags remain empty until the Supabase feedback table exists and includes `sender_name`, so feedback is not silently routed to a missing table.

### Observed patterns in Supabase

The learning engine records compact events locally first, including session starts and ends, block completions, reveal decisions, pauses, sound changes, and quick restarts. When the user is signed in, the active device uploads those events in idempotent batches after focus activity, on reconnect, and during background checks. If upload fails, the local event log remains the backup and the same batch is retried later.

Two tables hold the cloud copy:

- `public.deecadence_learning_events` — append-only raw events, unique per `(user_id, event_id)`.
- `public.deecadence_focus_sessions` — one normalized row per ended or saved session, with planned/completed blocks, audio exposure, reveal dwell time, quick-restart context, and feedback count.

Both tables have RLS enabled and no direct client grants. The app writes only through `deecadence_ingest_learning_events`, which checks the active device. The analytics views are for the Supabase SQL editor or service role only; they are not granted to app clients, so a signed-in user cannot read another account's behavior.

Run these in the SQL editor after applying the setup file:

```sql
-- Per-account observed patterns
select * from public.deecadence_observed_patterns order by sessions desc;

-- Sound-type comparison across all accounts
select * from public.deecadence_sound_patterns order by sessions desc;

-- What people choose at the block reveal
select * from public.deecadence_reveal_decisions;

-- Single-block and quick-restart signals across all accounts
select * from public.deecadence_audio_restart_patterns;

-- Raw event trail for one account
select occurred_at, event_type, data
  from public.deecadence_learning_events
 where user_id = '<uuid>'
 order by occurred_at desc
 limit 200;
```

Useful fields in `deecadence_observed_patterns` include `single_block_audio_played_sessions`, `quick_audio_restarts`, `audio_played_seconds`, and `audio_playing_at_end_sessions`. These are observed correlations, not proof of intent: for example, a quick restart after an audio-enabled session suggests the sound may have been part of the reason the user started again, but it does not prove it. The `deecadence_reveal_decisions` view shows whether users continue, finish, or stop at the reveal and how long they waited.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set **Root Directory** to `OpenCode/DeeCee/DeeCadence-3.3.0`.
3. Choose **Other** as the framework preset. There is no build step; Vercel serves the folder as static files.
4. In **Vercel → Project → Settings → Deployment Protection**, turn off Vercel Authentication for **Production**, or use a domain that is not protected. If a magic link opens a Vercel login screen, the redirect is landing on a protected deployment; this is not caused by the Supabase display name.
5. Use the stable production domain, not a protected preview URL. Then set that exact URL as the Supabase **Site URL** and add its `/**` callback path to the redirect allowlist.
6. Deploy, open the production site, sign in with email, complete the profile step, and confirm the snapshot appears in `public.deecadence_sync_state` and the device row appears in `public.deecadence_sync_devices`.

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
- The first cloud save waits for a short account profile (name, main focus, and daily goal). The profile is included in the synced snapshot and mirrored to Supabase auth metadata.
- One device is active per account. A second device can move the account with **Use this device instead**; the previous device keeps its local work and signs out locally on its next check.
- Magic-link return, profile setup, and device checks degrade to local-only use when the network or Supabase is unavailable, then retry automatically.
- Passive focus and audio signals are stored in `public.deecadence_learning_events` and summarized in `public.deecadence_focus_sessions`. The observed-pattern views are available only in the Supabase SQL editor, not to app clients.
- Offline learning events stay in the local event log and upload idempotently when the user is signed in and the connection returns.
- The 7-day Progress view runs Sunday to Saturday; 3, 14, and 30-day views are rolling windows ending today. Arrow buttons step backward through earlier periods for every range, and future days only appear as blank placeholders inside the current week. The 30-day view uses a calendar heatmap instead of thirty narrow columns.
- The optional Personal setup answers live in the Progress tab and can be changed anytime.
- Pet Dee and pricing are intentionally out of scope for 3.3.0.
- The temporary rank-preview and splash-preview QA controls have been removed.
