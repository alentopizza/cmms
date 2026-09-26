# Auditoría de rendimiento — Desweb CMMS

Fecha: 2026-09-25  
Alcance: frontend, App Router, Server Components, APIs, PostgreSQL, imágenes, navegación, bundle/build, caché y experiencia percibida.

## Regla de medición

Esta auditoría distingue entre:

- **Medición directa**: CI/build, tamaño de artefactos, número de consultas/cargas visibles en código y límites SQL.
- **Evidencia estructural**: consultas serializadas, subconsultas correlacionadas, requests de cliente y recursos cargados antes de uso.
- **Pendiente de producción**: FCP, LCP, TTI/INP, latencia real de red, tiempos reales de API y `EXPLAIN ANALYZE` sobre el volumen de datos desplegado.

No se consideran demostradas mejoras de milisegundos que no hayan sido medidas en el entorno de producción.

## Baseline medido

CI `36192550851`, build exitoso sobre `2c9d984ea67d8c289cb192d165883ed1738117c3`:

| Métrica | Baseline |
| --- | ---: |
| .next/static | 2,824,056 bytes |
| JavaScript estático | 2,069,508 bytes / 68 archivos |
| CSS estático | 754,548 bytes / 6 archivos |
| Mayor chunk JS | 229,156 bytes |
| Mayor chunk CSS | 489,404 bytes |
| Recursos biométricos en public | 30,577,105 bytes / 25 archivos |
| biometric-human.js | 1,583,774 bytes |

El motor biométrico no se importa como dependencia React inicial: `lib/client-biometric.ts` inserta `/biometric-human.js` bajo demanda. Los ~30.6 MB afectan tamaño de paquete/deploy y el flujo biométrico cuando se usa, no la navegación normal por sí solos.

## Hallazgos priorizados

### P0 — Crítico

No se identificó un P0 reproducible durante la auditoría de código/CI. No se encontraron fallos de build actuales ni una regresión que impida operar el ERP.

### P1 — Navegación: resolución duplicada de sesión

**Problema**  
El layout de dashboard y las páginas hijas llaman `getSession()` durante el mismo render RSC.

**Causa**  
`getSession()` resolvía cookie + consulta de usuario/membresía/suscripción cada vez.

**Evidencia**  
`app/dashboard/layout.tsx` y las páginas de módulos llaman `getSession()`; la resolución incluye dos `LATERAL`.

**Solución implementada**  
`getSession = cache(resolveSession)`, usando memoización por render/request de React.

**Impacto esperado**  
Elimina resoluciones duplicadas dentro del mismo render sin cachear sesión entre requests ni cambiar seguridad.

### P1 — Shell: lecturas independientes serializadas

**Problema**  
Personalización/branding se resolvían antes de preferencias/avatar.

**Solución implementada**  
`DashboardLayout` resuelve personalización, branding, preferencias y presencia de avatar mediante `Promise.all`.

También se memoizan por request `getCustomizationSummary` y `getOrganizationBranding`.

### P1 — Experiencia percibida de navegación

**Problema**  
No existía `app/dashboard/loading.tsx`; una transición podía parecer congelada mientras el servidor esperaba consultas.

**Solución implementada**  
Loading boundary oficial con `LoadingPage`.

No oculta el trabajo real ni finge que terminó.

### P1 — Imágenes de directorios

**Problema**  
Grid y List pueden coexistir montados para preservar estado. Varias imágenes se cargaban/decodificaban aunque estuvieran fuera de viewport.

**Solución implementada**

- `loading="lazy"`
- `decoding="async"`
- dimensiones explícitas en `EntityIdentityCell`
- caché HTTP corta para imágenes autorizadas: `private, max-age=300`
- branding público: `public, max-age=300`

Aplica a tarjetas/listados compartidos y endpoints de avatar/logo/activo/inventario/ubicación/sede.

### P1 — Reacción: polling redundante

**Problema**  
`ReactionMap` consultaba snapshot cada 5 s incluso con pestaña oculta y sin bloquear una segunda actualización si la anterior seguía activa.

**Solución implementada**

- no refrescar con `document.visibilityState === "hidden"`
- flag `refreshing` para impedir solapamiento
- refresco al volver visible
- cleanup de listener/timer

El snapshot mantiene `cache: "no-store"` porque es información operativa dinámica.

### P1 — Reacción: consultas independientes serializadas

**Problema**  
Empresas, sedes, técnicos y actividades se consultaban una detrás de otra en `/api/reaction/snapshot`.

**Solución implementada**  
Las cuatro consultas base se inician primero y se esperan con `Promise.all`; las muestras de trayectoria se mantienen después porque dependen de los tracking session IDs.

### P1 — Asistencia: consultas base serializadas

**Problema**  
Política, aviso biométrico, sedes, enrolamiento, turno abierto y horario se resolvían secuencialmente.

**Solución implementada**

- primer grupo independiente en `Promise.all`
- segmento actual + tareas destino en segundo `Promise.all`

No se modificaron biometría, geocerca, reglas de jornada, contingencias ni permisos.

### P1 — Work Orders / Rutinas: lecturas serializadas

**Solución implementada**  
Creation gate, colección principal y catálogos requeridos se inician en paralelo cuando no existe dependencia entre ellos.

### P1 — Usuarios: hot paths PostgreSQL

**Problema**  
La consulta del directorio evalúa por usuario contadores/EXISTS de OT, tareas, ejecución, asistencia, tracking y trazabilidad.

**Índices existentes útiles**

- `work_order_tasks(assigned_to,status)`
- `crew_members(organization_id,user_id)`
- `attendance_shifts(user_id,check_in_at DESC)`
- `activity_execution_events(user_id,occurred_at DESC)`
- tracking activo por `user_id`
- work orders por requester/assignee añadidos en migración 041

**Índices faltantes confirmados e implementados en migración 042**

- `meter_readings(recorded_by)`
- `work_order_comments(user_id)`
- `audit_log(user_id)`

No se añadieron índices genéricos ni redundantes.

### P1 — Usuarios: doble recorrido de sedes por fila

**Problema**  
`organization_member_sites + sites` se recorría dos veces por usuario: una para `site_ids` y otra para `site_names`.

**Solución implementada**  
Un único `LEFT JOIN LATERAL` produce ambos `array_agg`.

### P1 — Usuarios: carga de detalle antes de abrir ficha

**Problema**  
La página inicial cargaba hasta 1,600 `user_documents` y todos los contactos de emergencia, aun sin abrir un usuario. Además las estadísticas se solicitaban al seleccionar cualquier ficha.

**Solución en curso/implementada**

- eliminar documentos/contactos del payload inicial del Server Component
- reutilizar `/api/users/[id]/documents` y `/api/users/[id]/emergency-contact` con GET autorizado
- cachear detalle por `userId` en el cliente
- `EntityProfileWorkspace` notifica cambio de pestaña
- estadísticas/documentos/contacto se solicitan solo al entrar a su pestaña

**Medición estructural antes/después**

Antes: hasta 1,600 documentos + todos los contactos en cada entrada a Usuarios.  
Después: 0 documentos y 0 contactos en el render inicial; una consulta puntual solo para el usuario/pestaña abierta.

### P1 — Bundle de herramientas de detalle

**Problema**  
Herramientas pesadas se importaban con el directorio aunque solo se usaran dentro de una ficha.

**Solución implementada con `next/dynamic`**

Usuarios:
- estadísticas
- auditoría de asistencia

Empresas:
- mapa/geocerca
- workspace documental
- modal de documento

Proveedores:
- constructor de requisiciones
- importador masivo

Ubicaciones:
- mapa/geocerca
- creación de sububicación

### P1 — CSS global excesivo — pendiente de extracción segura

**Problema medido**

`app/globals.css`: 540,358 bytes / 13,502 líneas.

Contiene en el mismo archivo estilos de marketing, dashboard, empresas, proveedores, usuarios, Reacción, Asistencia, inventario, requisiciones, shell y generaciones históricas del design system.

Indicadores:

- 180 media queries
- 190 usos de `!important`
- prefijos encontrados: marketing 736, company 646, dashboard 343, entity 327, supplier 299, user 283, reaction 200, inventory 175, location 174, attendance 135, etc.
- mayor chunk CSS de build: 489,404 bytes

**Riesgo**  
Extraer bloques automáticamente puede cambiar cascada/especificidad/orden y producir regresiones visuales.

**Siguiente estrategia**  
Separar por dominio en cambios pequeños, empezando por marketing público vs shell/dashboard, con smoke visual/selector y comparación del build después de cada extracción.

No se implementa una separación masiva en esta fase.

### P1 — Proveedores: precarga de detalle — Fase 2 cerrada

**Antes**

Al entrar a `/dashboard/suppliers` se resolvían, además del directorio y catálogos de creación:

- hasta 600 actividades;
- hasta 800 suministros;
- hasta 600 requisiciones;
- hasta 800 documentos;
- cuatro catálogos de inventario;
- analítica comercial para todos los proveedores mediante tres consultas adicionales.

El Server Component ejecutaba 12 lecturas de datos en su `Promise.all` y luego tres consultas analíticas globales. El creation gate se resolvía aparte y permanece funcionalmente igual.

**Después**

El render inicial conserva únicamente:

- resumen de proveedores autorizado;
- empresa(s) requeridas por creación;
- catálogo de capacidades;
- catálogo de especialidades;
- creation gate existente.

El resumen incorpora conteos agregados de actividades, suministros, requisiciones y documentos. Esos agregados se calculan una sola vez por tabla y se limitan por empresa para sesiones tenant.

Las colecciones detalladas ya no forman parte del RSC inicial.

**Carga bajo demanda por pestaña**

- General / Información financiera: `GET /api/suppliers/[id]?view=general`.
- Estadísticas: `GET /api/suppliers/[id]?view=statistics`.
- Actividades: `GET /api/suppliers/[id]?view=activities`.
- Inventarios / suministros: `GET /api/suppliers/[id]?view=inventory`.
- Requisiciones: `GET /api/suppliers/[id]?view=requisitions`.
- Documentos: `GET /api/suppliers/[id]/documents`.

`SupplierDirectory` mantiene caché en memoria por proveedor y vista. Regresar a una pestaña ya cargada no vuelve a consultar mientras la pantalla permanezca montada.

**Comparación estructural**

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Consultas SQL de módulo al entrar, excluyendo creation gate sin cambios | 15 | 4 |
| Actividades detalladas precargadas | hasta 600 | 0 |
| Suministros detallados precargados | hasta 800 | 0 |
| Requisiciones detalladas precargadas | hasta 600 | 0 |
| Documentos detallados precargados | hasta 800 | 0 |
| Catálogos de inventario en render inicial | 4 colecciones | 0 |
| Analítica comercial global al entrar | 3 queries | 0 |
| Requests HTTP al abrir una sola pestaña de ficha | 0 porque todo estaba precargado | 1 para la pestaña solicitada |
| Requests al volver a una pestaña ya cacheada | 0 | 0 |

La reducción de consultas iniciales de módulo es 15 → 4 (~73%), sin contar el creation gate porque existe antes y después.

El build medido después de la primera versión funcional de Fase 2 reportó para `/dashboard/suppliers` 206,619 bytes de JavaScript referenciado y 746,070 bytes de CSS. La línea base anterior era 203,137 bytes JS / 746,070 bytes CSS: el caché/tab-demand añade ~3.5 KB JS (~1.7%) y no altera CSS. La ganancia buscada está en queries, filas y RSC inicial, no en CSS.

No existe todavía una medición RUM/p50/p95 de navegación productiva ni una medición directa de bytes del RSC con datos reales. Por eso no se declara una mejora en milisegundos que no haya sido observada.

**Compatibilidad preservada**

- Grid/List usa la misma colección resumida.
- búsqueda, filtros, acciones rápidas y selección no cambian;
- POST de proveedor/documentos no cambia;
- creación/edición/desactivación de suministros no cambia;
- `RequisitionBuilder` y exportación de requisiciones permanecen;
- permisos `suppliers.manage` y alcance por empresa se mantienen;
- no hubo migraciones ni cambios de modelo.

`scripts/performance-suppliers-phase2-smoke.mjs` protege la separación de datos, caché por pestaña, alcance tenant y funciones existentes.

### P1 — Directorios con límites grandes — pendiente de migración server-side

Límites observados:

- Activos: hasta 600
- Inventario: hasta 600
- Ubicaciones/servicios: hasta 500
- Work Orders: 200
- Rutinas: 200
- Usuarios (antes de lazy detail): documentos hasta 1,600

**Diagnóstico**  
El patrón actual de `ModuleHeader` filtra registros ya montados en el DOM. Pasar directamente a paginación server-side sin adaptar búsqueda/facetas rompería la semántica de filtros y el cambio Grid/List.

**Estrategia compatible**  
Migrar módulo por módulo a parámetros URL server-side:

1. search
2. filtros/facetas
3. sort
4. cursor/page
5. total
6. misma colección para Grid/List

Prioridad sugerida restante: Activos → Inventario → Ubicaciones → Work Orders/Rutinas.

### P2 — Dashboard: alto número de consultas

`app/dashboard/page.tsx` contiene múltiples agregaciones, aunque muchas ya están correctamente paralelizadas por grupos.

No se deben cachear indiscriminadamente porque los filtros y roles cambian el alcance. Próximo paso: medir `DB_SLOW_QUERY_MS` en producción y optimizar únicamente consultas que aparezcan como lentas.

### P2 — Telemetría SQL

Implementado en `lib/db.ts`:

- `DB_POOL_MAX` configurable
- `DB_SLOW_QUERY_MS`
- log `[db:slow]` con duración y query normalizada

Recomendación inicial para diagnóstico controlado: configurar un umbral de 250–500 ms en staging/producción durante la auditoría y revisar patrones repetidos antes de añadir nuevos índices.

### P2 — Biometría y tamaño del paquete

Los artefactos biométricos suman ~30.6 MB, pero la aplicación no los solicita en navegación normal: `loadBiometricEngine` inserta el script solo durante flujo biométrico.

Pendiente: confirmar qué archivos del catálogo de `@vladmandic/human` son requeridos exactamente por detector/mesh/description/antispoof/liveness/gesture antes de reducir el paquete. No borrar modelos por nombre sin validar dependencias internas.

### P2 — Build cache de CI

Next reporta: `No build cache found`.

Esto afecta tiempo de CI/deploy, no la navegación del usuario. Puede configurarse cache de `.next/cache` en CI/Easypanel como optimización operativa posterior.

### P3 — Dependencias

Dependencias directas principales: Next, React, pg, Human, pdf-lib, exceljs.

No se encontró evidencia suficiente para eliminar ninguna. Human es funcionalmente requerido por biometría; Excel/PDF deben verificarse por usos runtime/build antes de cualquier limpieza.

## Base de datos

Cambios aplicados:

- `041_performance_work_order_hot_paths.sql`
  - work orders por organización/requested_at
  - requester
  - assignee
  - work_order_tasks por work_order
- `042_performance_user_hot_paths.sql`
  - meter readings por recorded_by
  - comments por user_id
  - audit log por user_id

Todos los índices están ligados a consultas existentes.

## APIs

Cambios de rendimiento aplicados sin endpoints paralelos:

- Reacción: consultas base paralelas
- imágenes/branding: caché HTTP corta
- rutas existentes de documentos/contacto de usuario: GET de metadata para carga diferida

No se cambió el contrato de POST existente.

## Riesgos pendientes

1. CSS monolítico: riesgo de cascada al separar.
2. Server pagination: requiere sincronizar filtros/búsqueda/facetas con URL.
3. Ubicaciones y otros directorios aún precargan colecciones de detalle grandes; Proveedores Fase 2 quedó separado por pestaña.
4. Dashboard necesita datos reales de slow-query telemetry antes de cambiar SQL.
5. No hay RUM de producción todavía.
6. No se ejecutó `EXPLAIN ANALYZE` contra datos productivos; el dataset de CI no representa escala real.

## Próximas mediciones recomendadas

En staging/producción:

- activar temporalmente `DB_SLOW_QUERY_MS=300`
- registrar p50/p95 de navegación por módulo
- medir RSC/document response size para Usuarios/Proveedores/Activos
- medir requests de imágenes en primer viewport vs scroll
- medir FCP/LCP/INP con navegador real
- capturar `EXPLAIN (ANALYZE, BUFFERS)` solo de queries que aparezcan en `[db:slow]`
- comparar CSS transferido antes/después de cada extracción de `globals.css`

## Criterio de éxito

No declarar “rendimiento resuelto” por limpieza de código. Cada siguiente lote debe producir al menos uno de:

- menor número de queries
- menor payload
- menor número de requests
- menor trabajo fuera de viewport
- menor JS/CSS referenciado por ruta
- menor tiempo SQL/API medido
- mejor métrica de navegación/render medida
