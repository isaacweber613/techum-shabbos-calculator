-- Static Maps (PNG/PDF export) requests share the Pacific-day row with map loads.
ALTER TABLE google_map_daily_usage ADD COLUMN static_count INTEGER NOT NULL DEFAULT 0 CHECK (static_count >= 0);

-- One Telegram alert per Google limit kind per Pacific day.
CREATE TABLE IF NOT EXISTS google_limit_alerts (
  usage_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('map', 'static')),
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (usage_date, kind)
);
