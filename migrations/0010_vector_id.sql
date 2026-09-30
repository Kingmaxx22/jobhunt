ALTER TABLE jobs ADD COLUMN vector_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_vector_id ON jobs(vector_id);
