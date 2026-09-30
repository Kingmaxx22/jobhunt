INSERT OR IGNORE INTO feeds (slug, name, url, type, enabled)
VALUES ('arbeitnow', 'Arbeitnow (remote only)', 'https://www.arbeitnow.com/api/job-board-api', 'api', 1);
INSERT OR IGNORE INTO feeds (slug, name, url, type, enabled)
VALUES ('wwr-programming', 'WWR Programming', 'https://weworkremotely.com/categories/remote-programming-jobs.rss', 'rss', 1);
INSERT OR IGNORE INTO feeds (slug, name, url, type, enabled)
VALUES ('greenhouse-gitlab', 'GitLab', 'https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=false', 'api', 1);
INSERT OR IGNORE INTO feeds (slug, name, url, type, enabled)
VALUES ('greenhouse-anthropic', 'Anthropic', 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs?content=false', 'api', 1);
