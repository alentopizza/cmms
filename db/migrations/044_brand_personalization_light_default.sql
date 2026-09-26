-- Preserve the historical CMMS light-theme default for existing organization branding rows.
-- Migration 043 introduced the organization-level appearance preference; no prior row could have
-- explicitly selected "system", so existing rows are normalized to "light" once.
UPDATE organization_branding
SET interface_style='light'
WHERE interface_style='system';

ALTER TABLE organization_branding
  ALTER COLUMN interface_style SET DEFAULT 'light';
