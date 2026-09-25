# Changelog

## 2026-09-24 — DESWEB Design System V2 Phase 6: Dashboard, Empresas y Ubicaciones

### Added

- `StaticDataTable` for server-rendered datasets using the Shared Data UI table grammar.
- `CompanyCard` and `SubLocationCard` Business UI compositions.
- Token-only `app/phase6-modules.css` scoped to the first migrated module block.
- `scripts/phase6-modules-smoke.mjs` and CI coverage.

### Dashboard

- Migrated dashboard panels to UI Core Card.
- Migrated status pills to Badge.
- Migrated distribution bars to ProgressBar.
- Migrated role dashboard tables to StaticDataTable.
- Migrated filter selects/export trigger to Select/Button.
- Replaced date-range/export Unicode glyphs with canonical UiIcon SVGs.
- Preserved role-aware SQL, URL filters, comparison periods and export semantics.

### Empresas

- Migrated the directory to CompanyCard.
- Migrated status/metrics/feedback/empty state to Badge, StatTiles, Alert and EmptyState.
- Replaced private resource SVGs with the canonical UiIcon vocabulary.
- Preserved EntityProfileWorkspace, edit/save/delete confirmations, resource links, primary Site/geofence, documents and exports.

### Ubicaciones

- Kept LocationCard and added SubLocationCard.
- Migrated subdirectory filters to Search/Select.
- Migrated service/profile states and metrics to Badge/StatTiles.
- Migrated top-level feedback/empty states to Alert/EmptyState.
- Preserved contextual creation, maps/geofences, technician/service associations and exports.

### Integrity

- No database, API, RBAC or server-scope changes.
- Later-phase module interiors remain intentionally untouched.

### Next

- Phase 7: Assets + Inventory.


## 2026-09-24 — DESWEB Design System V2 Phase 5: Business UI

### Added

- Official `components/business-ui` layer.
- Shared `BusinessCardShell`, `BusinessMetaGrid`, `BusinessMetricStrip` and `BusinessProfileStat`.
- Domain cards: `AssetCard`, `InventoryCard`, `MaintenanceCard`, `WorkOrderCard`, `SupplierCard`, `LocationCard` and `UserCard`.
- Token-only `app/business-ui.css`.
- Interactive Business UI catalog examples in authenticated `/ui-kit`.
- `scripts/business-ui-smoke.mjs` in CI.

### Migrated

- Asset directory cards.
- Inventory product cards and stock progress.
- Mobile Maintenance and Work Order cards.
- Supplier directory cards.
- Site/Location directory cards.
- User directory outer card shell.
- Entity Profile sidebar metrics.

### Preserved

- Domain-specific composition and actions.
- ModuleHeader `data-module-record` filtering/facets.
- Owner record actions, Supplier workflows, WhatsApp links, contextual creation and profile navigation.
- Server-side RBAC, organization/site scoping, APIs and database behavior.
- Existing dense desktop tables for later module-specific migration.

### Next

- Phase 6: Dashboard + Companies + Locations.


## 2026-09-24 — DESWEB Design System V2 Phase 4: Shared Data UI

### Added

- Search, FilterPanel and FilterGroup as official shared data controls.
- Sortable DataTable with optional row selection, row actions, bulk actions and Pagination.
- KpiCard, MetricGrid and StatTiles.
- LineChart wired exclusively to the canonical `--chart-1` through `--chart-10` palette.
- Timeline, ProgressBar, CircularProgress and StepProgress.
- Token-only `app/data-ui.css`.
- Interactive Shared Data UI examples in the authenticated `/ui-kit` catalog.
- `scripts/data-ui-smoke.mjs` in CI.

### Changed

- `ModuleHeader` now delegates Search and filter presentation to Shared Data UI while preserving its current `data-module-record` search/status/cascading-facet behavior.
- `DashboardAnalytics` now delegates KPI/stat/chart presentation to the official Phase 4 primitives without changing its public API.
- Added the canonical filter icon to `UiIcon`.

### Integrity

- No database, API, RBAC, server-scope or business-rule changes.
- Dense module-specific tables remain scheduled for their module migration phases instead of being rewritten in this shared layer.

### Next

- Phase 5: Business UI.


## 2026-09-24 — DESWEB Design System V2 Phase 3: shell y navegación global

### Changed

- Migrated the authenticated application shell to a scoped V2 token-driven stylesheet loaded after UI Core.
- Replaced legacy Unicode module glyphs in Sidebar, contextual Header, mobile navigation and account actions with the canonical `UiIcon` SVG system.
- Preserved user-orderable/collapsible Sidebar behavior, RBAC filtering, routes, Organization white-label action tokens and light/dark/system theme preferences.
- Kept role-aware responsive behavior: drawer navigation for broad roles and bottom navigation + More sheet for field roles.
- Updated account identity to use the official UI Kit Avatar.
- Added explicit Requisitions metadata to the contextual Header.
- Improved `ModuleNavigation` nested-route active semantics and `aria-current`.
- Added visible focus/reduced-motion contracts to the Phase 3 shell layer.

### Validation

- Added `scripts/shell-v2-smoke.mjs` and CI coverage for V2 shell load order, icon migration, Requisitions context metadata, token-only shell CSS, focus, responsive and reduced-motion requirements.


## 2026-09-24 — DESWEB UI Kit · Fase 2 UI Core

### Added

- Primitives oficiales `Button`, `IconButton`, `SplitButton`.
- Familia de formularios: Input/Search/Number/Currency/Password, Textarea, Select, Checkbox, Radio y Switch.
- Selects avanzados: MultiSelect, SearchSelect y AsyncSelect con búsqueda, limpieza, loading y error.
- Card, Badge y StatusIndicator.
- Modal y Drawer con Escape, focus trap y restauración de foco.
- Tooltip y Dropdown.
- Tabs, Pills, SegmentedControl, Breadcrumb y ModuleNavigation.
- Alert, Toast, EmptyState, Spinner, Skeleton, LoadingCard, LoadingTable y LoadingPage.
- Avatar y FileUpload.
- Nueva hoja global `app/ui-kit-core.css` basada exclusivamente en Design Tokens V2.
- Estados semánticos adaptativos para light/dark.
- Playground `/ui-kit` ampliado con ejemplos interactivos de todos los primitives de Fase 2.
- Smoke `scripts/ui-kit-core-smoke.mjs` incorporado a CI.

### Compatibility

- `ConfirmDialog`, `CreateRecordModal`, `MultiSelectDropdown` y `FileDropzone` conservan sus APIs públicas pero delegan al UI Kit.
- CreateRecordModal conserva temporalmente clases legacy de layout para no romper formularios existentes.
- `UiIcon` se amplía con los glyphs outline requeridos por UI Core sin incorporar otra librería.

### Integrity

- UI Core no contiene hexadecimales de presentación en TSX/CSS.
- Visual migration continues without API, DB, RBAC or business-rule changes.

### Next

- Fase 3: shell y navegación global.

## 2026-09-24 — DESWEB Design System V2 · Fase 1 Foundations

### Added

- Nueva capa runtime `app/design-tokens.css` con el ADN V2 `#72F1DC / #2C8780 / #1D1D2C`.
- Escalas Primary, Teal, Navy, Success, Warning, Danger e Info.
- Tokens semánticos de fondos, texto, bordes y acciones.
- Tokens para tipografía, spacing, radius, sombras, motion, gradientes y gráficos.
- Mapeo semántico de tema oscuro y soporte de `prefers-reduced-motion`.
- Catálogo tipado `lib/design-system.ts`.
- Namespace oficial `components/ui-kit/`.
- Playground autenticado `/ui-kit` con Foundations reales: color, tipografía, spacing, radius, sombras, motion y gráficos.
- Auditoría `docs/DESIGN_AUDIT_PHASE1.md` del CSS legacy y componentes reutilizables.
- Smoke `scripts/design-system-smoke.mjs` incorporado a CI.

### Compatibility

- Los aliases legacy `--brand-* / --bg / --surface / --text / --border / --success / --warning / --danger` ahora apuntan al sistema V2 sin realizar un reemplazo ciego del CSS existente.
- El white-label de Organización alimenta también `--color-action-primary` y `--color-action-accent`.
- `UiIcon` queda definido como sistema interno de iconos SVG durante las primeras fases de migración.

### Baseline

- `app/globals.css` supera 13.500 líneas y contiene 915 valores hex únicos; se mantiene como superficie legacy para migración gradual.

### Next

- Fase 2: UI Core primitives e interacción base.

## 2026-09-24 — DESWEB Design System V2 governance

### Added

- Canonical `docs/DESIGN_SYSTEM.md` V2 with the new DESWEB visual DNA: Primary `#72F1DC`, Secondary `#2C8780`, Dark `#1D1D2C`.
- New `docs/UI_KIT.md` defining the official reusable UI Core and ERP Business UI component catalog.
- New `docs/DESIGN_MIGRATION_PLAN.md` defining the phased migration from foundations through module rollout and final audit.
- ADR establishing Design System → UI Kit → ERP modules as the frontend architecture.
- Contributor/code rules preventing arbitrary colors, duplicate primitives and silent functional changes inside visual refactors.
- Roadmap/Handoff checkpoints for the phase-by-phase ERP redesign.

### Changed

- `docs/BRANDING.md` and README now identify the V2 palette as official.
- The former `#293644/#38B2A9/#79CAC4/#BAE3E0` palette is explicitly classified as legacy implementation pending gradual migration.
- Visual migration is now governed by non-regression rules: APIs, DB, authentication, RBAC, CRUD, calculations, integrations and business rules remain unchanged unless separately approved.

### Migration status

- **Phase 0 — Governance/documentation:** completed by this checkpoint.
- **Next:** Phase 1 — Foundations + technical UI Kit structure.

## 2026-09-24 — Corrección de creación de suministros desde Proveedor

### Fixed

- Crear un suministro desde `Proveedor → Inventarios / suministros` ya no exige que Platform Owner/Superadministrador tenga una empresa seleccionada globalmente.
- La empresa del nuevo artículo se resuelve desde el proveedor seleccionado y se revalidan sede/sububicación dentro de esa empresa.
- Usuarios tenant siguen limitados a su propia empresa.
- El guardado vuelve a la ficha del proveedor en la pestaña Inventarios / suministros.
- Los mensajes de éxito/error son ahora específicos del suministro y ya no se confunden con mensajes de creación del proveedor.

## 2026-09-24 — Plantilla maestra única de Inventario y Kardex

### Changed

- Inventario y Proveedores ahora usan una única plantilla: `PLANTILLA_INVENTARIO_KARDEX_DESWEB.xlsx`.
- La plantilla conserva siempre las hojas INSTRUCCIONES, INVENTARIO, KARDEX, PROVEEDORES, BODEGAS y CATALOGOS.
- Plantilla vacía y Plantilla con datos actuales son modos de datos del mismo esquema, no archivos funcionalmente distintos.
- Desde Inventario la importación funciona en modo Global y distribuye automáticamente productos/movimientos entre múltiples proveedores.
- Desde la ficha de un Proveedor la importación inicia Contextual y permite elegir Solo este proveedor o Importar todo el archivo.
- Importar todo desde Proveedor cambia realmente a reglas Globales; no hereda silenciosamente el proveedor abierto.

### Supplier resolution and product master

- Proveedor se resuelve por prioridad: ID interno → NIT/identificación fiscal → código interno → nombre exacto.
- Proveedores incorporan código interno estable autogenerado.
- Inventario incorpora subcategoría, marca, modelo, código de barras, precio de referencia e IVA para dar persistencia real a las columnas de la plantilla.
- Servicios detectados no crean Inventario/Kardex y se reportan como omitidos.

### Validation and Kardex integrity

- Kardex hereda el proveedor desde el SKU cuando el archivo no lo informa y bloquea proveedores inconsistentes.
- Bodegas usadas por Inventario/Kardex deben existir o estar declaradas en la hoja BODEGAS.
- Validación previa simula la secuencia de stock y detecta saldos negativos antes de Confirmar.
- MOVIMIENTO_ID permite deduplicación de movimientos externos mediante restricción única por empresa.
- Errores/advertencias pueden incluir hoja, fila, campo, valor, problema y solución sugerida.
- Validación muestra agrupación por proveedor con productos y movimientos.
- SKU existentes requieren decisión Comparar, Actualizar u Omitir; actualizar nunca reescribe Kardex histórico.
- La confirmación continúa siendo una única transacción PostgreSQL sin guardados parciales.

### Traceability

- Nueva migración `037_unified_inventory_import.sql`.
- Cada lote confirmado tiene folio `IMP-AÑO-######`, origen Global/Proveedor, proveedor contextual cuando aplica, alcance, importados y omitidos.
- Nuevo smoke `scripts/unified-inventory-import-smoke.mjs` incorporado a CI.

## 2026-09-24 — Fase 5 de abastecimiento: conciliación documental

### Added

- Evidencia comercial por requisición para Orden de compra, Remisión/entrega, Factura, Nota crédito y Otros.
- Nueva migración `036_procurement_document_reconciliation.sql`.
- Nuevas entidades `procurement_documents`, `procurement_document_lines`, enlaces a recepciones/DEV y eventos de auditoría.
- Permiso dedicado `requisitions.reconcile` para Administradores, Managers y operadores de plataforma.
- Carga de archivo PDF/imagen con número, fecha, moneda, valores y líneas por SKU.
- Conciliación automática de cantidad y valor según tipo documental.
- Vínculos posteriores de evidencia física sin reemplazar el documento.
- Estados automáticos Coincide, Con diferencia, Pendiente de evidencia, Informativo y Anulado.
- Revisión humana Pendiente, Verificado, Excepción aceptada y En disputa.
- Descarga/vista previa segura y anulación con motivo sin eliminar historia.
- Resumen documental en directorio de Requisiciones y ficha/estadísticas de Proveedor.
- Exportes PDF/XLSX/Word de requisición con conciliación para usuarios autorizados.
- Nuevo smoke test `scripts/procurement-reconciliation-smoke.mjs` incorporado a CI.

### Integrity and authorization

- Recepciones y DEV siguen siendo la verdad física; los documentos comerciales no alteran Kardex.
- Archivo, cabecera y líneas documentales son evidencia histórica y no se editan.
- Las relaciones a recepción/DEV son append-only.
- Agregar nueva evidencia reabre automáticamente la revisión a Pendiente.
- Verificar exige que la conciliación automática sea Coincide.
- Aceptar una excepción exige una diferencia calculada y observación.
- Marcar disputa o anular exige observación/motivo.
- La conciliación revalida Empresa y alcance completo de sedes del revisor.

### Completion

- Con esta entrega quedan implementadas las Fases 1–5 planificadas para abastecimiento. El siguiente checkpoint acordado es la revisión integral de lógica, flujo y visual del CMMS.

## 2026-09-24 — Fase 4 de abastecimiento: devoluciones a proveedor

### Added

- Flujo de **Devolución a proveedor** dentro de la requisición, disponible cuando existen recepciones físicas.
- Nueva migración `035_supplier_returns.sql`.
- Nuevas entidades `supplier_returns` y `supplier_return_items` con folio DEV, motivo, resolución esperada, documento, fecha, usuario y líneas.
- Nuevo movimiento Kardex `supplier_return`, explícitamente separado del movimiento `return` existente.
- Vínculos de Kardex hacia DEV, requisición, ítem y recepción origen.
- Historial DEV dentro de la requisición con cantidad, bodega, motivo, resolución, documento y usuario.
- La ficha de Proveedor muestra devoluciones y cantidades devueltas; su exportación también incluye el resumen.
- Exportes PDF/XLSX/Word de requisición incluyen cantidad devuelta e historial DEV.
- Exportes del Kardex incluyen DEV proveedor y recepción origen.
- Nuevo smoke test `scripts/supplier-return-smoke.mjs` incorporado a CI.

### Inventory and traceability integrity

- `return` continúa siendo una devolución **hacia Inventario** y aumenta stock.
- `supplier_return` representa material enviado **al proveedor** y disminuye stock.
- La recepción original no se elimina ni se reduce; `quantity_received` conserva el histórico bruto recibido.
- La cantidad retornable se calcula por recepción como cantidad recibida menos devoluciones DEV previas.
- El servidor bloquea concurrentemente las recepciones origen para evitar consumir dos veces el mismo saldo retornable.
- PostgreSQL valida que la recepción origen pertenezca al mismo ítem, requisición y empresa.
- El movimiento es rechazado si la bodega quedaría con stock negativo.
- DEV y sus líneas son inmutables después de publicarse.

### Commercial follow-up

- La devolución registra resolución esperada: Reposición, Nota crédito u Otra.
- Fase 4 no reabre automáticamente la requisición ni ejecuta conciliación financiera/documental; ese cierre queda para la fase posterior.

## 2026-09-24 — Fase 3 de abastecimiento: KPIs comerciales de proveedores

### Added

- Nuevo modelo compartido `lib/supplier-analytics.ts` para analítica comercial basada en recepciones físicas de requisiciones.
- Estadísticas de Proveedor ahora muestran, para los últimos 12 meses:
  - tiempo promedio a primera recepción;
  - cumplimiento ponderado de cantidad;
  - porcentaje de requisiciones totalmente recibidas dentro de Fecha requerida;
  - variación ponderada entre costo real recibido y costo estimado para las mismas cantidades.
- Cada KPI muestra la muestra disponible y usa estado sin historial cuando no existe evidencia válida.
- Tendencia mensual de seis meses basada en el mes de primera recepción.
- Tabla de las últimas requisiciones con recepción como evidencia navegable hacia el origen de cada indicador.
- La ficha PDF/XLSX/Word del Proveedor incorpora los KPIs comerciales cuando existe historial suficiente.
- Nuevo smoke test `scripts/supplier-analytics-smoke.mjs` incorporado a CI.

### Analytics integrity

- Los KPIs no usan el límite de registros del directorio ni cálculos únicamente del cliente.
- Lead time parte de `sent_at` y usa `created_at` como fallback.
- Cumplimiento de fecha excluye requisiciones incompletas o sin `needed_by`.
- La variación de costo compara costos reales y estimados sobre exactamente las mismas cantidades recibidas, evitando mezclar total solicitado con recepción parcial.
- Los indicadores son descriptivos; no generan ranking, score ni selección automática de proveedores.
- La tendencia conserva el alias PostgreSQL `AS "month"` para evitar la regresión conocida en PostgreSQL 17.

### Validation

- CI valida la consulta de analítica comercial sobre PostgreSQL real antes del build de producción.

## 2026-09-24 — Fase 2 de abastecimiento: aprobación y auditoría de requisiciones

### Added

- Política de aprobación configurable por Empresa: sin aprobación obligatoria, aprobación para todas las requisiciones o aprobación desde un monto estimado.
- Alcance de aprobador configurable entre solo Administrador de empresa o Administrador + Manager/Supervisor.
- Autoaprobación del solicitante deshabilitada por defecto y configurable explícitamente.
- Snapshot de la política aplicable dentro de cada requisición para preservar la regla histórica aunque Configuración cambie después.
- Permiso dedicado `requisitions.approve` separado de la edición general de requisiciones.
- Bloque **Aprobación y auditoría** en la ficha de requisición con aprobar/rechazar, motivo de rechazo e historial de eventos.
- Eventos de dominio para solicitud, modificación pendiente, aprobación, rechazo y reapertura de aprobación.
- Estado de aprobación visible en el directorio de Requisiciones, la ficha de Proveedor y exportes PDF/Excel/Word.
- Nueva migración `034_requisition_approval_policy.sql`.
- Nuevo smoke test `scripts/requisition-approval-smoke.mjs` incorporado a CI.

### Integrity and authorization

- La recepción física/Kardex se bloquea en servidor mientras una aprobación requerida no esté vigente.
- Aprobar/rechazar revalida Empresa, sedes autorizadas, rol aprobador configurado y política de autoaprobación.
- `approved` y `rejected` dejan de ser estados asignables manualmente desde el selector general; son decisiones auditadas.
- Una requisición creada por debajo del umbral entra automáticamente a aprobación si una edición posterior de cantidad/costo alcanza el umbral guardado.
- Una vez que una requisición entra a aprobación, reducir el monto no elimina esa exigencia de gobierno.
- Cambiar cantidad solicitada, costo estimado o fecha requerida después de aprobar/rechazar reabre la aprobación.
- Si la requisición cambia mientras aún está pendiente, el evento `amended` conserva evidencia de esa modificación.
- Recepciones/Kardex ya registrados no se revierten cuando la aprobación se reabre; solo se bloquea el saldo pendiente hasta una nueva decisión.

### Documentation

- Roadmap, handoff, arquitectura, modelo funcional, ADR, contexto, invariantes de agentes y manual de usuario quedan sincronizados con la Fase 2.

## 2026-09-24 — Conditional directory filters, standardized Supplier catalogs and personnel/vendor dossiers

### Added

- Extended the shared module header with **conditional, cascading facets**. A facet such as Company, Site, Supplier, Role or Category is shown only when the authorized visible dataset contains more than one useful option.
- Added contextual filters across Companies, Locations, Users, Suppliers, Assets, Inventory, Work Orders, Preventive Maintenance, Crews and Requisitions.
- Added Company/Site filters where the directory can span multiple organizations or locations, plus domain-specific facets such as Role, Supplier, Criticality, Asset Category, Work Order Priority/Type, stock level, requisition requester and routine frequency.
- Sublocations now gain a Type filter only when the selected Site actually contains more than one sublocation type.
- Added migration `029_supplier_catalog_user_dossier_financial.sql`.

### Supplier data normalization

- Added standardized Supplier capability and specialty catalogs backed by stable codes rather than free-text labels.
- Supplier capability and specialty selectors are multi-select, allowing one vendor to represent several kinds of commercial coverage and technical specialties.
- Existing `supplier_type` remains as a derived compatibility field for current Inventory/Activity authorization and business rules.
- Existing legacy free-text Supplier specialty text remains visible as a fallback until the Supplier is edited into the standardized catalog.
- Added Company, capability, specialty and Country filters to the Supplier directory.

### User dossier

- Added an internal **Documents** tab to User/Technician profiles.
- The personnel dossier supports standardized categories for identity document, résumé/CV, ARL, EPS, pension, severance, compensation fund, parafiscal/PILA evidence, bank certificate/account, contract, certifications and other records.
- User documents are private, organization-scoped, authenticated and support archive/restore lifecycle.
- Added **Emergency contact** to the User profile with normalized relationship type, phone, email and notes.

### Supplier payment information

- Added **Información financiera** to Supplier profiles for bank, account type/number, account holder and identification, currency, payment terms, payment email and administrative notes.
- Normal profile display masks the account number to its final four digits.
- Supplier payment data remains tenant scoped behind the existing Supplier-management permission.

### Data integrity

- Supplier catalog codes are validated server-side; a client dropdown is not treated as a data-integrity boundary.
- Directory facets only narrow the records already returned under server-side authorization and never broaden tenant/Site scope.
- Multi-select catalog values use stable codes to improve future spreadsheet/database imports, exports and integrations.

## 2026-09-24 — Role dashboards with KPI comparisons and analytical filters

### Changed

- Redesigned the root Dashboard using the approved reference composition while preserving Desweb branding, light/dark behavior and responsive navigation.
- Platform Owner, Superadministrator, Company Administrator, Manager/Supervisor, Viewer, Technician, External collaborator, Provider and Requester now receive role-specific KPI sets instead of a generic summary.
- KPI cards show the current value plus comparison against the immediately previous equivalent period or the same period of the previous year.
- Added six-month trend charts using real PostgreSQL data rather than mock series.
- Added operational distribution panels for Work Order status, maintenance type, Site and request priority where applicable.
- Added field/operator summaries for attendance hours, execution evidence and active workload without introducing worker rankings or automated employment scoring.

### Filters and export parity

- Added **Sede** and **Prioridad** filters to tenant/field/requester dashboards when applicable.
- Added **Comparar con** selector for previous equivalent period or same period in the previous year.
- Existing period and status filters remain available.
- Site options are loaded only from the authenticated user's authorized Organization/Site scope.
- Excel, CSV and PDF dashboard exports now apply the same Site, Priority, status, period and role scope used on screen.

### UI

- Added reusable KPI comparison cards, two-point evidence sparklines, six-month line charts, statistical tiles and a role-aware dashboard header.
- Dashboard analytics collapse from desktop multi-column layouts to single-column mobile layouts without introducing a separate mobile implementation.

## 2026-09-24 — User and Supplier compact-card correction

### Fixed

- User directory cards no longer expose the ambiguous **Offline** tracking label or **Pendiente** biometric label. Those states remain available inside the User profile where their meaning is explicit.
- User deactivation no longer uses the trash icon; it uses a dedicated power/status action, while permanent deletion keeps the trash icon.
- User cards now include a direct WhatsApp action whenever a phone number is available.
- Supplier deletion no longer invokes the browser-native `confirm()` dialog. It uses the shared Desweb safety confirmation dialog.
- User portraits and Supplier logos now render above their banners with explicit stacking, avoiding the clipped/hidden image seen in the first compact-card implementation.
- The Users page keeps the statistics dashboard isolated behind the per-user statistics endpoint, so opening the directory does not execute the heavier dashboard queries.

### Layout

- User and Supplier directories render **4 cards per row** on standard desktop widths and **5** only on sufficiently wide viewports.
- User cards keep a circular portrait language; Supplier cards keep a rounded-square commercial-logo language.
- Responsive layouts degrade to 3, 2 and 1 card columns instead of reducing typography below the legibility floor.

## 2026-09-24 — Compact User/Supplier cards and resilient User statistics

### Fixed

- Restored `/dashboard/users` reliability by removing the newly added heavy statistics aggregates from the directory query.
- Detailed User statistics now load only when a User profile is opened through `/api/users/[id]/statistics`.
- A statistics API failure is isolated to the Statistics tab and falls back to the stable summary metrics instead of crashing the whole Users module.

### Changed

- User directory cards now use a personal credential/profile visual language with cover treatment, overlapping avatar, role/company identity, biometric/site badges, operational metrics and compact actions.
- Supplier directory cards use a distinct commercial/vendor visual language with branded banner, Supplier logo, supplier type, location/category, contact summary, metrics and procurement actions.
- Both directories support up to **5 cards per row** on very wide desktops, then adapt to 4, 3, 2 and 1 columns as available width decreases.
- Card density is achieved through hierarchy and spacing, not by returning to unreadable micro-fonts.


## 2026-09-24 — User operational statistics dashboard

### Changed

- Replaced the flat User **Estadísticas** grid with the approved dashboard-style composition inspired by the supplied reference while preserving the Desweb visual language.
- User statistics now use real CMMS data instead of mock values: active Work Orders, pending/completed Activities, Attendance hours, current shift state, Reaction connectivity and biometric state.
- Added a seven-day Attendance progress chart, today's field-time ring, execution-compliance card, upcoming Activity agenda and compact pending-Activity list.
- User statistics remain descriptive operational evidence. They are not employee rankings, automated performance scores or employment-decision outputs.
- The new dashboard is responsive and keeps operational text above the product's readability floor.

## 2026-09-24 — Supplier directory density and typography

### Changed

- Supplier directory now renders **three profile cards per row** on wide desktop layouts, two on medium layouts and one on compact/mobile layouts.
- Reduced Supplier card logo, padding and internal gaps so the third column is gained by better information density rather than shrinking the usable content area.
- Raised Supplier directory text, status badges, counters and action buttons above the previous 7–8 px sizes.
- Raised the legibility floor across the new Supplier profile and Requisition UI, including Activities, supplies, documents, requisition builder, requisition directory and requisition sheet.
- Responsive breakpoints keep cards readable instead of forcing three columns when the viewport can no longer sustain them.


## 2026-09-23 — Supplier profile workspace and supplier-scoped requisitions

### Added

- Rebuilt **Proveedores** with the approved in-page entity profile pattern used by Companies and Locations: breadcrumbs, left identity/statistics rail, right tab workspace, quick actions and Hoja de vida export.
- Supplier creation now requires a logo and captures richer commercial identity: legal name, Country/City, address, website, contact title and notes.
- Added Supplier tabs for **Información general, Estadísticas, Documentos, Actividades, Inventarios / suministros, Requisiciones and Hoja de vida**. Service/material tabs appear according to supplier type.
- Added Supplier document upload/archive/restore/download flow.
- Added dedicated **Requisiciones** module, requisition detail sheet, lifecycle states and PDF/Excel/Word export.
- Added reusable requisition builder in Supplier profiles and Inventory.
- Added migrations and schema for supplier profile assets/documents plus supplier requisitions and requisition items.

### Requisition rules

- Every requisition belongs to exactly one Supplier.
- Selecting Inventory items from multiple Suppliers creates multiple requisitions automatically, one per Supplier.
- Supplier-profile requisitions can only select Inventory items already related to that Supplier.
- Inventory items can only be created against active **materials** or **both** Suppliers.
- A requisition does **not** increase Inventory stock. Receiving/stock-entry remains a separate inventory transaction so requested quantity and received quantity are not conflated.

### Supplier operational projections

- Supplier **Actividades** is derived from Work Order Activities whose `service_supplier_id` points to that Supplier.
- Supplier **Inventarios / suministros** is derived from `inventory_items.supplier_id`.
- These projections do not introduce duplicate assignment tables.


## 2026-09-23 — International catalog, dependent selectors and locale foundation

### Added

- Added a reusable international catalog in `lib/international-catalog.ts` for country, major-city options, telephone calling code, supported time zones, Company tax-identification types and personal identity-document types.
- Added shared controlled fields in `components/InternationalFields.tsx`: Country, Country→City, tax-identification type, personal document type, country-aware timezone and Locale selectors.
- Added migration `026_international_catalog_preferences.sql` for organization/platform locale and default-country preferences plus country/document identity fields on Users.
- Added **Configuración → Idioma y región** for both platform administration and tenant Company settings.
- User/Technician identity can now persist country, document type and document number; Hoja de vida export includes those fields.
- Supplier identity now stores Country and Country-aware tax-identification type; Supplier phone uses the same derived international prefix.
- Public and manual Lead forms now capture Country and derive the telephone prefix from it; migration `027_supplier_lead_country.sql` persists this context.

### Changed

- Company creation/edit and Site creation/edit no longer use free-text Country/City fields in the migrated flows. City options depend on the selected Country.
- Company tax-identification type is selected from the selected Country's catalog instead of being typed manually.
- User/Technician personal document type is selected from the person's Country catalog instead of being typed manually.
- `PhoneField` now derives the international calling prefix from the same Country catalog and asks only for the national number.
- New Company and Location forms start from the configured platform/Company region instead of assuming Colombia everywhere.
- Trial/paid test checkout now captures Country → City, applies the configured platform locale/region, derives the Company timezone from Country and persists the same Country on the first Site and administrator.
- Google Places autocomplete now follows the Country currently selected in the surrounding form instead of remaining restricted to an old static Country hint.
- International mutation routes no longer silently substitute Colombia when Country is omitted; they reject missing/unsupported Country values.
- Server mutation routes validate supported countries and relevant identification types instead of trusting client-side selectors alone.

### Internationalization boundary

- The first catalog contains an initial multi-country set and curated city lists; it is the central extension point, not an exhaustive worldwide municipality database.
- Locale preferences are persisted now as the foundation for translation. Screens without a translation dictionary still render their existing Spanish text until the staged i18n pass covers them.


## 2026-09-23 — Compact information layout and remote coordinates

### Changed

- Reorganized Company and principal Location **Información general** into two independent vertical columns so a tall map no longer forces empty space beneath the data/contact panels.
- The left entity identity card now sizes to its content instead of stretching to the full height of the right detail panel.
- Embedded read-only maps use a bounded profile-map presentation and hide duplicated address/radius controls already represented elsewhere in the profile.
- Geofence configuration rows now use flexible columns that can shrink inside narrow containers without horizontal overflow.

### Added

- Editable **Latitud** and **Longitud** fields are available whenever the geofence picker is in edit/create mode.
- Manual coordinates accept remote sites, rural roads and points without usable street nomenclature; after leaving the field the map recenters on the entered point.
- Existing GPS, address autocomplete/validation, map click and draggable-marker workflows remain available alongside manual coordinate entry.


## 2026-09-23 — Rich information panels and activity-derived technicians

### Added

- Completed the approved **Información general** composition for Companies and principal Locations with denser data blocks, contextual section icons, map context, contact information and notes.
- Added Site fields for **Zona / Localidad**, **Cargo del responsable** and **Notas adicionales** through migration `025_site_profile_details.sql`; creation and edit flows persist these values.
- Added a read-only **Técnicos** tab to principal Locations and Sub-locations.
- Technician presence in a Location/Sub-location is derived from real Work Order activity assignments, including direct person assignments and members of an assigned crew.
- Hoja de vida exports now include the richer Company/Site fields and activity-derived technician counts.

### Assignment rule

- Do not create a duplicate Site↔Technician or Sub-location↔Technician assignment table for operational work.
- The source of truth for “assigned technicians” is the Activity/Work Order task executor relation. Location profiles project that assignment for visibility.


## 2026-09-23 — Entity header visual fidelity pass

### Changed

- Refined the shared Company/Site/Sub-location/User detail header to match the approved reference more closely.
- Replaced Unicode/symbol-based entity and action marks with one reusable SVG icon system so Company, Location, Map, Edit, Create, Technician, Asset, Work Order, Download and destructive actions share the same line weight and geometry.
- Breadcrumbs now use a real Home icon, lightweight chevrons, stronger current-record emphasis and tighter vertical placement.
- Increased the entity icon circle, title/subtitle hierarchy and action-button height/padding to reproduce the approved balance between identity and actions.
- Secondary actions now use white bordered buttons with teal line icons; **Exportar** remains the visually dominant teal action with a download icon and rotating dropdown chevron.
- The same visual treatment is inherited by Companies, Locations, Sub-locations and Technician/User profiles.


## 2026-09-23 — Approved in-page profiles and breadcrumbs

### Changed

- Replaced the Company, Site, Sub-location and User/Technician **detail modals** with the approved same-screen detail workspace. Selecting a directory card now replaces the directory body inside the current module instead of opening an overlay.
- Added visible breadcrumbs to every shared profile workspace so operators can move back through **Inicio → módulo → parent → current record** without closing a popup.
- Applied the same approved profile workspace to **Companies** with identity/logo, statistics, quick actions and independent right-side tabs.
- Standardized the detail header to match the approved reference: entity icon + contextual **Type / Name** title on the left, compact Edit/View/Create actions and the primary **Exportar** dropdown on the right.
- Company, Site, Sub-location and User/Technician profile tabs replace content in place; they do not append another long vertical section under the current tab.
- Company Hoja de vida export is now included in the same authenticated PDF/XLSX/Word-compatible export endpoint.

### Design rule

- Detail navigation for **Companies, Sites, Sub-locations and Users/Technicians is in-page, not modal**.
- Creation forms, destructive confirmations and other decision flows may continue using modals where appropriate.


## 2026-09-23 — Entity profile workspaces, top-right account controls and Hoja de vida exports

### Added

- Added a reusable entity-profile workspace for **Ubicaciones, Sububicaciones and Técnicos/Usuarios** with a dedicated identity column, photo/logo, status, operational statistics and quick actions.
- Added independent in-workspace tabs so Information, Statistics, Sub-locations/Services or Technician operational context changes inside the right panel without pushing the profile layout downward.
- Location profiles now expose contact, operating schedule, geofence/map context, sub-location browsing, maintenance-service browsing and contextual Technician creation from the selected Site.
- Technician profiles now consolidate role/scope, active Work Orders, pending/completed activities, Attendance hours, biometric state and Reaction live state.
- Added authorized per-record **Hoja de vida** exports for Sites, Sub-locations and Users/Technicians in PDF, native XLSX and Word-compatible DOC formats through `/api/profile-export`.
- Added a contextual **Exportar** menu to the entity workspace with explicit Hoja de vida formats.

### Changed

- Moved the desktop account/configuration/help/logout controls from the lower-left sidebar into the **top-right contextual header**.
- The top-right account trigger now uses the authenticated user's profile photo when one exists and falls back to initials otherwise.
- The lower-left sidebar is reserved for navigation organization/state and optional Desweb attribution rather than account actions.
- Location and User directory cards remain scan-oriented; selecting the main card body opens the richer profile workspace while edit/destructive controls keep their existing authorization rules.
- Contextual **Agregar técnico** from a Site opens the Users create flow with Company, Site and Technician role preselected; server-side tenant/site/role validation remains authoritative.

### Security / scope

- Hoja de vida export routes independently re-check authentication, module permission, organization ownership and Site scope; the export menu never broadens the records a user can read.
- Technician productivity/attendance values displayed in the profile remain descriptive operational indicators and are not employment rankings or automated personnel decisions.


## 2026-09-23 — Flexible schedules, governed document archive and phone actions

### Added

- Added migration `024_flexible_business_schedule_document_archive.sql`.
- Companies and Sites now support a seven-day schedule with independent opening/closing times per active day, while retaining the legacy day/open/close columns for backward compatibility.
- Business-hour editors now allow closing individual days and configuring different weekend or weekday hours; Reaction consumes the richer schedule for open/closed state.
- Company documents now have separate **Vigentes** and **Archivados** views, in-place PDF/image preview, restore flow, archive audit attribution and owner-only permanent deletion.
- Document download endpoints now support explicit inline preview without removing archived-file access for authorized users.
- Added country-aware phone fields that derive the international calling prefix from the Company/Site country and persist normalized E.164-like values.
- Added WhatsApp and call shortcuts with tooltips to phone fields and Reaction entity detail views.
- Adjusted Company profile identity layout so the logo sits fully below the cover instead of overlapping it.
- Normalized principal-Site information-field heights to keep internal-code/help text aligned with neighboring fields.

### Changed

- Archiving a Company document is now reversible and distinct from permanent deletion.
- Company, Site and User phone capture no longer requires users to type the country calling prefix when the related country is known.
- Reaction displays variable-hour entities as **Horario variable** when active days do not share the same opening/closing range.

## 2026-09-23 — Company quick-edit contact save fix

### Fixed

- Fixed malformed PostgreSQL placeholders in the Company-directory quick-edit contact update that caused Contacto principal / Correo administrativo saves to fail with a generic error.
- Replaced dynamic SQL placeholder construction with a fixed parameterized UPDATE that safely preserves omitted fields.
- Added backend validation for administrative-email format.
- Added actionable save-error mapping for missing data, overlong values, invalid data and broken related references, while unknown failures receive the reference code `ORG-SAVE` and are logged server-side.
- Contacto principal and Correo administrativo now use the same two-column form grid, input sizing and read-only/edit behavior as Nombre comercial and Razón social.

## 2026-09-23 — Upload acknowledgement and Company edit-state reset

### Fixed

- FileDropzone now recognizes selected files with filename, size, a 100% ready state and a visual check indicator.
- Existing images can be rendered inside the uploader when a preview URL is available.
- Company quick edit now shows a server-confirmed success panel after saving and lists any logo/cover filenames accepted in that save.
- Removed the immediate full-page reload after Company quick-edit saves; the modal now exits edit mode immediately, returns to protected/read-only mode and restores the **Editar empresa** action.
- Company logo/cover previews are cache-busted after a successful upload so the newly saved image is visible without closing the modal.

## 2026-09-23 — Unified file upload experience

### Changed

- Replaced native file selectors across Companies, Users, Locations/Sub-locations, Company documents, global Personalization and White Label settings with one reusable drag-and-drop upload surface.
- The shared uploader displays accepted formats, real backend size limits, selected filename/size, image preview when applicable, remove/change actions and client-side type/size feedback before submit.
- Upload limits now shown in the UI match the current server contracts: Company logo 2 MB, Company cover 5 MB, general images 5 MB, customization assets 2 MB and Company documents 10 MB.
- Site **Código** labels now explain that the value is an optional short internal reference for work orders, reports and integrations, with examples such as `MAIN` or `BOG-01`.

## 2026-09-23 — Company edit confirmation and contact persistence

### Fixed

- Company quick edit now requires an explicit confirmation before protected fields are unlocked.
- The read-only Contacto principal and Correo administrativo summary becomes editable fields only after that confirmation.
- Quick-edit changes to primary contact and administrative email now persist to PostgreSQL; they are no longer limited to the full Company Profile form.
- Cancelling edit resets unsaved form changes before returning to protected/read-only mode.

## 2026-09-23 — Company quick-edit coverage layout

### Changed

- Reworked the Company quick-edit **Sede principal y cobertura** section so the geofence map uses the full available width.
- Moved Site identity and city/country fields below the map into compact subcontainers instead of oversized side-by-side fields.
- Kept geofence coordinates/radius immediately below the map in compact cards.
- Removed the duplicated primary-Site schedule from Company quick edit. The single Company schedule is authoritative in this screen and is synchronized to the primary Site when saved from the Company directory.
- Site-specific schedule exceptions remain editable from the Locations/Site workflow.

## 2026-09-23 — Reaction reset button state

### Changed

- Restyled **Borrar filtros** as an elevated dark-green button with white text inside the filter container.
- The button remains disabled/subdued when no filters differ from the operational defaults.
- As soon as search, Company, Site, Technician, business-hours or date filters are active, the button gains active green styling, shadow/relief and hover/press feedback.

## 2026-09-23 — Reaction technician selector

### Changed

- Removed the Técnicos / Empresas / Sedes layer checkbox group from the Reaction filter bar.
- Companies and Sites remain visible by default; Technician visibility is now controlled through a dedicated **Técnico** selector beside Empresa, Sede and Horario.
- Selecting a Technician narrows the map to that technician and filters the pending-activity panel to work assigned directly or through one of the technician's crews.
- Company changes automatically clear an incompatible Technician selection.
- **Borrar filtros** now also clears the Technician selector.

## 2026-09-23 — Reaction filter-bar visual refinement

### Changed

- Unified the Reaction filter bar into one homogeneous surface; active layers are now indicated by green accent/underline instead of a separate colored block.
- Reduced filter-bar height and control heights to recover more map space.
- Added a final **Borrar filtros** action that restores search, layers, Company, Site, business-hours state and the date filter to **Hoy y retrasadas**.
- Moved the live-status pill upward to match the more compact filter bar.

## 2026-09-23 — Reaction search and in-place operational details

### Added

- Added a global Reaction search across Companies, Sites and connected Technicians using names and related contact/location information.
- Search results identify the entity type and can focus/open the matching operational detail without leaving Reaction.
- Company filtering remains available as an explicit selector, with Site options scoped to the selected Company.
- Clicking Company, Site or Technician markers now opens an in-place operational popup instead of navigating away.
- Company and Site popups show contact/location/hours data plus **all** related pending/in-progress activities, independent of the side-panel date filter.
- Technician popups show contact/GPS state and all pending activities assigned directly or through one of the technician's crews.
- Clicking an activity alert now opens an in-place activity popup with Work Order, location, asset, commitment date, assignment type, responsible party, notes and connected assigned technicians where available.
- Work Order navigation remains available only as an explicit **Abrir OT completa** action from the activity popup.

## 2026-09-23 — Reaction operational alert panel

### Added

- Replaced the reserved Reaction side panel with live pending-activity alerts from work-order activities.
- Added one unified elevated dark-green filter bar for Technicians, Companies, Sites, Company scope, Site scope and business-hours state.
- Company/Site marker clicks now activate the corresponding operational scope and update the alert panel.
- Added date filtering with **Today and overdue** as the default, plus Today, Overdue, Tomorrow, This week and a specific date.
- Added activity-level commitment date through migration `023_work_order_task_due_date.sql`; existing activities fall back to Work Order due/request date for Reaction filtering.
- Alert cards expose Work Order, company, site, responsible party, priority, state and operational date, and link directly to the Work Order.
- Open Company/Site markers now use a stronger green status ring; closed markers use red. Logos are no longer dimmed/grayscaled for closed state.
- Removed fractional marker scaling and switched Company/Site logos to `object-fit: contain` to improve map-marker sharpness.

## 2026-09-23 — Reaction GPS session resilience

### Fixed

- The mandatory-location gate now checks geolocation permission/state before blocking the dashboard; normal refreshes with usable GPS no longer show the full-screen warning.
- React cleanup no longer closes the Reaction tracking session during refresh, navigation or browser/app suspension. Explicit logout remains the authoritative close event.
- Returning to the app requests a fresh position and resumes the existing tracking session.
- Reaction keeps a technician visible for up to 30 minutes when browser background suspension pauses GPS, marking the telemetry as **paused** instead of immediately disconnecting the technician.
- The tracker automatically retries temporary GPS timeout/unavailable errors while the page is visible.

## 2026-09-23 — Business-hours save error handling

### Fixed

- Invalid Company/Site schedules no longer escape the mutation handler as unhandled exceptions and produce HTTP 500.
- Opening/closing validation now returns controlled business-hours error codes and user-facing messages.
- PostgreSQL check-constraint failures for schedules are translated into form feedback instead of a generic server error.
- The same validation behavior is applied consistently to Company creation, Company editing, Site creation and Site editing.

## 2026-09-23 — Reaction filters and business hours

### Added

- Added editable business hours to Companies and principal Sites: service days, opening time and closing time.
- Existing records receive an editable Monday–Friday 08:00–18:00 default through migration `022_business_hours.sql`.
- Company creation captures both the company's general hours and the primary site's own hours.
- Site creation/edit flows capture and update independent site hours.
- Reaction now exposes separate map layers for **Technicians**, **Companies** and **Sites**.
- Added operational-hours filter with **All**, **Open now** and **Closed now** states.
- Reaction evaluates open/closed state with the organization's configured timezone and each entity's stored schedule.

## 2026-09-23 — Reaction startup migration repair

### Fixed

- Restored the missing `020_technician_location_samples.sql` migration required by Reaction tracking.
- The restored base migration creates `technician_location_samples` before `021_reaction_tracking_sessions.sql` alters it to add Reaction session linkage and optional Attendance linkage.
- This resolves a production startup failure where `scripts/migrate.mjs` exited before `server.js` could start, causing Easypanel to report **Service is not reachable**.

## 2026-09-23 — Edit persistence hardening

### Fixed

- Company directory edits now wait for an explicit JSON success response before closing/reloading, and server validation errors remain visible inside the edit flow.
- Company profile updates no longer recalculate/reset organization resource limits unless limit fields were actually submitted.
- Company mutations now re-check tenant ownership for organization-level users.
- Users may safely edit their own personal identity/contact/photo/password data from the Users module while self role/company changes, self deactivation and self deletion remain blocked.
- User-directory saves now reload from PostgreSQL after a successful mutation instead of relying only on a client router refresh.
- Platform Owner contextual editors for Suppliers, Crews, Assets, Work Orders, Maintenance Routines and Inventory now reload from the server after confirmed persistence.

### Reviewed

- Principal-location and sublocation edit flows were reviewed and already submit directly to their authorized mutation routes with PostgreSQL updates and full redirects.
- The generic Platform Owner mutation endpoint was reviewed; updates and audit records execute in one transaction and errors are returned to the editor rather than reported as success.

## 2026-09-23 — Reaction production build header fix

### Fixed

- Removed the directory-style `ModuleHeader` from the Reacción map page because the map does not expose directory records for search/filter/count controls.
- Registered **Reacción** in the shared contextual dashboard header with its contingency-coordination identity.
- Fixed the production TypeScript build failure caused by missing required `count` and `countLabel` props on the Reacción page.

## 2026-09-22 — Reaction live technician tracking

### Added

- Added provisional **Reacción** module for emergency-response operations.
- Added mandatory connected-session GPS tracking for Technician users.
- Added live technician tracking sessions and timestamped GPS route samples.
- Added supervisory Reaction map for Admin/Manager/platform operators.
- Configured site markers with company logos and technician markers with profile photos.
- Added recent technician route visualization and five-second map refresh.
- Explicit logout now closes the technician tracking session.
- Reserved a right-side Reaction panel for the upcoming dispatch/contingency workflow.

### Architecture

- Reaction tracking is independent from Attendance but location samples can reference an open attendance shift when present.
- Browser/PWA tracking is foreground-capable; native background location remains a future mobile phase.

## 2026-09-22 — Three-way geofence location selection

### Changed

- Site geofences can now be positioned using Google Places autocomplete, current device GPS or a draggable map marker.
- The branded company-logo marker is draggable in create/edit mode and fixed in read-only mode.
- Dropping the marker updates coordinates, recenters the map and keeps the existing geofence radius.

## 2026-09-22 — Branded geofence map and location edit cleanup

### Changed

- Location edit mode now renders one interactive geofence map instead of duplicating the same map twice.
- The secondary edit block is now a compact address/coordinates/radius summary.
- Company logos are rendered as branded center markers on Google Maps geofences, with initials/default marker fallback.
- Company primary-site map also uses the company logo marker.
- Google Places autocomplete is aligned with the Desweb light/dark visual system.

## 2026-09-22 — Google Places autocomplete address flow

### Changed

- Replaced the primary address-entry experience with Google Place Autocomplete (New), matching the interaction pattern of Google Maps.
- Selecting a prediction now loads the formatted address, latitude/longitude, recenters the map and updates the geofence immediately.
- Kept the existing Validate action only as an operational fallback when Places is unavailable.
- Places predictions are region-restricted by the configured country when available.

## 2026-09-22 — Clearer Google address validation

### Changed

- Address validation now uses the live City and Country values from the current form instead of static hints.
- Google Geocoding requests include city/country context and country restriction.
- Search results now separate primary street/address from neighborhood, city, region and postal code.
- Partial Google matches are explicitly labeled so users know to verify the point before saving.
- Reduced ambiguous address results to four clearer options.

## 2026-09-22 — Google Maps async loader correction

### Fixed

- Google Maps loader now uses the documented async callback instead of relying on the script `load` event.
- Marker library is requested explicitly for Advanced Markers.
- Added `gm_authFailure` handling so key/referrer/API authorization errors are shown in the geofence UI before falling back to OSM.

## 2026-09-22 — Google Maps runtime configuration fix

### Fixed

- Maps browser configuration is now loaded at runtime from the authenticated server instead of relying on Docker build-time injection.
- Easypanel only needs the three Google Maps variables in the service Environment section; a rebuild no longer depends on custom Docker build arguments for the public Maps values.
- The server Geocoding key remains private and is never returned by the runtime configuration endpoint.

## 2026-09-22 — Google Maps build-time environment fix

### Fixed

- Google Maps public variables are now injected into the Docker builder stage so Next.js can compile `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` into the browser bundle.
- The server Geocoding key remains runtime-only and is not exposed to the browser build.

## 2026-09-22 — Google Maps production geolocation stack

### Changed

- Google Maps JavaScript API is now the preferred interactive geofence map provider when configured.
- Google Geocoding API is now the preferred server-side address validation provider.
- Added environment configuration for browser Maps key, optional Map ID and server-only Geocoding key.
- Kept device GPS and server geofence validation independent from cartography.
- Kept supervised 1:1 facial recognition independent from Google Maps; attendance continues to combine location and identity as separate controls.
- Retained OSM/Nominatim as a temporary operational fallback while Google credentials are unavailable.

## 2026-09-22 — Personal settings navigation cleanup

### Changed

- Removed duplicated **Mi configuración** from the main module navigation.
- Kept personal settings in the profile/account menu and field-mobile account/system sheet.
- The route `/dashboard/preferences` remains available; only the redundant module entry was removed.

## 2026-09-22 — Rutinas, Inventario mobile and dark dropdown contrast

### Changed

- Activated the prepared mobile-card layout for Rutinas instead of showing the desktop table on small screens.
- Added a dedicated mobile-card layout for Inventario with stock/minimum emphasis, location and supplier context.
- Added low-stock visual state on mobile inventory cards.
- Hardened dark-theme modal/form surfaces so selects, options, optgroups, inputs and textareas keep dark backgrounds with readable light text.
- Kept modal headers, sticky actions and location-type selectors aligned with the dark palette.

## 2026-09-22 — Personal settings and clearer attendance exit

### Changed

- Supervised enrollment now verifies the device is physically inside the selected site's geofence before the facial camera can be used.
- Personal settings are now available to every authenticated role through `/dashboard/preferences`.
- Field-mobile **Más** and the account menu expose **Mi configuración** without granting administrative company settings.
- New browsers default to the **Claro** theme; Oscuro and Sistema remain optional preferences.
- Attendance now labels the open-shift action explicitly as **Marcar salida / Finalizar jornada**.
- The user manual was updated to reflect personal settings and the clearer exit flow.

## 2026-09-22 — Hybrid user manual and help center

### Added

- Refined role filtering so authenticated manuals prioritize only articles explicitly applicable to the current role, while Toda la plataforma remains the complete reference.
- Avoided duplicate Manual/Ayuda entries inside the field mobile Más sheet.
- Added public `/manual` user-manual landing.
- Added authenticated `/dashboard/help` manual prioritized for the signed-in user's role.
- Added shared structured manual content for navigation, company/site setup, geofence, users, supervised biometrics, field presence, contingency, assets, work orders and settings.
- Added role selector, full-platform overview mode, search and **Qué cambió** feed.
- Added Manual/Ayuda to dashboard navigation, account menu and field-mobile **Más** sheet.
- Added public landing navigation to `/manual`.
- Added repository invariant requiring user-facing workflow changes to review/update the manual in the same implementation.

## 2026-09-21 — Attendance contingency phase 4B

### Added

- Added audited attendance contingency requests for camera, GPS, precision, geofence, connectivity, device and other operational failures.
- Added supervisor review with approve/reject decision and optional note.
- Approved requests create a 30-minute, single-use attendance authorization.
- Added one-time contingency check-in/check-out endpoint that preserves available GPS evidence while explicitly recording verification mode as `contingency`.
- Added contingency request/review UI inside Attendance.
- Added contingency counts to 30-day attendance reports.
- Added migration `019_attendance_contingency.sql`.

### Security / behavior

- Kept contingency action state synchronized with normal check-in/check-out changes in the same mobile session.
- Contingency requires an existing active supervised biometric identity and cannot be used for initial enrollment.
- Requests and approvals remain organization/site scoped and are revalidated server-side.
- Normal biometric/geofence verification and exceptional contingency records remain distinguishable in persistence and reporting.

## 2026-09-21 — Mobile field optimization phase 4A

### Changed

- Rebuilt the field-role **Más** action as a bottom sheet instead of reopening the duplicate module drawer.
- Kept Dashboard, Orders, Attendance and Assets as primary bottom-navigation destinations.
- Moved secondary authorized modules plus Configuration and Sign out into the **Más** sheet.
- Made the field bottom navigation fixed, safe-area-aware and reserved matching workspace bottom space so content no longer hides behind it.
- Compacted shared module headers on field mobile layouts.
- Added a dedicated mobile card/list representation for the Assets directory while retaining the desktop table on larger screens.
- Added a dedicated mobile card/list representation for Work Orders, the other primary field destination.

## 2026-09-21 — Tenant user-management scope repair

### Fixed

- Biometric readiness is now visible in the Users directory as Verified, Reenroll, Revoked or Pending.
- Restored user edit/activate/deactivate actions for Company Administrators that already hold `users.manage`.
- Enforced the same capability server-side while restricting tenant administrators to ordinary users in their own organization.
- Preserved Platform Owner/Superadministrator protections and owner-only permanent deletion.
- Added responsibility section comments to the large Users client/API files while reviewing the new biometric workflow.

## 2026-09-21 — Supervised biometric enrollment and code-context standard

### Added

- Added supervised facial enrollment for Admin/Manager attendance supervisors.
- Added biometric enrollment audit metadata/events for supervisor, site, method, enrollment/reenrollment and revocation.
- Added shared browser biometric helper `lib/client-biometric.ts` so enrollment and attendance use the same capture/model logic.
- Added `docs/CODE_GUIDE.md` and repository section-comment conventions for complex/security-sensitive code.

### Changed

- Removed self-enrollment and self-revocation from the field-user attendance workflow.
- Attendance now accepts only supervised, identity-verified, active facial templates.
- Existing self-enrolled templates are classified as legacy and require supervised reenrollment.
- Biometric revocation now invalidates the encrypted embedding while retaining non-biometric audit metadata.
- Supervised enrollment revalidates tenant membership, controlled role, site scope, profile photo and liveness server-side.
- Added section responsibility comments to the new biometric/geofence code paths and made this an ongoing contributor/AI requirement.

## 2026-09-21 — Attendance availability fix

### Fixed

- Fixed the Attendance module showing “not enabled” for organizations that had never created an attendance policy.
- Centralized an enabled-by-default attendance policy for self-service roles: Admin, Manager, Technician, Provider and External collaborator.
- Preserved explicitly disabled organization policies.
- Added migration 017 to create missing attendance-policy rows for existing organizations and update database defaults.
- New organizations now receive an attendance policy during creation.
- Platform operators with organization context may validate the module without being rejected only because their session has no tenant role.

## 2026-09-21 — Field presence workflow phase 3

### Changed

- Reworked the self-attendance experience around **presence in site** rather than requiring assigned work.
- Field users can now initiate a biometric shift even with zero assigned activities and remain marked as available in the validated site.
- Renamed the primary self-service action to **Iniciar actividades / Finalizar actividades** while preserving attendance-shift semantics.
- Added a mobile operational status card showing whether the person is in-site/available or has no open shift.
- Added GPS, geofence and presence validation steps plus explicit guidance when location permission is blocked, precision is insufficient or the user is outside the permitted radius.
- GPS/geofence validation now runs before activating the facial camera.
- Added nearest-authorized-site assistance on the client when a current GPS fix falls inside a configured geofence.
- Added a site map with configured radius and current-device marker to the field presence workspace.
- Kept live-camera enrollment separate from uploaded profile photos; the enrollment flow explicitly requires the person to be present in front of the camera.


## 2026-09-21 — Geofence configuration phase 2

### Added

- Added a reusable interactive geofence map control for principal sites.
- Added authenticated address validation/geocoding with candidate selection.
- Added map-point adjustment, current-device location capture, visible radius overlay, coordinate display and 20–5000 m radius control.
- Added geofence configuration to company onboarding, contextual principal-site creation, company primary-site editing and location-detail editing.
- Added read-only map/geofence visualization to principal-location detail and the company profile.

### Changed

- New principal sites now require address, city, country, latitude, longitude and a valid geofence radius at server level.
- New companies require the same validated geofence for their initial principal site.
- Existing sites without coordinates remain visible but must complete geofence configuration when edited.
- Company and Locations modules now show specific validation feedback when map/geofence data is incomplete.
- The saved site geofence continues to feed the existing attendance endpoint, which rejects biometric check-in/out outside the configured radius or with insufficient GPS accuracy.


## 2026-09-21 — Company profile redesign phase 1

### Changed

- Rebuilt the company quick-detail modal into a structured profile with a shallow hero, independent logo/identity block and fully readable company name.
- Added quick actions for Locations, Assets, Users and the complete company record.
- Added compact executive summaries for profile completion, location usage, asset usage and documentation state.
- Reorganized company data into collapsible sections for general information, primary site/coverage, resources, documentation and visual identity.
- Prepared the primary-site coverage section as the integration point for map, coordinates and geofence radius in the next phase.
- Made profile photo mandatory when creating a user in both the client form and server endpoint.
- Clarified that profile photos are not biometric reference data; facial attendance continues to require live-camera enrollment, liveness/anti-spoof validation and an encrypted facial template.


## 2026-09-21 — Compact company and location cards

### Changed

- Redesigned company cards into a narrower, denser directory layout targeting four cards per desktop row.
- Replaced tall resource progress sections with compact icon shortcuts showing used/assigned capacity.
- Added hover/focus tooltips for resource icons and direct navigation to Locations, Assets, Inventory and Users as appropriate.
- Split company-card interaction into a main detail action plus independent resource links to avoid nested interactive elements.
- Applied the same compact card language to principal-location cards, with direct sublocation and asset shortcuts.
- Reduced cover/logo/card-body height while retaining responsive one/two/three-column fallbacks.
- Made company logo mandatory in both the creation form and server endpoint.
- Made company cover/reference imagery optional; the company logo remains the default circular identity image.


## 2026-09-21 — Distinct sticky module headers

### Changed

- Changed the shared contextual header color across all authenticated modules so it no longer blends into white/light content cards.
- Added dedicated light and dark module-header surface tokens.
- Increased lower elevation/shadow so the sticky header reads clearly above scrolling content.
- Added a restrained Desweb teal lower accent line for additional separation.
- Kept the header opaque and consistent on desktop and mobile.


## 2026-09-21 — Opaque popup and modal surfaces

### Changed

- Removed transparency from dashboard date-range and export popovers so background cards/text no longer bleed through.
- Applied the same opaque-surface rule to account menus, contextual action panels, confirmation dialogs and application modals.
- Added theme-aware solid overlay tokens for light and dark modes.
- Made sticky modal headers/action bars use the same opaque surface as their parent layer.
- Preserved the dimensional design through borders and deeper elevation shadows rather than translucent panel bodies.


## 2026-09-21 — Mobile header alignment refinement

### Changed

- Kept the mobile dashboard hamburger anchored to the left side of the contextual header.
- Moved the current-module identity to the right side of the header.
- Reversed the mobile identity order so the module icon sits at the far right and its eyebrow/title/context text sits immediately to the left.
- Right-aligned the mobile module copy for a cleaner balanced header composition.


## 2026-09-21 — Mobile dashboard header and drawer repair

### Fixed

- Moved the drawer hamburger from a detached fixed position into the dashboard contextual header.
- Added a dedicated mobile navigation slot so module identity and navigation align as one mobile header.
- Fixed the mobile drawer being hidden by an older generic `.sidebar{display:none}` responsive rule.
- Made the smart sidebar explicitly visible/interactable while open with fixed full-height positioning and a higher layer than the overlay.
- Replaced overlay backdrop blur with a dark translucent scrim to prevent the “white/blurred screen” effect when opening navigation.
- Added body scroll lock while the drawer is open and automatic close on route changes.
- The sidebar collapse control now acts as a close control while the mobile drawer is open.
- Increased contrast and stroke weight of the landing user icon for better mobile visibility.


## 2026-09-21 — Mobile account access and export overlay fix

### Changed

- Replaced the landing header text account action with a compact user-icon button.
- The account icon routes to Login when signed out and directly to Dashboard when a session already exists.
- Kept the account control visible in the mobile landing header alongside the 15-day trial CTA.
- Styled the account control with the approved shared button geometry, icon sizing, elevation, hover, press and focus states.
- Fixed the Dashboard **Exportar** menu stacking by elevating the full filter-bar stacking context while the popover is open and preserving visible overflow.
- No export permissions, formats or report data semantics changed.


## 2026-09-21 — Reference-grid sitewide component system

### Changed

- Adopted the supplied component/style guide as the canonical geometry reference for Desweb CMMS.
- Added shared sitewide tokens for 4/8/12/16/24 px radii, 16/20/24 px icon tiers, 1/2/4 px border tiers, 16/24 px spacing and four elevation levels.
- Standardized cards, headers, dashboard panels, modals, popovers, tables, status badges, empty states and prerequisite states around the shared scale.
- Standardized primary, secondary, pressed and disabled button behavior plus compact icon-control sizing.
- Standardized inputs, selects, textareas, focus states and native checkbox/radio/range accents.
- Extended the same geometry to landing, login, checkout and lead-conversion surfaces while preserving the dark-only landing color policy.
- Kept responsive touch targets, light/dark parity, reduced-motion behavior and Desweb/white-label color identity.


## 2026-09-21 — Documentation state alignment

### Changed

- Audited repository documentation against the current implementation after the dashboard, mobile navigation, attendance and export work.
- Updated the roadmap so responsive role-aware mobile navigation, Dashboard Excel/CSV/PDF exports, personalized sidebar ordering and biometric/geofenced attendance are marked as implemented foundations rather than future capabilities.
- Expanded the architecture source of truth with the shared dashboard shell, preference persistence, export pipeline and field-attendance architecture.
- No runtime behavior changed in this documentation-only alignment.


## 2026-09-21 — Dimensional glass UI system

### Changed

- Evolved the shared CMMS UI away from flat controls toward a restrained dimensional-glass visual language.
- Updated primary and secondary buttons with depth, inner highlights and restrained luminous hover states.
- Updated inputs, selects, search controls and date-range controls with inset surfaces and stronger focus states.
- Added consistent depth to module headers, cards, dashboards, user cards, company cards and location cards.
- Updated tabs, selectable cards and checkbox controls with dimensional selected states.
- Updated modals, dropdowns and popovers with stronger layered separation and backdrop blur.
- Preserved Desweb teal/dark identity instead of copying reference cyan/purple colors.
- Added dark-theme equivalents, keyboard focus-visible treatment and reduced-motion behavior.
- Kept the visual treatment responsive so future mobile/PWA work inherits the same component language.


## 2026-09-21 — Consolidated Dashboard exports

### Changed

- Replaced separate PDF and Power BI buttons with one **Exportar** dropdown.
- Added native Excel (.xlsx) dashboard export.
- Kept CSV as the interoperable Power BI / Power Query export.
- Preserved PDF as the executive graphical report.
- Reworked Desweb PDF stationery to follow the supplied A4 landscape letterhead composition: centered brand identity, pale body watermark, footer slogan and page number.
- Pro white-label organizations continue to substitute their own report branding while retaining the same report hierarchy.
- Excel export includes Resumen, Datos and Metadatos sheets with branded styling and the same dashboard filters/permissions.


## 2026-09-21 — Dashboard single-header cleanup

### Changed

- Removed the redundant secondary Dashboard introduction panel.
- Kept Dashboard aligned with the shared module header structure used by Empresas, Ubicaciones and other directories.
- The primary header now carries the relevant company/role context.
- Date range, filters, PDF/Power BI actions and KPIs remain directly below the single header.
- Removed obsolete Dashboard intro/period styling.


## 2026-09-21 — Role-aware mobile navigation

### Added

- Added a documented mobile-first rule for dashboard UI changes.
- Preserved hamburger / drawer navigation for roles with broad module access.
- Added a dedicated Technician / External collaborator bottom navigation inspired by native field-service applications.
- Field navigation prioritizes Dashboard, Orders, Attendance and Assets.
- Added a **More** destination that opens the full permission-filtered module drawer.
- Added safe-area-aware bottom spacing so mobile navigation does not cover page actions.
- Reused the same authorized navigation item source across desktop, drawer and mobile bottom navigation.

### Mobile architecture

This responsive shell is the baseline for a future PWA/native application. Module screens should continue to be adapted responsively as they are changed so a later app shell requires minimal rework.


## 2026-09-21 — Visual locations and company-level users/suppliers

### Business rules

- Users now create directly under a company and no longer require a site/sub-location.
- Suppliers now create directly under a company and no longer require a site/sub-location.
- Site assignment remains an optional user access scope, not ownership.
- Provider-role accounts continue to require a same-company service supplier.

### Locations

- Added three-column visual site cards with cover images and company-logo overlap.
- Added site photos and contact fields.
- Added rich site information popup with edit, copy and WhatsApp actions.
- Added visual sub-location cards, search/filtering, inline detail/edit and photo upload.
- Added maintenance-service/work-order browsing inside the site popup.
- Added protected site and sub-location image endpoints.

### Users

- Added profile photo storage and protected avatar endpoint.
- Added profile-photo input to user creation/editing.
- User cards display avatar photography when available.

### Database

- Added migration 016 for site imagery/contact information, sub-location imagery and user avatars.


## 2026-09-21 — Modern date picker and enterprise PDF reports

### Changed

- Replaced separate Month / From / To dashboard date inputs with a single modern Spanish date-range picker.
- Added dual calendars, quick ranges and explicit Apply behavior.
- Reworked Dashboard PDF export into a branded executive report.
- Added KPI summary cards and graphical status/type distributions to PDF reports.
- Added report letterhead, executive interpretation block, detailed paginated records and branded footer.
- Added Pro white-label report branding using organization name, configured colors and organization logos.
- Preserved Desweb branding for platform reports and non-Pro plans.
- PDF export continues to preserve the exact dashboard role, tenant/site scope and filters.


## 2026-09-21 — Dashboard filters and exports

### Added

- Month filter on every role-aware dashboard.
- Explicit From / To date range filters.
- Company active/inactive filter for Platform Owner and Superadministrator.
- Subscription status filter for platform dashboards.
- Work-order status filters for Company Administrator, Manager, Viewer and Requester dashboards.
- Activity status filters for Technician, External collaborator and Provider dashboards.
- Filter-aware KPI, distribution and recent-record queries.
- PDF dashboard export generated server-side.
- Power BI-compatible UTF-8 CSV export.
- Exported datasets preserve the authenticated role, tenant/site scope and selected filters.

### Export semantics

- PDF provides a portable filtered dashboard report.
- Power BI export is CSV for direct import into Power BI / Power Query; the application does not fabricate proprietary PBIX files.


## 2026-09-21 — Role-aware Dashboard

### Changed

- Renamed the former **Resumen** navigation item to **Dashboard**.
- Replaced the generic operational summary with role-specific KPIs and analytical panels.
- Added Platform Owner business KPIs: paid active plans, estimated MRR, active companies and lead conversion.
- Added Superadministrator customer/subscription and global operational KPIs.
- Added Company Administrator and Manager maintenance, cost, downtime, inventory and workload analytics.
- Added Technician / External productivity, assigned activity and attendance metrics.
- Added Service Provider workload metrics.
- Added Requester request-resolution metrics.
- Added Viewer read-only operational metrics.
- Added plan-distribution, lead-funnel, work-order-distribution and recent-activity tables.
- Added responsive light/dark dashboard styling inspired by the supplied dashboard reference.

### Data semantics

- Revenue is labeled **MRR estimado** because it is calculated from active subscriptions and configured plan prices.
- It is not represented as collected cash until a payment ledger / provider reconciliation model is implemented.


## 2026-09-21 — Guided creation hierarchy

### Changed

- Added a shared prerequisite-state component matching the Users empty-state design.
- Creation now routes users to the earliest missing dependency with explicit copy and one CTA.
- Added hierarchy-aware guidance to Locations/Sub-locations, Suppliers, Crews, Assets, Inventory, Work Orders and Maintenance Routines.
- Company prerequisite CTAs open the Company creation popup directly.
- Location and Sub-location prerequisite CTAs open the Location popup at the required hierarchy level.
- Suppressed duplicate generic empty states while a prerequisite blocker is active.
- Centralized hierarchy resolution in `lib/setup-sequence.ts`.
- Fixed sub-location authorization so `platform_owner` is not incorrectly treated as a tenant user while tenant scoping remains enforced for normal users.

### Hierarchy

Company → Principal location → Sub-location → Supplier / Workforce → Asset / Inventory / Crew → Work Order / Routine.


## 2026-09-21 — Unified module directories and popup creation

### Design system

- Added a shared module header with keyword search, contextual filter and one entity-specific **Agregar** action.
- Removed the Users-only **Roles en uso** band from the general directory pattern.
- Standardized wide responsive creation popups.
- Improved form placeholders with realistic examples and clearer data-entry guidance.
- Added client-side search/filtering over already-authorized server result sets.

### Modules updated

- Companies
- Users
- Locations / Sub-locations
- Suppliers
- Crews
- Assets
- Work Orders / Requests
- Maintenance Routines
- Inventory
- Leads

### Companies

- Updated company cards toward the supplied visual reference: cover image, overlapping circular logo, centered identity/status and resource progress.
- Resource denominators are shown only where the product has a real enforced limit.
- Suppliers display as unlimited rather than implying an unenforced plan cap.

### Creation flows

- Moved supplier, crew, inventory and work-order creation out of inline page forms and into popups.
- Added a single Locations **Agregar** popup with choice between principal location and sub-location.
- Added manual Lead creation while retaining landing-page lead capture.
- Existing contextual create modals for companies, users, assets and routines now use the wider popup treatment.


## 2026-09-21 — Platform Owner contextual edit/delete controls

### Changed

- Removed the standalone destructive workspace, sidebar item and Settings card.
- Added contextual **Editar / Eliminar** actions directly to records in the normal CMMS modules for Platform Owner.
- Added owner actions to Leads, Empresas, Ubicaciones/Sububicaciones, Usuarios, Activos, OT/actividades, Rutinas, Inventario, Proveedores and Cuadrillas.
- Kept the PostgreSQL FK-driven recursive delete engine as an internal backend service only.
- Removed table/record discovery from the forced-delete API.
- Added an allow-listed owner-only update endpoint for modules that did not already expose full editing.
- Reserved definitive user and company deletion to Platform Owner.
- Kept existing edit permissions, hierarchy, creation flows and restrictions unchanged for all other roles.
- Forced updates and deletes remain server-authorized and audited.
- Platform Owner self-deletion remains blocked.

## 2026-09-21 — Platform Owner access foundation

### Added / changed

- Added persistent platform role `platform_owner` through migration `015_platform_owner_role.sql`.
- The environment bootstrap account configured by `APP_ADMIN_EMAIL` now resolves as **Propietario Desweb** instead of Developer/Superadministrator.
- Migration 015 promotes the existing database account `admin@dominio.com` to Platform Owner when present and removes tenant memberships from that platform identity.
- Platform Owner receives unrestricted RBAC access to every current permission and global module scope during the development phase.
- Updated dashboard, assets, work orders, routines, inventory, locations, suppliers, crews and attendance global scoping so Platform Owner is treated as a platform-level identity.
- Reserved Superadministrator creation and assignment exclusively to Platform Owner.
- Superadministrators can continue managing tenant users but cannot edit another platform account or the Platform Owner.
- Protected the Platform Owner account from accidental deactivation/deletion/demotion through the normal user directory.
- Updated role labels/descriptions so the sidebar/account menu identifies the owner as **Propietario Desweb**.
- Updated the role model and project documentation to distinguish implemented Platform Owner behavior from pending Commercial/Partner roles.

### Development safety boundary

- Platform Owner bypasses application RBAC restrictions.
- PostgreSQL referential integrity and explicit historical/lifecycle safeguards are not globally disabled; irreversible purge/reset operations will receive the previously designed controlled workflow before commercial release.


## 2026-09-21 — Approved platform-owner, sales and distribution role model

### Product decision

- Approved **Propietario Desweb / Platform Owner** as the future maximum platform role.
- Reserved Superadministrator creation/revocation exclusively to Platform Owner.
- Defined Superadministrator as a trusted platform operator rather than the final authority.
- Approved future **Comercial Desweb** and **Partner / Distribuidor** roles so sales/distribution do not require global technical administration.
- Preserved **Administrador de empresa** as the highest customer/tenant role.
- Defined platform/commercial hierarchy and tenant operational hierarchy as separate authorization domains.
- Defined a target server-enforced "who may create whom" matrix.
- Required every user-creation/edit interface to explain role scope, permissions, restrictions and creation authority.
- Required exceptional destructive operations to use a governed reauthentication/validation/audit process instead of normal CRUD deletion.
- Added `docs/ROLE_MODEL.md` as the canonical source of truth.

### Implementation status

- Documentation/product model only.
- No production RBAC behavior changed in this entry.


## 2026-09-21 — Company Profile v2 and corporate document dossier

### Added

- Added migration `014_company_profile_documents.sql`.
- Expanded company records with tax-ID type, legal/administrative address, phone, website, administrative/billing emails, primary-contact information and internal notes.
- Redesigned the full company page into a visual enterprise profile with cover/logo hero, plan, status, profile completion and local section navigation.
- Added a corporate document dossier with configurable Required / Optional / Not applicable classification.
- Added document categories for tax, legal, commercial contract, privacy/data treatment, insurance, certifications and other corporate records.
- Added issue date, expiry date, reference, notes, uploader and file metadata.
- Added authenticated PDF/image download and archive/update flows.
- Added document states for current, expiring within 30 days, expired, pending, optional without file and not applicable.
- Added profile-completeness and documentation-health indicators to company directory cards and quick detail.
- Kept administrative/fiscal addresses explicitly separate from operational sites.

### Security / data handling

- Corporate documents remain organization scoped.
- Downloads require the same company-management authorization as the current company workspace.
- Files are limited to PDF, PNG, JPEG or WebP up to 10 MB and are served with private/no-store and nosniff headers.


## 2026-09-21 — Facial attendance, geofencing and field execution analytics

### Added

- Added migration `013_biometric_attendance_geolocation.sql`.
- Added organization attendance policies with role scope, facial verification, geolocation and configurable accuracy/confidence thresholds.
- Added site latitude, longitude and geofence radius configuration.
- Added the **Asistencia** workspace and permission-aware navigation.
- Added browser camera enrollment with face description, liveness and anti-spoof validation using Human 3.3.6.
- Added local packaging of biometric ML model files for SaaS/self-hosted runtime.
- Added AES-256-GCM encryption for persisted facial templates; enrollment photographs are not stored.
- Added self-service biometric template deletion.
- Added geofence-validated field clock-in and clock-out with one-open-shift-per-user enforcement.
- Added activity execution events correlated with open attendance shifts.
- Added descriptive 30-day field statistics for hours, shifts and activity timing without automated employee rankings.
- Added self-hosted `BIOMETRIC_ENCRYPTION_KEY` deployment requirement and biometric/privacy guidance.


## 2026-09-20 — Retractable and user-orderable dashboard sidebar

### Added

- Redesigned the authenticated sidebar into a compact dark technology rail with Desweb teal/cyan accents.
- Added expanded and collapsed desktop navigation states.
- Added responsive mobile drawer navigation.
- Added per-user module ordering with drag-and-drop.
- Added accessible **Subir / Bajar** reorder controls for keyboard/touch workflows.
- Added **Restaurar** to return modules to the default permission-filtered order.
- Added migration `012_user_dashboard_preferences.sql` for persistent sidebar order and collapsed state.
- Added authenticated preferences API; module IDs are allow-listed before persistence.
- Database-backed users keep preferences across browsers/devices.
- The bootstrap developer account falls back to browser-local persistence because it has no user row.
- Updated context-header labels for Leads, Proveedores, Cuadrillas and Rutinas.


## 2026-09-20 — Context-aware creation popups

### Added

- Added reusable contextual creation popups for locations, sublocations, assets, routines and company-scoped users.
- Company detail now exposes **Nueva ubicación** and **Nuevo usuario** without asking for the company again.
- Locations module now creates both principal locations and sublocations from popups.
- Site detail now creates sublocations with the site preselected.
- Sublocation administration now offers **Crear activo aquí**, preserving company, site and exact sublocation.
- Assets module now creates assets from a popup and links into a new asset detail workspace.
- Asset detail now exposes **Nueva rutina** with the asset already selected.
- Preventive maintenance navigation is labeled **Rutinas**, and the module can create routines by selecting an asset.
- Contextual mutation routes return to the originating dashboard screen while re-validating all server-side relationships and permissions.


## 2026-09-20 — Operational setup sequence and outsourced maintenance

### Added

- Added migration `011_operational_sequence_external_services.sql`.
- Added mandatory setup gates for company → principal location → sublocation → supplier → workforce/crews → assets/inventory → activities.
- Added the **Proveedores** module with Materials, Services and Materials + services classifications.
- Added **Proveedor de servicios** and **Colaborador externo** organization roles with distinct access semantics.
- Provider accounts must be linked to a service-capable supplier; external collaborators may optionally be linked to one.
- Added **Cuadrillas** with leader and membership made of internal technicians and external collaborators.
- New assets now require an exact sublocation and supplier relationship.
- Added inventory-item creation with required sublocation and supplier relationship.
- Added work-order activity planning and execution with exactly one executor: person, crew or service supplier.
- Added activity lifecycle states, execution notes and timestamps.
- Provider accounts only see work assigned to their supplier; external collaborators only see work assigned directly or through their crew.
- Extended user-history protection to activity assignments and crew membership so traceable users cannot be permanently removed.
- Added modern setup-progress messages that explain missing prerequisites and route users to the correct previous step.


## 2026-09-20 — Direct installation download and restored branding editor

### Added

- Simplified **Instalación propia** into a short, focused beta landing with a primary direct-download CTA.
- Added automatic production-build packaging through `scripts/package-runtime.sh`.
- The direct `.tar.gz` package contains the compiled Next.js standalone runtime, Dockerfile, Docker Compose, PostgreSQL migration assets, environment template and installation helper.
- Restored global logo/favicon administration directly inside Superadministrator **Configuración**.
- Added modern previews and clear upload guidance for light-background logo, dark-background logo and favicon.
- Documented accepted image formats, 2 MB maximum file size and recommended dimensions.
- Branding uploads made from Configuración now return to the same module with success/error feedback.


## 2026-09-20 — Principal logo and clearer installation terminology

### Changed

- Applied the supplied principal Desweb logo to the public landing header.
- Removed the redundant **CMMS** text from beside the header logo.
- Increased header navigation, login and Trial CTA typography for better readability.
- Replaced the public-facing term **Self-hosted** with **Instalación propia** across the landing and downloads experience.
- Kept `self-hosted` as an internal/technical term where deployment precision is useful.


## 2026-09-20 — Floating corporate landing header and dark-only policy

### Changed

- Replaced the full-width dark landing header with a floating white navigation surface inspired by the supplied Desweb web identity example.
- Enlarged and simplified logo presentation to improve legibility and breathing room.
- Kept the landing permanently dark while preserving theme support for the authenticated application.
- Removed the public landing theme switch.
- Refined the footer to use a larger brand lockup, contact details and restrained Desweb geometric accents.
- Documented production logo usage: isolated assets only, never crops from the composite identity board.


## 2026-09-20 — Landing branding, themes and advisor lead capture

### Changed

- Replaced the cramped text/initial landing identity with the configured Desweb logo in the public header and footer.
- Added responsive logo contrast handling when no dedicated dark-background logo exists.
- Added a light/dark appearance switch to the landing using the shared `desweb-theme` preference.
- Added a commercial FAQ section based on current product behavior and capabilities.
- Added an advisor-contact conversion section without reusing unverifiable legacy testimonials or outdated pricing.
- Added migration `010_sales_leads.sql`, public lead persistence and a Superadministrator-only **Leads** workspace with follow-up statuses.
- Redesigned the footer into a product/commercial navigation surface with a direct sales CTA.
- Documented the landing as a dual conversion surface: self-service checkout plus advisor-assisted lead generation.


## 2026-09-20 — Dark technology landing visual system

### Changed

- Reworked the public landing CSS into a dark technology/control-center aesthetic inspired by the supplied visual reference while preserving the Desweb identity.
- Added institutional dark backgrounds, teal/mint glow, technical grid treatments, darker product telemetry panels and premium SaaS surface styling.
- Refined hero and section copy toward a technology-first maintenance-control proposition.
- Extended the same visual language to the self-hosted/downloads page.
- Added global design-system guidance requiring future project surfaces to feel fresh, modern and technological without copying third-party branding or artwork.


## 2026-09-20 — Login public navigation

### Changed

- Added a lightweight public navigation bar to `/login` with **Inicio**, **Ver planes** and **Self-hosted**.
- Made the Desweb logo on login clickable and linked it back to Home.
- Added a compact post-form CTA for the 15-day Trial plus links to plan comparison and the self-hosted edition.
- Kept the login authentication-first and intentionally avoided operational navigation or a fake password-recovery action.


## 2026-09-20 — Resilient checkout and subscription settings

### Fixed

- Reworked the public checkout so validation errors no longer clear the user's entered data.
- Added inline field-level validation for company, administrator name, email, password, city and primary site.
- Added explicit duplicate-email feedback instead of a generic account-creation failure.
- Replaced Trial interval string concatenation with PostgreSQL `make_interval(days => ...)` for reliable 15-day provisioning.
- Added Home navigation to checkout flows.
- Successful self-service provisioning now lands on company settings, where the acquired plan and resources are immediately visible.
- Added subscription start/end dates and **Mejorar plan** to company settings.
- Simulated plan upgrades now return to settings with refreshed entitlements and confirmation feedback.


## 2026-09-20 — Professional public landing and downloads recovery

### Changed

- Rebuilt the public landing as a complete commercial SaaS experience with product hero, illustrative dashboard preview, benefits, workflow, plan comparison, self-hosted section and final conversion CTA.
- Kept plan prices intentionally undefined while commercial pricing remains pending.
- Redesigned the self-hosted downloads page with deployment architecture, package workflow, installation and licensing information.
- Added `/descargas` as a Spanish alias of `/downloads` to reduce path ambiguity while diagnosing stale production deployments.
- Documented public marketing surfaces in the design system and project context.


## 2026-09-20 — Public landing access and self-hosted package workflow

### Added

- Kept the public SaaS landing visible at `/` even when an authenticated session exists.
- Added a **Descargas** link from the landing and a public `/downloads` page explaining the self-hosted edition.
- Added the **Package self-hosted** GitHub Actions workflow to build versioned ZIP and TAR.GZ installation artifacts for private/internal beta distribution.
- Packaged artifacts include source commit/version metadata and exclude local secrets, Git history, dependencies and build output.
- Documented that anonymous commercial downloads remain deferred until licensing and release controls are defined.


## 2026-09-20 — Documentation continuity, self-hosting and IP strategy

### Added

- Made repository documentation an explicit required deliverable for meaningful product changes.
- Refreshed `docs/PROJECT_CONTEXT.md` so another AI/developer can reconstruct current product, SaaS, RBAC, subscription and UI direction without chat history.
- Added `docs/COMMERCIAL_MODEL.md` as the source of truth for Trial/Básico/Medio/Pro, subscription lifecycle and sales channels.
- Added `docs/INSTALLATION.md`, `compose.yaml` and `scripts/install.sh` for a portable Docker Compose/self-hosted installation.
- Added `docs/IP_AND_DISTRIBUTION.md` to separate software copyright, trademarks, patent evaluation and commercial licensing/distribution.
- Documented that no open-source license has been approved and that payment activation must ultimately rely on verified server-side webhooks.


## 2026-09-20 — SaaS plans, trial lifecycle and test landing

### Added

- Added Trial, Básico, Medio and Pro billing plans with resource defaults.
- Added organization subscriptions, monthly periods, subscription status and lifecycle events.
- Added a 15-day Trial plan and operational access blocking after trial expiration.
- Added a public product landing with plan comparison.
- Added a clearly labeled simulated checkout for provisioning tests without card processing.
- Added automatic creation of organization, limits, primary site, administrator and subscription from the test checkout.
- Added simulated paid-plan activation for existing expired tenants without creating a duplicate organization.
- Superadmin company creation now starts from a plan selection instead of arbitrary initial quotas.
- Added Pro-only organization white-label persistence for platform name, colors and light/dark logos.
- Added Pro white-label controls to company settings and applied tenant branding to the authenticated dashboard.
- Existing companies are backfilled as active Medium subscriptions with preserved custom limits.


## 2026-09-20 — Company administrator settings and role simplification

### Changed

- Removed the redundant **Propietario** organization role.
- Added migration `007_remove_owner_role.sql` to convert existing `owner` memberships to `admin` and tighten the database role constraint.
- **Administrador de empresa** is now the highest organization-level role.
- Added `settings.view` for company administrators without granting global personalization or resource-entitlement editing.
- Added a tenant-specific **Configuración de empresa** view with company information and resource consumption.
- Resource cards show assigned capacity, consumed capacity, remaining capacity and percentage used.
- Resource status changes from teal to warning at 80% and critical at 95% or above.
- Resource limits remain read-only for company administrators and editable only by Superadministrators.


## 2026-09-20 — Company resource entitlement editing

### Changed

- Added current usage and assigned resource limits to the company detail modal.
- Superadministrators can now edit principal-location, sublocation, asset, inventory and technician quotas from the same **Editar información** flow.
- Resource changes are saved transactionally with the company update.
- Added an explicit `company_resources.manage` authorization capability reserved to platform superadministrators.
- Company administrators remain unable to modify platform resource entitlements.


## 2026-09-19 — Users directory null-scope fix

### Fixed

- Normalized site access arrays for global/superadministrator accounts that do not have an organization membership row.
- Made the user directory and edit modal null-safe when rendering site assignments.
- Prevented `/dashboard/users` from failing when a global account is included in the directory.


## 2026-09-19 — Multi-site user access

### Added

- Added migration `006_multi_site_user_access.sql` with all-site or explicit multi-site membership scope.
- Replaced the single-site user selector with company-dependent **Todas las sedes / Sedes específicas** access controls.
- Added individual site checkboxes that only show active sites belonging to the selected company.
- Persisted selected sites in `organization_member_sites` and exposed them in authenticated sessions.
- Updated user cards to summarize all authorized sites.
- Scoped dashboard metrics, locations, assets, work orders, preventive plans and inventory by assigned sites.
- Added server-side site authorization to asset/work-order creation and location mutations.
- Restricted limited-scope administrators from granting sites outside their own authorized scope.


## 2026-09-19 — Context header and account menu

### Changed

- Simplified the floating header so it only communicates the current section and organization context.
- Removed duplicate horizontal module navigation from the header; the sidebar is again the single desktop navigation surface.
- Removed **Configuración** from the permanent sidebar module list.
- Added a compact account control at the bottom of the sidebar with the signed-in user's name and role.
- Added a click-to-open account menu with access to **Configuración** and **Cerrar sesión**.
- Preserved active-module indication in the sidebar and dark-theme support for the new account menu.


## 2026-09-19 — Modern workspace shell and platform settings

### Changed

- Redesigned the authenticated shell with a denser technology-oriented workspace, larger usable content width and elevated surfaces.
- Added a compact floating application header with permission-aware horizontal tabs and an active-section indicator.
- Added active-state feedback to the persistent sidebar navigation.
- Removed the light/dark switch from the operational header.
- Added the global **Configuración** module with **Claro**, **Oscuro** and **Sistema** appearance preferences.
- Linked branding/personalization and user administration from the centralized settings module.
- Modernized the users workspace with a denser role summary, more compact empty state and three-column desktop directory where space allows.
- Preserved responsive navigation through the horizontal header tabs when the desktop sidebar is hidden.


## 2026-09-19 — User management modal and lifecycle protection

### Changed

- Redesigned **Usuarios y roles** around a role summary, user directory and empty state instead of a permanently visible creation form.
- Added a branded create/edit user modal with contextual role-permission explanations.
- Added inline field validation that preserves entered values until the user explicitly cancels.
- Added superadministrator-only editing, activation/deactivation and permanent deletion controls.
- Added operational-history checks before deletion; users referenced by work orders, meter readings, comments or audit records must be deactivated instead.
- Prevented moving accounts with recorded activity between organizations or between tenant/global access scopes.
- Added protected password replacement during user editing and retained technician quota enforcement.


## 2026-09-19 — Users, roles and tenant-aware authentication

### Added

- Added migration `005_user_auth_and_roles.sql` for password credentials, platform roles and login metadata.
- Added PostgreSQL-backed login while preserving the environment bootstrap account as a superadministrator fallback.
- Added scrypt password hashing with a unique random salt per account.
- Added signed HTTP-only identity sessions resolved against the database.
- Added a centralized permission matrix for superadmin, owner, admin, manager, technician, requester and viewer.
- Added the **Usuarios y roles** module for creating test/production accounts with company, optional site and role assignments.
- Added a tenant-scoped **Ubicaciones** workspace for company roles.
- Added role-filtered navigation and signed-in identity/role display.
- Added tenant scoping to dashboard, assets, work orders, preventive maintenance and inventory.
- Added read/write distinctions so viewer-like roles do not receive mutation forms.
- Added requester behavior that limits the work-order list to requests created by that account.
- Added server-side permission and tenant checks to core company, location, asset, work-order and personalization mutations.


## 2026-09-19 — Branded confirmation dialogs

### Changed

- Replaced native browser confirmation prompts in company save and permanent-delete flows with Desweb-styled in-app dialogs.
- Added a reusable confirmation dialog with default and destructive variants.
- Updated `ConfirmSubmitButton` so future confirmation-based form actions inherit the same branded interaction.
- Added keyboard Escape handling, focus restoration, light/dark theme support, responsive behavior and reduced-motion support.


## 2026-09-19 — Tenant limits and location hierarchy

### Added

- Added migration `004_tenant_limits_and_location_hierarchy.sql`.
- Added super-administrator resource assignments for locations, sublocations, assets, inventory and technicians.
- Added server-side enforcement for principal-location and sublocation creation.
- Added recursive sublocations with arbitrary practical depth.
- Added a dedicated location workspace with parent selection, hierarchy view, editing and activation state.
- Prepared assets, work orders and inventory articles for precise sublocation assignment.
- Added `docs/FUNCTIONAL_MODEL.md` with roles, entity definitions, workflow and implementation order.


## 2026-09-19 — Protected company detail popup

### Added

- Changed “Ver detalle” to open a modal without leaving the company directory.
- Added read-only company and primary-site information by default.
- Added an explicit edit mode that unlocks company, primary-site and optional image fields.
- Added a save confirmation before any modal edit is submitted.
- Added permanent company deletion with an irreversible-action confirmation.
- Added image guidance for accepted formats, recommended pixel dimensions and file-size limits.
- Kept the full company page available for multi-site administration.


## 2026-09-19 — Visual company directory

### Added

- Replaced the company list with responsive visual cards.
- Added point-of-reference cover images and centered company logos.
- Added location, active-site and asset summaries to each card.
- Replaced the inline creation form with an accessible popup.
- Added logo and cover uploads to company creation.
- Added logo and cover replacement from the company detail page.
- Added migration `003_organization_visual_assets.sql`.
- Added authenticated routes for company visual assets.
- Added image type and size validation with durable PostgreSQL storage.


## 2026-09-19 — Company and site management

### Added

- Added a dedicated detail page for every company.
- Added company editing for commercial name, legal name, tax ID, identifier and timezone.
- Added activation and deactivation controls for companies.
- Added creation and management of multiple sites per company.
- Added site editing for name, code, address, city and country.
- Added activation and deactivation controls for sites.
- Added company and site operational summaries for assets and work orders.
- Updated the company directory with status, site counts and detail navigation.


## 2026-09-19 — Login branding alignment

### Changed

- Centered the login logo within the left column.
- Moved the `CMMS` product label below the logo to prevent horizontal visual displacement.
- Preserved configurable light/dark logo behavior and responsive layout.

This file records meaningful product and engineering changes so future developers and AI agents can reconstruct the project history.

## 2026-09-18 / 2026-09-19 — Initial CMMS foundation

### Added

- Initialized `alentopizza/cmms`.
- Created Next.js + TypeScript application.
- Added PostgreSQL support with `pg`.
- Added Dockerfile and Easypanel deployment structure.
- Added automatic SQL migration runner.
- Added health endpoint at `/api/health`.
- Added initial multi-company relational schema.
- Added organizations and sites.
- Added users and organization memberships/roles.
- Added asset categories and assets.
- Added meters and meter readings.
- Added preventive maintenance plans.
- Added work orders and work-order tasks/comments.
- Added suppliers.
- Added inventory and inventory transactions.
- Added attachments and audit log.
- Added dashboard summary.
- Added company creation.
- Added asset registration.
- Added work-order creation.
- Added preventive and inventory base screens.
- Added GitHub Actions build validation.

### Deployment fixes

- Configured deployment for Easypanel internal port `3000`.
- Corrected production domain from an early typo to `cmms.desweb.cloud`.
- Fixed redirects that previously exposed the internal Docker hostname after login by introducing `lib/urls.ts`.
- Added PostgreSQL startup retry logic so transient database readiness does not crash the container during redeploy.
- Explicitly bind Next.js to `0.0.0.0:3000`.

### Authentication

- Started with password-only bootstrap authentication.
- Upgraded bootstrap login to require both `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD`.

### Branding and UI

- Corrected product naming from “Deswel” to **Desweb**.
- Adopted official Desweb palette: `#293644`, `#FCFCFC`, `#BAE3E0`, `#79CAC4`, `#38B2A9`.
- Added official branding documentation and design-system guidance.
- Added enterprise two-panel login with illustrative CMMS metrics.
- Redesigned authenticated shell, sidebar and dashboard around Desweb branding.
- Corrected logo asset rendering and contrast behavior.

### Personalization module

- Added migration `002_app_customization.sql`.
- Added global `app_customization` settings row in PostgreSQL.
- Added **Personalización** module to the dashboard navigation.
- Added upload/replacement for:
  - logo for light backgrounds;
  - logo for dark backgrounds;
  - favicon.
- Custom branding files are stored in PostgreSQL so they survive application redeploys.
- Added dynamic asset endpoints for logos and favicon.
- Added dynamic favicon integration in the root layout.
- Added light/dark theme switcher.
- Theme preference is stored in browser local storage and initially honors the operating-system color scheme.
- Login and application shell choose the appropriate configured logo for their background/theme.
- Added contrast fallback behavior when a dark-background logo has not yet been configured.

### Documentation continuity

- Added `AGENTS.md` as the entry point for future AI agents and contributors.
- Added project context, architecture, decisions, branding, design system, roadmap and changelog under `docs/`.
- Meaningful implementation changes must update the changelog and relevant technical documentation.


## 2026-09-24 — Dashboard recovery, phone editing correction and leader-forward Crews

### Fixed

- Corrected the controlled Phone/WhatsApp field so an E.164 value emitted while typing no longer reappears inside the national-number input as the Country calling code. Editing now keeps the automatic prefix separate while the user can type the national number normally.
- Hardened the root Dashboard against analytical-query failures: one failed metric/query now falls back to a safe navigation state instead of collapsing the entire `/dashboard` route into Next.js' generic server-error screen. The original exception is still logged server-side for diagnosis.

### Changed — Crews

- Redesigned the Crew directory around the supplied leader/member visual reference while keeping Desweb colors, typography, light/dark behavior and responsive layout.
- The Crew leader now has a prominent photo/identity panel plus WhatsApp, call and email actions when those contact values exist.
- Crew cards show member count, active Activities and completed Activities, plus a compact visual roster with profile photos.
- Crew creation now uses a visual leader picker and visual member selector.
- **Managers/Supervisors are valid Crew members and leaders**, alongside Technicians and authorized external collaborators.
- Leadership is an explicit operational choice; it is not inferred from role. Selecting a leader automatically includes that person in the Crew.
- Eligible members are restricted to the same Organization and must have access to the Crew's selected Site.
- Setup-sequence workforce checks now count Managers/Supervisors as eligible Crew personnel.


## 2026-09-24 — Dashboard monthly trend SQL root-cause correction

### Fixed

- Removed the temporary whole-Dashboard "safe mode" substitution for Company dashboards. The real role Dashboard is rendered again.
- Identified the runtime failure in PostgreSQL 17: monthly trend queries used the unquoted alias `month`, producing `syntax error at or near "month"`.
- All monthly trend queries now expose the period key as quoted SQL alias `"month"` for Platform, Company, Field and Requester dashboards.
- Company-dashboard analytical blocks now use simpler isolated queries. A secondary analytical failure can omit only the affected block while the rest of the real Dashboard remains available.

### Validation

- CI now starts PostgreSQL 17, executes every database migration, runs dashboard SQL smoke queries, and only then performs the Next.js production build.
- The SQL smoke suite covers Company KPI queries plus monthly trend SQL for Platform, Company, Field and Requester role families.


## 2026-09-24 — Supplier financial view and export cleanup

### Fixed

- Supplier financial information no longer renders the read-only summary and edit form at the same time.
- The Financial tab now opens in read-only mode with masked account data and an explicit **Editar** action.
- After saving financial information, the supplier returns to the Financial tab in read-only state, so the primary action becomes **Editar** again.
- Removed the duplicate **Hoja de vida** tab and its second export menu from Supplier profiles.
- The only Supplier export control is now the upper profile toolbar **Exportar** action, labelled as **Ficha del proveedor** in PDF, Excel and Word formats.


## 2026-09-24 — Inventario, Activos, Kardex e importación masiva

### Added

- Inventario y Activos incorporan importación masiva XLSX con validación previa, reporte de errores/advertencias por fila y confirmación explícita.
- Plantillas descargables contextualizadas por empresa para Inventario/Kardex y Activos.
- Inventario incorpora Bodegas, categorías, stock mínimo/máximo, stock por bodega y Kardex trazable.
- El stock inicial se registra como Entrada de Kardex, no como saldo silencioso.
- Kardex soporta Entrada, Salida, Ajustes, Devolución y Traslado, además de lote, vencimiento y centro de costo.
- PostgreSQL rechaza salidas que produzcan stock negativo y mantiene el saldo agregado del artículo mediante trigger.
- Inventario y Activos incorporan exportación Excel, CSV y PDF.
- Requisiciones permite editar cantidades y costos estimados de ítems mientras siga abierta, y retirar ítems sin recepción.
- La pestaña Inventarios / suministros del proveedor permite crear, importar, editar, desactivar y abrir el Kardex de artículos asociados.

### Compatibility

- El importador reconoce la plantilla demo revisada con hojas Productos, Bodegas y Kardex.
- Las filas declaradas como Servicios tercerizados se omiten con advertencia en lugar de bloquear la carga de materiales.
- La columna Cantidad base del formato demo se reconoce como stock inicial para artículos nuevos.

### Validation

- CI ahora ejecuta un smoke test de Kardex sobre PostgreSQL 17 para comprobar Entrada, Salida, Traslado, Ajuste, stock por bodega, saldo total y rechazo de inventario negativo.


## 2026-09-24 — Inventario operativo y edición completa de Activos

### Added

- Navegación interna de Inventario para Resumen, Productos, Categorías, Almacenes, Entradas, Salidas, Ajustes, Transferencias y Kardex.
- Gestión CRUD operativa de Categorías y Almacenes/Bodegas.
- Kardex global con alta de movimientos, búsqueda/filtros y exportación independiente a Excel, CSV y PDF.
- Lote, vencimiento y centro de costo disponibles tanto en Kardex global como en la ficha del artículo.
- Productos inactivos permanecen visibles mediante filtro de registro y pueden reactivarse sin perder historial.
- Imágenes autenticadas para Productos de Inventario y Activos.
- Creación y edición técnica completa de Activos: ubicación, proveedor, categoría, estado, criticidad, fabricante, modelo, serial, fechas, costo, notas e imagen.

### Changed

- Los indicadores de Inventario calculan stock y valor operativo sobre registros activos, manteniendo los inactivos disponibles para auditoría y recuperación.
- La ficha de Activo pasa a ser la superficie normal de edición para usuarios con permiso `assets.write`.


## 2026-09-24 — Recepción de requisiciones y conciliación con Kardex

### Added

- Recepción física parcial o total desde la ficha de una requisición.
- Selección de bodega por ítem recibido.
- Captura opcional de documento, fecha/hora, costo real, lote, vencimiento, centro de costo y observaciones.
- Enlace auditable entre movimientos de Kardex y requisición/ítem origen.
- Historial de recepciones dentro de la requisición.
- Progreso de recepción en el directorio general y en la ficha del proveedor.
- Referencia REQ navegable desde Kardex y en exportes de Kardex.
- Cantidades Solicitado / Recibido / Pendiente en PDF, Excel y Word de la requisición.

### Changed

- Una recepción parcial establece automáticamente el estado `partial`.
- Al completar todas las cantidades solicitadas, la requisición cambia automáticamente a `fulfilled` y registra `fulfilled_at`.
- Crear, enviar o aprobar una requisición continúa sin alterar stock; el inventario aumenta únicamente al registrar la recepción.

### Validation

- Nueva migración `033_requisition_inventory_receipts.sql`.
- Nuevo smoke test `scripts/requisition-receipt-smoke.mjs` incorporado a CI.


## 2026-09-24 — Inventario de proveedor e historial de importaciones

### Added

- Imágenes de producto al crear o editar suministros directamente desde la ficha del proveedor.
- Reactivación de suministros desactivados sin perder Kardex ni relaciones.
- Historial reciente de cargas masivas dentro del modal de Importar, con archivo, fecha, usuario, filas, avisos y errores.

### Fixed

- Los suministros inactivos ya no desaparecen definitivamente de la ficha del proveedor.
- Los suministros inactivos quedan excluidos de nuevas requisiciones hasta ser reactivados.
- Platform Owner/Superadministrador puede descargar la plantilla e importar desde una ficha de proveedor usando la empresa real del proveedor, sin depender del contexto global seleccionado.
