ALTER TABLE job_matches ADD COLUMN lane TEXT NOT NULL DEFAULT 'career';
CREATE INDEX IF NOT EXISTS idx_matches_notified_score ON job_matches(notified, match_score);
