-- Bulk imports, inventory catalogs/warehouses and auditable Kardex movements.

CREATE TABLE IF NOT EXISTS inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'storage',
  responsible text,
  capacity numeric(16,3),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS inventory_warehouses_org_site_idx
  ON inventory_warehouses(organization_id,site_id,active);

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES inventory_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS presentation text,
  ADD COLUMN IF NOT EXISTS max_quantity numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_data bytea,
  ADD COLUMN IF NOT EXISTS image_mime_type text,
  ADD COLUMN IF NOT EXISTS image_file_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS inventory_items_category_idx
  ON inventory_items(organization_id,category_id);
CREATE INDEX IF NOT EXISTS inventory_items_warehouse_idx
  ON inventory_items(organization_id,warehouse_id);

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS image_data bytea,
  ADD COLUMN IF NOT EXISTS image_mime_type text,
  ADD COLUMN IF NOT EXISTS image_file_name text;

CREATE TABLE IF NOT EXISTS inventory_stock_levels (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES inventory_warehouses(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  max_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (max_quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id,warehouse_id)
);

CREATE INDEX IF NOT EXISTS inventory_stock_levels_warehouse_idx
  ON inventory_stock_levels(organization_id,warehouse_id,item_id);

-- Create a deterministic legacy warehouse for current inventory positions.
INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name,type)
SELECT DISTINCT
  i.organization_id,
  i.site_id,
  i.location_id,
  'MIG-' || upper(substr(md5(
    i.organization_id::text || '|' || COALESCE(i.site_id::text,'') || '|' ||
    COALESCE(i.location_id::text,'') || '|' || COALESCE(i.storage_location,'')
  ),1,12)),
  COALESCE(NULLIF(i.storage_location,''),'Almacén principal'),
  'storage'
FROM inventory_items i
WHERE i.site_id IS NOT NULL
ON CONFLICT (organization_id,code) DO NOTHING;

UPDATE inventory_items i
SET warehouse_id=w.id
FROM inventory_warehouses w
WHERE i.warehouse_id IS NULL
  AND w.organization_id=i.organization_id
  AND w.code='MIG-' || upper(substr(md5(
    i.organization_id::text || '|' || COALESCE(i.site_id::text,'') || '|' ||
    COALESCE(i.location_id::text,'') || '|' || COALESCE(i.storage_location,'')
  ),1,12));

INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity)
SELECT i.organization_id,i.id,i.warehouse_id,GREATEST(i.quantity,0),GREATEST(i.min_quantity,0),GREATEST(i.max_quantity,0)
FROM inventory_items i
WHERE i.warehouse_id IS NOT NULL
ON CONFLICT (item_id,warehouse_id) DO NOTHING;

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_warehouse_id uuid REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS movement_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS source_row integer;

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_type_check
  CHECK (type IN ('receipt','issue','adjustment','return','transfer'));

CREATE INDEX IF NOT EXISTS inventory_transactions_item_movement_idx
  ON inventory_transactions(item_id,movement_at DESC);
CREATE INDEX IF NOT EXISTS inventory_transactions_warehouse_idx
  ON inventory_transactions(organization_id,warehouse_id,movement_at DESC);

CREATE TABLE IF NOT EXISTS bulk_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  entity text NOT NULL,
  file_name text NOT NULL,
  file_hash text NOT NULL,
  status text NOT NULL DEFAULT 'validated',
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  warning_rows integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  CONSTRAINT bulk_import_batches_entity_check CHECK (entity IN ('inventory','assets')),
  CONSTRAINT bulk_import_batches_status_check CHECK (status IN ('validated','committed','rejected'))
);

CREATE INDEX IF NOT EXISTS bulk_import_batches_org_idx
  ON bulk_import_batches(organization_id,entity,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bulk_import_batches_committed_hash_idx
  ON bulk_import_batches(organization_id,entity,file_hash)
  WHERE status='committed';

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_import_batch_id_fkey;
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_import_batch_id_fkey
  FOREIGN KEY (import_batch_id) REFERENCES bulk_import_batches(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION cmms_apply_inventory_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_qty numeric(14,3);
  delta numeric(14,3);
BEGIN
  IF NEW.warehouse_id IS NULL THEN
    SELECT warehouse_id INTO NEW.warehouse_id FROM inventory_items WHERE id=NEW.item_id;
  END IF;
  IF NEW.warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Inventory transaction requires a warehouse';
  END IF;

  IF NEW.type IN ('receipt','return') THEN
    delta := abs(NEW.quantity);
  ELSIF NEW.type='issue' THEN
    delta := -abs(NEW.quantity);
  ELSIF NEW.type='adjustment' THEN
    delta := NEW.quantity;
  ELSIF NEW.type='transfer' THEN
    delta := -abs(NEW.quantity);
    IF NEW.destination_warehouse_id IS NULL OR NEW.destination_warehouse_id=NEW.warehouse_id THEN
      RAISE EXCEPTION 'Transfer requires a different destination warehouse';
    END IF;
  END IF;

  SELECT COALESCE(quantity,0) INTO current_qty
  FROM inventory_stock_levels
  WHERE item_id=NEW.item_id AND warehouse_id=NEW.warehouse_id;

  IF COALESCE(current_qty,0)+delta < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory stock for movement';
  END IF;

  INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity)
  SELECT NEW.organization_id,NEW.item_id,NEW.warehouse_id,delta,i.min_quantity,i.max_quantity
  FROM inventory_items i WHERE i.id=NEW.item_id
  ON CONFLICT(item_id,warehouse_id) DO UPDATE SET
    quantity=inventory_stock_levels.quantity+EXCLUDED.quantity,
    updated_at=now();

  IF NEW.type='transfer' THEN
    INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity)
    SELECT NEW.organization_id,NEW.item_id,NEW.destination_warehouse_id,abs(NEW.quantity),i.min_quantity,i.max_quantity
    FROM inventory_items i WHERE i.id=NEW.item_id
    ON CONFLICT(item_id,warehouse_id) DO UPDATE SET
      quantity=inventory_stock_levels.quantity+EXCLUDED.quantity,
      updated_at=now();
  END IF;

  UPDATE inventory_items i SET
    quantity=COALESCE((SELECT sum(s.quantity) FROM inventory_stock_levels s WHERE s.item_id=i.id),0),
    unit_cost=CASE WHEN NEW.unit_cost IS NOT NULL AND NEW.type IN ('receipt','return','adjustment') THEN NEW.unit_cost ELSE i.unit_cost END,
    warehouse_id=COALESCE(i.warehouse_id,NEW.warehouse_id),
    updated_at=now()
  WHERE i.id=NEW.item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_transactions_apply_stock ON inventory_transactions;
CREATE TRIGGER inventory_transactions_apply_stock
AFTER INSERT ON inventory_transactions
FOR EACH ROW EXECUTE FUNCTION cmms_apply_inventory_transaction();
