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
