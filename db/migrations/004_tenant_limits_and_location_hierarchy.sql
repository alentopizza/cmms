-- Resource entitlements assigned by the super administrator.
CREATE TABLE IF NOT EXISTS organization_limits (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_sites integer NOT NULL DEFAULT 5 CHECK (max_sites >= 1),
  max_sublocations integer NOT NULL DEFAULT 100 CHECK (max_sublocations >= 0),
  max_assets integer NOT NULL DEFAULT 500 CHECK (max_assets >= 0),
  max_inventory_items integer NOT NULL DEFAULT 1000 CHECK (max_inventory_items >= 0),
  max_technicians integer NOT NULL DEFAULT 50 CHECK (max_technicians >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO organization_limits(organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

-- A site is the top-level physical location. This recursive table contains
-- every area below it: floor, department, room, zone, etc.
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES locations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text,
  type text NOT NULL DEFAULT 'area',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, site_id, code)
);

CREATE INDEX IF NOT EXISTS locations_org_site_idx ON locations(organization_id, site_id);
CREATE INDEX IF NOT EXISTS locations_parent_idx ON locations(parent_id);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assets_location_idx ON assets(location_id);
CREATE INDEX IF NOT EXISTS work_orders_location_idx ON work_orders(location_id);
CREATE INDEX IF NOT EXISTS inventory_items_location_idx ON inventory_items(location_id);
