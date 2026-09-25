-- Performance hot paths confirmed by dashboard/users/work-orders query audit.
-- Keep indexes narrow: each one maps to an existing frequent predicate/order.

-- Recent work-order lists are repeatedly scoped by organization and ordered
-- by requested_at DESC (dashboard, Work Orders, Assets/Locations summaries).
CREATE INDEX IF NOT EXISTS work_orders_org_requested_at_idx
  ON work_orders(organization_id, requested_at DESC);

-- Requester and assignee are used by Work Orders RBAC/listing and by the
-- Users directory correlated operational counters / delete-safety checks.
CREATE INDEX IF NOT EXISTS work_orders_requested_by_recent_idx
  ON work_orders(requested_by, requested_at DESC)
  WHERE requested_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_orders_assigned_to_recent_idx
  ON work_orders(assigned_to, requested_at DESC)
  WHERE assigned_to IS NOT NULL;

-- Several Work Orders queries correlate EXISTS subqueries from an order to
-- its tasks. PostgreSQL does not create an index automatically for a FK.
CREATE INDEX IF NOT EXISTS work_order_tasks_work_order_idx
  ON work_order_tasks(work_order_id);
