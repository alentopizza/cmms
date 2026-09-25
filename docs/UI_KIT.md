# DESWEB UI Kit V1

> Estado: **contrato oficial de componentes**.
>
> El UI Kit implementa el Design System V2 dentro del código real. No define una identidad distinta; materializa los tokens y patrones de `docs/DESIGN_SYSTEM.md`.

## 1. Principio

Una pantalla nueva debe construirse **ensamblando componentes existentes**, no diseñando cada vista desde cero.

Antes de crear un componente:

1. buscar equivalente en UI Kit;
2. reutilizarlo;
3. si falta una capacidad, extender una variante;
4. crear algo nuevo solo si existe una necesidad real y reusable.

No duplicar Button, Card, Input, Modal, Table, Badge, Tabs, Dropdown, Search, Filter, KPI u otros primitives por módulo.

## 2. Arquitectura prevista

Durante la implementación, los componentes se organizarán en capas:

```text
DESWEB Design System
        │
        ▼
DESWEB UI Kit
   ├─ UI Core
   │  ├─ Button / IconButton
   │  ├─ Form controls
   │  ├─ Card
   │  ├─ Badge / Status
   │  ├─ Modal / Drawer
   │  ├─ Tooltip / Dropdown
   │  ├─ Tabs / Breadcrumb
   │  ├─ Table / Pagination
   │  ├─ Search / Filter
   │  ├─ Toast / Alert
   │  └─ Loading / Empty
   └─ Business UI
      ├─ AssetCard
      ├─ InventoryCard
      ├─ MaintenanceCard
      ├─ WorkOrderCard
      ├─ SupplierCard
      └─ LocationCard
```

Los componentes Business UI se construyen con UI Core; no crean estilos paralelos.

## 3. Convenciones técnicas

- TypeScript + React.
- CSS basado en tokens semánticos.
- Sin hexadecimales en JSX/TSX salvo casos documentados de visualización de color.
- Props pequeñas, predecibles y orientadas a variante/estado.
- La autorización no vive en el componente visual; los componentes reciben únicamente acciones ya permitidas o aplican el mismo contrato existente.
- No trasladar lógica de negocio desde Server Components/API a primitives visuales.
- Mantener renderizado progresivo y evitar dependencias frontend pesadas sin decisión arquitectónica.

## 4. Button

Variantes:

- primary;
- secondary;
- tertiary;
- ghost;
- success;
- danger;
- icon;
- split.

Tamaños:

- sm;
- md;
- lg.

Capacidades:

- iconLeft;
- iconRight;
- loading;
- disabled;
- fullWidth.

Estados: default, hover, focus, active, disabled, loading.

Primary representa la acción principal de la superficie, no cada acción disponible.

## 5. Input system

Componentes:

- Input;
- SearchInput;
- NumberInput;
- CurrencyInput;
- PasswordInput;
- Textarea.

Contrato:

- label;
- required;
- helperText;
- errorMessage;
- successMessage;
- icon;
- placeholder;
- disabled;
- readOnly.

Estados: default, hover, focus, filled, disabled, error, success, readonly.

## 6. Select system

- Select;
- MultiSelect;
- SearchSelect;
- AsyncSelect.

Capacidades:

- search;
- clear;
- disabled;
- loading;
- multiple;
- keyboard navigation.

Usar el select nativo cuando sea suficiente y más accesible. Usar componente avanzado cuando la tarea realmente necesite búsqueda, múltiples valores o carga asíncrona.

## 7. Search y filtros

### Search

- icono;
- placeholder;
- clear;
- loading;
- shortcut opcional.

### FilterButton / FilterPanel

Debe poder representar:

- estado;
- categoría;
- ubicación;
- empresa;
- fecha;
- responsable;
- prioridad.

El mismo sistema se reutiliza en Activos, Inventario, Mantenimiento, OT, Proveedores, Usuarios y Reportes.

Los filtros nunca reemplazan el scope server-side ya autorizado.

## 8. Card system

- BasicCard;
- InteractiveCard;
- SelectedCard;
- StatusCard;
- MetricCard;
- ProfileCard;
- DataCard.

Estructura opcional:

- header;
- content;
- footer;
- icon;
- status;
- actions;
- image;
- metadata.

No aplicar hover a cards que no sean interactivas.

## 9. KPI Card

Props conceptuales:

- title;
- value;
- description;
- icon;
- trend;
- trendPercentage;
- status;
- comparison.

El KPI base debe ser neutral y usar color de forma funcional.

## 10. Badge y StatusIndicator

### Badge

Variantes:

- success;
- warning;
- danger;
- info;
- neutral;
- brand.

Estados ERP normalizados:

- Operativo;
- Pendiente;
- En ejecución;
- Completado;
- Cancelado;
- Fuera de servicio;
- En garantía;
- Sin stock;
- Stock bajo;
- Vencido;
- En revisión.

### StatusIndicator

Soporta icono/dot + label. El color nunca es el único medio para entender el estado.

## 11. DataTable

Capacidades objetivo:

- sorting;
- filtering;
- pagination;
- search;
- selection;
- bulk actions;
- column visibility;
- responsive;
- empty;
- loading;
- error.

Las acciones secundarias de fila se agrupan en menú contextual.

Acciones estándar:

- View;
- Edit;
- Duplicate;
- Archive;
- Delete;
- More.

No llenar cada fila con demasiados botones.

## 12. Modal y Drawer

### Modal

Tamaños:

- sm;
- md;
- lg;
- confirmation;
- form.

Estructura:

- header;
- title;
- description;
- content;
- footer;
- secondary action;
- primary action.

Debe soportar teclado, Escape, focus management y cierre accesible.

### Drawer

Usos:

- detalle contextual;
- edición;
- filtros;
- historial;
- información auxiliar.

No reemplaza el patrón de perfil en página cuando ese patrón ya es contractual para una entidad.

## 13. Tabs y navegación secundaria

- Tabs;
- Pills;
- SegmentedControl;
- ModuleNavigation;
- Breadcrumb;
- Stepper.

Estados: default, hover, active, completed, pending, disabled cuando aplique.

### Stepper

`Stepper` representa procesos configurables de varios pasos dentro de una misma experiencia. Cada paso recibe `id`, label, descripción, estado completado y un destino opcional.

Reglas:

- el paso activo usa `aria-current="step"`;
- completado comunica check + texto, nunca solo color;
- pendiente conserva numeración y estilo neutro;
- puede usar links para permitir navegación no rígida y preservar back/forward;
- en mobile mantiene scroll horizontal propio sin provocar overflow de toda la página;
- no contiene lógica de negocio ni decide si un paso puede considerarse completo;
- el progreso lateral o resumen debe consumir el mismo estado, no mantener una segunda fuente de navegación.

### ModuleNavigation

Inventario:
Resumen, Productos, Categorías, Almacenes, Entradas, Salidas, Ajustes, Transferencias, Kardex, Reportes, Configuración.

Activos:
Lista de Activos, Tipos de Activos, Categorías, Marcas, Modelos, Estados, Mantenimientos, Historial, Documentos, Configuración.

### Breadcrumb

Mínimo:

`Inicio > Módulo > Registro`

Debe ser navegable y accesible.

## 14. Feedback

### EmptyState

Debe explicar:

- qué falta;
- por qué importa;
- cuál es la acción siguiente.

Evitar "No hay datos" como único contenido.

### Loading

- Spinner;
- Skeleton;
- LoadingCard;
- LoadingTable;
- LoadingPage.

Preferir Skeleton para estructuras conocidas.

### Toast

- success;
- error;
- warning;
- info.

Mensajes breves y accionables.

### Alert

- info;
- success;
- warning;
- danger.

Para información persistente.

### Tooltip

Solo para acciones poco conocidas o información adicional; nunca para información esencial.

## 15. Avatar

Tamaños:

- xs;
- sm;
- md;
- lg;
- xl.

Soporta:

- imagen;
- iniciales;
- fallback;
- status.

## 16. File Upload

Debe cubrir:

- dropzone;
- selección tradicional;
- nombre/tamaño/tipo;
- progreso cuando exista transferencia progresiva;
- error;
- success;
- reemplazo;
- quitar archivo.

Debe reutilizar las validaciones servidor existentes.

## 17. Business UI

### AssetCard

- imagen;
- SKU;
- nombre;
- categoría;
- estado;
- ubicación;
- código interno;
- último mantenimiento;
- acciones.

### InventoryCard

- imagen;
- SKU;
- producto;
- stock;
- unidad;
- stock mínimo;
- estado;
- ubicación.

Estados: Disponible, Stock bajo, Sin stock.

### MaintenanceCard

- fecha/hora;
- activo;
- ubicación;
- tipo;
- responsable;
- estado.

Estados: Programado, En ejecución, Completado, Cancelado, Vencido.

### WorkOrderCard

- número OT;
- activo;
- prioridad;
- técnico;
- fecha;
- estado.

Prioridades: Baja, Media, Alta, Crítica.

### SupplierCard

La tarjeta canónica de Proveedor conserva la lógica del directorio y organiza únicamente datos reales disponibles:

- estado real Activo/Inactivo;
- tipo/capacidades del proveedor;
- logo real o iniciales como fallback;
- nombre y razón social/contexto empresarial;
- ubicación cuando existe;
- especialidad/categoría cuando existe;
- contacto, teléfono y correo cuando existen;
- métricas reales de Actividades, Suministros y Requisiciones;
- acción primaria **Ver ficha**;
- acciones existentes de Editar, Crear requisición cuando aplica, WhatsApp cuando existe teléfono y Eliminar.

Los campos opcionales ausentes se omiten: Business UI no inventa placeholders para completar la composición. La tarjeta usa `UiIcon`, `Badge`, tokens semánticos, tooltips y adaptación responsive.

Debe respetar el patrón comercial existente y no convertirse en una copia de UserCard.

### LocationCard

- nombre;
- empresa;
- ciudad;
- tipo;
- responsable;
- activos;
- técnicos;
- estado.

## 18. Timeline y Progress

### ActivityTimeline

Usos:

- historial de activos;
- mantenimientos;
- órdenes;
- cambios;
- auditoría.

### Progress

- ProgressBar;
- CircularProgress;
- StepProgress.

Usos: OT, mantenimiento, importaciones, procesos, objetivos.

## 19. Iconografía

Un único sistema de iconos:

- outline;
- rounded;
- dimensiones consistentes;
- no mezclar familias visuales arbitrariamente.

Antes de introducir una librería externa, revisar el sistema `UiIcon` existente y decidir si se extiende o reemplaza en una fase explícita.

## 20. Responsive

Todos los componentes deben tener comportamiento definido en Desktop, Tablet y Mobile.

El componente puede cambiar de composición; no debe limitarse a reducir escala.

## 21. Accesibilidad

Cada componente interactivo debe cubrir:

- navegación de teclado;
- focus visible;
- labels/nombres accesibles;
- ARIA cuando aplique;
- contraste;
- disabled real;
- no depender solo del color.

## 22. Documentación por componente

Cada componente oficial deberá documentar:

- nombre;
- propósito;
- variantes;
- props;
- estados;
- ejemplos;
- uso correcto;
- uso incorrecto.

Esta documentación se materializará también en `/ui-kit`.

## 23. /ui-kit

Ruta objetivo: `/ui-kit`.

Es el catálogo oficial visual del sistema y debe organizarse como mínimo en:

- Foundations;
- Buttons;
- Forms;
- Cards;
- Tables;
- Navigation;
- Feedback;
- ERP Components.

La página es documentación viva: debe consumir los componentes reales, no imitaciones HTML independientes.

El acceso exacto/rol se definirá al implementarla, manteniendo seguridad y evitando exponer información privada.

## 24. No-regression

Migrar a UI Kit no autoriza cambios silenciosos a:

- APIs;
- DB;
- auth;
- RBAC;
- CRUD;
- cálculos;
- procesos;
- integraciones;
- reglas de negocio.

Los conflictos se documentan y se separan del PR visual cuando sea posible.

## 25. Definition of Done

Un componente entra al UI Kit cuando:

- usa Design Tokens V2;
- tiene estados requeridos;
- es responsive;
- es accesible;
- tiene ejemplos/documentación;
- reemplaza o absorbe equivalentes duplicados sin romper sus flujos;
- pasa build y pruebas aplicables;
- está listo para ser reutilizado por al menos dos superficies o representa un patrón empresarial oficial.


## 26. Phase 1 implementation status

Implemented foundation:

- `components/ui-kit/` namespace created;
- `FoundationPreview` consumes real runtime tokens;
- `lib/design-system.ts` provides typed foundation metadata;
- authenticated `/ui-kit` route created;
- current playground sections: Color, Typography, Spacing, Radius/Shadows and Motion;
- `UiIcon` retained as the initial unified icon system;
- Design System foundation contract checked in CI.

Not yet promoted to official primitives:

- Button;
- form controls;
- Card;
- Badge/Status;
- Modal/Drawer;
- DataTable;
- Toast/Alert;
- Search/Filter.

Those belong to Phase 2 and must evaluate/absorb existing components before new parallel implementations are created.


## 27. Phase 2 implementation status

**Status: implemented.**

Official UI Core runtime now lives in `components/ui-kit/` and is styled by `app/ui-kit-core.css`.

Implemented primitives:

- `Button`, `IconButton`, `SplitButton`;
- `Input`, `SearchInput`, `NumberInput`, `CurrencyInput`, `PasswordInput`, `Textarea`;
- native `Select`, `MultiSelect`, `SearchSelect`, `AsyncSelect`;
- `Checkbox`, `Radio`, `Switch`;
- `Badge`, `StatusIndicator`;
- `Card` variants: basic, elevated, interactive, selected, warning, error;
- `Modal`, `Drawer`;
- `Tooltip`, `Dropdown`;
- `Tabs`, `Pills`, `SegmentedControl`, `Breadcrumb`, `ModuleNavigation`, `Stepper`;
- `Alert`, `Toast`, `EmptyState`;
- `Spinner`, `Skeleton`, `LoadingCard`, `LoadingTable`, `LoadingPage`;
- `Avatar`;
- `FileUpload`.

Accessibility/interaction baseline:

- visible `:focus-visible`;
- native disabled semantics;
- loading state with `aria-busy` where applicable;
- Modal/Drawer Escape close, focus trap and previous-focus restoration;
- keyboard-accessible native/input/button structures for custom selects;
- status meaning through text/icon + color;
- reduced-motion support.

Theme behavior:

- UI Core consumes semantic Design Tokens only;
- no hardcoded hex colors are permitted in UI Core TSX/CSS;
- adaptive status surface/border/text tokens support light/dark mode.

Legacy compatibility wrappers now delegate to UI Kit without changing their public props:

- `ConfirmDialog` → `Modal` + `Button`;
- `CreateRecordModal` → `Modal` + `Button`, retaining temporary legacy layout classes;
- `MultiSelectDropdown` → `MultiSelect`;
- `FileDropzone` → `FileUpload`.

The live `/ui-kit` page now documents Foundations plus Buttons, Forms, Cards/Status, Navigation (including Stepper), Overlays and Feedback using the real components.

DataTable/Pagination/Search-Filter/KPI/Timeline/Progress are implemented in Phase 4. ERP-specific Business UI is implemented in Phase 5.


## 28. Phase 3 shell/navigation implementation status

**Status: implemented.**

The authenticated application shell now uses the V2 token layer through `app/shell-v2.css`. Phase 3 intentionally scopes styling under `.desweb-shell-v2` so legacy module interiors can continue their progressive migration without a global rewrite.

Implemented shell contracts:

- sidebar uses canonical `UiIcon` SVG icons instead of module Unicode glyphs;
- contextual header, Help, Settings and account actions use the same icon vocabulary;
- account identity consumes the official UI Kit `Avatar`;
- Requisitions has explicit contextual-header metadata;
- desktop collapse and user-defined module ordering remain persisted exactly as before;
- role-aware mobile drawer and Technician/External bottom navigation remain intact;
- Organization white-label continues through semantic action tokens;
- visible keyboard focus and reduced-motion behavior are part of the shell stylesheet;
- `ModuleNavigation` now exposes `aria-current` and supports nested-route active state;
- CI runs `scripts/shell-v2-smoke.mjs`.

Phase 4 owns Search/Filter/DataTable/KPI/timeline/progress standardization. Phase 3 does not migrate internal module content.


## 29. Phase 4 Shared Data UI implementation status

**Status: implemented.**

Canonical runtime:

- `components/ui-kit/DataControls.tsx` — Search, FilterPanel, FilterGroup;
- `components/ui-kit/DataTable.tsx` — sortable DataTable, row actions, bulk selection/actions and Pagination;
- `components/ui-kit/Metrics.tsx` — KpiCard, MetricGrid and StatTiles;
- `components/ui-kit/Charts.tsx` — LineChart using only `--chart-1` through `--chart-10`;
- `components/ui-kit/TimelineProgress.tsx` — Timeline, ProgressBar, CircularProgress and StepProgress;
- `app/data-ui.css` — token-only Phase 4 styles;
- `components/ui-kit/DataPatternsPreview.tsx` — live authenticated examples in `/ui-kit`.

Compatibility migrations:

- `ModuleHeader` keeps the existing `data-module-record` filtering contract but delegates Search/filter controls to Shared Data UI.
- `DashboardAnalytics` keeps its current exported API while delegating KPI and trend rendering to `KpiCard`, `MetricGrid`, `StatTiles` and `LineChart`.

Data authorization rule:

Search, filters, sorting, pagination and selection are presentation/data-navigation tools. They never grant scope. Server queries/RBAC remain authoritative and must constrain the dataset before these components receive it.

Dense Work Order, Maintenance, Inventory and other module-specific table/card migrations remain in their scheduled module phases. Phase 4 establishes the reusable contract rather than changing their business flows.


## 30. Phase 5 Business UI implementation status

**Status: implemented.**

Canonical runtime:

- `components/business-ui/BusinessCards.tsx` — BusinessCardShell, AssetCard, InventoryCard, MaintenanceCard, WorkOrderCard, SupplierCard, LocationCard, UserCard and BusinessProfileStat;
- `components/business-ui/index.ts` — official Business UI exports;
- `app/business-ui.css` — token-only shared Business UI presentation;
- `components/business-ui/BusinessCardsPreview.tsx` — live authenticated examples in `/ui-kit`.

Migration coverage:

- Assets directory cards use `AssetCard`;
- Inventory product cards use `InventoryCard`;
- Maintenance responsive cards use `MaintenanceCard`;
- Work Order responsive cards use `WorkOrderCard`;
- Supplier directory cards use `SupplierCard`;
- Site/Location directory cards use `LocationCard`;
- User directory cards consume `UserCard` as their shared outer shell;
- `EntityProfileWorkspace` consumes `BusinessProfileStat` while retaining domain-specific tabs, quick actions and profile identity.

Business UI intentionally shares layout grammar, spacing, states, focus and semantic tokens without forcing identical content. Supplier, User, Asset, Inventory and Location retain distinct information hierarchy and actions.

The legacy desktop tables in Maintenance/Work Orders remain in place for the planned module-specific migrations. Business UI does not move CRUD/RBAC/business logic into visual components.


## 31. Phase 6 first complete module block

**Status: implemented.**

The first end-to-end V2 module block covers Dashboard, Empresas and Ubicaciones.

New reusable contract:
- `StaticDataTable` provides the same Shared Data UI table grammar for Server Components/SSR datasets without client-side column callbacks.
- `CompanyCard` extends Business UI for the organization directory.
- `SubLocationCard` extends Business UI for nested physical-space directories.
- `CreationPrerequisiteState` renders canonical `UiIcon` SVGs even for legacy callers.

Dashboard:
- Card, Badge, Button and Select from UI Core;
- ProgressBar and StaticDataTable from Shared Data UI;
- existing role-aware KPI/LineChart/StatTiles wrappers;
- token-driven date-range and export controls;
- URL/query-driven period, comparison, Site, priority and status logic unchanged.

Empresas:
- CompanyCard directory;
- Badge/StatTiles/Alert/EmptyState;
- EntityProfileWorkspace preserved for tabs, edit flow, map/geofence, documents and exports;
- company resource links and profile completion remain contextual.

Ubicaciones:
- LocationCard + SubLocationCard;
- Search/Select inside profile subdirectories;
- Badge/StatTiles/Alert/EmptyState;
- technician/service/profile/geofence workflows preserved.

`app/phase6-modules.css` is intentionally scoped to `.phase6-dashboard`, `.phase6-company-directory` and `.phase6-location-directory`. It uses Design Tokens only and does not globally rewrite later-phase modules.


## 32. Phase 7 — Assets + Inventory

**Status: implemented.**

Assets:
- official secondary navigation covers List, Types, Categories, Brands, Models, States, Maintenance, History, Documents and Configuration;
- Types intentionally map to root Asset Categories because no separate `asset_types` master table exists;
- Brands and Models are derived from the existing manufacturer/model fields;
- Maintenance, History and Documents are rendered from the established maintenance_plans, work_orders and attachments relationships;
- list/detail/catalog surfaces consume AssetCard, KpiCard, MetricGrid, Badge, Alert, EmptyState and StaticDataTable.

Inventory:
- official secondary navigation covers Summary, Products, Categories, Warehouses, Entries, Issues, Adjustments, Transfers, Kardex, Reports and Configuration;
- stock summary/detail/category/warehouse/Kardex surfaces consume V2 KPI, Badge, Alert, EmptyState, StatTiles and Shared Data UI table grammar;
- Report and Configuration sections summarize the same live inventory, warehouse, Supplier and Kardex sources rather than introducing parallel persistence;
- BulkImportModal preserves validation-before-commit, duplicate policy, contextual Supplier scope, batch history and audit behavior while consuming canonical Alert/Badge/icon patterns.

`CreateRecordModal` now exposes an optional `iconName` bridge so migrated flows use `UiIcon` without breaking legacy callers.

`ModuleNavigation` distinguishes query/hash destinations exactly, which is required for official secondary navigation where multiple sections share a pathname.

`app/phase7-modules.css` is token-only and scoped to Assets/Inventory/Bulk Import surfaces.


## 33. Phase 8 — Suppliers + People + Attendance

**Status: implemented.**

Suppliers:
- keep the SupplierCard commercial identity and Supplier Entity Profile;
- Badge/Alert/EmptyState/StatTiles now cover profile state, feedback and summary metrics;
- commercial requisition evidence uses the Shared Data UI table grammar;
- Inventory, Requisition, Procurement, Supplier Return, documents and financial relationships are unchanged.

Users:
- keep the separate UserCard/access-profile identity;
- directory/profile states and feedback use V2 primitives;
- statistics fallback uses StatTiles and operational analytics use KpiCard, ProgressBar, Badge and EmptyState;
- personnel documents, emergency contact, access scope, Supplier relationship and profile exports remain unchanged.

Crews:
- `CrewCard` is the official Business UI composition and uses the approved compact directory treatment: no large hero photo, compact leader identity, optional real description, three real operational metrics, compact member avatars and quick contact actions;
- `CrewDirectory` may switch between grid and StaticDataTable list presentation over the same authorized collection; it must not introduce a second query/service layer;
- approved density is 3 columns desktop, 2 tablet and 1 mobile;
- only existing Crew states/data may be shown. Current schema supports active/inactive but not paused status or discipline, so those mockup concepts must not be fabricated;
- Crew creation still enforces same-company/Site access eligibility and leader membership.

Attendance:
- page orchestration uses ModuleHeader, KpiCard, Badge, Alert, EmptyState and StaticDataTable;
- capture, supervised enrollment and contingency clients use canonical Button/Badge/Alert/icon primitives;
- geofence, GPS precision, liveness, consent, encryption and supervised identity rules are unchanged.

`StaticDataTable` now accepts optional `recordProps` on rows. This enables ModuleHeader search/facet metadata on SSR rows without converting authoritative server data into a client table.

`app/phase8-modules.css` is token-only and scoped to Suppliers, Users, Crews and Attendance.


## 34. Phase 9 — Maintenance operation

**Status: implemented.**

Shared operation grammar:
- `components/maintenance-ui/OperationStatus.tsx` is the canonical label/tone layer for Work Order state, Activity state and Priority;
- `WorkOrderCard` consumes the same PriorityBadge/WorkOrderStatusBadge as directory/detail surfaces;
- Maintenance and Work Order desktop directories use StaticDataTable while their mobile Business UI cards remain available for field layouts.

Work Order detail:
- KpiCard/MetricGrid for activity/risk summary;
- StepProgress for descriptive OT process state;
- ProgressBar for completed Activity ratio;
- Timeline for request/start/completion events;
- ActivityStatusBadge and due-date risk Badge on execution cards;
- EmptyState/Alert/Button for field interaction feedback.

Reaction:
- Search/Select/Button replace private filter controls where shared primitives apply;
- operational alerts use the shared Activity/Priority badge grammar;
- contextual detail now uses the official Drawer with focus management/Escape behavior;
- company/Site/technician/activity facts and communication actions retain their existing semantics;
- Google Maps, technician routes, live/paused telemetry and snapshot logic are unchanged.

Phase 9 styles live in `app/phase9-modules.css` and are scoped to Maintenance, Work Orders, Work Order Detail and Reaction.


## 35. Phase 10 — Reports, Settings and final V2 closure

**Status: implemented.**

Reports:
- `/dashboard/reports` is the central entry point for reporting/export workflows;
- it reuses the role-scoped Dashboard export endpoint and the official Asset/Inventory/Kardex export endpoints;
- it does not create a parallel reporting data model;
- profile and Requisition documents remain contextual to their authoritative record pages.

Settings and Personalization:
- feedback uses Alert;
- global/company state uses Badge;
- entitlement consumption uses ProgressBar;
- actions use Button/UiIcon;
- theme choices use canonical `sun`, `moon`, `system` icons;
- global branding, white-label branding, Locale/Country defaults, procurement policy and theme persistence are unchanged.

Final audit:
- all V2-owned CSS outside `design-tokens.css` must contain zero raw hexadecimal colors;
- the `globals.css` legacy baseline is frozen and may only decrease;
- no second UI framework may be introduced;
- Phase 10 retains focus-visible, responsive and reduced-motion contracts;
- final details are recorded in `docs/DESIGN_AUDIT_FINAL.md`.
