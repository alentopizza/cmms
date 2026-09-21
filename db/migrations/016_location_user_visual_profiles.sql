-- Rich visual profiles for physical locations and users.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS image_data bytea,
  ADD COLUMN IF NOT EXISTS image_mime_type text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS image_data bytea,
  ADD COLUMN IF NOT EXISTS image_mime_type text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_data bytea,
  ADD COLUMN IF NOT EXISTS avatar_mime_type text;
