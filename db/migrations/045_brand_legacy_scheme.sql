-- Preserve the meaning of white-label records created before scheme presets existed.
-- Any legacy branding row with explicit tenant colors was already a custom identity,
-- so surface it as Personalizado instead of incorrectly labelling it Predeterminado.
UPDATE organization_branding
SET scheme_key='custom'
WHERE scheme_key='default'
  AND (primary_color IS NOT NULL OR secondary_color IS NOT NULL);
