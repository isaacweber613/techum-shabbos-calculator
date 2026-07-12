# Halacha/spec implementation audit — 2026-07-12

Status: engineering and source-consistency review, not a psak. A rav/mumcheh must validate
the halachic choices and any real-city result.

## Bottom line

The engine's central geometry agrees with the cited dinim: qualifying structures chain at
70⅔ amos; qualifying settlements merge at 141⅓ amos; a city and its techum are squared;
the techum extends 2000 amos from each side; the 4×4-amah minimum and bow/three-villages
rules are represented. The permanent draft warning is appropriate.

Primary-source cross-checks:

- SA OC 398:4–8 states the bow tests, 70⅔-amah dwelling chain, 141⅓-amah town merge, and
  three-villages rule: https://www.sefaria.org/Shulchan_Arukh%2C_Orach_Chayim.398
- SA OC 398:10 requires three courtyards of two permanent houses for encampments to receive
  city treatment; the program's six-footprint threshold is explicitly only an approximation.
- SA OC 398:11 and Eruvin 56a describe the squared techum and filled corners:
  https://www.sefaria.org/Shulchan_Arukh%2C_Orach_Chayim.398.11 and
  https://www.sefaria.org/Eruvin.56

## Matches between spec and code

- All distances scale from the selected amah.
- Footprint-to-footprint distance, not centroid distance, drives the 70⅔-amah chain.
- The 141⅓ merge only applies to clusters meeting the configured city minimum.
- Ribua and the 2000-amah techum are rectangles with filled square corners.
- Karpef, orientation, overlapping rectangles, ambiguous buildings, and alternate amah
  scenarios remain visible settings or warnings.
- Point shevisa, three villages, overlaps, concavity warnings, and deterministic snapshots
  have golden/behavioral coverage.

## Material gaps requiring follow-up

1. `TECHUM-SPEC.md` Part 3 describes some planned features as present: automatic snapping
   of a geocode to a footprint, Overture fallback, a confidence indicator, manual bow
   endpoint designation, and printable PDF. The current site has none of these.
2. The pipeline prose says UTM/azimuthal projection with convergence correction; the code
   uses a local true-north tangent/equirectangular projection. It is internally consistent
   and tested locally, but the spec should describe the actual projection and its quantified
   metropolitan-scale error bound.
3. `includeUnknown` and `includeReview` default on, while Part 3.0 says uncertainty is
   decided conservatively in simple view. Inclusion is not uniformly conservative because
   it can enlarge or topologically change the city. The verified-only scenario helps, but
   the wording should be “two uncertainty scenarios,” not conservative/certain.
4. The bow rule remains detection-and-warning only. This is correctly disclosed in Part 2,
   but Part 3.2 still says “fill bows/Ls,” which overstates the implementation.
5. City status is a footprint-count proxy for the sourced courtyard/entrance model. This is
   the largest modeled-halacha approximation after dwelling classification and requires a
   rav-facing per-cluster override before this can be considered a complete expert tool.
6. The source list is strong but several contemporary conclusions (eruv perimeter,
   orientation, karpef-after-ibur, and modern building predicates) should be converted into
   pinpoint citations or attached teshuvah excerpts reviewed by the project's rav.

## UI audit outcome

The advanced display now uses the same engine result as the ordinary map and exposes exact
footprints, 70⅔-amah reach contours, chain colors/numbers, every derived settlement rectangle,
the selected home settlement, and numeric 70⅔/141⅓ thresholds. It does not claim that these
visual aids resolve dwelling status, courtyards, bow endpoints, or other flagged judgments.

