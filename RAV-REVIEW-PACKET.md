# Rav review packet — Techum Shabbos Calculator

Prepared 2026-07-14 for spec rev. 13. This is a decision sheet, not a psak. The detailed reasoning,
citations, revision history, and alternatives are in `TECHUM-SPEC.md`; implementation
evidence and known gaps are in `HALACHA-AUDIT.md`.

## Fast review: decisions requested

A rav can review the project efficiently by answering the rows below. Please record the
answer, source/minhag, intended community, and any conditions. “Accept default” means the
current software behavior may remain; it does not certify a particular city's input data.

| Priority | Question | Current documented default | What changes if rejected |
|---|---|---|---|
| 1 | Which modern structures are a *beis dirah*: hotels, hospitals, schools, offices/factories, seasonal homes, trailers, airport buildings? | Tag-based inclusion with unknowns visibly flagged and manually overridable | Classification table and every affected city edge |
| 2 | May six mapped footprints approximate 3 *chatzeros* × 2 houses for independent-city status? How should apartments/shared entrances count? | Six-footprint approximation, warned; it affects 141⅓ merges, not ordinary 70⅔ chaining | Cluster qualification and potentially kilometer-scale merges |
| 3 | In the MB/Ashkenazi profile, is one 70⅔-amah karpef added after the final permitted ribua/overlap regions? | Yes; one post-ribua karpef, with no recursive karpef-generated merger | Tens of meters at each outer edge; possibly topology |
| 4 | Does standing in a filled corner of the city's *ribua* make the person a city resident? | Yes; a physically containing dwelling takes priority, then the final profile-governed starting region; unrelated no-join candidates use their common permission | City mode versus point mode and the selected home city |
| 5 | What establishes *ribua* orientation for existing rectangles, trapezoids, irregular cities, or a natural straight edge? | Preserve a high-confidence rectangle; extend an exact trapezoid on its parallel pair; otherwise true world directions; reviewer angle allowed | Rectangle orientation and corner reach |
| 6 | For a real bow/L-shape, who designates endpoints, and which chord/depth rule applies? | Reviewer supplies endpoints. Until then, provisional no-fill; afterward MB/Ashkenazi uses the Rema-majority chord-or-depth rule and Mechaber uses the chord rule | Concavity treatment and possibly large areas |
| 7 | Can a validated *hukaf l'dira* eruv/perimeter define the city? | Ordinary eruv ignored; buildings-derived city. Alternative only after rav validates the perimeter | Starting boundary for the entire techum |
| 8 | Is the 70⅔ gap measured wall-to-wall, or may attached courtyards/fenced residential areas count? | Footprint wall to wall; a rav may add a validated residential joining perimeter that affects geometry but counts as zero houses | Borderline chains and outer edge |
| 9 | Is a wholly enclosed void at least 4,000 × 4,000 amos included? | Include with mandatory warning (Beit Yitzchok / R' Shulem Weiss); strict exclusion is available | Internal starting area and its resulting techum |
| 10 | Confirm profile consistency: one amah value drives 4, 70⅔, 141⅓, 2,000, 4,000 and 24,000 amos; no mixing shitos. | One selected amah drives all thresholds | All scale and topology calculations |
| 11 | Any role for a roughly 7% hilly-terrain reduction? | Not implemented; horizontal plan distance is used | Distance model |

Suggested first pass: decide 1–4. They affect ordinary results most often. Questions 5–8
can then be tested on a city where they are concrete rather than in the abstract.

## Rules that need confirmation, but are already directly testable

- 70⅔-amah single-link dwelling chain, measured footprint edge to edge.
- 141⅓-amah merge only between qualifying settlements; a lone dwelling gets only 70⅔.
- Three-villages rule, including the 2,000/4,000-amah conditions.
- Shape-aware rectangle/trapezoid/world-direction *ribua* and square-cornered 2,000-amah techum.
- Rotatable 4,000 × 4,000-amah point-mode square outside a city.
- Overlapping squared rectangles do not automatically merge in the public default. The
  advanced choices calculate R' Shlomo Miller's joined stepped union or the expansive
  recursive joint redraw rather than treating them as a binary label.
- A confirmed bow/L endpoint pair changes the calculation; an unconfirmed material pocket
  remains a visibly provisional no-fill result.
- Multi-region starting areas remain multi-region on the map and in KML/KMZ/GeoJSON.
- R' Chaim Naeh 48 cm is the MB/Ashkenazi and Mechaber profile default; Chazon Ish is
  57.6 cm. Alternate results are labeled scenarios, not automatically lenient/stringent.

For each rejected rule, please give the exact replacement and whether it is universal,
community-specific, or only a selectable alternative. Defaults are changed only by a dated,
append-only spec revision.

## How to review one calculated address

1. Confirm the pin and actual dwelling on current imagery.
2. Turn on the advanced calculation view. Inspect every outer-edge and bridge building;
   orange/unknown use and manual overrides deserve priority.
3. Inspect each 70⅔-amah bridge. Borderline gaps should be checked against better imagery or
   survey data; mapping error of a few meters can flip the chain.
4. Confirm which clusters qualify as independent cities before relying on a 141⅓ merge.
5. Inspect overlap, three-villages, concavity/bow, data-limit, and stale-data warnings.
6. Confirm the *ribua* orientation, karpef setting, amah profile, and the home settlement.
7. Compare the ordinary and verified-dwellings-only scenarios. Neither is guaranteed to be
   the correct, larger, smaller, lenient, or stringent result.
8. Save the input snapshot and export KML/GeoJSON with the config. Record the rav's decision
   separately until an approval/signature workflow exists.

## What the software does not establish

It does not prove that OSM is complete, that a mapped building is a halachic dwelling, that
six footprints equal three qualifying courtyards, that a community eruv is *hukaf l'dira*,
or that an automatically detected bow/hole mask identifies the halachically correct factual
endpoints. It also does
not replace the *mumcheh* required for techum measurement (MB 399:7).

## Source lookup order

For a short review, start with SA OC 398 (especially the bow, 70⅔, 141⅓, three-villages,
city-minimum, and squaring se'ifim), SA OC 399 and Eruvin 55a–58b. Then check MB 398:21,
398:36, 398:38 and 399:7. The profile-specific questions point to Chazon Ish OC 39 and
110, Igros Moshe OC 1:136, and Minchas Yitzchak 8:33. Pinpoint/source-quality gaps are
listed in `HALACHA-AUDIT.md`; secondary summaries should not substitute for the rav's
preferred editions.

## Sign-off record

- Rav / *mumcheh*:
- Community/minhag:
- Date:
- Spec revision reviewed:
- Address/snapshot reviewed (if any):
- Accepted defaults:
- Required changes:
- Sources or written notes attached:
- Approved for: research only / community guidance / named map only / other:

