-- Flexible per-day business schedules + document archive audit.
-- Keeps legacy business_days/open/close columns for compatibility while business_schedule
-- becomes the richer source for day-specific operating hours.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_schedule jsonb;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS business_schedule jsonb;

UPDATE organizations
SET business_schedule = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'day', d.day,
      'enabled', d.day = ANY(organizations.business_days),
      'openTime', left(organizations.business_open_time::text,5),
      'closeTime', left(organizations.business_close_time::text,5)
    )
    ORDER BY d.day
  )
  FROM generate_series(1,7) AS d(day)
)
WHERE business_schedule IS NULL;

UPDATE sites
SET business_schedule = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'day', d.day,
      'enabled', d.day = ANY(sites.business_days),
      'openTime', left(sites.business_open_time::text,5),
      'closeTime', left(sites.business_close_time::text,5)
    )
    ORDER BY d.day
  )
  FROM generate_series(1,7) AS d(day)
)
WHERE business_schedule IS NULL;

ALTER TABLE organizations
  ALTER COLUMN business_schedule SET DEFAULT
    '[{"day":1,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":2,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":3,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":4,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":5,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":6,"enabled":false,"openTime":"08:00","closeTime":"18:00"},{"day":7,"enabled":false,"openTime":"08:00","closeTime":"18:00"}]'::jsonb;

ALTER TABLE sites
  ALTER COLUMN business_schedule SET DEFAULT
    '[{"day":1,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":2,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":3,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":4,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":5,"enabled":true,"openTime":"08:00","closeTime":"18:00"},{"day":6,"enabled":false,"openTime":"08:00","closeTime":"18:00"},{"day":7,"enabled":false,"openTime":"08:00","closeTime":"18:00"}]'::jsonb;

ALTER TABLE organizations
  ALTER COLUMN business_schedule SET NOT NULL;

ALTER TABLE sites
  ALTER COLUMN business_schedule SET NOT NULL;

ALTER TABLE organization_documents
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS organization_documents_archived_idx
  ON organization_documents(organization_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
