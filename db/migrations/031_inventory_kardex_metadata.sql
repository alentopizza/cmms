-- Extend inventory warehouses and Kardex metadata for spreadsheet-driven operations.
ALTER TABLE inventory_warehouses
  ADD COLUMN IF NOT EXISTS location_detail text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS cost_center text;

CREATE INDEX IF NOT EXISTS inventory_transactions_lot_idx
  ON inventory_transactions(organization_id,item_id,lot_number)
  WHERE lot_number IS NOT NULL;
