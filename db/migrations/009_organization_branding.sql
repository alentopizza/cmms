-- Organization-level white-label customization for Pro subscriptions.
CREATE TABLE organization_branding (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  app_name text,
  primary_color text,
  secondary_color text,
  logo_on_light bytea,
  logo_on_light_mime text,
  logo_on_light_name text,
  logo_on_dark bytea,
  logo_on_dark_mime text,
  logo_on_dark_name text,
  show_desweb_branding boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
