-- Phase 2: versioned individual attendance/work schedules.
-- Schedules are effective-dated evidence. They describe expected working time
-- but do not block real attendance events; actual vs scheduled comparison is
-- intentionally deferred to reporting.
--
-- Company/Site schedules are copied as snapshots into business_schedule.
-- Later changes to Company/Site hours must never rewrite a person's historical
-- schedule silently.

CREATE TABLE IF NOT EXISTS user_attendance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  schedule_source text NOT NULL DEFAULT 'custom',
  source_site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  business_schedule jsonb NOT NULL,
  timezone text NOT NULL,
  effective_from date NOT NULL,
  effective_until date,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_attendance_schedules_source_check
    CHECK (schedule_source IN ('organization','site','custom')),
  CONSTRAINT user_attendance_schedules_source_site_check
    CHECK (schedule_source='site' OR source_site_id IS NULL),
  CONSTRAINT user_attendance_schedules_date_check
    CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CONSTRAINT user_attendance_schedules_json_check
    CHECK (jsonb_typeof(business_schedule)='array'),
  CONSTRAINT user_attendance_schedules_membership_fk
    FOREIGN KEY (organization_id,user_id)
    REFERENCES organization_members(organization_id,user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_attendance_schedules_user_effective_idx
  ON user_attendance_schedules(organization_id,user_id,effective_from DESC,effective_until);

CREATE INDEX IF NOT EXISTS user_attendance_schedules_site_effective_idx
  ON user_attendance_schedules(organization_id,base_site_id,effective_from DESC);

CREATE INDEX IF NOT EXISTS user_attendance_schedules_current_idx
  ON user_attendance_schedules(organization_id,user_id,effective_from,effective_until)
  WHERE effective_until IS NULL;
