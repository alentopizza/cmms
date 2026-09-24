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

**Estado: implementada en código; validación CI requerida antes de merge.**

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

Orden:

1. Dashboard;
2. Empresas;
3. Ubicaciones.

Objetivo:

- probar el sistema en superficies analíticas, directorios y perfiles;
- resolver patrones reutilizables antes de módulos operativos densos.

## Fase 7 — Activos e Inventario

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

## Fase 8 — Proveedores + Personas

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

## Fase 9 — Operación de mantenimiento

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

## Phase 1 implementation checkpoint

Implemented:

- `app/design-system/tokens.css` as the runtime V2 token layer;
- semantic dark-theme mapping without overriding legacy variables;
- reduced-motion token behavior;
- UI Kit namespace under `components/ui`;
- `UiIcon` bridged as the provisional canonical icon system;
- `lib/design-system.ts` token-name manifest;
- live, responsive, no-index `/ui-kit` Foundations catalog;
- baseline audit in `docs/DESIGN_AUDIT_PHASE1.md`;
- `scripts/design-system-smoke.mjs` wired into CI.

Legacy `app/globals.css` is intentionally not mass-refactored in this phase.

## Siguiente fase

**Fase 2 — Primitives e interacción base.**

Start by implementing reusable Button/Input/Select/Card/Badge/Status/Modal/Drawer/Tabs/Breadcrumb/Feedback primitives on top of the Phase 1 tokens, then document real examples in `/ui-kit`. Existing shared components must be adapted/reused rather than duplicated.
