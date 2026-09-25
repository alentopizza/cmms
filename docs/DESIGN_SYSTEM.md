# DESWEB Design System V2

> Estado: **canónico / aprobado como objetivo de migración** desde 2026-09-24.
>
> Este documento reemplaza la antigua paleta visual del CMMS como referencia para todo trabajo nuevo. El código existente todavía contiene estilos y tokens heredados; deben migrarse progresivamente según `docs/DESIGN_MIGRATION_PLAN.md`, nunca mediante reemplazos ciegos.

## 1. Propósito

DESWEB CMMS debe sentirse como un único producto empresarial: profesional, tecnológico, moderno, confiable, ordenado, escalable y premium.

El Design System controla de forma centralizada:

- color;
- tipografía;
- espaciado;
- radios;
- bordes;
- sombras;
- motion;
- estados;
- navegación;
- formularios;
- tablas;
- cards;
- badges;
- KPI;
- feedback;
- responsive;
- accesibilidad;
- jerarquía visual.

Los módulos no pueden inventar estilos, colores o patrones aislados cuando existe una solución dentro de este sistema.

## 2. Regla fundamental

1. No introducir colores arbitrarios.
2. No usar hexadecimales dispersos dentro de componentes.
3. Antes de crear una variante, comprobar si un token existente resuelve la necesidad.
4. Si hace falta un nuevo token, agregarlo aquí, documentar su propósito y reutilizarlo.
5. No realizar reemplazos masivos sin revisar el significado del estilo original.

## 3. ADN visual DESWEB

Los tres colores de marca son inmutables:

| Rol | Token | Valor |
| --- | --- | --- |
| Primary | `--color-brand-primary` | `#72F1DC` |
| Secondary | `--color-brand-secondary` | `#2C8780` |
| Dark | `--color-brand-dark` | `#1D1D2C` |

Proporción recomendada de color:

- 70% neutros;
- 20% colores estructurales;
- 10% acción/acento.

El color comunica; no se usa como decoración gratuita.

## 4. Escalas de color

### Primary

```css
--color-primary-50:  #F0FFFC;
--color-primary-100: #D9FFF8;
--color-primary-200: #B8FFF1;
--color-primary-300: #91F8E7;
--color-primary-400: #72F1DC;
--color-primary-500: #55D8C5;
--color-primary-600: #35B9A9;
--color-primary-700: #2C8780;
--color-primary-800: #236D68;
--color-primary-900: #194F4C;
```

### Teal

```css
--color-teal-50:  #EFFBFA;
--color-teal-100: #D8F3F1;
--color-teal-200: #B6E5E1;
--color-teal-300: #8DD4CF;
--color-teal-400: #5DB5AE;
--color-teal-500: #2C8780;
--color-teal-600: #26746E;
--color-teal-700: #205E5A;
--color-teal-800: #194A47;
--color-teal-900: #123735;
```

### Navy

```css
--color-navy-50:  #F5F5F8;
--color-navy-100: #E9E9EF;
--color-navy-200: #D5D5E0;
--color-navy-300: #B7B7C8;
--color-navy-400: #8F90A7;
--color-navy-500: #686A83;
--color-navy-600: #4B4C63;
--color-navy-700: #353649;
--color-navy-800: #272838;
--color-navy-900: #1D1D2C;
--color-navy-950: #11111C;
```

## 5. Semánticos

Escalas aprobadas:

```css
--color-success-50:  #ECFDF5;
--color-success-100: #D1FAE5;
--color-success-300: #6EE7B7;
--color-success-500: #10B981;
--color-success-600: #059669;
--color-success-700: #047857;
--color-success-900: #064E3B;

--color-warning-50:  #FFFBEB;
--color-warning-100: #FEF3C7;
--color-warning-300: #FCD34D;
--color-warning-500: #F59E0B;
--color-warning-600: #D97706;
--color-warning-700: #B45309;
--color-warning-900: #78350F;

--color-danger-50:  #FEF2F2;
--color-danger-100: #FEE2E2;
--color-danger-300: #FCA5A5;
--color-danger-500: #EF4444;
--color-danger-600: #DC2626;
--color-danger-700: #B91C1C;
--color-danger-900: #7F1D1D;

--color-info-50:  #EFF6FF;
--color-info-100: #DBEAFE;
--color-info-300: #93C5FD;
--color-info-500: #3B82F6;
--color-info-600: #2563EB;
--color-info-700: #1D4ED8;
--color-info-900: #1E3A8A;
```

### Superficies y texto

```css
--color-bg: #F4F8F9;
--color-surface: #FFFFFF;
--color-surface-soft: #F8FBFC;
--color-surface-teal: #F1FAF9;
--color-surface-blue: #F1F7FC;
--color-surface-dark: #1D1D2C;

--color-text-primary: #1D1D2C;
--color-text-secondary: #4B4C63;
--color-text-muted: #686A83;
--color-text-disabled: #8F90A7;
--color-text-inverse: #FFFFFF;

--color-border-subtle: #E2EAEC;
--color-border-default: #D5E1E3;
--color-border-strong: #B8CCCF;
--color-border-active: #2C8780;
```

### Success

Base: `#10B981`.

Uso: Operativo, Completado, Aprobado, Disponible, Pagado, Recibido, Activo, Correcto.

### Warning

Base: `#F59E0B`.

Uso: Stock bajo, Pendiente, En revisión, Próximo mantenimiento, Por aprobar, Vencimiento próximo, En gestión.

### Danger

Base: `#EF4444`.

Uso: Sin stock, Fuera de servicio, Error, Rechazado, Vencido, Eliminación, Incidencia crítica.

### Info

Base: `#3B82F6`.

Uso: Información, Ayuda, Nuevo registro, Importación, Sincronización, Actualizaciones.

Los estados siempre usan icono/texto además de color.

## 6. Colores funcionales por área

| Área | Color | Uso |
| --- | --- | --- |
| Analytics | `#8B5CF6` | Reportes, analytics, dashboards avanzados, automatización, IA, auditoría |
| Compras / logística | `#F97316` | Compras, OC, logística, transporte, recepción, devoluciones |
| Tecnología | `#06B6D4` | Integraciones, API, IoT, automatización |
| Personas / comunicación | `#EC4899` | Usuarios, comunicación, cultura, experiencia |

Estos colores complementan la marca; no sustituyen Primary/Secondary/Dark.

## 7. Paleta de gráficos

Orden fijo:

1. `#2C8780`
2. `#72F1DC`
3. `#3B82F6`
4. `#8B5CF6`
5. `#F59E0B`
6. `#10B981`
7. `#F97316`
8. `#EC4899`
9. `#06B6D4`
10. `#64748B`

No elegir colores aleatorios por gráfico.

## 8. Gradientes

Solo para elementos destacados:

```css
--gradient-primary: linear-gradient(135deg,#72F1DC 0%,#2C8780 100%);
--gradient-teal: linear-gradient(135deg,#2C8780 0%,#194F4C 100%);
--gradient-navy: linear-gradient(135deg,#353649 0%,#1D1D2C 100%);
--gradient-ocean: linear-gradient(135deg,#72F1DC 0%,#3B82F6 100%);
--gradient-analytics: linear-gradient(135deg,#8B5CF6 0%,#3B82F6 100%);
```

No aplicar gradientes indiscriminadamente.

## 9. Tipografía

Familia base: **Inter**, con fallback del sistema.

Jerarquía oficial:

| Estilo | Referencia |
| --- | --- |
| Display | uso excepcional |
| H1 | 32 / Bold |
| H2 | 24 / Semibold |
| H3 | 20 / Semibold |
| H4 | 18 / Semibold |
| Body Large | 16 / Medium |
| Body | 14 / Regular |
| Body Small | 12 / Regular |
| Caption | 12 / Medium |
| Label | 12 / Semibold |

Títulos: `--color-text-primary`.  
Texto secundario: `--color-text-secondary`.  
Texto terciario/metadatos: `--color-text-muted`.

No usar texto esencial con contraste demasiado bajo ni reducir tipografía para ganar densidad artificial.

## 10. Spacing

Escala permitida:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`.

Tokens sugeridos:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

Evitar valores arbitrarios como 13, 17, 23 o 27 px salvo justificación técnica documentada.

## 11. Radius

```css
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 12px;
--radius-2xl: 16px;
--radius-3xl: 20px;
```

Guía:

- controles: 8–12px;
- cards: 12–16px;
- contenedores destacados: hasta 20px.

No convertir toda la interfaz en píldoras/círculos.

## 12. Sombras

Crear únicamente:

- `--shadow-xs`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`

Aplicarlas principalmente en dropdowns, modales, popovers y cards elevadas. La interfaz debe sentirse ligera.

## 13. Motion

Duraciones:

```css
--motion-fast: 120ms;
--motion-normal: 180ms;
--motion-medium: 240ms;
--motion-slow: 320ms;
```

Motion sirve para hover, dropdown, modal, drawer, tooltip y tabs. No usar animaciones decorativas innecesarias. Respetar `prefers-reduced-motion`.

## 14. Estados de interacción

Todo componente interactivo debe contemplar cuando aplique:

- default;
- hover;
- focus;
- active;
- selected;
- disabled;
- loading;
- error;
- success.

Focus debe ser visible; no retirar outlines sin reemplazo accesible.

## 15. Componentes principales

El catálogo funcional vive en `docs/UI_KIT.md`.

Ningún módulo debe crear versiones privadas de Button, Input, Card, Badge, Modal, Table, Tabs, Search, Filter o KPI si el UI Kit ya resuelve el caso.

## 16. Navegación

### Sidebar

- fondo: `#1D1D2C`;
- texto: `#E9E9EF`;
- secundario: `#8F90A7`;
- hover: `#272838`;
- activo: `#2C8780`;
- indicador activo: `#72F1DC`.

El módulo activo debe identificarse de inmediato.

### Navegación secundaria

Los módulos complejos usan `ModuleNavigation` debajo del encabezado.

Inventario:

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

Activos:

- Lista de Activos
- Tipos de Activos
- Categorías
- Marcas
- Modelos
- Estados
- Mantenimientos
- Historial
- Documentos
- Configuración

No crear estilos independientes de navegación por módulo.

## 17. Cards, KPI y tablas

### Cards

- fondo blanco;
- borde `--color-border-subtle`;
- sombra muy sutil;
- hover solo si son interactivas;
- jerarquía: Basic, Elevated, Interactive, Selected, Warning, Error.

### KPI

Estructura: icono, título, valor, descripción, tendencia y estado cuando existan.

La mayoría de KPI permanecen blancos; el color se concentra en icono/indicador/estado.

### Tablas

- header: `#F8FBFC`;
- body: `#FFFFFF`;
- border: `#E2EAEC`;
- hover: `#F1FAF9`;
- selected: `#E8F2F5`;
- texto principal: `#1D1D2C`;
- secundario: `#686A83`.

Alta densidad no significa saturación visual.

## 18. Formularios

Inputs:

- fondo `#FFFFFF`;
- borde `#D5E1E3`;
- hover `#B8CCCF`;
- focus `#2C8780`;
- focus ring `#72F1DC`;
- error `#EF4444`;
- success `#10B981`;
- disabled `#F4F8F9`.

Cada control debe integrar Label, Helper, Error, Success y Disabled cuando aplique.

## 19. Responsive

Todo componente debe funcionar en Desktop, Laptop, Tablet y Mobile.

En móvil:

- sidebar → navegación compacta/drawer;
- tablas → responsive o cards según la tarea;
- grids → 3→2→1 columnas;
- KPI → disposición vertical;
- navegación secundaria → scroll horizontal cuando sea apropiado;
- acciones principales permanecen accesibles.

Responsive no significa únicamente reducir tamaños.

## 20. Accesibilidad

Obligatorio:

- navegación por teclado;
- focus visible;
- ARIA cuando corresponda;
- contraste suficiente;
- estados comunicados por texto/icono + color;
- tooltips solo para información complementaria;
- acción icon-only con nombre accesible.

## 21. Jerarquía ERP

El usuario debe distinguir rápidamente:

- Información;
- Acción;
- Estado;
- Alerta;
- Error;
- Navegación.

Prioridad de diseño:

1. jerarquía;
2. claridad;
3. velocidad de lectura;
4. consistencia;
5. densidad controlada;
6. acciones frecuentes;
7. estados operativos.

## 22. Temas y branding configurable

El nuevo sistema se implementará sobre la arquitectura de temas ya existente. La dirección visual V2 define el lenguaje canónico; el modo oscuro seguirá usando tokens semánticos, no copias completas de cada componente.

Los logos/favicons continúan viniendo del sistema de Personalización. El Design System no debe hardcodear una identidad alternativa en módulos individuales.

## 23. Regla de no regresión

La migración visual no debe cambiar silenciosamente:

- APIs;
- base de datos;
- autenticación;
- permisos;
- CRUD;
- cálculos;
- integraciones;
- reglas de negocio.

Si un conflicto funcional aparece durante una fase visual:

1. documentarlo;
2. separar el problema del cambio visual;
3. resolverlo únicamente con decisión explícita.

## 24. Calidad de salida

Antes de considerar migrado un componente/módulo:

- usa tokens;
- no contiene colores arbitrarios;
- cubre hover/focus/disabled/loading/error/success según corresponda;
- es responsive;
- es accesible;
- mantiene jerarquía;
- reutiliza UI Kit;
- no duplica componentes;
- preserva lógica;
- respeta identidad DESWEB;
- se ve coherente con el resto del ERP.

## 25. Estado de migración

La aplicación actual contiene estilos heredados, incluyendo la paleta previa `#293644/#38B2A9/#79CAC4/#BAE3E0` y numerosos valores específicos por componente.

A partir de este checkpoint:

- esos valores se consideran **legacy implementation**, no tokens autorizados para nuevo desarrollo;
- no deben eliminarse de golpe;
- cada fase migra componentes de forma controlada;
- las reglas antiguas que describen patrones funcionales válidos siguen vigentes mientras no contradigan este documento;
- cuando exista contradicción visual, **DESWEB Design System V2 prevalece**.

Ver: `docs/DESIGN_MIGRATION_PLAN.md`.


## 26. Runtime implementation — Phase 1

The canonical runtime token layer is `app/design-tokens.css`.

Loading order is intentional:

1. `app/globals.css` — legacy implementation;
2. `app/design-tokens.css` — V2 tokens and compatibility aliases.

This allows the project to migrate incrementally while existing selectors continue to work.

Runtime supporting files:

- `lib/design-system.ts` — typed token catalog used by documentation/playground;
- `components/ui-kit/FoundationPreview.tsx` — real Foundations preview;
- `app/ui-kit/page.tsx` — authenticated live catalog;
- `scripts/design-system-smoke.mjs` — CI contract check.

The dashboard white-label bridge maps Organization colors to `--color-action-primary` and `--color-action-accent` while preserving legacy aliases during migration.

`UiIcon` remains the official internal outline-SVG icon mechanism for the current migration. Unicode navigation glyphs are legacy targets for Phase 3.


## 27. UI Core runtime — Phase 2

The canonical primitive style layer is `app/ui-kit-core.css`, loaded after `app/design-tokens.css`.

New modules must consume the official primitives from `@/components/ui-kit`; they must not reimplement primitive visuals locally.

UI Core uses semantic/adaptive tokens for light and dark themes, visible focus states, responsive layouts and reduced-motion behavior. The implementation intentionally contains no local hexadecimal palette values.

Legacy wrappers may preserve existing APIs while delegating to UI Core during migration.


## 28. Global shell/navigation runtime — Phase 3

The authenticated shell is now a Design System V2 consumer.

Canonical implementation:
- `app/shell-v2.css` for token-driven global shell styling;
- `components/DashboardSidebar.tsx` for desktop/mobile role-aware navigation behavior;
- `components/DashboardChrome.tsx` for contextual header/account actions;
- `components/UiIcon.tsx` for the official outline SVG icon vocabulary.

Rules:
- shell styles use semantic tokens, not local hex palettes;
- Organization white-label continues through `--color-action-primary` and `--color-action-accent`;
- all global interactive controls require visible focus;
- responsive drawer and field bottom navigation are first-class layouts;
- reduced-motion behavior is mandatory;
- module authorization and user navigation preferences remain unchanged by visual migration.

Phase 4 begins shared Data UI; it must build on this shell rather than invent module-local header/filter systems.


## 29. Shared Data UI — Phase 4

Phase 4 adds the official data-display and data-navigation grammar.

Canonical primitives:
- Search;
- FilterPanel / FilterGroup;
- DataTable;
- Pagination;
- RowActions / bulk actions;
- KpiCard / MetricGrid / StatTiles;
- LineChart;
- Timeline;
- ProgressBar / CircularProgress / StepProgress.

Rules:
- chart series consume `--chart-1` through `--chart-10`; modules do not invent local chart palettes;
- filters are never access control;
- DataTable selection and bulk actions only expose actions supplied by the caller;
- destructive row actions keep explicit semantic treatment;
- table state must remain understandable by keyboard and screen-reader users;
- progress uses text/value in addition to color;
- data components use Design Tokens only and support light/dark/reduced-motion.

The Shared Data UI layer is reusable infrastructure. Domain identity belongs to Business UI and module phases.
