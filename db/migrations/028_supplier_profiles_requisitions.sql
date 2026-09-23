-- Supplier profile + supplier-scoped requisitions.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS logo_data bytea,
  ADD COLUMN IF NOT EXISTS logo_mime_type text,
  ADD COLUMN IF NOT EXISTS logo_file_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  display_name text NOT NULL,
  reference text,
  issue_date date,
  expires_at date,
  notes text,
  file_data bytea,
  file_mime_type text,
  file_name text,
  file_size_bytes bigint,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  archived_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_document_category_check CHECK (category IN ('tax','legal','contract','insurance','certification','catalog','quote','other'))
);

CREATE INDEX IF NOT EXISTS supplier_documents_supplier_idx
  ON supplier_documents(supplier_id,archived_at,created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  number bigint GENERATED ALWAYS AS IDENTITY,
  status text NOT NULL DEFAULT 'draft',
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  needed_by date,
  notes text,
  sent_at timestamptz,
  approved_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_requisition_status_check
    CHECK (status IN ('draft','sent','approved','rejected','partial','fulfilled','closed','cancelled'))
);

CREATE INDEX IF NOT EXISTS supplier_requisitions_org_idx
  ON supplier_requisitions(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_requisitions_supplier_idx
  ON supplier_requisitions(supplier_id,created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES supplier_requisitions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  sku text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL,
  quantity_requested numeric(14,3) NOT NULL CHECK (quantity_requested > 0),
  quantity_received numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost_estimated numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost_estimated >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisition_id,inventory_item_id)
);

CREATE INDEX IF NOT EXISTS supplier_requisition_items_req_idx
  ON supplier_requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS supplier_requisition_items_inventory_idx
  ON supplier_requisition_items(inventory_item_id);
