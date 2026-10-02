-- Tenant-scoped operational consecutives for Work Orders and Maintenance Routines.
-- Visible business numbers are independent per organization; UUIDs remain authoritative identifiers.

CREATE TABLE IF NOT EXISTS organization_operational_counters (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, entity_type),
  CHECK (entity_type IN ('work_order','routine'))
);

-- Work-order numbering was originally backed by one table-wide identity sequence.
-- The visible number is not used by foreign keys, so normalize historical display
-- numbers inside each organization while preserving UUID relationships and chronology.
ALTER TABLE work_orders
  ALTER COLUMN number DROP IDENTITY IF EXISTS;

DROP INDEX IF EXISTS work_orders_org_number_idx;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id
           ORDER BY requested_at ASC NULLS LAST, created_at ASC, id ASC
         )::bigint AS tenant_number
  FROM work_orders
)
UPDATE work_orders w
SET number = ranked.tenant_number
FROM ranked
WHERE ranked.id = w.id
  AND w.number IS DISTINCT FROM ranked.tenant_number;

ALTER TABLE work_orders
  ALTER COLUMN number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS work_orders_org_number_idx
  ON work_orders(organization_id, number);

-- Routines did not previously expose an organization-scoped business consecutive.
ALTER TABLE maintenance_plans
  ADD COLUMN IF NOT EXISTS number bigint;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id
           ORDER BY created_at ASC, id ASC
         )::bigint AS tenant_number
  FROM maintenance_plans
)
UPDATE maintenance_plans p
SET number = ranked.tenant_number
FROM ranked
WHERE ranked.id = p.id
  AND p.number IS DISTINCT FROM ranked.tenant_number;

ALTER TABLE maintenance_plans
  ALTER COLUMN number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_plans_org_number_idx
  ON maintenance_plans(organization_id, number);

INSERT INTO organization_operational_counters(organization_id, entity_type, last_value)
SELECT organization_id, 'work_order', COALESCE(max(number),0)
FROM work_orders
GROUP BY organization_id
ON CONFLICT (organization_id, entity_type)
DO UPDATE SET last_value=GREATEST(organization_operational_counters.last_value, EXCLUDED.last_value),
              updated_at=now();

INSERT INTO organization_operational_counters(organization_id, entity_type, last_value)
SELECT organization_id, 'routine', COALESCE(max(number),0)
FROM maintenance_plans
GROUP BY organization_id
ON CONFLICT (organization_id, entity_type)
DO UPDATE SET last_value=GREATEST(organization_operational_counters.last_value, EXCLUDED.last_value),
              updated_at=now();

CREATE OR REPLACE FUNCTION next_organization_operational_number(
  p_organization_id uuid,
  p_entity_type text
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required for operational numbering';
  END IF;

  IF p_entity_type NOT IN ('work_order','routine') THEN
    RAISE EXCEPTION 'Unsupported operational counter type: %', p_entity_type;
  END IF;

  INSERT INTO organization_operational_counters(organization_id, entity_type, last_value)
  VALUES (p_organization_id, p_entity_type, 1)
  ON CONFLICT (organization_id, entity_type)
  DO UPDATE SET last_value=organization_operational_counters.last_value + 1,
                updated_at=now()
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION assign_work_order_organization_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := next_organization_operational_number(NEW.organization_id, 'work_order');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_orders_assign_organization_number ON work_orders;
CREATE TRIGGER work_orders_assign_organization_number
BEFORE INSERT ON work_orders
FOR EACH ROW
EXECUTE FUNCTION assign_work_order_organization_number();

CREATE OR REPLACE FUNCTION assign_routine_organization_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := next_organization_operational_number(NEW.organization_id, 'routine');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maintenance_plans_assign_organization_number ON maintenance_plans;
CREATE TRIGGER maintenance_plans_assign_organization_number
BEFORE INSERT ON maintenance_plans
FOR EACH ROW
EXECUTE FUNCTION assign_routine_organization_number();
