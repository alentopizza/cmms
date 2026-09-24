# Development handoff

> Última revisión: 2026-09-24  
> Repositorio: `alentopizza/cmms`  
> Rama de trabajo/despliegue: `main`  
> HEAD revisado antes de crear este handoff: `c32037e638eb6f1c1d83bfd68f8a54c939f3ba99`

Este documento es el punto de entrada operativo para una IA o desarrollador que retome Desweb CMMS. No reemplaza la documentación temática; resume **dónde está el producto hoy, qué se acaba de tocar, qué invariantes no deben romperse y cómo continuar sin depender del historial de conversación**.

## 1. Cómo retomar el proyecto

Antes de modificar código:

1. Leer `AGENTS.md`.
2. Leer este documento.
3. Consultar `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DESIGN_SYSTEM.md`, `docs/FUNCTIONAL_MODEL.md` y `docs/ROLE_MODEL.md` según el módulo a intervenir.
4. Revisar la parte superior de `docs/CHANGELOG.md` para conocer los últimos cambios reales.
5. Revisar `docs/ROADMAP.md` antes de abrir una línea funcional nueva.
6. Cuando el cambio sea visible para el usuario, revisar también `lib/user-manual.ts`.

La documentación del repositorio es la fuente de continuidad. Las conversaciones sirven para intención y referencias visuales, pero las reglas permanentes deben quedar expresadas aquí, en `AGENTS.md` o en la documentación temática.

## 2. Estado técnico actual

Desweb CMMS es una aplicación **Next.js 16 + React 19 + TypeScript + PostgreSQL**. No usa ORM; la persistencia y las migraciones son SQL explícito.

Piezas principales:

- `app/dashboard/*`: módulos autenticados.
- `app/api/*`: rutas de lectura/mutación y límites de autorización.
- `components/*`: UI compartida y flujos complejos.
- `lib/*`: autenticación, RBAC, negocio, catálogos y utilidades.
- `db/migrations/*`: migraciones inmutables y ordenadas.
- `docs/*`: decisiones, arquitectura, diseño, roadmap y contexto.
- `lib/user-manual.ts`: manual visible para usuarios y feed **Qué cambió**.

La aplicación se despliega desde `main` con Docker y PostgreSQL. El health check contractual es `/api/health`.

## 3. Módulos y capacidades ya implementadas

El repositorio ya contiene, entre otros:

- Empresas y perfil empresarial.
- Ubicaciones principales y sububicaciones.
- Activos.
- Órdenes de trabajo y actividades.
- Mantenimiento preventivo.
- Inventario.
- Proveedores.
- Requisiciones por proveedor.
- Usuarios, roles y alcance por empresa/sede.
- Cuadrillas.
- Asistencia facial 1:1 con geocerca.
- Enrolamiento biométrico supervisado.
- Contingencia de asistencia.
- Reacción: mapa de sedes/técnicos, sesiones de tracking y trayecto reciente.
- Horarios flexibles por día.
- Documentos empresariales con archivo/restauración.
- Catálogo internacional País → Ciudad → identificación → indicativo → zona horaria.
- Configuración de idioma/región como base de i18n.
- Hoja de vida exportable de entidades.
- Dashboard por rol y exportes.
- Personalización/branding y white-label Pro.
- Manual híbrido público/autenticado.

Las relaciones operativas importantes deben seguir usando sus fuentes autoritativas actuales; no crear tablas paralelas para “simplificar” vistas.

## 4. Trabajo más reciente en `main`

La última tanda de cambios del 24 de septiembre de 2026 se concentró en **Usuarios y Proveedores**.

### Usuarios

- El directorio usa tarjetas compactas de identidad personal.
- La fotografía es circular y se superpone correctamente al banner.
- Se eliminó del directorio la exposición de estados ambiguos como **Offline** y **Pendiente**; esos estados siguen disponibles en la ficha donde tienen contexto.
- La desactivación/reactivación usa un icono de estado/power y no el icono de borrado.
- Se añadió acción directa de WhatsApp cuando existe teléfono.
- El directorio no ejecuta las estadísticas pesadas.
- La estadística detallada se carga bajo demanda desde `/api/users/[id]/statistics`.
- Un fallo en estadísticas debe afectar únicamente la pestaña Estadísticas, no derribar `/dashboard/users`.
- La ficha de Usuario/Técnico usa el workspace en página y el dashboard visual de estadísticas operativas.

Archivos clave:

- `app/dashboard/users/page.tsx`
- `app/dashboard/users/UserManagement.tsx`
- `components/UserStatisticsDashboard.tsx`
- `app/api/users/[id]/statistics/route.ts`

### Proveedores

- El directorio usa tarjetas comerciales diferenciadas de las de Usuario.
- El logo es cuadrado redondeado y se superpone al banner.
- Se preservan tipo de proveedor, contexto comercial, contadores y acciones rápidas.
- La eliminación del proveedor usa `ConfirmDialog`, no `window.confirm()`.
- La ficha de proveedor sigue el workspace en página con tabs.
- Requisiciones, actividades, documentos e inventario se proyectan desde las relaciones existentes.

Archivos clave:

- `app/dashboard/suppliers/page.tsx`
- `components/SupplierDirectory.tsx`
- `app/api/suppliers/*`
- `app/api/requisitions/*`

### Densidad responsive aprobada

Para directorios compactos de Usuarios y Proveedores:

- escritorio estándar: 4 tarjetas por fila;
- escritorio muy ancho: 5 tarjetas por fila si la legibilidad se mantiene;
- anchos menores: 3 / 2 / 1;
- no ganar columnas sacrificando tipografía o acciones.

Las dos entidades comparten densidad, no lenguaje visual.

## 5. Invariantes que no deben romperse

### Multiempresa y autorización

- PostgreSQL es el sistema de registro.
- El alcance por organización/sede se valida **en servidor**.
- Ocultar o deshabilitar controles del cliente nunca reemplaza RBAC.
- Las métricas, exportes y búsquedas no pueden ampliar el conjunto autorizado.
- Las dependencias de creación se evalúan por empresa, nunca mezclando jerarquías de empresas distintas.

### Perfiles de entidad

Empresa, Ubicación, Sububicación, Usuario/Técnico y Proveedor usan ficha **en la misma página**:

- breadcrumbs;
- identidad/estadísticas/acciones a la izquierda;
- tabs independientes a la derecha;
- cambiar de tab reemplaza el contenido, no agrega secciones infinitas debajo;
- los detalles principales no deben volver a ser modales.

### Biometría y ubicación

- Asistencia facial = verificación 1:1 del usuario autenticado.
- Enrolamiento inicial = supervisado.
- Foto de perfil ≠ plantilla biométrica.
- Geolocalización de Asistencia se valida en servidor.
- Reacción es tracking operativo separado de Asistencia.
- La web/PWA no garantiza tracking de fondo tipo app de transporte cuando el sistema operativo suspende el navegador.
- Analítica de trabajadores es descriptiva; no convertirla en ranking automático o decisión laboral.

### Empresas, horarios, documentos y teléfonos

- Dirección legal/administrativa de empresa y dirección operativa de sede son conceptos distintos.
- `business_schedule` es la fuente rica de horarios variables por día.
- Archivar un documento es reversible y diferente de borrado permanente.
- País conocido → prefijo telefónico derivado → usuario ingresa número nacional.
- WhatsApp/llamada son atajos de interfaz, no acciones privilegiadas.

### Proveedores y requisiciones

- Actividades de servicio: `work_order_tasks.service_supplier_id`.
- Suministros/inventario: `inventory_items.supplier_id`.
- Cada requisición pertenece a un solo proveedor.
- Una selección con varios proveedores se separa en requisiciones independientes en servidor.
- Requisitar no aumenta stock.
- Eliminar un proveedor con historia relacionada debe bloquearse y conservar trazabilidad.

## 6. UX y diseño vigentes

La dirección visual aprobada es un sistema Desweb moderno, profesional y dimensional:

- usar las variables de marca;
- mantener paridad claro/oscuro;
- profundidad y glass controlados, no neón decorativo;
- hover/focus/selección pueden tener mayor énfasis;
- iconos compartidos con `UiIcon`;
- modales y confirmaciones deben usar componentes del producto;
- formularios y tarjetas deben tener comportamiento móvil en la misma implementación;
- no reintroducir texto diminuto para forzar densidad.

En móvil:

- roles con muchos módulos usan drawer/hamburguesa;
- Técnico y colaborador externo usan navegación inferior de campo + **Más**;
- la visibilidad proviene de la misma navegación filtrada por permisos.

## 7. Internacionalización y formularios regionales

Los datos regionales se centralizan en `lib/international-catalog.ts`.

No introducir listas locales de países, ciudades, prefijos o tipos de documento.

Usar:

- `components/InternationalFields.tsx`;
- `components/PhoneField.tsx`;
- validación equivalente del lado servidor.

La preferencia de locale ya se persiste, pero eso **no significa que toda la interfaz esté traducida**.

## 8. Migraciones y modelo de datos

Las migraciones son inmutables y actualmente llegan al menos hasta:

- `037_unified_inventory_import.sql`.

Ante un cambio de esquema:

1. crear una migración nueva;
2. no editar migraciones históricas aplicadas;
3. mantener compatibilidad cuando exista un campo legado todavía consumido;
4. documentar el nuevo límite en Arquitectura/Decisiones si afecta el modelo.

## 9. Estado de validación automática

El repositorio sí contiene `.github/workflows/ci.yml`. En cada push a `main` y en Pull Requests ejecuta `npm install` y `npm run build` con Node 24 y variables de entorno CI.

`package.json` no define actualmente scripts separados de `test` o `lint`; sí define `dev`, `build`, `start`, `migrate` y `seed`.

Durante la implementación del Dashboard por rol, los commits que contienen los cambios de código y manual fueron verificados por GitHub Actions con conclusión **success**. Aun así, un build exitoso valida compilación/empaquetado, no sustituye pruebas funcionales con datos reales, revisión de autorización ni validación visual responsive.

## 10. Prioridades que ya aparecen en el roadmap

La **Fase 1 de abastecimiento** ya está implementada y validada:

- recepción física de requisiciones contra Inventario/Kardex;
- conciliación parcial y total contra `quantity_received`;
- trazabilidad Requisición → ítem → movimiento Kardex;
- progreso de recepción en Requisiciones y ficha de Proveedor;
- exportes con solicitado / recibido / pendiente;
- historial de importaciones masivas y recuperación de suministros inactivos.

La **Fase 2 de abastecimiento** también está implementada:

- política configurable de aprobación por empresa: sin aprobación, todas las requisiciones o desde un monto estimado;
- alcance de aprobador configurable: Administrador o Administrador + Manager/Supervisor;
- autoaprobación del solicitante bloqueada por defecto;
- snapshot de política en cada requisición;
- aprobación/rechazo servidor-autoritativos con auditoría;
- recepción/Kardex bloqueados mientras una aprobación requerida no esté vigente;
- cambio posterior de cantidad, costo estimado o fecha requerida reabre la aprobación;
- historial de eventos requested/amended/approved/rejected/reopened y audit log general;
- estado de aprobación visible en Requisiciones, Proveedor y exportes.

La **Fase 3 de abastecimiento** también está implementada:

- KPIs comerciales de proveedor basados en recepciones físicas de requisiciones durante los últimos 12 meses;
- lead time promedio desde Enviada/creación hasta primera recepción;
- cumplimiento ponderado de cantidad;
- porcentaje de requisiciones completas dentro de `needed_by`;
- variación ponderada entre costo real recibido y costo estimado para las mismas cantidades;
- tendencia mensual de seis meses y tabla de requisiciones recientes como evidencia;
- paridad de los KPIs en la exportación PDF/XLSX/Word de la ficha del proveedor;
- smoke test PostgreSQL específico incorporado a CI.

La **Fase 4 de abastecimiento** también está implementada:

- devolución física al proveedor desde la requisición y contra una recepción origen;
- movimiento de Kardex `supplier_return` que descuenta stock sin alterar el movimiento `return` existente;
- DEV inmutable con motivo, resolución esperada, documento, fecha, usuario y líneas;
- control de cantidad devuelta contra la recepción origen y control de stock contra la bodega de salida;
- trazabilidad DEV → requisición → ítem → recepción → Kardex;
- visualización en Requisición, Proveedor y Kardex;
- exportes de Requisición y Kardex incluyen DEV y recepción origen;
- smoke test PostgreSQL específico incorporado a CI.

La **Fase 5 de abastecimiento** también está implementada:

- documentos comerciales inmutables de Orden de compra, Remisión/entrega, Factura, Nota crédito y Otros;
- líneas documentales asociadas a los SKUs de la requisición;
- Remisiones/Facturas vinculables a recepciones físicas y Notas crédito vinculables a DEV de proveedor;
- conciliación automática de cantidad/valor con estados Coincide, Con diferencia, Pendiente de evidencia, Informativo y Anulado;
- revisión humana separada: Pendiente, Verificado, Excepción aceptada y En disputa;
- nueva evidencia reabre la revisión a Pendiente;
- descarga/vista previa segura, anulación con motivo y eventos de auditoría;
- visibilidad resumida en Requisiciones y Proveedor;
- exportes de requisición con conciliación cuando el usuario tiene `requisitions.reconcile`;
- smoke test PostgreSQL específico incorporado a CI.

Con las Fases 1–5 de abastecimiento completadas, el siguiente trabajo acordado es una revisión global de lógica, flujo y visual del sistema, junto con los próximos cambios de producto definidos por el usuario.

Como primer ajuste de esa revisión global, la importación de Inventario/Kardex fue corregida a un modelo **único Global/Contextual**:

- una sola plantilla `PLANTILLA_INVENTARIO_KARDEX_DESWEB.xlsx`;
- un solo motor `POST /api/bulk-import`;
- `lib/inventory-import-service.ts` centraliza resolución de proveedor/contexto;
- Inventario inicia Global y distribuye múltiples proveedores;
- Proveedor inicia Contextual y permite Solo este proveedor o Importar todo;
- Importar todo vuelve a ejecutar reglas Globales y no hereda silenciosamente el proveedor abierto;
- proveedor por fila se resuelve ID → NIT → código → nombre;
- Kardex hereda proveedor desde SKU y bloquea inconsistencias;
- servicios no producen stock/Kardex;
- validación previa incluye stock simulado y errores estructurados;
- SKU existentes exigen decisión Comparar/Actualizar/Omitir;
- cada lote confirmado conserva IMP, origen, contexto, alcance e importados/omitidos.

No ejecutar automáticamente esta lista por estar en el roadmap: cada nueva implementación debe partir del requerimiento actual del producto.

## 11. Regla de documentación por cambio

Para cada cambio significativo:

- **Código**: implementar el comportamiento.
- **CHANGELOG**: registrar cambio visible o corrección relevante.
- **Arquitectura/Decisiones/Modelo funcional**: actualizar si cambia un límite o flujo.
- **DESIGN_SYSTEM / AGENTS**: actualizar si nace una regla reusable.
- **Manual**: actualizar artículo y/o **Qué cambió** si afecta cómo el usuario realiza una tarea.
- **Este handoff**: actualizar cuando cambie el estado global del producto, la zona activa de trabajo o la forma recomendada de retomar el proyecto.

El objetivo es que un tercero pueda reconstruir la intención del sistema desde el repositorio sin necesitar la conversación original.


## 12. Active checkpoint — role dashboard analytics (2026-09-24)

The root Dashboard was redesigned after the supplied admin-dashboard visual reference.

Current implementation:
- reusable analytical UI in `components/DashboardAnalytics.tsx`;
- role-aware KPI sets for Platform Owner, Superadministrator, Admin, Manager, Viewer, Technician, External collaborator, Provider and Requester;
- current-period vs previous-equivalent-period comparison by default;
- optional same-period-previous-year comparison;
- six-month real PostgreSQL trend series;
- tenant/field/requester Site and Priority filters;
- existing status/date filters preserved;
- Excel/CSV/PDF export route updated to preserve Site/Priority/status/period authorization scope;
- responsive Desweb visual treatment in `app/globals.css`;
- user manual and source-of-truth documentation synchronized.

Important implementation boundaries:
- Site filters are a narrowing predicate after session Organization/Site authorization, never a replacement for it.
- Comparison-period queries reuse the same role and contextual filters as the current period.
- Provider dashboards only expose Supplier-assigned Activities and do not expose worker attendance.
- Technician/External metrics are descriptive; do not introduce leaderboard ordering or employment scoring.
- Snapshot KPIs such as currently visible Assets may not have a historical comparison until an appropriate history model exists; do not fabricate one.

Primary files for the next contributor:
- `app/dashboard/page.tsx`;
- `components/DashboardAnalytics.tsx`;
- `components/DashboardControls.tsx`;
- `lib/dashboard-filters.ts`;
- `app/api/dashboard/export/route.ts`;
- dashboard section at the end of `app/globals.css`.


## 13. Active checkpoint — conditional facets, Supplier catalogs and administrative dossiers (2026-09-24)

The primary directory filter system now supports **conditional cascading facets** through `ModuleHeader`.

Behavior:
- a facet is derived only from records already authorized and rendered by the server;
- Company/Site/etc. filters disappear when fewer than two meaningful options exist;
- selecting a parent facet narrows options in the other facets;
- filters never broaden Organization/Site/RBAC scope.

Directories currently using contextual facets:
- Companies: plan, Country, City;
- Locations: Company, Country, City; Sublocations add Type internally when useful;
- Users: Company, Role, Site, linked Supplier;
- Suppliers: Company, capability/type, specialty, Country;
- Assets: Company, Site, Criticality, Category, Supplier;
- Inventory: stock level, Company, Site, Supplier;
- Work Orders: status, Company, Site, Priority, Type;
- Maintenance: Company, Site, frequency;
- Crews: Company, Site;
- Requisitions: status, Company, Supplier, requester.

Migration 029 adds:
- standardized multi-value Supplier capability/specialty catalogs and junctions;
- User personnel documents;
- User emergency contacts;
- Supplier financial/payment-preparation profiles.

Supplier forms must use catalog codes through `MultiSelectDropdown`. Preserve the derived legacy `supplier_type` field because Inventory and service-assignment consumers still depend on `materials/services/both`.

User document routes remain behind `users.manage` and tenant scope. Supplier financial data remains behind `suppliers.manage`; read summaries mask account numbers and the CMMS does not execute payments.

Primary files for this checkpoint:
- `components/ModuleHeader.tsx`;
- `components/MultiSelectDropdown.tsx`;
- `db/migrations/029_supplier_catalog_user_dossier_financial.sql`;
- `app/dashboard/users/UserManagement.tsx`;
- `app/api/users/[id]/documents/*`;
- `app/api/users/[id]/emergency-contact/route.ts`;
- `app/dashboard/suppliers/page.tsx`;
- `components/SupplierDirectory.tsx`;
- `app/api/suppliers/*`.


## 14. Active checkpoint — Dashboard recovery, PhoneField and Crews (2026-09-24)

### Dashboard resilience
`app/dashboard/page.tsx` now isolates failures in role-specific analytical queries. After authentication resolves, exceptions from platform/operation/field/requester analytics are logged and render an authorized recovery panel instead of Next.js' generic full-page server error. Do not remove this boundary when extending KPI queries.

### PhoneField
`nationalPhonePart()` distinguishes explicit E.164 values (leading `+`) from legacy national-only values. For E.164 values it strips the configured Country calling code immediately, even when only one national digit has been typed. This prevents the controlled User edit form from injecting `57`/other Country prefixes back into the national-number input.

### Crews
Crew composition now includes roles:
- `manager` → displayed as Supervisor;
- `technician`;
- `external`.

The leader is an explicit selection from eligible personnel, is automatically part of `crew_members`, and does not need a special role. Candidate and server validation require the same Organization and access to the selected Site.

The current Crew directory is leader-forward: leader photo/contact panel, team identity, activity counters and member roster. Creation uses `components/CrewCreateForm.tsx` for visual leader/member selection.


## 15. Dashboard SQL regression checkpoint — 2026-09-24

The production Dashboard failure after the role-analytics redesign was traced to PostgreSQL parsing of the unquoted output alias `month` in `to_char(date_trunc(...),'YYYY-MM') month`.

Approved pattern:

```sql
SELECT to_char(date_trunc('month',some_timestamp),'YYYY-MM') AS "month"
```

Do not reintroduce the unquoted `month` alias in Dashboard SQL.

The Company/Admin dashboard no longer replaces the whole workspace with a safe-mode card when one analytical query fails. Core and secondary analytical queries are isolated so operational navigation and successful Dashboard data remain visible.

CI is now database-aware:
1. PostgreSQL 17 service starts;
2. `npm run migrate` applies the full schema;
3. `scripts/dashboard-sql-smoke.mjs` executes representative Dashboard SQL for every role family;
4. `npm run build` runs only after SQL validation succeeds.

This regression test is intentionally kept because the previous build-only CI could compile TypeScript successfully while shipping invalid PostgreSQL runtime SQL.


## 16. Supplier profile UX checkpoint — 2026-09-24

Supplier profiles use one export surface only: the toolbar-level `ProfileExportMenu`. Do not reintroduce a separate Supplier "Hoja de vida" tab with another exporter.

The Financial tab uses two mutually exclusive client states:
- default read-only summary with masked account number and **Editar**;
- edit form with **Cancelar** and **Guardar información financiera**.

The financial POST continues redirecting to `?supplier=<id>&tab=financial&updated=1`; because the client state initializes as read-only, saving returns the operator to the summary rather than leaving a duplicate form visible.

`ProfileExportMenu` now accepts an optional `documentLabel`. Supplier profiles pass `Ficha del proveedor`; other entities retain their existing default terminology.


## 17. Inventory / Assets / Kardex checkpoint — 2026-09-24

The operational design is documented in `docs/INVENTORY_ASSETS_IMPORT.md`.

Key invariants for future work:

- `inventory_transactions` is the authoritative event stream for new stock changes.
- Do not directly increment/decrement `inventory_items.quantity` from UI/API code. Insert a Kardex transaction and let `cmms_apply_inventory_transaction()` update warehouse and aggregate balances.
- Opening stock for new items must also be a Kardex `receipt`.
- Negative stock is rejected in PostgreSQL.
- Transfers require distinct source/destination warehouses and preserve total organization stock.
- Bulk import is two-phase: validate first, commit only when validation has zero blocking errors.
- `bulk_import_batches.file_hash` prevents committing the exact same file twice.
- Supplier-scoped imports must pass `supplier_id`; rows for another supplier are rejected.
- The legacy/demo spreadsheet shape `Productos + Bodegas + Kardex` is intentionally supported. `Servicios tercerizados` rows are warnings/skipped rather than inventory errors.
- The standard generated inventory template is `LEEME + Catálogos + Bodegas + Inventario + Kardex`.
- Provider tab `Inventarios / suministros` is now an operational surface, not read-only projection. It can create/import/edit/deactivate stock masters while the full Kardex stays in Inventory.
- Global Requisitions can select multiple suppliers and split automatically; supplier-profile Requisitions is fixed to one supplier.
- Requisition item quantities/costs may be edited while open. Fulfilled, closed and cancelled requisitions lock item editing.
- Received requisition items cannot be removed and requested quantity cannot be reduced below quantity already received.

Database migrations:
- `030_bulk_import_inventory_kardex.sql`
- `031_inventory_kardex_metadata.sql`

Regression validation:
- `scripts/inventory-kardex-smoke.mjs` runs in CI after migrations and before the production build.


### Inventory / Assets operational surface extension — 2026-09-24

After the bulk-import checkpoint, the UI/API surface was extended so the modules are not import-only:

- `components/InventorySubnav.tsx` is the shared navigation contract for Inventory subpages.
- `/dashboard/inventory/categories` + `/api/inventory/categories/*` manage standardized inventory categories.
- `/dashboard/inventory/warehouses` + `/api/inventory/warehouses/*` manage physical stock locations.
- `/dashboard/inventory/kardex` + `/api/inventory/movements` provide the global movement workspace.
- `/api/module-export?entity=kardex` exports Kardex independently in XLSX/CSV/PDF and supports a movement-type filter.
- Inactive inventory masters remain queryable in the main Inventory directory and may be reactivated. Never hard-delete an item only to remove it from an operational list.
- `/api/assets/[id]` is the complete asset mutation endpoint; the asset detail page is the normal edit surface for tenant operators.
- Inventory/Asset images use authenticated endpoints (`/api/inventory/:id/image`, `/api/assets/:id/image`). Do not expose raw bytea data or public object URLs.


## 18. Requisition receiving checkpoint — 2026-09-24

Supplier Requisitions now reconcile physical delivery directly with Inventory/Kardex.

Implementation contract:

- `POST /api/requisitions/[id]/receive` is the only requisition-aware stock receipt flow.
- It requires both `requisitions.write` and `inventory.write`.
- Receipt rows are processed inside one PostgreSQL transaction.
- Never update `inventory_items.quantity` directly from this route; insert `inventory_transactions.type='receipt'` and let the Kardex trigger own stock mutation.
- Never increment `quantity_received` before the Kardex insert succeeds.
- Do not allow receipt quantity above `quantity_requested - quantity_received`.
- Requisition items without an active `inventory_item_id` cannot be received until their master-data link is repaired.
- Receipt warehouses must belong to the same Organization.
- A partially completed requisition becomes `partial`; a fully completed requisition becomes `fulfilled` and gets `fulfilled_at`.
- `inventory_transactions.requisition_id` and `requisition_item_id` are the traceability link back to Purchasing.
- Global Kardex shows a link to the originating REQ and Kardex export includes the requisition reference.
- Requisition PDF/XLS/Word exports include requested, received and pending quantities.
- Supplier profile and global Requisitions directory both display receiving progress.

Database migration:
- `033_requisition_inventory_receipts.sql`

Regression:
- `scripts/requisition-receipt-smoke.mjs`
- CI runs it after `inventory-kardex-smoke.mjs` and before the production build.


### Supplier inventory and import audit extension — 2026-09-24

- Supplier-profile Inventory shows active and inactive item masters; inactive items retain full Kardex/history and can be reactivated.
- Requisition builders must exclude inventory items where `active=false`.
- Supplier-profile item create/edit uses multipart forms so the same authenticated product-image pipeline as Inventory is preserved.
- Supplier-scoped bulk imports and template downloads resolve `organization_id` from the Supplier for platform-level sessions. Tenant sessions must still match their own organization.
- `/api/bulk-import/history` exposes only organization-scoped recent import batches and is used by `BulkImportModal` as the user-visible import audit trail.


## 19. Supplier commercial analytics checkpoint — 2026-09-24

Supplier Statistics now has a procurement-performance layer implemented in `lib/supplier-analytics.ts`.

Implementation contract:

- the analytical source is requisition-linked physical `receipt` transactions, not UI status counters;
- the summary window is the last 12 months based on first receipt date;
- lead time = `COALESCE(sent_at,created_at)` to first receipt;
- quantity fulfillment = received/requested, capped at 100%;
- on-time completion only includes fully received requisitions with `needed_by`, using last receipt as completion date;
- price variance compares actual receipt value against estimated value for those exact received quantities;
- all KPI surfaces expose sample size or an insufficient-history state;
- no composite Supplier score/ranking is generated;
- Supplier profile export reuses the same server-side function;
- six-month trends must keep the PostgreSQL alias `AS "month"` quoted;
- regression coverage: `scripts/supplier-analytics-smoke.mjs`.

This checkpoint intentionally avoids a new analytics persistence table. The existing requisition and Kardex history remains authoritative.


## 20. Supplier returns checkpoint — 2026-09-24

Supplier returns are now a procurement-specific outbound flow.

Implementation contract:

- `POST /api/requisitions/[id]/returns` requires both `requisitions.write` and `inventory.write`;
- returns are created only against an existing requisition-linked physical receipt;
- `supplier_returns` stores the immutable DEV header and `supplier_return_items` stores receipt-linked lines;
- `inventory_transactions.type='supplier_return'` is outbound and decreases stock;
- existing `inventory_transactions.type='return'` remains inbound to Inventory and must not be repurposed;
- gross `quantity_received` is historical evidence and is not decremented by a supplier return;
- returnable quantity is source receipt quantity minus prior DEV lines linked to that receipt;
- selected warehouse must be authorized and PostgreSQL rejects the movement if available stock would become negative;
- DEV rows are immutable; correction requires a future compensating/documented flow rather than deleting history;
- expected resolution is captured as replacement, credit note or other, but Phase 4 does not auto-reopen the requisition or perform document reconciliation;
- regression coverage: `scripts/supplier-return-smoke.mjs`.


## 21. Procurement document reconciliation checkpoint — 2026-09-24

Implementation contract:

- `requisitions.reconcile` is restricted to tenant Admin/Manager and platform operators;
- Site-limited users may reconcile only when their scope covers every requisition item;
- `POST /api/requisitions/[id]/documents` records immutable document/file/line evidence;
- `POST /api/requisitions/[id]/documents/[documentId]` appends evidence, reviews or voids while locking the document row;
- `GET /api/requisitions/[id]/documents/[documentId]` serves private evidence with authenticated scope checks;
- receipt links are valid only for Delivery note/Remission and Invoice;
- Supplier-return links are valid only for Credit note;
- Purchase order reconciles against requested requisition quantity/value;
- Delivery note reconciles quantity against linked receipts;
- Invoice reconciles quantity/value against linked receipts;
- Credit note reconciles quantity/value against linked DEV records;
- evidence inserts reopen review to Pending at PostgreSQL level;
- document match tolerance is 0.001 quantity and 0.01 value;
- document/review actions never change Kardex or `quantity_received`;
- regression coverage: `scripts/procurement-reconciliation-smoke.mjs`.


## 22. Unified Inventory/Kardex import checkpoint — 2026-09-24

Implementation contract:

- Inventory and Supplier-profile import entry points render the same `BulkImportModal` and call the same backend;
- the master template sheet schema is fixed: INSTRUCCIONES, INVENTARIO, KARDEX, PROVEEDORES, BODEGAS and CATALOGOS;
- `data=current` changes preloaded master rows only; it leaves KARDEX blank and STOCK_INICIAL=0;
- `supplier=<uuid>` supplies launch context, not a different workbook schema;
- Global mode requires Supplier identity for each product;
- Context-only may inherit the selected Supplier and omits explicit other-Supplier rows;
- Import-all from a Supplier context means true Global mode;
- warehouse names must resolve to an existing warehouse or a BODEGAS-sheet definition;
- preflight catches negative stock before commit; PostgreSQL remains final stock authority;
- `source_movement_id` prevents duplicate external movements when MOVIMIENTO_ID is supplied;
- migration `037_unified_inventory_import.sql`;
- regression coverage `scripts/unified-inventory-import-smoke.mjs`.


## 23. Supplier-context Inventory create fix — 2026-09-24

The direct create form inside Supplier → Inventarios / suministros must not depend on `session.organizationId` for platform operators.

Current contract:

- `POST /api/inventory` reads `supplier_id` first;
- the Supplier's `organization_id` becomes the authoritative Organization for the create operation;
- tenant users are rejected if that Organization differs from their membership;
- Site/Sub-location/setup/limits/warehouse resolution run against that Supplier-owned Organization;
- redirect feedback returns to `/dashboard/suppliers?supplier=<id>&tab=inventory`;
- Supplier-context create uses `inventory_created` / `inventory_error` query keys, not generic Supplier create keys.


## 24. DESWEB Design System V2 governance checkpoint — 2026-09-24

The product owner supplied and approved a complete new Design System + UI Kit direction for the ERP.

### Canonical frontend sources

Read in this order before visual work:

1. `docs/DESIGN_SYSTEM.md`;
2. `docs/UI_KIT.md`;
3. `docs/DESIGN_MIGRATION_PLAN.md`;
4. relevant existing functional/profile/module invariants in this Handoff and `AGENTS.md`.

### Visual DNA

- Primary: `#72F1DC`
- Secondary: `#2C8780`
- Dark: `#1D1D2C`

The old `#293644/#38B2A9/#79CAC4/#BAE3E0` palette still exists in legacy CSS but is no longer valid for new UI work.

### Current technical reality

- Next.js 16 + React 19 + TypeScript;
- global CSS in `app/globals.css`;
- no Tailwind;
- no external component framework;
- existing shared components include patterns such as `UiIcon`, `ModuleHeader`, profile workspaces and confirmation dialogs, but the codebase still has substantial module-local styling.

### Migration rule

Do not visually refactor all modules at once.

Current next step is **Phase 1 — Foundations + technical UI Kit structure**:

- audit current CSS/tokens/hardcoded values;
- implement V2 token layer with controlled legacy aliases;
- establish UI Kit folders/contracts;
- decide how existing `UiIcon` maps into the single icon system;
- create initial `/ui-kit` playground shell;
- keep all existing APIs/RBAC/CRUD/business flows unchanged.

### Non-regression boundary

A visual PR does not authorize modifications to APIs, DB, authentication, permissions, calculations, integrations or business rules. If visual work exposes a functional defect, document it and separate the functional correction whenever possible.

### Phase sequence

0. Governance/documentation.
1. Foundations.
2. UI Core primitives.
3. Global shell/navigation.
4. Shared Data UI.
5. Business UI.
6. Dashboard/Companies/Locations.
7. Assets/Inventory.
8. Suppliers/Users/Crews/Attendance.
9. Maintenance/Work Orders/Activities/Reaction.
10. Reports/Settings/final audit.

The product owner intends to review implementation phase by phase.


## 25. DESWEB Design System V2 Foundations checkpoint — 2026-09-24

Phase 1 is implemented.

Runtime files:

- `app/design-tokens.css` — canonical V2 foundations and legacy aliases;
- `lib/design-system.ts` — typed token metadata;
- `components/ui-kit/FoundationPreview.tsx` — real token preview;
- `app/ui-kit/page.tsx` — authenticated live playground;
- `app/ui-kit/ui-kit.css` — playground composition using V2 tokens;
- `docs/DESIGN_AUDIT_PHASE1.md` — legacy CSS/component baseline;
- `scripts/design-system-smoke.mjs` — CI contract.

Important implementation details:

- `app/globals.css` remains untouched as the legacy style reservoir;
- `app/design-tokens.css` loads after it so V2 aliases win without a blind rewrite;
- old variables such as `--brand-teal`, `--bg`, `--surface`, `--text` and `--border` are compatibility aliases only;
- new components must use V2 semantic tokens;
- dark mode is mapped through semantic V2 variables;
- reduced-motion collapses V2 motion durations to zero;
- Organization white-label primary/secondary colors bridge into `--color-action-primary` and `--color-action-accent`;
- `UiIcon` remains the official internal SVG icon system for now;
- `/ui-kit` requires authentication and renders no tenant/private data.

Baseline audit: the legacy global stylesheet was ~13.5k lines / ~540 KB with 915 unique hex values, so migration must remain phased.

Next implementation phase: **Phase 2 — UI Core primitives**.
