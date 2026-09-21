-- Company Profile v2: legal/contact profile and governed corporate documents.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tax_id_type text,
  ADD COLUMN IF NOT EXISTS legal_address text,
  ADD COLUMN IF NOT EXISTS legal_city text,
  ADD COLUMN IF NOT EXISTS legal_country varchar(2),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS admin_email text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_title text,
  ADD COLUMN IF NOT EXISTS primary_contact_phone text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

CREATE TABLE IF NOT EXISTS organization_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  requirement_level text NOT NULL DEFAULT 'optional',
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_document_category_check
    CHECK (category IN ('tax','legal','contract','privacy','insurance','certification','other')),
  CONSTRAINT organization_document_requirement_check
    CHECK (requirement_level IN ('required','optional','not_applicable')),
  CONSTRAINT organization_document_file_check
    CHECK (
      (file_data IS NULL AND file_mime_type IS NULL AND file_name IS NULL AND file_size_bytes IS NULL)
      OR
      (file_data IS NOT NULL AND file_mime_type IS NOT NULL AND file_name IS NOT NULL AND file_size_bytes IS NOT NULL)
    ),
  CONSTRAINT organization_document_not_applicable_file_check
    CHECK (requirement_level <> 'not_applicable' OR file_data IS NULL)
);

CREATE INDEX IF NOT EXISTS organization_documents_org_idx
  ON organization_documents(organization_id, archived_at, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_documents_expiry_idx
  ON organization_documents(organization_id, expires_at)
  WHERE archived_at IS NULL AND expires_at IS NOT NULL;
