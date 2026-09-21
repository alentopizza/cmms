-- Enforce the operational setup sequence and support outsourced service execution.

-- Suppliers can provide goods, services, or both.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS supplier_type text NOT NULL DEFAULT 'materials',
  ADD COLUMN IF NOT EXISTS service_category text;

ALTER TABLE suppliers
  DROP CONSTRAINT IF EXISTS suppliers_supplier_type_check;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_supplier_type_check
  CHECK (supplier_type IN ('materials','services','both'));

-- Assets must be linked to a supplier for all new records created by the application.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assets_supplier_idx ON assets(supplier_id);

-- External collaborators belong to the organization but are linked to a service provider.
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS external_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('admin','manager','technician','requester','viewer','provider','external'));

CREATE INDEX IF NOT EXISTS organization_members_external_supplier_idx
  ON organization_members(organization_id, external_supplier_id);

-- Stable technician/external crews.
CREATE TABLE IF NOT EXISTS crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  leader_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS crew_members (
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, user_id)
);

CREATE INDEX IF NOT EXISTS crews_org_idx ON crews(organization_id, active);
CREATE INDEX IF NOT EXISTS crew_members_org_user_idx ON crew_members(organization_id, user_id);

-- Work may be assigned to an individual, crew, or service provider.
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS work_orders_crew_idx ON work_orders(crew_id);
CREATE INDEX IF NOT EXISTS work_orders_service_supplier_idx ON work_orders(service_supplier_id);

-- Activities are work-order tasks with their own executor and traceable lifecycle.
ALTER TABLE work_order_tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE work_order_tasks
  DROP CONSTRAINT IF EXISTS work_order_tasks_status_check;

ALTER TABLE work_order_tasks
  ADD CONSTRAINT work_order_tasks_status_check
  CHECK (status IN ('pending','in_progress','completed','cancelled'));

CREATE INDEX IF NOT EXISTS work_order_tasks_assigned_idx ON work_order_tasks(assigned_to,status);
CREATE INDEX IF NOT EXISTS work_order_tasks_crew_idx ON work_order_tasks(crew_id,status);
