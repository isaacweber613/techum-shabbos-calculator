# Overture Maps comparison — implementation scope

Status: comparison engine implemented; live download and reviewer UI not connected.

## Safe role in this calculator

OpenStreetMap remains the sole automatic building input. Overture Maps can act as an
independent completeness check: a reviewer supplies a building GeoJSON extract, the app
compares its polygons with the fetched OSM polygons, and non-intersecting Overture
footprints become review candidates. They are never silently included in the halachic
calculation.

This distinction is important. A non-intersecting footprint is not proof that OSM omitted
a current building. It can reflect different imagery dates, demolition, construction,
geometry accuracy, or one dataset splitting a complex that the other treats as one.
Overture attributes also do not establish `beis dirah` status.

`TechumData.parseOvertureGeoJSON()` normalizes Polygon and MultiPolygon features while
preserving their Overture IDs and properties. `TechumData.compareBuildingSources()` makes
the deterministic polygon comparison and returns matched counts, unmatched review
candidates, and the mandatory limitations.

## Why there is no automatic browser fallback yet

Overture officially publishes global releases as GeoParquet in public AWS and Azure
object storage. Its documented bounding-box workflow uses the Overture Python client or
DuckDB to read those bulk files. It does not provide an official, no-key, browser-sized
GeoJSON bounding-box API that this static app can responsibly call.

A production live comparison therefore needs one of these explicitly operated options:

1. A Worker-accessible extraction service that queries the current Overture release and
   returns bounded, size-limited GeoJSON; or
2. Preprocessed regional tiles/GeoJSON stored in R2 and refreshed for each Overture
   release; or
3. A reviewer upload flow for an extract produced with the official CLI.

Option 3 preserves the current no-backend/no-key model and is the recommended first UI.
Options 1–2 create operational duties: release pinning, attribution/license metadata,
request and response limits, caching, geometry validation, and a recorded extract date.

## Reviewer workflow to finish

1. Add an advanced “Compare Overture extract” GeoJSON file input.
2. Display release/extract metadata and reject files without valid polygon geometry.
3. Show unmatched candidates on the map with confirm/reject controls.
4. A confirmed candidate must become an explicit manual building override with reviewer,
   timestamp, source ID, source release, and reason; never mutate the cached OSM input.
5. Include decisions and the original comparison report in snapshots and exports.
6. Re-run comparison when either OSM data or the Overture release changes.

## Official references

- Overture Maps, “Quick Start / Download by area of interest”:
  https://docs.overturemaps.org/getting-data/quick-start/
- Overture Maps data downloads and releases:
  https://docs.overturemaps.org/getting-data/
- Overture data license:
  https://docs.overturemaps.org/attribution/

