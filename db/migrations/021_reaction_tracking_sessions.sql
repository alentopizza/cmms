-- Reaction tracking sessions independent from attendance shifts.
-- A technician is tracked while their operational app session is connected.
-- Attendance linkage remains optional metadata for correlation/reporting.

CREATE TABLE IF NOT EXISTS technician_tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_latitude double precision,
  last_longitude double precision,
  last_accuracy_m double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technician_tracking_session_status_check CHECK (status IN ('active','closed')),
  CONSTRAINT technician_tracking_session_lat_check CHECK (last_latitude IS NULL OR last_latitude BETWEEN -90 AND 90),
  CONSTRAINT technician_tracking_session_lon_check CHECK (last_longitude IS NULL OR last_longitude BETWEEN -180 AND 180),
  CONSTRAINT technician_tracking_session_accuracy_check CHECK (last_accuracy_m IS NULL OR last_accuracy_m >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS technician_tracking_one_active_per_user
  ON technician_tracking_sessions(user_id)
  WHERE status='active';

CREATE INDEX IF NOT EXISTS technician_tracking_sessions_org_status_idx
  ON technician_tracking_sessions(organization_id,status,last_seen_at DESC);

ALTER TABLE technician_location_samples
  ALTER COLUMN attendance_shift_id DROP NOT NULL;

ALTER TABLE technician_location_samples
  ADD COLUMN IF NOT EXISTS tracking_session_id uuid REFERENCES technician_tracking_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS technician_location_samples_tracking_session_idx
  ON technician_location_samples(tracking_session_id,recorded_at);
