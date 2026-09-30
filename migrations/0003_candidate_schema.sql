CREATE TABLE IF NOT EXISTS candidate_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cv_text TEXT NOT NULL,
  preferences_json TEXT, 
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS job_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  profile_id INTEGER NOT NULL,
  match_score REAL NOT NULL,
  match_explanation TEXT,
  notified INTEGER DEFAULT 0,
  user_feedback TEXT, -- 'apply', 'skip', 'save'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(job_id) REFERENCES jobs(id),
  FOREIGN KEY(profile_id) REFERENCES candidate_profiles(id),
  UNIQUE(job_id, profile_id)
);
