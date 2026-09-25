-- Performance hot paths confirmed by the Users directory query audit.
-- These indexes target existing per-user EXISTS lookups used for activity
-- counters and delete-safety checks. PostgreSQL does not auto-index FKs.

CREATE INDEX IF NOT EXISTS meter_readings_recorded_by_idx
  ON meter_readings(recorded_by)
  WHERE recorded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_order_comments_user_idx
  ON work_order_comments(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_user_idx
  ON audit_log(user_id)
  WHERE user_id IS NOT NULL;
