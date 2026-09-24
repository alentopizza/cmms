-- Phase 2 procurement governance: company policy, requisition approval snapshots and immutable decision history.

CREATE TABLE IF NOT EXISTS organization_procurement_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  approval_mode text NOT NULL DEFAULT 'none'
    CHECK (approval_mode IN ('none','all','threshold')),
  approval_threshold numeric(14,2) NOT NULL DEFAULT 0
    CHECK (approval_threshold >= 0),
  approver_scope text NOT NULL DEFAULT 'admin_only'
    CHECK (approver_scope IN ('admin_only','admin_manager')),
  allow_requester_self_approval boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supplier_requisitions
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'not_required'
    CHECK (approval_state IN ('not_required','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approval_policy_mode text NOT NULL DEFAULT 'none'
    CHECK (approval_policy_mode IN ('none','all','threshold')),
  ADD COLUMN IF NOT EXISTS approval_threshold numeric(14,2) NOT NULL DEFAULT 0
    CHECK (approval_threshold >= 0),
  ADD COLUMN IF NOT EXISTS approval_approver_scope text NOT NULL DEFAULT 'admin_only'
    CHECK (approval_approver_scope IN ('admin_only','admin_manager')),
  ADD COLUMN IF NOT EXISTS approval_self_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_decision_notes text;

CREATE TABLE IF NOT EXISTS supplier_requisition_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requisition_id uuid NOT NULL REFERENCES supplier_requisitions(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,
  action text NOT NULL
    CHECK (action IN ('requested','approved','rejected','reopened','amended')),
  from_state text,
  to_state text NOT NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_requisition_approval_events_req_idx
  ON supplier_requisition_approval_events(requisition_id,created_at DESC);

CREATE INDEX IF NOT EXISTS supplier_requisitions_approval_state_idx
  ON supplier_requisitions(organization_id,approval_required,approval_state,created_at DESC);
