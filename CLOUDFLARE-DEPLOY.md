# Cloudflare production handoff

Production is one Cloudflare Worker serving explicit static assets plus three API routes,
with D1 for analytics and Cloudflare Access protecting the dashboard. `serve.mjs` remains a
local-development server; it is not the production origin.

## Current production status (2026-07-12)

- Live calculator: `https://tchumshabbos.com`
- Worker: `techum-shabbos-calculator`; `workers.dev` disabled by the custom-domain deployment
- D1: `techum-analytics` (`c08c94e0-e04d-4f06-be14-6fed2d47468b`); migrations 0001–0004
  applied; `0005_building_tiles.sql` must be applied immediately before deploying this change
- R2: `techum-buildings` and `techum-buildings-preview` are provisioned; the shared OSM
  tile binding and `/api/buildings` route ship with this change
- `IP_HASH_SECRET` configured; geocoder contact is `https://tchumshabbos.com/about`
- Analytics collection is active and analytics reads are private (`REQUIRE_ACCESS=true`).
- Cloudflare Zero Trust Free is active. The `Techum analytics` Access application protects
  `tchumshabbos.com/analytics*` and `tchumshabbos.com/api/analytics*` with the reusable
  `Allow analytics owner` policy (owner email only, one-month policy session, the current
  Cloudflare Access maximum).
- Outside-in verification: `/` returns `200`; both analytics paths return a `302` redirect
  to Cloudflare Access when no authenticated Access session is present.

## One-time account setup

1. Authenticate Wrangler interactively:

   ```powershell
   npx wrangler login
   npx wrangler whoami
   ```

2. Create the database and place the returned ID in `wrangler.jsonc` (already completed for
   this deployment):

   ```powershell
   npx wrangler d1 create techum-analytics --location wnam
   ```

3. Set `GEOCODER_CONTACT` in `wrangler.jsonc` to a public contact URL or email. Public
   Nominatim requires an identifiable application and operator.

4. Create a random HMAC secret interactively. Never put it in the repository or command line:

   ```powershell
   npx wrangler secret put IP_HASH_SECRET
   ```

5. Create the building-tile R2 buckets (once) and apply migrations:

   ```powershell
   npx wrangler r2 bucket create techum-buildings
   npx wrangler r2 bucket create techum-buildings-preview
   npx wrangler d1 migrations apply techum-analytics --remote
   npm run cf:deploy
   ```

   `/api/buildings` serves fixed ~2 km grid tiles from R2, filling cold tiles from Overpass
   (global one-fill-per-second gate + 30 requests/minute per network). Payloads stay as raw
   OSM footprints; techum lines are never server-cached.

6. Test the `workers.dev` URL before connecting the domain: address search, calculation,
   `/about`, `/analytics`, exports, mobile layout, and browser console.

## Domain and private analytics

1. Attach the purchased domain under **Workers & Pages → techum-shabbos-calculator →
   Settings → Domains & Routes**.
2. Under **Zero Trust → Access controls → Applications**, create self-hosted applications for:
   - `your-domain/analytics*`
   - `your-domain/api/analytics*`
3. Add an Allow policy limited to the owner's identity. Keep `/api/event` public.
4. Change `REQUIRE_ACCESS` in `wrangler.jsonc` to `"true"`, regenerate types, and redeploy:

   ```powershell
   npm run cf:types
   npm run typecheck
   npm run cf:deploy
   ```

The Worker also requires the Access identity header once `REQUIRE_ACCESS=true`; the Access
policy remains the primary enforcement layer.
5. Confirm the custom-domain deployment reports the `workers.dev` route disabled so the
   unprotected temporary hostname cannot bypass the domain's Access application.

## Analytics and retention

- Raw events, searched addresses, and calculation locations: 365 days.
- Anonymous visitor first/last-seen records and non-identifying daily totals: indefinite.
- Raw IP addresses are never inserted into D1.
- A keyed, monthly rotating network identifier expires with each raw event.
- Event writes: 60/minute per anonymous visitor/network combination.
- Geocoding: 20/minute per network plus a global one-request-per-second cache-miss gate.
- Repeated geocoding queries are cached in D1.
- Building tiles: 30/minute per network; cold Overpass fills share a one-per-second global slot.
  Tile metadata is in D1 (`building_tiles`); JSON payloads are in R2 (`techum-buildings`).
- A daily scheduled handler deletes expired raw events and old throttle slots.

Change `RAW_RETENTION_DAYS` only with a matching update to the About-page disclosure.

## Routine release

```powershell
npm test
npm run cf:types
npm run typecheck
npm run cf:dry-run
npm run cf:deploy
```

Do not expose analytics reads while the HMAC secret is missing or Access is not protecting
both analytics paths. Keep `REQUIRE_ACCESS=true` during any Access setup gap.
