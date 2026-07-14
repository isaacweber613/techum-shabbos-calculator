# Techum calculator TODO

This list separates confirmed software defects from halachic/data validation work. A rav-produced map is a benchmark, not by itself a replacement for the derivation recorded in `TECHUM-SPEC.md`.

## Completed

- [x] Fix the calculation overlay so its numbered settlement rectangles are the final settlements after 141⅓-amah and three-villages merges, rather than stale pre-merge components.
- [x] Fix city-status review controls so they edit the original 70⅔-amah qualification components that actually participate in the merge calculation.
- [x] Add regression coverage that preserves the distinction between qualification components and final settlements.
- [x] Correct ribua orientation: preserve a high-confidence existing rectangle in its own direction, use world directions for irregular shapes, and record the method and angle in the audit/export.
- [x] Obtain the issuing Va'ad Le'Tchum Shabbos 2023 Woodbourne PDF, fingerprint it, and
  digitize its exact green city-ribua and pink techum vector paths, profile/date/issuer, and
  stated road checkpoints as a tested published-output fixture.
- [x] Correct the three-villages construction to SA HaRav 398:12: inclusive 2000-amah
  middle-to-outer distances, projected fit with 141⅓-amah residual gaps, and no independent
  4000-amah outer-span cap.
- [x] Separate the actual city-status bases (three courtyards × two houses, 50 residents,
  or rav attestation) from the provisional six-roof automatic proxy and preserve evidence.

## High priority

- [ ] Va'ad Le'Tchum Shabbos **method parity**: obtain the Woodbourne/Fallsburg survey
  record or a measurer's explanation, then build a rav-reviewed geographic input snapshot.
  The published output is now reproduced exactly, but it does not disclose ribua
  orientation, overlap joining/redraw, rivers/highways, eligible structures, courtyard
  evidence, karpef, or bow endpoints. Do not label the 94% rectangularity heuristic—or the
  exact output digitization—as hidden-method parity.
- [ ] Determine and document the exact psak/construction behind Woodbourne's stepped green
  and pink polygons. The engine can now reproduce stepped unions through the sourced
  `join-no-redraw` approach, but do not claim that the photographed Va'ad map used that
  shita until its survey record or guide confirms it.
- [ ] Geographically register the Woodbourne source-page vectors and compare them against a
  reviewed calculator snapshot. Multi-rectangle/stepped-boundary output is already
  implemented; select it for Woodbourne only if the survey record confirms that shita.
- [ ] Digitize the supplied Belz/Woodridge map and compare the R' Chaim Naeh and Chazon Ish final boundaries at its four stated road/address checkpoints.
- [ ] Add an on-map diagnostic that measures the closest real footprint-to-footprint gap when a user taps a settlement edge, so a nearby roof cannot be confused with the straight ribua line.

## Data quality

- [ ] Continue spot-checking Overture completeness against current satellite imagery in rural Sullivan County.
- [ ] Add a reviewed-city benchmark registry containing the source image, date, profile, boundary geometry, and reviewer notes without presenting it as automatic psak.
