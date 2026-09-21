-- Introduce the maximum platform authority role.
-- The bootstrap account configured through APP_ADMIN_EMAIL is resolved as Platform Owner at runtime.
-- Database-backed accounts may also persist this role.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_platform_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_platform_role_check
  CHECK (platform_role IN ('user','superadmin','platform_owner'));

CREATE UNIQUE INDEX IF NOT EXISTS users_single_platform_owner_idx
  ON users(platform_role)
  WHERE platform_role='platform_owner';


-- Promote the project owner's database account when it already exists.
UPDATE users
SET platform_role='platform_owner',
    full_name='Propietario Desweb',
    active=true,
    updated_at=now()
WHERE lower(email)=lower('admin@dominio.com');

-- Platform accounts do not inherit a tenant membership.
DELETE FROM organization_members
WHERE user_id IN (
  SELECT id FROM users WHERE platform_role='platform_owner'
);
