-- Extend international contact identity to suppliers and commercial leads.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS country_code varchar(2),
  ADD COLUMN IF NOT EXISTS tax_id_type text;

ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS country_code varchar(2);

UPDATE suppliers s
SET country_code=COALESCE(
  (SELECT COALESCE(o.default_country,o.legal_country,'CO') FROM organizations o WHERE o.id=s.organization_id),
  'CO'
)
WHERE country_code IS NULL;

UPDATE sales_leads
SET country_code='CO'
WHERE country_code IS NULL;
