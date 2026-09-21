-- Biometric attendance, geofencing and activity execution evidence.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 250;

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_geofence_radius_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_geofence_radius_check
  CHECK (geofence_radius_m BETWEEN 20 AND 5000);

CREATE TABLE IF NOT EXISTS organization_attendance_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  enabled_roles text[] NOT NULL DEFAULT ARRAY['technician','external','provider']::text[],
  require_face boolean NOT NULL DEFAULT true,
  require_geolocation boolean NOT NULL DEFAULT true,
  max_location_accuracy_m integer NOT NULL DEFAULT 120,
  face_similarity_threshold double precision NOT NULL DEFAULT 0.55,
  liveness_threshold double precision NOT NULL DEFAULT 0.60,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_accuracy_check CHECK (max_location_accuracy_m BETWEEN 10 AND 1000),
  CONSTRAINT attendance_face_similarity_check CHECK (face_similarity_threshold BETWEEN 0.30 AND 0.95),
  CONSTRAINT attendance_liveness_check CHECK (liveness_threshold BETWEEN 0.30 AND 0.99)
);

CREATE TABLE IF NOT EXISTS user_biometric_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  encrypted_embedding bytea NOT NULL,
  embedding_version text NOT NULL DEFAULT 'human-faceres-3.3.6',
  consented_at timestamptz NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_biometric_profiles_org_idx
  ON user_biometric_profiles(organization_id, revoked_at);

CREATE TABLE IF NOT EXISTS attendance_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open',
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy_m double precision,
  check_in_distance_m double precision,
  check_in_face_similarity double precision,
  check_in_liveness double precision,
  check_in_antispoof double precision,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_out_accuracy_m double precision,
  check_out_distance_m double precision,
  check_out_face_similarity double precision,
  check_out_liveness double precision,
  check_out_antispoof double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_shift_status_check CHECK (status IN ('open','closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_shift_one_open_per_user
  ON attendance_shifts(user_id)
  WHERE status='open';

CREATE INDEX IF NOT EXISTS attendance_shifts_org_time_idx
  ON attendance_shifts(organization_id, check_in_at DESC);

CREATE INDEX IF NOT EXISTS attendance_shifts_user_time_idx
  ON attendance_shifts(user_id, check_in_at DESC);

CREATE TABLE IF NOT EXISTS activity_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES work_order_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  attendance_shift_id uuid REFERENCES attendance_shifts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  within_shift boolean NOT NULL DEFAULT false,
  within_site_geofence boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_execution_event_type_check CHECK (event_type IN ('started','completed','status_update'))
);

CREATE INDEX IF NOT EXISTS activity_execution_events_org_time_idx
  ON activity_execution_events(organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS activity_execution_events_user_time_idx
  ON activity_execution_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS activity_execution_events_task_idx
  ON activity_execution_events(task_id, occurred_at);
