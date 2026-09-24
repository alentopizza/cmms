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

Tipos válidos para el Kardex genérico/importado: Entrada, Salida, Ajuste positivo, Ajuste negativo, Devolución y Traslado. **Devolución** en este contexto significa retorno hacia Inventario y aumenta stock.

El usuario real que confirma la importación queda como `created_by`. Si el Excel contiene una columna Usuario, se conserva como dato de origen dentro de la nota de auditoría.

Las **devoluciones a proveedor** no se importan como un movimiento Kardex libre. Deben nacer desde la requisición/recepción de origen para poder validar cuánto fue realmente recibido, cuánto ya fue devuelto y qué bodega entrega físicamente el material. El movimiento resultante es `supplier_return` y disminuye stock.

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


## Operational workspace added after the import foundation

Inventory now exposes a persistent internal navigation for **Summary, Products, Categories, Warehouses, Entries, Issues, Adjustments, Transfers and Kardex**.

Additional behavior:

- Categories can be created, edited, activated and deactivated.
- Warehouses can be created, edited, activated and deactivated with site, sublocation, type, responsible person, capacity, detail and notes.
- Kardex has an independent operational page with search/facets, movement creation and Excel/CSV/PDF export.
- Item-level Kardex and global Kardex both capture optional lot, expiration date and cost center.
- Inventory records may be deactivated without deleting history. Inactive records remain discoverable through the **Registro** facet and can be reactivated from their detail page.
- Product and asset cards support authenticated stored images in PostgreSQL bytea columns added by migration 030.
- Assets now have a complete create/edit workflow covering category, technical identity, status, criticality, supplier, physical location, purchase/install/warranty dates, purchase cost, notes and image.
- Asset editing preserves maintenance plans and existing operational history; it updates master data only.


## Recepción de requisiciones contra Kardex

La requisición ya no termina en un documento estático. Desde su detalle puede registrarse la recepción física parcial o total.

Reglas vigentes:

- la recepción exige permisos de `requisitions.write` e `inventory.write`;
- cada línea recibida debe seguir vinculada a un `inventory_item_id` activo;
- la cantidad recibida en una operación no puede superar el saldo pendiente;
- cada línea requiere una bodega activa de la misma organización;
- la recepción inserta una transacción `receipt` en `inventory_transactions`;
- el trigger de Kardex actualiza stock por bodega y saldo agregado;
- luego se incrementa `supplier_requisition_items.quantity_received`;
- si aún existe saldo pendiente, la requisición queda `partial`;
- cuando todas las líneas están completas, pasa a `fulfilled` y se registra `fulfilled_at`;
- documento, fecha/hora, costo, lote, vencimiento, centro de costo y observaciones quedan disponibles para auditoría;
- `inventory_transactions.requisition_id` y `requisition_item_id` permiten navegar desde Kardex hacia la requisición origen;
- los exportes de requisición incluyen Solicitado, Recibido y Pendiente.

La migración relacionada es `033_requisition_inventory_receipts.sql`.

CI ejecuta `scripts/requisition-receipt-smoke.mjs`, que verifica recepción parcial, recepción final, actualización de stock, cantidades recibidas, estado y enlaces de trazabilidad.


## Import audit and supplier-scoped operation

The import modal now shows the 12 most recent import batches for the active company/module, including file name, state, imported rows, warnings, errors, user and timestamp.

Supplier-profile imports derive the tenant from the selected Supplier for platform operators. This prevents a Platform Owner/Superadministrator from having to switch company context just to download a supplier template or import supplier inventory, while tenant users remain restricted to their own organization.

Inactive supplier inventory remains visible in the supplier profile, can be reactivated, and is excluded from new requisition selection until active again. Supplier inventory create/edit forms also support product images.
