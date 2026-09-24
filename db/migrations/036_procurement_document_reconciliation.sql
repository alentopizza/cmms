-- Phase 5 procurement: immutable commercial documents and reconciliation evidence.

CREATE TABLE IF NOT EXISTS procurement_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  requisition_id uuid NOT NULL REFERENCES supplier_requisitions(id) ON DELETE RESTRICT,
  document_type text NOT NULL
    CHECK (document_type IN ('purchase_order','delivery_note','invoice','credit_note','other')),
  document_number text NOT NULL,
  issue_date date,
  currency_code text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes text,
  file_data bytea NOT NULL,
  file_mime_type text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','verified','exception_accepted','disputed')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  voided_at timestamptz,
  voided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  void_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_documents_requisition_idx
  ON procurement_documents(requisition_id,voided_at,created_at DESC);
CREATE INDEX IF NOT EXISTS procurement_documents_supplier_idx
  ON procurement_documents(supplier_id,voided_at,created_at DESC);
CREATE INDEX IF NOT EXISTS procurement_documents_review_idx
  ON procurement_documents(organization_id,review_status,created_at DESC);

CREATE TABLE IF NOT EXISTS procurement_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES procurement_documents(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL REFERENCES supplier_requisition_items(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id,requisition_item_id)
);

CREATE INDEX IF NOT EXISTS procurement_document_lines_document_idx
  ON procurement_document_lines(document_id);
CREATE INDEX IF NOT EXISTS procurement_document_lines_req_item_idx
  ON procurement_document_lines(requisition_item_id,created_at DESC);

CREATE TABLE IF NOT EXISTS procurement_document_receipts (
  document_id uuid NOT NULL REFERENCES procurement_documents(id) ON DELETE RESTRICT,
  receipt_transaction_id uuid NOT NULL REFERENCES inventory_transactions(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id,receipt_transaction_id)
);

CREATE INDEX IF NOT EXISTS procurement_document_receipts_receipt_idx
  ON procurement_document_receipts(receipt_transaction_id);

CREATE TABLE IF NOT EXISTS procurement_document_returns (
  document_id uuid NOT NULL REFERENCES procurement_documents(id) ON DELETE RESTRICT,
  supplier_return_id uuid NOT NULL REFERENCES supplier_returns(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id,supplier_return_id)
);

CREATE INDEX IF NOT EXISTS procurement_document_returns_return_idx
  ON procurement_document_returns(supplier_return_id);

CREATE TABLE IF NOT EXISTS procurement_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES procurement_documents(id) ON DELETE RESTRICT,
  action text NOT NULL
    CHECK (action IN ('uploaded','verified','exception_accepted','disputed','voided')),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_label text NOT NULL DEFAULT 'Sistema',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_document_events_document_idx
  ON procurement_document_events(document_id,created_at DESC);

CREATE OR REPLACE FUNCTION cmms_validate_procurement_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM supplier_requisitions r
    WHERE r.id=NEW.requisition_id
      AND r.organization_id=NEW.organization_id
      AND r.supplier_id=NEW.supplier_id
  ) THEN
    RAISE EXCEPTION 'Procurement document requisition/supplier scope mismatch';
  END IF;
  IF length(trim(NEW.document_number))=0 THEN
    RAISE EXCEPTION 'Procurement document number is required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_documents_validate ON procurement_documents;
CREATE TRIGGER procurement_documents_validate
BEFORE INSERT ON procurement_documents
FOR EACH ROW EXECUTE FUNCTION cmms_validate_procurement_document();

CREATE OR REPLACE FUNCTION cmms_guard_procurement_document_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
     OR OLD.requisition_id IS DISTINCT FROM NEW.requisition_id
     OR OLD.document_type IS DISTINCT FROM NEW.document_type
     OR OLD.document_number IS DISTINCT FROM NEW.document_number
     OR OLD.issue_date IS DISTINCT FROM NEW.issue_date
     OR OLD.currency_code IS DISTINCT FROM NEW.currency_code
     OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
     OR OLD.tax_total IS DISTINCT FROM NEW.tax_total
     OR OLD.total IS DISTINCT FROM NEW.total
     OR OLD.notes IS DISTINCT FROM NEW.notes
     OR OLD.file_data IS DISTINCT FROM NEW.file_data
     OR OLD.file_mime_type IS DISTINCT FROM NEW.file_mime_type
     OR OLD.file_name IS DISTINCT FROM NEW.file_name
     OR OLD.file_size_bytes IS DISTINCT FROM NEW.file_size_bytes
     OR OLD.created_by IS DISTINCT FROM NEW.created_by
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Procurement document evidence is immutable';
  END IF;
  IF OLD.voided_at IS NOT NULL AND (
       OLD.review_status IS DISTINCT FROM NEW.review_status
       OR OLD.review_notes IS DISTINCT FROM NEW.review_notes
       OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
       OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
       OR OLD.voided_at IS DISTINCT FROM NEW.voided_at
       OR OLD.voided_by IS DISTINCT FROM NEW.voided_by
       OR OLD.void_reason IS DISTINCT FROM NEW.void_reason
     ) THEN
    RAISE EXCEPTION 'Voided procurement document is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_documents_update_guard ON procurement_documents;
CREATE TRIGGER procurement_documents_update_guard
BEFORE UPDATE ON procurement_documents
FOR EACH ROW EXECUTE FUNCTION cmms_guard_procurement_document_update();

CREATE OR REPLACE FUNCTION cmms_procurement_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Procurement document evidence rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS procurement_documents_delete_guard ON procurement_documents;
CREATE TRIGGER procurement_documents_delete_guard
BEFORE DELETE ON procurement_documents
FOR EACH ROW EXECUTE FUNCTION cmms_procurement_evidence_immutable();

DROP TRIGGER IF EXISTS procurement_document_lines_immutable ON procurement_document_lines;
CREATE TRIGGER procurement_document_lines_immutable
BEFORE UPDATE OR DELETE ON procurement_document_lines
FOR EACH ROW EXECUTE FUNCTION cmms_procurement_evidence_immutable();

DROP TRIGGER IF EXISTS procurement_document_receipts_immutable ON procurement_document_receipts;
CREATE TRIGGER procurement_document_receipts_immutable
BEFORE UPDATE OR DELETE ON procurement_document_receipts
FOR EACH ROW EXECUTE FUNCTION cmms_procurement_evidence_immutable();

DROP TRIGGER IF EXISTS procurement_document_returns_immutable ON procurement_document_returns;
CREATE TRIGGER procurement_document_returns_immutable
BEFORE UPDATE OR DELETE ON procurement_document_returns
FOR EACH ROW EXECUTE FUNCTION cmms_procurement_evidence_immutable();

DROP TRIGGER IF EXISTS procurement_document_events_immutable ON procurement_document_events;
CREATE TRIGGER procurement_document_events_immutable
BEFORE UPDATE OR DELETE ON procurement_document_events
FOR EACH ROW EXECUTE FUNCTION cmms_procurement_evidence_immutable();

CREATE OR REPLACE FUNCTION cmms_validate_procurement_document_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc procurement_documents%ROWTYPE;
  req_item supplier_requisition_items%ROWTYPE;
BEGIN
  SELECT * INTO doc FROM procurement_documents WHERE id=NEW.document_id;
  SELECT * INTO req_item FROM supplier_requisition_items WHERE id=NEW.requisition_item_id;

  IF doc.id IS NULL OR req_item.id IS NULL
     OR doc.voided_at IS NOT NULL
     OR doc.organization_id<>NEW.organization_id
     OR req_item.organization_id<>NEW.organization_id
     OR req_item.requisition_id<>doc.requisition_id
     OR req_item.sku<>NEW.sku THEN
    RAISE EXCEPTION 'Procurement document line relation mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_document_lines_validate ON procurement_document_lines;
CREATE TRIGGER procurement_document_lines_validate
BEFORE INSERT ON procurement_document_lines
FOR EACH ROW EXECUTE FUNCTION cmms_validate_procurement_document_line();

CREATE OR REPLACE FUNCTION cmms_validate_procurement_receipt_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc procurement_documents%ROWTYPE;
  receipt inventory_transactions%ROWTYPE;
BEGIN
  SELECT * INTO doc FROM procurement_documents WHERE id=NEW.document_id;
  SELECT * INTO receipt FROM inventory_transactions WHERE id=NEW.receipt_transaction_id;

  IF doc.id IS NULL OR receipt.id IS NULL
     OR doc.voided_at IS NOT NULL
     OR doc.document_type NOT IN ('delivery_note','invoice')
     OR doc.organization_id<>NEW.organization_id
     OR receipt.organization_id<>NEW.organization_id
     OR receipt.type<>'receipt'
     OR receipt.requisition_id<>doc.requisition_id THEN
    RAISE EXCEPTION 'Procurement receipt evidence relation mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_document_receipts_validate ON procurement_document_receipts;
CREATE TRIGGER procurement_document_receipts_validate
BEFORE INSERT ON procurement_document_receipts
FOR EACH ROW EXECUTE FUNCTION cmms_validate_procurement_receipt_link();

CREATE OR REPLACE FUNCTION cmms_validate_procurement_return_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc procurement_documents%ROWTYPE;
  ret supplier_returns%ROWTYPE;
BEGIN
  SELECT * INTO doc FROM procurement_documents WHERE id=NEW.document_id;
  SELECT * INTO ret FROM supplier_returns WHERE id=NEW.supplier_return_id;

  IF doc.id IS NULL OR ret.id IS NULL
     OR doc.voided_at IS NOT NULL
     OR doc.document_type<>'credit_note'
     OR doc.organization_id<>NEW.organization_id
     OR ret.organization_id<>NEW.organization_id
     OR ret.requisition_id<>doc.requisition_id
     OR ret.supplier_id<>doc.supplier_id THEN
    RAISE EXCEPTION 'Procurement return evidence relation mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_document_returns_validate ON procurement_document_returns;
CREATE TRIGGER procurement_document_returns_validate
BEFORE INSERT ON procurement_document_returns
FOR EACH ROW EXECUTE FUNCTION cmms_validate_procurement_return_link();
