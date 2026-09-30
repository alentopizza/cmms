# I2-A2.2 — Diagnóstico técnico para convertir Requisiciones en entidades por sede

Fecha: 2026-09-29  
Tipo: **diagnóstico técnico y plan de migración; sin implementación funcional**.

HEAD base inspeccionado:

`03bfc3d0e1497884d64b080a4a5aaebe06072e92`

El archivo de instrucciones indicaba como HEAD esperado `a844e72d36b7277989843e1585a1856ca5266aa1`. El HEAD real está exactamente un commit por delante y la única diferencia es:

`docs/INVENTORY_I2A2_REQUISITIONS_DOMAIN_DECISION.md`

Ese documento contiene la decisión de dominio previa y no existe ningún cambio funcional adicional. Por tanto el diagnóstico se realiza sobre la misma implementación funcional validada en I2-A2.1.

Decisión de dominio ya fijada:

> **Una requisición = organización + sede + proveedor.**

Una requisición nueva no podrá contener líneas de sedes distintas.

---

# 1. Estado actual

## 1.1 Fases cerradas que deben preservarse

- I0 — aislamiento por organización/sede de Inventario.
- I1 — paginación server-side del catálogo.
- I2-A1 — paginación server-side del Kardex.
- I2-A2.1 — idempotencia e integridad transaccional.

No se requiere reabrir ninguna de ellas.

## 1.2 Estado actual de Requisiciones

Hoy la requisición es una cabecera por organización+proveedor.

La sede vive únicamente en las líneas:

```text
supplier_requisitions
├── organization_id
├── supplier_id
└── NO site_id

supplier_requisition_items
└── site_id
```

El generador permite seleccionar artículos de varias sedes cuando la sesión puede acceder a ellas y agrupa por:

```text
organization_id + supplier_id
```

Consecuencia actual:

```text
Org A
Supplier S
Item X → Site A1
Item Y → Site A2

→ una sola requisición A1+A2
```

Esto debe cambiar conceptualmente a:

```text
organization_id + site_id + supplier_id
```

## 1.3 No existe creación manual independiente de cabecera

No se encontró una ruta separada que cree una `supplier_requisition` vacía/manual.

Las superficies de creación son variantes del mismo generador:

1. Inventario:
   `app/dashboard/inventory/page.tsx`
   → `RequisitionBuilder`
   → `POST /api/requisitions/generate`

2. Ficha de proveedor:
   `components/SupplierDirectory.tsx`
   → `RequisitionBuilder`
   → `POST /api/requisitions/generate`

Las dos convergen en la misma ruta.

## 1.4 Numeración

`supplier_requisitions.number` es:

`bigint GENERATED ALWAYS AS IDENTITY`

No tiene UNIQUE explícito ni scope por organización/proveedor/sede.

Los inserts actuales no suministran `number`, por lo que la secuencia funciona de hecho como numeración global creciente de la tabla.

La conversión a requisición por sede **no necesita cambiar la numeración**.

Recomendación de compatibilidad:

- conservar la identidad global actual;
- no reiniciar números;
- no crear secuencia por sede en I2-A2.2;
- no renumerar históricos.

---

# 2. Modelo actual

## 2.1 supplier_requisitions — columnas actuales

Origen: migraciones 028 y 034.

Columnas:

- `id uuid PK`;
- `organization_id uuid NOT NULL FK organizations(id)`;
- `supplier_id uuid NOT NULL FK suppliers(id)`;
- `number bigint GENERATED ALWAYS AS IDENTITY`;
- `status text NOT NULL`;
- `requested_by uuid FK users(id)`;
- `needed_by date`;
- `notes text`;
- `sent_at timestamptz`;
- `approved_at timestamptz`;
- `fulfilled_at timestamptz`;
- `created_at timestamptz`;
- `updated_at timestamptz`;
- `approval_required boolean`;
- `approval_state text`;
- `approval_policy_mode text`;
- `approval_threshold numeric`;
- `approval_approver_scope text`;
- `approval_self_allowed boolean`;
- `approval_requested_at timestamptz`;
- `approval_decided_at timestamptz`;
- `approval_decided_by uuid FK users(id)`;
- `approval_decision_notes text`.

No existe `site_id`.

Índices relevantes:

- `supplier_requisitions_org_idx (organization_id, created_at DESC)`;
- `supplier_requisitions_supplier_idx (supplier_id, created_at DESC)`;
- índice de estado de aprobación por organización.

## 2.2 supplier_requisition_items — columnas actuales

- `id uuid PK`;
- `requisition_id uuid NOT NULL FK supplier_requisitions(id) ON DELETE CASCADE`;
- `organization_id uuid NOT NULL FK organizations(id)`;
- `inventory_item_id uuid FK inventory_items(id) ON DELETE SET NULL`;
- `site_id uuid FK sites(id) ON DELETE SET NULL`;
- `location_id uuid FK locations(id) ON DELETE SET NULL`;
- `sku text`;
- `description text`;
- `unit text`;
- `quantity_requested numeric`;
- `quantity_received numeric`;
- `unit_cost_estimated numeric`;
- `notes text`;
- `created_at timestamptz`.

Existe UNIQUE:

`(requisition_id, inventory_item_id)`

No existe una FK compuesta que garantice:

```text
requisition.organization_id = line.organization_id
requisition.site_id = line.site_id
inventory_item.organization/site = line.organization/site
```

## 2.3 organizations / sites

`sites` tiene:

- `id`;
- `organization_id`;
- nombre/código;
- estado.

Existe:

`UNIQUE (organization_id, code)`

No existe actualmente una clave compuesta explícita `(id, organization_id)`, aunque `id` ya es PK.

Una futura FK organization-aware para requisición puede requerir índice/UNIQUE exacto:

`sites(id, organization_id)`.

## 2.4 inventory_items

Cada item puede tener:

- `organization_id`;
- `site_id` nullable;
- `location_id`;
- `supplier_id`;
- `warehouse_id`.

El `site_id` del item es la fuente usada hoy para copiar `supplier_requisition_items.site_id` durante la generación.

Importante:

el modelo de Inventario mantiene compatibilidad legacy con items `site_id=NULL`.

Una requisición por sede no puede usar esa ambigüedad para nuevas cabeceras.

## 2.5 inventory_warehouses

Cada warehouse tiene:

- `organization_id`;
- `site_id` nullable;
- `location_id`;
- código/nombre;
- active.

Legacy permite warehouses `site_id=NULL`.

## 2.6 Receipts

`inventory_transactions` puede guardar:

- `requisition_id`;
- `requisition_item_id`;
- `warehouse_id`;
- item;
- cost;
- lot;
- expiration;
- `cost_center text`.

No tiene `requisition_site_id`.

El site se deriva actualmente mediante item/line/warehouse.

## 2.7 Supplier returns

`supplier_returns` tiene:

- organization;
- supplier;
- requisition;
- motivo/estado/documento.

No tiene site.

`supplier_return_items` enlaza:

- requisition item;
- receipt transaction;
- inventory item;
- warehouse;
- cantidad.

Con la nueva regla, el site puede seguir derivándose de la requisición; no es obligatorio duplicarlo en la cabecera de supplier return.

## 2.8 Approval

La política y decisión son de cabecera de requisición.

`supplier_requisition_approval_events` referencia `requisition_id`.

No existe aprobación por línea.

Una requisición site-owned encaja mejor con este modelo que una requisición multi-sede parcial.

## 2.9 Procurement documents

`procurement_documents` referencia:

- organization;
- supplier;
- requisition.

No tiene site.

`procurement_document_lines` referencia requisition item.

Con una requisición single-site, el site del documento puede derivarse de `supplier_requisitions.site_id`.

No es necesario duplicar `site_id` en documentos para obtener aislamiento, siempre que todas las rutas autoricen primero la requisición.

---

# 3. Flujo completo actual

## 3.1 Creación

### Superficie A — Inventario

`app/dashboard/inventory/page.tsx`

Carga un universo independiente de artículos requisicionables desde el scope autorizado de Inventario.

Para limited-site, ese scope mantiene la semántica legacy:

```text
item.site_id IS NULL
OR
item.site_id ∈ session.siteIds
```

Al convertir a `RequisitionSelectableItem`, la pantalla actualmente envía:

- nombre de sede;
- nombre de ubicación;

pero no pasa explícitamente `site_id` en ese mapping.

Eso deberá corregirse en la implementación futura para que la previsualización pueda separar por sede.

### Superficie B — Proveedor

`components/SupplierDirectory.tsx`

Carga items mediante:

`GET /api/suppliers/[id]?view=requisitions`

y usa el mismo `RequisitionBuilder`.

La vista de inventario del proveedor sí maneja site IDs y limited scope en algunas consultas, pero la vista `requisitions` actual carga items por organización/proveedor sin aplicar `session.siteIds`.

Esto debe alinearse antes de permitir crear requisiciones site-owned desde la ficha del proveedor.

### RequisitionBuilder

Archivo:

`components/RequisitionBuilder.tsx`

Actualmente agrupa la previsualización solo por:

`supplier_id`.

Texto actual:

> Se generará una requisición por proveedor.

Con el modelo objetivo deberá agrupar visualmente por:

`supplier_id + site_id`

y mostrar claramente proveedor+sede.

No debe ser la única protección; es solo UX.

### Backend generador

Archivo:

`app/api/requisitions/generate/route.ts`

Comportamiento:

1. recibe IDs de items;
2. carga item + organization + site + supplier;
3. valida organization y, si el item tiene site, `canAccessSite()`;
4. agrupa por `organization_id + supplier_id`;
5. calcula cantidades/costos;
6. calcula estimated total por grupo;
7. evalúa approval policy/threshold;
8. inserta una cabecera;
9. inserta líneas copiando item.site_id/location_id.

Cambio conceptual:

```text
group key actual
organization + supplier

→

group key objetivo
organization + site + supplier
```

Además:

- ningún item nuevo requisicionable debe tener site indeterminado;
- todos los items de cada grupo deben tener el mismo site;
- el site debe quedar escrito en la cabecera;
- el threshold se evaluará por la nueva requisición site-specific.

## 3.2 Consulta — módulo Requisiciones

### Listado

`app/dashboard/requisitions/page.tsx`

Tenant actual:

```sql
WHERE r.organization_id=$1
```

Agrega todas las líneas.

No filtra site.

Modelo objetivo para limited-site:

```text
organization
AND
r.site_id ∈ session.siteIds
```

Para `accessAllSites`:

```text
organization
```

Para plataforma:

mantener organization scope de plataforma.

### Detalle

`app/dashboard/requisitions/[id]/page.tsx`

Hoy:

1. carga por ID;
2. valida `canAccessOrganization`;
3. luego carga líneas, receipts, approval history, returns y documentos.

Modelo objetivo:

autorizar cabecera con:

```text
organization + requisition.site_id
```

antes de cargar cualquier descendiente.

## 3.3 Edición

`POST /api/requisitions/[id]`

Hoy valida organización, bloquea cabecera y líneas y puede:

- cambiar status;
- needed_by;
- notes;
- cantidades;
- costos;
- retirar líneas;
- recalcular threshold;
- abrir/reabrir aprobación.

No revalida site.

Modelo objetivo:

- la cabecera debe estar dentro del scope de site;
- ninguna línea editable puede tener site diferente de la cabecera;
- no permitir mover una línea a otra sede;
- el site de la requisición no debe ser editable como un simple campo de formulario después de creada.

## 3.4 Aprobación

`POST /api/requisitions/[id]/approval`

La aprobación actual ya calcula los DISTINCT `site_id` de las líneas y, para limited-site, exige cobertura sobre todos.

Con requisición single-site:

- debe autorizarse contra `req.site_id`;
- el scan de múltiples sites deja de ser la fuente primaria;
- puede mantenerse temporalmente como invariant/assertion mientras exista legacy.

No cambia la naturaleza de aprobación:

`una decisión = una requisición`.

## 3.5 Recepción

`POST /api/requisitions/[id]/receive`

Hoy:

- valida organización;
- procesa únicamente líneas con cantidad ingresada;
- valida el site del item seleccionado;
- valida warehouses por organización;
- limited-site: warehouse.site_id debe estar en `session.siteIds`;
- all-sites/platform: cualquier warehouse de la organización es aceptado.

Hueco actual:

un usuario autorizado para A+B puede recibir una línea de A usando warehouse B.

Un usuario global también puede hacerlo.

No existe un modo explícito de negocio llamado “recepción cross-site”; es solo consecuencia de la consulta permisiva.

Modelo objetivo:

```text
receipt warehouse.site_id
=
requisition.site_id
=
requisition_item.site_id
```

para todos los roles.

`accessAllSites` debe significar “puede operar requisiciones de cualquier sede”, no “puede recibir una requisición A físicamente en B”.

Si se necesita mover material entre sedes, Inventario ya tiene transferencias como operación separada.

## 3.6 Devolución / supplier return

`POST /api/requisitions/[id]/returns`

Hoy:

- parte de receipt transactions;
- valida site del item para limited users;
- warehouse seleccionada solo debe estar dentro de sites autorizados;
- usuario A+B puede elegir warehouse B para receipt de A;
- all-sites puede elegir cualquier warehouse de la organización.

Objetivo:

```text
return warehouse.site_id
=
requisition.site_id
```

y la receipt/requisition item deben pertenecer a esa misma requisición/site.

## 3.7 Documentos

Rutas:

- `POST /api/requisitions/[id]/documents`;
- `GET /api/requisitions/[id]/documents/[documentId]`;
- `POST /api/requisitions/[id]/documents/[documentId]`.

Hoy limited-site deriva cobertura recorriendo sites de todas las líneas.

Con cabecera site-owned:

- autorizar primero `req.site_id`;
- verificar que documento.requisition_id pertenece a esa requisición;
- no reconstruir ownership desde documento/lineas.

`lib/procurement-reconciliation.ts` puede seguir trabajando por requisition ID después de una autorización site-aware en la frontera.

## 3.8 Export

`GET /api/requisitions/[id]/export`

Hoy valida organización y carga toda la requisición.

Solo la sección de conciliación tiene check adicional de cobertura site.

Objetivo:

la autorización completa del export debe depender de:

`organization + requisition.site_id`.

Una requisición A no puede exportarse por usuario limitado a B.

## 3.9 Proveedores — historial y analytics

Hay superficies auxiliares que también consultan Requisiciones.

### app/dashboard/suppliers/page.tsx

Calcula:

- requisition_count;
- directory_requisition_count;
- open_requisition_count;

agrupando `supplier_requisitions` por supplier y filtrando organización, no site.

Para limited-site estos conteos pueden revelar actividad de otras sedes.

### GET /api/suppliers/[id]?view=requisitions

Carga requisiciones completas por:

`supplier_id + organization_id`

sin site filter.

También carga items requisicionables por proveedor sin site filter en esa vista.

Esto afecta:

- historial;
- builder desde proveedor;
- export links;
- progresos.

### GET /api/suppliers/[id]?view=statistics

`loadSupplierCommercialAnalytics()` agrega requisiciones/receipts del proveedor sin recibir un scope de site.

Sus KPIs de procurement pueden combinar A+B.

Si la regla es que un usuario limitado solo consulta requisiciones de A, los analytics de requisiciones mostrados a ese usuario también deben partir del mismo scope.

---

# 4. Archivos y rutas afectadas

| Archivo | Función/ruta | Actual | Cambio necesario futuro | Riesgo |
| --- | --- | --- | --- | --- |
| `db/migrations/028_supplier_profiles_requisitions.sql` | esquema histórico | cabecera sin site | NO editar migración histórica; crear nueva migración | alterar 028 rompería instalaciones |
| nueva migración futura | esquema | inexistente | agregar site/backfill/constraints/índices | legacy ambiguo |
| `app/api/requisitions/generate/route.ts` | POST generate | agrupa org+supplier | agrupar org+site+supplier y escribir header.site_id | threshold cambia por grupo |
| `components/RequisitionBuilder.tsx` | builder | preview por supplier | preview por supplier+site | solo UX; backend sigue obligatorio |
| `app/dashboard/inventory/page.tsx` | fuente builder | mapping omite site_id | pasar site_id y excluir/gestionar legacy null | item legacy sin site |
| `app/api/suppliers/[id]/route.ts` | view=requisitions | requisitions/items por org | aplicar site scope; builder con items autorizados | leak cross-site |
| `components/SupplierDirectory.tsx` | supplier requisitions | historial/builder | mostrar solo universo autorizado; agrupación por site | métricas/links |
| `app/dashboard/suppliers/page.tsx` | req counters | aggregate org-wide | filtrar requisitions según site scope | conteos cross-site |
| `lib/supplier-analytics.ts` | procurement KPI | supplier-wide | aceptar scope site y filtrar req/receipts | KPI cross-site |
| `app/dashboard/requisitions/page.tsx` | listado | org-only | scope por header.site_id | leak |
| `app/dashboard/requisitions/[id]/page.tsx` | detalle | org-only | autorizar site antes de descendants; selector warehouse same site | leak/warehouse mismatch |
| `app/api/requisitions/[id]/route.ts` | edit | org-only | header site authorization + invariant lines | cross-site edit |
| `app/api/requisitions/[id]/approval/route.ts` | approve | site derivado de líneas | header site auth; invariant de línea | legacy |
| `app/api/requisitions/[id]/receive/route.ts` | receive | line site + authorized warehouse sites | req site + exact warehouse site | A receipt into B warehouse |
| `app/api/requisitions/[id]/returns/route.ts` | supplier return | receipt site + authorized warehouse sites | req site + exact warehouse site | return via other site |
| `app/api/requisitions/[id]/export/route.ts` | export | org-only base export | header site auth | export cross-site |
| `app/api/requisitions/[id]/documents/route.ts` | create document | all-lines coverage scan | header site auth | document leak |
| `app/api/requisitions/[id]/documents/[documentId]/route.ts` | file/review | all-lines coverage scan | header site auth | binary evidence leak |
| `lib/procurement-reconciliation.ts` | reconciliation | requisition-scoped internal queries | probablemente no requiere scope propio si callers autorizan; revisar assertions | uso futuro directo sin auth |
| `components/RequisitionExportMenu.tsx` | links | solo construye URL | probablemente sin cambio funcional | endpoint debe ser autoridad |
| `scripts/requisition-receipt-smoke.mjs` | regression | inserts header sin site | actualizar fixture al nuevo schema | fallo de CI |
| `scripts/requisition-approval-smoke.mjs` | regression | header sin site | actualizar fixture | fallo de CI |
| `scripts/supplier-return-smoke.mjs` | regression | header sin site | actualizar fixture | fallo de CI |
| `scripts/procurement-reconciliation-smoke.mjs` | regression | header sin site | actualizar fixture | fallo de CI |
| `scripts/inventory-scope-smoke.mjs` | scope contract | reglas actuales | ampliar contratos de requisition site/warehouse | leak |
| nuevo smoke futuro | I2-A2.2 | inexistente | `inventory-i2a2-requisitions-site-smoke.mjs` | cobertura requerida |

---

# 5. Queries afectadas

## 5.1 Generación

Actual:

```text
Map key = organization_id + ":" + supplier_id
```

Objetivo:

```text
Map key = organization_id + ":" + site_id + ":" + supplier_id
```

Rechazar creación si `site_id` no puede determinarse.

## 5.2 Listado de Requisiciones

Actual tenant:

```sql
WHERE r.organization_id=$1
```

Objetivo limited:

```sql
WHERE r.organization_id=$1
  AND r.site_id=ANY($2::uuid[])
```

Objetivo all-sites:

```sql
WHERE r.organization_id=$1
```

Platform/superadmin mantiene organization scope existente y no debe recibir un RBAC paralelo.

## 5.3 Detalle

Actual:

```sql
WHERE r.id=$1
```

+ `canAccessOrganization()`.

Objetivo:

cargar ID+organization+site y validar ambos scopes antes de ejecutar queries descendientes.

## 5.4 Edición

La selección `FOR UPDATE` debe incluir `site_id`.

Antes de modificar líneas:

```text
canAccessOrganization
AND
canAccessSite(req.site_id)
```

La query de líneas debe comprobar/asegurar que todas pertenecen a `req.site_id`.

## 5.5 Approval

Actual limited:

```sql
SELECT DISTINCT site_id
FROM supplier_requisition_items
WHERE requisition_id=$1
```

Objetivo primario:

`req.site_id`.

Durante compatibilidad legacy el scan de líneas puede mantenerse como validación defensiva para cabeceras históricas.

## 5.6 Warehouse selector

Actual limited:

```sql
WHERE w.organization_id=$1
  AND w.active=true
  AND (w.site_id IS NULL OR w.site_id=ANY($2))
```

Esto es incorrecto para requisición single-site.

Objetivo:

```sql
WHERE w.organization_id=$1
  AND w.site_id=req.site_id
  AND w.active=true
```

La autorización de sesión se valida por la requisición.

No incluir `site_id=NULL`.

## 5.7 Receive mutation

Actual limited valida warehouse contra:

`session.siteIds`.

Objetivo para cualquier rol:

`warehouse.site_id = req.site_id`.

## 5.8 Return mutation

Misma regla:

`warehouse.site_id = req.site_id`.

## 5.9 Supplier requisition view

Actual:

```sql
WHERE r.supplier_id=$1
  AND r.organization_id=$2
```

Objetivo limited:

añadir `r.site_id=ANY(session.siteIds)`.

Items del builder deben estar limitados a site IDs autorizados y tener site no nulo.

## 5.10 Supplier aggregates/analytics

Todas las CTE/aggregates basadas en `supplier_requisitions` deben recibir site scope cuando el consumidor es site-limited.

No filtrar después del aggregate.

Orden:

```text
organization/site scope
→ rows
→ aggregate/KPI
```

---

# 6. Centros de costo

## 6.1 ¿Existe una tabla propia?

No se encontró una tabla de dominio `cost_centers` ni equivalente en las migraciones actuales.

No existe `cost_center_id` en:

- supplier requisitions;
- requisition items;
- inventory items.

## 6.2 Implementación actual

Existe:

`inventory_transactions.cost_center text`

agregado por migración 031.

La recepción de requisición muestra un campo:

`Centro de costo`

a nivel del formulario de recepción, no por línea.

El valor textual se copia a los receipt transactions creados en esa operación.

Supplier return copia el `cost_center` del receipt de origen hacia el movimiento outbound.

El Kardex/importación utilizan este texto como metadata.

## 6.3 ¿Tiene site_id?

No.

Es texto libre.

## 6.4 ¿Puede pertenecer a varias sedes?

El modelo actual no puede responderlo porque no existe una entidad identificable de centro de costo.

Dos strings iguales o distintos no tienen identidad, organización ni sede verificable.

## 6.5 ¿Cómo se selecciona en requisiciones?

No existe selector maestro.

En recepción se escribe manualmente un texto.

No existe centro de costo almacenado en `supplier_requisition_items`.

## 6.6 ¿Existe validación backend?

Solo se normaliza como string y se guarda.

No se valida organización/site.

## 6.7 ¿La DB garantiza centro de costo → sede?

No.

No es posible con el modelo actual.

## 6.8 Otros usos

El campo forma parte de metadata de Kardex:

- movimientos manuales;
- recepción de requisiciones;
- supplier return por copia del receipt;
- importación/Kardex/export/búsqueda donde aplique.

No se encontró un maestro reutilizable por otros módulos.

## 6.9 Solución mínima necesaria

La regla definitiva:

```text
requisition.site_id = cost_center.site_id
```

no puede implementarse de forma referencial mientras `cost_center` sea texto.

Si el requisito de centro de costo debe quedar garantizado, el mínimo modelo estructurado es una entidad reutilizable, por ejemplo:

```text
cost_centers
- id
- organization_id
- site_id
- code
- name
- active
- created_at
- updated_at
```

y una relación opcional en la línea:

`supplier_requisition_items.cost_center_id`.

La FK debería poder garantizar:

```text
line.organization_id
=
cost_center.organization_id

line.site_id
=
cost_center.site_id
```

No se debe migrar automáticamente `inventory_transactions.cost_center text` a IDs:

- es histórico;
- puede contener valores libres;
- no existe diccionario inequívoco.

Compatibilidad recomendada:

- mantener `inventory_transactions.cost_center` como snapshot textual histórico;
- si se introduce master, nuevos receipts pueden snapshotear nombre/código además del ID indirecto en la línea;
- no reescribir Kardex.

La definición de códigos, unicidad y catálogo de centros de costo requiere confirmación de negocio antes de implementar ese submodelo.

---

# 7. Modelo objetivo

## 7.1 Cabecera

Agregar conceptualmente:

```sql
supplier_requisitions.site_id uuid
```

Target final:

```text
supplier_requisitions
├── organization_id
├── site_id
├── supplier_id
└── ...
```

Regla:

`una requisición pertenece a una sola sede`.

## 7.2 Integridad organization/site

Recomendación final de DB:

- FK `site_id → sites(id)`;
- garantía adicional de que site pertenece a la misma organization.

Patrón preferible:

1. UNIQUE/índice referenciable `sites(id, organization_id)`;
2. FK compuesta:

```text
supplier_requisitions(site_id, organization_id)
→
sites(id, organization_id)
```

## 7.3 Integridad requisition/line

Target final:

```text
requisition_item.requisition_id
+ organization_id
+ site_id
→
supplier_requisition(id, organization_id, site_id)
```

Esto requiere una clave UNIQUE referenciable sobre:

`supplier_requisitions(id, organization_id, site_id)`.

Con datos ya saneados, la FK compuesta garantiza que una línea no pueda pertenecer a una sede diferente de su cabecera.

## 7.4 Integridad inventory item/line

Recomendable para cerrar completamente el dominio:

```text
supplier_requisition_items(
  inventory_item_id,
  organization_id,
  site_id
)
→
inventory_items(
  id,
  organization_id,
  site_id
)
```

Esto evita que una línea declare site A mientras apunta a un item de B.

Requiere índice/UNIQUE referenciable de item.

Como `inventory_item_id` puede ser NULL históricamente por `ON DELETE SET NULL`, la compatibilidad debe revisarse.

## 7.5 Supplier

La requisición debe seguir referenciando el supplier de la organización.

Puede reforzarse con FK compuesta organization-aware si la auditoría lo justifica, sin cambiar el concepto de supplier.

## 7.6 Location

La línea ya conserva `location_id`.

Una segunda fase de integridad puede garantizar location.organization/site = line.organization/site.

No es imprescindible para introducir `supplier_requisitions.site_id`, pero evita una inconsistencia análoga.

## 7.7 Documentos, returns y approval

No necesitan duplicar site si siempre se autorizan a través de requisition.

Single source of truth recomendado:

`supplier_requisitions.site_id`.

---

# 8. Estrategia de migración

No ejecutar en esta etapa.

## Fase M0 — preflight obligatorio

Antes de ALTER:

ejecutar en la base objetivo un reporte histórico por requisición.

Query propuesta:

```sql
WITH per_req AS (
  SELECT
    r.id,
    count(ri.id) AS line_count,
    count(DISTINCT ri.site_id) FILTER (WHERE ri.site_id IS NOT NULL) AS distinct_non_null_sites,
    count(*) FILTER (WHERE ri.site_id IS NULL) AS null_site_lines,
    min(ri.site_id) FILTER (WHERE ri.site_id IS NOT NULL) AS derived_site
  FROM supplier_requisitions r
  LEFT JOIN supplier_requisition_items ri ON ri.requisition_id=r.id
  GROUP BY r.id
)
SELECT
  count(*) AS requisitions_total,
  count(*) FILTER (WHERE line_count>0) AS requisitions_with_lines,
  count(*) FILTER (
    WHERE line_count>0
      AND distinct_non_null_sites=1
      AND null_site_lines=0
  ) AS unambiguous_single_site,
  count(*) FILTER (WHERE distinct_non_null_sites>1) AS mixed_site,
  count(*) FILTER (WHERE null_site_lines>0) AS with_null_site_lines,
  count(*) FILTER (
    WHERE line_count=0
       OR distinct_non_null_sites=0
       OR distinct_non_null_sites>1
       OR null_site_lines>0
  ) AS cannot_derive_unambiguously
FROM per_req;
```

Además listar IDs ambiguos con:

- número;
- organization;
- supplier;
- sites;
- line_count;
- receipts/documents/returns existentes.

No continuar a NOT NULL hasta revisar ese resultado.

## Fase M1 — schema nullable y no destructivo

Nueva migración futura, previsiblemente:

`db/migrations/048_requisition_site_scope.sql`

Agregar:

```sql
ALTER TABLE supplier_requisitions
ADD COLUMN site_id uuid;
```

Primero nullable.

Agregar FK a `sites` con semántica que no borre la sede silenciosamente.

Para cabecera de dominio se recomienda `ON DELETE RESTRICT`, no `SET NULL`.

Agregar índice para query paths:

```text
(organization_id, site_id, created_at DESC)
(supplier_id, site_id, created_at DESC)
```

No cambiar `number`.

## Fase M2 — backfill solo inequívoco

Actualizar únicamente Caso A:

```text
todas las líneas tienen site no nulo
AND
COUNT(DISTINCT site_id)=1
```

`supplier_requisitions.site_id = ese site`.

No tocar:

- mixed-site;
- null-site;
- no-lines.

## Fase M3 — resolver legacy ambiguo con decisión explícita

### Caso B — mixed-site

No dividir automáticamente.

Razones:

una separación posterior podría requerir repartir:

- número de requisición;
- aprobación;
- estado;
- documentos;
- returns;
- receipts;
- audit history.

Eso cambia historia comercial.

Opciones de negocio para históricos deben definirse explícitamente, por ejemplo:

- mantenerlos como legacy read-only con `site_id=NULL`;
- asignar manualmente tras auditoría si realmente hubo error de datos;
- crear proceso administrativo de regularización.

No seleccionar automáticamente.

### Caso C — líneas sin site

No inferir desde:

- warehouse;
- location;
- nombre;
- supplier;
- texto.

Un warehouse o location histórico puede no reflejar la intención original.

Requiere revisión/manual mapping si se quiere completar.

## Fase M4 — aplicación comienza a crear únicamente datos válidos

Antes de exigir NOT NULL global:

- generator exige site;
- grouping org+site+supplier;
- todos los nuevos headers tienen site;
- lines deben igualar header site;
- list/detail/edit/etc usan header site;
- receipt/return warehouse iguala requisition site.

## Fase M5 — garantía DB durante convivencia legacy

Mientras existan cabeceras históricas NULL, un `NOT NULL` global rompería compatibilidad.

Recomendación temporal:

- FK organization-aware de header cuando site no sea null;
- trigger/constraint específico para **INSERT** de nuevas requisiciones que requiera site;
- validación de INSERT de requisition item contra header.site_id;
- UPDATE de relación/site validado;
- no bloquear un UPDATE de status/approval de una cabecera legacy solo porque su site histórico siga NULL.

Esto preserva históricos activos sin permitir crear nuevas requisiciones ambiguas.

## Fase M6 — constraint final

Cuando preflight confirme que ya no quedan ambiguos activos:

- `supplier_requisitions.site_id SET NOT NULL`;
- evaluar `supplier_requisition_items.site_id SET NOT NULL`;
- FK compuesta requisition/item;
- FK compuesta item/site cuando sea viable;
- validar constraints;
- retirar triggers transitorios si quedaron redundantes.

La garantía final preferida es FK/constraint, no solo TypeScript.

---

# 9. Tratamiento de datos históricos

## 9.1 Datos disponibles en este entorno

No hay una base histórica representativa conectada a las herramientas de esta sesión.

El repositorio explícitamente tiene:

`scripts/seed.mjs`

con:

> No automatic seed configured.

CI:

1. crea PostgreSQL limpio;
2. ejecuta migraciones;
3. ejecuta smokes.

Los smokes de requisición/procurement revisados:

- crean sus propios datos;
- usan `BEGIN`;
- terminan con `ROLLBACK`.

Por tanto el fixture persistente disponible después de migraciones tiene:

| Métrica | Fixture CI base |
| --- | ---: |
| requisiciones | 0 |
| con líneas | 0 |
| single-site | 0 |
| mixed-site | 0 |
| con line.site_id NULL | 0 |
| no derivables | 0 |

Estos son conteos reales del **fixture vacío disponible**, no de producción.

No permiten estimar la situación histórica real.

## 9.2 Fixtures de smoke

Los fixtures revisados de:

- receipt;
- procurement reconciliation;

crean requisiciones de una sola sede.

El smoke de approval crea cabecera sin líneas en parte de su fixture.

No existe hoy un fixture permanente que represente una requisición mixed-site.

## 9.3 Producción / entorno real

No existe en las herramientas disponibles un conector SQL hacia la base de producción/staging.

Por tanto no es posible entregar de forma responsable los conteos históricos de producción.

Antes de implementar M2/M6, los queries de preflight de la sección 8 deben ejecutarse en la base objetivo.

No inventar esos números.

---

# 10. Aislamiento por sede objetivo

## Regla base

Reutilizar:

- `session.siteIds`;
- `session.accessAllSites`;
- `canAccessSite()`;
- organization scope existente.

No crear permisos nuevos.

## 10.1 Tenant limited

```text
can(permission)
AND
requisition.organization_id = session.organizationId
AND
requisition.site_id ∈ session.siteIds
```

## 10.2 Tenant accessAllSites

```text
can(permission)
AND
requisition.organization_id = session.organizationId
```

El usuario puede operar A o B porque ambas cabeceras están permitidas, no porque una requisición A pueda usar recursos físicos B.

## 10.3 Platform owner/superadmin

Mantener organization scope existente.

Una vez autorizado el tenant/recurso, puede operar requisiciones de sus sedes conforme al permiso funcional existente.

## 10.4 List

Scope en SQL antes de agregados/paginación futura.

## 10.5 Detail

Validar cabecera organization+site antes de líneas.

## 10.6 Edit/cancel

Mismo scope de cabecera.

No permitir cambiar site arbitrariamente tras crear.

## 10.7 Approve

Mismo scope de cabecera.

No aprobación cross-site.

## 10.8 Receive

Requerir simultáneamente:

```text
req.site_id
=
line.site_id
=
item.site_id
=
warehouse.site_id
```

cuando item existe.

## 10.9 Return

Requerir:

```text
req.site_id
=
line.site_id
=
receipt item site
=
return warehouse site
```

## 10.10 Export

Mismo scope de cabecera antes de cargar datos.

## 10.11 Documents

Mismo scope de cabecera antes de:

- upload;
- download;
- preview;
- review;
- link evidence;
- void.

## 10.12 Selectors

Requisition builder:

solo items de sites autorizados y con site definido.

Warehouse selector:

solo warehouse del site de la requisición.

Legacy warehouse NULL:

no disponible para requisiciones site-owned.

---

# 11. Generación automática objetivo

## 11.1 Cambio de grouping

Actual:

```text
organization + supplier
```

Objetivo:

```text
organization + site + supplier
```

## 11.2 Ejemplo

Entrada:

```text
Org A
Supplier X
Item 1 → Site Medellín
Item 2 → Site Bogotá
Item 3 → Site Medellín
```

Resultado futuro:

```text
REQ-N → Org A / Medellín / Supplier X
  Item 1
  Item 3

REQ-N+1 → Org A / Bogotá / Supplier X
  Item 2
```

## 11.3 Cantidad de requisiciones

Puede aumentar.

Hoy:

`1 por supplier/org`.

Futuro:

`1 por supplier/site/org`.

La UI debe previsualizar ese número correctamente.

## 11.4 Threshold de aprobación

Impacto material:

Threshold = 1000.

Hoy:

```text
A1 = 600
A2 = 600
mismo supplier
→ una req de 1200
→ approval required
```

Futuro:

```text
req A1 = 600
req A2 = 600
→ cada una debajo de 1000
```

Si la política de negocio de threshold está definida “por requisición”, el nuevo resultado es coherente.

Si se pretendía aprobar por compra agregada a proveedor, se necesita una política adicional.

Esto debe confirmarse antes de implementar para no cambiar governance silenciosamente.

## 11.5 Productos con site NULL

No pueden formar una nueva requisición site-owned.

Opciones de UX futuras:

- excluirlos del builder con aviso;
- bloquear selección y señalar que el item debe asignarse a una sede.

No asignar automáticamente un site.

## 11.6 Productos

No cambia el producto ni supplier link.

Solo cambia agrupación.

## 11.7 Solicitudes pendientes

Las requisiciones existentes no deben re-generarse automáticamente.

El cambio aplica a nuevas creaciones después del cutover.

---

# 12. Almacenes y centros de costo

## 12.1 Warehouse actual

La UI de detalle para limited user hoy incluye:

```text
authorized site
OR
warehouse.site_id IS NULL
```

Las rutas mutation excluyen NULL para limited users, pero permiten cualquier site autorizado.

Esto genera dos problemas:

1. selector puede mostrar legacy NULL que mutation rechaza;
2. usuario A+B puede usar warehouse B para línea A.

## 12.2 Regla futura

Para requisición A:

```text
warehouse A → permitido
warehouse B → rechazado
warehouse NULL → rechazado
```

incluso si el usuario tiene acceso a A+B.

El acceso global permite elegir cuál requisición/site operar, no mezclar sites dentro de la requisición.

No se encontró una operación explícita actual que legitime recepción cross-site.

Las transferencias de Inventario son el mecanismo separado para mover stock después de recibir.

## 12.3 Cost center

Como no existe master, no se puede aplicar todavía una FK site-aware.

Si se estructura el master, el selector futuro debe estar filtrado por:

`requisition.site_id`.

Un CC-B nunca debe ser seleccionable para línea de req A.

---

# 13. Compatibilidad hacia atrás

## 13.1 APIs que podrían romper

Toda query que haga INSERT directo a `supplier_requisitions` sin site fallará cuando site sea obligatorio.

Los smoke fixtures son ejemplos actuales.

Por eso el rollout debe ser:

1. columna nullable;
2. backfill;
3. actualizar writers;
4. actualizar tests;
5. resolver legacy;
6. NOT NULL final.

## 13.2 Server Components

Listado/detalle deben seleccionar site.

No asumir que todas las cabeceras históricas tendrán site durante transición.

## 13.3 Approval

Cabeceras legacy NULL requieren política temporal.

No romper decisiones/estado históricos.

## 13.4 Receipts y returns

No reescribir inventory transactions existentes.

Para nuevos receipts, usar req.site como frontera.

## 13.5 Procurement documents

No mover ni duplicar archivos existentes.

Un documento sigue unido a su requisición histórica.

## 13.6 Analytics

Supplier procurement analytics deben hacerse site-aware para usuarios limitados.

No modificar analytics globales de plataforma si su scope legítimo es global.

## 13.7 Seeds/tests

No seed automático.

Fixtures deberán insertar site en cabecera una vez que la ruta de migración lo exija.

## 13.8 Migraciones anteriores

No modificar 028/033/034/035/036/047.

Agregar nueva migración incremental.

## 13.9 Assets / Work Orders / Kardex

No requieren cambio para hacer requisición site-owned.

No tocarlos.

---

# 14. Riesgos

## 🔴 Históricos mixed-site

No pueden convertirse a una sede sin decisión humana.

## 🔴 Históricos con line.site_id NULL

No existe derivación inequívoca garantizada.

## 🔴 Threshold

Separar una compra por site puede cambiar si la política dispara aprobación.

Debe aceptarse explícitamente.

## 🔴 Procurement document multi-site histórico/futuro

Si un proveedor emite una sola factura que cubre varias sedes, el nuevo modelo genera varias requisiciones.

El modelo actual de `procurement_documents` solo admite un `requisition_id`.

Debe definirse si operacionalmente:

- el documento se registra por site/requisición;
- o en una fase futura se soporta evidencia vinculada a múltiples requisiciones.

No resolver en I2-A2.2 silenciosamente.

## 🔴 Centro de costo sin entidad

La regla de site no puede verificarse mientras sea texto libre.

## 🟡 Supplier analytics

KPIs actuales son supplier-wide y pueden mezclar sites.

## 🟡 Warehouse cross-site

Hoy es posible para usuario con varios sites/all-sites; debe cerrarse al adoptar site ownership.

## 🟡 Legacy warehouse NULL

No usable en nuevas requisiciones site-owned.

## 🟡 Site-null inventory item

No puede convertirse en nueva requisition line sin asignación explícita.

## 🟢 Organization isolation

El organization scope existente puede reutilizarse; no hace falta RBAC nuevo.

## 🟢 Approval model

Una requisición single-site encaja naturalmente con una aprobación por cabecera.

---

# 15. Smoke plan

Crear durante implementación futura:

`scripts/inventory-i2a2-requisitions-site-smoke.mjs`

No se crea en esta etapa.

## 15.1 Aislamiento

1. user A no lista req B;
2. user B no lista req A;
3. user A+B lista ambas;
4. accessAllSites lista ambas;
5. user A no abre detail B por UUID;
6. user A no exporta B;
7. user A no descarga documento B.

## 15.2 Creación

8. items A + mismo supplier → una req A;
9. items B + mismo supplier → una req B;
10. selección A+B → dos req, nunca una mixed;
11. dos suppliers dentro de A → dos req;
12. A+B y dos suppliers → grupos por org+site+supplier;
13. item site NULL → rechazado/no seleccionable;
14. item site no autorizado → rechazado server-side.

## 15.3 DB invariants

15. header organization A + site B → reject;
16. line site B bajo req A → reject;
17. inventory item B bajo line A → reject;
18. line organization distinta → reject.

## 15.4 Cost center

Cuando exista master estructurado:

19. CC-A + req A → allowed;
20. CC-B + req A → rejected.

Mientras no exista master, el smoke debe marcar esta capacidad como pendiente y no pretender validar strings.

## 15.5 Warehouse

21. warehouse A + req A → allowed;
22. warehouse B + req A → rejected incluso con sesión A+B, salvo que negocio defina explícitamente otra operación;
23. warehouse NULL + req A → rejected;
24. warehouse org B → rejected.

## 15.6 Receive

25. receipt A crea Kardex en warehouse A;
26. receipt no altera líneas de B porque no existen en req A;
27. estado partial/fulfilled sigue correcto.

## 15.7 Supplier return

28. return desde receipt A + warehouse A → allowed;
29. warehouse B → rejected;
30. relación receipt/requisition/item preservada.

## 15.8 Approval

31. req A se aprueba con user autorizado A;
32. user B no aprueba A;
33. threshold se calcula por req site-specific;
34. reopen approval sigue funcionando.

## 15.9 Documents

35. user A crea/revisa/descarga docs A;
36. user B no accede docs A;
37. reconciliation sigue cuadrando.

## 15.10 Legacy

38. single-site backfill derivable;
39. mixed-site no autoasignado;
40. null-site no autoasignado.

## 15.11 Regresión

Mantener y actualizar:

- requisition receipt;
- requisition approval;
- supplier return;
- procurement reconciliation;
- inventory scope;
- inventory transaction integrity;
- Kardex;
- Work Orders;
- Assets;
- build.

---

# 16. Orden recomendado de implementación

## Paso 0 — auditoría real de datos

Ejecutar conteos de la sección 8 en staging/producción.

No avanzar a constraints finales sin ellos.

## Paso 1 — migración estructural nullable

Agregar `supplier_requisitions.site_id`, FK, índices y estructuras necesarias para integridad organization/site.

No NOT NULL todavía.

## Paso 2 — backfill seguro

Solo requisiciones inequívocas single-site.

Emitir reporte de mixed/null.

## Paso 3 — helper de scope de Requisiciones

Crear una única abstracción reutilizable para:

```text
organization
+
site scope
```

y usarla consistentemente.

No reconstruir RBAC por ruta.

## Paso 4 — generación

Cambiar backend a:

`org + site + supplier`.

Rechazar item sin site.

Actualizar RequisitionBuilder para reflejar grouping.

## Paso 5 — listado/detail/supplier surfaces

Aplicar header site scope a:

- módulo;
- detail;
- supplier requisition view;
- supplier counts/analytics.

## Paso 6 — mutations

Aplicar header site scope a:

- edit;
- approval;
- receive;
- return.

En receive/return exigir warehouse del mismo site.

## Paso 7 — documents/export

Aplicar scope de requisición antes de cargar evidencia.

## Paso 8 — DB invariant line/header

Agregar garantía para nuevas lineas y, después de saneamiento, composite FK final.

## Paso 9 — cost center estructurado

Solo si se confirma el submodelo necesario:

- master site-owned;
- relation line → cost center;
- selectors/validation;
- sin reescribir texto histórico.

## Paso 10 — smoke permanente y regresiones

Crear smoke I2-A2.2 y actualizar fixtures existentes.

## Paso 11 — constraint final

Solo cuando auditoría confirme 0 ambiguos pendientes:

- NOT NULL;
- validar FKs;
- retirar compatibilidad temporal.

---

# 17. Lista exacta de archivos que probablemente deberán modificarse

## Esquema / integridad

- nueva `db/migrations/048_requisition_site_scope.sql`;
- posible migración posterior si centro de costo se estructura;
- no modificar migraciones anteriores.

## Scope compartido

- probable nuevo `lib/requisition-scope.ts` o helper equivalente reutilizable.

## Generación / UI de creación

- `app/api/requisitions/generate/route.ts`;
- `components/RequisitionBuilder.tsx`;
- `app/dashboard/inventory/page.tsx`;
- `app/api/suppliers/[id]/route.ts`;
- `components/SupplierDirectory.tsx`.

## Módulo Requisiciones

- `app/dashboard/requisitions/page.tsx`;
- `app/dashboard/requisitions/[id]/page.tsx`;
- `app/api/requisitions/[id]/route.ts`;
- `app/api/requisitions/[id]/approval/route.ts`;
- `app/api/requisitions/[id]/receive/route.ts`;
- `app/api/requisitions/[id]/returns/route.ts`;
- `app/api/requisitions/[id]/export/route.ts`;
- `app/api/requisitions/[id]/documents/route.ts`;
- `app/api/requisitions/[id]/documents/[documentId]/route.ts`.

## Proveedores / métricas relacionadas

- `app/dashboard/suppliers/page.tsx`;
- `app/api/suppliers/[id]/route.ts`;
- `lib/supplier-analytics.ts`;
- `components/SupplierDirectory.tsx`.

## Procurement interno

- revisar `lib/procurement-reconciliation.ts`;
- modificar solo si algún caller no puede garantizar la autorización previa o si se agregan assertions de site.

## Tests

- nuevo `scripts/inventory-i2a2-requisitions-site-smoke.mjs`;
- `scripts/requisition-receipt-smoke.mjs`;
- `scripts/requisition-approval-smoke.mjs`;
- `scripts/supplier-return-smoke.mjs`;
- `scripts/procurement-reconciliation-smoke.mjs`;
- `scripts/inventory-scope-smoke.mjs`;
- potencialmente smokes supplier analytics si deben validar site scope.

## CI

- `.github/workflows/ci.yml` para registrar el smoke nuevo durante implementación.

## Documentación

- documento de implementación I2-A2.2;
- changelog/manual solo cuando el comportamiento funcional se implemente.

---

# 18. Elementos que NO deben tocarse

I2-A2.2 no requiere modificar:

- I2-A1;
- paginación del Kardex;
- `lib/inventory-manual-movement.ts`;
- migración 047;
- `cmms_apply_inventory_transaction()`;
- lógica de stock;
- inventory transaction source of truth;
- Work Orders;
- Assets;
- FEFO;
- lot balances;
- valoración de inventario;
- materiales de Work Orders;
- RBAC global;
- permisos nuevos paralelos;
- numeración histórica de requisiciones;
- documentos históricos binarios;
- supplier return histórico;
- movimientos históricos de Kardex.

No editar migraciones 028–047 para “acomodar” el cambio.

La evolución debe ser incremental.

---

# 19. Decisiones aún necesarias

La decisión principal de dominio ya está tomada:

`una requisición = organización + sede + proveedor`.

Persisten estas decisiones antes de una implementación final completa:

1. **Históricos mixed-site:** política operativa para requisiciones existentes que no pueden backfillearse.
2. **Líneas históricas site NULL:** tratamiento manual/administrativo.
3. **Approval threshold:** confirmar que al separar por sede se evalúa por cada requisición site-specific.
4. **Documentos comerciales multi-sede:** qué hacer si una sola factura/remisión externa cubre varias nuevas requisiciones de distintas sedes.
5. **Centro de costo:** definir master, código/unicidad y si la selección pertenece a cada línea o a toda la requisición.
6. **Legacy headers sin site durante transición:** si permanecen operables hasta regularización o pasan a read-only.
7. **Warehouse cross-site para perfil global:** no se encontró una operación explícita actual; recomendación técnica es prohibirlo en Requisiciones y usar transferencias de Inventario, pero debe confirmarse como regla de negocio definitiva.

Ninguna de estas decisiones debe resolverse reasignando datos silenciosamente.

---

# 20. Conclusión

La conversión a entidad por sede es técnicamente viable sin rediseñar Procurement completo.

La arquitectura objetivo más estable es:

```text
supplier_requisitions.site_id
        ↓
cabecera = source of truth del site
        ↓
line.site_id debe coincidir
        ↓
item/site debe coincidir
        ↓
receipt/return warehouse debe coincidir
        ↓
document/export/approval heredan scope de la cabecera
```

El cambio clave no es solamente agregar una columna.

Debe hacerse coordinadamente en:

- generación;
- DB invariants;
- authorization scope;
- supplier auxiliary views;
- warehouse validation;
- exports/documents;
- test fixtures.

El histórico exige un rollout en fases porque no es seguro asignar site a requisiciones mixed/null sin datos externos.

El fixture CI disponible está vacío de datos persistentes y no representa producción. Los conteos históricos reales deben obtenerse mediante preflight SQL en la base objetivo antes de aplicar NOT NULL o dividir/regularizar ningún registro.

---

## Estado requerido por la instrucción

```text
DIAGNÓSTICO: COMPLETADO

HEAD:
03bfc3d0e1497884d64b080a4a5aaebe06072e92

CAMBIOS FUNCIONALES:
NINGUNO

MIGRACIONES:
NINGUNA

ARCHIVOS MODIFICADOS:
docs/INVENTORY_I2A2_REQUISITIONS_SITE_DIAGNOSIS.md

RIESGOS:
- históricos mixed-site
- líneas históricas sin site
- approval threshold cambia al separar grupos por sede
- documentos comerciales que cubran varias sedes
- centro de costo actual sin entidad/site
- warehouse cross-site permitido implícitamente en flujo actual
- legacy warehouse/item site_id NULL
- supplier requisition analytics actualmente organization-wide

DECISIONES AÚN NECESARIAS:
- tratamiento de históricos mixed-site
- tratamiento de line.site_id NULL
- confirmación de threshold por requisición/sede
- política de documentos externos multi-sede
- modelo maestro de centros de costo
- política temporal para headers legacy site NULL
- confirmar prohibición de warehouse cross-site incluso para perfil global

IMPLEMENTACIÓN RECOMENDADA:
1. preflight histórico real
2. site_id nullable + FK/índices
3. backfill inequívoco
4. helper único de scope
5. generación org+site+supplier
6. list/detail/supplier views site-aware
7. edit/approve/receive/return site-aware
8. warehouse exacto de la sede
9. document/export site-aware
10. invariantes DB line/header/item
11. cost center estructurado si aplica
12. smoke permanente + regresiones
13. resolver legacy ambiguo
14. NOT NULL/VALIDATE final
```
