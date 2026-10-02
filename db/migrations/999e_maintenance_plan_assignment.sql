-- Assignment parity for preventive maintenance plans.
ALTER TABLE maintenance_plans
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maintenance_plans_assigned_idx
  ON maintenance_plans(assigned_to,active);
CREATE INDEX IF NOT EXISTS maintenance_plans_crew_idx
  ON maintenance_plans(crew_id,active);
CREATE INDEX IF NOT EXISTS maintenance_plans_supplier_idx
  ON maintenance_plans(service_supplier_id,active);
