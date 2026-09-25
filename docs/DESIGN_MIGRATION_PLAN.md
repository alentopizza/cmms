# DESWEB Design Migration Plan

> Estrategia aprobada: migración progresiva por fases.  
> Objetivo: convertir el ERP actual en un producto coherente sin reescribir lógica funcional ni migrar todo de una sola vez.

## Principios de ejecución

1. **Foundations first.** Ningún módulo se rediseña en profundidad antes de tener tokens y primitives suficientes.
2. **No big-bang migration.** Cada fase debe ser desplegable y reversible por PR.
3. **No functional drift.** Diseño y negocio se separan.
4. **Reuse over local CSS.** Cada migración reduce duplicación.
5. **Documentation is part of Done.** Changelog, manual y docs se actualizan en la misma entrega.
6. **Responsive/accessibility are acceptance criteria**, no postergables.
7. **Legacy CSS is migrated opportunistically**, no por búsqueda/reemplazo ciego.

## Fase 0 — Gobierno y documentación

**Estado: completada.**

Entregables:

- Design System V2 canónico;
- UI Kit contract;
- plan de migración;
- actualización de branding, AGENTS, contexto, decisiones y roadmap;
- identificación explícita de la paleta/CSS legacy.

No modifica la interfaz productiva.

## Fase 1 — Foundations + estructura técnica del UI Kit

**Estado: implementada; pendiente únicamente de merge/CI en este checkpoint.**

Objetivo: instalar la base sin migrar módulos completos.

Entregables:

- tokens CSS V2 en capa central;
- aliases temporales para compatibilidad legacy cuando sean necesarios;
- spacing/radius/shadows/motion;
- tipografía;
- semantic colors;
- dark-theme semantic mapping;
- estructura de componentes UI Core;
- decisión/normalización del sistema de iconos;
- skeleton inicial de `/ui-kit`;
- inventario de hardcoded colors/componentes duplicados.

Validación:

- la aplicación sigue compilando;
- no cambia lógica funcional;
- los componentes legacy no se rompen;
- tokens V2 pueden consumirse desde nuevos componentes.

## Fase 2 — Primitives e interacción base

Componentes:

- Button / IconButton / SplitButton;
- Input family;
- Select family;
- Checkbox / Radio / Switch;
- Textarea;
- Badge / StatusIndicator;
- Card;
- Tooltip;
- Dropdown;
- Modal;
- Drawer;
- Tabs / Pills / Segmented;
- Breadcrumb;
- Toast / Alert;
- Empty / Loading;
- Avatar;
- FileUpload.

Objetivo: ningún módulo nuevo debe necesitar inventar controles básicos.

Validación:

- estados default/hover/focus/active/disabled/loading;
- teclado;
- responsive;
- light/dark;
- ejemplos en `/ui-kit`.

## Fase 3 — Shell y navegación global

**Estado: implementada.**

Migrar:

- application shell;
- sidebar;
- header;
- cuenta/acciones globales;
- navegación móvil;
- Breadcrumb;
- ModuleNavigation.

Mantener:

- orden configurable del sidebar;
- RBAC;
- rutas;
- preferencias;
- Personalización;
- light/dark/system.

Objetivo: establecer la nueva identidad DESWEB V2 en toda la aplicación sin tocar contenido interno de cada módulo.

## Fase 4 — Data UI compartida

**Estado: implementada.**

Componentes/patrones:

- Search;
- FilterButton/FilterPanel;
- DataTable;
- Pagination;
- row actions;
- bulk actions;
- KPI Card;
- metric layouts;
- chart palette;
- timeline;
- progress.

Migrar primero superficies reutilizables como `ModuleHeader`, directorios y tablas genéricas.

## Fase 5 — Business UI

**Estado: implementada.**

Crear sobre primitives:

- AssetCard;
- InventoryCard;
- MaintenanceCard;
- WorkOrderCard;
- SupplierCard;
- LocationCard.

Consolidar patrones existentes de:

- User Card;
- Supplier Card;
- Entity Profile Workspace.

No homogeneizar identidades que el producto necesita distinguir; compartir estructura/tokens, no necesariamente composición idéntica.

## Fase 6 — Primer bloque de módulos

**Estado: implementada.**

Orden:

1. Dashboard;
2. Empresas;
3. Ubicaciones.

Objetivo:

- probar el sistema en superficies analíticas, directorios y perfiles;
- resolver patrones reutilizables antes de módulos operativos densos.

## Fase 7 — Activos e Inventario

**Estado: implementada.**

### Activos

Implementar navegación secundaria oficial:

- Lista de Activos
- Tipos
- Categorías
- Marcas
- Modelos
- Estados
- Mantenimientos
- Historial
- Documentos
- Configuración

### Inventario

Implementar navegación secundaria oficial:

- Resumen
- Productos
- Categorías
- Almacenes
- Entradas
- Salidas
- Ajustes
- Transferencias
- Kardex
- Reportes
- Configuración

Migrar cards, tablas, formularios, importación, Kardex y estados sin cambiar la arquitectura funcional ya validada.

**Phase 7 completion checkpoint — 2026-09-24**

Phase 7 is implemented end-to-end for Assets and Inventory.

Assets now includes the approved secondary navigation plus derived catalog views for Types (root categories), Categories, Brands, Models, States, Maintenance, History, Documents and Configuration. This deliberately reuses the existing schema instead of inventing new master-data tables. Asset list/detail surfaces consume official KPI, Badge, Alert, EmptyState, StaticDataTable and Business UI patterns.

Inventory now includes the full approved navigation: Summary, Products, Categories, Warehouses, Entries, Issues, Adjustments, Transfers, Kardex, Reports and Configuration. Summary/detail/category/warehouse/Kardex surfaces consume V2 primitives while preserving the validated Kardex as stock authority. Bulk import keeps its atomic validation, duplicate policy, provider context and audit history while consuming canonical feedback/status/icon patterns.

The CreateRecordModal icon bridge now accepts canonical UiIcon names for V2 module flows, and ModuleNavigation correctly distinguishes hash/query section destinations.

No database schema, API, stock calculation, procurement, requisition, RBAC or organization/Site scope behavior changed.

**Next implementation phase: Phase 8 — Suppliers + People.**

## Fase 8 — Proveedores + Personas

**Estado: implementada.**

Migrar:

- Proveedores;
- Usuarios;
- Cuadrillas;
- Asistencia.

Preservar:

- diferencias visuales entre Supplier/User;
- perfil en página;
- flujos de asistencia/biometría;
- seguridad y privacidad;
- acciones contextuales existentes.

**Phase 8 completion checkpoint — 2026-09-24**

Phase 8 is implemented end-to-end for Suppliers, Users, Crews and Attendance.

Suppliers retain the distinct commercial identity already established by SupplierCard and EntityProfileWorkspace while status, feedback, summary metrics and commercial history tables now consume V2 primitives. Inventory, requisitions, procurement evidence, returns, documents and financial-profile relationships remain unchanged.

Users retain their separate people/access visual language through UserCard and EntityProfileWorkspace. Directory/profile status, empty/error states and statistics fallback now consume Badge, Alert, EmptyState, StatTiles, Button and Spinner. User operational analytics consume KpiCard, ProgressBar, Badge and EmptyState while preserving descriptive—not automated—performance interpretation.

Crews now consume a dedicated CrewCard Business UI composition with explicit leader treatment, roster, metrics and contextual communication/actions. Existing leader/member roles and access rules are preserved.

Attendance now consumes ModuleHeader, Badge, Alert, KpiCard, StaticDataTable and canonical iconography. AttendanceCapture, supervised biometric enrollment and contingency flows retain the existing GPS/geofence, liveness, encryption/consent, supervisor approval and one-use authorization behavior. No biometric or location decision moved to the client beyond the existing capture UX.

StaticDataTable now supports optional server-rendered row metadata so ModuleHeader search/facets can filter SSR table rows without a client data-table boundary.

No database schema, attendance policy, biometric threshold, API, RBAC, privacy boundary or organization/Site scope changes were introduced.

**Next implementation phase: Phase 9 — Maintenance operation.**

## Fase 9 — Operación de mantenimiento

**Estado: implementada.**

Migrar:

- Mantenimiento;
- Órdenes de Trabajo;
- Actividades;
- Reacción donde los componentes compartidos apliquen.

Prioridad:

- estados;
- prioridad;
- timelines;
- progress;
- drawers/contextual detail;
- mobile field usability.

**Phase 9 completion checkpoint — 2026-09-24**

Phase 9 is implemented end-to-end for Maintenance, Work Orders, Activities and the shared operational surfaces in Reaction.

Maintenance now combines MaintenanceCard mobile records with V2 KPI and a server-rendered StaticDataTable, plus canonical feedback/state presentation.

Work Orders now use a shared operation status/priority grammar across directory cards, desktop tables and detail. The detail surface adds descriptive process StepProgress, activity completion ProgressBar, due-date risk, execution cards and an event Timeline without changing server-authoritative state transitions.

Reaction now consumes Search, Select, Button, Badge, EmptyState and the official Drawer for contextual company/Site/technician/activity detail. Live tracking sessions, Google Maps overlays, routes, telemetry state and snapshot filtering remain unchanged.

Provider/external Work Order directory queries now return the same already-authorized organization/Site/type metadata required by ModuleHeader facets; this fixes presentation metadata only and does not widen visibility.

No database schema, API contract, task/Work Order state machine, assignment rule, due-date authority, tracking-session behavior, RBAC or tenant/Site scope changes were introduced.

**Next implementation phase: Phase 10 — Reports, Settings and final audit.**

## Fase 10 — Reportes, Configuración y cierre

Migrar:

- Reportes;
- Configuración;
- Personalización compatible;
- superficies restantes.

Cierre técnico:

- auditoría de hexadecimales legacy;
- auditoría de componentes duplicados;
- accesibilidad;
- responsive;
- reduced motion;
- contraste;
- performance;
- consistencia de iconos;
- documentación final de `/ui-kit`.

## Criterio por fase

Cada fase debe cerrar con:

- build de producción;
- regresiones existentes;
- revisión de responsive;
- revisión de accesibilidad;
- dark/light/system cuando aplique;
- documentación;
- actualización del manual si cambia interacción;
- PR aislado y merge solo con CI verde.

## Qué NO hacer

- rediseñar todos los módulos a la vez;
- introducir un framework CSS nuevo sin ADR;
- agregar una librería de componentes que duplique el UI Kit;
- sustituir lógica server-authoritative por estado del cliente;
- modificar APIs solo para que un mock visual sea más sencillo;
- convertir todo en glassmorphism, gradientes o cards;
- usar colores funcionales como decoración.

## Siguiente fase

Después de completar Fase 1, el siguiente trabajo es **Fase 2 — Primitives e interacción base**.

Phase 1 baseline is documented in `docs/DESIGN_AUDIT_PHASE1.md`. Phase 2 must evaluate existing reusable components before promoting/replacing them with official UI Kit primitives.


## Phase 2 completion checkpoint — 2026-09-24

Phase 2 is implemented.

The UI Core component contract is now available from `components/ui-kit/index.ts`, its global token-only styles are in `app/ui-kit-core.css`, and `/ui-kit` provides interactive examples.

Existing high-value wrappers were absorbed instead of duplicated. No API/DB/RBAC/business-flow changes were introduced.

**Phase 3 completion checkpoint — 2026-09-24**

Phase 3 is implemented. The authenticated shell now consumes the V2 token layer through `app/shell-v2.css`, global navigation uses the canonical `UiIcon` SVG vocabulary, the contextual header includes every primary module (including Requisitions), account actions use UI Kit Avatar/iconography, and mobile drawer/field navigation preserves the existing role-aware behavior.

RBAC, routes, white-label action tokens, sidebar ordering/collapse persistence and light/dark/system theme behavior are unchanged.

**Phase 4 completion checkpoint — 2026-09-24**

Phase 4 is implemented. The official Shared Data UI layer now provides Search, FilterPanel/FilterGroup, DataTable, Pagination, row/bulk actions, KPI/metric layouts, token-based line charts, Timeline and Progress primitives.

`ModuleHeader` preserves its existing client-side narrowing of already server-authorized records while delegating its Search/filter presentation to the new layer. `DashboardAnalytics` preserves its public API while delegating KPI and chart rendering to Shared Data UI. The live authenticated `/ui-kit` documents the real Phase 4 components.

Dense module-specific tables/cards remain scheduled for their module migration phases so Phase 4 does not rewrite CRUD/business flows.

**Phase 5 completion checkpoint — 2026-09-24**

Phase 5 is implemented. The Business UI layer now provides a shared `BusinessCardShell` plus domain compositions for Asset, Inventory, Maintenance, Work Order, Supplier, Location and User cards. Existing directory surfaces consume these components while preserving their domain-specific information, actions, responsive behavior and `data-module-record` filtering contracts.

`EntityProfileWorkspace` also consumes the shared Business Profile stat pattern, consolidating profile-side metrics without replacing each domain's tabs or actions.

No API, DB, RBAC or business-flow changes were introduced.

**Phase 6 completion checkpoint — 2026-09-24**

Phase 6 is implemented end-to-end for Dashboard, Empresas and Ubicaciones.

Dashboard now consumes UI Core Card/Badge/Button/Select, Shared Data UI Progress and a new server-compatible `StaticDataTable`; the date-range/export controls use canonical SVG iconography and V2 controls while preserving URL-driven filters and export parity.

Empresas now consumes `CompanyCard`, Badge, StatTiles, Alert and the shared Entity Profile/Business UI grammar. Ubicaciones consumes `LocationCard`, `SubLocationCard`, Search/Select, Badge, StatTiles, Alert/EmptyState and token-driven directory/profile styling. Existing maps, geofences, contextual creation, exports, edit confirmations and authorized query scopes are unchanged.

`app/phase6-modules.css` is a token-only scoped migration layer for these three modules. No database/API/RBAC changes were introduced.

**Next implementation phase: Phase 7 — Assets + Inventory.**
