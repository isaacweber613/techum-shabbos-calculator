# Techum Shabbos Calculator — Halachos & Spec

> **STATUS: Researched and executable draft (rev. 25, 2026-11-25) — sources verified via web research against Sefaria,
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
  d'oraisa view at 12 mil; concludes many hold it's all d'rabbanan. The 12-mil comparison
  ring is measured from the town's own squared edge, without the karpef (rev. 22).
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

**Beis-dirah predicate — a structure counts if it is ≥ 4×4 amos and inhabited or attended,
with either a roof or three walls** (SA OC 398:6; SA HaRav 398:8, 10; under 4 amos wide is not
a dwelling even if very long). Three walls count even without a roof; two walls count only
under a roof. How the 4×4 amos is measured is disputed (rev. 25): under 16 square amos is never
a dwelling; the Mechaber profile counts 16 square amos in any shape, and the Mishna Berurah and
Chazon Ish profiles need a real 4×4-amah square inside and send 16 square amos without one to
review.

- **Counts (extends the city):** houses; a shul **with** an attendant's residence, and
  likewise any house of worship with living quarters for its clergy (SA OC 398:6); a
  barn/stable **with** a resident watchman; a cemetery structure **with** a resident
  caretaker; a bridge or toll/customs house with a resident; a cave with a house at its
  mouth (measured from the cave's far end); three walls ≥ 4×4 amos even without a roof; two
  walls under a roof; a house built in the water; habitable ruins that retain walls
  **and a roof**.
- **Does not count:** two walls without a roof, even if people live between them; cisterns,
  pits, dovecotes; a bare shul or other house of worship, warehouse, or barn with no
  resident; open cemeteries; a dwelling on a ship (a moored houseboat by default, rev. 20); a flimsy seasonal watchman's hut in a
  theft/flood-prone area; a pitched tent (a tent or yurt fixed in one place joins an existing
  town but adds nothing toward forming one, rev. 23); a storage or shipping container (one
  people live in, fixed in place, is treated like a static caravan, rev. 24).
- **Modern commercial/industrial structures are disputed, not categorically excluded.**
  Chazon Ish OC 110:28 (citation questioned, Part 7 Q12) and Shevet HaLevi 1:59 are cited for counting at least some factories
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
- **Three-villages rule** (SA HaRav 398:12): an actual middle village at **≤ 2000 amos
  from each outer village** (equality included) is notionally lowered onto the line between
  the two outer villages. All three merge when the middle village fits inside the projected
  outer gap and the remaining gap to each outer village is **≤ 141⅓ amos**. There is **no
  separate 4000-amah cap on the outer-to-outer span**: a span greater than 4000 can qualify
  when the middle village fits. Rev. 14 retracts the prior sentence that imposed a
  4000-amah/no-merge shortcut. For irregular real polygons, the engine uses and audits the
  line through the two outer physical bounding-box centers; the code treats that centerline
  as a disclosed engineering placement, and its warning asks a reviewer to confirm the axis
  when another factual placement would be material.
- **Independent city status is not simply “six footprints.”** SA OC 398:10 and MB 398:38
  give the structured minimum of three *chatzeros*, each with two permanent houses; the
  later practical literature also records the 50-resident city basis. A raw roof-footprint
  count does not prove either basis. The automatic six-count remains only a visibly
  **provisional proxy**. A reviewer can instead record three-courtyard/two-house evidence,
  at least 50 residents, another rav-attested basis, or disqualification; the factual basis
  and evidence are preserved in the calculation audit and snapshot.
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
     discussed in Chazon Ish OC 110:16; accepted by Minchas Yitzchak 8:32 (or 8:33, Part 7 Q11) and Machazeh
     Eliyahu 82, while Kiryat Ariel reports that the Chazon Ish did not rely on it in
     practice).
  There is **no accepted consensus**. The default remains **no join** and the calculation
  must flag every case in which either alternative would change the result. A binary
  on/off control cannot faithfully represent R' Shlomo Miller's middle position.

**Executable default computation (rev. 14):**

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

## Part 2 — Psak configuration: PROFILES & DEFAULTS (rev. 14 — 2026-07-14)

Policy (per Isaac): follow the widely-known psak as the default; **every** disputed rule is
a setting the user can change; the app decides automatically wherever it can and makes human
review one click where it can't. Every export prints the active config.

Rev-2 corrections (after external review, GPT-5.6 2026-07-10):
- **Six-house minimum IS sourced** — MB 398:38: a "city" is three chatzeros of two houses
  each (≈6 houses), with Chazon Ish qualifications on the courtyards/entrances. Scope
  clarified: the minimum governs when a cluster is an **independent city** that receives
  city-level rules (the 141⅓ city-to-city merge); it is **not** required for an individual
  beis dirah to extend an existing city — a single qualifying house within 70⅔ joins and
  chains onward. **Rev. 14 precision:** this is a structured courtyard/house rule, not a
  bare count of six mapped roofs; the 50-resident basis is also recorded. The six-footprint
  fallback is explicitly provisional.
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
| Overlapping-squares rect merge | **no join** + warning (R' Elyashiv / R' N. Karelitz / R' Belsky); advanced middle option: join without redraw (R' S. Miller) | **no join** + warning (rev. 20); joint redraw is a labelled option, and turning it on is a rav's decision (CI 110:16: "צריך הכרע") | **no join** + warning; alternatives remain explicit |
| City status for 141⅓ / three villages | 3 courtyards × 2 houses or sourced 50-resident basis; six footprints only a provisional fallback | same, with CI courtyard/entrance qualifications | same sourced structure; provisional fallback remains labelled |
| Bow/L/gamma | **Rema-majority:** fill when confirmed chord <4000 or depth <2000; otherwise no-fill; unresolved endpoints use provisional no-fill | same default; reviewer may select another sourced shita | **Mechaber/Rambam:** narrow chord fills; wide remainder follows inhabited/curved edge; reviewer endpoints required |
| Wholly enclosed ≥4000×4000-amah hole | **include + mandatory warning** (Beit Yitzchok / R' Shulem Weiss); strict exclusion available | same | same |
| Unknown-use buildings | include, flagged for review (all profiles — data policy, not psak) | ” | ” |
| Minimum dwelling size (rev. 25) | under 16 square amos is not a dwelling; a 4×4-amah square must fit inside, in some rotation; 16 square amos without one goes to review | same | under 16 square amos is not a dwelling; 16 square amos in any shape counts |
| Static caravans (rev. 20), fixed tents and yurts (rev. 23), lived-in containers (rev. 24) | join an existing town, add 0 to the count that forms one, flagged; building=tent is left out unless a rav includes it; building=container is a non-dwelling, not flagged, until a rav includes it | ” | ” |
| Eruv-enclosure-as-city | **off unless rav-validated** — selected practice/data-confidence default, not settled consensus; validated *hukaf l'dirah* perimeter available | same | same |
| 12-mil ring / second-shita comparison line | hidden / off (available in all profiles); the ring is 24,000 amos from the town's own squared edge, without the karpef (rev. 22) | ” | ” |

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
  an arbitrary user control. Amah choices are displayed in inches. **Superseded by rev. 14:**
  six footprints are a provisional map proxy, not the MB courtyard rule itself, and the
  structured factual basis is now reviewable.
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

### Rev. 14 — 2026-07-14 (city-status evidence, canonical three villages, Woodbourne benchmark)

- **Three villages corrected from the primary English text.** SA HaRav 398:12 requires the
  actual middle village to be within 2000 amos of each outer village, then lowers it between
  the outers: it must fit in their projected gap, leaving no more than 141⅓ amos on either
  side. Equality at 2000 is included, and the source explicitly permits outer villages more
  than 4000 amos apart when the middle village fits. The previous 4000-amah shortcut is
  retracted. The engine now applies that construction to support intervals on the disclosed
  outer-center axis and records the axis, actual distances, projected gaps, widths, and
  component identities. Golden cases cover equality, a greater-than-4000 outer span, and an
  offset middle village that may move toward the line but may not slide along it.
- **City qualification now separates din from map approximation.** The controlling model is
  three *chatzeros* with two permanent houses each (SA 398:10; MB 398:38), with the
  later-literature 50-resident basis also available for attestation. Six counted roof
  polygons remain the deterministic automatic fallback, but are labelled and exported as a
  provisional footprint proxy rather than MB 398:38 itself. The review record now stores a
  structured basis (`three-courtyards`, `fifty-residents`, `rav-attestation`, or
  disqualification) and free-text evidence; remapping and later settlement mergers retain
  that provenance.
- **Commercial/industrial labels moved from automatic exclusion to review.** Offices,
  industrial/commercial buildings, and factories can contain recurring eating/sleeping or
  attended facilities that later poskim may count. Overture/OSM labels cannot establish
  those facts. These types now enter the same explicit beis-dirah review queue as hotels,
  hospitals, and schools instead of being silently classified as non-dwellings. Clearly
  nonresidential categories such as an ordinary warehouse or retail shell remain excluded
  absent contrary factual review.
- **The issuing Va'ad's Woodbourne map is now a reproducible published-output benchmark.**
  The original 2023 one-page PDF from Va'ad Le'Tchum Shabbos is preserved by URL and SHA-256
  in `benchmarks/woodbourne-vaad-2023.json`. Its green city-ribua path and pink techum path
  are extracted exactly from the PDF vectors in page coordinates, together with the printed
  Chazon Ish label and seven road/address checkpoints. Tests verify fixture identity,
  topology, page bounds, and that the published techum encloses the published city path.
  This is authoritative reproduction of the Va'ad's **published result**, not hidden-method
  parity: the source does not reveal its dwelling selection, courtyard facts, joins, bow
  endpoints, or intermediate measurements. Geographic registration and a reviewed input
  snapshot remain the next benchmark layer.
- The executable engine is version 1.5.0. The ordinary result remains decision-support for
  a rav/mumcheh; none of these evidence fields or benchmark checks turns it into autonomous
  psak.

### Rev. 15 — 2026-10-06 (unlabeled Overture subtypes; no psak default changes)

- **Footprints with only a broad Overture subtype now use the existing classification
  table.** Overture gives many footprints a `subtype` but no `class`. All of them were
  treated as `building=yes` — unknown use, included by default — so an unlabeled shed or
  garage could extend city chaining (§1.4) or count toward the provisional six-footprint
  proxy. The beis-dirah predicate (§1.3; SA HaRav 398:8, 10) already excludes a bare barn,
  storehouse, or warehouse with no resident, and the table already applied that to labeled
  garages, sheds, and barns. The subtype now maps to its equivalent class: `outbuilding`
  follows the shed rule (non-dwelling); `civic`, `service`, and `transportation` follow
  their existing non-dwelling entries; `industrial`, `commercial`, `religious`,
  `education`, and `medical` follow their existing review entries. `agricultural` goes to
  review, not to non-dwelling, because it includes farmhouses. `military` and any other
  subtype stay unknown, because barracks can be dwellings. An explicit class always wins,
  and a per-building override still corrects any footprint (for example, an attended barn).
- Only the non-dwelling mappings change a boundary. Review follows the same include/exclude
  setting as unknown and adds a flag.

### Rev. 16 — 2026-10-06 (unfilled-bow boundary; houses of worship to review)

- **An unfilled bow or L pocket is now measured from its houses.** SA OC 398:4 measures an
  unfilled bow from the arc itself. The engine detects a pocket on a grid that keeps every
  cell within 70⅔ amos of a building, and it used to remove the pocket's whole bounding
  rectangle. That had two errors. The cut-out stopped about 70⅔ amos plus one grid cell
  short of the houses, so the techum on that side started too far into the pocket (a
  leniency the Mechaber profile does not grant, compounded by the Rema karpef). And on an
  irregular pocket, the bounding rectangle also removed houses that reach into it, which
  could leave a resident outside his own techum. The removed area is now the union of the
  pocket's own empty cells, merged into rectangles, and each rectangle grows back to the
  nearest building along its side. Houses inside the pocket stay in the starting city, and
  the city edge facing the pocket follows the outermost houses. This applies to the
  provisional no-fill result, to a reviewed no-fill bow, and to an excluded large hole.
  Engine version 1.5.2.
- **Houses of worship and fire stations moved from non-dwelling to review.** SA OC 398:6
  counts a house of avodah zarah with living quarters for its priests exactly like a shul
  with a chazan's dirah, so a church, chapel, cathedral, mosque, or temple can count and
  needs the same review a shul gets. A fire station is staffed and slept in around the
  clock, like an attended guardhouse. A small shrine stays non-dwelling. Review follows the
  same include/exclude setting as unknown.
- §1.3 corrected to the text of SA OC 398:6: three walls of at least 4×4 amos count even
  without a roof, two walls count only under a roof, and a house built in the water counts.

### Rev. 17 — 2026-10-23 (engine audit: determinism and measurement fixes; no psak default changes)

An audit found places where the engine diverged from this spec or from its own
determinism rule (same data + settings = same output, in any input order). No profile
default changed. Engine version 1.5.3.

- **City-status reviews follow the buildings, not the pin.** A reviewer's city-status
  decision (§1.4) was keyed to each footprint's projected coordinates. Those move whenever
  the pin moves (the projection is centered on it) or a reviewer squaring angle is set, so a
  saved "not a city" silently reverted to the six-footprint proxy. Keys now use the stable
  building ids (`cluster:v3`). Saved v2 records still apply: an unchanged v2 key matches
  exactly, and otherwise the ids embedded in the saved member list are used for the usual
  80% membership remap. A footprint with a missing or duplicated id keeps the old
  coordinate form.
- **Bows and large holes are measured from the houses (SA OC 398:3–4; §1.5 step 5).**
  Detection measured the empty grid cells, which stop 70⅔ amos plus up to one cell short
  of the buildings on each side. A pocket was flagged only when the house-to-house span
  exceeded 4000 amos by about 141⅓ amos plus up to two cells, so a U-shaped city with a
  4000–4300-amah mouth was filled without review. The 4000-amah test now uses the pocket
  grown back to its houses, the same mask rev. 16 removes. The Rema depth test after
  reviewer endpoints had the same shortfall and now measures to the houses as well, so a
  pocket that is 2000 amos deep or more is no longer filled by the "depth <2000" leniency on
  the strength of the shorter empty-cell depth. Pockets are still flagged only at ≥4000
  (and ≥2000 for depth), with equality in the ≥ branch.
- **Three villages: every qualifying triple counts (SA HaRav 398:12; §1.4).** The engine
  merged the first qualifying triple it found and then started over, so when two middle
  villages fit between the same outer villages, input order decided which one joined. §1.4
  states the test for each actual middle village against the actual outer villages, and
  nothing in it makes one qualifying village block another. Each pass now tests every triple
  against the same set of settlements, then unites all qualifying triples (and any that
  share a settlement) at once. The pass repeats with the 141⅓-amah merge to a fixed point as
  before (§1.5 step 2). Each triple keeps its own audit warning. In a dense field of small
  villages this can join more villages than the old first-found order did; a rav should
  confirm such results. The pass is also pruned exactly and is about 50 times faster on a
  900-village field (38 s to under 1 s), with identical results.
- **Expansive overlap redraw (`join_redraw`) is order-independent (§1.5 step 6).** A joint
  redraw that grows from one city is not symmetric: A and B's joint rectangle can reach C
  while C's own rectangle reaches neither. The engine kept one such closure per starting
  city and, for a resident of C, picked whichever came first in the input. Every group whose
  joint redraw overlaps another city's rectangle is now united with it, and the united
  groups are redrawn and retested together until stable.
- **Several candidate cities under any overlap rule (§1.10a).** A pin outside every house
  but inside two separate cities' starting areas (for example, where their two Rema karpefs
  meet) took the first city in input order under both joining rules. The conservative
  common area of all candidates, with its review warning, now applies under every overlap
  rule, not only `no_join`.
- **The open-field point square follows only the point rotation (§1.7).** The point-mode
  square was also turned by the reviewer's city-squaring angle, while the audit reported
  only the point rotation. It now uses the point rotation alone.
- **Projection across ±180° longitude.** The local projection now uses the shorter
  longitude difference, so a pin near the antimeridian no longer puts its neighbors on the
  far side of the planet.
- **Known remaining gap (app, not engine):** bow-endpoint reviews are still keyed and stored
  in pin-centered coordinates. Moving the pin drops the saved endpoints and the bow returns
  to the visible provisional no-fill result. That is conservative, but the review has to be
  redone. Fixing it requires the app to store endpoints as latitude/longitude.

Golden tests cover each item: a moved pin and a squaring angle with new and legacy review
records, 3990/4010-amah mouths, a 2030-amah-deep reviewed bow, both orders of a
redraw-only join, karpef-overlap pins under all three overlap rules, two middle villages in
both orders, a 900-village field, the point square, and the antimeridian.

---


### Rev. 18 — 2026-11-09 (reporting fix; no psak default changes)

- **A lone city reports its own squaring under joint redraw.** With the joint-redraw overlap
  approach selected, a city that joined nothing was still labeled `overlap-joint-redraw`
  with no rectangularity score, so the result text called a preserved rectangle "irregular
  city squared to the world directions." The drawn boundary was already correct. The label
  now says joint redraw only when two or more cities were redrawn together. Engine version 1.5.4.

### Rev. 19 — 2026-11-25 (spec-traced golden tests; two conformance fixes; no psak default changes)

- **Spec-traced golden suite.** `tests/spec-golden.test.js` ties each case to the spec line
  it proves, with expected values worked out by hand: exact equality at 70⅔, 141⅓, 2000
  (three villages), 4000 (bow mouth and reviewed chord) and the 94% classifier; 1 mm past
  each limit; straight-line corner gaps; amah scaling of every threshold; the karpef on all
  four sides; building-mode karpef; profile values. Questions the spec does not settle are
  listed as pending, never encoded as a ruling.
- **The 4×4-amah size test measures true width (§1.3).** The filter compared the
  footprint's north-south and east-west box with 4 amos, so a 1.5 m wide, 50 m long shed
  turned 45° (box about 36 × 36 m) counted as a dwelling. SA HaRav 398:10 says under 4 amos
  wide is not a dwelling even if very long. The test now uses the narrowest width in any
  direction. Compass-aligned footprints are unaffected.
- **Swallowed cities are flagged for a person outside every city (§1.10a).** The
  ir-muvla'at warning was raised only in city mode. A person in point mode, or resting in a
  lone house, whose 2000 amos wholly contain a city now gets the same warning. The boundary
  is unchanged; no extension is drawn. Engine version 1.5.5.

### Rev. 20 — 2026-11-25 (three researched answers applied; three psak default changes)

These answers come from research Isaac ordered, one researching agent per question, on the
three questions rev. 19 left pending. They were not given by a posek. Where the research
says a rav decides, the calculator flags the case and does not rule on it.

- **A moored houseboat does not extend the town by default (§1.3).** Before: building=houseboat
  counted as a dwelling. A ship's dwelling does not join the town (Eruvin 55b; Rambam Shabbos
  28:4; SA OC 398:6). The reason is disputed. Rashi, Magen Avraham 398:10, Mishnah Berurah
  398:34 and Shulchan Aruch HaRav 398:9 give "it has no fixed place", which a boat that never
  leaves its berth does not suffer from. The Meiri gives "the ship itself is movable";
  Merkeves HaMishneh, as quoted in Chashukei Chemed (Sanhedrin 113a), excludes it even in the
  harbor, and Chashukei Chemed concludes "possibly" permanent ship dwellers are not part of
  the town. "A house built in the water" is a building on ground (Rashi: sea islands; Aruch
  HaShulchan 398:15: the shore), not a floating boat. Now: houseboats go to the review
  category, are always flagged, and are left out by default even when ambiguous structures
  are included. The app has no separate alternative line for one building type; the review
  text says so, and a rav can include the boat with its per-building include control to see
  the town with it counted.
- **Cabins, seasonal cottages and caravans (§1.3; Part 7 Q5).** The research separates
  permanence from occupancy. Wooden cabins count fully (SA OC 398:10: houses "of stone or of
  boards"). A structure built as a dwelling counts even when nobody lives in it (Rashi 55b;
  Magen Avraham 398:5; Mishnah Berurah 398:19; Shulchan Aruch HaRav 398:6; Aruch HaShulchan
  398:15), so a seasonal cottage that is a real house counts all year. A static caravan fixed
  on a site joins an existing town by inference (flimsy watchmen's huts join an existing
  town: Mishnah Berurah 398:33). Whether caravans alone make a town is disputed: Magen
  Avraham 398:15 and Mishnah Berurah 398:49 say fixed in one place is like a town; the
  Levush, as read by Eliyah Rabbah 398:14, disagrees; the Pri Megadim doubts how long counts
  as fixed. One contemporary rav (R' A.Y. Shapira, citing Chazon Ish 110:22) joins a mobile
  unit only while people eat or sleep there and not toward the houses that make a town. A
  touring caravan is like the house on a ship. Now, mapped onto the tags the data has:
  building=cabin stays a dwelling. Overture has no seasonal-cottage tag; such cottages arrive
  as house/cabin/bungalow and count. building=static_caravan (before: a full dwelling) goes
  to review, is included by default with the other ambiguous structures, chains in the
  70⅔-amah join, and adds 0 to the count that forms a town, like a validated join perimeter.
  The map cannot tell a seasonal caravan from a year-round one, so every static caravan that
  joins a town raises a `static-caravan` warning, and a settlement that would be a town only
  by counting its caravans raises a `caravan-site` warning; a rav may record its town status
  through the existing city-status review. building=caravan and building=touring_caravan
  (before: unknown use, included and flagged) are not counted.
- **Chazon Ish profile: joint redraw off by default (§1.5 step 6; Part 2 table).** Before:
  the Chazon Ish profile set `join_redraw` on, while the table said only that it was
  "available". Chazon Ish OC 110:16 argues for it from Rashi, the Tur and the Rema, but his
  note ends "והדבר צריך הכרע" (the matter needs a ruling). R' Chaim Kanievsky (Shoneh Halachos
  398:19), R' Wosner and others read it as his ruling; R' Elyashiv, R' Dovid Landau and
  R' Nissim Karelitz are strict or leave it open. It nearly always enlarges the boundary, so
  it is a leniency. Now: the profile defaults to no join with the overlap warning, like the
  other profiles; joint redraw stays a labelled option whose text says turning it on is a
  rav's decision. A browser that saved the old Chazon Ish profile unchanged follows the new
  default once; any other saved choice and every snapshot keep their explicit setting.
- **Two citations marked, not ruled on** (Part 7 Q11, Q12): Minchas Yitzchak 8:32 vs 8:33 in
  §1.5, and Chazon Ish 110:28 for factories in §1.3.
- **Replay note.** Footprint classes are re-read when a snapshot loads, so an older snapshot
  containing houseboats, static caravans or touring caravans can now give a different
  boundary than when it was saved. Engine version 1.6.0.

Golden tests in `tests/spec-golden.test.js` (ids `rev20-*`) cover each item with expected
values worked out by hand.

### Rev. 21 — 2026-11-25 (independent review of revs. 19–20; conformance fixes; no psak default changes)

An independent review redid every golden value in `tests/spec-golden.test.js` by hand and broke
the engine on purpose to see which tests notice. Every expected value was right. No profile
default changed. Engine version 1.6.1.

- **A pin in an unfilled pocket rests outside the city (§1.10a).** Membership tested the city's
  whole squared rectangle, so a pin in the empty middle of an unfilled bow/L pocket, or of an
  excluded hole, was treated as a resident, although §1.10a counts only the final starting
  area. The techum drawn from the houses could then leave the pin itself outside. Now such a
  pin rests outside that city (the open-field square, or building mode in a lone house), with
  a `pin-in-excluded-pocket` warning. The pocket's review stays visible, and a reviewer fill
  makes the pin a resident again. A pin in one of the city's houses, or inside the Rema karpef
  of the houses facing the pocket, is a resident as before.
- **Swallowed cities are flagged inside a validated enclosure too (§1.10a).** Rev. 19 covered
  point, building and ordinary city mode, but not a resident of a rav-validated enclosure. A
  city that does not touch the enclosure and lies wholly inside the techum now raises the same
  `ir-muvlaas` warning. The boundary is unchanged.
- **The rev. 20 Chazon Ish switch also reaches saves from before rev. 13.** Those saves held the
  old yes/no `overlapMerge` switch (Chazon Ish default: on) and no bow or hole setting, so the
  exact-match test missed them and an unchanged old profile kept joint redraw. The comparison
  now reads the normalized values. It also runs only for a revision below 20, so a later
  revision number never re-runs it. Explicit choices and snapshots are untouched, as before.
- **Overture class names.** Overture's `semi` (semi-detached house) and `dwelling_house` were
  read as unknown use; they are dwellings. The default boundary does not change, because unknown
  use is included; the verified-dwellings-only line and the review queue do. Rev. 20 said
  Overture has no seasonal-cottage tag. It has `allotment_house`, `beach_hut`, `hut` and
  `shelter`; they stay unknown use (included, flagged) pending Part 7 Q14. `caravan` and
  `touring_caravan` are not Overture classes; only an OSM-era snapshot can carry them.
- **Replay note for rev. 19.** The narrowest-width size test also runs when an older snapshot
  loads, so a snapshot holding a narrow footprint turned off the compass can now give a
  different boundary than when it was saved.
- **Engineering tolerances, disclosed.** Distances are compared exactly at every limit (70⅔,
  141⅓, 2000, 4000, the 4-amah width), with equality on the side each rule states.
  Floating-point error there is below a millionth of a millimetre, far under the 2–4 m footprint
  error in Part 4. A point counts as on a ring within 1 cm: a pin within 1 cm of a wall, karpef
  or city edge is inside it, a city corner within 1 cm outside a techum still counts as
  swallowed, and two city rectangles within 1 cm of each other can count as overlapping. These
  are engineering tolerances, not shiurim. Part 4's "show borderline joins as uncertain" is not
  implemented, and no margin for it has been chosen.
- **Golden tests.** Their thresholds are now written from this spec instead of read back from
  the engine; before, changing the 4000-amah bow limit to 3999 failed no test. New cases cover
  exact equality at 2000 amos for three villages (the older equality case rounded to just
  inside 960 m), the Rema chord at exactly 4000 and depth at exactly 2000 amos, the swallowed-
  city flag with a reviewer squaring angle and inside an enclosure, the pocket pin, and both
  old-save switches. Three checks this spec does not settle became pending questions: the
  12-mil ring beyond the karpef (Part 7 Q15), and tents and containers as non-dwellings (Q14).

### Rev. 22 — 2026-11-25 (researched answer: the 12-mil ring; one default change)

From research Isaac ordered, one researching agent per question, not from a posek. Every
place cited below was checked on Sefaria on 2026-11-25. The research put its confidence at
about 85%.

- **The 12-mil ring starts at the town's own squared edge, without the karpef (Part 7 Q15).**
  Before: with the Rema's karpef on (the MB and Chazon Ish profiles), the engine drew the ring
  24,000 amos beyond the karpef, 70⅔ amos (33.92 m at 48 cm) further out than the town's
  squared edge. Now the ring is 24,000 amos from the squared town in every profile, for one
  town and for towns joined into one (Rambam Shabbos 28:5: two towns within 141⅓ amos count
  as one town). The 2000-amah techum keeps its karpef as before. Sources: Sefer HaChinuch 24
  measures the Torah-law 12 mil "from the edge of the outermost house in the city"; Rambam
  Shabbos 27:1–2 and Smag, Lavin 66 count it from the city; the karpef of a single town is
  the Rema's leniency ("so it seems to me, to be lenient", SA OC 398:5), which the Mechaber,
  following the Rambam and the Smag, does not give at all (Mishnah Berurah 398:21; Biur
  Halacha 398:5); and the 12 mil is treated strictly as a Torah-law doubt (Rema on SA OC
  404:1; Mishnah Berurah 404:7). The research found no authority who adds the karpef to the
  12 mil. The Mechaber profile, with no karpef, is unchanged.
- **Flag.** Whenever the ring is shown, the results panel adds a short note that it is drawn
  from the town's own squared edge without the karpef and that a rav should confirm it. The
  ring stays off by default.
- **Still open (Part 7 Q16).** Whether the 12 mil is measured from the squared town at all,
  or from the houses themselves. Minchas Chinuch 24 (paragraphs 7 and 10) asks in general
  whether the rabbinic techum rules and leniencies apply to the Torah measure, and holds that
  the stepped slope measurement does not; on the squared corners of the techum itself he says
  the same dispute applies to the 12 mil. He does not discuss squaring the town for the 12
  mil, so the research's report of his doubt about squaring checked out only in that general
  form. The ring keeps the squared edge. The Chazon Ish's own words were not read; his work is
  not on Sefaria.
- **Replay note.** A snapshot that shows the 12-mil ring with the karpef on now draws the ring
  70⅔ amos closer to the town than when it was saved. Engine version 1.6.2.

Golden tests in `tests/spec-golden.test.js` (ids `rev22-*`) cover one town, two joined towns,
both amos, each profile, a validated enclosure, building mode and a multi-region town, with
expected values worked out by hand.

### Rev. 23 — 2026-11-25 (researched answer: tents and yurts; two default changes)

From research Isaac ordered, not from a posek. Every place cited below was checked on Sefaria
on 2026-11-25; the Levush itself is not there and is cited only as the Eliyah Rabbah reads it.
The research put its confidence high for pitched tents and for camps with permanent houses,
and medium for fixed tents.

- **A pitched tent is not a dwelling; the table was right (Part 7 Q14).** Rav Huna (Eruvin
  55b): hut-dwellers are measured only from the doors of their own houses; Rashi there: such
  huts are not permanent, and Israel in the desert "were tent-dwellers who are not fixed".
  Rambam Shabbos 28:10 and SA OC 398:10 rule that dwellers in tents of reeds and willows have
  no town status. The Beis Yosef (398) quotes the Shibolei HaLeket: they are not fixed in one
  place but stay until the pasture is used up, so even many tents together, such as an army's
  camp, are each measured from their own tent. A camp fenced by a 10-tefach partition or
  ditch is a different rule (Rema on SA OC 398:10, from the same Beis Yosef).
- **A tent fixed in one place gets rev. 20's static-caravan treatment.** Magen Avraham 398:15
  and Mishnah Berurah 398:49: tents fixed in one place are like a town; so also Chayei Adam
  (Shabbos) 76:11 and Kaf HaChaim 398:66, who calls them fixed after 30 days. Against: the
  Levush, as Eliyah Rabbah 398:14 reads him, excludes even fixed tents. How long makes a tent
  fixed is unsettled: Eshel Avraham (Pri Megadim) 398:15 asks whether one summer or 30 days.
  So a fixed tent chains in the 70⅔-amah join onto an existing town, adds 0 to the count that
  forms a town, and is flagged: a `fixed-tent` warning when it joins a settlement with houses,
  and a `tent-site` warning when a settlement would be a town only by counting its tents. A
  rav may record that settlement's town status through the existing city-status review.
- **A camp with three courtyards of two permanent houses each is a town, tents and all.**
  Eruvin 55b (R' Chinana bar R' Kahana in the name of R' Ashi): with three such courtyards
  "they are fixed"; Rashi: houses of stone or wood "fix all of them"; Rambam 28:10; SA OC
  398:10. In the engine the camp's houses make the town (through the provisional six-footprint
  proxy or a rav's record) and the tents chain on as part of it. With fewer permanent houses
  the tents do not count toward a town, and the camp is flagged.
- **Map classes.** The map data cannot tell a pitched tent from a fixed one. building=tent
  (before: a non-dwelling, never flagged) now goes to review: it is still left out by default,
  even when ambiguous structures are included, so it is always flagged, and a rav's
  per-building include gives it the fixed-tent treatment. building=ger, a yurt (before: a full
  dwelling), gets the fixed-tent treatment directly: review, included by default with the
  other ambiguous structures, counted 0 toward a town. Overture's building classes (its schema,
  checked 2026-11-25) include `ger` but not `tent`, so building=tent reaches the calculator
  only from a snapshot saved from the older OpenStreetMap source. A footprint left out by
  default (a tent, a houseboat) is also no longer offered as the starting building when the
  pin is placed near it, unless a rav included it. The same rules apply in every profile.
- **Replay note.** A snapshot holding a yurt or a tent can now give a different boundary than
  when it was saved. Engine version 1.6.3.

Golden tests in `tests/spec-golden.test.js` (ids `rev23-*`) cover each item with expected
values worked out by hand.

### Rev. 24 — 2026-11-25 (researched answer: shipping containers; one default change)

From research Isaac ordered, not from a posek. The research found no posek who discusses
containers by name, so this applies the rules for storehouses and caravans to them. Every
place cited below was checked on Sefaria on 2026-11-25. The research put its confidence high
for storage containers and medium for lived-in ones.

- **A storage or shipping container is not a dwelling and does not join a town, in every
  profile; the table was right (Part 7 Q14).** The baraita in Eruvin 55b, Rambam Shabbos
  28:3–4 and SA OC 398:6 count storehouses only when there is a dwelling in them, and list
  storehouses without one among the structures that do not join. Rashi there and Mishnah
  Berurah 398:27: storehouses for grain, wine and oil are not dwellings, so they need a
  dwelling for watchmen. Aruch HaShulchan 398:14 says the same of storehouses of "other
  merchandise": the storehouse itself is not a dwelling.
- **A container people live in, fixed in place, gets rev. 20's static-caravan treatment.** A
  building not made for living in joins the town once people live in it (Shulchan Aruch
  HaRav 398:8). A container is made to be moved, and a house on a ship does not join because
  it is not fixed in one place (Rashi on Eruvin 55b; Mishnah Berurah 398:34). Whether movable
  dwellings fixed on a site make a town by themselves is the caravan and tent dispute (Magen
  Avraham 398:15 and Mishnah Berurah 398:49 against Eliyah Rabbah 398:14). So a lived-in,
  fixed container chains in the 70⅔-amah join onto an existing town, adds 0 to the count
  that forms a town, and is flagged: a `lived-in-container` warning when it joins a
  settlement with houses, and a `container-site` warning when a settlement would be a town
  only by counting such containers. A rav may record that settlement's town status through
  the existing city-status review.
- **Map classes.** The map data cannot tell a lived-in container from a storage one.
  building=container stays a non-dwelling: left out, not in the review queue and never
  flagged by default. Before, a reviewer's per-building include counted it as a full house;
  now the include gives it the static-caravan treatment, and only that case is flagged. Any
  footprint a reviewer included, such as a lived-in container, can now be offered as the
  starting building when the pin is placed near it; before, a non-dwelling never was.
  Overture's building classes (checked 2026-11-25) have no `container`, so
  building=container reaches the calculator only from a snapshot saved from the older
  OpenStreetMap source. The same rules apply in every profile.
- **Still open (Part 7 Q17).** The same baraita counts "the house in the sea", which Rav Papa
  explains as a house made for unloading a ship's goods, and Mishnah Berurah 398:30 says that
  is why it counts as a dwelling. Whether that reaches a port warehouse, or containers on a
  quay, was not part of the research. The calculator counts neither.
- **Replay note.** A snapshot holding a container a reviewer included can now give a different
  boundary than when it was saved. Engine version 1.6.4.

Golden tests in `tests/spec-golden.test.js` (ids `rev24-*`) cover each item with expected
values worked out by hand.

### Rev. 25 — 2026-11-25 (researched answer: the shape of a 4×4-amah dwelling; two default changes)

From research Isaac ordered, not from a posek. Every place cited below was checked on Sefaria
on 2026-11-25. The Chazon Ish is not there and was not read. The research put its confidence
high on what the texts say and medium on which profile follows which.

- **No opinion uses the outline's overall width (Part 7 Q13).** Rev. 19 counted a footprint
  when it was at least 4 amos wide in every direction across its outer hull. That let an L- or
  U-shaped building with walls under 4 amos thick count, though no 4×4 square fits inside it.
- **Under 16 square amos is never a dwelling, in every profile.** The baraita in Sukkah 3a–b:
  a house without 4 by 4 amos is not made an ibur between two towns, because people do not
  live in it. SA OC 398:6 needs the house to be 4 by 4 amos. Less floor than 16 square amos
  fails every reading.
- **Mechaber / Sefardi: 16 square amos in any shape counts.** Rambam (Mezuzah 6:2) and SA YD
  286:13: a house with enough room to square 4 by 4 amos counts even if it is round,
  five-cornered or longer than it is wide. Kaf HaChaim 398:29 applies this to techum: by the
  Rambam and the Shulchan Aruch, a house under 4 amos wide is still a house. Machatzis HaShekel
  398:6 says the same follows for every law in that baraita. This reverses rev. 19's
  long-narrow rule for this profile only: a 1.5 m wide, 50 m long structure now counts there.
- **Mishna Berurah and Chazon Ish: a real 4×4-amah square must fit inside, in some rotation.**
  The Rosh (Hilchos Mezuzah 16) needs 4 by 4 amos and rejects the Rambam's reading; the Shach
  (YD 286:23) follows the Rosh enough to put up a mezuzah without a blessing. Magen Avraham
  398:6, Shulchan Aruch HaRav 398:10 and Aruch HaShulchan 398:15: under 4 amos wide is not a
  house, however long. Eshel Avraham 398:6 reads the Magen Avraham as needing a real square,
  not enough area to make one, and Machatzis HaShekel 398:6 concludes one should be strict and
  require a square for ibur.
- **16 square amos with no such square goes to review in those two profiles.** Pri Megadim
  (Eshel Avraham 398:7) asks why the Magen Avraham needs a square here but not in 366:6, and
  leaves it open. Biur Halacha 398:6 says the Mishnah Berurah left the Magen Avraham's rule out
  because later authorities challenged it, and that it depends on the dispute in YD 286:13.
  Mishnah Berurah 366:22 says the poskim differ. Magen Avraham 366:6 itself cites the Ralbach
  that enough room to square suffices, and Chayei Adam 76:12 questions the Magen Avraham, "all
  the more in a rabbinic matter" (he names the two sides the other way round from the texts
  above). Such a building is treated like the other ambiguous buildings: it follows the
  "include ambiguous buildings" setting (on by default), is listed in the review queue and drawn
  in the review colour, and the verified-dwellings line leaves it out. Before, one at least 4
  amos wide in every direction counted as an ordinary dwelling, and a narrower one was left out.
- **How the test works.** The floor area is the outline's area less any holes. The square test
  is exact for any outline: concave (L, U and T shapes), round, or with holes. It looks at every
  rotation and settles each case to within a millionth of a metre; a building inside that
  margin counts, like one exactly 4×4 amos.
- **Walls.** A map outline is the outside face of the walls. Machatzis HaShekel 398:6 measures
  the 4 by 4 amos inside the walls, without their thickness. The calculator cannot see how thick
  a wall is and takes nothing off for it, so a building that passes by less than its walls'
  thickness may fail when measured inside. A rav checking such a building should measure it
  inside. No wall thickness is assumed.
- **Holes.** The building data keeps only each building's outer outline (inner rings are
  dropped when the map tiles are read and when a footprint file is imported), so a closed
  courtyard is measured as floor for now. That matters only when every wing around the
  courtyard is under 4 amos wide. Carrying courtyards through would mean fetching every stored
  map tile again; that was not done here.
- **Profiles and saved settings.** Each profile now carries its size rule (the setting "Shape of
  a 4×4-amah dwelling"): a 4×4 square for the Mishna Berurah and Chazon Ish profiles, 16 square
  amos for the Mechaber profile. A save or snapshot from before rev. 25 has no size rule and
  takes its own profile's rule, as rev. 20 did for an unchanged profile, so a saved Mechaber
  profile moves to the area rule. Nothing a user chose is changed, including the size filter's
  on/off switch. Choosing the other rule makes the profile Custom.
- **Still open (Part 7 Q18).** The Chazon Ish's own words on the shape of a 4×4 dwelling were
  not read.
- **Replay note.** The size test also runs when an older snapshot loads, so a snapshot holding
  a thin, L-shaped or U-shaped footprint can now give a different boundary than when it was
  saved. Engine version 1.7.0.

Golden tests in `tests/spec-golden.test.js` (ids `rev25-*`) cover each item with expected
values worked out by hand.

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

**BUILT — city-squaring engine v1.5 completed 2026-07-14.** Static web app in this folder (`node serve.mjs`,
see README.md). Implements: geocode → Overture footprint fetch with auto-expansion →
classification (auditable tag table) → 70⅔ ibur clustering → reviewed city qualification
(provisional six-footprint fallback) → 141⅓ city merge → fixed-point three-villages/city
mergers → rectangle/trapezoid/compass ribua →
reviewed bow/L and enclosed-hole masks → three-position overlap handling → one final
karpef → multi-region 2000-amah square-cornered techum → psak profiles → per-building and
validated-perimeter overrides → comparison line → KML/KMZ/GeoJSON/PNG/PDF export. The
golden suite covers every executable branch in §1.5.

**Rev. 14 city-squaring conformance:** complete. No known written squaring rule above is
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

1. ~~Six-house minimum~~ **SOURCE RULE RESOLVED; FACTUAL INPUT REMAINS REVIEWABLE** —
   SA 398:10 / MB 398:38 require three *chatzeros* × two permanent houses; later practical
   literature also records the 50-resident basis. Six roof footprints are only a provisional
   automatic proxy. The reviewer records the actual basis/evidence before relying on a
   city-level 141⅓ or three-villages merger.
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
   type-by-type profile matrix still requires a posek. **Rev. 20 answered (from research,
   not a posek):** cabins and real-house seasonal cottages count; static caravans join an
   existing town but do not count toward forming one, with a flag for seasonal caravans and
   caravan-only sites; touring caravans and houseboats do not count by default.
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
11. **Minchas Yitzchak 8:32 or 8:33? (rev. 20, citation only)** — §1.5 and the source list
    cite Minchas Yitzchak 8:32 for accepting the joint redraw; other sources found by the
    rev. 20 research give 8:33. Not checked against the volume itself; no ruling changed.
12. **Chazon Ish 110:28 on factories (rev. 20, citation only)** — §1.3 cites it for counting
    factories with offices and a lunch room. Two secondary sources found by the rev. 20
    research report the Chazon Ish as not counting a factory, or counting only buildings
    with sleeping quarters. The researchers read the Chazon Ish only through later works.
    Factories stay in review; no ruling changed.
13. **Narrow non-rectangular footprints (rev. 21)** — the size test asks whether an outline is
    at least 4 amos wide in every direction, measured across its outer hull. An L- or U-shaped
    structure whose walls are under 4 amos thick, or a small triangle, passes although no
    4×4-amah square fits inside it (as it also did before rev. 19). Does "4 by 4 amos" (SA HaRav
    398:10) need a 4×4 square inside the structure, an area of 16 square amos, or only that
    width? Mishnah Berurah 398:33 also cites Sha'arei Teshuvah that watchmen's huts need not
    have 4 amos at all, while the size test removes every footprint under 4 amos wide.
    **Rev. 25 answered the shape (from research, not a posek):** no opinion uses the outline's
    width; under 16 square amos is never a dwelling; the Mechaber profile counts 16 square amos
    in any shape; the Mishna Berurah and Chazon Ish profiles need a real 4×4 square and send 16
    square amos without one to review. The watchmen's-hut point and Q18 stay open.
14. **Map classes with no ruling (rev. 21)** — Overture's `allotment_house` (a garden cottage,
    often seasonal), `beach_hut`, `hut`, `shelter`, `boathouse`, `trullo` and `presbytery`
    stay unknown use (included, flagged), and the table counts `tent` and `container` as
    non-dwellings. Which of these is a beis dirah? **Rev. 23 answered tents (from research,
    not a posek):** a pitched tent is not a dwelling; a tent or yurt fixed in one place joins
    an existing town but adds 0 toward forming one, with flags; building=tent stays out unless
    a rav includes it. **Rev. 24 answered containers (from research, not a posek):** a storage
    or shipping container is not a dwelling; one people live in, fixed in place, gets the
    static-caravan treatment once a rav includes it. The other classes stay open.
15. **The 12-mil comparison ring (rev. 21)** — the engine draws the 24,000-amah ring beyond the
    Rema karpef, like the 2000. Is the d'oraisa 12 mil measured from the karpef or from the
    city's own edge? The ring is off by default. **Rev. 22 answered (from research, not a
    posek):** from the town's own squared edge, without the karpef, in every profile; the part
    still open is Q16.
16. **Is the 12 mil measured from the squared town? (rev. 22)** — the ring keeps the squared
    edge. Minchas Chinuch 24 asks in general whether the rabbinic techum rules and leniencies
    carry over to the Torah measure, which would include squaring the town, but he does not
    discuss squaring directly. The Chazon Ish's own words on the 12 mil were not read.
17. **A house built in the water for a ship's goods (rev. 24)** — Eruvin 55b counts "the house
    in the sea"; Rav Papa explains it as a house made for unloading a ship's goods, and
    Mishnah Berurah 398:30 says that is why it counts as a dwelling (when it has 4×4 amos and
    stands within 70⅔ amos of the town). Does this reach a port warehouse or containers on a
    quay? Both stay non-dwellings.
18. **The Chazon Ish on the shape of a 4×4 dwelling (rev. 25)** — the Chazon Ish profile
    follows the Mishna Berurah profile's square rule. The Chazon Ish's own words on whether 16
    square amos must hold a real 4×4 square were not read; they are not on Sefaria.

**Validation benchmarks:** the tool is city-agnostic; these are continuing cross-checks,
not scope or release blockers:
- **Completed:** golden unit tests from the Gemara's canonical shapes (circle, bow, gamma,
  trapezoid, rotated square, three villages), plus all three overlap positions, both
  large-hole positions, profile-correct membership, and multi-region preservation.
- **Completed published-output reproduction:** the issuing Va'ad Le'Tchum Shabbos 2023
  Woodbourne PDF, explicitly labelled Chazon Ish, is fingerprinted and its exact vector
  green/pink paths plus printed checkpoints are frozen in
  `benchmarks/woodbourne-vaad-2023.json` with conformance tests.
- **Still required for full method parity:** register that published page to geographic
  coordinates and compare a rav-reviewed calculator input snapshot. The public map does not
  disclose enough intermediate facts to infer its selected houses/courtyards, joins, bow
  endpoints, or exact construction merely from the colored outline. Borehamwood, Chicago,
  or Hunter remain useful independent/two-shita cross-checks.

---

## Key sources and authority hierarchy (rev. 14)

### A. Controlling primary/codified sources

Mishna and Gemara Eruvin 55a–58b · Rambam Hil. Shabbos 27–28 · Shulchan Aruch OC
396–399, 405, 408, 414–415 · Rema · Mishna Berurah 397:1, 398:21/36/38/46, 399:7 and
relevant Biur Halacha · Shulchan Aruch HaRav 396–399 · Aruch HaShulchan 398 · Chazon Ish
OC 39 and 110. These control over a secondary English summary when the citations diverge.
The complete English SA HaRav 398 text used to correct the three-villages construction is:
<https://www.chabad.org/library/article_cdo/aid/4051111/jewish/Shulchan-Aruch-Chapter-398-The-Laws-Governing-How-the-2000-Cubits-of-the-Shabbos-Limits-are-Measured.htm>.

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
- Va'ad Le'Tchum Shabbos, “Map for T'chum Shabbos — Woodbourne NY” (2023), the issuing
  organization's exact published Chazon Ish output used by the benchmark fixture:
  <https://www.catskillseruv.com/_files/ugd/4c904a_05320b7f909d46cb9994b70a9b2e1a57.pdf>.
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
