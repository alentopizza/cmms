-- Make biometric attendance operational by default for organizations that
-- have never configured an attendance policy. Explicit existing disabled
-- policies are intentionally preserved.

ALTER TABLE organization_attendance_policies
  ALTER COLUMN enabled SET DEFAULT true,
  ALTER COLUMN enabled_roles SET DEFAULT ARRAY['admin','manager','technician','provider','external']::text[];

INSERT INTO organization_attendance_policies(
  organization_id,
  enabled,
  enabled_roles,
  require_face,
  require_geolocation,
  max_location_accuracy_m,
  face_similarity_threshold,
  liveness_threshold,
  updated_at
)
SELECT
  o.id,
  true,
  ARRAY['admin','manager','technician','provider','external']::text[],
  true,
  true,
  120,
  0.55,
  0.60,
  now()
FROM organizations o
LEFT JOIN organization_attendance_policies p ON p.organization_id=o.id
WHERE p.organization_id IS NULL;
