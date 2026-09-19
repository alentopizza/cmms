ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_data bytea,
  ADD COLUMN IF NOT EXISTS logo_mime_type text,
  ADD COLUMN IF NOT EXISTS logo_file_name text,
  ADD COLUMN IF NOT EXISTS cover_data bytea,
  ADD COLUMN IF NOT EXISTS cover_mime_type text,
  ADD COLUMN IF NOT EXISTS cover_file_name text;
