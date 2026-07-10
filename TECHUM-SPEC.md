# Techum Shabbos Calculator — Halachos & Spec

> **STATUS: Researched draft (2026-07-10) — sources verified via web research against Sefaria,
> Chabad.org (Shulchan Aruch HaRav), Halachipedia, Peninei Halakha, Rambam, and contemporary
> techum literature. NOT a psak halacha.** The Mishna Berurah (399:7) requires techum
> measurement by an expert (*mumcheh*) who knows these halachos; this tool is decision-support
> for a posek/measurer, not a replacement. Items marked ⚠ need a posek's decision or further
> verification before they're coded as defaults.
>
> Citation note: se'if numbering in siman 398 differs between the Mechaber's editions,
> Shulchan Aruch HaRav, and Halachipedia. Citations below follow SA HaRav's breakdown where
> noted; confirm against your preferred edition.

Primary sources: Mishna & Gemara Eruvin (esp. 55a–58b); Rambam Hilchos Shabbos 27–28;
Shulchan Aruch OC 396–399, 405, 408, 414–415; Mishna Berurah; Chazon Ish OC 39, 110;
Igros Moshe OC 1:136; Minchas Yitzchak 7:24, 8:33.

---

## Part 1 — The Halachos

### 1.1 Base rule: 2000 amos

- One may not walk more than **2000 amos** beyond his *makom shevisa* — the place he was at
  when Shabbos began (SA OC 397:1; Rambam Shabbos 27:1–2). Beyond it: 4 amos only (SA 405:1).
- If he was in a city at bein hashmashos, **the whole city is like his 4 amos** — he
  traverses all of it plus 2000 amos beyond its (squared) edge, walled or not (SA 397–398).
  Any area enclosed by a 10-tefach partition made for dwelling likewise collapses to
  "4 amos."
- **D'oraisa/d'rabbanan:** 2000 amos is d'rabbanan per Rambam/Rif/Chinuch; the Rambam holds
  **12 mil (24,000 amos)** is d'oraisa (per Yerushalmi Eruvin 3:4); many Rishonim (Rosh,
  Tosafos, Baal HaMaor) hold even 12 mil is d'rabbanan. MB 397:1 is concerned for the
  d'oraisa view at 12 mil; concludes many hold it's all d'rabbanan.
- **Consequence:** *halacha k'divrei ha-meikel b'eruv* — in genuine measurement doubt we
  follow the more lenient (larger) measurement (Eruvin 58b; SA 399). This licenses generous
  resolution of borderline measurement cases — but **not** of disputed halachic-model
  questions like the overlapping-squares merge (§1.5), where poskim lean strict (Minchas
  Yitzchak 8:33; Lehrhaus).

### 1.2 Shiur of the amah — the master scaling constant

| Shita | Amah | 2000 amos | 70⅔ amos | 141⅓ amos | Source |
|---|---|---|---|---|---|
| R' Chaim Naeh | 48 cm | **960 m** | 33.9 m | 67.8 m | standard machmir line; used by e.g. the Borehamwood (UK) techum project |
| R' Moshe Feinstein | 21.25 in ≈ 54 cm | **1,080 m** | 38.2 m | 76.3 m | Igros Moshe OC 1:136 (permits 23 in ≈ 58.4 cm → 1,168 m as the stringent amah) |
| Chazon Ish | 57.6 cm | **1,152 m** | 40.7 m | 81.4 m | Chazon Ish OC 39 |
| (R' Chaim Beinish) | 45.6 cm | 912 m | 32.2 m | 64.5 m | cited in Peninei Halakha as a modern survey value ⚠ verify before offering |

- Direction of stringency is **not uniform**: a smaller amah is machmir both for the 2000
  (walk less) *and* for the 70⅔ joining gap (buildings join less easily → smaller city).
  Community maps typically publish the machmir R' Chaim Naeh 960 m line, sometimes with the
  Chazon Ish 1,152 m as an outer lenient line.
- **Config:** amah is a user-selectable factor; every threshold (4, 70⅔, 141⅓, 2000, 4000,
  24,000 amos) scales from it. Default: 48 cm (machmir), with an optional second line.

### 1.3 What is "the city"? Dwellings, not municipal boundaries

The halachic edge is the line of the **outermost qualifying dwellings** (SA OC 398:6–10;
SA HaRav 398:8–14) — never the civil boundary.

**Beis-dirah predicate — a structure counts if it is roofed, ≥ 4×4 amos, and inhabited or
attended** (SA HaRav 398:8, 10; under 4 amos wide is not a dwelling even if very long).

- **Counts (extends the city):** houses; a shul **with** an attendant's residence; a
  barn/stable **with** a resident watchman; a cemetery structure **with** a resident
  caretaker; a bridge or toll/customs house with a resident; a cave with a house at its
  mouth (measured from the cave's far end); roofed structures with three or even two walls;
  habitable ruins that retain walls **and a roof**.
- **Does not count:** unroofed structures; cisterns, pits, dovecotes; a bare shul, warehouse,
  or barn with no resident; open cemeteries; mobile/docked ships; a flimsy seasonal
  watchman's hut in a theft/flood-prone area.
- **Walled city timing** (SA HaRav 398:14): walled *before* settled → measure from the
  houses; settled *then* walled → measure from the wall. ⚠ Rarely computable from data;
  surface as a manual option.
- **Rivers/water (§1.7):** never extend the city edge.

### 1.4 Ibur ha'ir — the 70⅔-amos joining rule (SA OC 398:5–7; SA HaRav 398:6–7, 11–12)

- A qualifying dwelling within **70 amos + 4 tefachim (70⅔ amos)** of the city is annexed
  (*iburah shel ir*), and the rule **chains** — houses each within 70⅔ of the next form one
  city "even several days' walk long." The techum starts 70⅔ beyond the last house
  ⚠ (that trailing 70⅔ is the karpef question, §1.6).
- **Two settlements merge at ≤ 141⅓ amos** (2 × 70⅔ — each town gets its own margin and they
  meet). **Asymmetry:** only a *settlement* gets the double margin; a **lone house** joins
  anything only within a single 70⅔ (SA HaRav 398:11).
- **Three-villages rule** (SA HaRav 398:12): a middle village within 2000 amos of each of
  two outer ones merges all three if, when notionally placed on the line between the outer
  two, the gaps become ≤ 141⅓ amos each; the middle may not be wider than the outer gap;
  no merge if the outer two are ≥ 4000 amos apart and the middle sits ≥ 2000 amos off the
  line.
- Halachipedia frames a "city" as ≥ 6 houses so linked; a lone house beyond joining range is
  measured from its own walls. ⚠ verify the 6-house threshold before enforcing it.
- **Computation:** single-linkage clustering of qualifying dwellings at threshold 70⅔ amos
  (buffer each footprint by half the gap, union, dissolve). Then cluster-level merge passes:
  two-cities 141⅓ rule (cities only), three-villages projection test. All before squaring.

### 1.5 Ribua ha'ir — squaring the city (SA OC 398:1–3; Rambam Shabbos 28:1–5)

*(rev. 3: "RESOLVED" retracted — the existence of ribua is settled; the universal
algorithm for deriving it from a real metropolitan footprint is not.)*

Baseline: the city polygon (after ibur) is enclosed in the **smallest bounding rectangle
aligned to the four directions of the world** (true compass N–S/E–W; Bamidbar 35:5).
A pure kula: residents gain the corners and concavities. **But orientation is a decision
stage, not a constant:** an already-rectangular city may keep its own orientation; a
trapezoid may follow its own sides; a natural straight edge (shoreline) can establish an
orientation; genuinely ambiguous intermediate shapes are disputed — the Chazon Ish even
suggests, where orientation cannot be resolved, using only the area common to both
candidate techumin (or the smaller result). **Implementation: the squaring angle is an
explicit reviewer decision** (0° = compass default; manual angle = a documented
orientation choice recorded in every export), not an automatic inference.

Rules by shape:
- Circle / triangle / any non-rectangle → compass-aligned bounding rectangle.
- Already a compass-aligned rectangle → left as-is.
- **A square/rectangle rotated off the compass → re-squared to the larger compass-aligned
  bounding rectangle** (SA 398:1 explicitly).
- Trapezoid → short side extended to match the long side.
- Irregular protrusions → each face is squared to a straight line through its
  furthest-outward point (one jutting house pulls the whole side out to it) (SA 398:2).
- **Bow / L / gamma shapes** (SA 398:3; SA HaRav 398:3–5): if the two endpoints of the arc
  are **< 4000 amos apart**, the concavity is treated as filled with houses and squared
  over. Additional leniencies: fill also if the chord-to-arc depth is < 2000 amos, or the
  arms separate gradually. If endpoints ≥ 4000 amos apart → do **not** fill the whole gap;
  square only up to where the arc narrows below 4000.
- **Machlokes — alignment:** default (SA HaRav 398:3; Chayei Adam 68:14; MB) is always
  compass. **Chazon Ish (OC 110:23):** a city with one naturally straight side (e.g. a
  shoreline — Manhattan's Hudson edge) is squared to *that* orientation. Peninei Halakha:
  only a genuine natural straight edge governs, not an arbitrary straight stretch.
  → config toggle with user-designated reference edge.
- ⚠ **Overlapping-squares merge:** whether two cities merge because their *squared*
  rectangles overlap (even though the houses don't come within 141⅓) is disputed; poskim
  lean strict (Minchas Yitzchak 8:33). Default **off**, flag when it would trigger.

**Computation:** compass-aligned bounding box of the cluster polygon, preceded by a
concavity-filling pass gated on the 4000-amos endpoint test. In a local UTM/azimuthal CRS,
axis-aligned ≈ true-north-aligned (apply grid-convergence correction; never magnetic north).

### 1.6 Karpef — the extra 70⅔ buffer (SA OC 398:5; MB 398:21, 398:36)

*(rev. 3: split into three distinct rules; earlier text contradicted the profile table.)*

1. **`single_city_karpef`** — Mechaber/Rambam: no karpef for a single city (2000 from the
   outermost dwellings). Rema (recorded MB 398:36): add 70⅔ first. **Profile-governed:
   ON in the MB/Ashkenazi default profile, OFF in Mechaber/Sefardi.**
2. **`karpef_after_joined_outlying_house`** — whether a structure annexed through *ibur*
   itself generates another 70⅔ beyond it. The MB/Biur Halacha and Chazon Ish treatments
   are not identical and are **not** captured by one "inflate rectangle by 70⅔" operation.
   ⚠ v1 approximates this inside the single toggle; split pending posek input (open Q).
3. **Two-city 141⅓ allowance** — each settlement's 70⅔ margin toward its neighbor. **Not
   optional** in the same sense; always applied in the merge test (all profiles).

### 1.7 Squaring the techum itself — *me'aber es hapinos* (SA OC 399; Rambam 28:5; Eruvin 55a)

- The 2000 amos extend from each side of the city rectangle **and the corners are filled**:
  the techum boundary is itself a rectangle with **square corners** — diagonal reach at a
  corner ≈ 2000·√2 ≈ **2828 amos**.
- **Computation:** techum = city rectangle expanded 2000 amos in each cardinal direction
  (half-plane intersection). **Not** a rounded Minkowski buffer — the square corners are
  halachically mandated extra area.
- A person in an open field (or via eruv techumin) gets a 4000×4000 square centered on his
  4 amos and **may orient it as he wishes** — including 45°, pointing a corner toward his
  destination (Peninei Halakha; Halachipedia). → point-mode rotation option.

### 1.8 How distance is measured (SA OC 399; Rambam 28:11–16; Eruvin 57b–58b)

- Chazal's method: a 50-amah flax rope pulled taut, measured only by a **mumcheh** (MB
  399:7). Terrain: *mavli'in* (spanning valleys horizontally with the rope) and *koder*
  (stepped telescoping on steep slopes) — both are techniques to recover the **horizontal
  plan-view distance**. ⚠ exact width/depth thresholds between the methods vary by Rishon.
- Therefore **modern horizontal GPS/aerial/map distance is the halachic target quantity**,
  not an approximation. Peninei Halakha explicitly: today it is best to establish techum
  with aerial maps or GPS; we need not re-enact the rope method. Kovetz Chaburos cited
  approvingly for Google-Maps-based measurement of the 70⅔/141⅓/2000 gaps.
- Conflicting measurements → follow the lenient/larger (Eruvin 58b), within measurement
  doubt only.
- ⚠ One Hebrew secondary source suggests reducing map distance ~7% (measure ~1860 amos) in
  hilly terrain as a stringency. Single-source, uncorroborated, and in tension with the
  horizontal-is-the-target principle; do not implement without a posek.

### 1.9 Water and terrain features (SA 398:9, 13; Meishiv Davar 4:58; Minchas Yitzchak 8:33)

- An always-flowing **river never extends** the city; but the ribua square and the
  2000-amos band **pass freely over water** (Chasam Sofer OC 94).
- A **dry wadi** with a ≥ 4-amah walkable ledge used by residents joins the city ground;
  otherwise it's simply consumed inside the 2000.
- Lakes/pools enclosed by the built footprint are interior — the square is drawn to the
  outer dwellings regardless.

### 1.10a Locating the person's city (implementation rule, rev. 2)

A pin is treated as **in a city** if (priority order): (1) it lies **inside a settlement's
squared rectangle** — being within the city's squared bounds makes him a resident (whole
city = 4 amos); if inside several nested rectangles (hamlet inside a city's rect), the
larger settlement wins; (2) otherwise, if within **70⅔ amos** of a settlement's structure
(iburah shel ir). Else: open-field point mode. ⚠ The premise that the *filled corners* of
the ribua count as "in the city" for a person standing there is our reading; confirm with
a posek (related to ir mubla'as, SA 408).

### 1.10 Person-level rules (context, mostly out of scope v1)

- Left the techum knowingly → confined to 4 amos (SA 405:1); nuances for ones/shogeg.
- **Eruv techumin** (SA 408–415): depositing two meals' food at a point within your techum
  before Shabbos **relocates** (not extends) your shevisa there — new 2000-amos square from
  the eruv, losing the far side. Requires a mitzvah-need; must be within the original 2000.
  → v2 feature: "eruv mode" — pin the eruv, render new square + the lost region.

---

## Part 2 — Psak configuration: PROFILES & DEFAULTS (rev. 2 — 2026-07-10)

Policy (per Isaac): follow the widely-known psak as the default; **every** disputed rule is
a setting the user can change; the app decides automatically wherever it can and makes human
review one click where it can't. Every export prints the active config.

Rev-2 corrections (after external review, GPT-5.6 2026-07-10):
- **Six-house minimum IS sourced** — MB 398:38: a "city" is three chatzeros of two houses
  each (≈6 houses), with Chazon Ish qualifications on the courtyards/entrances. Scope
  clarified: the minimum governs when a cluster is an **independent city** that receives
  city-level rules (the 141⅓ city-to-city merge); it is **not** required for an individual
  beis dirah to extend an existing city — a single qualifying house within 70⅔ joins and
  chains onward.
- **No halachic maximum metro size** — Peninei Halakha states the chain can extend "even a
  distance of days' walk" as long as each gap qualifies. Any cap in the app is a **data
  limit** and must be labeled as such (techum shown as an inner/machmir bound when hit).
- **Karpef is denomination-sensitive** — MB 398:36 records the Rema's single-city karpef
  (70⅔ before the 2000). So "off" is a Mechaber/Sefardi default, **on** is the honest
  MB/Ashkenazi default. Moved into the profile system.
- **Squaring orientation reopened** — compass is the baseline, but many poskim follow a
  city's clear natural straight side / right angle (not only the Chazon Ish); Chayei Adam is
  the consistently-compass approach. Kept compass as default, natural-edge as a real option.
- **Overlapping-squares is a genuine algorithm-changing machlokes** — the Chazon Ish-based
  approach redraws the joint encompassing rectangle; R' Shlomo Miller is reported not to
  accept the automatic redraw (J. of Halacha & Contemporary Society 74). Now a toggle, not
  warning-only. Default off (strict), warning shown when it would trigger.
- **Amah is a first-order variable** (±20% on every distance), not a "smaller" item. One
  consistent measurement profile end-to-end; **no mixing shitos** is an application policy,
  not a sourced psak.

### Profiles (each setting individually overridable → "Custom")

| Setting | **Mishna Berurah / Ashkenazi (DEFAULT)** | Chazon Ish | Mechaber / Sefardi |
|---|---|---|---|
| Amah | 48 cm (R' Chaim Naeh) → 960 m | 57.6 cm → 1,152 m | 48 cm → 960 m |
| Single-city karpef (+70⅔ before 2000) | **on** (Rema; MB 398:36) | on ⚠ confirm CI's own position | off (Mechaber/Rambam) |
| Squaring alignment | compass (Chayei Adam 68:14) | natural straight edge permitted (CI OC 110:23; user sets the reference angle) | compass |
| Overlapping-squares rect merge | **off** + warning (R' S. Miller) | on (CI redraw) | off + warning |
| City minimum for the 141⅓ merge | 6 houses (MB 398:38) | 6 + CI courtyard qualifications ⚠ | 6 |
| Bow/concavity fill (< 4000 amos endpoints) | on (SA 398:3 — stated halacha, all profiles) | on | on |
| Unknown-use buildings | include, flagged for review (all profiles — data policy, not psak) | ” | ” |
| Eruv-enclosure-as-city (MB 401:7) | **off — rav-selected setting only** (real basis, but modern mega-enclosures disputed) | off | off |
| 12-mil ring / second-shita comparison line | hidden / off (available in all profiles) | ” | ” |

Audit rule: any change to defaults gets a dated rev note in this section (append, don't
overwrite).

### Rev-3 notes (2026-07-10, after second external review)

- **Six-house minimum is a count-based approximation.** The real rule is 3 *chatzeros* ×
  2 houses (MB 398:38) with CI qualifications on courtyards/entrances — apartment
  buildings, shared lobbies, and separate entrances break a naive footprint counter. The
  engine's counter is labeled an approximation in every export; a manual
  `qualifies_as_city` per-cluster determination is the planned replacement. Every
  count-driven merge is already warned for review.
- **Amah comparison lines are "scenarios," not machmir/meikil bands.** A smaller amah also
  shrinks the 4×4-amos minimum-dwelling test and every join gap — one changed join can
  alter city topology by kilometers, so an RCN result is NOT guaranteed to nest inside a
  CI result. UI language updated accordingly.
- **4×4-amos minimum dwelling filter implemented** (SA HaRav 398:10), scales with the
  amah; excluded structures are counted in the panel and overridable per building.
- **Unknown-buildings "include" default is NOT conservative** (annexing an unknown chain
  can enlarge the area). The app now draws a second **verified-dwellings-only scenario**
  line; the two lines bracket the data uncertainty and neither is authoritative.
- **Karpef split into three rules** (see §1.6); v1 approximates #2 inside the toggle.
- **Ribua "RESOLVED" retracted**; orientation is an explicit reviewer decision (§1.5).
- **Bow/concavity pass is detect-and-flag, not auto-fill** — arbitrary suburban polygons
  have no unique "two endpoints of the bow"; the reviewer designates them (v1: warning
  regions on the map; endpoint designation UI planned).
- **Determinism, caching & the "database" question (Isaac, 2026-07-10):** the engine is
  pure (same data + settings → same output). Nondeterminism enters only through OSM data
  updates. Three-layer answer to "save city boundaries in a DB vs compute each time":
  1. **Cache the INPUT, not the output** — the Overpass fetch is slow and settings-
     independent; computed boundaries are ~1s and settings-dependent (a boundary cache
     would need an entry per city × amah × karpef × …). Implemented: local IndexedDB
     cache of raw building data per area, 7-day TTL, "Fresh data" button bypasses,
     data age always shown, and the audit stamp records the true data date either way.
  2. **Snapshots** freeze fetched buildings + pin + settings + overrides to a JSON for
     exact replay/sharing (the artifact a rav actually reviews and approves).
  3. **v2: a published snapshot library** — a shared folder/DB of *reviewed* city
     snapshots with rav sign-off metadata. That's the real "database of cities": a psak
     registry, not a compute cache.
  4. **Staleness detection ("how do we know the map updated?"):** AUTOMATIC (per Isaac —
     no user-facing button). Cached/snapshot data older than **30 days** (autoCheckDays)
     triggers a background Overpass `newer:` count of building edits since the data date.
     No edits → entry stamped verified-current (checkedAt), clock resets. Edits → auto
     refetch + recompute + techum-corner displacement report in meters ("unchanged" vs
     "moved X m — re-review"). Known gap: OSM deletions don't appear in `newer:` results;
     the explicit "Fresh data" refetch is the deletion backstop. A v2 registry would run
     this same check on a schedule per published city.
  Every export carries an audit block (engine version, data timestamp, extent, per-class
  counts, override list, frontier-closed status, projection, orientation choice).
- **MB 401:7 citation for the eruv-enclosure question retracted** — siman 401 discusses
  the techum status of objects; the real sources for "does the eruv wire become the city
  edge" are in responsa literature that must be pulled properly (open Q2).
- **Milestone guidance adopted:** next serious step is a rav-facing validation pass on one
  curated city against a published techum map, before promoting any default as a consumer
  answer. The tool remains address-agnostic; this is about validation, not scope.

---

## Part 3 — Product spec

### 3.0 Scope & users

- **Works for any address, any city, worldwide** — no per-city setup. Data sources
  (Overture/OSM) and the geometry engine are global; the only thing that varies by place is
  data quality, which the app measures and surfaces (see confidence indicator below).
- **Two personas, one app:**
  - **Regular person:** types an address, gets the map with the locked defaults (Part 2).
    No halachic decisions asked of them. A visible data-confidence indicator
    (green = complete footprints/tags, yellow/red = gaps found) plus the standing
    "verify with a rav" banner — shown, not buried.
  - **Rav / mumcheh (advanced mode):** the full config matrix, per-building
    include/exclude, the flagged-uncertainty queue (borderline 70⅔ joins, unclassified
    buildings, overlapping-squares warnings), and annotated KML/PDF export for psak.
- The app auto-decides everything it can (clear tags, unambiguous joins, geometry); anything
  uncertain is decided conservatively for the simple view and queued for one-click review in
  advanced mode — never a silent guess presented as certain.

### 3.1 User flow

1. Enter address / drop pin → confirm the resolved building on satellite imagery
   (**never** trust the raw geocode; snap to a footprint).
2. Pick shitos (Part 2 matrix, defaults pre-set).
3. Layers rendered on satellite map, each toggleable and inspectable:
   - **L1** dwellings used (click to include/exclude → instant recompute)
   - **L2** halachic city polygon (post-ibur clusters, merge passes)
   - **L3** ribua rectangle (true-north aligned)
   - **L4** techum boundary (rectangle + 2000 amos)
   - **L5** optional machmir/meikil band (e.g. 960 m vs 1,152 m lines)
4. Export **KML/KMZ** (Google Earth review), GeoJSON, printable PDF. Every export carries
   the "requires review by a rav/mumcheh" banner and the full config used.

### 3.2 Pipeline

```
address ─► geocode ─► snap to building footprint (confirm w/ user)
        ─► fetch footprints, expanding radius (Overture buildings + OSM Overpass fallback)
        ─► classify dwellings (tags + heuristics + manual override)
        ─► project to local UTM (estimate_utm_crs), all math in meters
        ─► ibur: buffer by (70⅔·amah)/2, union, dissolve → city clusters
        ─► merge passes: two-cities ≤141⅓ (cities only) ; three-villages test
        ─► concavity pass: fill bows/Ls where endpoint gap < 4000 amos
        ─► ribua: compass-aligned bounding rectangle (convergence-corrected true north)
        ─► [karpef toggle: inflate rectangle 70⅔]
        ─► techum: expand rectangle 2000·amah on all four sides (square corners)
        ─► reproject WGS84 ─► render (MapLibre/Leaflet + satellite) ─► KML/GeoJSON/PDF
```

Modes: **settlement mode** (above), **point mode** (open field: 4000×4000 square, rotatable),
**eruv mode** (v2 — point mode centered on eruv + "lost region" display).

### 3.3 Human-in-the-loop is the product

Footprint data will be wrong somewhere; dwelling status is halachic judgment (attended barn?
shul with a dirah?). The reviewer clicks buildings in/out and watches the line move. The tool
makes an expert's judgment fast and visual — it does not hide it.

---

## Part 4 — Accuracy & risk register

| # | Risk | Magnitude | Mitigation |
|---|---|---|---|
| 1 | Dwelling classification from map data | moves city edge arbitrarily | biggest real risk — manual override UI, satellite backdrop, strict default |
| 2 | Footprint completeness (OSM Israel ≈ 42% complete; rural US fringes weak) | moves city edge | cross-check Overture vs OSM vs imagery; manual add tool |
| 3 | Amah machlokes | ±≈190 m | config + dual lines |
| 4 | Karpef / merge machlokes | ~34–41 m / km-scale merges | config flags, documented |
| 5 | Geocoding (interpolated) | 10–50 m, ≤400 m rural | snap to footprint; never feed raw geocode to joining logic |
| 6 | OSM footprint position | 2–4 m | can flip a borderline 70⅔ join — show borderline joins as "uncertain" |
| 7 | Grid vs true north | ≤3.6° at UTM zone edge | convergence correction; never magnetic |
| 8 | UTM distortion @10 km | ≪1% | not limiting |
| 9 | Concavity/bow-rule coding errors | shape-changing | golden-case unit tests from the Gemara's own examples (circle, bow, gamma, trapezoid) |
| 10 | No rav review | everything | permanent banner; review-first export design |

Rule of thumb: **GIS error is meters; halachic-model error is hundreds of meters. The
engineering is easy; the psak configuration is the project.**

---

## Part 5 — Existing tools survey (researched 2026-07-10)

**Bottom line: no existing tool does the automated pipeline. The field is manual.**

| Tool | What it is | Gap |
|---|---|---|
| **techumshabbos.com** | Small group using ArcGIS internally (R' Moshe's shiur); distinct from the traditional **Vaad L'Techumin** — both mapped Hunter, NY as a cross-check | Their "type an address, get a map" vision ("almost automated," human review mandatory) was never shipped publicly. Site blocks bots — worth a manual browse. |
| **szntech/tchum** (github.io, open source) | Closest live tool: Google Maps JS, address autocomplete, R' Moshe amah hardcoded (0.53975 m), Vincenty math, RCN/CI/RMF selector on advanced page | **You drag the city rectangle by hand.** No footprints, no 70⅔ clustering, no true-north ribua. Confirms the display layer is trivial and the derivation engine is the missing piece. |
| **OU Eruv Software** | Eruv-checker management (poles/wires/photos/permits) | Different problem; good UX reference for collaborative halachic-boundary annotation. |
| **EruvFinder / Eruv.org** | Directories of 250+ eruvin | Lookup only. |
| Literature | Lehrhaus "Modern Technology Meets Tehum Shabbat"; R' Millunchick's *Mi-Darkei ha-Techum* (Chicago, 2007) + airport article; Borehamwood (UK) worked example (48 cm, 960 m, compass squaring, satellite imagery) | All manual Google-Maps/desk workflows; universal caveat: expert review required. |

---

## Part 6 — Technical stack (verified)

- **Footprints:** **Overture Maps buildings** (monthly GeoParquet releases on S3, DuckDB
  spatial bbox queries, first-class `subtype=residential`) as primary; **OSM Overpass** as
  supplement. Microsoft footprints = geometry only. Google Open Buildings does **not**
  cover US/Israel. Israel OSM ≈ 42% complete → expect heavy manual review there.
- **Dwelling tags:** most OSM buildings are bare `building=yes`; Overture inherits the gap.
  US parcel land-use data would solve it but national licensing ≈ $80k/yr (Regrid);
  per-county assessor portals are free but inconsistent. → tags where present + manual
  review; zoning ≠ use.
- **Geometry:** Python backend — Shapely/GeoPandas/pyproj (`estimate_utm_crs`,
  buffer-union-dissolve, axis-aligned envelope). Frontend MapLibre GL JS or Leaflet +
  satellite tiles; `geojson-to-kml` for export. (Doing polygon algebra in raw lat/lon à la
  szntech is not robust — project first.)
- **Geocoding:** Google Places (rooftop) or Mapbox/OpenCage; Nominatim as free fallback.
  Geocode locates the area only; the pipeline snaps to footprints.

---

## Part 7 — Status, recommendation & open questions

**BUILT — v1 shipped 2026-07-10.** Static web app in this folder (`node serve.mjs`,
see README.md). Implements: geocode → OSM footprint fetch with auto-expansion →
classification (auditable tag table) → 70⅔ ibur clustering → 141⅓ city merge (6-house
minimum) → three-villages rule (flagged) → compass/natural-edge ribua → karpef toggle →
2000-amos square-cornered techum → psak profiles → per-building overrides → comparison
shita line → KML/GeoJSON export. 22 golden geometry tests pass (Gemara's canonical
shapes). Live-verified on New Square, NY (real OSM data, both amah shitos, city-mode
detection, overlap + ir-mubla'as warnings).

**Original recommendation (kept for the record): build it.** The automation gap is confirmed — nobody has the footprint → dwelling filter →
70⅔ clustering → ribua → 2000-offset engine, and that's exactly where hand-drawn maps make
mistakes. Google Earth stays in the loop as the *review surface*: we export KML/KMZ so final
inspection happens on high-res imagery, matching the workflow techum people already use.
The geometry itself is a weekend of Shapely code once the config matrix (Part 2) is decided;
the UI for building-level review is the bulk of the work.

**Open halachic questions (need a posek — rev. 2, resolved items moved to Part 2):**

1. ~~Six-house minimum~~ **RESOLVED** — MB 398:38 (3 chatzeros × 2 houses); governs
   independent-city status for city-level rules, not chain extension. In the config matrix.
2. **Eruv-enclosure-as-city** — does a tzuras-hapesach eruv make the enclosed area "the
   city" so the techum starts at the eruv line? Real literature exists on exactly this;
   the MB 401:7 citation previously given here was wrong (401 discusses techum of
   objects) — the actual responsa/articles and their primary sources still need to be
   pulled. Rav-selected setting (off, not implemented); the biggest open question.
3. ~~Ribua scope cap on mega-cities~~ **RESOLVED — no halachic cap** (Peninei Halakha:
   chains can run days' walk). Practical limits come from real breaks (rivers, industry,
   non-qualifying gaps) and data caps, which the app labels as data limits.
4. **Generalizing the bow rule to real city outlines** — SA 398:3's cases are textbook
   shapes (bow, gamma, trapezoid). Real suburb boundaries are fractal; which concavities
   get filled (endpoint span < 4000) needs an operational definition a posek signs off on.
5. **Modern beis-dirah edge cases** — offices/factories (occupied but not slept in), hotels,
   hospitals, schools, seasonal cottages, trailers/mobile homes, airports. The classic
   categories (attended barn = yes, bare shul = no) don't map cleanly.
6. **Where the 70⅔ is measured from** — building wall to building wall, or do attached
   fenced yards/courtyards (hukaf l'dira) count as part of the house? Changes borderline
   joins.
7. **Karpef psak confidence** — we defaulted off (Mechaber), but exactly how MB 398:21 comes
   down and what target-community practice is should be confirmed.
8. **Mixing shitos** — may one combine leniencies across shitos (e.g. CI amah for the 2000
   but RCN elsewhere)? Default: never mix; one amah drives everything.
9. **Walled-city timing** (settled-then-walled measures from the wall) — rare, and
   undetectable from data; confirm it's fine as a manual-only option.
10. **The ~7% hilly-terrain reduction** — single Hebrew secondary source, in tension with
    horizontal-distance-is-the-target; ignore unless a posek wants it.

**Verification TODO (before shipping anything):** the tool is city-agnostic; these are test
benchmarks, not scope:
- Golden unit tests from the Gemara's canonical shapes (circle, bow, gamma, trapezoid,
  rotated square, three villages).
- End-to-end regression against at least one **published** techum map (Borehamwood UK,
  Chicago per *Mi-Darkei ha-Techum*, or a techumshabbos.com project city like Hunter, NY —
  the latter conveniently has boundaries published under both R' Moshe and Chazon Ish
  shiurim, a two-shita cross-check for free).

---

## Key sources

Shulchan Aruch OC 396–399, 405, 408, 414–415 (SA HaRav via Chabad.org; Sefaria; Wikisource) ·
Rambam Hil. Shabbos 27–28 · Mishna Berurah 397:1, 398:21/46, 399:7; Biur Halacha 404:1 ·
Chazon Ish OC 39, 110:16/23/28 · Igros Moshe OC 1:136 · Minchas Yitzchak 7:24, 8:33 ·
Chasam Sofer OC 94 · Meishiv Davar 4:58 · halachipedia.com/Techum · rabbikaganoff.com ·
Peninei Halakha (ph.yhb.org.il) Techum chapters · thelehrhaus.com "Modern Technology Meets
Tehum Shabbat" · chabad.org Borehamwood practical application · dafyomi.co.il Eruvin charts.
