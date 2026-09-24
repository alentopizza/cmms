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

- `029_supplier_catalog_user_dossier_financial.sql`.

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

La línea de Proveedores/Requisiciones está implementada. El siguiente trabajo de abastecimiento ya documentado contempla:

- recepción que registre cantidades entregadas como movimientos de Inventario;
- conciliación de recepción parcial contra `quantity_received`;
- política opcional de aprobación y auditoría;
- KPIs comerciales de proveedor cuando exista historial suficiente.

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
