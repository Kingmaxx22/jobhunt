-- Job sources
CREATE TABLE feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('rss', 'api')),
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Normalized jobs
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    feed_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    description TEXT,
    url TEXT NOT NULL,
    location TEXT,
    employment_type TEXT,
    salary_min REAL,
    salary_max REAL,
    salary_currency TEXT,
    published_at TEXT,
    discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_to_telegram INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (feed_id) REFERENCES feeds(id)
);

CREATE INDEX idx_jobs_feed_id
    ON jobs(feed_id);

CREATE INDEX idx_jobs_published_at
    ON jobs(published_at);

CREATE INDEX idx_jobs_sent_to_telegram
    ON jobs(sent_to_telegram);

CREATE INDEX idx_jobs_company
    ON jobs(company);

CREATE INDEX idx_jobs_location
    ON jobs(location);
