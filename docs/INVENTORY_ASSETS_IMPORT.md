# Inventario, Activos, Kardex e importación masiva

Checkpoint funcional: 2026-09-24.

## Objetivo

Los módulos **Inventario** y **Activos** soportan operación individual y carga masiva desde Excel. La carga masiva no escribe directamente al recibir el archivo: primero ejecuta una validación completa, muestra errores/advertencias por fila y solo permite confirmar cuando no existen errores bloqueantes.

El flujo de Inventario mantiene trazabilidad mediante movimientos de Kardex; el stock inicial también se registra como una entrada y no como una modificación silenciosa del saldo.

## Archivo de referencia revisado

Se revisó una plantilla con las hojas:

- `LEEME`
- `Productos`
- `Proveedores`
- `Kardex`
- `Bodegas`
- `Listas`
- `Resumen`

La estructura es útil como base. El importador acepta `Productos` como alias de la hoja estándar `Inventario`, además de `Kardex` y `Bodegas`.

### Mapeo de Productos / Inventario

| Excel | CMMS |
| --- | --- |
| Item / Código / SKU | `inventory_items.sku` |
| Proveedor | relación con `suppliers` |
| Tipo proveedor | usado para separar servicios de existencias |
| Nombre producto/servicio | `inventory_items.name` |
| Descripción | `description` |
| Categoría | `inventory_categories` |
| Presentación | `presentation` |
| Unidad | `unit` |
| Cantidad base / Stock inicial | entrada inicial en Kardex para artículos nuevos |
| Valor unitario | `unit_cost` |
| Stock mínimo | `min_quantity` |
| Stock máximo | `max_quantity` |
| Ubicación / Bodega | `inventory_warehouses` |
| Activo | `active` |

Las filas declaradas como **Servicios tercerizados** se omiten del inventario con advertencia; no bloquean la carga completa. Los proveedores de inventario deben existir en el CMMS y estar habilitados para materiales o modalidad mixta.

### Mapeo de Bodegas

La hoja `Bodegas` permite crear o actualizar almacenes:

- Código / ID bodega
- nombre
- tipo
- sede
- sububicación
- ubicación detalle
- responsable
- capacidad
- estado
- observaciones

Si la hoja original no indica sede/sububicación y la organización solo tiene una opción, el importador puede inferirla. Una bodega también puede existir como almacén global cuando el archivo histórico no contiene suficiente detalle físico.

### Mapeo de Kardex

El importador reconoce:

- Fecha
- Tipo movimiento
- Documento
- Código / SKU
- Proveedor
- Bodega origen
- Bodega destino
- Cantidad, o columnas Entrada / Salida
- Costo unitario
- Lote
- Vencimiento
- Centro de costo
- Usuario origen
- Observaciones

Tipos válidos: Entrada, Salida, Ajuste positivo, Ajuste negativo, Devolución y Traslado.

El usuario real que confirma la importación queda como `created_by`. Si el Excel contiene una columna Usuario, se conserva como dato de origen dentro de la nota de auditoría.

## Reglas de seguridad de la importación

- máximo 12 MB por archivo;
- máximo 5.000 filas procesadas por hoja;
- no se permite confirmar con errores;
- SKU/código duplicado dentro del mismo archivo es error;
- se validan proveedor, sede y sububicación antes de escribir;
- se respetan los límites del plan para Inventario y Activos;
- el hash SHA-256 impide volver a confirmar exactamente el mismo archivo;
- toda confirmación se ejecuta en transacción;
- los lotes de importación quedan registrados en `bulk_import_batches`;
- una salida que dejaría stock negativo es rechazada por PostgreSQL;
- las transferencias requieren dos bodegas diferentes.

## Plantillas descargables

`GET /api/bulk-import/template?entity=inventory`

Genera un Excel contextualizado para la empresa con:

- LEEME
- Catálogos
- Bodegas
- Inventario
- Kardex

`GET /api/bulk-import/template?entity=assets`

Genera:

- LEEME
- Catálogos
- Activos

Cuando la importación se abre desde un proveedor, se usa `&supplier=<uuid>` para limitar la plantilla y la validación a ese proveedor.

## Activos

La plantilla de Activos carga o actualiza por Código:

- nombre y descripción;
- categoría;
- sede y sububicación;
- proveedor;
- fabricante, modelo y serial;
- estado;
- criticidad;
- fechas de compra, instalación y garantía;
- costo;
- detalle de ubicación;
- notas.

Los códigos existentes se actualizan; los nuevos se crean, siempre respetando el límite de activos de la organización.

## Proveedores

Las pestañas **Inventarios / suministros** y **Requisiciones** son operativas.

Desde Inventarios / suministros se puede:

- crear un suministro ya asociado al proveedor;
- importar Excel limitado al proveedor;
- ver existencia, mínimo, costo y bodega;
- editar datos maestros;
- abrir la ficha/Kardex;
- desactivar un suministro sin borrar su historial.

Desde Requisiciones se puede:

- crear una nueva requisición;
- revisar el historial del proveedor;
- abrir cada requisición;
- exportarla;
- editar cantidades y costos mientras no esté atendida/cerrada/cancelada.

El módulo lateral de Requisiciones conserva el comportamiento multi-proveedor: una selección que mezcle artículos de proveedores distintos genera una requisición independiente por cada proveedor.

## Persistencia

Migraciones relacionadas:

- `028_supplier_profiles_requisitions.sql`
- `030_bulk_import_inventory_kardex.sql`
- `031_inventory_kardex_metadata.sql`

El trigger `cmms_apply_inventory_transaction()` es la autoridad de saldo para movimientos nuevos: actualiza existencias por bodega y el total agregado del artículo.

## CI

CI ejecuta PostgreSQL 17 real, todas las migraciones, los smoke tests del Dashboard y `scripts/inventory-kardex-smoke.mjs`. Este último verifica entrada, salida, traslado, ajuste, saldo total por bodegas y rechazo de stock negativo antes del build de producción.
