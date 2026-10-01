-- Lead commercial follow-up traceability: notes, status events and attachments.

CREATE TABLE IF NOT EXISTS sales_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  note text,
  from_status text,
  to_status text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_lead_activity_type_check CHECK (activity_type IN ('note','status')),
  CONSTRAINT sales_lead_activity_note_check CHECK (
    (activity_type='note' AND note IS NOT NULL AND length(btrim(note))>0)
    OR activity_type='status'
  )
);

CREATE INDEX IF NOT EXISTS sales_lead_activities_lead_idx
  ON sales_lead_activities(lead_id,created_at DESC);

CREATE TABLE IF NOT EXISTS sales_lead_activity_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES sales_lead_activities(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
  file_data bytea NOT NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_lead_activity_attachments_activity_idx
  ON sales_lead_activity_attachments(activity_id,created_at);
CREATE INDEX IF NOT EXISTS sales_lead_activity_attachments_lead_idx
  ON sales_lead_activity_attachments(lead_id,created_at DESC);
