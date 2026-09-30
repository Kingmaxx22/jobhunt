CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  fetched INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  filtered INTEGER DEFAULT 0,
  matched_career INTEGER DEFAULT 0,
  matched_easy INTEGER DEFAULT 0,
  notified INTEGER DEFAULT 0,
  error TEXT
);
