-- International catalogs and locale-ready profile preferences.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'es-CO',
  ADD COLUMN IF NOT EXISTS default_country varchar(2) NOT NULL DEFAULT 'CO';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country_code varchar(2),
  ADD COLUMN IF NOT EXISTS identity_document_type text,
  ADD COLUMN IF NOT EXISTS identity_document_number text,
  ADD COLUMN IF NOT EXISTS preferred_locale text;

ALTER TABLE app_customization
  ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'es-CO',
  ADD COLUMN IF NOT EXISTS default_country varchar(2) NOT NULL DEFAULT 'CO';

UPDATE organizations
SET default_country=COALESCE(NULLIF(legal_country,''),(SELECT NULLIF(s.country,'') FROM sites s WHERE s.organization_id=organizations.id ORDER BY s.created_at ASC LIMIT 1),'CO')
WHERE default_country='CO';

UPDATE users u
SET country_code=COALESCE(
  (SELECT o.default_country FROM organization_members om JOIN organizations o ON o.id=om.organization_id WHERE om.user_id=u.id ORDER BY om.created_at ASC LIMIT 1),
  'CO'
)
WHERE country_code IS NULL;
