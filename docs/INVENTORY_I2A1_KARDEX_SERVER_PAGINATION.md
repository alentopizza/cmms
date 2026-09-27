# Inventario I2-A1 — Kardex server-side

Fecha: 2026-09-27  
Estado: **implementación controlada de I2-A1**.

## 1. Problema anterior

El Kardex general en `app/dashboard/inventory/kardex/page.tsx` consultaba directamente `inventory_transactions`, ordenaba por fecha y aplicaba `LIMIT 1000`. Después, `ModuleHeader` ejecutaba búsqueda y facetas en cliente sobre las filas montadas en el DOM.

Esto no limitaba el almacenamiento ni el procesamiento de movimientos. Limitaba solamente la lectura del directorio general.

> El `LIMIT 1000` nunca fue un límite de almacenamiento ni de registro de movimientos. Era un límite de lectura de la consulta del Kardex general.

Un movimiento posterior al registro 1.000 podía existir, haber actualizado correctamente el stock y no ser localizable desde la búsqueda del Kardex porque no había sido transferido a la página.

## 2. Fuentes de verdad preservadas

I2-A1 no cambia el motor transaccional:

- `inventory_transactions` continúa siendo el único Kardex;
- `inventory_stock_levels` continúa siendo la autoridad de stock físico por bodega;
- `cmms_apply_inventory_transaction()` continúa aplicando movimientos;
- no se agregaron tablas, migraciones, triggers ni rutas de escritura.

## 3. Arquitectura anterior

```text
scope
→ ORDER BY
→ LIMIT 1000
→ navegador
→ búsqueda client-side
→ filtros/facetas client-side
```

## 4. Arquitectura nueva

```text
scope I0
→ search
→ filters
→ sort allow-listed
→ COUNT
→ LIMIT/OFFSET
→ página
```

La página usa un CTE `scoped` como universo autorizado y aplica después búsqueda y filtros. El `COUNT` y las filas visibles nacen del mismo conjunto filtrado.

## 5. Parámetros

El Kardex general reconoce:

- `q`;
- `type`;
- `organization`;
- `site`;
- `supplier`;
- `warehouse`;
- `sortBy`;
- `sortDirection`;
- `page`;
- `pageSize`.

Tamaños admitidos: 24, 40 y 80. El tamaño por defecto es 24.

## 6. Scope

La consulta reutiliza `inventoryItemSqlScope(session)` desde `lib/inventory-scope.ts`.

Para sesiones limitadas conserva además la regla física vigente de I0:

- bodega origen dentro de `session.siteIds`;
- bodega destino, cuando existe, dentro de `session.siteIds`;
- semántica legacy del producto con `site_id IS NULL`.

Los parámetros de URL se aplican después del CTE autorizado y no pueden ampliar su universo.

I0 no fue modificado.

## 7. Búsqueda

La búsqueda pasó al servidor y conserva los campos que formaban el `data-search` previo:

- SKU;
- producto;
- documento;
- `source_movement_id`;
- importación;
- proveedor;
- bodega origen;
- bodega destino;
- lote;
- centro de costo;
- usuario;
- requisición;
- devolución a proveedor.

El smoke agrega más de 1.000 movimientos y verifica que `I2-KARDEX-1001`, deliberadamente fuera del antiguo primer bloque de 1.000, sea recuperable.

## 8. Filtros

Continúan disponibles y ahora se ejecutan en PostgreSQL:

- tipo;
- organización;
- sede;
- proveedor;
- bodega.

No se agregaron filtros de fecha, categoría, Work Order, usuario, documento, lote o vencimiento.

## 9. Ordenamiento

`sortBy` utiliza una lista blanca:

- `date`;
- `item`;
- `type`;
- `quantity`;
- `cost`.

`sortDirection` solo admite `asc` o `desc`.

El `id` se usa como desempate para estabilizar las fronteras entre páginas. El orden por defecto conserva la intención anterior: fecha descendente.

## 10. COUNT

El contrato del directorio queda compuesto por:

```text
rows
page
pageSize
total
totalPages
```

`total` proviene de `COUNT(*)` sobre `scope + search + filters`, nunca de `rows.length`.

## 11. Paginación

El Kardex general dejó de depender funcionalmente de `LIMIT 1000`.

Usa `UrlPagination`, el mismo componente ya utilizado por I1, con `LIMIT pageSize OFFSET offset`.

Búsqueda, tipo y facetas reinician `page` mediante el modo server-side existente de `ModuleHeader`. Cambiar solo página o tamaño conserva el resto del estado URL.

## 12. Vista

El Kardex actual es una tabla y no posee un selector Grid/List. I2-A1 no inventó una segunda vista ni una segunda consulta.

Todas las filas visibles proceden de una única página server-side.

## 13. Facetas

Las opciones de:

- organización;
- sede;
- proveedor;
- bodega

se calculan desde el CTE `scoped`, no desde las 24/40/80 filas de la página actual.

Esto evita que la paginación reduzca artificialmente las opciones disponibles y mantiene las facetas dentro del universo autorizado.

## 14. Exportación

No se rediseñó `GET /api/module-export?entity=kardex`.

Se conservan XLSX, CSV y PDF y no se introdujo `LIMIT 1000` en exportación.

Continúa pendiente que exportar reproduzca exactamente la búsqueda y todas las facetas visibles; I2-A1 no cambia ese contrato.

## 15. Historial individual

`app/dashboard/inventory/[id]/page.tsx` conserva su `LIMIT 200`.

Ese historial no forma parte del directorio Kardex general y queda expresamente fuera de I2-A1.

## 16. Pruebas

Se agregó:

`scripts/inventory-kardex-server-pagination-smoke.mjs`

El fixture crea 1.005 movimientos autorizados más movimientos de otra sede y otra organización. Valida:

- primera y segunda página;
- COUNT;
- 24/40/80 por página;
- página fuera de rango;
- búsqueda de movimiento >1.000;
- búsqueda vacía;
- ASC/DESC;
- estabilidad de frontera;
- filtro de tipo;
- filtro de proveedor;
- filtro de bodega;
- aislamiento de sede/organización;
- facetas;
- manipulación de filtros/página/pageSize.

El smoke se incorpora a CI sin retirar regresiones existentes.

## 17. Performance

El smoke mide en el mismo fixture de CI:

```text
legacy: LIMIT 1000
nuevo:  LIMIT pageSize (24)
```

Registra filas transferidas y tiempo observado para ambas consultas. Los milisegundos son observaciones del entorno CI y no se documentan como benchmark universal.

La reducción determinista de filas transferidas en la primera página del fixture es de 1.000 a 24 (97,6%). No se agregaron índices ni migraciones de performance.

## 18. Riesgos residuales

I2-A1 no intenta resolver:

- idempotencia de movimientos manuales;
- invariantes DB organización/artículo/bodega;
- inmutabilidad de `inventory_transactions`;
- scope de lectura de Requisiciones;
- justificación obligatoria de ajustes;
- saldo por lote/FEFO;
- valoración formal;
- historial individual `LIMIT 200`;
- integración operacional con Work Orders.

## 19. Trabajo pendiente

### I2-A2

Reservado para el siguiente alcance aprobado. I2-A1 no lo inicia.

### I2-B

Mejoras de consistencia/auditabilidad que requieran aprobación posterior.

### I2-C

Lotes, valoración u otras capacidades posteriores según priorización.

### I3

Work Orders e Inventario:

- reserva;
- consumo;
- devolución de sobrantes;
- costo real de materiales.

I2-A1 no modifica Work Orders.
