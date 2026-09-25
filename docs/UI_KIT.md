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
- Breadcrumb.

Estados: default, hover, active, disabled.

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

- logo;
- nombre;
- NIT;
- tipo;
- categoría;
- contacto;
- teléfono;
- correo;
- estado.

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
- `Tabs`, `Pills`, `SegmentedControl`, `Breadcrumb`, `ModuleNavigation`;
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

The live `/ui-kit` page now documents Foundations plus Buttons, Forms, Cards/Status, Navigation, Overlays and Feedback using the real components.

DataTable/Pagination/Search-Filter/KPI/Timeline/Progress remain Phase 4. ERP-specific Business UI remains Phase 5.


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
