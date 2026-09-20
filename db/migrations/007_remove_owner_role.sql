-- Remove the redundant owner role and migrate existing owners to company administrators.
UPDATE organization_members
SET role='admin'
WHERE role='owner';

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('admin','manager','technician','requester','viewer'));
