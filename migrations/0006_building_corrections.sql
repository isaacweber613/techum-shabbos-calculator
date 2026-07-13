CREATE TABLE IF NOT EXISTS building_corrections (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('include','exclude')),
  geometry_json TEXT,
  south REAL NOT NULL,
  west REAL NOT NULL,
  north REAL NOT NULL,
  east REAL NOT NULL,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected')),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS building_corrections_bbox
  ON building_corrections(status, south, north, west, east, created_at DESC);
CREATE INDEX IF NOT EXISTS building_corrections_source
  ON building_corrections(status, source_id, created_at DESC);
