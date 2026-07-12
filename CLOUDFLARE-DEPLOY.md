# Cloudflare production handoff

Production is one Cloudflare Worker serving explicit static assets plus three API routes,
with D1 for analytics and Cloudflare Access protecting the dashboard. `serve.mjs` remains a
local-development server; it is not the production origin.

## One-time account setup

1. Authenticate Wrangler interactively:

   ```powershell
   npx wrangler login
   npx wrangler whoami
   ```

2. Create the database and replace the zero UUID in `wrangler.jsonc` with the returned ID:

   ```powershell
   npx wrangler d1 create techum-analytics --location wnam
   ```

3. Set `GEOCODER_CONTACT` in `wrangler.jsonc` to a public contact URL or email. Public
   Nominatim requires an identifiable application and operator.

4. Create a random HMAC secret interactively. Never put it in the repository or command line:

   ```powershell
   npx wrangler secret put IP_HASH_SECRET
   ```

5. Apply migrations and deploy:

   ```powershell
   npx wrangler d1 migrations apply techum-analytics --remote
   npm run cf:deploy
   ```

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
5. After the custom domain is verified, add `"workers_dev": false` to `wrangler.jsonc` so
   the unprotected `workers.dev` hostname cannot bypass the domain's Access application.

## Analytics and retention

- Raw events, searched addresses, and calculation locations: 365 days.
- Anonymous visitor first/last-seen records and non-identifying daily totals: indefinite.
- Raw IP addresses are never inserted into D1.
- A keyed, monthly rotating network identifier expires with each raw event.
- Event writes: 60/minute per anonymous visitor/network combination.
- Geocoding: 20/minute per network plus a global one-request-per-second cache-miss gate.
- Repeated geocoding queries are cached in D1.
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

Do not publish while `GEOCODER_CONTACT` is `SET_BEFORE_PRODUCTION`, the D1 ID is the zero
UUID, the HMAC secret is missing, or Access is not protecting both analytics paths.
