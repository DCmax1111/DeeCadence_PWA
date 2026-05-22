# DeeCadence Web App

Fresh web/PWA surface for the browser version.

## Shape

- `index.html` is the app shell.
- `src/styles/theme.css` holds the design system.
- `src/app.js` holds routing, local state, and placeholder module rendering.
- `public/` is reserved for icons, manifest, and static assets.

This starts as a dependency-free static app so it can run locally or on Vercel without a build step. Supabase/auth and deeper module logic can be added after the clean shell is stable.

