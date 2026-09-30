# GLOBAL-NAV-01 — Diagnóstico de congelamiento al cambiar entre módulos

## 1. Resumen ejecutivo

**Alcance:** diagnóstico únicamente. No se modificó código funcional, navegación, Header, Sidebar, layout, Server Components, queries, APIs, paginación, CSS, dependencias, base de datos ni comportamiento de los módulos.

**Baseline inspeccionado:** rama `main`, HEAD funcional previo al documento `9e01b129cb24395f200d6eeff7b1fd60e3816503` (`docs: analyze approval threshold site impact`).

La inspección estática encontró un defecto crítico y determinista en el componente cliente compartido `components/ModuleHeader.tsx`: el prop opcional `facets` usa un valor por defecto `[]` creado en cada render y, al mismo tiempo, el efecto de filtrado depende de la identidad de `facets`. En la rama sin `serverState`, ese efecto ejecuta siempre `setFacetOptions(options)` con un objeto nuevo. Cuando un consumidor omite `facets`, el ciclo resultante es:

    render
    → facets = [] nuevo
    → useEffect detecta dependencia nueva
    → setFacetOptions({}) con referencia nueva
    → render
    → facets = [] nuevo
    → useEffect
    → ...

El módulo `/dashboard/leads` es un consumidor concreto de `ModuleHeader` que omite tanto `facets` como `serverState`. Por lo tanto, el código actual contiene una ruta demostrable hacia renders/efectos no acotados que puede saturar el hilo principal y presentar la interfaz como congelada.

La **existencia del loop en el código está demostrada**. La relación con **todo** el síntoma reportado se clasifica como **causa raíz probable**, no como confirmación operacional absoluta, porque en esta fase no se ejecutó una sesión de navegador autenticada con perfil de CPU/render/network para reproducir la secuencia exacta del usuario. El defecto, no obstante, sí es suficiente por sí mismo para explicar un congelamiento al entrar a Leads o al volver a esa ruta.

También se identificaron cargas server-side relevantes en Assets, Inventory, Kardex, Work Orders, Maintenance y Suppliers. Pueden aumentar el tiempo de transición, pero no muestran un mecanismo de loop de cliente y no existe evidencia suficiente para atribuirles el congelamiento. Los cambios recientes de paginación de Assets/Inventory/Kardex son posteriores a la regresión de `ModuleHeader`, por lo que se descartan como origen temporal del defecto de render.

## 2. Síntoma analizado

Síntoma reportado: la aplicación se congela o deja de responder temporalmente cuando se navega entre módulos del dashboard.

Se separan tres clases de comportamiento:

1. **Bloqueo de cliente:** el hilo principal ejecuta renders/efectos repetidos y la UI deja de responder.
2. **Latencia server-side:** la navegación espera Server Components/queries y se percibe lenta, pero el navegador no está bloqueado.
3. **Carga de bundle/recursos:** descarga, parseo o inicialización de JS/CSS puede retrasar la interacción.

El hallazgo principal pertenece a la primera clase. Las consultas auxiliares y catálogos completos pertenecen a la segunda.

### Limitación de reproducción

No se levantó una sesión interactiva autenticada del producto con Chrome DevTools/React Profiler en esta fase. La evidencia proviene de:

- estado actual del repositorio;
- historial de commits;
- análisis de componentes y efectos;
- SQL ejecutado por las páginas;
- CI actual;
- reporte de bundles generado por `scripts/performance-build-report.mjs`.

No se inventan tiempos de navegación, CPU, memoria ni conteos de requests de navegador.

## 3. Arquitectura de navegación

### 3.1 Mapa actual

    app/dashboard/layout.tsx  [Server Component, dynamic=force-dynamic]
      │
      ├── getSession()
      ├── branding / preferencias / avatar
      │
      ├── BrandThemeSync              [Client, persistente]
      ├── TechnicianLocationTracker   [Client, condicional por permiso]
      ├── DashboardSidebar            [Client, persistente]
      └── main
          ├── CurrentSectionHeader    [Client, persistente]
          │   └── SidebarAccountMenu
          └── workspace-content
              └── Active Module
                  ├── Assets
                  ├── Inventory
                  ├── Work Orders
                  ├── Maintenance
                  ├── Suppliers
                  ├── Leads
                  └── otros

No se encontraron layouts anidados de módulo bajo `app/dashboard/*/layout.tsx`. El layout compartido es `app/dashboard/layout.tsx`.

### 3.2 Qué persiste entre rutas

En una navegación interna del App Router, la estructura de layout compartida conserva sus componentes cliente mientras cambia el segmento hijo:

- `DashboardSidebar`;
- `CurrentSectionHeader` / perfil;
- `BrandThemeSync`;
- `TechnicianLocationTracker` cuando el permiso `reaction.track` aplica.

El contenido del módulo cambia y sus componentes cliente se montan/desmontan según la ruta.

### 3.3 Navegación

La navegación principal usa `Link` de Next.js. `DashboardSidebar` usa `usePathname` para:

- marcar el elemento activo;
- cerrar el drawer móvil al cambiar de ruta.

No se encontró `router.refresh()` en el Sidebar ni una navegación recursiva disparada por pathname.

## 4. Header Global

Archivos principales:

- `components/DashboardChrome.tsx`;
- `components/ModuleHeader.tsx`;
- `components/ui-kit/DataControls.tsx`.

### 4.1 CurrentSectionHeader

`CurrentSectionHeader` usa `usePathname()` solo para resolver etiqueta, eyebrow e icono del módulo actual. No realiza fetch, no llama APIs y no modifica navegación.

**Clasificación:** ⚪ DESCARTADO como origen directo del congelamiento.

### 4.2 SidebarAccountMenu

El menú de perfil registra dos listeners globales una vez:

- `document.mousedown`;
- `document.keydown`.

El cleanup elimina ambos listeners. No dependen de pathname.

**Clasificación:** ⚪ DESCARTADO como memory leak o loop de navegación.

### 4.3 ModuleHeader — hallazgo crítico

Código relevante actual:

- parámetro `facets=[]`;
- `const facetSignature=JSON.stringify(facets)`;
- efecto de filtrado con dependencias:
  `[normalizedSearch, filter, count, facetSignature, facetValues, facets, viewRevision, serverState]`;
- rama sin `serverState` que siempre crea `const options={}` y ejecuta `setFacetOptions(options)`.

En un consumidor que no envía `facets`, el array por defecto no conserva identidad entre renders. El efecto provoca un estado nuevo y vuelve a dispararse.

### 4.4 Consumidor afectado demostrado

`app/dashboard/leads/page.tsx` monta `ModuleHeader` con filtros de estado, pero no pasa `facets` ni `serverState`.

La página de Leads además trae hasta 300 filas y las entrega a una vista cliente, pero esa carga es secundaria: el loop del Header puede ocurrir independientemente del tamaño del dataset.

**Severidad:** 🔴 CRÍTICO.

**¿Explica congelamiento?:** Sí, técnicamente puede bloquear el cliente. La asociación con el incidente global se mantiene como probable hasta reproducir la secuencia exacta en navegador.

## 5. Sidebar Global

`components/DashboardSidebar.tsx` mantiene estado local de:

- orden;
- colapso;
- drawer móvil;
- menú móvil secundario;
- modo organizar;
- drag;
- estado de persistencia.

Efectos observados:

1. lectura de preferencias locales solo para usuario no persistente;
2. normalización de orden cuando cambian `items`;
3. resolución del host del menú móvil una vez;
4. cierre de overlays en `pathname`;
5. listener `keydown` solo mientras un overlay móvil está abierto, con cleanup;
6. persistencia POST a `/api/dashboard/preferences` solo cuando el usuario cambia orden/colapso.

No hay request por cada cambio de módulo ni `router.push/replace/refresh` disparado por pathname.

Existe un `setTimeout` de debounce para guardar preferencias; no es limpiado explícitamente en un cleanup de desmontaje, pero el Sidebar es persistente durante navegación interna y el timer solo nace tras una acción manual de organización/colapso. No explica el congelamiento reportado.

**Clasificación:** ⚪ DESCARTADO como causa principal. Observación preventiva de timer: 🟢 BAJO.

## 6. Providers y estado global

No se encontraron React Context providers propios envolviendo el dashboard en `app/dashboard/layout.tsx` ni en `app/layout.tsx`.

El estado global práctico del shell está distribuido en componentes cliente persistentes:

- Sidebar;
- Header/perfil;
- sincronización de tema;
- tracker de ubicación.

`getSession()` está envuelto por `cache(resolveSession)` de React, por lo que las llamadas repetidas dentro del mismo render server pueden reutilizar la resolución.

**Hallazgo:** no existe evidencia de una cascada provocada por un provider global que se actualice en cada navegación.

**Clasificación:** ⚪ DESCARTADO.

## 7. Client Components

### 7.1 ModuleHeader

Es el principal hallazgo. Su efecto local de filtros puede autoalimentarse cuando `facets` usa el valor por defecto.

### 7.2 CollectionView

`CollectionView`:

- intenta encontrar el host `module-view-mode-tools`;
- usa `MutationObserver` solo si el host aún no existe;
- desconecta el observer cuando lo encuentra;
- también desconecta en cleanup;
- guarda modo en localStorage;
- emite `cmms:view-mode-change` al cambiar modo.

`ModuleHeader` escucha ese evento y elimina el listener al desmontarse.

No se demostró acumulación de observers/listeners.

**Clasificación:** ⚪ DESCARTADO como leak.

### 7.3 BrandThemeSync

Solo instala listener de `matchMedia` cuando la preferencia es `system`, y lo elimina en cleanup.

**Clasificación:** ⚪ DESCARTADO.

### 7.4 TechnicianLocationTracker

Para cuentas con `reaction.track`:

- mantiene `watchPosition`;
- puede enviar `/api/reaction/track` al conectar y muestras posteriores;
- reintenta GPS mediante timer;
- escucha `visibilitychange`.

El cleanup:

- remueve el listener;
- anula `permissionStatus.onchange`;
- limpia timer;
- ejecuta `clearWatch`.

No depende de pathname. Puede existir un POST en curso mientras ocurre una navegación, pero no actualiza estado global de navegación.

**Clasificación:** 🟢 BAJO / concurrencia de fondo posible, no causa demostrada.

### 7.5 ReactionMap

Solo se monta en `/dashboard/reaction`, no es global. Tiene polling cada 5 s, ResizeObserver, resize/visibility listeners y requestAnimationFrame; todos se limpian al desmontar. Además usa un flag `refreshing` para evitar snapshots solapados.

**Clasificación:** ⚪ DESCARTADO como leak entre módulos.

## 8. Server Components

Los módulos principales son Server Components y consultan directamente PostgreSQL.

Patrón observado en Assets, Inventory, Kardex, Work Orders y Maintenance:

    scope autorizado
    → construcción de filtros
    → fase A: summary/facets/catálogos en Promise.all
    → cálculo de pageCount
    → fase B: query paginada de filas
    → render RSC

La fase B depende de `filtered_count`, por lo que existe un waterfall lógico de dos etapas aunque las consultas de la fase A sí se ejecuten en paralelo.

Esto puede aumentar el tiempo hasta que el nuevo segmento server queda listo, pero no produce por sí mismo un loop del navegador.

**Clasificación:** 🟡 MEDIO como latencia; no causa raíz del bloqueo de cliente.

## 9. Requests durante navegación

### 9.1 Layout

Antes de renderizar el shell, el layout resuelve sesión y luego ejecuta en paralelo:

- customization;
- organization branding cuando aplica;
- preferencias de Sidebar;
- existencia de avatar.

No se observó fetch cliente del Header/Sidebar en cada pathname.

### 9.2 Prefetch

Los enlaces de Sidebar son `Link` estándar y no deshabilitan prefetch. Next.js puede precargar rutas visibles en producción según sus reglas. Sin una captura Network del navegador no se puede afirmar cuántos RSC requests ocurren ni si algún prefetch compite con la navegación.

**Estado de evidencia:** hipotético, no cuantificado.

### 9.3 Instrumentación DB

`lib/db.ts` soporta logging de consultas lentas mediante `DB_SLOW_QUERY_MS`. El valor por defecto es 0, por lo que la instrumentación no produce tiempos si la variable no está habilitada.

Esto impide atribuir el incidente a una query concreta usando solo el estado actual del repositorio.

## 10. Queries por módulo

### 10.1 Assets

Página: `app/dashboard/assets/page.tsx`.

Paginación principal: 24 registros.

Antes de obtener las filas paginadas se ejecutan en paralelo:

- summary con múltiples COUNT/KPI;
- facets;
- marcas;
- modelos;
- categorías agregadas;
- catálogo de sedes;
- catálogo de ubicaciones;
- catálogo de proveedores;
- resumen de rutinas con `LIMIT 250`;
- historial OT con `LIMIT 250`;
- documentos con `LIMIT 250`;
- creation gate.

Después se ejecuta el SELECT de activos con `LIMIT/OFFSET`.

**Observación:** la fila principal está paginada, pero entrar al módulo todavía ejecuta varios recorridos del scope y catálogos auxiliares.

**Severidad:** 🟡 MEDIO.

### 10.2 Inventory

Página: `app/dashboard/inventory/page.tsx`.

Page size: 24 por defecto; permite 40 y 80.

Fase paralela inicial:

- summary;
- facets;
- sedes;
- ubicaciones;
- proveedores;
- categorías;
- bodegas;
- últimos 10 movimientos;
- creation gate;
- catálogo `requisitionItems`.

`requisitionItems` selecciona **todos** los artículos activos elegibles para requisición dentro del scope, ordenados por nombre, sin LIMIT.

Después se ejecuta la consulta paginada del directorio.

**Severidad:** 🟠 ALTO como riesgo de escalamiento server/RSC para organizaciones grandes; no demuestra freeze de cliente.

### 10.3 Kardex

Página: `app/dashboard/inventory/kardex/page.tsx`.

Page size: 24/40/80.

Fase inicial:

- summary;
- facets;
- catálogo completo de artículos activos de la organización seleccionada;
- catálogo completo de bodegas activas.

Después: transacciones paginadas con `LIMIT/OFFSET`.

**Severidad:** 🟡 MEDIO. Catálogos sin LIMIT pueden crecer, pero la tabla principal ya está paginada.

### 10.4 Work Orders

Página: `app/dashboard/work-orders/page.tsx`.

Page size: 24.

Fase inicial:

- creation gate;
- summary;
- facets;
- catálogo completo de activos no retirados para creación, cuando el usuario puede escribir.

Después: órdenes paginadas.

**Severidad:** 🟡 MEDIO.

### 10.5 Maintenance

Página: `app/dashboard/maintenance/page.tsx`.

Page size: 24.

Fase inicial:

- creation gate;
- summary;
- facets;
- catálogo completo de activos no retirados para crear rutinas.

Después: planes paginados.

**Severidad:** 🟡 MEDIO.

### 10.6 Suppliers

El directorio ejecuta una consulta agregada sin paginación con subagregados sobre:

- tareas de OT;
- inventario;
- requisiciones;
- documentos.

También carga organizaciones y catálogos en paralelo.

**Severidad:** 🟡 MEDIO según crecimiento del dataset. No hay evidencia de loop.

### 10.7 Leads

La página consulta:

- hasta 300 leads;
- conteos por estado.

El filtrado del Header es client-side.

**Severidad del dataset:** 🟡 MEDIO como deuda de escalabilidad.

**Severidad del efecto compartido:** 🔴 CRÍTICO.

## 11. Paginación reciente: Assets, Inventory y Kardex

### Assets

- `b4d48abe9e154f460c87bdbdb9795c0e961fc018`: documento de diagnóstico, no implementación.
- Implementación real observada: `06f7614fd36b946cda9d01e5504d6ee7d81a51eb` — `feat: paginate assets server-side with catalog aggregates`.
- `2d4f73b9dae4d815c935eb3613a441d9232e185c`: test de regresión de catálogos, no la implementación principal.

### Inventory

- `fa4426ad557f71544a5d1ff0ad489006e6b1c65b`: diagnóstico.
- El SHA indicado externamente para I0 no existe exactamente como estaba escrito; el commit resuelto en el repositorio es `aedd3550908d89172e06a33aa6f18ffaf68ae755` — `fix: enforce inventory site scope and no-leak boundaries`.
- `fd0c06b98d2feef8eed210692520f8d63f0f6c42`: paginación server-side de Inventory.
- `092787ea9ca6cfddb678d2a50039934c943c61d5`: documentación/validación.

### Kardex

- El SHA indicado externamente para I2-A1 no existe exactamente como estaba escrito; el commit resuelto es `ab6b61bf7a760820ee8d57bd422fc66ac11eea58` — `feat: paginate inventory kardex server-side`.
- `5ace3c040415e38d0f118182d934cf843c6705e2`: fortalecimiento de smoke de scope.
- `a844e72d36b7277989843e1585a1856ca5266aa1`: tipado de movimientos manuales, no navegación.

### Correlación

La regresión del efecto de `ModuleHeader` se introdujo antes de estos cambios:

1. `63785a85...` introdujo facets condicionales.
2. `4ec9bafa...` corrigió explícitamente la estabilidad del efecto reemplazando la dependencia `facets` por `facetSignature`.
3. `d5430d6ba4c66ab5451e2c888b665bdddc9bafb6` (Shared Data UI, 2026-09-25) volvió a agregar `facets` a las dependencias.
4. Assets server pagination llegó el 2026-09-26.
5. Inventory I1 llegó el 2026-09-26.
6. Kardex server pagination llegó el 2026-09-27.

Por cronología y mecanismo, la paginación reciente **no es el origen** del loop de cliente.

**Clasificación:** ⚪ DESCARTADO como origen del defecto crítico; 🟡 MEDIO como fuente separada de latencia potencial.

## 12. Bundle y JavaScript cliente

Se revisó el reporte de CI más reciente disponible para el baseline, run #1470.

Resumen:

- `.next/static`: 2,928,537 bytes;
- JavaScript total estático: 2,092,716 bytes / 68 archivos;
- CSS total: 835,821 bytes / 6 archivos;
- assets biométricos públicos: 30,577,105 bytes.

JavaScript por rutas relevantes reportadas:

| Ruta | JS medido |
|---|---:|
| /dashboard/assets | 219,558 B |
| /dashboard/suppliers | 216,905 B |
| /dashboard/maintenance | 199,611 B |
| /dashboard/inventory | 150,292 B |
| /dashboard/work-orders | 126,831 B |
| /dashboard/leads | 108,753 B |
| /dashboard/reaction | 102,572 B |
| /dashboard/inventory/kardex | 93,857 B |

Los modelos biométricos y `/biometric-human.js` están en `public/`; `lib/client-biometric.ts` carga el script explícitamente cuando se usa el flujo biométrico. No se encontró una importación global de ese motor en el dashboard layout.

No existe evidencia de que una descarga global multim megabyte de JavaScript sea la causa del bloqueo al cambiar módulos.

**Clasificación:** ⚪ DESCARTADO como causa principal. El CSS global grande es deuda de rendimiento, no evidencia de un freeze específico.

## 13. Memory leaks

| Componente | Recurso | Cleanup | Clasificación |
|---|---|---|---|
| SidebarAccountMenu | mousedown / keydown | Sí | ⚪ descartado |
| DashboardSidebar | keydown / body class | Sí | ⚪ descartado |
| BrandThemeSync | matchMedia change | Sí | ⚪ descartado |
| CollectionView | MutationObserver | Sí | ⚪ descartado |
| ModuleHeader | cmms:view-mode-change | Sí | ⚪ descartado |
| ModuleHeader | search timeout | Sí | ⚪ descartado |
| TechnicianLocationTracker | geolocation watch / visibility / timer | Sí | ⚪ descartado como leak |
| ReactionMap | interval / ResizeObserver / resize / visibility / rAF | Sí | ⚪ descartado |

No se identificó un memory leak confirmado que crezca con cada cambio de módulo.

El `saveTimer` del Sidebar no tiene cleanup dedicado al desmontaje, pero solo se crea después de cambiar manualmente preferencias y el Sidebar normalmente persiste durante navegación del dashboard. **🟢 BAJO**.

## 14. Concurrencia

### 14.1 Navegación rápida

No se encontró estado global del dashboard actualizado por respuestas antiguas de módulos A/B/C.

### 14.2 Requests de módulos previos

Los Server Components son manejados por el App Router. Sin captura de red no se puede demostrar cuántos requests quedan en vuelo cuando el usuario hace navegación rápida.

### 14.3 Geolocalización

`TechnicianLocationTracker` sí puede mantener POST de tracking en paralelo con navegación, pero esos requests:

- son de baja frecuencia relativa;
- no disparan navegación;
- no escriben estado del Header/Sidebar.

**Clasificación:** 🟢 BAJO.

### 14.4 ReactionMap

Usa `refreshing` para no solapar polls. Al desmontarse limpia el interval.

**Clasificación:** ⚪ DESCARTADO.

## 15. Errores silenciosos y boundaries

`app/dashboard/error.tsx` captura errores del segmento y escribe:

`console.error("[dashboard:error-boundary]", error)`.

Sin embargo, un loop de efectos/render en un Client Component puede consumir el hilo principal o terminar en un error tipo “Maximum update depth exceeded” antes de que la experiencia se perciba como una excepción server normal.

No existe actualmente una prueba CI de navegador que navegue módulos y falle ante mensajes de consola React.

CI #1470 compila y ejecuta múltiples smoke tests, pero éstos son principalmente Node/SQL/source-contract. Un build verde no descarta un loop de efectos que necesita montar el Client Component.

## 16. Correlación con commits

### 16.1 Cadena causal del Header compartido

**`63785a85d640cf8683d63c431a6e6b148288b853` — add conditional cascading facets**

Introdujo:

- `facets=[]`;
- cálculo dinámico;
- `setFacetOptions(options)`;
- dependencia directa de `facets`.

**`4ec9bafa87933dcb2d6ddf50480067c543f8506c` — stabilize conditional facet effect**

El propio commit corrigió:

    [normalizedSearch, filter, count, facets, facetValues]
    →
    [normalizedSearch, filter, count, facetSignature, facetValues]

Esto constituye evidencia histórica de que la identidad de `facets` ya había sido reconocida como un problema.

**`d5430d6ba4c66ab5451e2c888b665bdddc9bafb6` — Shared Data UI Phase 4**

La migración volvió a introducir `facets`:

    [normalizedSearch, filter, count, facetSignature, facetValues]
    →
    [normalizedSearch, filter, count, facetSignature, facetValues, facets]

El código actual conserva esa dependencia.

### 16.2 Leads

`9db7ff98b3063f9c9fdb7ec44e60dde42ada323f` incorporó `ModuleHeader` en Leads sin prop `facets`. Las revisiones actuales siguen omitiendo `facets` y `serverState`.

Por tanto, una vez reintroducida la dependencia inestable, Leads quedó en el camino afectado.

### 16.3 Cambios recientes del shell

`e13f8cdbef067088cdcb06efca83d9f8511ed290` y `62da1f53e6d4c9d916151ced1f6309a2cf70068e` modificaron distribución/autoridad visual del shell y tests, pero no introdujeron el efecto de `ModuleHeader`.

No se encontró una cadena causal equivalente desde esos commits hacia un loop.

## 17. Matriz de diagnóstico

| Área | Hallazgo | Evidencia | Severidad | ¿Explica congelamiento? |
|---|---|---|---|---|
| Header | `ModuleHeader` puede entrar en effect/render loop cuando `facets` usa el default `[]` | dependencia incluye `facets` + `setFacetOptions({})` nueva en cada efecto | 🔴 CRÍTICO | **Sí, mecanismo directo** |
| Header perfil | listeners de click/teclado con cleanup | `SidebarAccountMenu` | ⚪ DESCARTADO | No |
| Sidebar | pathname solo cierra overlays; sin fetch/navegación recursiva | `DashboardSidebar` | ⚪ DESCARTADO | No |
| Layout | sesión + branding/preferencias/avatar | `app/dashboard/layout.tsx` | 🟢 BAJO | No demostrado |
| Providers | no hay Context provider global propio en el dashboard | layouts inspeccionados | ⚪ DESCARTADO | No |
| Navegación | `Link` estándar; prefetch no medido | Sidebar | 🟢 BAJO | No demostrado |
| Server Components | summary/facets/catálogos antes de rows | varios módulos | 🟡 MEDIO | Puede causar espera, no freeze de hilo principal |
| Queries | catálogos auxiliares sin LIMIT en varios módulos | Inventory/Kardex/WO/Maintenance | 🟠 ALTO | Puede degradar a escala; no demostrado como freeze |
| API | tracking de técnico puede coexistir con navegación | `/api/reaction/track` | 🟢 BAJO | No |
| Client rendering | Leads usa Header afectado y hasta 300 registros | Leads + ModuleHeader | 🔴 CRÍTICO | Sí, por el Header |
| Bundles | rutas medidas ~94–239 KB JS; biometría no global | CI performance report | ⚪ DESCARTADO | No |
| Memory | cleanups presentes en globales revisados | efectos/listeners/observers | ⚪ DESCARTADO | No |
| Concurrencia | no se demostró stale response actualizando navegación global | inspección | 🟢 BAJO | No |
| Assets | muchas queries auxiliares, filas paginadas a 24 | Assets page | 🟡 MEDIO | Latencia posible |
| Inventory | requisitionItems sin LIMIT + segunda fase paginada | Inventory page | 🟠 ALTO | Latencia/payload posible |
| Kardex | items/warehouses completos + transacciones paginadas | Kardex page | 🟡 MEDIO | Latencia posible |
| Work Orders | catálogo completo de activos + rows paginadas | Work Orders page | 🟡 MEDIO | Latencia posible |
| Maintenance | catálogo completo de activos + rows paginadas | Maintenance page | 🟡 MEDIO | Latencia posible |
| Suppliers | directorio/agregados sin paginación | Suppliers page | 🟡 MEDIO | Latencia posible |
| Leads | consumidor sin `facets`/serverState | Leads page | 🔴 CRÍTICO | **Sí** |

## 18. Causa raíz / limitación de evidencia

### CAUSA RAÍZ PROBABLE

Dependencia inestable de `facets` en el efecto de filtrado del componente cliente compartido `ModuleHeader`, combinada con el default `facets=[]` y una actualización de estado con una nueva referencia en cada ejecución.

### MECANISMO

Para consumidores que omiten `facets`:

    render
    → se crea un nuevo []
    → useEffect considera que facets cambió
    → se crea options={}
    → setFacetOptions(options)
    → React programa otro render
    → nuevo []
    → efecto otra vez

No existe una condición de convergencia porque `options` siempre tiene una identidad nueva.

### RUTA AFECTADA DEMOSTRADA

`/dashboard/leads`.

### COMPONENTE

`components/ModuleHeader.tsx`.

### CONSUMIDOR

`app/dashboard/leads/page.tsx`.

### EVIDENCIA

1. Código actual incluye `facets=[]`.
2. El efecto actual incluye `facets` en dependencias.
3. La rama sin `serverState` ejecuta siempre `setFacetOptions(options)` con un objeto recién creado.
4. Leads omite `facets` y `serverState`.
5. Historial Git muestra que `4ec9bafa...` eliminó precisamente `facets` de la dependencia para “stabilize conditional facet effect”.
6. `d5430d6...` volvió a agregarla.
7. El commit de regresión es anterior a las paginaciones recientes de Assets, Inventory y Kardex.

### Grado de certeza

- **Defecto de loop en el código:** demostrado.
- **Capacidad de congelar el cliente:** demostrada por el mecanismo de actualización sin convergencia.
- **Correspondencia con todas las navegaciones reportadas por el usuario:** probable, pendiente de traza de navegador que identifique la ruta exacta en cada caso.

Por esa diferencia, el diagnóstico global declara **CAUSA RAÍZ: probable**, no “confirmada” operacionalmente.

## 19. Corrección mínima propuesta

**NO IMPLEMENTADA EN ESTA FASE.**

### 1. Estabilizar el efecto de ModuleHeader

**Archivo:** `components/ModuleHeader.tsx`.

**Problema:** dependencia por identidad de `facets` cuando el default crea un array nuevo por render.

**Cambio esperado mínimo:** restaurar el contrato estable que ya existió en `4ec9bafa...`: el efecto debe depender de una representación estable (`facetSignature`) y no de la identidad directa del array default. Una variante equivalente sería definir un `EMPTY_FACETS` estable fuera del componente, pero no deben aplicarse dos soluciones paralelas sin necesidad.

**Riesgo de implementación:** bajo a medio, porque `ModuleHeader` es compartido y hay que proteger los facets dinámicos de Companies, Locations, Suppliers, Users, Crews, Attendance, Assets, Inventory, Work Orders, Maintenance y Requisitions.

**Pruebas necesarias:**

- montar Header sin facets (Leads);
- montar Header con facets client-side;
- montar Header con `serverState`;
- buscar/filtrar/cambiar Grid/Listado;
- navegar repetidamente entre módulos;
- comprobar cero “Maximum update depth exceeded”.

### 2. Agregar regresión de runtime

**Archivo futuro sugerido:** test de componente/browser nuevo, sin reemplazar los smokes existentes.

**Problema:** CI actual valida source contracts/build pero no monta la navegación en navegador.

**Cambio esperado:** una prueba que abra rutas del dashboard y falle ante loops de render, errores de consola o navegación que no se estabiliza.

**Riesgo:** bajo; no es necesario para apagar el incidente, pero sí para evitar recurrencia.

## 20. Mejoras posteriores

Estas mejoras **NO son necesarias para la corrección mínima del congelamiento** y no deben mezclarse con ella.

### 20.1 Inventory

Evaluar carga bajo demanda del catálogo completo usado por `RequisitionBuilder` en vez de traer todos los artículos elegibles en la entrada normal del directorio.

### 20.2 Kardex

Evaluar carga bajo demanda/búsqueda server-side de artículos y bodegas para formularios cuando el catálogo crezca.

### 20.3 Work Orders y Maintenance

Evitar traer todos los activos no retirados en la navegación inicial cuando el formulario de creación no está abierto, si mediciones reales confirman costo.

### 20.4 Assets

Medir por separado summary, facets, brands, models, categories y los tres catálogos `LIMIT 250`. Si las mediciones muestran cuello de botella, evaluar streaming/lazy sections o reducción de recorridos duplicados.

### 20.5 Suppliers

Medir agregados de directorio y definir paginación server-side solo si el volumen real lo requiere.

### 20.6 Instrumentación

Durante investigación de rendimiento:

- activar `DB_SLOW_QUERY_MS` en un entorno de diagnóstico;
- registrar duración de RSC navigation;
- registrar cantidad de requests;
- capturar React Profiler;
- capturar Performance/Long Tasks;
- observar memoria tras A→B→A repetido.

No fijar umbrales arbitrarios antes de medir baseline.

## 21. Plan de pruebas para la futura corrección

### 21.1 Navegación requerida

1. Dashboard → Assets.
2. Assets → Inventory.
3. Inventory → Work Orders.
4. Work Orders → Maintenance.
5. Maintenance → Suppliers.
6. Suppliers → Assets.

### 21.2 Ruta que cubre el hallazgo principal

1. Assets → Leads.
2. Leads → Inventory.
3. Inventory → Leads.
4. Leads → Work Orders.
5. Leads → Dashboard.

Verificar que la navegación se estabiliza y no aparecen renders continuos.

### 21.3 Repetición

Ejecutar al menos:

    Leads → Inventory → Leads → Inventory → Leads

y:

    Assets → Inventory → Work Orders → Inventory → Assets

### 21.4 Navegación rápida

Hacer clic rápidamente en varios módulos. Observar:

- si el indicador de loading progresa;
- si el Sidebar continúa respondiendo;
- si hay long tasks;
- si existen errores React;
- si requests previos son cancelados/ignorados correctamente.

### 21.5 Header

Validar:

- búsqueda client-side de Leads;
- filtros de estado;
- facets en Companies/Locations/Suppliers;
- serverState en Assets/Inventory/Work Orders/Maintenance;
- cambio Grid/Listado;
- contador visible.

### 21.6 Regresión

Probar:

- login;
- alcance de organización;
- alcance de sede;
- permisos;
- Header;
- Sidebar;
- Assets;
- Inventory;
- Kardex;
- Work Orders;
- Maintenance;
- Leads.

### 21.7 Performance

Registrar, sin establecer metas numéricas arbitrarias:

- navigation duration;
- RSC/request count;
- errores JS/React;
- long tasks;
- CPU durante transición;
- memoria antes/después de repetición;
- render count de `ModuleHeader`;
- tiempos de queries mediante instrumentación DB.

---

## Estado de la fase

**GLOBAL-NAV-01: diagnóstico completado.**

No se realizó ninguna implementación funcional. La corrección propuesta queda deliberadamente fuera de este commit para respetar el gate de diagnóstico.
