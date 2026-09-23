-- Activity-level commitment date used by Reaction alert filtering.
ALTER TABLE work_order_tasks
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS work_order_tasks_due_date_idx
  ON work_order_tasks(organization_id,due_date,status);
