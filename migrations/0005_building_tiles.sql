-- Shared OSM building tile cache metadata (payloads live in R2).
-- Tiles are fixed-degree cells; clients request a bbox and the Worker unions tiles.

CREATE TABLE IF NOT EXISTS building_tiles (
  tile_key TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  building_count INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL
);

-- Global one-fill-per-second gate for Overpass (same pattern as geocode_slots).
CREATE TABLE IF NOT EXISTS building_fill_slots (
  second INTEGER PRIMARY KEY
);

CREATE INDEX IF NOT EXISTS idx_building_tiles_fetched ON building_tiles(fetched_at);
