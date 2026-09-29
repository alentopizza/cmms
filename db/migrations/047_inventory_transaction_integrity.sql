-- I2-A2.1: protect new manual inventory movements against duplicate requests
-- and enforce organization/item/warehouse consistency for new rows without
-- rewriting or deleting historical Kardex data.

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS manual_idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS manual_payload_hash text;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_manual_idempotency_pair_check
  CHECK (
    (manual_idempotency_key IS NULL AND manual_payload_hash IS NULL)
    OR
    (manual_idempotency_key IS NOT NULL
      AND manual_payload_hash IS NOT NULL
      AND manual_payload_hash ~ '^[0-9a-f]{64}$')
  ) NOT VALID;

ALTER TABLE inventory_transactions
  VALIDATE CONSTRAINT inventory_transactions_manual_idempotency_pair_check;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_manual_idempotency_idx
  ON inventory_transactions(organization_id,manual_idempotency_key)
  WHERE manual_idempotency_key IS NOT NULL;

-- Redundant with the UUID primary keys for uniqueness, but required as exact
-- referenced keys for organization-aware foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_id_org_idx
  ON inventory_items(id,organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouses_id_org_idx
  ON inventory_warehouses(id,organization_id);

-- NOT VALID preserves compatibility with historical/legacy rows while enforcing
-- the invariant for every new or changed relationship from this migration onward.
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_item_org_fkey
  FOREIGN KEY (item_id,organization_id)
  REFERENCES inventory_items(id,organization_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_warehouse_org_fkey
  FOREIGN KEY (warehouse_id,organization_id)
  REFERENCES inventory_warehouses(id,organization_id)
  NOT VALID;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_destination_warehouse_org_fkey
  FOREIGN KEY (destination_warehouse_id,organization_id)
  REFERENCES inventory_warehouses(id,organization_id)
  NOT VALID;

ALTER TABLE inventory_stock_levels
  ADD CONSTRAINT inventory_stock_levels_item_org_fkey
  FOREIGN KEY (item_id,organization_id)
  REFERENCES inventory_items(id,organization_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE inventory_stock_levels
  ADD CONSTRAINT inventory_stock_levels_warehouse_org_fkey
  FOREIGN KEY (warehouse_id,organization_id)
  REFERENCES inventory_warehouses(id,organization_id)
  NOT VALID;

-- Validate each new structural constraint only when the current historical data
-- is already compatible. Otherwise keep it NOT VALID: PostgreSQL still enforces
-- it for new/updated rows and deployment does not destructively rewrite history.
DO $$
DECLARE
  bad_tx_item bigint;
  bad_tx_wh bigint;
  bad_tx_dest bigint;
  bad_stock_item bigint;
  bad_stock_wh bigint;
BEGIN
  SELECT count(*) INTO bad_tx_item
  FROM inventory_transactions t
  JOIN inventory_items i ON i.id=t.item_id
  WHERE t.organization_id<>i.organization_id;

  SELECT count(*) INTO bad_tx_wh
  FROM inventory_transactions t
  JOIN inventory_warehouses w ON w.id=t.warehouse_id
  WHERE t.warehouse_id IS NOT NULL AND t.organization_id<>w.organization_id;

  SELECT count(*) INTO bad_tx_dest
  FROM inventory_transactions t
  JOIN inventory_warehouses w ON w.id=t.destination_warehouse_id
  WHERE t.destination_warehouse_id IS NOT NULL AND t.organization_id<>w.organization_id;

  SELECT count(*) INTO bad_stock_item
  FROM inventory_stock_levels s
  JOIN inventory_items i ON i.id=s.item_id
  WHERE s.organization_id<>i.organization_id;

  SELECT count(*) INTO bad_stock_wh
  FROM inventory_stock_levels s
  JOIN inventory_warehouses w ON w.id=s.warehouse_id
  WHERE s.organization_id<>w.organization_id;

  IF bad_tx_item=0 THEN
    EXECUTE 'ALTER TABLE inventory_transactions VALIDATE CONSTRAINT inventory_transactions_item_org_fkey';
  ELSE
    RAISE WARNING 'I2-A2.1 legacy audit: % transaction/item organization mismatches remain; constraint left NOT VALID',bad_tx_item;
  END IF;

  IF bad_tx_wh=0 THEN
    EXECUTE 'ALTER TABLE inventory_transactions VALIDATE CONSTRAINT inventory_transactions_warehouse_org_fkey';
  ELSE
    RAISE WARNING 'I2-A2.1 legacy audit: % transaction/source warehouse organization mismatches remain; constraint left NOT VALID',bad_tx_wh;
  END IF;

  IF bad_tx_dest=0 THEN
    EXECUTE 'ALTER TABLE inventory_transactions VALIDATE CONSTRAINT inventory_transactions_destination_warehouse_org_fkey';
  ELSE
    RAISE WARNING 'I2-A2.1 legacy audit: % transaction/destination warehouse organization mismatches remain; constraint left NOT VALID',bad_tx_dest;
  END IF;

  IF bad_stock_item=0 THEN
    EXECUTE 'ALTER TABLE inventory_stock_levels VALIDATE CONSTRAINT inventory_stock_levels_item_org_fkey';
  ELSE
    RAISE WARNING 'I2-A2.1 legacy audit: % stock/item organization mismatches remain; constraint left NOT VALID',bad_stock_item;
  END IF;

  IF bad_stock_wh=0 THEN
    EXECUTE 'ALTER TABLE inventory_stock_levels VALIDATE CONSTRAINT inventory_stock_levels_warehouse_org_fkey';
  ELSE
    RAISE WARNING 'I2-A2.1 legacy audit: % stock/warehouse organization mismatches remain; constraint left NOT VALID',bad_stock_wh;
  END IF;
END
$$;
