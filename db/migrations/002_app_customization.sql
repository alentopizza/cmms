CREATE TABLE IF NOT EXISTS app_customization (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_on_light bytea,
  logo_on_light_mime text,
  logo_on_light_name text,
  logo_on_dark bytea,
  logo_on_dark_mime text,
  logo_on_dark_name text,
  favicon bytea,
  favicon_mime text,
  favicon_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_customization(id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
