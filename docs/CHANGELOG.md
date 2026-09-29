# Changelog

## 2026-09-29 — Rediseño UX/UI · cuadrícula de Órdenes de trabajo

- El cambio se limita a la presentación **Cuadrícula** de Órdenes de trabajo. `StaticDataTable` y su vista Listado permanecen sin cambios.
- La cuadrícula usa dos tarjetas por fila en escritorio y una en pantallas pequeñas, con tarjeta blanca, borde/sombra sutil y elevación mínima en hover.
- Cada tarjeta presenta OT, estado, título, prioridad, Empresa, Ubicación, Activo/Equipo, Tipo de trabajo, Descripción, Fecha creación, Fecha requerida y Asignado a.
- Para los datos solicitados que ya existen en `work_orders`, el scope autorizado proyecta `description`, `created_at`, `due_at` y el ejecutor actual mediante `assigned_to`, `crew_id` o `service_supplier_id`. No cambia el orden RBAC → búsqueda → filtros → sort → paginación ni se crean endpoints/modelos.
- Ausencias se muestran explícitamente como **No asignado**, **Sin fecha**, **Sin asignar** o **No especificado** según corresponda.
- Las acciones conservan sus flujos existentes: **Ver actividades** enlaza al detalle actual; Editar/Eliminar siguen usando `OwnerRecordActions` y mantienen los permisos existentes.
- Se agrega en Grid el encabezado **Listado de órdenes de trabajo**, orden actual **Más recientes** y el contador de resultados de la página/consulta.
- `view-mode-toggle-smoke` protege la nueva tarjeta y, simultáneamente, los marcadores estructurales de la vista Listado para evitar regresiones.

## 2026-09-29 — Optimización visual · directorio de Proveedores

- Se retira del listado de Proveedores el bloque redundante **Directorio / Proveedores registrados / Abre una tarjeta...**.
- El contenedor del directorio deja de usar el margen superior legado de `.section`, de modo que las tarjetas suben y aprovechan mejor el espacio inmediatamente debajo del header del módulo.
- No se modifican tarjetas, búsqueda, filtros, selector Grid/List, acciones, datos, permisos ni lógica de Proveedores.

## 2026-09-29 — Corrección · detalle y edición de Leads

- Se corrige el colapso horizontal del detalle: el `Drawer` de Leads ahora prevalece sobre el ancho base del UI Kit con `width: min(900px, 92vw)` y un mínimo de escritorio equivalente a 650 px.
- La distribución principal usa columnas estables `minmax(360px, 1.4fr) / minmax(280px, 1fr)` y cambia a una sola columna antes de que puedan comprimirse; se elimina el corte letra por letra y se evita scroll horizontal.
- Header, identidad y tabs permanecen fuera del área desplazable; únicamente `.lead-detail-scroll` gestiona el scroll vertical del contenido.
- `OwnerRecordActions` deja de envolver el formulario compacto en un `Modal`. El formulario existente se renderiza directamente como única interfaz de edición, con X, Cancelar, Escape y Guardar cambios.
- En el drawer de Lead no se crea un segundo backdrop: la edición reutiliza el overlay ya activo del detalle. Desde tarjetas/listado, la misma edición compacta usa un único backdrop propio.
- Al guardar desde el detalle se conserva el `reload` existente para refrescar datos, pero se registra una clave temporal en `sessionStorage` y el drawer del Lead se reabre automáticamente con los valores actualizados.
- No se modifican endpoints, permisos, modelo `sales_leads`, formulario público, búsqueda, filtros, tarjetas, cuadrícula/listado, eliminación ni estados.

## 2026-09-29 — Detalle de Lead · drawer CRM

- La acción **Ver** deja el modal genérico y usa el `Drawer` existente del UI Kit, ampliado de forma aditiva con `className`, clases de header/body y un slot de acciones de cabecera.
- El drawer sigue abierto sobre el listado y adopta la referencia visual: título **Detalle del Lead**, avatar de iniciales, nombre, badge de estado, país, fecha de creación, pestañas Información general/Seguimiento y composición de dos columnas.
- Información general muestra únicamente datos persistidos en `sales_leads`: nombre, empresa, correo, teléfono, país, interés, necesidad, origen, creación, última actualización y estado.
- Seguimiento reutiliza el mismo formulario/endpoint de cambio de estado. Editar y Eliminar reutilizan `OwnerRecordActions` y la confirmación destructiva existente; no se amplían permisos.
- No se implementan Notas, Archivos ni un historial de eventos ficticio porque el modelo/endpoints actuales de Leads no los soportan. La pestaña Seguimiento muestra solamente `created_at` y `updated_at` como trazabilidad disponible.
- Se mantiene el detalle responsive: drawer amplio en escritorio, una columna en tablet y ancho completo en móvil.

## 2026-09-29 — Rediseño UX/UI · Leads CRM

- El módulo Leads conserva su `ModuleHeader`, búsqueda, filtros, selector Cuadrícula/Listado, creación y contador; no se modifican navegación lateral, endpoints, modelos, permisos ni formulario público de captación.
- Los cuatro KPI superiores se compactan y usan iconografía del UI Kit para Nuevos, Contactados, Calificados y Cerrados; no se inventan porcentajes históricos porque el módulo no dispone de ese dato.
- La sección **Listado de Leads** separa visualmente resumen y colección, conserva el orden real existente por fecha descendente y muestra el total cargado.
- Cuadrícula pasa a 3 tarjetas por fila en escritorio, 2 en resolución intermedia y 1 en móvil. Cada tarjeta usa `Avatar` con iniciales, nunca fotografías, y muestra únicamente Nombre, País, Empresa, Interés, Correo, Teléfono, necesidad registrada, Fecha y Estado/Seguimiento reales.
- La necesidad se presenta en un bloque independiente con truncamiento visual de dos líneas sin alterar el texto almacenado.
- Los estados conservan los valores `new/contacted/qualified/closed/discarded`, pero se presentan con etiquetas legibles en español y badges existentes.
- El seguimiento conserva el mismo `POST /api/leads/[id]/status`; la actualización se vuelve una acción compacta con icono y tooltip, sin auto-guardar ni cambiar opciones.
- Se añade **Ver** mediante el `Modal` existente del UI Kit y una lectura del mismo Lead; Editar/Eliminar reutilizan `OwnerRecordActions` y su confirmación actual. El modo compacto es aditivo y no cambia permisos: las acciones destructivas continúan exclusivas del Platform Owner.
- La vista Listado se alinea al mismo contrato: Lead, Estado, Empresa, Interés, Correo, Teléfono, Fecha, Seguimiento y Acciones.
- `view-mode-toggle-smoke` protege avatar sin foto, 3/2/1 responsive, preview, acciones compactas y continuidad Grid/List.

## 2026-09-29 — Ajuste visual · proporciones del directorio de Leads

- Se corrige la composición del directorio de Leads: el contenedor deja de aplicar una segunda grilla de dos columnas sobre `CollectionView`, evitando que la cuadrícula global comprima cada tarjeta a una fracción del ancho disponible.
- La vista Cuadrícula usa columnas específicas de 360–480 px en escritorio y una columna fluida en móvil; la vista Listado, búsqueda, filtros y preferencia Grid/List permanecen sin cambios.
- La tarjeta existente de Lead conserva los mismos datos y acciones, pero equilibra encabezado, badge, bloques de contacto, fecha, nota, selector de seguimiento y acciones del Platform Owner con alturas, separación y tipografía más legibles.
- El bloque de Fecha ocupa el ancho de la tarjeta en escritorio; correo, nombre y otros valores largos permiten wrap sin desbordar.
- No hubo cambios de API, PostgreSQL, RBAC, estados comerciales ni lógica de seguimiento.

## 2026-09-29 — Corrección de build · scope RBAC de Proveedores

- Se corrige el type-check de `app/api/suppliers/[id]/route.ts` introducido durante el endurecimiento del scope por empresa.
- `accessibleSupplier()` deja de fabricar un `QueryResult` parcial mediante un cast inseguro y ahora devuelve directamente la fila autorizada o `null`.
- Se conserva la validación server-side con `canAccessOrganization()`; no cambia el alcance funcional del módulo ni se relaja el aislamiento multiempresa.
- La corrección elimina el error TypeScript `TS2352` que detenía `npm run build` durante el despliegue.

## 2026-09-26 — Menú de usuario + Personalización de marca PRO

- El dropdown existente del avatar superior conserva Mi configuración, Manual / Ayuda y Configuración, añade **Personalización de marca · PRO** para Administradores de empresa y reemplaza el logout inmediato por confirmación explícita.
- `/dashboard/brand` es la única experiencia dedicada de marca por empresa; no se agrega al sidebar y no sustituye `/dashboard/personalization`, que continúa siendo la personalización global de plataforma.
- La edición PRO extiende la tabla y endpoint existentes `organization_branding` / `/api/organization-branding`: esquema, principal/secundario/acento, paleta automática, apariencia, densidad y logo compartido.
- Los esquemas Predeterminado, Fresco, Luminoso, Azul, Café, Ectoplasma, Medianoche, Océano, Amanecer y Personalizado alimentan un generador central de tokens; éxito, advertencia, error e información conservan sus tokens semánticos.
- El generador central calcula además foregrounds legibles para acciones y navegación y asegura contraste del sidebar; los tres colores de marca no sustituyen los colores semánticos.
- El shell consume tokens de empresa para sidebar, header, acciones, foco y elementos activos. La identidad permanece aislada por `organization_id`; Desweb es el fallback.
- Apariencia de empresa reutiliza el sistema `data-theme` existente y solo actúa como valor predeterminado cuando el navegador no tiene una preferencia personal `desweb-theme`. La migración 044 conserva el histórico predeterminado claro.
- Configuración general deja de contener un segundo editor de marca y enlaza a la experiencia dedicada. Planes y suscripciones no cambian: el endpoint sigue exigiendo Administrador + Plan Pro + white label.
- Mi configuración ahora presenta Perfil, Preferencias, Apariencia, Seguridad e Integraciones. El perfil utiliza el usuario autenticado y una mutación self-service que solo actualiza nombre, correo, teléfono y avatar propios; Seguridad conserva los flujos de credenciales existentes y no toca rol, empresa, membresías ni alcance.
- Manual / Ayuda conserva `lib/user-manual.ts` como fuente y añade categorías visuales sobre artículos reales; Video tutoriales queda deshabilitado cuando no existe contenido publicado.
- Se añadieron las migraciones `043_brand_personalization.sql`, `044_brand_personalization_light_default.sql` y `045_brand_legacy_scheme.sql`; esta última clasifica como Personalizado los colores white-label anteriores a los presets. También se añadieron estilos token-only y `scripts/brand-personalization-smoke.mjs`.
- La vista previa usa contexto real de la empresa (estado, sedes y una ciudad registrada) y no contiene KPIs ficticios. Clara/Oscura se aíslan del tema actual para que la comparación sea fiable.
- La eliminación del logo personalizado ahora se prepara localmente y se persiste atómicamente solo al pulsar **Guardar identidad visual**; Cancelar restaura el estado anterior. El servidor valida firma y dimensiones reales de PNG/JPG/WebP.
- Los tabs de marca soportan semántica ARIA y navegación por flechas/Home/End. Manual / Ayuda mantiene la categoría Video tutoriales explorable aunque no tenga contenido, mostrando un estado vacío en vez de inventar material.
- La apariencia de empresa actúa como valor heredado: abrir Mi configuración ya no crea automáticamente una preferencia personal; un valor explícito del usuario continúa teniendo prioridad.

## 2026-09-26 — Ajuste UX/UI · Ubicaciones + Reacción

- Ubicaciones conserva la cuadrícula aprobada, pero corrige la jerarquía visual: la fotografía sigue siendo protagonista y el logo de empresa queda como thumbnail de 48 px completamente dentro de la esquina superior izquierda de la foto; ya no cruza hacia el bloque de información. El badge Activa/Inactiva permanece arriba a la derecha.
- El modo Listado reutiliza `EntityIdentityCell` y ahora muestra en la primera columna la fotografía propia de cada sede mediante `/api/sites/[id]/image`; cuando no existe imagen usa el icono/placeholder institucional existente.
- La miniatura permanece en 44 px del UI Kit, por lo que la tabla conserva densidad, columnas, búsqueda/filtros, selector Cuadrícula/Listado y acciones existentes.
- Reacción mantiene el mismo `ReactionMap`, snapshot autorizado, filtros, marcadores, rutas, Google Maps, eventos y panel de alertas; el cambio es exclusivamente espacial.
- Reacción encapsula explícitamente únicamente `reaction-map-stage` + `reaction-side-panel` en el layout de dos columnas. El contenedor exterior deja de ser una grid multicolumna, por lo que no puede reservar una columna vacía: el mapa toma todo el ancho libre a la izquierda y Alertas permanece a la derecha.
- La barra de filtros pasa a ser un control flotante compacto sobre el mapa; el estado del mapa también se presenta como overlay ligero y el lienzo de Google Maps ocupa el 100% del área principal.
- En móvil el panel de alertas baja debajo del mapa sin scroll horizontal y el filtro se reorganiza en dos columnas.
- Los smoke tests de Fase 6/Business UI y Fase 9 protegen que el logo de Ubicaciones permanezca dentro de la foto, que Listado conserve su miniatura actual y que Reacción solo reserve columnas para mapa + alertas.
- No hubo cambios de consultas, endpoints, permisos, datos, marcadores, navegación ni lógica de alertas.

## 2026-09-26 — Fase 3 · Activos server-side

- El directorio de Activos migra de `LIMIT 600` + búsqueda/filtros DOM a búsqueda, filtros, orden y paginación server-side sobre todo el scope autorizado.
- Se conserva el scope existente: plataforma ve el conjunto global; usuarios tenant quedan limitados por organización y, cuando corresponde, por `session.siteIds`.
- La página visible contiene máximo 24 activos y Grid/List renderizan exactamente la misma colección; cambiar la vista no navega ni modifica `page`.
- KPI superiores, estados, criticidad, calidad del catálogo, marcas y modelos ya no se calculan desde `assets.rows`; usan agregados sobre el conjunto autorizado completo.
- `AssetCatalogOverview` mantiene su significado funcional pero recibe summary/marcas/modelos agregados en lugar de la página visible.
- Los conteos por categoría conservan la taxonomía de la organización y cuentan únicamente activos dentro del scope autorizado de sedes.
- Creación, edición, importación, exportación, mantenimiento, historial de OT y documentos permanecen en sus fuentes independientes y no dependen de las 24 filas visibles.
- URL: `q`, estado, empresa, sede, criticidad, categoría, proveedor, sort y page; búsqueda/filtros regresan a página 1.
- Nuevo `scripts/assets-server-pagination-smoke.mjs` valida página 2, búsqueda completa, filtros, COUNT, facetas, KPI, agregados de catálogo, no fuga y desacople de formularios/acciones.
- Filas máximas del directorio: 600 → 24 (96% menos filas de activos en la colección inicial). No se atribuyen mejoras de tiempo sin medición productiva.
- No hubo migraciones, índices, cambios de CSS global, Inventario, Ubicaciones, biometría, RUM ni deployment.

## 2026-09-26 — Fase 3 · Órdenes de Trabajo server-side

- Órdenes migra de `LIMIT 200` + filtros DOM a búsqueda, filtros y paginación server-side sobre todo el scope autorizado.
- Se preservaron literalmente los scopes plataforma, requester, provider, external e interno, incluyendo acceso limitado por sedes.
- Provider conserva asignación directa o mediante actividades; External conserva asignación directa, actividad individual o actividad de cuadrilla.
- KPI y facetas se calculan sobre el conjunto autorizado completo; la página visible contiene máximo 24 OT.
- URL: `q`, estado, empresa, sede, prioridad, tipo, sort y page. Búsqueda/filtros regresan a página 1.
- Grid/List continúa usando `CollectionView`; cambiar vista no navega ni consulta de nuevo.
- El catálogo de activos para creación continúa independiente.
- Smoke PostgreSQL valida scopes de todos los roles, ID conocido fuera de scope, búsqueda, COUNT, facetas y página 2.
- Filas máximas del directorio: 200 → 24. No se atribuyen mejoras de tiempo sin medición real.
- Base funcional validada: `8f3063d68d8882973a4b10b750a9eda38fa11f52`.

## 2026-09-26 — Auditoría de rendimiento · Fase 3 piloto Rutinas

- Rutinas migra de filtrado DOM sobre hasta 200 filas a búsqueda, filtros, orden y paginación server-side sobre el conjunto autorizado completo.
- La URL conserva `q`, estado, empresa, sede, frecuencia y página; búsqueda/filtros regresan a página 1.
- `ModuleHeader` añade un modo server-side opcional y mantiene sin cambios el modo DOM para módulos todavía no migrados.
- `UrlPagination` reutiliza el primitive `Pagination`; la página contiene 24 rutinas y `LIMIT/OFFSET` queda encapsulado en `routinePageWindow()`.
- Facetas y KPI se calculan sobre el scope RBAC completo, no sobre la página visible.
- `CollectionView` sigue siendo la única autoridad de Grid/List; cambiar vista no navega ni consulta nuevamente.
- El catálogo de activos de `RoutineCreateModal`, acciones por fila y permisos existentes permanecen.
- Smoke SQL con 30 rutinas demuestra búsqueda fuera de primera página, página 2, filtros combinados, COUNT/facetas completos y exclusión de una sede no autorizada.
- Filas máximas de rutinas transferidas inicialmente: 200 → 24. No se atribuyen mejoras de tiempo sin RUM/medición productiva.
- Base funcional validada: `c4f0ae2a40d66d54215cef2ae911ce20d68a5e6c`.

## 2026-09-26 — Auditoría de rendimiento · Fase 2 Proveedores

- El directorio de Proveedores deja de precargar hasta 600 actividades, 800 suministros, 600 requisiciones y 800 documentos.
- La carga inicial conserva identidad, filtros, acciones y conteos resumidos; los conteos se agregan una sola vez por tabla y respetan alcance tenant.
- Información general/financiera, Estadísticas, Actividades, Inventario, Requisiciones y Documentos cargan únicamente al abrir su pestaña.
- `SupplierDirectory` cachea cada vista por proveedor mientras la pantalla permanece montada, evitando requests duplicados al volver a una pestaña.
- Se reutilizaron `/api/suppliers/[id]` y `/api/suppliers/[id]/documents` mediante GET autorizados; los POST existentes no cambiaron.
- Grid/List, búsqueda, filtros, acciones rápidas, inventario, documentos, requisiciones y RBAC mantienen su comportamiento.
- Consultas iniciales de módulo, excluyendo el creation gate sin cambios: 15 → 4. Las cuatro colecciones detalladas pasan a 0 registros en el RSC inicial.
- Nuevo guard `scripts/performance-suppliers-phase2-smoke.mjs` incorporado a CI.
- No hubo migraciones ni cambios de modelo de datos.

## 2026-09-25 — Listados ERP con identidad visual y acciones rápidas

- El modo **Listado** deja de representar Empresas, Proveedores, Usuarios, Activos, Inventario y Leads como tarjetas de una sola columna; ahora utiliza `StaticDataTable` sobre la misma colección ya cargada.
- Se añadió `EntityIdentityCell` como primitive compartido: miniatura compacta de 40–44 px, nombre principal jerárquico e información secundaria. Soporta logo, avatar, thumbnail e icono/placeholder sin generar imágenes.
- Empresas usa exclusivamente el logo real existente o iniciales; Proveedores usa su logo; Usuarios su avatar; Activos e Inventario su imagen principal; Leads usa iniciales porque el modelo actual no expone una imagen relacionada. Leads reutiliza además `source` y `updated_at` ya existentes para mostrar Origen y Última actividad; no se inventó un Responsable porque el esquema no lo contiene.
- Cuadrillas conserva su tabla existente, pero la primera columna ahora usa la foto/avatar del líder como identidad principal; la columna Líder mantiene nombre y rol sin duplicar la foto.
- Ubicaciones conserva su estructura aprobada y cambia únicamente **Ver ubicación** a acción rápida compacta.
- Órdenes y Rutinas amplían sus SELECT existentes con `asset_id` y `asset_has_image`; usan la imagen real del activo/equipo cuando existe **y el rol tiene `assets.read`**, y el icono de Orden/Rutina como fallback en los demás casos. No se creó una consulta adicional.
- Las acciones rápidas del listado reutilizan únicamente operaciones ya existentes por módulo: abrir ficha/detalle, editar, requisición, WhatsApp, activar/desactivar, eliminar, actividades, proveedor, correo o acciones Owner según corresponda.
- La cuadrícula no fue modificada. `CollectionView`, búsqueda, filtros, estado, paginación, selección, RBAC y fuentes de datos permanecen compartidos entre ambas representaciones.
- `scripts/view-mode-toggle-smoke.mjs` protege ahora identidad visual, listas reales y acciones rápidas por módulo.
- No hubo migraciones, endpoints nuevos ni cambios de permisos.

## 2026-09-25 — Selector global Cuadrícula / Listado

- Se incorporaron `ViewModeToggle` y `CollectionView` al Shared Data UI como patrón oficial para alternar entre **Vista cuadrícula** y **Vista listado**.
- El selector cambia únicamente la presentación de la colección ya cargada: no crea endpoints, consultas, servicios ni fuentes de estado paralelas.
- `CollectionView` conserva la preferencia visual por módulo en el navegador y notifica a `ModuleHeader` para reaplicar búsqueda, estado y facetas después de cambiar de vista. Cuando existen dos renderizadores distintos, ambos permanecen montados y solo se oculta el inactivo para conservar selección, ordenamiento o paginación local.
- Empresas, Ubicaciones, Proveedores, Usuarios, Cuadrillas, Activos, Órdenes de trabajo, Rutinas/Mantenimiento, Inventario y Leads ya consumen el patrón compartido.
- Ubicaciones conserva sus tarjetas aprobadas en cuadrícula y añade una vista listado real con Ubicación, Empresa, Ciudad/País, Sububicaciones, Activos, Estado y acción **Ver ubicación** sobre la misma colección.
- Cuadrillas deja de mantener estado/selector visual privado y usa `CollectionView`; el `ViewModeToggle` compartido se monta dentro de su toolbar local y conserva sus filtros y ambas presentaciones existentes.
- Órdenes y Rutinas reutilizan las tarjetas y `StaticDataTable` que ya existían; el modo elegido por el usuario sustituye la antigua decisión automática desktop/mobile.
- Los módulos que solo poseían tarjetas reutilizan esas mismas tarjetas en una disposición de lista de una columna, sin duplicar CRUD, acciones ni datos.
- Se añadió `scripts/view-mode-toggle-smoke.mjs` a CI y se actualizaron los smokes de Fases 4, 7, 8 y 9.
- No hubo cambios de base de datos, RBAC, permisos ni modelos de dominio.

## 2026-09-25 — Documentos de Empresa · previsualización, gestión y visor completo

- La pestaña **Documentos** conserva `CompanyDocumentWorkspace` y los endpoints/documentos existentes; no se creó una pantalla, servicio ni fuente de datos paralela.
- El workspace diferencia tres niveles: selección de fila para previsualización contextual, tabla para gestión y **Ver documento** para abrir un visor amplio en el `Modal` oficial del UI Kit.
- La misma composición `DocumentViewer` se reutiliza en modo contextual y modal; PDF/imágenes conservan zoom, ajuste, rotación disponible, descarga e impresión.
- **Compartir documento** fue retirado del toolbar, filas y código exclusivo asociado sin alterar permisos generales ni servicios documentales compartidos.
- La tabla reduce las acciones visibles a **Ver / Descargar / Más acciones**; Descargar no cambia selección y Más acciones conserva el Drawer existente de edición, archivo/restauración y eliminación autorizada.
- El split de escritorio pasa a aproximadamente **40% previsualización / 60% listado**; en anchos intermedios usa **45% / 55%** y por debajo de 900 px mantiene Listado → Previsualización.
- El modal conserva el documento seleccionado, filtros y estado del listado al cerrarse; usa cierre X/Escape y gestión de foco del componente `Modal` existente.
- No hubo cambios de base de datos, endpoints, consultas, RBAC ni permisos.
- `scripts/company-documents-fullwidth-smoke.mjs` protege ahora el split, reutilización del visor, modal y retirada completa de Compartir.
- Corrección posterior: el estado interno de zoom, ajuste, rotación y carga vuelve a declararse dentro de `DocumentViewer`; esto corrige el fallo de TypeScript detectado en build y el smoke ahora protege ese contrato local.
## 2026-09-25 — Rediseño aprobado del directorio de Cuadrillas

- La vista principal de Cuadrillas adopta el layout aprobado sin crear una página, servicio, endpoint ni modelo paralelo.
- El header global y sus filtros continúan usando `ModuleHeader`; la acción de creación existente se presenta ahora como **Nueva cuadrilla** en el encabezado local.
- Se muestran métricas reales de cuadrillas registradas, activas e inactivas. No se inventa el estado **En pausa** porque el modelo actual de `crews` solo expone `active`.
- Se añadió `CrewDirectory` sobre la misma colección server-side para búsqueda por cuadrilla/líder/sede/descripción, filtro por sede/estado y cambio entre cuadrícula y listado.
- No se añadió filtro de disciplina porque Cuadrillas no posee actualmente ese dato.
- La cuadrícula usa 3 columnas en desktop, 2 en tablet y 1 en mobile.
- `CrewCard` fue rediseñada sobre el componente Business UI existente: se eliminó la fotografía grande, el líder queda compacto, la descripción real se trunca a dos líneas, las métricas conservan valores reales y los integrantes se muestran como avatares compactos con +N.
- WhatsApp, llamada y correo del líder siguen usando los datos actuales y muestran tooltips; las acciones de Propietario Desweb conservan edición/eliminación mediante el mecanismo existente.
- La vista listado reutiliza exactamente la misma colección y muestra cuadrilla, estado, sede, líder, integrantes, actividades, completadas y acciones.
- No se creó una navegación de detalle porque el repositorio no posee actualmente una ruta de detalle de Cuadrilla.
- Se añadió `scripts/crew-directory-redesign-smoke.mjs` y ejecución obligatoria en CI.

## 2026-09-25 — Documentos de Empresa a ancho completo

- La pestaña **Documentos** del perfil de Empresa oculta únicamente el sidebar interno de identidad/estadísticas/acciones rápidas mientras esa tab está activa.
- Se conservan separados el header global de Administración/Empresas y el header propio de Empresa.
- La barra de tabs existente y el content-card de Empresa se expanden al ancho disponible solo en Documentos.
- El mismo `CompanyDocumentWorkspace` conserva visor, selección sincronizada, buscador, filtros, tabla, estados, acciones y paginación; no se creó un segundo componente ni servicio documental.
- En escritorio el visor y listado aprovechan el espacio con un split equilibrado; en tablet se ajustan proporcionalmente y en móvil se conserva la disposición vertical.
- Las demás tabs de Empresa mantienen el layout anterior con sidebar.
- No se modificaron endpoints, permisos, modelos de datos ni lógica documental.
- Se añadió `scripts/company-documents-fullwidth-smoke.mjs` a CI.

## 2026-09-25 — Enrolamiento biométrico móvil con aprobación única

- El empleado puede iniciar su primera solicitud biométrica desde su propio celular; la solicitud por sí sola no habilita Asistencia.
- El flujo móvil exige leer la política biométrica vigente, aceptar tratamiento, autorizar cámara/ubicación, validar sede por GPS/geocerca y completar una prueba de vida activa.
- La prueba activa pide dos gestos aleatorios e incluye siempre un parpadeo; además se mantienen liveness y anti-spoof del motor facial existente.
- El backend vuelve a validar empresa, rol, sede, geocerca, precisión GPS, embedding y umbrales antes de crear una solicitud pendiente.
- Se añadió `attendance_biometric_policy_versions` para conservar la versión exacta del texto aceptado y `biometric_enrollment_requests` para solicitud, revisión y trazabilidad.
- La captura de enrolamiento utilizada para la comparación humana es cifrada y temporal: solo puede verse mientras la solicitud está pendiente, expira como máximo a las 72 horas y se elimina al aprobar, rechazar o expirar.
- La plantilla temporal de la solicitud también se elimina después de la decisión; el perfil permanente conserva únicamente la plantilla cifrada aprobada.
- El paso Enrolamiento de Asistencia se convirtió en una bandeja por excepción con KPIs de personal controlado, biometría verificada, pendientes y casos que requieren atención.
- La aprobación administrativa compara foto de perfil y captura temporal y ocurre una sola vez. Después de aprobar, las entradas/salidas usan validación facial 1:1, liveness/anti-spoof y GPS/geocerca automáticamente, sin aprobación humana diaria.
- El enrolamiento supervisor anterior permanece disponible como `Enrolamiento asistido excepcional` para recuperación y soporte.
- El expediente individual incorpora versión de política, consentimiento, sede/GPS, método de prueba de vida, estado de solicitud, aprobador, tiempos y notas de revisión sin exponer embeddings, preview decidido ni scores crudos.
- La ficha de Usuario ahora habla de `Gestionar enrolamiento` en lugar de asumir que el administrador debe capturar inicialmente a cada persona.
- Migración nueva: `040_biometric_self_enrollment_approval.sql`.
- Se añadió `biometric-enrollment-approval-smoke.mjs` y cobertura CI para privacidad, scope, aprobación única y compatibilidad con marcación diaria.

## 2026-09-25 — Rediseño UX de Asistencia en cinco pasos

- La administración de Asistencia se reorganizó en un flujo interno de **Configuración, Sedes, Enrolamiento, Política y Resumen** sin crear cinco páginas ni una implementación paralela.
- Se añadió `Stepper` como primitive reusable del UI Kit con estados activo/completado/pendiente, navegación accesible y scroll horizontal responsive.
- `AttendanceSetupWorkspace` muestra un único paso a la vez, Anterior/Siguiente, progreso circular y estado sincronizado de los cinco pasos.
- Configuración resume empresa, estado, parámetros y roles reales en modo lectura; la edición permanece exclusivamente en Política.
- Sedes reutiliza las geocercas existentes y enlaza a la ficha canónica de cada ubicación.
- El rediseño de cinco pasos nació reutilizando el flujo supervisor existente; el enrolamiento posterior evoluciona a solicitud móvil + aprobación única y conserva `SupervisedBiometricEnrollment` como recuperación excepcional.
- Política conserva el mismo formulario y endpoint; únicamente se preserva el paso de retorno tras guardar o validar errores.
- Resumen deriva su estado de datos actuales y no introduce una segunda mutación de “confirmación”.
- Presencia diaria, desplazamientos, expediente, contingencias y reporte Fase 5 pasan a la vista secundaria **Operación y reportes**, evitando que queden debajo de toda la configuración.
- Se corrigieron deep links desde Usuarios y Reportes para abrir directamente Enrolamiento, Expediente o Reporte en la vista correspondiente.
- Ese rediseño visual no modificó modelos ni reglas; la evolución biométrica posterior sí añade la migración 040 manteniendo RBAC, jornadas, contingencias y cálculos del reporte.
- Se añadió `scripts/attendance-setup-ux-smoke.mjs` y ejecución obligatoria en CI.

## 2026-09-25 — Asistencia operativa Fase 5: reporte programado vs. real

- Se reemplazó el antiguo bloque fijo de estadísticas de 30 días por un reporte operativo filtrable dentro de Asistencia.
- `lib/attendance-report.ts` compone jornadas programadas, marcaciones reales, segmentos en sede/desplazamiento, actividades, contingencias y evidencia Reacción sin crear una tabla paralela.
- El reporte admite periodos de hasta 366 días y filtros por persona y sede relacionada, siempre dentro del alcance autorizado.
- La diferencia programado/real se calcula solo sobre días con jornada individual activa; las horas reales en días no programados se muestran separadamente.
- Se muestran horas programadas, horas reales, tiempo en sede, tiempo de desplazamiento, jornadas multi-sede, actividades en/fuera de jornada, contingencias y muestras Reacción.
- Se distinguen días programados sin marcación y días con asistencia no programada como evidencia descriptiva para revisión humana, sin convertirlos en calificación laboral.
- Supervisores limitados por sedes no reciben trayectos parciales: una jornada multi-sede solo aparece si origen, sede final y todos los segmentos están dentro de su alcance.
- `GET /api/attendance/report` genera JSON, XLSX, CSV y PDF a partir del mismo dataset y filtros autorizados.
- Excel incluye Resumen, Personas, Detalle diario y Metadatos; CSV conserva el detalle diario completo y PDF ofrece una vista ejecutiva con marca autorizada.
- El Centro de Reportes enlaza directamente a `/dashboard/attendance?view=operation#attendance-report` y ya no duplica lógica SQL de Asistencia.
- Se añadió `scripts/attendance-reporting-smoke.mjs` y su ejecución en CI.

## 2026-09-25 — Asistencia operativa Fase 4: desplazamientos multi-sede

- Una jornada puede iniciar en una sede, desplazarse por otras sedes autorizadas y finalizar en una sede diferente sin crear múltiples turnos de asistencia.
- Migración `039_attendance_shift_segments.sql` añade `check_out_site_id` y segmentos ordenados `site` / `travel` con una sola sección abierta por jornada.
- Check-in normal y por contingencia crean el primer tramo de sede; checkout normal y por contingencia cierran la sede actual y conservan la sede final.
- El flujo de campo incorpora **Desplazamientos**: seleccionar destino, actividad opcional asignada, registrar salida del origen y registrar llegada al destino.
- Con geolocalización obligatoria, la salida valida la geocerca del origen y la llegada la del destino; una sede sin geocerca no puede usarse como destino en ese modo.
- Mientras existe un tramo `travel`, la jornada permanece abierta pero no puede cerrarse ni iniciar otro desplazamiento hasta registrar la llegada.
- Las actividades ejecutadas se vinculan contra el tramo de sede actualmente abierto, por lo que el trabajo posterior al traslado sigue perteneciendo a la jornada original.
- Una sesión reciente de Reacción puede quedar correlacionada con el desplazamiento; sus muestras GPS sirven como evidencia de trayecto sin convertirse en autoridad de Asistencia.
- Reacción muestra el destino activo del técnico cuando está en tránsito y el expediente individual incorpora KPI, pestaña y eventos de desplazamiento.
- Los supervisores con alcance parcial solo reciben un tramo de viaje cuando origen y destino están dentro de sus sedes autorizadas.
- Iniciar un traslado cancela contingencias de salida pendientes/aprobadas de la sede anterior para evitar autorizaciones obsoletas.
- El flujo de contingencia continúa cubriendo check-in/check-out; salida/llegada del desplazamiento utiliza la validación normal de ubicación cuando la política exige GPS.
- Se añadió `attendance-displacement-smoke.mjs` y ejecución dedicada en CI para integridad del modelo, autoridad del backend, UI, auditoría y correlación con Reacción.

## 2026-09-25 — Asistencia operativa Fase 3: expediente individual y auditoría

- Se añadió un expediente individual de Asistencia reutilizable desde Usuarios y desde el módulo Asistencia.
- El expediente organiza Resumen, Jornada, Marcaciones, Biometría, Contingencias y Trazabilidad en pestañas independientes.
- La nueva API de auditoría es de solo lectura y compone las fuentes autoritativas existentes; no se creó una segunda tabla de historial.
- Marcaciones muestra sede, duración, modo estándar/contingencia, precisión/distancia GPS y actividades finalizadas vinculadas a la jornada.
- Biometría expone estado y ciclo supervisado de enrolamiento/reenrolamiento/revocación sin devolver embeddings ni scores faciales/liveness crudos.
- Contingencias conserva motivo, estado, revisión, aprobación/uso y notas.
- Trazabilidad fusiona cronológicamente marcaciones, eventos biométricos, contingencias y cambios administrativos de jornada.
- Los supervisores tenant con alcance parcial solo pueden seleccionar personas y recibir evidencia de sus sedes autorizadas.
- La eliminación futura de una vigencia de jornada ahora conserva `base_site_id` en el evento de auditoría para mantener el filtrado por sede.
- Se añadió `scripts/attendance-audit-smoke.mjs` y ejecución obligatoria en CI.
- No se modificó la autoridad de `attendance_shifts`, enrolamiento biométrico ni revisión de contingencias; desplazamientos multi-sede permanecen para Fase 4.

## 2026-09-25 — Asistencia operativa Fase 2: jornadas individuales

- Se añadió `user_attendance_schedules` como línea de tiempo versionada de jornada esperada por persona.
- Cada vigencia guarda sede base, horario semanal por día, zona horaria, fecha de inicio/fin, notas y procedencia de plantilla.
- Los horarios de Empresa y Sede se pueden copiar como plantilla sin crear herencia viva; cambios posteriores en la fuente no reescriben la jornada individual.
- Las vigencias iniciadas o históricas no se editan ni eliminan retroactivamente; los cambios se programan mediante una nueva vigencia.
- Una nueva vigencia futura puede cerrar automáticamente la anterior el día previo, evitando superposición.
- Las mutaciones de la línea de tiempo se serializan en PostgreSQL y vuelven a validar empresa, usuario, sede base, sede plantilla y alcance de sedes.
- La pestaña **Asistencia** del Usuario permite administrar la jornada individual sin duplicar el módulo de asistencia.
- El módulo **Asistencia** incorpora el mismo administrador de jornadas para Admin/Manager/Propietario/Superadmin.
- El usuario de campo ve su horario programado para hoy; la sede base se usa como selección inicial cuando no existe una jornada abierta.
- El horario programado no bloquea marcajes reales fuera de la ventana prevista; esos eventos se conservan para comparación descriptiva posterior.
- Se añadió CI específico para migración, integridad, alcance, UI y regresiones de Fase 2.

## 2026-09-25 — Asistencia operativa Fase 1: contexto administrativo y biometría

- Propietario Desweb y Superadministrador pueden seleccionar explícitamente la empresa que administran desde `/dashboard/attendance`.
- Política de asistencia, enrolamiento biométrico supervisado, contingencias, geocercas y reportes quedan limitados al contexto de empresa seleccionado.
- El selector no amplía autorización: las mutaciones vuelven a validar empresa, usuario y sede en servidor; los usuarios de tenant siguen usando únicamente su organización autenticada.
- El enrolamiento y la revocación biométrica aceptan supervisión de un operador de plataforma autorizado dentro de ese contexto explícito.
- Cuando el bootstrap Platform Owner no tiene fila persistente de usuario, el evento biométrico conserva rol/email del actor en metadata auditable y deja `actor_user_id` nulo.
- La pestaña **Asistencia** de la ficha de Usuario ahora muestra estado de campo, alcance operativo y acciones contextuales para abrir Asistencia con empresa + persona preseleccionadas.
- El enlace contextual permite iniciar el enrolamiento inicial o administrar/reenrolar biometría sin volver a buscar al usuario.
- Se añadieron guardrails smoke para impedir regresiones del contexto multiempresa, del deep-link Usuario → Asistencia y del flujo biométrico administrativo.
- No se añadieron tablas ni migraciones en esta fase; horarios individuales y desplazamientos entre sedes permanecen para las siguientes fases funcionales.

## 2026-09-24 — Rediseño visual de la tarjeta real de Proveedores

- Se rediseñó el `SupplierCard` existente de Business UI; no se creó una tarjeta paralela ni se modificó el modelo de datos.
- La tarjeta organiza ahora estado y tipo, identidad/logo, ubicación/especialidad, contacto disponible, métricas y acciones en bloques visuales inspirados en la referencia aprobada.
- Estado conserva exclusivamente los valores reales actuales **Activo / Inactivo**.
- Los campos opcionales ausentes dejan de mostrar placeholders artificiales en el directorio; simplemente se omiten.
- Se mantienen las métricas reales del directorio: actividades abiertas, suministros activos y requisiciones abiertas.
- Las métricas incorporan iconos canónicos `UiIcon` y siguen calculándose desde las colecciones ya cargadas desde PostgreSQL.
- Se preservan las acciones existentes: Ver ficha, Editar, Crear requisición para proveedores de materiales/mixtos, WhatsApp cuando existe teléfono y Eliminar.
- Las acciones compactas incorporan tooltips descriptivos y accesibles sin alterar el layout.
- El botón **Ver ficha** pasa a ser la acción visual primaria manteniendo el mismo evento `open(s.id)` y la misma ficha en página.
- La tarjeta usa el logo real de `/api/suppliers/[id]/logo` y conserva iniciales como fallback.
- El CSS canónico vive en `app/business-ui.css`; `app/phase8-modules.css` solo controla la densidad del directorio.
- La nueva composición usa dos tarjetas por fila en escritorio estándar, tres únicamente en pantallas muy amplias y una en anchos reducidos para preservar legibilidad.


## 2026-09-24 — Gestión contextual de Ubicaciones, Documentos y Técnicos en Empresa

- Las pestañas **Ubicaciones**, **Documentos** y **Técnicos** del perfil rápido de Empresa aprovechan ahora el área de trabajo completa con datos reales del ERP.
- Ubicaciones muestra tarjetas de sedes y sububicaciones existentes, con acción contextual **Agregar** que reutiliza el flujo actual de ubicación principal/sububicación.
- Técnicos muestra tarjetas de técnicos vinculados, avatar, estado, alcance de sedes y accesos rápidos de contacto; **Nuevo técnico** reutiliza el creador de usuarios con la empresa y rol técnico preseleccionados.
- Documentos integra el `CompanyDocumentWorkspace` real en diseño 40/60: visor persistente, búsqueda, filtros, vigencia, tabla seleccionable y acciones rápidas.
- La previsualización sigue usando el endpoint existente de documentos y el visor PDF/imagen actual; no se añadieron tablas ni servicios paralelos.
- Se añadió **Cargar documento** mediante el endpoint existente y retornos contextuales seguros para reabrir Empresa y la pestaña correspondiente después de crear, editar, archivar o restaurar.
- `EntityProfileWorkspace` admite ahora una acción contextual por pestaña.
- Se añadió `app/document-workspace.css`, token-only, responsive y con reduced-motion.


## 2026-09-24 — Corrección visual de Técnicos y simplificación de Hoja de vida en Empresa

- Se corrigió la pestaña **Técnicos** del perfil rápido de Empresa con una tarjeta V2 separando descripción, estados y acción.
- Se añadieron indicadores de técnicos registrados, cupos disponibles y ocupación.
- Se eliminó la pestaña redundante **Hoja de vida** del perfil rápido; la exportación permanece disponible en la acción superior **Exportar**.
- Se añadió composición responsive específica para desktop, tablet y móvil.
- El cambio no modifica usuarios, técnicos, permisos, cuotas ni los endpoints de exportación.


## 2026-09-24 — Corrección visual de Documentos en perfil de Empresa

- Se corrigió la tarjeta **Expediente empresarial** de la pestaña Documentos del perfil rápido de Empresa.
- El texto descriptivo y la acción **Abrir expediente** ahora tienen áreas separadas y ya no se superponen.
- Se añadieron iconografía V2, estados de documentos vigentes/pendientes y composición responsive específica para desktop, tablet y móvil.
- El cambio es únicamente visual; la ficha empresarial completa y la autoridad de documentos permanecen sin cambios.


## 2026-09-24 — DESWEB Design System V2 Phase 10: Reports, Settings and final audit

### Added

- `/dashboard/reports` as a central reporting/export surface.
- Canonical `report`, `sun`, `moon` and `system` UiIcon names.
- Token-only `app/phase10-modules.css`.
- `scripts/phase10-final-smoke.mjs`.
- `scripts/design-system-final-audit.mjs`.
- `docs/DESIGN_AUDIT_FINAL.md`.

### Reports

- Added a stable `reports` navigation item and contextual header.
- Reused Dashboard Excel/CSV/PDF exports with URL filter parity.
- Reused Asset/Inventory/Kardex module exports.
- Linked existing Attendance, profile and Requisition report workflows without duplicating data or permissions.
- Updated the in-product manual for the new Reports workflow.

### Settings and Personalization

- Replaced remaining decorative Unicode module/theme icons with UiIcon.
- Migrated feedback to Alert, status to Badge, resource consumption to ProgressBar and primary actions to Button.
- Preserved global branding, organization white-label, Locale/Country defaults, procurement approval policy and light/dark/system persistence.

### Final audit

- Confirmed zero hardcoded hex colors in V2-owned stylesheets.
- Recorded/froze legacy `app/globals.css` baseline at 1,561 hex occurrences / 915 unique values and 190 `!important` declarations.
- Added CI guardrails against V2 hex regressions, legacy-baseline growth and duplicate external UI frameworks.
- Added responsive, focus-visible and reduced-motion contract checks.

### Integrity

- No database schema or API authorization changes.
- No reporting data model duplication.
- No RBAC, tenant/Site scope, procurement-policy or white-label persistence changes.

### Design System program

- Phases 0–10 are implemented.


## 2026-09-24 — DESWEB Design System V2 Phase 9: Maintenance operation

### Added

- Canonical Work Order/Activity/Priority presentation grammar in `components/maintenance-ui/OperationStatus.tsx`.
- Work Order detail StepProgress, ProgressBar and Timeline composition.
- Token-only `app/phase9-modules.css`.
- `scripts/phase9-maintenance-operation-smoke.mjs` and CI coverage.

### Maintenance

- Added V2 KPI for visible, active, overdue and upcoming routines.
- Migrated desktop routine directory to StaticDataTable.
- Migrated feedback/prerequisite iconography to V2 while retaining MaintenanceCard mobile records.

### Work Orders + Activities

- Added shared state/priority Badges across Business UI, desktop directory and detail.
- Added V2 KPI for active, in-progress, urgent and completed orders.
- Migrated desktop directory to StaticDataTable.
- Added descriptive process steps, activity completion progress, due-date risk and event Timeline.
- Migrated Activity execution cards to Card/Badge/Button/EmptyState patterns.
- Preserved Work Order/Activity POST APIs and server-authoritative transitions.

### Reaction

- Migrated global search and filters to Search/Select/Button.
- Migrated alert/date/priority/activity states to shared Badge grammar.
- Replaced the private contextual modal with the official Drawer.
- Replaced remaining Unicode interaction/contact glyphs with UiIcon.
- Preserved Maps overlays, technician routes, snapshot cadence and tracking-session semantics.

### Scoped metadata fix

- Provider/external Work Order directory queries now return organization, Site and type metadata already within the authorized query so ModuleHeader facets render correctly.

### Integrity

- No database, API-contract, state-machine, assignment, tracking, RBAC or tenant/Site-scope changes.

### Next

- Phase 10: Reports + Settings + final V2 audit.


## 2026-09-24 — DESWEB Design System V2 Phase 8: Suppliers + People + Attendance

### Added

- `CrewCard` Business UI composition.
- Server-row filter metadata support in `StaticDataTable`.
- Token-only `app/phase8-modules.css`.
- `scripts/phase8-suppliers-people-smoke.mjs` and CI coverage.

### Suppliers

- Preserved SupplierCard and Supplier profile identity.
- Migrated profile status, summary metrics, feedback and empty states to V2 primitives.
- Migrated commercial history tables to Shared Data UI grammar.
- Preserved Inventory/Supply, Requisition, Procurement, Return, Documents and Financial flows.

### Users

- Preserved UserCard and access-profile identity.
- Migrated directory/profile state, feedback and empty states to V2 primitives.
- Migrated statistics fallback and operational user analytics to V2 KPI/progress/status patterns.
- Replaced remaining modal/access-scope glyphs with canonical UiIcon.
- Preserved personnel documents, emergency contact, access scopes, Supplier links and exports.

### Crews

- Migrated directory cards to CrewCard.
- Preserved explicit leader selection, real member roles, Site eligibility and contextual communication actions.
- Replaced leader/status glyphs with canonical V2 icon/status patterns.

### Attendance

- Migrated module header, summary KPI, Site states and report table to V2.
- Migrated presence capture, supervised biometric enrollment and contingency feedback/actions/statuses to canonical primitives.
- Preserved GPS/geofence, liveness, consent, biometric encryption, supervised enrollment and one-use contingency authorization behavior.
- Attendance reporting remains descriptive and does not rank workers automatically.

### Integrity

- No database, API, RBAC, attendance-policy, biometric-threshold or privacy-boundary changes.
- No Supplier/User visual convergence: both retain distinct domain identities.

### Next

- Phase 9: Maintenance + Work Orders + Activities/Reaction.


## 2026-09-24 — DESWEB Design System V2 Phase 7: Assets + Inventory

### Added

- Official `AssetSubnav` with all approved Asset sections.
- Expanded official `InventorySubnav` with Reports and Configuration.
- `AssetCatalogOverview` for schema-safe derived Asset catalog views.
- Canonical `iconName` support in `CreateRecordModal`.
- Hash/query-aware active matching in `ModuleNavigation`.
- Token-only `app/phase7-modules.css`.
- `scripts/phase7-assets-inventory-smoke.mjs` and CI coverage.

### Assets

- Migrated list KPI to KpiCard/MetricGrid.
- Preserved AssetCard directory behavior and ModuleHeader filtering contracts.
- Added Types, Categories, Brands, Models, States, Maintenance, History, Documents and Configuration views.
- Migrated detail status/feedback/routine table to Badge, Alert, EmptyState and StaticDataTable.
- Preserved edit, Supplier, Site/Sub-location, routine and export flows.

### Inventory

- Migrated summary/detail KPI to V2 metrics.
- Added Reports and Configuration sections from live inventory data.
- Migrated categories and warehouses to Badge/StatTiles/Alert/EmptyState.
- Migrated Kardex tables to Shared Data UI table grammar and Badge states.
- Replaced movement glyphs with UiIcon.
- Integrated Bulk Import feedback/history status with Alert/Badge and canonical close icon.

### Integrity

- Kardex remains stock authority.
- Unified import validation/commit logic is unchanged.
- Requisition/Supplier/procurement reconciliation behavior is unchanged.
- No database, API, RBAC or tenant/Site-scope change.

### Next

- Phase 8: Suppliers + Users + Crews + Attendance.


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
