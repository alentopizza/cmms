-- Extend the existing organization_branding record with advanced PRO identity settings.
-- This remains one organization-scoped source of truth; no parallel branding table is introduced.
ALTER TABLE organization_branding
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS scheme_key text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS auto_palette boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS interface_style text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS interface_density text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_branding_scheme_check') THEN
    ALTER TABLE organization_branding
      ADD CONSTRAINT organization_branding_scheme_check
      CHECK (scheme_key IN ('default','fresh','bright','blue','coffee','ectoplasm','midnight','ocean','sunrise','custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_branding_style_check') THEN
    ALTER TABLE organization_branding
      ADD CONSTRAINT organization_branding_style_check
      CHECK (interface_style IN ('light','dark','system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_branding_density_check') THEN
    ALTER TABLE organization_branding
      ADD CONSTRAINT organization_branding_density_check
      CHECK (interface_density IN ('compact','normal','comfortable'));
  END IF;
END $$;
