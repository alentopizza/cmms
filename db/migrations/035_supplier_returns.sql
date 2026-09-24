-- Phase 4 procurement: immutable supplier returns linked to requisition receipts and outbound Kardex movements.

CREATE TABLE IF NOT EXISTS supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  requisition_id uuid NOT NULL REFERENCES supplier_requisitions(id) ON DELETE RESTRICT,
  number bigint GENERATED ALWAYS AS IDENTITY,
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted')),
  reason_code text NOT NULL
    CHECK (reason_code IN ('damaged','wrong_item','quality','excess','other')),
  expected_resolution text NOT NULL DEFAULT 'replacement'
    CHECK (expected_resolution IN ('replacement','credit_note','other')),
  reason_detail text,
  document_number text,
  returned_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_returns_requisition_idx
  ON supplier_returns(requisition_id,returned_at DESC);
CREATE INDEX IF NOT EXISTS supplier_returns_supplier_idx
  ON supplier_returns(supplier_id,returned_at DESC);

CREATE TABLE IF NOT EXISTS supplier_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES supplier_returns(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL REFERENCES supplier_requisition_items(id) ON DELETE RESTRICT,
  receipt_transaction_id uuid NOT NULL REFERENCES inventory_transactions(id) ON DELETE RESTRICT,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES inventory_warehouses(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_return_items_return_idx
  ON supplier_return_items(return_id);
CREATE INDEX IF NOT EXISTS supplier_return_items_receipt_idx
  ON supplier_return_items(receipt_transaction_id,created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_return_items_requisition_item_idx
  ON supplier_return_items(requisition_item_id,created_at DESC);

CREATE OR REPLACE FUNCTION cmms_validate_supplier_return_item()
RETURNS trigger
LANGUAGE plpgsql
AS $
DECLARE
  receipt inventory_transactions%ROWTYPE;
  header supplier_returns%ROWTYPE;
  req_item supplier_requisition_items%ROWTYPE;
BEGIN
  SELECT * INTO receipt FROM inventory_transactions WHERE id=NEW.receipt_transaction_id;
  IF receipt.id IS NULL OR receipt.type<>'receipt' THEN
    RAISE EXCEPTION 'Supplier return requires a receipt source transaction';
  END IF;
  SELECT * INTO header FROM supplier_returns WHERE id=NEW.return_id;
  SELECT * INTO req_item FROM supplier_requisition_items WHERE id=NEW.requisition_item_id;

  IF header.id IS NULL OR req_item.id IS NULL
     OR header.organization_id<>NEW.organization_id
     OR req_item.organization_id<>NEW.organization_id
     OR header.requisition_id<>req_item.requisition_id
     OR receipt.organization_id<>NEW.organization_id
     OR receipt.requisition_id<>header.requisition_id
     OR receipt.requisition_item_id<>NEW.requisition_item_id
     OR receipt.item_id<>NEW.inventory_item_id THEN
    RAISE EXCEPTION 'Supplier return source relation mismatch';
  END IF;
  IF NEW.quantity>abs(receipt.quantity)+0.000001 THEN
    RAISE EXCEPTION 'Supplier return quantity exceeds source receipt';
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS supplier_return_items_validate ON supplier_return_items;
CREATE TRIGGER supplier_return_items_validate
BEFORE INSERT ON supplier_return_items
FOR EACH ROW EXECUTE FUNCTION cmms_validate_supplier_return_item();

CREATE OR REPLACE FUNCTION cmms_supplier_return_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $
BEGIN
  RAISE EXCEPTION 'Posted supplier returns are immutable';
END;
$;

DROP TRIGGER IF EXISTS supplier_returns_immutable ON supplier_returns;
CREATE TRIGGER supplier_returns_immutable
BEFORE UPDATE OR DELETE ON supplier_returns
FOR EACH ROW EXECUTE FUNCTION cmms_supplier_return_immutable();

DROP TRIGGER IF EXISTS supplier_return_items_immutable ON supplier_return_items;
CREATE TRIGGER supplier_return_items_immutable
BEFORE UPDATE OR DELETE ON supplier_return_items
FOR EACH ROW EXECUTE FUNCTION cmms_supplier_return_immutable();

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS supplier_return_id uuid REFERENCES supplier_returns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_return_item_id uuid REFERENCES supplier_return_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_transaction_id uuid REFERENCES inventory_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_transactions_supplier_return_idx
  ON inventory_transactions(supplier_return_id,supplier_return_item_id,movement_at DESC);
CREATE INDEX IF NOT EXISTS inventory_transactions_source_transaction_idx
  ON inventory_transactions(source_transaction_id);

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_type_check
  CHECK (type IN ('receipt','issue','adjustment','return','transfer','supplier_return'));

-- Supplier returns are outbound. Existing "return" remains an inbound return-to-stock movement.
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
  ELSIF NEW.type IN ('issue','supplier_return') THEN
    delta := -abs(NEW.quantity);
  ELSIF NEW.type='adjustment' THEN
    delta := NEW.quantity;
  ELSIF NEW.type='transfer' THEN
    delta := -abs(NEW.quantity);
    IF NEW.destination_warehouse_id IS NULL OR NEW.destination_warehouse_id=NEW.warehouse_id THEN
      RAISE EXCEPTION 'Transfer requires a different destination warehouse';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported inventory movement type: %', NEW.type;
  END IF;

  SELECT quantity INTO current_qty
  FROM inventory_stock_levels
  WHERE item_id=NEW.item_id AND warehouse_id=NEW.warehouse_id
  FOR UPDATE;

  IF COALESCE(current_qty,0)+delta < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory stock for movement';
  END IF;

  INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity)
  SELECT NEW.organization_id,NEW.item_id,NEW.warehouse_id,GREATEST(delta,0),i.min_quantity,i.max_quantity
  FROM inventory_items i WHERE i.id=NEW.item_id
  ON CONFLICT(item_id,warehouse_id) DO UPDATE SET
    quantity=inventory_stock_levels.quantity+delta,
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
