-- Full user authentication and platform-level role support.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_platform_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_platform_role_check
      CHECK (platform_role IN ('user','superadmin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS users_platform_role_idx ON users(platform_role);
