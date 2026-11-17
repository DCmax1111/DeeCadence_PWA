# DeeCadence

DeeCadence is a local-first attention and focus app. It helps people start at a sustainable pace, keep partial progress, and see their own attention practice over time.

**Current release:** 3.3.0

## Included

- Structured focus sessions with pause, resume, saved-session recovery, and block feedback
- Neutral pause tracking with pause counts in the block reveal and History, plus a shorter-block suggestion after repeated pauses
- Task planning, recurring tasks that appear on their due day, custom repeat days, missed-task recovery, and a Sunday-first weekly view
- Sunday-first Progress week, rolling 3/14/30-day views, and an optional Personal setup card for focus area, rhythm, and natural block length
- Progress history, attention baseline, streaks, XP, ranks, and daily goals
- Time-aware Today hero mark (morning sun through evening crescent)
- Dark and light themes, plus a Reduce motion & glow setting
- Ambient focus audio (brown noise, rain and thunder, classical, and wind) that only plays while a focus block is running
- Task reminders where browser notifications are permitted
- On-device storage with automatic save, manual save, and backup export/import
- Optional email sign-in and cross-device sync through Supabase
- Contextual help: a **?** control on Today, a one-time first-visit tour on every tab, and a full help index in Settings for replaying any tour
- A one-time WhatsApp community invite after the first completed focus session, a permanent **Community & updates** card in Settings, and an updates bell with an unread dot on every tab, driven by a revalidated `updates.json` feed with an offline fallback
- A dedicated Feedback tab for bug, confusing, idea, or other reports through WhatsApp or email, with a locally queued fallback
- A clean hamburger drawer for navigation on small screens, with the full side rail on desktop
- A branded load-recovery screen with a one-tap **Try again** action when startup fails
- Installable PWA with an offline app shell
- Vercel-ready static deployment configuration

## Local-first and sync behavior

DeeCadence works without an account or a network connection. Tasks, saved sessions, attention checks, settings, and progress stay in this browser until sync is enabled. When signed in and online, those records sync to the account. A running timer and pending feedback delivery queue remain on the device where they were created. The account profile (name, focus area, and daily goal) is part of the synced copy, so a second device receives it after sign-in.

If this device and the cloud copy both change since the last sync, DeeCadence asks which version to keep. It saves a local recovery copy before applying cloud data. Signing out leaves local data in place. Resetting data clears the local copy and reconciles with the cloud snapshot on the next sync. If both copies changed, DeeCadence asks you to choose.

The browser uses only the Supabase publishable key. User data is protected by row-level security, and the save function checks both the snapshot revision and the active device before writing. Never put a service-role key in this app.

To keep traffic light, the Supabase SDK loads only when a stored sign-in exists or an email sign-in is being started. Local saves are debounced, and background cloud checks run at most once every five minutes; **Sync now** is immediate. A signed-in user never has to press **Sync now** to recover from a transient failure: the app retries automatically with a short backoff, and again when the tab becomes visible, the connection returns, or the profile is saved. A short network or device-check failure does not sign the user out: local work stays available.

## Update notes and community

The bell reads `updates.json` at the site root. It uses the network first, keeps the last good copy in local storage and the service-worker cache, and falls back to the seed in `app.js` only when no copy is available. It refreshes on startup, when the tab becomes visible, when the connection returns, and when the update center opens, so a newly deployed note can appear without waiting for a service-worker cache rollover. Notes render as escaped text only. Right-click or long-press a row to mark it unread or read without opening it.

Each pushed release also shows a one-time **What's new** card when the app opens, for new and returning users alike. It is separate from the bell: `RELEASE_ID` in `app.js` identifies the current release, and `settings.releaseSeenId` records that the card was acknowledged. Bump `RELEASE_ID` for the next release and update the card copy; new users see it after onboarding, existing users see it on their next launch, and it cannot be dismissed without pressing **Start exploring**. The bell keeps the full written note in `updates.json` so people can revisit the details later.

To publish a note, add an item with a unique `id`, an ISO `publishedAt` timestamp, a `title`, and a `body` in `updates.json`, then deploy. The update center behaves like an inbox: unread notes stay at the top, read notes settle beneath them, and each group is newest-first. When everything is read, the whole list is newest-first. Each row is a preview rather than an expandable dropdown. Tapping a note opens a single-note reading page, and **Back** returns to the list. Opening a note marks only that note read through `settings.updatesReadIds`; `settings.updatesSeenAt` remains the baseline for notes that were already read before per-note tracking existed. Right-click or long-press any row to mark it unread or read without opening it; `settings.updatesUnreadIds` is an explicit override, so even notes older than the seen date can return to **New**. The feed has no Supabase dependency and works signed out. The `deecadence-updates-feed` meta tag sets the feed URL; Vercel revalidates `updates.json` and the service worker treats it as network-first.

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

`vercel.json` keeps `service-worker.js`, `index.html`, and `updates.json` revalidated so app and note updates land immediately, and adds basic security headers. The service worker continues to use network-first delivery for app code and the update feed, and stale-while-revalidate for media.

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
- **Strict Focus Mode** - an optional stricter mode is planned. It will be off by default and will never subtract XP unless you want it to. Status: **Coming Soon.**
- **Pricing and paywalls** — intentionally out of scope for 3.3.0.

## Release notes

- Service-worker cache revisions are asset revisions, not semantic versions. The app version is `3.3.0`; this build uses `deecadence-v3-3-68`.
- Release notes now come from a public, revalidated `updates.json` feed. The bell refreshes on startup, when the tab becomes visible, when the connection returns, and when the update center opens; the last good copy is cached locally and in the service worker for offline use. The in-app `UPDATES` array is only a cold-start fallback. No Supabase or sign-in dependency is involved.
- The update center is an inbox-style notification list, not a dropdown accordion: unread notes stay at the top, read notes settle beneath them, each group is newest-first, and an all-read list is newest-first. There are no expand/collapse arrows or redundant **Done** button; the **×** closes the update center. Each row is a compact preview; tapping one opens a single-note reading page, and **Back** returns to the notification list. Opening a note marks only that note read and clears its **New** badge, then drops it into the read section at its date position; per-note read IDs live in `settings.updatesReadIds`. Right-click or long-press a row for a small **Mark as unread** / **Mark as read** menu; explicit unread overrides live in `settings.updatesUnreadIds`, so older notes can become **New** even when the seen-date baseline would mark them read. Notes from before this build use the older `settings.updatesSeenAt` baseline, so earlier welcome and feature notes stay read while the newest WhatsApp community note remains unread for returning readers.
- After the first real focus session enters History, DeeCadence shows a one-time, customized WhatsApp community invite. It waits for any level or rank celebration to finish, stores `communityInviteSeen`, and does not appear again. People who already have focus history skip the automatic invite, but every user gets the permanent **Community & updates** row in Settings, styled like **Help & tips**, and an updates bell with an unread dot on every tab. Both open release notes and a direct group link inside the update center. The group URL lives in the `deecadence-community-whatsapp` meta tag. Add a newer item to `updates.json` with an ISO date before a release; the unread dot checks `updatesUnreadIds`, then compares each item date with `updatesSeenAt`, and checks `updatesReadIds` for newer notes. The feed is a local, offline-safe list rather than a Gmail connection; publishing directly from email would require a hosted announcements feed or a small server-side bridge.
- Plan's task groups for **Missed**, **Ready**, and **Done** collapse by default and keep their open state while Plan re-renders. On Today, the **Missed**, **Ready to focus**, and **Done** groups beneath Today's plan start collapsed so the top of the day stays compact; the fourth Today tour step opens the first group that contains a task so it still spotlights a real task row. Task actions wrap onto their own row inside each card, and deleting a task also removes matching same-title, same-date, same-time copies and every recurrence branch attached to them, without touching unrelated tasks.
- Plan opens on a compact control rail. On phones and tablets, Schedule/Tasks and the Day/Week/Pending filters share one horizontal row, with **Auto-arrange** on its own full-width row beneath so it always has room. Desktop uses a shorter 40px control row and keeps **Auto-arrange** below the filters. At 860px and narrower, the schedule drops its side card padding and runs edge-to-edge, while its **Top** button scrolls the timeline back to 00:00 and **Now** jumps to the live time.
- Auto-arrange now reports only flexible tasks that were actually placed; fixed-time and completed tasks are used as constraints and no longer produce a misleading “arranged” count when nothing moved. Saved or stopped partial focus sessions are also recorded in History → **Partial**, including the completed-block count and whether the current block was partially saved. Continuing one updates that history record instead of creating a duplicate.
- The Schedule view now carries a subtle calendar-style agenda layer: timed day blocks show their time range and priority when there is room. Week uses a date-led agenda rail rather than seven tall empty panels: each day gets a weekday/date badge and stacked time-stamped blocks, so a busy week grows downward while projected repeats keep their own styling. It keeps DeeCadence's existing timeline and task-detail interactions instead of introducing a separate calendar model.
- Plan's **Day**, **Week**, and **Pending** filters are separate workspaces. **Day** shows today with open and done groups, **Week** groups the next seven days into dated sections, and **Pending** gathers every unfinished task across the plan without a Done group. Each scope keeps its own short heading and count so the current view is obvious at a glance.
- Level-ups and rank-ups now land on every exit path. Block Complete shows immediate celebration badges, Continue waits for the reward before starting the next block, rank-ups open the full interface upgrade, and a short chime plays when sound is enabled. The rank-upgrade screen now shows the incoming rank in its own color, then mirror-fades the glow, mark, label, and progress track from the previous rank theme to the new one over five seconds; **Continue** stays hidden until that final reveal is complete.
- The **Preview celebrations** card and its **Level up** and **Rank up** buttons have been removed from Settings. Real level and rank celebrations are unchanged and still run only after actual focus progress.
- Importing a backup confirms before replacing an active or saved session. Task estimates clamp to 10–480 minutes with inline validation, modal action rows stay in a sticky footer, Week columns reflow without horizontal overflow, Block Complete keeps 44px feedback targets, and Google Fonts load without blocking first paint.
- Recurring tasks keep custom repeat-day edits, appear automatically on their due day even when the previous occurrence is still open, and create only future follow-up dates when an overdue task is completed. Completing an older missed occurrence no longer branches the series or creates a duplicate next occurrence, and duplicate same-date occurrences are cleaned up on load. Missed tasks are grouped under **Missed** in Today and Plan with direct Focus and open actions. Deleting a repeating task removes the whole series, including future projections, so it disappears from Today and Plan immediately. The Week view still shows future repeats as projected cards without creating duplicate tasks.
- Paused Focus keeps the timer ring clear of the task title on phones, tablets, and short landscape screens.
- Cloud sync is included in this release. It uses Supabase email sign-in, a revision-checked cloud snapshot, conflict handling, and a local recovery copy before a cloud copy is applied.
- When both copies change, the conflict review opens a full-screen comparison of profile, tasks, sessions, focus time, XP, attention checks, streak, and last activity. Closing it changes nothing; the unresolved choice stays available from the sync card and a global **Review copies** reminder.
- The standalone How-To guide has been replaced by contextual help. Today has a **?** control that starts a short tour of real controls, with progress, **Back**, **Next**, **Got it**, and **Skip**. Every tab introduces itself once with a first-visit tour, but only when the first target is already fully visible, so it never pulls the page to a hidden control. After that, Today's **?** remains the contextual entry and every tour can be replayed from Settings. The tour card stays anchored above, below, or beside the highlighted control on phones and desktop instead of becoming a forced bottom sheet; the page moves only when a target is clipped or offscreen, and then by the smallest amount needed. Safe-area padding and a focus trap are preserved; **Escape** closes a tour. The highlighted control stays sharp through a transparent spotlight, while the rest of the screen is dimmed without blurring the card or the target. The card and spotlight stay aligned when the viewport resizes or the page scrolls, and scrolling is vertical-only so it cannot shift the page sideways.
- Small screens use a hamburger-triggered left drawer instead of a bottom bar. Feedback is the eighth primary destination alongside Today, Focus, Plan, Rank, Progress, History, and Settings. The same active state, focus trapping, **Escape** close, and desktop side rail remain.
- Feedback has its own full-width tab, replacing the old Settings row and floating button. It keeps the report type, message, optional contact fields, context, WhatsApp/email delivery, queue badge, reset, and validation, with a compact type grid and inline delivery selector on phones.
- On phones, Today is a tighter single-column layout: a compact hero, rank console, next block, and plan fit with only a short scroll. On laptops and desktops, the hero headline scales down, rank and next block share a row, and Today's plan starts within the first screen. The fourth Today tour step now spotlights the first plan task instead of the whole plan card. Progress consolidates Cadence and Momentum into two compact insights, collapses Attention Baseline behind a disclosure, and keeps the chart, setup, and focus history close together.
- Today's sustainable-focus evidence is a compact, game-style strip instead of a plain paragraph: glowing icon chips show recent blocks and completion, best window, and next stretch. It uses a deliberate three-row stack on phones and two compact rows on desktop, fits inside the reading card without clipping or horizontal overflow, and keeps an accessible text summary for screen readers.
- Settings now includes a full help index for all eight tabs: Today, Focus, Plan, Rank, Progress, History, Feedback, and Settings. It covers sync, conflict choices, data tools, and troubleshooting. The old guide entry notice and footer actions have been removed. The coming-soon **Strict Focus Mode** card sits at the very end, after **Help & tips**, and the Settings tour follows that visual order.
- The strongest day in the selected Progress range is marked inside the chart with a star and a warm glow in the cadence bars, line chart, and 30-day heatmap, and named in the insight footer.
- Onboarding now opens with a centered **Start where you are** welcome, led by the Rank demo and the short version of the promise: attention gets pulled in many directions, DeeCadence brings it back with short focus blocks and tasks in your schedule, and Rank grows as you show up. The **Find my pace →** button leads into the three focus-rhythm questions as step 2, then the first 5-minute block as step 3. The starting focus score stays with the questions as a live meter, and the action row remains in flow below the scrollable slide area so it cannot cover the capacity preview.
- If the app shell never finishes loading, or startup throws before the app is ready, the splash becomes a branded **DeeCadence hit a snag** screen with **Try again**. Missing images, sounds, or fonts do not trigger it.
- Settings keeps Onboarding, Theme, Daily goal, and the switch rows on one line at phone widths, with every control aligned to the right edge. The Reset all data row now uses the same padding as the other rows.
- Pauses are recorded neutrally. The block reveal and History show pause counts; five or more pauses suggests a shorter block next time. No XP penalty is applied.
- The first cloud save waits for a short account profile (name, main focus, and daily goal). The profile is included in the synced snapshot and mirrored to Supabase auth metadata.
- One device is active per account. A second device can move the account with **Use this device instead**; the previous device keeps its local work and signs out locally on its next check.
- Magic-link return, profile setup, and device checks degrade to local-only use when the network or Supabase is unavailable, then retry automatically.
- Passive focus and audio signals are stored in `public.deecadence_learning_events` and summarized in `public.deecadence_focus_sessions`. The observed-pattern views are available only in the Supabase SQL editor, not to app clients.
- Offline learning events stay in the local event log and upload idempotently when the user is signed in and the connection returns.
- The 7-day Progress view runs Sunday to Saturday; 3, 14, and 30-day views are rolling windows ending today. Arrow buttons step backward through earlier periods for every range, and future days only appear as blank placeholders inside the current week. The 30-day view uses a calendar heatmap instead of thirty narrow columns.
- The optional Personal setup answers live in the Progress tab and can be changed anytime. On phones, the card keeps the full title, turns the saved answers into labeled focus, best-window, natural-block, and distraction facts, and gives the action a 44px tap target. An unconfigured card uses the short explanation instead, while desktop keeps its summary and tags.
- Pet Dee, Strict Focus Mode, and pricing are intentionally out of scope for 3.3.0.
- The temporary celebration-preview and splash-preview QA controls have been removed.
