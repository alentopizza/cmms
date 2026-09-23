-- Approved location profile details: zone/locality, responsible title and notes.
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS notes text;
