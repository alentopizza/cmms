# DESWEB Design System V2 — Final Audit

> Fecha de cierre: 2026-09-24  
> Alcance: cierre de Fase 10 y baseline de no regresión para el programa visual 0–10.

## Resultado ejecutivo

El programa progresivo DESWEB Design System V2 queda cerrado con las Fases 0–10 implementadas.

La aplicación conserva su arquitectura funcional actual y adopta una capa visual gobernada por:

- Design Tokens;
- UI Core;
- Shared Data UI;
- Business UI;
- capas de migración por módulo;
- shell global V2.

## Auditoría de color

Baseline medido antes del cierre de Fase 10:

| Hoja | Hex hardcodeados | Estado |
| --- | ---: | --- |
| `app/globals.css` | 1.561 apariciones / 915 valores únicos | deuda legacy inventariada |
| `app/business-ui.css` | 0 | V2 |
| `app/data-ui.css` | 0 | V2 |
| `app/phase6-modules.css` | 0 | V2 |
| `app/phase7-modules.css` | 0 | V2 |
| `app/phase8-modules.css` | 0 | V2 |
| `app/phase9-modules.css` | 0 | V2 |
| `app/phase10-modules.css` | 0 | V2 |
| `app/document-workspace.css` | 0 | V2 |
| `app/shell-v2.css` | 0 | V2 |
| `app/ui-kit-core.css` | 0 | V2 |
| `app/ui-kit/ui-kit.css` | 0 | V2 |

`app/design-tokens.css` contiene los valores físicos de la paleta por definición y queda fuera de la regla de “cero hex”.

La deuda de `globals.css` no se elimina con búsqueda/reemplazo global porque contiene estilos aún consumidos por superficies legacy y compatibilidad histórica. CI impide que esa deuda crezca por encima del baseline auditado.

## Componentes duplicados

No se introduce un segundo framework de componentes.

CI rechaza dependencias de UI paralelas conocidas y mantiene wrappers de compatibilidad —por ejemplo `FileDropzone`— delegando al componente oficial del UI Kit en vez de bifurcar comportamiento.

## Accesibilidad

El cierre de Fase 10 exige:

- foco visible;
- controles con nombre accesible;
- estados expresados con texto/icono además de color;
- Drawer/Modal con manejo de foco y Escape;
- `aria-pressed` en preferencias de tema;
- reduced motion para capas migradas.

La auditoría estática no sustituye pruebas manuales con lector de pantalla, navegación completa por teclado ni validación WCAG automatizada en navegador.

## Responsive

Las capas V2 mantienen contratos Desktop/Laptop/Tablet/Mobile.

Fase 10 incluye cortes de 1280/900/700 px y preserva el modelo de navegación móvil ya definido por rol. El Centro de reportes no introduce una navegación distinta.

## Contraste y color funcional

Las capas V2 consumen tokens semánticos. Success/Warning/Danger/Info se reservan para estado funcional; no se usan como decoración arbitraria.

La marca blanca modifica los tokens de acción autorizados y no reemplaza la semántica de estados.

## Performance

Fase 10 no añade polling ni una segunda carga de datos para Reportes.

El Centro de reportes reutiliza:

- `/api/dashboard/export`;
- `/api/module-export`;
- exportadores contextuales existentes.

Los filtros del reporte ejecutivo se mantienen URL-driven y los archivos se generan bajo la autorización ya existente.

## Iconografía

Reportes añade el icono canónico `report`; preferencias de tema usan `sun`, `moon` y `system`.

Settings, Personalization y Reports no usan glifos decorativos legacy. El audit CI también inventariará las ocurrencias restantes en TS/TSX para permitir su retiro oportunista sin volver a introducirlas en superficies V2.

## Deuda aceptada

La deuda aceptada al cierre es principalmente:

1. `app/globals.css`, que todavía contiene estilos históricos y valores físicos;
2. selectores legacy aún consumidos por superficies no reescritas estructuralmente;
3. cadenas de interfaz todavía en español mientras el sistema de diccionarios i18n se implementa progresivamente.

Esta deuda no invalida el cierre de V2 siempre que:

- no crezca el baseline;
- nuevo código use tokens y componentes oficiales;
- cada refactor retire legacy solo cuando pueda probar que ya no tiene consumidor.

## Guardrails CI

Fase 10 añade:

- `scripts/phase10-final-smoke.mjs`;
- `scripts/design-system-final-audit.mjs`.

El audit bloquea:

- hexadecimales en CSS V2;
- crecimiento del baseline legacy;
- frameworks UI duplicados;
- pérdida de focus/reduced-motion/responsive en Fase 10;
- regresión de iconografía legacy en Reportes/Settings/Personalización.

## Estado final

**DESWEB Design System V2: programa 0–10 implementado.**

A partir de este punto, cualquier módulo nuevo debe nacer directamente sobre los contratos V2; no debe abrirse una nueva “fase de migración” para patrones que el UI Kit ya resuelve.
