-- Attendance operational Phase 4: multi-Site jornada segments.
-- attendance_shifts remains the single daily presence record. This table adds
-- ordered Site/travel segments so one jornada may move across authorized Sites
-- without closing/reopening attendance.
--
-- Reaction remains an independent live-tracking authority. A travel segment may
-- reference the active Reaction session for correlation, while its departure
-- and arrival evidence is stored directly in Attendance.

ALTER TABLE attendance_shifts
  ADD COLUMN IF NOT EXISTS check_out_site_id uuid REFERENCES sites(id) ON DELETE RESTRICT;

UPDATE attendance_shifts
SET check_out_site_id=site_id
WHERE status='closed' AND check_out_site_id IS NULL;

CREATE TABLE IF NOT EXISTS attendance_shift_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attendance_shift_id uuid NOT NULL REFERENCES attendance_shifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sequence integer NOT NULL CHECK (sequence > 0),
  segment_type text NOT NULL,
  site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  from_site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  to_site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  destination_task_id uuid REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  tracking_session_id uuid REFERENCES technician_tracking_sessions(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  start_latitude double precision,
  start_longitude double precision,
  start_accuracy_m double precision,
  start_distance_m double precision,
  end_latitude double precision,
  end_longitude double precision,
  end_accuracy_m double precision,
  end_distance_m double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_shift_segments_type_check
    CHECK (segment_type IN ('site','travel')),
  CONSTRAINT attendance_shift_segments_shape_check
    CHECK (
      (
        segment_type='site'
        AND site_id IS NOT NULL
        AND from_site_id IS NULL
        AND to_site_id IS NULL
      )
      OR
      (
        segment_type='travel'
        AND site_id IS NULL
        AND from_site_id IS NOT NULL
        AND to_site_id IS NOT NULL
        AND from_site_id<>to_site_id
      )
    ),
  CONSTRAINT attendance_shift_segments_time_check
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT attendance_shift_segments_start_lat_check
    CHECK (start_latitude IS NULL OR start_latitude BETWEEN -90 AND 90),
  CONSTRAINT attendance_shift_segments_start_lon_check
    CHECK (start_longitude IS NULL OR start_longitude BETWEEN -180 AND 180),
  CONSTRAINT attendance_shift_segments_end_lat_check
    CHECK (end_latitude IS NULL OR end_latitude BETWEEN -90 AND 90),
  CONSTRAINT attendance_shift_segments_end_lon_check
    CHECK (end_longitude IS NULL OR end_longitude BETWEEN -180 AND 180),
  CONSTRAINT attendance_shift_segments_start_accuracy_check
    CHECK (start_accuracy_m IS NULL OR start_accuracy_m >= 0),
  CONSTRAINT attendance_shift_segments_end_accuracy_check
    CHECK (end_accuracy_m IS NULL OR end_accuracy_m >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_shift_segments_sequence_uq
  ON attendance_shift_segments(attendance_shift_id,sequence);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_shift_segments_one_open_uq
  ON attendance_shift_segments(attendance_shift_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS attendance_shift_segments_user_time_idx
  ON attendance_shift_segments(user_id,started_at DESC);

CREATE INDEX IF NOT EXISTS attendance_shift_segments_org_time_idx
  ON attendance_shift_segments(organization_id,started_at DESC);

CREATE INDEX IF NOT EXISTS attendance_shift_segments_destination_task_idx
  ON attendance_shift_segments(destination_task_id)
  WHERE destination_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_shift_segments_tracking_idx
  ON attendance_shift_segments(tracking_session_id,started_at)
  WHERE tracking_session_id IS NOT NULL;

-- Historical shifts were previously constrained to one Site, so one Site
-- segment faithfully represents every pre-Phase-4 jornada.
INSERT INTO attendance_shift_segments(
  organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,
  started_at,ended_at,
  start_latitude,start_longitude,start_accuracy_m,start_distance_m,
  end_latitude,end_longitude,end_accuracy_m,end_distance_m
)
SELECT
  s.organization_id,s.id,s.user_id,1,'site',s.site_id,
  s.check_in_at,s.check_out_at,
  s.check_in_latitude,s.check_in_longitude,s.check_in_accuracy_m,s.check_in_distance_m,
  s.check_out_latitude,s.check_out_longitude,s.check_out_accuracy_m,s.check_out_distance_m
FROM attendance_shifts s
WHERE NOT EXISTS(
  SELECT 1 FROM attendance_shift_segments seg WHERE seg.attendance_shift_id=s.id
)
ON CONFLICT (attendance_shift_id,sequence) DO NOTHING;
