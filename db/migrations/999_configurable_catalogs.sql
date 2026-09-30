-- Global configurable catalogs foundation.
-- SYSTEM options are organization-neutral. CUSTOM options are scoped to one organization.

CREATE TABLE IF NOT EXISTS configurable_catalogs (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  module text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  allow_custom boolean NOT NULL DEFAULT true,
  supports_relations boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configurable_catalog_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key text NOT NULL REFERENCES configurable_catalogs(key) ON DELETE RESTRICT,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (origin IN ('SYSTEM','CUSTOM')),
  code text NOT NULL,
  label text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configurable_catalog_option_scope_check CHECK (
    (origin='SYSTEM' AND organization_id IS NULL) OR
    (origin='CUSTOM' AND organization_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS configurable_catalog_system_code_uq
  ON configurable_catalog_options(catalog_key, lower(code))
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS configurable_catalog_system_label_uq
  ON configurable_catalog_options(catalog_key, lower(label))
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS configurable_catalog_custom_code_uq
  ON configurable_catalog_options(catalog_key, organization_id, lower(code))
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS configurable_catalog_custom_label_uq
  ON configurable_catalog_options(catalog_key, organization_id, lower(label))
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS configurable_catalog_options_lookup_idx
  ON configurable_catalog_options(catalog_key, organization_id, active, sort_order, label);

CREATE TABLE IF NOT EXISTS configurable_catalog_option_relations (
  parent_option_id uuid NOT NULL REFERENCES configurable_catalog_options(id) ON DELETE RESTRICT,
  child_option_id uuid NOT NULL REFERENCES configurable_catalog_options(id) ON DELETE RESTRICT,
  relation_type text NOT NULL DEFAULT 'parent',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(parent_option_id, child_option_id, relation_type),
  CONSTRAINT configurable_catalog_relation_self_check CHECK (parent_option_id <> child_option_id)
);

INSERT INTO configurable_catalogs(key,label,description,module,supports_relations) VALUES
('asset_types','Tipos de activo','Clasificación principal de activos.','assets',true),
('asset_categories','Categorías de activo','Categorías operativas y técnicas de activos.','assets',true),
('asset_brands','Marcas de activo','Fabricantes o marcas normalizadas de activos.','assets',true),
('asset_models','Modelos de activo','Modelos dependientes de marca cuando aplique.','assets',true),
('asset_statuses','Estados de activo','Estados operativos del ciclo de vida del activo.','assets',false),
('asset_criticalities','Criticidad de activo','Niveles de criticidad operacional.','assets',false),
('work_order_types','Tipos de OT','Tipos normalizados de órdenes de trabajo.','work_orders',false),
('work_order_priorities','Prioridades de OT','Prioridades normalizadas de órdenes de trabajo.','work_orders',false),
('work_order_statuses','Estados de OT','Estados normalizados de órdenes de trabajo.','work_orders',false),
('work_order_work_types','Tipos de trabajo','Clasificación del trabajo ejecutado.','work_orders',false),
('work_order_causes','Causas de OT','Causas o motivos normalizados.','work_orders',false),
('routine_types','Tipos de rutina','Tipos de rutinas de mantenimiento.','maintenance',false),
('routine_frequencies','Frecuencias','Frecuencias normalizadas de mantenimiento.','maintenance',false),
('routine_priorities','Prioridades de rutina','Prioridades de rutinas.','maintenance',false),
('routine_specialties','Especialidades de rutina','Especialidades técnicas de rutinas.','maintenance',false),
('inventory_categories','Categorías de inventario','Categorías de artículos de inventario.','inventory',false),
('inventory_types','Tipos de inventario','Tipos de artículos de inventario.','inventory',false),
('inventory_units','Unidades de medida','Unidades normalizadas de medida.','inventory',false),
('inventory_statuses','Estados de inventario','Estados de artículos de inventario.','inventory',false),
('supplier_categories','Categorías de proveedor','Categorías comerciales de proveedores.','suppliers',false),
('supplier_services','Servicios de proveedor','Servicios ofrecidos por proveedores.','suppliers',false),
('supplier_specialties','Especialidades de proveedor','Especialidades técnicas de proveedores.','suppliers',false),
('supplier_types','Tipos de proveedor','Tipos comerciales de proveedor.','suppliers',false),
('lead_sources','Origen de lead','Canales de origen comercial.','leads',false),
('lead_interests','Interés de lead','Intereses comerciales.','leads',false),
('lead_statuses','Estados de lead','Estados del seguimiento comercial.','leads',false),
('lead_followups','Seguimiento de lead','Tipos de seguimiento comercial.','leads',false)
ON CONFLICT(key) DO UPDATE SET
  label=EXCLUDED.label,
  description=EXCLUDED.description,
  module=EXCLUDED.module,
  supports_relations=EXCLUDED.supports_relations,
  updated_at=now();

INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order) VALUES
('asset_statuses','SYSTEM','operational','Operativo',10),
('asset_statuses','SYSTEM','maintenance','En mantenimiento',20),
('asset_statuses','SYSTEM','down','Fuera de servicio',30),
('asset_statuses','SYSTEM','retired','Retirado',40),
('asset_criticalities','SYSTEM','low','Baja',10),
('asset_criticalities','SYSTEM','medium','Media',20),
('asset_criticalities','SYSTEM','high','Alta',30),
('asset_criticalities','SYSTEM','critical','Crítica',40),
('work_order_types','SYSTEM','corrective','Correctivo',10),
('work_order_types','SYSTEM','preventive','Preventivo',20),
('work_order_types','SYSTEM','inspection','Inspección',30),
('work_order_types','SYSTEM','emergency','Emergencia',40),
('work_order_types','SYSTEM','improvement','Mejora',50),
('work_order_priorities','SYSTEM','low','Baja',10),
('work_order_priorities','SYSTEM','medium','Media',20),
('work_order_priorities','SYSTEM','high','Alta',30),
('work_order_priorities','SYSTEM','urgent','Urgente',40),
('lead_sources','SYSTEM','landing','Landing',10),
('lead_sources','SYSTEM','manual','Manual',20),
('lead_statuses','SYSTEM','new','Nuevo',10),
('lead_statuses','SYSTEM','contacted','Contactado',20),
('lead_statuses','SYSTEM','qualified','Calificado',30),
('lead_statuses','SYSTEM','closed','Cerrado',40),
('lead_statuses','SYSTEM','discarded','Descartado',50)
ON CONFLICT DO NOTHING;

-- Preserve current organization-specific asset classifications as CUSTOM options.
INSERT INTO configurable_catalog_options(catalog_key,organization_id,origin,code,label,sort_order)
SELECT 'asset_categories', ac.organization_id, 'CUSTOM',
       'legacy-' || substr(md5(lower(ac.name)),1,12), ac.name, 100
FROM asset_categories ac
WHERE nullif(trim(ac.name),'') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO configurable_catalog_options(catalog_key,organization_id,origin,code,label,sort_order)
SELECT 'asset_brands', a.organization_id, 'CUSTOM',
       'legacy-' || substr(md5(lower(trim(a.manufacturer))),1,12), trim(a.manufacturer), 100
FROM assets a
WHERE nullif(trim(a.manufacturer),'') IS NOT NULL
GROUP BY a.organization_id, trim(a.manufacturer)
ON CONFLICT DO NOTHING;

INSERT INTO configurable_catalog_options(catalog_key,organization_id,origin,code,label,sort_order)
SELECT 'asset_models', a.organization_id, 'CUSTOM',
       'legacy-' || substr(md5(lower(trim(a.model))),1,12), trim(a.model), 100
FROM assets a
WHERE nullif(trim(a.model),'') IS NOT NULL
GROUP BY a.organization_id, trim(a.model)
ON CONFLICT DO NOTHING;


-- Fields still backed by rigid legacy enum/check constraints are centrally readable
-- but cannot accept tenant CUSTOM values until their owning domain is migrated.
UPDATE configurable_catalogs
SET allow_custom=false, updated_at=now()
WHERE key IN (
  'asset_statuses','asset_criticalities',
  'work_order_types','work_order_priorities','work_order_statuses',
  'lead_sources','lead_statuses'
);


-- Preserve observed brand -> model relationships from legacy assets without rewriting asset rows.
INSERT INTO configurable_catalog_option_relations(parent_option_id,child_option_id,relation_type)
SELECT DISTINCT brand.id, model.id, 'legacy_asset_brand_model'
FROM assets a
JOIN configurable_catalog_options brand
  ON brand.catalog_key='asset_brands'
 AND brand.organization_id=a.organization_id
 AND lower(brand.label)=lower(trim(a.manufacturer))
JOIN configurable_catalog_options model
  ON model.catalog_key='asset_models'
 AND model.organization_id=a.organization_id
 AND lower(model.label)=lower(trim(a.model))
WHERE nullif(trim(a.manufacturer),'') IS NOT NULL
  AND nullif(trim(a.model),'') IS NOT NULL
ON CONFLICT DO NOTHING;


-- catalog_phase2_fields: additive fields for configurable classifications.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_type text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cause text;
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS routine_type text;
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS specialty text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_type text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS catalog_status text NOT NULL DEFAULT 'active';
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS followup_type text;

INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order) VALUES
('asset_types','SYSTEM','equipment','Equipo',10),
('asset_types','SYSTEM','infrastructure','Infraestructura',20),
('asset_types','SYSTEM','tool','Herramienta',30),
('work_order_work_types','SYSTEM','repair','Reparación',10),
('work_order_work_types','SYSTEM','inspection','Inspección',20),
('work_order_work_types','SYSTEM','installation','Instalación',30),
('work_order_work_types','SYSTEM','adjustment','Ajuste',40),
('work_order_causes','SYSTEM','failure','Falla',10),
('work_order_causes','SYSTEM','wear','Desgaste',20),
('work_order_causes','SYSTEM','preventive','Prevención',30),
('work_order_causes','SYSTEM','improvement','Mejora',40),
('routine_types','SYSTEM','preventive','Preventiva',10),
('routine_types','SYSTEM','inspection','Inspección',20),
('routine_types','SYSTEM','lubrication','Lubricación',30),
('routine_types','SYSTEM','calibration','Calibración',40),
('routine_priorities','SYSTEM','low','Baja',10),
('routine_priorities','SYSTEM','medium','Media',20),
('routine_priorities','SYSTEM','high','Alta',30),
('routine_priorities','SYSTEM','critical','Crítica',40),
('routine_specialties','SYSTEM','general','General',10),
('routine_specialties','SYSTEM','electrical','Electricidad',20),
('routine_specialties','SYSTEM','mechanical','Mecánica',30),
('routine_specialties','SYSTEM','hvac','Refrigeración / HVAC',40),
('routine_frequencies','SYSTEM','day','Día',10),
('routine_frequencies','SYSTEM','week','Semana',20),
('routine_frequencies','SYSTEM','month','Mes',30),
('routine_frequencies','SYSTEM','year','Año',40),
('routine_frequencies','SYSTEM','meter','Medidor',50),
('inventory_types','SYSTEM','spare_part','Repuesto',10),
('inventory_types','SYSTEM','consumable','Consumible',20),
('inventory_types','SYSTEM','tool','Herramienta',30),
('inventory_types','SYSTEM','supply','Suministro',40),
('inventory_units','SYSTEM','unidad','Unidad',10),
('inventory_units','SYSTEM','kg','Kilogramo',20),
('inventory_units','SYSTEM','g','Gramo',30),
('inventory_units','SYSTEM','l','Litro',40),
('inventory_units','SYSTEM','ml','Mililitro',50),
('inventory_units','SYSTEM','m','Metro',60),
('inventory_units','SYSTEM','cm','Centímetro',70),
('inventory_statuses','SYSTEM','active','Activo',10),
('inventory_statuses','SYSTEM','inactive','Inactivo',20),
('lead_interests','SYSTEM','demo','Demostración',10),
('lead_interests','SYSTEM','trial','Prueba 15 días',20),
('lead_interests','SYSTEM','basic','Plan Básico',30),
('lead_interests','SYSTEM','medium','Plan Medio',40),
('lead_interests','SYSTEM','pro','Plan Pro / marca blanca',50),
('lead_interests','SYSTEM','self_hosted','Self-hosted',60),
('lead_interests','SYSTEM','other','Otro',70),
('lead_followups','SYSTEM','call','Llamada',10),
('lead_followups','SYSTEM','email','Correo',20),
('lead_followups','SYSTEM','meeting','Reunión',30),
('lead_followups','SYSTEM','whatsapp','WhatsApp',40)
ON CONFLICT DO NOTHING;

UPDATE configurable_catalogs SET allow_custom=false,updated_at=now()
WHERE key IN ('routine_frequencies','inventory_statuses');

INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order) VALUES
('work_order_statuses','SYSTEM','open','Abierta',10),
('work_order_statuses','SYSTEM','assigned','Asignada',20),
('work_order_statuses','SYSTEM','in_progress','En progreso',30),
('work_order_statuses','SYSTEM','paused','Pausada',40),
('work_order_statuses','SYSTEM','completed','Completada',50),
('work_order_statuses','SYSTEM','cancelled','Cancelada',60)
ON CONFLICT DO NOTHING;


-- Reuse existing supplier master catalogs as SYSTEM options in the central architecture.
INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order)
SELECT 'supplier_types','SYSTEM',sc.code,sc.label,sc.sort_order
FROM supplier_capability_catalog sc
ON CONFLICT DO NOTHING;

INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order)
SELECT 'supplier_specialties','SYSTEM',ss.code,ss.label,ss.sort_order
FROM supplier_specialty_catalog ss
ON CONFLICT DO NOTHING;

-- Keep routine frequency aligned with the existing maintenance engine.
UPDATE configurable_catalog_options
SET active=false,updated_at=now()
WHERE catalog_key='routine_frequencies' AND code='meter';
