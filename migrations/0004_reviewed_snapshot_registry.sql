CREATE TABLE IF NOT EXISTS reviewed_snapshots (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  city_label TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  snapshot_sha256 TEXT NOT NULL CHECK (length(snapshot_sha256) = 64),
  reviewer_name TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  review_decision TEXT NOT NULL CHECK (review_decision IN ('approved','approved-with-conditions')),
  review_conditions TEXT,
  source_notes TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published','withdrawn')),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  withdrawn_at INTEGER,
  withdrawn_by TEXT,
  withdrawal_reason TEXT,
  UNIQUE(slug, revision)
);
CREATE INDEX IF NOT EXISTS reviewed_snapshots_public ON reviewed_snapshots(status, slug, revision DESC);
