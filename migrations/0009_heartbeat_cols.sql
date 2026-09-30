ALTER TABLE cron_runs ADD COLUMN heartbeat_sent INTEGER DEFAULT 0;
ALTER TABLE cron_runs ADD COLUMN heartbeat_error TEXT;
