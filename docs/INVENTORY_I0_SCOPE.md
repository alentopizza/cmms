# Inventario I0 — Seguridad, scope y no-fuga

Fecha: 2026-09-26

## Alcance

I0 corrige únicamente autorización server-side y exposición de datos por organización/sede.
No modifica paginación, `LIMIT 600`, semántica de Work Orders, Activos, reservas,
consumo OT, FEFO, lotes ni el modelo estructural de Inventario.

## Regla aplicada

Se reutiliza `canAccessSite` y se centraliza la semántica específica de Inventario
en `lib/inventory-scope.ts`.

- Producto maestro: mantiene el modelo actual. Tenant debe pertenecer a la misma
  organización; con scope limitado, `inventory_items.site_id` debe ser una sede
  autorizada. Un `site_id=NULL` legacy continúa siendo organizacional durante I0.
- Bodega física: tenant debe pertenecer a la misma organización y, con scope
  limitado, `inventory_warehouses.site_id` debe existir explícitamente en
  `session.siteIds`. Una bodega sin sede no constituye autorización física.
- Stock: para sesiones limitadas se suma únicamente desde
  `inventory_stock_levels -> inventory_warehouses -> site_id autorizado`.
- Transferencia: origen y destino deben estar ambos dentro del scope.
- Plataforma / tenant con `accessAllSites`: conserva el comportamiento existente.

## Diagnóstico y corrección por superficie

| Superficie | Riesgo previo | I0 |
| --- | --- | --- |
| Warehouse listado | tenant filtraba solo organización | filtra `w.site_id` |
| Warehouse toggle/update | ID conocido podía omitir sede actual | valida bodega actual antes de mutar |
| Producto edit/toggle | validaba solo organización | valida organización + site master |
| Imagen producto | validaba solo organización | valida organización + site master |
| Alta producto | `warehouse_id` solo validaba organización | exige bodega autorizada y coherente con sede/sububicación |
| Movimiento manual | bodega origen/destino solo organización | valida scope físico de ambas |
| Transferencia | destino podía ser otra sede no autorizada | ambos extremos deben estar autorizados |
| Resumen movimientos | mostraba toda la organización | origen/destino quedan scoped |
| Detalle stock | mostraba todas las bodegas del SKU | stock, selectors e historial físico quedan scoped |
| KPI detalle/listado | `i.quantity` podía incluir otra sede | cantidad visible se deriva de bodegas autorizadas |
| Categorías | catálogo correcto, métricas globales | catálogo org + métricas scoped |
| Supplier Inventory | devolvía inventario/catálogos de toda la org | replica scope de Inventario |
| Plantilla importación | catálogos/current data globales | para Inventory se filtran por siteIds |
| Import validate/commit | catálogo de bodega/item global | catálogo scoped + guardas de commit |
| Requisition receipt/return | bodega NULL era aceptada para usuario limitado | exige site explícito autorizado |
| Export | cantidad/Kardex podían ampliar scope físico | stock y bodega/Kardex respetan siteIds |

## Ambigüedad de dominio pendiente

I0 no resuelve la contradicción entre:

- `inventory_items.site_id` como sede maestra;
- `inventory_stock_levels -> inventory_warehouses.site_id` como ubicación física.

Una transferencia entre sedes puede dejar el SKU maestro en una sede mientras el
stock físico queda en otra. I0 evita que esto produzca fuga de información:
la visibilidad del maestro conserva el scope existente y la información física se
recorta por bodega autorizada.

La decisión irreversible sobre producto maestro organizacional vs artículo por
sede queda pendiente para una fase posterior.

## Smoke

`scripts/inventory-scope-smoke.mjs` combina fixtures SQL multiempresa/multisede
con contratos estáticos de rutas y superficies. Cubre los veinte casos definidos
por I0: permiso, organización completa, A1, A2, otro tenant, bodega, transferencia
origen/destino, producto, stock, movimiento, imagen, edición, toggle, Supplier
Inventory, importación, KPI/resumen, conteos, exportación y aislamiento tenant.

El smoke se ejecuta en CI inmediatamente después de `inventory-kardex-smoke.mjs`.
