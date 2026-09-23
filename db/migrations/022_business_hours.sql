-- Business hours for organizations and principal sites.
-- Existing records receive a safe editable default: Monday-Friday 08:00-18:00.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  ADD COLUMN IF NOT EXISTS business_open_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_close_time time NOT NULL DEFAULT '18:00';

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS business_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  ADD COLUMN IF NOT EXISTS business_open_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_close_time time NOT NULL DEFAULT '18:00';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_business_days_check,
  DROP CONSTRAINT IF EXISTS organizations_business_hours_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_business_days_check
    CHECK (
      cardinality(business_days) > 0
      AND business_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
    ),
  ADD CONSTRAINT organizations_business_hours_check
    CHECK (business_open_time < business_close_time);

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_business_days_check,
  DROP CONSTRAINT IF EXISTS sites_business_hours_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_business_days_check
    CHECK (
      cardinality(business_days) > 0
      AND business_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
    ),
  ADD CONSTRAINT sites_business_hours_check
    CHECK (business_open_time < business_close_time);
