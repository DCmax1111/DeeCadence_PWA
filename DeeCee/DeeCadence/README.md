# DeeCadence Web App

DeeCadence is now being shaped as a free-first focus web app that helps people start, finish, and come back to focus sessions without feeling like partial progress was wasted.

This folder now contains only the files directly supporting the current DeeCadence launch build:

- dashboard
- 4-block focus timer
- progress and insights
- levels and streak motivation
- history
- settings and feedback handoff
- survey reference flow

The current frontend is local-first and browser-based. It uses saved local state to support testing the launch loop before adding monetization or deeper cloud features.

## Design Direction

The current UI direction in this folder follows the desktop reference images in `images/`:

- bright, premium light interface
- blue and violet focus accents
- left navigation on desktop
- mobile layout adapted from the same card system
- calm, progress-forward tone

## Run It

Open [index.html](/C:/Users/domin/DC Projects/DeeCadence_PWA/DeeCee/DeeCadence/index.html) directly in a browser.

If you want a quick syntax check:

```powershell
cd DeeCee/DeeCadence
npm run check
```

## Notes

- The launch version is intentionally free first.
- The feedback flow currently points to `deecadence_feedback_form_reference.html`.
- Older backend, payment, and deployment leftovers were removed so the folder only reflects the current frontend direction.
