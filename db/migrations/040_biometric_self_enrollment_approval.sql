-- Employee-initiated biometric enrollment with one-time human approval.
-- Raw enrollment photos are never retained as permanent evidence. A small
-- encrypted preview may exist only while a request is pending and expires.

ALTER TABLE user_biometric_profiles
  DROP CONSTRAINT IF EXISTS user_biometric_profiles_enrollment_method_check;

ALTER TABLE user_biometric_profiles
  ADD CONSTRAINT user_biometric_profiles_enrollment_method_check
  CHECK (enrollment_method IN ('legacy_self_camera','supervised_camera','self_camera_approved'));

ALTER TABLE biometric_enrollment_events
  DROP CONSTRAINT IF EXISTS biometric_enrollment_events_type_check,
  DROP CONSTRAINT IF EXISTS biometric_enrollment_events_method_check;

ALTER TABLE biometric_enrollment_events
  ADD CONSTRAINT biometric_enrollment_events_type_check
    CHECK (event_type IN ('requested','approved','rejected','expired','enrolled','reenrolled','revoked')),
  ADD CONSTRAINT biometric_enrollment_events_method_check
    CHECK (enrollment_method IS NULL OR enrollment_method IN ('legacy_self_camera','supervised_camera','self_camera_approved'));

CREATE TABLE IF NOT EXISTS attendance_biometric_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_biometric_policy_version_positive CHECK (version > 0),
  CONSTRAINT attendance_biometric_policy_title_length CHECK (char_length(title) BETWEEN 8 AND 180),
  CONSTRAINT attendance_biometric_policy_body_length CHECK (char_length(body) BETWEEN 80 AND 12000),
  UNIQUE (organization_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_biometric_policy_one_active_idx
  ON attendance_biometric_policy_versions(organization_id)
  WHERE active=true;

INSERT INTO attendance_biometric_policy_versions(organization_id,version,title,body,active)
SELECT
  organization.id,
  1,
  'Autorización para tratamiento de datos biométricos',
  'La organización utiliza una plantilla matemática derivada de una captura facial en vivo para validar identidad y presencia dentro del módulo de Asistencia. La captura de enrolamiento se procesa para generar la plantilla biométrica y no se conserva como fotografía permanente. El sistema puede usar geolocalización, geocerca, prueba de vida y mecanismos anti-suplantación durante el enrolamiento y las marcaciones. La plantilla se almacena cifrada y se utiliza únicamente para los fines de control de presencia configurados por la organización. Puedes solicitar información, revocación o reenrolamiento a los responsables autorizados de tu organización. Al continuar confirmas que pudiste leer esta información y autorizas expresamente el tratamiento descrito.',
  true
FROM organizations organization
WHERE NOT EXISTS(
  SELECT 1
  FROM attendance_biometric_policy_versions existing
  WHERE existing.organization_id=organization.id
);

CREATE TABLE IF NOT EXISTS biometric_enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  policy_version_id uuid NOT NULL REFERENCES attendance_biometric_policy_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  encrypted_embedding bytea,
  encrypted_preview bytea,
  preview_mime text,
  preview_expires_at timestamptz,
  consented_at timestamptz NOT NULL DEFAULT now(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_m double precision NOT NULL,
  distance_m double precision NOT NULL,
  liveness_method text NOT NULL DEFAULT 'active_challenge_v1',
  challenge_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biometric_enrollment_request_status_check
    CHECK (status IN ('pending','approved','rejected','cancelled','expired')),
  CONSTRAINT biometric_enrollment_request_preview_mime_check
    CHECK (preview_mime IS NULL OR preview_mime IN ('image/jpeg','image/png')),
  CONSTRAINT biometric_enrollment_request_location_check
    CHECK (accuracy_m >= 0 AND distance_m >= 0),
  CONSTRAINT biometric_enrollment_request_note_length
    CHECK (review_note IS NULL OR char_length(review_note) <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS biometric_enrollment_one_pending_per_user_idx
  ON biometric_enrollment_requests(organization_id,user_id)
  WHERE status='pending';

CREATE INDEX IF NOT EXISTS biometric_enrollment_requests_org_status_idx
  ON biometric_enrollment_requests(organization_id,status,requested_at DESC);

CREATE INDEX IF NOT EXISTS biometric_enrollment_requests_user_idx
  ON biometric_enrollment_requests(user_id,requested_at DESC);
