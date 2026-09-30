-- Per-user attendance control overrides.
-- General policy remains role-based in organization_attendance_policies.enabled_roles.
-- This table only stores explicit exceptions for individual organization members.

CREATE TABLE IF NOT EXISTS user_attendance_control_overrides (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  reason text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id),
  CONSTRAINT user_attendance_control_membership_fk
    FOREIGN KEY (organization_id,user_id)
    REFERENCES organization_members(organization_id,user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_attendance_control_overrides_org_idx
  ON user_attendance_control_overrides(organization_id,enabled,updated_at DESC);
