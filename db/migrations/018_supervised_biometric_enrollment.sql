-- Supervised biometric enrollment and immutable enrollment audit trail.
-- Existing self-enrolled templates remain non-verified until a supervisor
-- performs a new live-camera enrollment.

ALTER TABLE user_biometric_profiles
  ALTER COLUMN encrypted_embedding DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS enrolled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_method text NOT NULL DEFAULT 'legacy_self_camera',
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

ALTER TABLE user_biometric_profiles
  DROP CONSTRAINT IF EXISTS user_biometric_profiles_enrollment_method_check;

ALTER TABLE user_biometric_profiles
  ADD CONSTRAINT user_biometric_profiles_enrollment_method_check
  CHECK (enrollment_method IN ('legacy_self_camera','supervised_camera'));

CREATE TABLE IF NOT EXISTS biometric_enrollment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  enrollment_method text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT biometric_enrollment_events_type_check
    CHECK (event_type IN ('enrolled','reenrolled','revoked')),
  CONSTRAINT biometric_enrollment_events_method_check
    CHECK (enrollment_method IS NULL OR enrollment_method IN ('legacy_self_camera','supervised_camera'))
);

CREATE INDEX IF NOT EXISTS biometric_enrollment_events_user_time_idx
  ON biometric_enrollment_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS biometric_enrollment_events_org_time_idx
  ON biometric_enrollment_events(organization_id, occurred_at DESC);
