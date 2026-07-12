# Techum Shabbos Calculator

> ⚠ **DRAFT TOOL — not a psak halacha.** Techum measurement requires an expert (MB 399:7).
> Every output depends on the psak settings shown and on OpenStreetMap data quality.
> Verify with a rav before relying on anything this tool draws.

## License

**PolyForm Noncommercial 1.0.0** — free to use, study, and share for noncommercial
purposes (personal use, learning, shuls, schools, charities, religious observance).
**Selling products built with this software is not allowed.** See [LICENSE](LICENSE).
Commercial licensing: contact the author.

Type an address → the app fetches the real buildings around it from OpenStreetMap,
derives the halachic city (ibur ha'ir chaining at 70⅔ amos, city merges at 141⅓,
three-villages rule), squares it to a true-north rectangle (ribua ha'ir), and draws the
2000-amos techum with square corners — all shitos configurable, all uncertainty flagged.

Halachic sources and every design decision: **[TECHUM-SPEC.md](TECHUM-SPEC.md)**.

## Run

```
node serve.mjs          # quick local server: http://localhost:4173
npm test                # geometry + classification/settings/export tests
```

Production uses Cloudflare Workers Static Assets + D1. See
**[CLOUDFLARE-DEPLOY.md](CLOUDFLARE-DEPLOY.md)** for deployment, database migration,
domain, private analytics, retention, and release steps.

Cloudflare-local development:

```bash
npm install
npx wrangler d1 migrations apply techum-analytics --local
npm run cf:dev
```

Data: OSM Overpass (buildings), Nominatim (geocoding through an identified/cached production
proxy), and Esri World Imagery (satellite tiles).

## Using it

1. Enter an address (or click the map), confirm the pin, **Calculate techum**.
2. Layers: buildings (green dwelling / orange untagged / purple needs-review / gray
   non-dwelling), blue city rectangle, teal karpef, **red techum boundary**.
3. **Click any building** to force include/exclude it — recomputes instantly.
4. Psak profiles: Mishna Berurah/Ashkenazi (default), Chazon Ish, Mechaber/Sefardi —
   every setting individually overridable (profile shows "Custom").
5. Optional comparison line: draw the techum under a second amah simultaneously.
6. Export KML (opens in Google Earth for review) or GeoJSON — both embed the full config
   **plus an audit block** (engine version, OSM data timestamp, extent, counts, overrides,
   whether the search frontier closed, projection, orientation choice).
7. **Save/Load snapshot** — freezes the fetched buildings + settings + overrides to a JSON
   for a deterministic replay: the engine is pure, so same data + same settings = same
   lines, forever. (OSM data changes over time; halachos don't.)
7a. **Building data cache (local + shared)** — raw OSM footprints are cached, never the
   computed techum lines (settings-dependent). **L1:** browser IndexedDB for the same pin.
   **L2 (production):** Worker `/api/buildings` unions ~2 km grid tiles from R2 so the
   second user in the same city skips Overpass. Cold tiles fill once from Overpass and
   stay until **"Fresh data"** or the automatic 30-day change-check finds edits.
   When cached data is **older than 30 days**, the app asks OSM whether any building in
   the area was edited (`newer:` count — cheap). No edits → stamp verified-current and
   reset the clock; edits → refetch + report whether the techum line moved (meters).
   Caveat: deletions don't appear in `newer:` — occasional explicit refresh is the backstop.
   Localhost (`node serve.mjs`) still talks to Overpass directly.
8. The **amber dashed line** is the verified-dwellings-only scenario — it brackets the
   uncertainty from untagged buildings. It is a *scenario*, not a machmir line: changing
   which buildings count can move the city topology in either direction.

## Architecture

| File | What it does |
|---|---|
| `js/geometry.js` | The halachic engine (pure, no deps, node-testable): local true-north projection, 70⅔ clustering, city merges, ribua bounding rectangle, karpef, techum, concavity warnings |
| `js/data.js` | Overpass fetch, Nominatim geocode, the auditable dwelling-classification tag table |
| `js/settings.js` | Psak profiles (spec Part 2) + persistence |
| `js/main.js` | App flow, Leaflet rendering, auto-expanding fetch, per-building overrides |
| `js/kml.js` | KML/GeoJSON export with embedded config + disclaimer |
| `tests/geometry.test.js` | Golden tests: circle→square, rotated square re-squared, chain gaps under each amah, lone-house asymmetry, karpef, three villages, overlap machlokes, point mode |

## Known limits (v1)

- OSM building **use-tags are sparse** (most buildings are "untagged" orange) — the
  include-untagged default + per-building override is the intended workflow.
- City-merge distance checks are exact but O(pairs) — metro-scale runs (>20k buildings)
  may be slow; the fetch cap (settings) is a **data limit, not a halachic cap**, and the
  app says so when hit.
- Bow/concavity rule (SA 398:3, ≥4000-amos gaps) is detected and **warned**, not auto-resolved.
- Eruv-enclosure-as-city defaults off: the engine measures from the buildings-derived city.
  A rav-validated *hukaf l'dira* perimeter remains an advanced future input (spec rev. 5).
  Ir mubla'as extension and eruv-techumin mode are flagged/planned, not computed.
