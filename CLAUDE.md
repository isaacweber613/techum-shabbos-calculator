# Techum Shabbos Calculator — agent context

Standalone project. **Nothing to do with fleet ticket management** — never put this
project's config, files, or launch entries in any other repo. Open sessions with THIS
folder as the working directory.

## What this is

A techum Shabbos (תחום שבת) calculator: address → OSM building footprints → halachic city
derivation (ibur ha'ir chaining at 70⅔ amos, 141⅓ city merges, three-villages rule) →
ribua (true-north squared rectangle) → 2000-amos techum with square corners. Client-side
static app, no build step, no API keys. v1 built + live-verified 2026-07-10.

- Run: `node serve.mjs` → http://localhost:4173 (or preview_start name `tchum-calculator`
  — config in this project's `.claude/launch.json`)
- Tests: `node tests/geometry.test.js` — 22 golden tests from the Gemara's canonical
  shapes (circle, rotated square, chain gaps per amah, karpef, three villages, overlap
  machlokes, point mode). Keep them green; add a golden test for any new halachic rule.

## Source of truth

**TECHUM-SPEC.md is the halachic source of truth.** Every psak default, every machlokes,
every retraction is recorded there with dated rev notes (currently rev. 3). Isaac's
standing rule: any change to a halachic default gets a dated note in the spec — append,
don't overwrite. The tool is decision-support for a rav (MB 399:7 requires a mumcheh);
permanent draft banner, never present output as psak.

## Architecture

| File | Role |
|---|---|
| `js/geometry.js` | Pure halachic engine (no deps, node-testable): projection, clustering, merges, ribua, karpef, techum, concavity warnings |
| `js/data.js` | Overpass fetch + IndexedDB cache + change detection (`newer:` queries), Nominatim geocode, auditable dwelling-classification tag table |
| `js/settings.js` | Psak profiles (MB/Ashkenazi default, Chazon Ish, Mechaber/Sefardi) + persistence |
| `js/main.js` | App flow, Leaflet render, auto-expanding fetch, per-building overrides, snapshots, auto staleness check |
| `js/kml.js` | KML/GeoJSON export with embedded config + audit block |

## Key decisions (details + sources in TECHUM-SPEC.md)

- Default profile Mishna Berurah/Ashkenazi: R' Chaim Naeh 48 cm amah, karpef ON (Rema/MB
  398:36), compass squaring, overlapping-rects merge OFF (R' S. Miller) + warning,
  6-footprint city minimum (count-based APPROXIMATION of MB 398:38's 3-chatzeros model).
- Every disputed rule is a user-changeable setting; profiles are documented defaults.
- Determinism: engine is pure — same data + settings = same output. Cache the INPUT
  (raw OSM data, IndexedDB), always recompute boundaries (cheap, settings-dependent).
- Staleness is AUTOMATIC (Isaac: no user-facing check button): data >30 days old triggers
  a background Overpass `newer:` edit count; 0 edits → checkedAt stamped, clock resets;
  edits → auto refetch + report whether the techum line moved (meters). OSM deletions
  escape `newer:` — the "Fresh data" button is the deletion backstop.
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

## Known limits / gotchas

- OSM building use-tags are sparse — most buildings show orange "untagged"; the
  include-untagged default + per-building click-override is the intended workflow.
  Israel OSM ≈ 42% complete; expect heavy manual review there.
- Metro-scale (>20k buildings) merge passes may be slow (O(pairs) with bbox pruning).
- Multipolygon relations are exploded into pseudo-buildings per outer ring (slightly
  inflates footprint counts — flagged re the 6-count city minimum).
- Bow/concavity ≥4000 amos: detect-and-warn only; reviewer designates endpoints (planned UI).
- Verification gotcha: if the Browser pane is hidden, rAF suspends → screenshot/zoom time
  out even though JS eval works; verify via DOM/SVG bbox reads instead.
