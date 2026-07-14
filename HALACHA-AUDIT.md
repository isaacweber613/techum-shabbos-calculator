# Halacha/spec implementation audit — 2026-07-14 (Rev. 14)

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
  city treatment; later practical literature records a 50-resident basis. The program's
  six-footprint threshold is explicitly only a provisional proxy, with structured
  basis/evidence review.
- SA HaRav 398:12 states that the middle village is within 2000 amos of both outers, is
  lowered between them, and may join outer villages more than 4000 amos apart when it fits:
  https://www.chabad.org/library/article_cdo/aid/4051111/jewish/Shulchan-Aruch-Chapter-398-The-Laws-Governing-How-the-2000-Cubits-of-the-Shabbos-Limits-are-Measured.htm
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
- Point shevisa, the inclusive/no-4000-cap three-villages construction, overlaps, concavity
  warnings, and deterministic snapshots have golden/behavioral coverage.

## Remaining review conditions (not hidden engine gaps)

1. City status begins with a labelled provisional six-footprint proxy. The rav-facing
   per-component review records three-courtyard, 50-resident, other attested, or negative
   status plus factual evidence, and preserves it in snapshots/audits.
2. Real-city bow/L endpoints are factual reviewer input. Until supplied, the app now uses
   a labelled smaller no-fill geometry; supplied endpoints alter the boundary according to
   the selected sourced rule.
3. Modern beis-dirah classification and hukaf-l'dirah facts cannot be inferred from map
   tags. Offices, commercial/industrial structures, and factories now require review rather
   than categorical exclusion. Per-building overrides, missing footprints, validated city
   enclosures, and zero-house validated residential joining perimeters support that review.
4. Ir muvla'at is destination/path-specific. The universal map detects candidate swallowed
   cities but deliberately does not invent one unsupported two-dimensional extension.
5. The Va'ad's 2023 Woodbourne source is reproduced exactly as a published vector-output
   fixture. It validates the published result, not the undisclosed factual inputs or
   intermediate construction; geographic registration and reviewed input parity remain.

## UI audit outcome

The advanced display now uses the same engine result as the ordinary map and exposes exact
footprints, 70⅔-amah reach contours, chain colors/numbers, every derived settlement rectangle,
the selected home settlement, and numeric 70⅔/141⅓ thresholds. It does not claim that these
visual aids resolve dwelling status, courtyards, bow endpoints, or other flagged judgments.

