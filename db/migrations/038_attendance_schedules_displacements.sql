-- User attendance schedules, multi-site journey state and auditable displacements.
-- A shift keeps its original site for compatibility, while current/check-out site
-- and displacement rows preserve where the technician actually moved during the day.

CREATE TABLE IF NOT EXISTS user_attendance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Jornada principal',
  weekly_schedule jsonb NOT NULL,
  grace_before_minutes integer NOT NULL DEFAULT 15,
  grace_after_minutes integer NOT NULL DEFAULT 15,
  active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_until date,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_attendance_schedule_grace_before_check CHECK (grace_before_minutes BETWEEN 0 AND 240),
  CONSTRAINT user_attendance_schedule_grace_after_check CHECK (grace_after_minutes BETWEEN 0 AND 240),
  CONSTRAINT user_attendance_schedule_dates_check CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from),
  UNIQUE(organization_id,user_id)
);

CREATE INDEX IF NOT EXISTS user_attendance_schedules_org_active_idx
  ON user_attendance_schedules(organization_id,active,user_id);

ALTER TABLE attendance_shifts
  ADD COLUMN IF NOT EXISTS current_site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS check_out_site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS attendance_schedule_id uuid REFERENCES user_attendance_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_snapshot jsonb;

UPDATE attendance_shifts
SET current_site_id=site_id
WHERE current_site_id IS NULL;

CREATE TABLE IF NOT EXISTS attendance_displacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attendance_shift_id uuid NOT NULL REFERENCES attendance_shifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  from_site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  to_site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'in_transit',
  departed_at timestamptz NOT NULL DEFAULT now(),
  arrived_at timestamptz,
  departure_latitude double precision,
  departure_longitude double precision,
  departure_accuracy_m double precision,
  departure_distance_m double precision,
  arrival_latitude double precision,
  arrival_longitude double precision,
  arrival_accuracy_m double precision,
  arrival_distance_m double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_displacement_status_check CHECK (status IN ('in_transit','arrived','cancelled')),
  CONSTRAINT attendance_displacement_sites_check CHECK (from_site_id <> to_site_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_displacement_one_open_per_shift
  ON attendance_displacements(attendance_shift_id)
  WHERE status='in_transit';

CREATE INDEX IF NOT EXISTS attendance_displacements_org_time_idx
  ON attendance_displacements(organization_id,departed_at DESC);

CREATE INDEX IF NOT EXISTS attendance_displacements_user_time_idx
  ON attendance_displacements(user_id,departed_at DESC);
