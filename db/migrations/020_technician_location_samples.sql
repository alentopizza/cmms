-- Base GPS sample history used by Attendance/Reaction.
-- This migration intentionally precedes 021_reaction_tracking_sessions.sql.
-- 021 adds the Reaction session foreign key and relaxes attendance linkage.

CREATE TABLE IF NOT EXISTS technician_location_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_shift_id uuid NOT NULL REFERENCES attendance_shifts(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_m double precision,
  heading_deg double precision,
  speed_mps double precision,
  source text NOT NULL DEFAULT 'attendance',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technician_location_sample_lat_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT technician_location_sample_lon_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT technician_location_sample_accuracy_check CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  CONSTRAINT technician_location_sample_heading_check CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
  CONSTRAINT technician_location_sample_speed_check CHECK (speed_mps IS NULL OR speed_mps >= 0)
);

CREATE INDEX IF NOT EXISTS technician_location_samples_org_time_idx
  ON technician_location_samples(organization_id,recorded_at DESC);

CREATE INDEX IF NOT EXISTS technician_location_samples_user_time_idx
  ON technician_location_samples(user_id,recorded_at DESC);

CREATE INDEX IF NOT EXISTS technician_location_samples_attendance_shift_idx
  ON technician_location_samples(attendance_shift_id,recorded_at);
