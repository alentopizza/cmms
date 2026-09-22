-- Audited biometric/geolocation contingency workflow.
-- A contingency never establishes biometric identity. It can only authorize
-- one attendance event for an already supervised/verified user.

ALTER TABLE attendance_shifts
  ADD COLUMN IF NOT EXISTS check_in_verification_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS check_out_verification_mode text,
  ADD COLUMN IF NOT EXISTS check_in_contingency_id uuid,
  ADD COLUMN IF NOT EXISTS check_out_contingency_id uuid;

ALTER TABLE attendance_shifts
  DROP CONSTRAINT IF EXISTS attendance_shift_check_in_verification_mode_check,
  DROP CONSTRAINT IF EXISTS attendance_shift_check_out_verification_mode_check;

ALTER TABLE attendance_shifts
  ADD CONSTRAINT attendance_shift_check_in_verification_mode_check
    CHECK (check_in_verification_mode IN ('standard','contingency')),
  ADD CONSTRAINT attendance_shift_check_out_verification_mode_check
    CHECK (check_out_verification_mode IS NULL OR check_out_verification_mode IN ('standard','contingency'));

CREATE TABLE IF NOT EXISTS attendance_contingency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  action text NOT NULL,
  reason_code text NOT NULL,
  details text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  requester_latitude double precision,
  requester_longitude double precision,
  requester_accuracy_m double precision,
  diagnostic jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  approved_until timestamptz,
  used_at timestamptz,
  attendance_shift_id uuid REFERENCES attendance_shifts(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_contingency_action_check CHECK (action IN ('check_in','check_out')),
  CONSTRAINT attendance_contingency_reason_check CHECK (
    reason_code IN ('camera_failure','gps_unavailable','gps_accuracy','geofence_mismatch','connectivity','device_issue','other')
  ),
  CONSTRAINT attendance_contingency_status_check CHECK (
    status IN ('pending','approved','rejected','used','expired','cancelled')
  ),
  CONSTRAINT attendance_contingency_details_check CHECK (char_length(details) BETWEEN 8 AND 1000)
);

ALTER TABLE attendance_shifts
  DROP CONSTRAINT IF EXISTS attendance_shifts_check_in_contingency_fk,
  DROP CONSTRAINT IF EXISTS attendance_shifts_check_out_contingency_fk;

ALTER TABLE attendance_shifts
  ADD CONSTRAINT attendance_shifts_check_in_contingency_fk
    FOREIGN KEY(check_in_contingency_id) REFERENCES attendance_contingency_requests(id) ON DELETE SET NULL,
  ADD CONSTRAINT attendance_shifts_check_out_contingency_fk
    FOREIGN KEY(check_out_contingency_id) REFERENCES attendance_contingency_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS attendance_contingency_org_status_idx
  ON attendance_contingency_requests(organization_id,status,requested_at DESC);

CREATE INDEX IF NOT EXISTS attendance_contingency_user_idx
  ON attendance_contingency_requests(user_id,requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_contingency_one_pending_per_action
  ON attendance_contingency_requests(user_id,action)
  WHERE status IN ('pending','approved');
