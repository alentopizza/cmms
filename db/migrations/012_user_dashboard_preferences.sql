-- Per-user dashboard sidebar preferences.
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sidebar_order text[] NOT NULL DEFAULT ARRAY[]::text[],
  sidebar_collapsed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_dashboard_preferences_updated_idx
  ON user_dashboard_preferences(updated_at DESC);
