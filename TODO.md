# Techum calculator TODO

This list separates confirmed software defects from halachic/data validation work. A rav-produced map is a benchmark, not by itself a replacement for the derivation recorded in `TECHUM-SPEC.md`.

## Completed

- [x] Fix the calculation overlay so its numbered settlement rectangles are the final settlements after 141⅓-amah and three-villages merges, rather than stale pre-merge components.
- [x] Fix city-status review controls so they edit the original 70⅔-amah qualification components that actually participate in the merge calculation.
- [x] Add regression coverage that preserves the distinction between qualification components and final settlements.
- [x] Correct ribua orientation: preserve a high-confidence existing rectangle in its own direction, use world directions for irregular shapes, and record the method and angle in the audit/export.

## High priority

- [ ] Va'ad Le'Tchum Shabbos parity: obtain and document the Va'ad's actual Woodbourne/Fallsburg calculation method (not merely the printed outline), then add a reproducible snapshot benchmark. Confirm especially ribua orientation, overlapping-ribua joining/redraw, rivers/highways, eligible structures, karpef, and the Chazon Ish amah used. Do not label the 94% rectangularity heuristic as Va'ad parity.

- [ ] Digitize the supplied Woodbourne 2023 rav map as a benchmark: green city polygon, pink techum polygon, stated road/address crossings, map date, amah shita, and issuer.
- [ ] Determine and document the halachic construction behind Woodbourne's stepped green and pink polygons. The present engine deliberately produces one squared city rectangle and one expanded techum rectangle; it cannot reproduce this stepped union yet.
- [ ] After the construction is confirmed, add a Woodbourne golden geometry fixture and implement a reviewed multi-rectangle/stepped-boundary mode if the map represents the applicable shita.
- [ ] Digitize the supplied Belz/Woodridge map and compare the R' Chaim Naeh and Chazon Ish final boundaries at its four stated road/address checkpoints.
- [ ] Add an on-map diagnostic that measures the closest real footprint-to-footprint gap when a user taps a settlement edge, so a nearby roof cannot be confused with the straight ribua line.

## Data quality

- [ ] Continue spot-checking Overture completeness against current satellite imagery in rural Sullivan County.
- [ ] Add a reviewed-city benchmark registry containing the source image, date, profile, boundary geometry, and reviewer notes without presenting it as automatic psak.
