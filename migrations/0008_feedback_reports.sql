CREATE TABLE IF NOT EXISTS feedback_reports (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  reporter_email TEXT,
  description TEXT NOT NULL,
  page_url TEXT NOT NULL,
  screenshot_key TEXT,
  diagnostics TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'planned', 'done', 'archived')),
  updated_at INTEGER NOT NULL,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_status_created
  ON feedback_reports(status, created_at DESC);
