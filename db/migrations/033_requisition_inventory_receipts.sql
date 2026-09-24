-- Link physical inventory receipts to supplier requisitions for auditable purchasing/stock reconciliation.

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES supplier_requisitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requisition_item_id uuid REFERENCES supplier_requisition_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_transactions_requisition_idx
  ON inventory_transactions(requisition_id,requisition_item_id,movement_at DESC);
