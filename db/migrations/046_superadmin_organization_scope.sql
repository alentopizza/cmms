-- Scope Superadministrators to an explicit portfolio of customer organizations.
-- Platform Owner remains unrestricted. Tenant roles continue to use organization_members.

CREATE TABLE IF NOT EXISTS platform_organization_access (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_source text NOT NULL DEFAULT 'assigned',
  granted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,organization_id),
  CONSTRAINT platform_organization_access_source_check
    CHECK (access_source IN ('created','assigned'))
);

CREATE INDEX IF NOT EXISTS platform_organization_access_organization_idx
  ON platform_organization_access(organization_id,user_id);

-- Existing Superadministrators intentionally receive no implicit organizations.
-- The Platform Owner must explicitly assign legacy customer organizations.
