-- Tenant-scoped learned aliases for safe asset import reconciliation.
-- Stores only confirmed mapping decisions; it never renames canonical records.

CREATE TABLE IF NOT EXISTS asset_import_resolution_aliases (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resolution_key text NOT NULL,
  target_id uuid NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,resolution_key)
);

CREATE INDEX IF NOT EXISTS asset_import_resolution_aliases_target_idx
  ON asset_import_resolution_aliases(organization_id,target_id);
