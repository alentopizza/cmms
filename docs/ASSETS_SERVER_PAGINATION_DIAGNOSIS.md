# Fase 3 — Diagnóstico server-side de Activos

Fecha: 2026-09-26  
Estado: diagnóstico previo a implementación  
Alcance: `/dashboard/assets` y dependencias directas del módulo. No incluye Inventario, Ubicaciones, CSS global, índices, biometría, RUM ni deployment.

## 1. Scope RBAC actual

La entrada del directorio exige `assets.read`.

El listado actual aplica tres ramas:

1. Plataforma (`platformRole !== "user"`): puede leer todos los activos.
2. Usuario tenant con `accessAllSites=true`: `a.organization_id = session.organizationId`.
3. Usuario tenant con alcance limitado: misma organización + `a.site_id = ANY(session.siteIds)`.

No existen ramas especiales de requester/provider/external dentro del directorio de Activos; todos consumen el mismo scope anterior si poseen `assets.read`.

La creación, importación y edición exigen `assets.write`. La exportación exige `assets.read`.

## 2. Colección principal actual

`app/dashboard/assets/page.tsx` construye `assets.rows` con:

- organización;
- sede;
- sububicación;
- categoría;
- proveedor;
- código/nombre;
- estado;
- criticidad;
- fabricante/modelo/serial;
- indicador de imagen.

Orden actual: `a.created_at DESC`.

Límite actual: `LIMIT 600`.

La misma colección se usa para Grid y List.

## 3. Búsqueda y facetas actuales

La búsqueda se ejecuta en cliente sobre las filas ya cargadas. Campos:

- código;
- nombre;
- empresa;
- sede;
- sububicación;
- categoría;
- proveedor;
- estado;
- criticidad;
- fabricante;
- modelo.

Filtro principal: estado.

Facetas actuales:

- organización;
- sede;
- criticidad;
- categoría;
- proveedor.

Consecuencia actual: búsqueda, filtro y facetas solo conocen las primeras 600 filas cargadas.

## 4. KPI actuales

Los KPI superiores se calculan directamente desde `assets.rows`:

- total;
- operativos;
- en mantenimiento;
- fuera de servicio;
- porcentajes correspondientes.

Por tanto, hoy también quedan truncados por `LIMIT 600`.

Estos KPI necesitan el conjunto completo autorizado, no la página visible.

## 5. Dependencias de assets.rows

Dependencias directas encontradas:

- Grid de tarjetas;
- Listado;
- contador del `ModuleHeader`;
- KPI superiores;
- `AssetCatalogOverview.assets`.

Las acciones por fila (`Ver detalles` y `OwnerRecordActions`) solo necesitan la fila visible correspondiente.

No existe selección múltiple ni acción masiva en el directorio actual.

## 6. AssetCatalogOverview

El componente recibe actualmente la colección completa de `assets.rows` y calcula:

### Datos derivados de activos

- marcas distintas y cantidad por marca;
- modelos distintos (fabricante + modelo);
- conteos por estado;
- porcentaje por estado;
- activos críticos;
- activos con categoría;
- activos con fabricante;
- activos con modelo;
- criticidad alta/crítica.

Clasificación para migración:

- marcas + cantidad: agregado SQL sobre scope autorizado;
- modelos: `DISTINCT` SQL sobre scope autorizado;
- estados/porcentajes: agregado SQL sobre scope autorizado;
- criticidad: agregado SQL;
- calidad del catálogo: agregado SQL.

Ninguno de esos indicadores necesita conservar 600 filas completas en memoria.

### Datos que ya vienen de fuentes independientes

- categorías/tipos: consulta propia a `asset_categories`;
- rutinas asociadas: consulta propia a `maintenance_plans`;
- historial de órdenes: consulta propia a `work_orders`;
- documentos: consulta propia a `attachments`.

Estos bloques no deben depender de la página visible.

## 7. Categorías

`catalogCategories` es un catálogo organizacional independiente de la lista visible.

Hallazgo: para un usuario tenant limitado por sedes, la consulta actual filtra las categorías por organización, pero `asset_count` cuenta todos los activos de la organización asociados a la categoría, incluso activos en sedes fuera del scope del usuario.

La migración debe conservar el catálogo de categorías de la organización, pero calcular `asset_count` contra el scope autorizado de activos para evitar que el resumen revele cantidades fuera del alcance.

## 8. Colecciones auxiliares de creación

La creación no depende de `assets.rows`.

`AssetCreateModal` recibe consultas separadas:

- sedes;
- sububicaciones;
- proveedores.

Para usuarios limitados, sedes y sububicaciones ya se restringen por `session.siteIds`. Proveedores son organizacionales y no tienen scope por sede.

Estas colecciones deben permanecer independientes de la paginación.

## 9. Edición / ficha individual

`/dashboard/assets/[id]` carga el activo directamente por ID y luego valida organización + `canAccessSite` para usuarios tenant.

La edición usa consultas propias de:

- sedes;
- sububicaciones;
- proveedores;
- categorías;
- rutinas.

No depende de `assets.rows` del directorio.

El POST de edición exige `assets.write` y valida la sede destino mediante `canAccessSite`.

## 10. Mantenimiento

El resumen del catálogo consulta `maintenance_plans` por separado, con:

- plataforma: todos;
- tenant completo: organización;
- tenant limitado: organización + sede del activo.

Límite actual: 250 filas.

La ficha individual consulta las rutinas por `asset_id`.

La paginación del directorio no debe modificar estas fuentes.

## 11. Historial de OT

El resumen del catálogo consulta `work_orders` unido al activo:

- plataforma: todos;
- tenant completo: organización;
- tenant limitado: organización + sedes autorizadas.

Límite actual: 250.

No depende de `assets.rows` y debe conservarse separado.

## 12. Documentos

El resumen del catálogo consulta `attachments` unido al activo:

- plataforma: todos los adjuntos asociados a activos;
- tenant completo: organización;
- tenant limitado: organización + sede del activo.

Límite actual: 250.

No depende de la página visible.

## 13. Exportación

`ModuleExportMenu entity="assets"` llama `/api/module-export?entity=assets`.

El endpoint:

- exige `assets.read`;
- vuelve a consultar directamente PostgreSQL;
- usa el mismo scope plataforma / organización / sedes;
- no depende del DOM ni de `assets.rows`;
- exporta XLSX, CSV o PDF.

La exportación debe permanecer independiente de la página visible.

## 14. Importación masiva

`BulkImportModal entity="assets"` usa `/api/bulk-import`.

El endpoint:

- exige `assets.write`;
- carga catálogos propios;
- valida el archivo completo;
- en commit revalida cada sede con `canAccessSite(session, site.id)`;
- crea/actualiza por código dentro de la organización;
- no depende de la colección visible.

La plantilla también es un endpoint independiente.

No se conectará importación con la nueva página paginada.

## 15. Acciones por fila

Grid y List comparten las mismas entidades visibles.

Acciones actuales:

- abrir ficha del activo;
- acciones de propietario mediante `OwnerRecordActions`.

No existe acción masiva sobre la colección.

Solo requieren la fila visible, no el catálogo completo.

## 16. Separación objetivo

### Solo página visible

- tarjetas Grid;
- filas List;
- acciones por fila;
- identidad/imagen de cada fila.

### Conjunto completo autorizado

- total del módulo;
- KPI por estado;
- facetas;
- marcas;
- modelos;
- estados y porcentajes de `AssetCatalogOverview`;
- criticidad;
- indicadores de calidad;
- conteo por categoría.

### Fuentes auxiliares independientes

- sedes/sububicaciones/proveedores para creación;
- catálogos de edición;
- mantenimiento;
- historial de OT;
- documentos;
- exportación;
- importación.

## 17. Diseño server-side propuesto

Un único scope SQL autorizado será la base de:

1. summary/KPI;
2. facetas;
3. agregados de catálogo;
4. página visible.

Orden obligatorio:

**scope autorizado → búsqueda → filtros → sort → LIMIT/OFFSET**

Estado URL propuesto:

- `q`;
- `status`;
- `organization`;
- `site`;
- `criticality`;
- `category`;
- `supplier`;
- `sort`;
- `page`.

Página: 24 registros, reutilizando `ModuleHeader.serverState`, `UrlPagination`, `Pagination` y `CollectionView`.

El sort inicial conservará la semántica actual: `created_at DESC` con `id DESC` como desempate estable.

## 18. Riesgos a comprobar

- KPI no pueden derivarse de las 24 filas.
- `AssetCatalogOverview` no puede recibir solo la página.
- Facetas no pueden construirse desde el DOM paginado.
- categorías no deben contar activos fuera del scope de sedes.
- Grid/List deben renderizar exactamente la misma página.
- cambiar Grid/List no debe tocar URL/página.
- creación/edición/importación/exportación no deben depender de la página.
- mantenimiento/historial/documentos deben conservar consultas independientes.
- búsqueda de un activo de página 2+ debe encontrarlo.
- ningún filtro/COUNT/faceta/agregado puede ampliar el scope.

## 19. Fuera de alcance

No se modificarán en esta fase:

- Inventario;
- módulo Ubicaciones;
- CSS global;
- índices PostgreSQL;
- biometría;
- RUM;
- deployment.

Si una consulta demuestra necesidad de índice, se documentará para Fase 5 y no se añadirá por intuición.
