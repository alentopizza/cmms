-- Fix negative stock deltas in Kardex trigger.
-- PostgreSQL validates CHECK constraints on the proposed INSERT row before
-- executing ON CONFLICT, so inserting a negative delta directly cannot reach
-- the conflict update even when stock already exists. Seed negative candidates
-- with zero and apply the signed delta only in the conflict update.

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
