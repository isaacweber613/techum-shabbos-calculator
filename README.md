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
node serve.mjs          # http://localhost:4173
node tests/geometry.test.js   # 22 golden tests from the Gemara's canonical shapes
```

No build step, no API keys. Data: OSM Overpass (buildings) + Nominatim (geocoding) +
Esri World Imagery (satellite tiles) — all free public endpoints; be gentle (rate limits).

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
7a. **Local data cache with automatic staleness handling** — fetched buildings are cached
   in the browser (IndexedDB), so repeat calculations are instant and shita-switching
   never refetches. When cached (or snapshot) data is **older than 30 days**, the app
   automatically asks OSM whether any building in the area was edited since the data date
   (Overpass `newer:` count query — cheap). No edits → data is stamped verified-current
   and the 30-day clock resets. Edits found → automatic refetch + recompute + a report of
   **whether the techum line actually moved and by how many meters** (most map edits
   don't touch the boundary). No user action required; **"Fresh data"** remains for an
   explicit refetch. Caveat: deleted buildings don't appear in `newer:` results — the
   occasional explicit refresh is the deletion backstop.
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
- Eruv-enclosure-as-city (MB 401:7), ir mubla'as extension, and eruv-techumin mode are
  flagged/planned, not computed.
