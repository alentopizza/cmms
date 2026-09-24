-- Structured supplier catalogs, user dossier/emergency contact and supplier payment data.

CREATE TABLE IF NOT EXISTS supplier_capability_catalog (
  code text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO supplier_capability_catalog(code,label,sort_order) VALUES
  ('materials','Materiales / suministros',10),
  ('services','Servicios técnicos',20),
  ('contractor','Contratista / obra',30),
  ('equipment_rental','Alquiler de equipos',40),
  ('consulting','Consultoría / ingeniería',50),
  ('logistics','Logística / transporte',60),
  ('technology','Tecnología / software',70),
  ('general_services','Servicios generales',80)
ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,sort_order=EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS supplier_specialty_catalog (
  code text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO supplier_specialty_catalog(code,label,sort_order) VALUES
  ('refrigeration_hvac','Refrigeración / HVAC',10),
  ('electrical','Electricidad',20),
  ('mechanical','Mecánica',30),
  ('plumbing','Plomería / hidráulica',40),
  ('civil_works','Obra civil',50),
  ('fire_protection','Protección contra incendios',60),
  ('elevators','Ascensores / transporte vertical',70),
  ('generators','Plantas eléctricas / generación',80),
  ('compressed_air','Aire comprimido',90),
  ('industrial_kitchen','Cocinas / equipos gastronómicos',100),
  ('instrumentation','Instrumentación',110),
  ('automation_controls','Automatización / control',120),
  ('calibration_metrology','Calibración / metrología',130),
  ('welding_metalwork','Soldadura / metalmecánica',140),
  ('painting_finishes','Pintura / acabados',150),
  ('roofing_waterproofing','Cubiertas / impermeabilización',160),
  ('solar_energy','Energía solar',170),
  ('it_networks','TI / redes / comunicaciones',180),
  ('software','Software / licenciamiento',190),
  ('security_systems','CCTV / seguridad electrónica',200),
  ('access_control','Control de acceso',210),
  ('cleaning','Aseo / limpieza',220),
  ('pest_control','Control de plagas',230),
  ('landscaping','Jardinería / paisajismo',240),
  ('spare_parts','Repuestos',250),
  ('tools_hardware','Herramientas / ferretería',260),
  ('safety_ppe','Seguridad industrial / EPP',270),
  ('chemicals','Químicos / consumibles',280),
  ('general_supplies','Suministros generales',290),
  ('transport_logistics','Transporte / logística',300),
  ('waste_management','Gestión de residuos',310),
  ('environmental','Gestión ambiental',320),
  ('occupational_safety','SST / seguridad y salud en el trabajo',330)
ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,sort_order=EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS supplier_capabilities (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capability_code text NOT NULL REFERENCES supplier_capability_catalog(code) ON DELETE RESTRICT,
  PRIMARY KEY (supplier_id, capability_code)
);

CREATE INDEX IF NOT EXISTS supplier_capabilities_org_idx
  ON supplier_capabilities(organization_id, capability_code);

CREATE TABLE IF NOT EXISTS supplier_specialties (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  specialty_code text NOT NULL REFERENCES supplier_specialty_catalog(code) ON DELETE RESTRICT,
  PRIMARY KEY (supplier_id, specialty_code)
);

CREATE INDEX IF NOT EXISTS supplier_specialties_org_idx
  ON supplier_specialties(organization_id, specialty_code);

-- Backfill compatibility from the legacy single supplier_type and free-text category.
INSERT INTO supplier_capabilities(supplier_id,organization_id,capability_code)
SELECT id,organization_id,'materials' FROM suppliers WHERE supplier_type IN ('materials','both')
ON CONFLICT DO NOTHING;

INSERT INTO supplier_capabilities(supplier_id,organization_id,capability_code)
SELECT id,organization_id,'services' FROM suppliers WHERE supplier_type IN ('services','both')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  display_name text NOT NULL,
  reference text,
  issue_date date,
  expires_at date,
  notes text,
  file_data bytea NOT NULL,
  file_mime_type text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  archived_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_document_category_check CHECK (category IN (
    'identity','resume','occupational_risk','health_eps','pension','severance',
    'compensation_fund','payroll_contribution','bank_certificate','contract',
    'certification','other'
  ))
);

CREATE INDEX IF NOT EXISTS user_documents_user_idx
  ON user_documents(user_id,archived_at,created_at DESC);
CREATE INDEX IF NOT EXISTS user_documents_org_idx
  ON user_documents(organization_id,user_id);

CREATE TABLE IF NOT EXISTS user_emergency_contacts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship_code text NOT NULL,
  phone text NOT NULL,
  email text,
  notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_emergency_relationship_check CHECK (relationship_code IN (
    'parent','spouse_partner','child','sibling','relative','friend','other'
  ))
);

CREATE INDEX IF NOT EXISTS user_emergency_contacts_org_idx
  ON user_emergency_contacts(organization_id,user_id);

CREATE TABLE IF NOT EXISTS supplier_financial_profiles (
  supplier_id uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name text,
  account_type text,
  account_number text,
  account_holder text,
  account_holder_tax_id text,
  payment_terms_days integer,
  currency_code text NOT NULL DEFAULT 'COP',
  payment_email text,
  payment_notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_account_type_check CHECK (account_type IS NULL OR account_type IN ('savings','checking','other')),
  CONSTRAINT supplier_payment_terms_check CHECK (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 365),
  CONSTRAINT supplier_currency_code_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS supplier_financial_profiles_org_idx
  ON supplier_financial_profiles(organization_id,supplier_id);
