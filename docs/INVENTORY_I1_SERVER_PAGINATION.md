# Inventario I1 — paginación server-side del directorio

Fecha: 2026-09-26

## 1. Problema anterior y diagnóstico

El directorio principal de Inventario se resolvía directamente en el Server Component
`app/dashboard/inventory/page.tsx`; no existía un endpoint o server action separado
para cargar la colección. La consulta terminaba en:

`ORDER BY i.name LIMIT 600`

Luego `ModuleHeader` buscaba y filtraba en cliente sobre los registros que ya habían
llegado al DOM. Por definición, cualquier SKU posterior a esos 600 registros quedaba
fuera de búsqueda, filtros y conteo visible.

La misma colección `items.rows` alimentaba además:

- Grid y List;
- KPI de valor/stock;
- `RequisitionBuilder`.

Los catálogos de sedes, sububicaciones, proveedores, categorías y bodegas ya tenían
consultas independientes y no debían convertirse en colecciones paginadas.

## 2. Arquitectura I1

I1 mantiene el directorio como consulta directa del Server Component, siguiendo el
baseline aprobado en Activos. No se añadió una API paralela.

`lib/inventory-scope.ts` amplía el helper de I0 con `inventoryItemSqlScope()`, que
materializa en SQL exactamente la semántica vigente del producto:

- plataforma: todas las organizaciones;
- usuario de organización con `accessAllSites`: su organización;
- usuario limitado: su organización y `inventory_items.site_id IS NULL OR site_id IN session.siteIds`.

Para sesiones limitadas, la existencia visible sigue derivándose del scope físico de
I0 mediante `inventory_stock_levels -> inventory_warehouses -> site_id`.

El orden lógico de la consulta es:

`scope -> search -> filters -> sort -> COUNT -> LIMIT/OFFSET -> rows`.

## 3. Contrato del directorio

Los parámetros soportados son:

- `q`;
- `status` para estado de stock: all / ok / low / out;
- `organization`;
- `site`;
- `category`;
- `supplier`;
- `warehouse`;
- `record` para activo/inactivo;
- `sortBy`;
- `sortDirection`;
- `page`;
- `pageSize`.

`sortBy` se resuelve contra una lista blanca. La consulta nunca interpola un nombre
de columna recibido directamente del cliente. El orden siempre añade `id` como
desempate estable.

Tamaños de página aceptados en I1: 24, 40 y 80. Cualquier valor distinto cae al
tamaño seguro predeterminado de 24.

El estado equivalente del directorio es:

- `rows`: resultado SQL de la página;
- `page`: página canónica;
- `pageSize`: tamaño validado;
- `total`: `summary.filtered_count`;
- `totalPages`: `ceil(filtered_count / pageSize)`.

## 4. Búsqueda y filtros

La búsqueda server-side conserva los campos que el directorio buscaba previamente:

- SKU;
- nombre;
- descripción;
- empresa;
- sede;
- sububicación;
- categoría;
- bodega;
- proveedor.

Los filtros existentes también se ejecutan antes de `LIMIT/OFFSET`: stock,
organización, sede, categoría, proveedor, bodega y estado activo/inactivo.

## 5. COUNT, KPI y facetas

`summaryPromise` usa dos CTE conceptuales:

- `scoped`: universo completo autorizado;
- `filtered`: `scoped` después de búsqueda/filtros.

`filtered_count` representa el COUNT compatible con el directorio y nunca
`rows.length`.

Los KPI conservan su significado anterior —universo autorizado activo— y ahora se
calculan por agregado SQL sobre `scoped`, no sobre la página visible:

- valor total;
- productos en stock;
- stock bajo;
- sin stock;
- total de productos activos.

Las facetas también se obtienen del conjunto completo autorizado y no de la página.

## 6. Colecciones auxiliares

Sedes, sububicaciones, proveedores, categorías y bodegas continúan como catálogos
independientes; no fueron paginados.

`RequisitionBuilder` era una dependencia funcional del antiguo `items.rows`.
I1 lo separa mediante `requisitionItemsPromise`: recibe todos los productos
autorizados, activos y asociados a proveedores de materiales/mixtos, sin depender
de las 24/40/80 filas visibles.

Esto preserva la capacidad de seleccionar un producto válido aunque no esté en la
página actual.

## 7. UX

`ModuleHeader.serverState` controla búsqueda y filtros por URL y resetea únicamente
`page` cuando cambia el conjunto filtrado.

`UrlPagination` sigue siendo el paginador existente. I1 lo amplía de forma
retrocompatible con tamaño de página y total. Activos no cambia su contrato porque
los nuevos props son opcionales.

`CollectionView` continúa manejando Grid/List mediante estado local. Ambas vistas
reciben exactamente `items.rows`, es decir, la misma página server-side. Cambiar
Grid/List no navega, no cambia búsqueda/filtros y no cambia página.

## 8. Performance y transferencia de filas

Antes:

- el directorio transfería hasta 600 productos por render aunque solo se necesitaran
  unas decenas para visualizar;
- un registro 601+ era funcionalmente invisible para búsqueda/filtros del directorio.

Después:

- la consulta del directorio transfiere como máximo `pageSize` filas (24 por
  defecto);
- COUNT, KPI y facetas son agregados SQL independientes;
- búsqueda/filtros pueden localizar filas más allá de 600 y 1.000 registros.

`scripts/inventory-server-pagination-smoke.mjs` crea un fixture con 1.005 productos
autorizados, compara el número de filas transferidas por el patrón legacy
(`LIMIT 600`) contra la página server-side y registra tiempos reales de ambas
consultas en CI.

Medición del CI de implementación `fd0c06b98d2feef8eed210692520f8d63f0f6c42`:

- patrón legacy: 600 filas transferidas, 3.40 ms;
- página server-side: 24 filas transferidas, 2.65 ms.

Son observaciones del entorno CI sobre ese fixture; no se usan para afirmar un
speedup universal.

## 9. Pruebas

Se añade `scripts/inventory-server-pagination-smoke.mjs` y se incorpora al CI.

El smoke verifica:

- primera y segunda página;
- total, totalPages y pageSize;
- página fuera de rango;
- cambio de pageSize;
- búsqueda del producto 601;
- búsqueda que cruza páginas y búsqueda vacía;
- filtros y combinaciones;
- sort asc/desc y estabilidad;
- no fuga por sede, COUNT, búsqueda o manipulación de parámetros;
- KPI independientes de la página;
- selector de requisiciones independiente de la página;
- fixture superior a 1.000 productos;
- conservación en CI de los smoke de I0, Kardex, importación, requisiciones,
  devoluciones, Work Orders y Activos.

## 10. Archivos afectados

- `app/dashboard/inventory/page.tsx`;
- `lib/inventory-scope.ts`;
- `components/ui-kit/UrlPagination.tsx`;
- `scripts/inventory-server-pagination-smoke.mjs`;
- `.github/workflows/ci.yml`;
- `docs/INVENTORY_I1_SERVER_PAGINATION.md`.

## 11. Compatibilidad con I0

I1 no reemplaza la autorización de I0. El directorio comienza desde
`inventoryItemSqlScope(session)` y la cantidad física de sesiones limitadas sigue
usando únicamente bodegas autorizadas.

`scripts/inventory-scope-smoke.mjs` permanece como regresión permanente.

## 12. Decisión de dominio pendiente

I1 no resuelve ni modifica de forma irreversible la relación entre:

`inventory_items.site_id`

y:

`inventory_stock_levels -> inventory_warehouses -> site_id`.

El producto maestro conserva la semántica legacy aprobada en I0 y el stock físico
continúa limitado por bodega/sede.

## 13. CI y build

Commit de implementación validado:

`fd0c06b98d2feef8eed210692520f8d63f0f6c42`

GitHub Actions: **success**.

Pasaron, entre otros:

- `inventory-server-pagination-smoke.mjs`;
- `inventory-scope-smoke.mjs`;
- `inventory-kardex-smoke.mjs`;
- `unified-inventory-import-smoke.mjs`;
- `requisition-receipt-smoke.mjs`;
- `supplier-return-smoke.mjs`;
- `work-orders-server-pagination-smoke.mjs`;
- `assets-server-pagination-smoke.mjs`;
- `phase7-assets-inventory-smoke.mjs`;
- `npm run build`;
- `performance-build-report.mjs`.

El build terminó exitosamente y no fue necesario modificar Work Orders, Activos,
CSS global ni migraciones estructurales.
