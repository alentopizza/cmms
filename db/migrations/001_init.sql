CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  tax_id text,
  timezone text NOT NULL DEFAULT 'America/Bogota',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  address text,
  city text,
  country text NOT NULL DEFAULT 'CO',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','manager','technician','requester','viewer')),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES asset_categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES asset_categories(id) ON DELETE SET NULL,
  parent_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  manufacturer text,
  model text,
  serial_number text,
  status text NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','maintenance','down','retired')),
  criticality text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
  purchase_date date,
  installation_date date,
  warranty_expires date,
  purchase_cost numeric(14,2),
  location_detail text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL,
  current_value numeric(16,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meter_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meter_id uuid NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  value numeric(16,3) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL DEFAULT 'calendar' CHECK (trigger_type IN ('calendar','meter')),
  frequency_value integer NOT NULL CHECK (frequency_value > 0),
  frequency_unit text NOT NULL CHECK (frequency_unit IN ('day','week','month','year','meter')),
  meter_id uuid REFERENCES meters(id) ON DELETE SET NULL,
  next_due_at timestamptz,
  next_due_meter numeric(16,3),
  estimated_minutes integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  maintenance_plan_id uuid REFERENCES maintenance_plans(id) ON DELETE SET NULL,
  number bigint GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'corrective' CHECK (type IN ('corrective','preventive','inspection','emergency','improvement')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','paused','completed','cancelled')),
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  downtime_minutes integer NOT NULL DEFAULT 0,
  labor_cost numeric(14,2) NOT NULL DEFAULT 0,
  parts_cost numeric(14,2) NOT NULL DEFAULT 0,
  external_cost numeric(14,2) NOT NULL DEFAULT 0,
  completion_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_org_number_idx ON work_orders(organization_id, number);

CREATE TABLE IF NOT EXISTS work_order_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_id text,
  contact_name text,
  email text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'unit',
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  min_quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  storage_location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('receipt','issue','adjustment','return')),
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text,
  storage_key text NOT NULL,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_org_site_idx ON assets(organization_id, site_id);
CREATE INDEX IF NOT EXISTS work_orders_org_status_idx ON work_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS work_orders_asset_idx ON work_orders(asset_id);
CREATE INDEX IF NOT EXISTS maintenance_plans_due_idx ON maintenance_plans(organization_id, next_due_at);
CREATE INDEX IF NOT EXISTS inventory_low_stock_idx ON inventory_items(organization_id, quantity, min_quantity);
CREATE INDEX IF NOT EXISTS audit_log_org_created_idx ON audit_log(organization_id, created_at DESC);
