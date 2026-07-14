# Techum Shabbos Calculator — Halachos & Spec

> **STATUS: Researched and executable draft (rev. 13, 2026-07-14) — sources verified via web research against Sefaria,
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
  resolution of borderline measurement cases — but does **not by itself choose** among
  disputed halachic models such as the three overlapping-ribua positions in §1.5.

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
- **Modern commercial/industrial structures are disputed, not categorically excluded.**
  Chazon Ish OC 110:28 and Shevet HaLevi 1:59 are cited for counting at least some factories
  containing offices and a workers' lunch room; Kiryat Ariel ch. 4, Machazeh Eliyahu 79,
  and Tikun Eruvin 5:60 collect the modern applications. A generic office, school, hospital,
  hotel, terminal, or factory therefore needs a type-specific reviewer decision; map-data
  labels alone cannot establish *beis dirah*.
- **Attached enclosed land can affect the measured wall-to-wall gap.** A fenced yard or
  other area genuinely subsidiary and open to a dwelling may be treated with the dwelling
  under SA OC 396:2, allowing the 70⅔/141⅓ measurement from its validated perimeter.
  Ordinary parcel lines, fences, or carrying-eruv data do not prove those facts. Only an
  explicit rav-validated *hukaf l'dirah* polygon may enter this calculation.
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
- **Lone/sub-city building implementation:** when the shevisa pin lies on an included mapped
  footprint but no qualifying city joins it, the footprint remains a non-city and the techum
  is measured from the squared mapped walls. It does not receive the city karpef. Unknown-use
  structures remain included under the data default but carry an explicit beis-dirah review
  warning; an excluded footprint does not supply building shevisa.

### 1.5 Ribua ha'ir — squaring the city (SA OC 398:1–3; Rambam Shabbos 28:1–5)

*(rev. 3: "RESOLVED" retracted — the existence of ribua is settled; the universal
algorithm for deriving it from a real metropolitan footprint is not.)*

Baseline: first decide whether the city already has a halachic rectangular orientation.
An existing four-right-cornered square/rectangle is **left in its own orientation**, even
when diagonal to the directions of the world (Eruvin 55a; SA OC 398:1; SA HaRav 398:1;
Aruch HaShulchan 398:9). When a virtual rectangle must instead be imposed on a round,
triangular, or many-sided city, that new rectangle is aligned to the four directions of
the world (true compass N–S/E–W; SA OC 398:2–3; Bamidbar 35:5). A pure kula: residents gain
the corners and concavities.

**Orientation is therefore a classification stage, not a constant:** a trapezoid may
follow its own parallel sides; a natural straight edge can establish an orientation; and
genuinely ambiguous intermediate shapes are disputed. The Chazon Ish suggests that where
orientation cannot be resolved, one may use only the area common to both candidate
techumin, or possibly the orientation producing the smaller added area. The accepted
mainstream synthesis reported by Peninei Halakha follows a clear full-length straight side
or a clear right angle, while SA HaRav and Chayei Adam require the stronger case and use
world directions for intermediate bow/L shapes. A local rav/mumcheh must decide a genuinely
ambiguous real outline.

Rules by shape:
- Circle / triangle / many-sided shape with no governing straight side or right angle →
  compass-aligned bounding rectangle. This is not a rule that every non-rectangle must use
  compass: the trapezoid, bow/L, and clear straight-side/right-angle cases below are distinct.
- Already a compass-aligned rectangle → left as-is.
- **A square/rectangle rotated off the compass → left in its existing orientation**
  (SA 398:1 explicitly).
- Trapezoid → short side extended to match the long side.
- Irregular protrusions → each face is squared to a straight line through its
  furthest-outward point (one jutting house pulls the whole side out to it) (SA 398:2).
- **Bow / L / gamma shapes** (SA 398:3–4; Rema; SA HaRav 398:3–5) require separate
  algorithms, not one generic concavity fill. When the relevant endpoints are <4000 amos
  apart, the chord closes the bow and the enclosed gap is treated as filled. Rema records
  an additional leniency where a ≥4000-amah chord may still govern if chord-to-arc depth is
  <2000 amos. For the remainder that stays ≥4000, Peninei Halakha 30:7 follows
  Tosafos/Rosh/most Rishonim/Rema to draw chords wherever the bow narrows below 4000, while
  suggesting the Rambam/Mechaber curved techum for the wider remainder (also noting Chazon
  Ish 110:10 and residual uncertainty). Rashba/Ritva, cited by Biur Halacha 398:6 for
  extenuating circumstances, limit the restrictive bow classification further. Even part
  of one side can be its own bow (Tikun Eruvin ch. 5 n. 17; Machazeh Eliyahu 82). Each
  mehalich must be named in the audit after reviewer-designated endpoints; a generic polygon
  concavity must not silently choose among them.
- **Machlokes — alignment:** default (SA HaRav 398:3; Chayei Adam 68:14; MB) is always
  compass. **Chazon Ish (OC 110:23):** a city with one naturally straight side (e.g. a
  shoreline — Manhattan's Hudson edge) is squared to *that* orientation. Peninei Halakha:
  only a genuine natural straight edge governs, not an arbitrary straight stretch.
  → config toggle with user-designated reference edge.
- ⚠ **Overlapping-squares merge has three materially different mehalachim:**
  1. the rectangles do **not** join the cities (R' Yosef Shalom Elyashiv, R' Nissim
     Karelitz, and R' Yisroel Belsky as reported by Millunchick);
  2. overlap joins the cities, but no new joint encompassing rectangle is recursively
     redrawn (R' Shlomo Miller as reported there);
  3. overlap joins the cities and a new joint rectangle is drawn (the expansive reading
     discussed in Chazon Ish OC 110:16; accepted by Minchas Yitzchak 8:32 and Machazeh
     Eliyahu 82, while Kiryat Ariel reports that the Chazon Ish did not rely on it in
     practice).
  There is **no accepted consensus**. The default remains **no join** and the calculation
  must flag every case in which either alternative would change the result. A binary
  on/off control cannot faithfully represent R' Shlomo Miller's middle position.

**Executable default computation (rev. 13):**

1. Freeze qualifying dwellings and rav-validated subsidiary residential perimeters.
2. Build 70⅔-amah components; qualify independent cities; then run 141⅓-amah and
   three-village mergers repeatedly to a fixed point. Karpef never feeds backward into a
   merge.
3. Choose axes: a reviewer angle controls when supplied; otherwise preserve a
   minimum-area-rectangle direction only when the convex hull fills at least 94% of it; an
   exact four-vertex trapezoid with an opposite pair parallel within the 1° engineering
   tolerance follows that pair; everything else uses true world directions. **94% and 1°
   are conservative engineering classifiers, not halachic shiurim.** The audit records the
   classifier, score, tolerance, angle, and any reviewer override.
4. On the chosen axes, every qualifying protrusion fixes the support line of its entire
   side. No small outlier is discarded after its dwelling/perimeter status is accepted.
5. Detect material open bow/L/gamma pockets and wholly enclosed holes before finalizing
   the starting area. A ≥4000-amah open pocket without reviewer-confirmed endpoints gets a
   visibly **provisional smaller no-fill result**; the generic bounding rectangle may not
   silently grant it. Once endpoints are supplied, the Rema-majority default fills when
   the chord is <4000 amos or the depth is <2000 amos; equality belongs to the ≥ branch.
   The remaining wide/deep pocket stays excluded. The Mechaber/Rambam and
   Rashba/Ritva-in-exigency alternatives are named settings. The engine represents a
   no-fill result as a deterministic union of non-overlapping rectangular review-mask
   pieces, not as a fake encompassing rectangle. The mask is an engineering rendering of
   the detected void and remains subject to the review banner; only its supplied endpoints
   are treated as factual reviewer input.
6. Apply the selected overlap rule to the resulting city rectangles: `no_join` (public
   default); `join_no_redraw` (R' Shlomo Miller — retain a stepped union); or
   `join_redraw` (expansive approach — redraw and test again to a fixed point).
7. Apply one profile-governed karpef to each final permitted starting region, then the
   2000-amah square-corner expansion to each region. The union is the displayed techum.

The local true-north tangent projection makes compass axes cardinal (never magnetic
north). Multi-region starting areas, karpefs, and techumin remain multi-region in the map,
snapshot, KML/KMZ, and GeoJSON audit; they are never flattened to a larger bounding box.

### 1.6 Karpef — the extra 70⅔ buffer (SA OC 398:5; MB 398:21, 398:36)

*(rev. 3: split into three distinct rules; earlier text contradicted the profile table.)*

1. **`single_city_karpef`** — Mechaber/Rambam: no karpef for a single city (2000 from the
   outermost dwellings). Rema (recorded MB 398:36): add 70⅔ first. **Profile-governed:
   ON in the MB/Ashkenazi default profile, OFF in Mechaber/Sefardi.**
2. **`karpef_after_joined_outlying_house`** — executable MB/Rema default: finish all
   dwelling, 70⅔, 141⅓, three-village, bow/hole, ribua, and selected overlap processing;
   then add **one** outer 70⅔-amah karpef to every final permitted starting region. An
   annexed house does not recursively generate another merger-stage karpef. This is the
   documented default; another community practice requires a named reviewer profile.
3. **Two-city 141⅓ allowance** — each settlement's 70⅔ margin toward its neighbor. **Not
   optional** in the same sense; always applied in the merge test (all profiles).

### 1.7 Squaring the techum itself — *me'aber es hapinos* (SA OC 399; Rambam 28:5; Eruvin 55a)

- The 2000 amos extend from each side of the city rectangle **and the corners are filled**:
  the techum boundary is itself a rectangle with **square corners** — diagonal reach at a
  corner ≈ 2000·√2 ≈ **2828 amos**.
- **Computation:** techum = city rectangle expanded 2000 amos in each cardinal direction
  (half-plane intersection). **Not** a rounded Minkowski buffer — the square corners are
  halachically mandated extra area.
- A person in an open field (or via eruv techumin) first receives a **4×4-amah mekom
  shevisa**, and the 2000 amos are measured beyond each of its four sides. The complete
  square is therefore **4004×4004 amos**, not 4000×4000 (SA 396:1; Peninei Halakha 30:1–2).
  He **may orient it as he wishes** — including 45°, pointing a corner toward his
  destination. → point-mode rotation option. Any current 4000×4000 implementation is an
  identified 4-amah defect, not an accepted rounding convention.

### 1.8 How distance is measured (SA OC 399; Rambam 28:11–16; Eruvin 57b–58b)

- Chazal's method: a 50-amah flax rope pulled taut, measured only by a **mumcheh** (MB
  399:7). Terrain: *mavli'in* (spanning valleys horizontally with the rope) and *koder*
  (stepped telescoping on steep slopes) — both are techniques to recover the **horizontal
  plan-view distance**. ⚠ exact width/depth thresholds between the methods vary by Rishon.
- **Modern-map mehalich:** Peninei Halakha 30:5 says it is now best to establish techum with
  aerial maps or GPS because the purpose of Chazal's procedures was accurate, convenient
  measurement. This supports horizontal plan-view geometry and not re-enacting the rope.
  However, Tikun Eruvin (as reported by Millunchick, pp. 58–59) calculates that the
  prescribed slope procedures can differ from map distance by as much as about 9.1%.
  Therefore “horizontal GPS is the only halachic target” is too absolute: the app's default
  is the documented modern-map mehalich, and a rav must approve any slope adjustment.
- Conflicting measurements → follow the lenient/larger (Eruvin 58b), within measurement
  doubt only.
- ⚠ A roughly 7–9.1% hilly-terrain adjustment is a sourced later proposal, but no verified
  general community default was found. Do not apply it automatically; record it as an
  advanced reviewer mehalich if adopted for a particular calculation.

### 1.9 Water and terrain features (SA 398:9, 13; Meishiv Davar 4:58; Minchas Yitzchak 8:33)

- Water by itself is not a dwelling that extends the building chain, while the ribua and
  2000-amos techum can pass over water (Chasam Sofer OC 94). A river or stream can divide a
  city when it creates a complete >141⅓-amah break, subject to the disputed joining rules
  in §1.9a; the categorical statement that every flowing river necessarily divides or can
  never participate in city continuity is too broad.
- A **dry wadi** with a ≥ 4-amah walkable ledge used by residents joins the city ground;
  otherwise it's simply consumed inside the 2000.
- Ordinary lakes/pools enclosed by the built footprint do not themselves move the outer
  dwelling edge. Exception: a very large enclosed void triggers the dispute in §1.9a.

### 1.9a Full-width breaks and large interior holes

- A continuous strip wider than **141⅓ amos** that crosses the entire built settlement can
  divide it into separate cities. Modern examples include a sufficiently wide highway,
  railway corridor, river, utility right-of-way, park, or industrial/open strip. Municipal
  continuity and shared city usage do not by themselves settle the halachic geometry.
- This must be decided from the qualifying dwelling/perimeter geometry, not a special
  highway tag: if qualifying buildings or validated residential perimeters bridge the
  strip within the applicable gap, no complete break exists.
- A very large empty area **wholly surrounded** by the city is disputed. Zichron Yosef is
  cited for excluding an interior hole larger than 4000 × 4000 amos by analogy to a bow;
  Beit Yitzchok distinguishes a closed hole from an open bow, and Tikun Eruvin records a
  lenient view treating the encircling city as continuous. Therefore an interior hole does
  not automatically split the default city, but any enclosed void reaching 4000 amos in
  both governing axes is a mandatory rav-review warning. The advanced
  `exclude_large_hole` setting follows Zichron Yosef/R' Pesach Falk and preserves the void
  as an exclusion mask; later ribua processing may not refill it. The implemented default
  `include_with_warning` follows Beit Yitzchok/R' Shulem Weiss.
- A carrying eruv, public use of the gap, and overlapping ribua rectangles are each proposed
  bases for joining sections, but all three are disputed. They must be reported separately
  in the audit rather than collapsed into a generic “city continuity” heuristic.

### 1.10a Locating the person's city and *ir muvla'at*

A pin is treated as **in a city** when it lies inside that profile's final starting area:
the settled city and its ribua, plus only the profile-governed karpef/perimeter additions
that actually apply. Peninei Halakha 30:4 expressly includes one who rests within the
squared area. The previous unconditional test “within 70⅔ amos of a structure” was too
broad for Mechaber/Rambam profiles, which do not give every single city the Rema's outer
karpef. Priority is: (1) the qualifying dwelling/perimeter component physically containing
the pin; then (2) a final starting region containing it. If the pin lies only in the empty
overlap of several unrelated `no_join` ribua rectangles, the public result is the exact
intersection of their candidate permissions and is labelled provisional; the engine never
silently chooses the geographically largest rectangle.

If the person rests outside every city, he remains in point mode:

- If his 2000-amah reach merely **ends inside** a city, he may walk only to that boundary;
  the rest of the city does not become his four amos.
- If an entire city lies **swallowed within** his reach (*ir muvla'at betoch techumo*), the
  city counts as four amos and his unspent measurement resumes beyond its far edge
  (SA 408:1; Peninei Halakha 30:4 n. 5). This is a path/direction-dependent calculation,
  not a switch into resident city mode and not a union with the city's own 2000-amah
  techum. A single universal two-dimensional polygon for arbitrary destinations, repeated
  swallowed cities, and rotated point squares is not established by the cited sources.
  Therefore the ordinary map detects and flags swallowed-city candidates but does not draw
  an invented universal extension. A route/destination-specific audit must show consumed
  distance, collapsed city segment, and remainder after a posek approves that formal model.

### 1.10 Person-level rules (context, mostly out of scope v1)

- Left the techum knowingly → confined to 4 amos (SA 405:1); nuances for ones/shogeg.
- **Eruv techumin** (SA 408–415): depositing two meals' food at a point within your techum
  before Shabbos **relocates** (not extends) your shevisa there — new 2000-amos square from
  the eruv, losing the far side. Requires a mitzvah-need; must be within the original 2000.
  → v2 feature: "eruv mode" — pin the eruv, render new square + the lost region.

---

## Part 2 — Psak configuration: PROFILES & DEFAULTS (rev. 5 — 2026-07-11)

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
- **Overlapping-squares is a genuine algorithm-changing machlokes.** Rev. 12 corrects the
  earlier implication that R' Shlomo Miller represented the strict/no-join side: he is
  reported to join overlapping rectangles but not redraw a new joint rectangle. The
  no-join position is reported in the names of R' Elyashiv, R' Nissim Karelitz, and
  R' Belsky. The default remains no join, but the complete model is three-valued.
- **Amah is a first-order variable** (±20% on every distance), not a "smaller" item. One
  consistent measurement profile end-to-end; **no mixing shitos** is an application policy,
  not a sourced psak.

### Profiles (each setting individually overridable → "Custom")

| Setting | **Mishna Berurah / Ashkenazi (DEFAULT)** | Chazon Ish | Mechaber / Sefardi |
|---|---|---|---|
| Amah | 48 cm (R' Chaim Naeh) → 960 m | 57.6 cm → 1,152 m | 48 cm → 960 m |
| Single-city karpef (+70⅔ before 2000) | **on** (Rema; MB 398:36) | on ⚠ confirm CI's own position | off (Mechaber/Rambam) |
| Squaring alignment | automatic SA/MB shape rule: preserve a clear existing rectangle; otherwise world directions | same automatic rule; reviewer may set a sourced natural edge (CI OC 110:23) | automatic SA shape rule; reviewer override available |
| Overlapping-squares rect merge | **no join** + warning (R' Elyashiv / R' N. Karelitz / R' Belsky); advanced middle option: join without redraw (R' S. Miller) | joint redraw available as the expansive CI reading, but CI's practical conclusion is reported as uncertain | **no join** + warning; alternatives remain explicit |
| City minimum for the 141⅓ merge | 6 houses (MB 398:38) | 6 + CI courtyard qualifications ⚠ | 6 |
| Bow/L/gamma | **Rema-majority:** fill when confirmed chord <4000 or depth <2000; otherwise no-fill; unresolved endpoints use provisional no-fill | same default; reviewer may select another sourced shita | **Mechaber/Rambam:** narrow chord fills; wide remainder follows inhabited/curved edge; reviewer endpoints required |
| Wholly enclosed ≥4000×4000-amah hole | **include + mandatory warning** (Beit Yitzchok / R' Shulem Weiss); strict exclusion available | same | same |
| Unknown-use buildings | include, flagged for review (all profiles — data policy, not psak) | ” | ” |
| Eruv-enclosure-as-city | **off unless rav-validated** — selected practice/data-confidence default, not settled consensus; validated *hukaf l'dirah* perimeter available | same | same |
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
- **Karpef split into three rules** (see §1.6); this rev-3 implementation note is
  superseded by rev. 13's one-post-ribua MB/Rema default.
- **Ribua "RESOLVED" retracted**; orientation is an explicit reviewer decision (§1.5).
- **Bow/concavity pass was detect-and-flag in rev. 3** — arbitrary suburban polygons have
  no unique "two endpoints of the bow." Rev. 13 now applies confirmed endpoints and uses a
  provisional no-fill geometry before confirmation.
- **Determinism, caching & the "database" question (Isaac, 2026-07-10):** the engine is
  pure (same data + settings → same output). Nondeterminism enters only through OSM data
  updates. Three-layer answer to "save city boundaries in a DB vs compute each time":
  1. **Cache the INPUT, not the output** — the Overpass fetch is slow and settings-
     independent; computed boundaries are ~1s and settings-dependent (a boundary cache
     would need an entry per city × amah × karpef × …). Implemented: local IndexedDB
     (L1, exact bbox) plus production shared R2 grid tiles via `/api/buildings` (L2,
     ~2 km cells so nearby pins share data). No hard TTL — 30-day auto change-check
     + "Fresh data" bypass; data age always shown; audit stamp records the true data date.
     (Rev. note 2026-07-12: earlier draft said 7-day TTL; superseded by auto-check + shared tiles.)
  2. **Snapshots** freeze fetched buildings + pin + settings + overrides to a JSON for
     exact replay/sharing (the artifact a rav actually reviews and approves).
  3. **Published snapshot library — foundation implemented:** immutable D1 revisions of
     *reviewed* city snapshots with reviewer/date/source/conditions, integrity hashes,
     withdrawal history, public reads, and fail-closed authenticated writes. This is a
     psak registry, not a compute cache; production publishing remains disabled until
     Cloudflare Access and an authorized rav workflow are configured.
  4. **Staleness detection ("how do we know the map updated?"):** AUTOMATIC (per Isaac —
     no user-facing button). Cached/snapshot data older than **30 days** (autoCheckDays)
     triggers a background Overpass `newer:` count of building edits since the data date.
     No edits → entry stamped verified-current (checkedAt), clock resets. Edits → auto
     refetch + recompute + techum-corner displacement report in meters ("unchanged" vs
     "moved X m — re-review"). Known gap: OSM deletions don't appear in `newer:` results;
     the explicit "Fresh data" refetch is the deletion backstop. Scheduled registry-wide
     staleness checks remain operational work after reviewed entries exist.
  Every export carries an audit block (engine version, data timestamp, extent, per-class
  counts, override list, frontier-closed status, projection, orientation choice).
- **MB 401:7 citation for the eruv-enclosure question retracted** — siman 401 discusses
  the techum status of objects; the real sources for "does the eruv wire become the city
  edge" are in responsa literature that must be pulled properly (open Q2).
- **Milestone guidance adopted:** next serious step is a rav-facing validation pass on one
  curated city against a published techum map, before promoting any default as a consumer
  answer. The tool remains address-agnostic; this is about validation, not scope.

### Rev-4 notes (2026-07-10, consistency fixes + mehalich directive)

- **Part 7 open-question #7 (karpef) corrected** — it still carried stale rev-2 wording
  ("we defaulted off"). The actual default since rev 2 is karpef **on** in the default
  MB/Ashkenazi profile (Rema; MB 398:36); **off** is the Mechaber/Sefardi profile. No
  default changed here — only the stale sentence.
- **Profile-matrix bow row clarified** — the row read "fill on", which overstated v1: per
  rev 3 the implementation was detect-and-flag (no auto-fill; endpoints are a reviewer
  decision). Rev. 13 supersedes that implementation with provisional no-fill and applied
  reviewer endpoints.
- **settings.js header** said "mirrors Part 2 (rev. 2)"; it matches rev. 3 — comment fixed.
- **Hunter, NY validation benchmark = standing TODO** (Isaac, 2026-07-10: deferred, keep
  as todo). Published under both R' Moshe and Chazon Ish shiurim — two-shita cross-check.
- **Mehalich directive (Isaac, 2026-07-10):** for open questions currently parked as
  "needs a posek" that block functionality (Q2 eruv-as-city, Q4 bow endpoints), don't
  leave the feature unimplemented — research the mehalachim, adopt the best-supported one
  as the documented default, and expose the alternatives as settings (same policy as every
  other machlokes in Part 2). Research in progress; defaults to be recorded here as a
  dated rev note when adopted.

### Rev. 5 — 2026-07-11 (recovered mehalich research; defaults adopted)

- **Eruv-enclosure-as-city default resolved: OFF.** The operative, best-supported practice
  is to derive the city from dwellings, ibur, and ribua (Eruvin 55b; SA OC 398), not from a
  community carrying-eruv. Published practical workflows checked in the research
  (Borehamwood and the Boston/Lehrhaus discussion) measure from the outermost dwellings;
  a din.org.il/kipa responsum likewise says the eruv wire is not the techum line. SA OC
  396:2's rule that a person resting in a *hukaf l'dira* enclosure treats all of it as four
  amos is a distinct din and does not by itself redefine the city boundary for residents.
  Peninei Halakha, Techum §§2, 4, 8 supplies a real lenient alternative: a wall or eruv may
  make the enclosed area one place and measurement may begin at its perimeter. Because a
  modern eruv's *hukaf l'dira* status is fact-specific and OSM cannot establish it, that
  alternative may be used only after a rav validates and supplies the actual perimeter.
  The core engine therefore continues to ignore an ordinary eruv; an oversized eruv also
  does not shrink the buildings-based techum.
- **Bow/concavity mehalich resolved: reviewer-designated endpoints remain the default.**
  SA OC 398:4's primary test is the chord between the two bow endpoints: below 4000 amos,
  the gap is filled. The Rema records the additional leniency that even with a chord of
  4000+ amos, the chord may be used when chord-to-arc depth is below 2000 amos. No verified
  source or published map workflow supplied a defensible algorithm for choosing endpoints
  on a fractal modern outline. The app therefore detects and highlights material pockets,
  applies the undisputed textbook threshold where endpoints are unambiguous, and requires
  reviewer designation for ambiguous real-city pockets. Automatic Mechaber chord and Rema
  depth variants belong behind advanced settings once endpoint-designation UI exists; the
  software must not silently invent endpoints.
- **Confidence and remaining posek input (superseded in part by rev. 12):** this revision
  recorded high confidence in the buildings-based eruv default;
  medium confidence in the operational bow detector because endpoint selection is an
  engineering generalization, not a sourced algorithm. A tight, demonstrably *hukaf
  l'dira* enclosure and every disputed bow endpoint remain review flags, not automatic psak.

### Rev. 6 — 2026-07-12 (implementation-status audit; no default changes)

- Part 3 and Part 6 now distinguish **implemented**, **partial**, and **planned** behavior.
  Earlier future-facing prose overstated automatic footprint snapping, Overture fallback,
  confidence scoring, bow filling/designation, and PDF export.
- The implemented engine uses a local true-north tangent/equirectangular projection, not a
  Python UTM pipeline. Metropolitan-scale projection error still needs a quantified test.
- Unknown-use inclusion is not called “conservative”: including a structure can enlarge or
  topologically change the city. The ordinary and verified-dwellings-only outputs are data
  uncertainty scenarios; neither is a psak or guaranteed inner/outer bound.
- A rav-facing review checklist was added in `RAV-REVIEW-PACKET.md`. This revision changes
  documentation only and does not change any profile or halachic default.

### Rev. 7 — 2026-07-12 (planned engineering completed; no default changes)

- Implemented footprint snapping with disclosure, classification-confidence scoring,
  one-click review queues, reviewer city-qualification controls, bow-endpoint recording,
  stable decision remapping, projection/performance tests, PDF/PNG/KMZ exports, manual
  footprint drawing/import, and reviewer-uploaded Overture comparison.
- Added a reviewed-snapshot registry with immutable revisions, hashes, reviewer/date/source
  metadata, withdrawal history, public read endpoints, and fail-closed authenticated writes.
- Added an explicit rav-validated enclosure-perimeter import. It defaults off, is used only
  when the shevisa point lies inside it, and is never inferred from an ordinary carrying eruv.
- Remaining non-halachic external work is the published-map benchmark and operating an
  automatic Overture extraction service. Overture bulk GeoParquet has no official no-key
  browser bbox API; reviewer-uploaded extracts are implemented instead.

### Rev. 8 — 2026-07-12 (settings clarity and performance; no default changes)

- The six-house city qualification remains fixed at MB 398:38 and is no longer exposed as
  an arbitrary user control. Amah choices are displayed in inches.
- Ribua orientation is labelled as a halachic shita: cardinal directions are the baseline
  (SA 398:3), while an existing rectangular/natural alignment and some irregular shapes
  require the documented SA 398:1 / poskim analysis. The choice remains because the case is
  genuinely disputed, not as a generic map-display preference.
- Profile descriptions now state their operative shitos, the calculation audit is promoted
  ahead of optional settings, and per-stage timing is recorded for agent-readable diagnosis.

### Rev. 9 — 2026-07-12 (Overture-first footprint coverage; no halachic default changes)

- The automatic footprint source changes from raw OSM Overpass to the fused Overture
  Buildings release. Overture retains OSM-derived footprints and adds machine-detected
  sources such as Microsoft ML Buildings. At the reported Woodridge/Fallsburg failure area,
  release `2026-06-17.0` supplied 49 additional roof-aligned footprints alongside 23 OSM
  footprints in the immediate comparison extent.
- Unknown-use Overture structures remain included by the existing default. A user is not
  required to classify them before receiving a result; optional corrections stay available
  by clicking a footprint or drawing a missing roof.
- Accepted shared corrections are applied from D1. Public corrections are stored as pending;
  authenticated reviewer corrections become shared defaults. Every correction retains its
  source identity or explicit reviewer-drawn geometry.
- This is a data-source and review-workflow change only. It does not answer open question 6:
  fenced yards/courtyards remain separate, inactive reviewer geometry unless a rav validates
  the applicable *hukaf l'dira* facts and ruling.

### Rev. 10 — 2026-07-13 (ribua orientation source correction + implementation)

- **Corrected a reversed reading of SA OC 398:1.** The earlier §1.5 bullet said that an
  already rectangular city rotated off the compass must be re-squared to a larger cardinal
  bounding rectangle. Eruvin 55a, SA 398:1, SA HaRav 398:1, and Aruch HaShulchan 398:9 say
  the opposite: a city that already has four square corners is left as it is, even when its
  sides are not aligned to the directions of the world. Cardinal alignment in SA 398:3
  governs the new virtual rectangle imposed on a round, triangular, or many-sided city.
- **Intermediate shapes remain a real machlokes/classification problem.** Peninei Halakha
  30:6 and its source expansion collect the majority approach that a full-length straight
  side or a clear right angle can establish the city's direction; SA HaRav 398:3 and Chayei
  Adam 76:14 use world directions in the intermediate bow/L cases; Chazon Ish 110:23 limits
  doubtful cases to the overlap of candidate techumin or possibly the smaller addition.
- **Implemented a deliberately narrow automatic mehalich.** The engine preserves the
  minimum-area-rectangle orientation only for a high-confidence rectangle (convex-hull
  rectangularity ≥94%); all other shapes retain the established compass default, with the
  rav-facing manual angle available for a sourced natural edge/right angle. The threshold
  is disclosed as an engineering heuristic rather than psak, and every result records the
  method, effective angle, and score. Added golden coverage for an off-compass rectangular
  city and retained the circle/world-direction case.

### Rev. 11 — 2026-07-13 (lone-building shevisa correction)

- **Corrected a mode-selection defect.** A pin on an included house whose cluster had fewer
  than six footprints was previously discarded as a bare open-field point and received only
  a 4-amah starting square. The six-house threshold decides independent city status; it does
  not erase the person's house. Such a result now has a separate `building` mode, remains a
  non-city, and measures from the squared mapped footprint without a city karpef.
- Unknown-use footprints continue to produce an automatic result, but the result warns that
  both the mapped walls and beis-dirah qualification require confirmation. Pins outside the
  footprint and pins on excluded footprints remain open-field point shevisa.
- Satellite imagery is now the default simplified basemap. The optional illustrated basemap
  is explicitly labelled as basemap coloring so its green land-use polygons cannot be
  mistaken for the calculator's green starting boundary.

### Rev. 12 — 2026-07-14 (later-source corpus and calculation corrections)

- **Research corpus established.** No single freely available English work was found that
  both compiles every detail and represents an accepted ruling across Orthodox communities.
  The implementation corpus is therefore layered: primary codes establish the rule;
  recognized later specialists identify real-city applications and machlokos; English
  syntheses aid access but do not silently choose the app's psak. See the annotated source
  hierarchy below.
- **Overlapping ribua corrected to three positions.** Rabbi Mordechai Millunchick,
  “Techum Shabbat and the Airport,” *Journal of Halacha and Contemporary Society* 74,
  pp. 50–52, reports: no join (R' Elyashiv, R' Nissim Karelitz, R' Belsky); join without a
  newly redrawn encompassing rectangle (R' Shlomo Miller); and join/redraw authorities
  including Minchas Yitzchak 8:32 and Machazeh Eliyahu 82, with Chazon Ish 110:16 discussed
  but his practical conclusion uncertain. Earlier rev-2 wording incorrectly associated
  R' Miller with the no-join default. **The default itself does not change:** no join remains
  the prudent MB/Ashkenazi app default, now attributed accurately. The planned control must
  become a three-position enum; until then the existing “on” path is not labelled as
  R' Miller's shita.
- **Modern structures and validated yards are now explicit calculation inputs.** Some
  poskim count factories with offices/lunch facilities; qualifying land genuinely enclosed
  and subsidiary to a dwelling can move the wall-to-wall join origin. Neither result can be
  inferred safely from an Overture class, parcel, fence, or ordinary carrying-eruv tag, so
  both require a reviewer determination and preserved source geometry.
- **Full-width breaks and interior holes added.** A continuous >141⅓-amah break can divide
  a city even when civil geography calls it one municipality. A fully surrounded void at
  least 4000 × 4000 amos triggers review because later authorities dispute whether it is
  analogous to an unfillable bow. Default behavior remains unchanged pending the required
  reviewer UI: do not automatically subtract the hole.
- **Point mode corrected to 4004×4004 amos.** The person's 4×4-amah mekom shevisa is not
  erased before adding 2000 amos beyond every side. The prior 4000×4000 statement and any
  matching implementation would be undersized by four amos. The current engine already
  computes `4 + 2×2000` correctly; its golden test confirms conformance.
- **Added the swallowed-city calculation (SA 408:1).** A city wholly contained along an
  outside person's remaining reach collapses to four amos and measurement continues beyond
  it; a city in which the 2000 simply terminates does not. This is distinct from residing
  inside the city's ribua and remains an implementation gap.
- **City-membership karpef is profile-governed.** The old unconditional “within 70⅔ amos”
  pin rule improperly applied the Rema/Rosh single-city karpef to Mechaber/Rambam profiles.
  Membership now derives from the selected profile's final starting area.
- **Eruv default confidence narrowed.** Peninei Halakha 30:4, 8, 10 and the authorities
  collected by Millunchick provide substantial support for a qualifying wall/eruv joining
  separated areas. “Off” remains the app default because ordinary map data cannot prove
  *hukaf l'dirah*, perimeter validity, or selected community practice—not because the
  alternative lacks recognized support. Rev. 5's “high confidence in the buildings-based
  eruv default” is superseded to that extent.
- **Modern map measurement remains the default, not an exclusive truth claim.** Peninei
  Halakha 30:5 endorses aerial/GPS measurement, while Tikun Eruvin as reported by Millunchick
  calculates a possible slope-method difference up to about 9.1%. Any terrain adjustment
  is reviewer-only and must identify its source and factor.
- **Source-sensitive language.** Peninei Halakha ch. 30 is the clearest complete English
  online synthesis and is used for navigation, diagrams, and a documented modern psak—not
  as proof of universal consensus. The Va'ad booklet is a field-survey guide whose publisher
  description disclaims complete analysis. Halachipedia is a research index. The Eruv
  Network course is practical training. Millunchick and the cited specialist Hebrew works
  control the edge-case bibliography.
- This revision changes the written specification and correct attribution, but deliberately
  does not claim that the current binary overlap implementation, commercial-building model,
  or interior-hole detector already satisfies the expanded spec.

### Rev. 13 — 2026-07-14 (complete executable city-squaring model)

- **One ordinary default is now explicit.** MB/Ashkenazi uses `no_join` for overlapping
  ribua rectangles. The two recognized joining approaches remain advanced rav settings;
  ordinary users are not asked to choose.
- **Every squaring branch now terminates deterministically.** Existing high-confidence
  rectangles preserve their axes; exact trapezoids follow their parallel pair; ordinary
  irregular cities use world directions; protrusions fix full support lines; unresolved
  material bows use a smaller provisional no-fill result instead of an unsafe generic fill.
- **Overlap is genuinely three-valued.** `no_join` keeps unrelated cities separate;
  `join_no_redraw` retains the original rectangles and produces stepped green/pink unions;
  `join_redraw` repeatedly redraws and retests until stable. Karpef is applied only after
  that choice and never creates a new overlap join.
- **Bow endpoints now change geometry.** The app records the reviewer-confirmed endpoints,
  calculates chord and depth, applies the selected Rema/Mechaber/emergency profile, and
  preserves excluded pockets as multiple regions. Before endpoints, the no-fill result is
  clearly marked provisional.
- **Large enclosed holes now have a complete default and alternative.** The public default
  includes the hole with a mandatory warning; strict exclusion is selectable and preserved
  through ribua, karpef, display, and exports.
- **Validated residential yards/perimeters participate in joining geometry without
  becoming houses.** Their polygons carry `joinOnly=true`, affect 70⅔/141⅓ distances, add
  zero to the six-house approximation, and are frozen in snapshots and audit exports.
- **City membership is profile-correct.** Rema karpef can contain the pin; Mechaber mode
  does not receive that membership. An empty overlap of unrelated no-join cities returns
  the exact common permission area rather than an arbitrary largest city.
- **Scope boundary for ir muvla'at is now honest.** It is a destination/path calculation,
  not part of ribua. The map detects swallowed-city candidates but does not fabricate a
  universal extension polygon unsupported by the sources.
- Golden tests cover all three overlap approaches, stepped multi-region output, fixed
  profile membership, trapezoid axes, provisional and reviewed bow behavior, both large
  hole policies, and zero-house validated join perimeters.

---

## Part 3 — Product spec

### 3.0 Scope & users

- **Designed for any address, any city, worldwide** — no per-city setup. The implemented
  source is the worldwide Overture Buildings release (including its OSM and ML-derived
  sources); fetch limits, source age, classification, and local geometry can still matter.
- **Two personas, one app:**
  - **Regular person:** types an address, gets the map with the locked defaults (Part 2).
    No halachic decisions asked of them. The standing “verify with a rav” banner remains;
    unknown structure use is included automatically and optional review is collapsed.
  - **Rav / mumcheh (advanced mode):** the full config matrix, per-building
    include/exclude, calculation-explanation layers, warnings, a unified flagged-review
    queue, manual bow endpoints, city-status review, and annotated PDF/PNG/KMZ exports.
- The app auto-decides everything it can (clear tags, unambiguous joins, geometry); anything
  uncertain is shown through two data scenarios and explicit warnings; inclusion is not
  inherently conservative. A unified one-click review queue is implemented.

### 3.1 User flow

1. Enter address / drop pin. **Implemented:** geocode, map placement, nearest-footprint snap
   with the movement disclosed, and explicit instructions to confirm against imagery.
2. Pick shitos (Part 2 matrix, defaults pre-set).
3. Layers rendered on satellite map, each toggleable and inspectable:
   - **L1** dwellings used (click to include/exclude → instant recompute)
   - **L2** halachic city polygon (post-ibur clusters, merge passes)
   - **L3** ribua rectangle (existing rectangular orientation when clear; otherwise true-north aligned)
   - **L4** techum boundary (rectangle + 2000 amos)
   - **L5** optional machmir/meikil band (e.g. 960 m vs 1,152 m lines)
4. Export **KML, KMZ, GeoJSON, PNG, and annotated PDF** with config/audit metadata and the
   “requires review by a rav/mumcheh” warning.

### 3.2 Pipeline

```
address ─► geocode ─► snap to footprint + disclosed confirmation requirement
        ─► fetch Overture footprints with expanding-radius PMTiles queries
        ─► classify dwellings (tags + heuristics + manual override)
        ─► local true-north tangent/equirectangular projection, all math in meters
        ─► ibur: buffer by (70⅔·amah)/2, union, dissolve → city clusters
        ─► fixed-point merge passes: two-cities ≤141⅓ (cities only) ; three-villages test
        ─► bow/L/hole masks: provisional no-fill until endpoints; then selected rule applied
        ─► ribua regions: rectangle/trapezoid/compass/reviewer-axis support lines
        ─► overlap policy: no-join | joined stepped regions | recursive joint redraw
        ─► one post-ribua karpef expansion of every permitted region (profile-governed)
        ─► techum: expand every region 2000·amah with square corners; retain the union
        ─► reproject WGS84 ─► render in Leaflet ─► KML/KMZ/GeoJSON/PNG/PDF
```

Modes: **settlement mode** (above), **point mode** (open field: 4004×4004-amah square,
rotatable),
**validated-enclosure mode** (implemented, explicit opt-in) uses a rav-supplied hukaf-l'dira
perimeter as the city edge. **Eruv-techumin relocation mode** remains future work.
**Validated-join-perimeter mode** adds rav-confirmed residential yards/perimeters to the
join geometry with zero contribution to the house-count approximation. Multi-region
ribua/karpef/techum output is first-class in every renderer and export.

### 3.3 Human-in-the-loop is the product

Footprint data will be wrong somewhere; dwelling status is halachic judgment (attended barn?
shul with a dirah?). The reviewer clicks buildings in/out and watches the line move. The tool
makes an expert's judgment fast and visual — it does not hide it.

---

## Part 4 — Accuracy & risk register

| # | Risk | Magnitude | Mitigation |
|---|---|---|---|
| 1 | Dwelling classification from map data | moves city edge arbitrarily | biggest real risk — manual override UI, satellite backdrop, included-unknown and verified-only scenarios; neither is inherently strict |
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

## Part 6 — Technical stack (implemented and planned; audited 2026-07-12)

- **Footprints — implemented:** automatic Overture Buildings PMTiles, expanding fetch,
  IndexedDB + R2 tile input cache, per-building overrides, shared reviewed corrections,
  and manual two-click rectangle/polygon drawing. Overture fuses OSM and ML-derived sources.
- **Dwelling tags:** many Overture buildings have no decisive use class, especially ML
  footprints. They are included automatically and remain optionally reviewable.
  US parcel land-use data would solve it but national licensing ≈ $80k/yr (Regrid);
  per-county assessor portals are free but inconsistent. → tags where present + manual
  review; zoning ≠ use.
- **Geometry — implemented:** dependency-free JavaScript engine using a local true-north
  tangent/equirectangular metric projection; Leaflet rendering; KML/GeoJSON export. The
  engine does not perform polygon algebra directly in longitude/latitude. Quantified
  projection-error and 20,000-footprint performance tests are implemented.
- **Geocoding — implemented:** Nominatim plus disclosed nearest-footprint snapping and a
  mandatory reviewer instruction to confirm the marker against satellite imagery.

---

## Part 7 — Status, recommendation & open questions

**BUILT — city-squaring engine v1.4 completed 2026-07-14.** Static web app in this folder (`node serve.mjs`,
see README.md). Implements: geocode → Overture footprint fetch with auto-expansion →
classification (auditable tag table) → 70⅔ ibur clustering → 141⅓ city merge (6-house
minimum) → fixed-point three-villages/city mergers → rectangle/trapezoid/compass ribua →
reviewed bow/L and enclosed-hole masks → three-position overlap handling → one final
karpef → multi-region 2000-amah square-cornered techum → psak profiles → per-building and
validated-perimeter overrides → comparison line → KML/KMZ/GeoJSON/PNG/PDF export. The
golden suite covers every executable branch in §1.5.

**Rev. 13 city-squaring conformance:** complete. No known written squaring rule above is
represented only by the old warning/binary-toggle shortcuts. Two matters remain outside
the universal ribua calculation: (1) a real city's halachic bow endpoints are factual rav
input, for which the app supplies a safe provisional no-fill result; and (2) *ir muvla'at*
is destination/path-specific and therefore detected but not fabricated as one universal
two-dimensional polygon. Neither permits the app to present an unreviewed output as psak.

**Original recommendation (kept for the record): build it.** The automation gap is confirmed — nobody has the footprint → dwelling filter →
70⅔ clustering → ribua → 2000-offset engine, and that's exactly where hand-drawn maps make
mistakes. Google Earth stays in the loop as the *review surface*: we export KML/KMZ so final
inspection happens on high-res imagery, matching the workflow techum people already use.
The geometry itself is a weekend of Shapely code once the config matrix (Part 2) is decided;
the UI for building-level review is the bulk of the work.

**Open halachic questions (need a posek — rev. 2, resolved items moved to Part 2):**

1. ~~Six-house minimum~~ **RESOLVED** — MB 398:38 (3 chatzeros × 2 houses); governs
   independent-city status for city-level rules, not chain extension. In the config matrix.
2. ~~**Eruv-enclosure-as-city default**~~ **RESOLVED in rev. 5 — default OFF.** Measure from
   the buildings-derived city. A rav-validated *hukaf l'dira* perimeter remains a supported
   alternative mehalich, but the app cannot infer that factual status or perimeter from
   Overture or ordinary carrying-eruv geometry. Rev. 12 clarifies that off is a selected
   practice/data-confidence default, not an assertion that the validated alternative lacks
   substantial support.
3. ~~Ribua scope cap on mega-cities~~ **RESOLVED — no halachic cap** (Peninei Halakha:
   chains can run days' walk). Practical limits come from real breaks (rivers, industry,
   non-qualifying gaps) and data caps, which the app labels as data limits.
4. ~~**Generalizing the bow rule to real city outlines**~~ **DEFAULT RESOLVED in rev. 5:**
   detect material pockets and require reviewer-designated endpoints; do not silently infer
   endpoints. Rev. 13 applies the selected Mechaber/Rema/emergency variant after endpoints
   are supplied and uses provisional no-fill beforehand.
5. **Modern beis-dirah edge cases** — offices/factories (occupied but not slept in), hotels,
   hospitals, schools, seasonal cottages, trailers/mobile homes, airports. Rev. 12 records
   the sourced opinion counting some factories with offices/lunch facilities, but the
   type-by-type profile matrix still requires a posek.
6. ~~**Where the 70⅔ is measured from**~~ **SUPPORTED MANUAL MEHALICH in rev. 12:** an
   attached fenced yard or perimeter genuinely open, subsidiary, and *hukaf l'dirah* may
   supply the measurement origin (SA 396:2; Millunchick pp. 47–48). Because those facts
   cannot be inferred from map fences/parcels, the default remains building wall-to-wall;
   a rav-validated perimeter participates in the same 70⅔/141⅓ geometry.
7. **Karpef psak confidence** — the default MB/Ashkenazi profile has it **on** (Rema; MB
   398:36) and the Mechaber/Sefardi profile off (corrected rev 4 — this line previously
   carried stale rev-2 "defaulted off" wording). Exactly how MB 398:21 comes down and what
   target-community practice is should still be confirmed.
8. **Mixing shitos** — may one combine leniencies across shitos (e.g. CI amah for the 2000
   but RCN elsewhere)? Default: never mix; one amah drives everything.
9. **Walled-city timing** (settled-then-walled measures from the wall) — rare, and
   undetectable from data; confirm it's fine as a manual-only option.
10. **Terrain measurement shita** — Peninei Halakha 30:5 supports modern aerial/GPS
    measurement; Tikun Eruvin as reported by Millunchick gives a possible slope-procedure
    difference up to about 9.1%. Default to the modern-map mehalich; a posek may select and
    document a sourced adjustment for a particular terrain calculation.

**Validation benchmarks:** the tool is city-agnostic; these are continuing cross-checks,
not scope or release blockers:
- **Completed:** golden unit tests from the Gemara's canonical shapes (circle, bow, gamma,
  trapezoid, rotated square, three villages), plus all three overlap positions, both
  large-hole positions, profile-correct membership, and multi-region preservation.
- End-to-end regression against at least one **published** techum map (Borehamwood UK,
  Chicago per *Mi-Darkei ha-Techum*, or a techumshabbos.com project city like Hunter, NY —
  the latter conveniently has boundaries published under both R' Moshe and Chazon Ish
  shiurim, a two-shita cross-check for free).

---

## Key sources and authority hierarchy (rev. 13)

### A. Controlling primary/codified sources

Mishna and Gemara Eruvin 55a–58b · Rambam Hil. Shabbos 27–28 · Shulchan Aruch OC
396–399, 405, 408, 414–415 · Rema · Mishna Berurah 397:1, 398:21/36/38/46, 399:7 and
relevant Biur Halacha · Shulchan Aruch HaRav 396–399 · Aruch HaShulchan 398 · Chazon Ish
OC 39 and 110. These control over a secondary English summary when the citations diverge.

### B. Later specialist works for real-city geometry

- R' Ephraim Ariel Buchwald, *Kiryat Ariel* — specialist Hebrew treatment repeatedly cited
  for *beis dirah*, squaring, overlapping rectangles, urban breaks, and the Chazon Ish's
  practical history; especially chapters 4–8. Catalog:
  <https://www.nli.org.il/he/books/NNL_ALEPH990017860390205171/NLI>. Its full text was not
  available online during rev. 12 research; these chapter/page references are indirect via
  Millunchick and Peninei Halakha until checked against a physical or licensed copy.
- R' Mordechai Millunchick, “Techum Shabbat and the Airport,” *Journal of Halacha and
  Contemporary Society* 74 (2017), pp. 44–65 — detailed English consolidation of modern
  structures, yards/enclosures, ribua, overlap, holes, highways, rivers, airports, and the
  principal later opinions: <https://rjj.edu/journals/74/00.pdf>.
- *Tikun Eruvin*, ch. 5; *Netivot HaShabbat*, ch. 42; *Machazeh Eliyahu* 79 and 82;
  *Machazeh Avraham* 70; *Midarkei HaTechum*; Minchas Yitzchak 8:32; Shevet HaLevi 1:59
  and 6:46; Minchas Shlomo 2:59. These are specialist authorities cited by the works above;
  obtain and verify the actual text before assigning a disputed app profile to one of them.

### C. Reliable English compilations and practical guides

- R' Eliezer Melamed, *Peninei Halakha: Shabbat*, ch. 30 — the most complete freely
  accessible illustrated English synthesis found, including orientation, exceptional
  shapes, joins, overlap, large-city breaks, and eruv techumin:
  <https://ph.yhb.org.il/en/category/01/01-30/>. It states its own practical rulings; where
  specialist poskim disagree, cite it as one documented shita rather than “the consensus.”
- R' Yosef Jacobovits / Eruv Network, *Bringing Eruvin to Life: Techum Shabbos* — practical
  six-part English video/PDF/transcript primer for field application:
  <https://outorah.org/series/4080/>. Use its diagrams and workflow after checking cited
  sources; short practical lessons are not authority for every edge-case algorithm.
- Va'ad LeTchum Shabbos, *A Guide to T'chum Shabbos* (Feldheim, bilingual, 99 pp.) — useful
  surveying manual, but the publisher's description says that complete analysis is beyond
  its scope: <https://feldheim.com/guide-to-t-chum-shabbos>.
- “Modern Technology Meets Tehum Shabbat,” *The Lehrhaus* — GIS/aerial-imagery methodology
  and worked metropolitan discussion:
  <https://thelehrhaus.com/scholarship/modern-technology-meets-tehum-shabbat/>.
- Halachipedia, “Techum” — detailed English footnote index and issue checklist, not an
  independent psak authority: <https://www.halachipedia.com/index.php?title=Techum>.

### Source-use rule for every implemented calculation

Every algorithm-changing rule must record: (1) primary/codified source; (2) later specialist
who applies it to the modern case; (3) competing shitos; (4) selected profile/default;
(5) confidence and required rav-review condition; and (6) a golden geometry test. A source
being English, recent, illustrated, or available online makes it easier to audit, but does
not make it universally accepted or sufficient to choose among recognized shitos.
