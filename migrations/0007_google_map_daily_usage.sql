CREATE TABLE IF NOT EXISTS google_map_daily_usage (
  usage_date TEXT PRIMARY KEY,
  load_count INTEGER NOT NULL DEFAULT 0 CHECK (load_count >= 0)
);
