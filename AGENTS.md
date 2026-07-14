# Techum Shabbos Calculator — agent context

Standalone project. **Nothing to do with fleet ticket management** — never put this
project's config, files, or launch entries in any other repo. Open sessions with THIS
folder as the working directory.

## What this is

A techum Shabbos (תחום שבת) calculator: address → Overture building footprints → halachic city
derivation (ibur ha'ir chaining at 70⅔ amos, 141⅓ city merges, three-villages rule) →
ribua (true-north squared rectangle) → 2000-amos techum with square corners. Client-side
static app, no build step, no API keys. v1 built + live-verified 2026-07-10.

- Run: `node serve.mjs` → http://localhost:4173 (or preview_start name `tchum-calculator`
  — config in this project's `.Codex/launch.json`)
- Tests: `node tests/geometry.test.js` — 22 golden tests from the Gemara's canonical
  shapes (circle, rotated square, chain gaps per amah, karpef, three villages, overlap
  machlokes, point mode). Keep them green; add a golden test for any new halachic rule.

## Source of truth

**TECHUM-SPEC.md is the halachic source of truth.** Every psak default, every machlokes,
every retraction is recorded there with dated rev notes (currently rev. 13). Isaac's
standing rule: any change to a halachic default gets a dated note in the spec — append,
don't overwrite. The tool is decision-support for a rav (MB 399:7 requires a mumcheh);
permanent draft banner, never present output as psak.

## Architecture

| File | Role |
|---|---|
| `js/geometry.js` | Pure halachic engine (no deps, node-testable): projection, clustering, merges, ribua, karpef, techum, concavity warnings |
| `js/data.js` | Overture client + IndexedDB cache, Nominatim geocode, auditable dwelling-classification tag table |
| `worker/overture.ts` | Public Overture PMTiles range fetch + vector-tile decoding |
| `js/settings.js` | Psak profiles (MB/Ashkenazi default, Chazon Ish, Mechaber/Sefardi) + persistence |
| `js/main.js` | App flow, Leaflet render, auto-expanding fetch, per-building overrides, snapshots, auto staleness check |
| `js/kml.js` | KML/GeoJSON export with embedded config + audit block |

## Key decisions (details + sources in TECHUM-SPEC.md)

- Default profile Mishna Berurah/Ashkenazi: R' Chaim Naeh 48 cm amah, karpef ON (Rema/MB
  398:36), shape-aware/compass squaring, overlapping-rects **no-join** (R' Elyashiv /
  R' N. Karelitz / R' Belsky) + warning, with R' S. Miller's join-without-redraw and the
  expansive redraw approach available only as advanced alternatives,
  6-footprint city minimum (count-based APPROXIMATION of MB 398:38's 3-chatzeros model).
- Every disputed rule is a user-changeable setting; profiles are documented defaults.
- Determinism: engine is pure — same data + settings = same output. Cache the INPUT
  (raw Overture release data, IndexedDB), always recompute boundaries (cheap, settings-dependent).
- Overture releases are immutable and named in the audit output. Updating the configured
  release bumps the shared tile-cache version; there is no user-facing staleness workflow.
- Snapshots (JSON: buildings + pin + settings + overrides) = the reviewable/approvable
  artifact; old snapshots auto-verify against today's map on load. v2 idea: shared
  library of rav-approved snapshots ("database of cities" = psak registry, not a cache).
- Amah comparison lines are "scenarios," NOT machmir/meikil — results don't nest across
  amos (the 4×4 minimum and join gaps scale too; topology can flip either way).
- Verified-dwellings-only amber line brackets untagged-building uncertainty; neither line
  is authoritative.

## Isaac's directives

- Works for ANY city — published maps (Hunter NY, Borehamwood, Chicago) are validation
  benchmarks only, never scope. Users = laypeople (locked defaults, flags) AND rabbanim
  (full config). App auto-decides what it can; uncertain things get one-click review.
- Defaults follow the widely-known psak; genuinely split machlokes → both options.
- Automatic over buttons (e.g., staleness check runs itself after 30 days).
- Plain-text questions, no AskUserQuestion popups. No spawn_task chips.
- Mehalich policy (2026-07-10): open questions that block functionality don't stay
  unimplemented — research the mehalachim, adopt the best-supported as documented
  default, expose alternatives as settings (spec rev-4 note).

## TODO

- Hunter, NY validation benchmark (deferred by Isaac 2026-07-10 — published under both
  R' Moshe and Chazon Ish shiurim, two-shita cross-check; fallback: Borehamwood).

## Open halachic questions (need a posek — full list in spec Part 7)

Biggest: does a tzuras-hapesach eruv make the enclosed area "the city" (techum from the
eruv line)? Also: bow-rule endpoint designation on real city outlines, modern beis-dirah
cases (hotels/offices/schools), courtyard model vs footprint count for city status,
karpef-after-ibur split, whether ribua's filled corners count as "in the city" for a
person standing there. Q2 (eruv) and Q4 (bow) are getting default mehalachim per the
mehalich policy above.

## Shipping

**Shipping is the default for implementation requests.** When Isaac asks to fix, change,
add, remove, or build something, finish by releasing it to production unless he explicitly
says `local only`, `don't ship`, or asks only for analysis/review. Do not wait for the
phrase "ship it" and do not stop after making a local change.

Standing release authorization:

- Include all current changes in this repository unless Isaac explicitly excludes some.
  Do not pause merely because other in-repo changes predate the current task; still check
  for secrets, generated junk, or files that clearly belong to another repository.
- Use the existing GitHub and Cloudflare authentication without routine confirmation.
- Keep release narration brief and act immediately. Report only failures that actually
  block safe progress.
- Prefer the shortest representative live verification. For a calculation smoke test,
  use a small/rural location or a cached snapshot; do not choose a metro-scale address
  unless the change specifically concerns large-city behavior.
- Reuse current browser and CLI sessions. A stale `CLOUDFLARE_API_TOKEN` environment
  override may mask Wrangler's stored OAuth login; retry with that process-level override
  removed before declaring Cloudflare authentication blocked.

Default release path:

1. Confirm the diff belongs to this repository and contains no secrets or unrelated work.
2. Run `npm test`, `npm run typecheck`, and `npm run cf:dry-run`. Stop on any failure.
3. Commit any intended uncommitted changes, push the branch, and create or update its PR.
4. Merge the PR into `master` once checks pass, then update the local `master` by
   fast-forward only. Never force-push or bypass a failing required check.
5. Run `npm run cf:deploy` from this repository root. This deploys the Worker, D1-backed
   API, and built static assets described by the root `wrangler.jsonc`.
6. Verify the deployed version at `https://tchumshabbos.com`: load the app, check the
   console and failed network requests, and exercise the changed behavior plus the
   smallest relevant calculation smoke test.
7. Report the commit SHA, PR/merge result, Wrangler deployment/version identifier, live
   URL, and verification results.

There is exactly one production deployment: the main calculator at
`tchumshabbos.com`, configured by the root `wrangler.jsonc`. Do not create or maintain
alternate coming-soon, preview, Pages, or Worker deployments unless Isaac explicitly
requests a new deployment architecture.

## Known limits / gotchas

- Overture building use classes are sparse, especially on ML footprints. Use-unknown
  structures are included automatically; corrections are optional and share-reviewable.
- Metro-scale (>20k buildings) merge passes may be slow (O(pairs) with bbox pruning).
- Multipolygon relations are exploded into pseudo-buildings per outer ring (slightly
  inflates footprint counts — flagged re the 6-count city minimum).
- Bow/concavity ≥4000 amos: provisional no-fill until the reviewer designates endpoints;
  then the selected sourced bow rule changes the multi-region boundary.
- Verification gotcha: if the Browser pane is hidden, rAF suspends → screenshot/zoom time
  out even though JS eval works; verify via DOM/SVG bbox reads instead.
