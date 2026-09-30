-- Phase 2 configurable catalogs catch-up migration.
-- 999_configurable_catalogs.sql may already be recorded in schema_migrations on existing installations.
-- Keep this file additive and idempotent so deployed databases receive later Phase 2 schema changes.

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
('lead_followups','SYSTEM','whatsapp','WhatsApp',40),
('work_order_statuses','SYSTEM','open','Abierta',10),
('work_order_statuses','SYSTEM','assigned','Asignada',20),
('work_order_statuses','SYSTEM','in_progress','En progreso',30),
('work_order_statuses','SYSTEM','paused','Pausada',40),
('work_order_statuses','SYSTEM','completed','Completada',50),
('work_order_statuses','SYSTEM','cancelled','Cancelada',60)
ON CONFLICT DO NOTHING;

UPDATE configurable_catalogs
SET allow_custom=false,updated_at=now()
WHERE key IN (
  'asset_statuses','asset_criticalities',
  'work_order_types','work_order_priorities','work_order_statuses',
  'routine_frequencies','inventory_statuses',
  'lead_sources','lead_interests','lead_statuses','lead_followups'
);

UPDATE configurable_catalog_options
SET active=false,updated_at=now()
WHERE catalog_key='routine_frequencies' AND code='meter';

INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order)
SELECT 'supplier_types','SYSTEM',sc.code,sc.label,sc.sort_order
FROM supplier_capability_catalog sc
ON CONFLICT DO NOTHING;

INSERT INTO configurable_catalog_options(catalog_key,origin,code,label,sort_order)
SELECT 'supplier_specialties','SYSTEM',ss.code,ss.label,ss.sort_order
FROM supplier_specialty_catalog ss
ON CONFLICT DO NOTHING;
