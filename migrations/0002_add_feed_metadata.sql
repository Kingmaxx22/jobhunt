ALTER TABLE feeds ADD COLUMN slug TEXT;
ALTER TABLE feeds ADD COLUMN config TEXT;
ALTER TABLE feeds ADD COLUMN last_fetched_at TEXT;
ALTER TABLE feeds ADD COLUMN last_success_at TEXT;
ALTER TABLE feeds ADD COLUMN last_error TEXT;

CREATE UNIQUE INDEX idx_feeds_slug
    ON feeds(slug);
