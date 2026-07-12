CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('visit','search','calc','export','snapshot')),
  vid TEXT NOT NULL,
  payload TEXT NOT NULL,
  country TEXT,
  colo TEXT,
  network_id TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS events_t ON events(t);
CREATE INDEX IF NOT EXISTS events_type_t ON events(type, t);

CREATE TABLE IF NOT EXISTS daily_totals (
  day TEXT PRIMARY KEY,
  visits INTEGER NOT NULL DEFAULT 0,
  searches INTEGER NOT NULL DEFAULT 0,
  calcs INTEGER NOT NULL DEFAULT 0,
  exports INTEGER NOT NULL DEFAULT 0,
  snapshots INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visitors (
  vid TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  country TEXT
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS geocode_slots (
  second INTEGER PRIMARY KEY
);
