# Halacha/spec implementation audit — 2026-07-14 (Rev. 13)

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

## Remaining review conditions (not hidden engine gaps)

1. City status begins with a six-footprint proxy for the sourced three-courtyard model;
   the rav-facing per-component override is implemented and preserved in snapshots.
2. Real-city bow/L endpoints are factual reviewer input. Until supplied, the app now uses
   a labelled smaller no-fill geometry; supplied endpoints alter the boundary according to
   the selected sourced rule.
3. Modern beis-dirah classification and hukaf-l'dirah facts cannot be inferred from map
   tags. Per-building overrides, missing footprints, validated city enclosures, and
   zero-house validated residential joining perimeters are implemented for that review.
4. Ir muvla'at is destination/path-specific. The universal map detects candidate swallowed
   cities but deliberately does not invent one unsupported two-dimensional extension.

## UI audit outcome

The advanced display now uses the same engine result as the ordinary map and exposes exact
footprints, 70⅔-amah reach contours, chain colors/numbers, every derived settlement rectangle,
the selected home settlement, and numeric 70⅔/141⅓ thresholds. It does not claim that these
visual aids resolve dwelling status, courtyards, bow endpoints, or other flagged judgments.

