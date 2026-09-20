-- Multi-site access for organization users.
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS access_all_sites boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS organization_member_sites (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, site_id),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_members(organization_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS organization_member_sites_user_idx
  ON organization_member_sites(user_id);

CREATE INDEX IF NOT EXISTS organization_member_sites_site_idx
  ON organization_member_sites(site_id);

-- Preserve the previous single-site assignment semantics.
INSERT INTO organization_member_sites(organization_id,user_id,site_id)
SELECT organization_id,user_id,site_id
FROM organization_members
WHERE site_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE organization_members
SET access_all_sites = (site_id IS NULL);
