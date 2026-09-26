# Fase técnica — Diagnóstico de Inventario

Fecha: 2026-09-26  
Estado: **diagnóstico completo; sin cambios funcionales de código**  
Baseline protegido: Fase 3 Activos validada; Work Orders no se reabre en esta fase salvo dependencia estrictamente necesaria.

## 0. Directiva de producto

Inventario debe permanecer como una capacidad genérica de Desweb CMMS:

- multiempresa;
- multi-sede;
- compatible con RBAC;
- reutilizable entre industrias;
- configurable únicamente cuando exista una variación real entre organizaciones;
- sin tablas, endpoints, componentes, permisos ni lógica específica de un cliente.

El proceso NG26980 se trata únicamente como caso de validación comercial. No se encontró en las fuentes disponibles del proyecto un documento contractual completo con sus cláusulas, por lo que este diagnóstico no declara cumplimiento contractual. La sección NG26980 clasifica capacidades generales que razonablemente pueden reutilizarse, no una certificación de cobertura.

---

## 1. Resumen ejecutivo

Inventario ya tiene una base funcional considerable:

- catálogo de artículos;
- categorías;
- bodegas;
- stock por bodega;
- Kardex;
- entradas, salidas, ajustes, devoluciones y transferencias;
- bloqueo de stock negativo;
- lotes/vencimientos como metadatos de movimiento;
- importación masiva Inventario/Kardex;
- importación global y contextual desde Proveedor;
- resolución determinista de proveedor;
- requisiciones;
- recepción contra Kardex;
- devoluciones a proveedor;
- conciliación documental;
- exportación XLSX/CSV/PDF;
- imágenes de producto;
- integración con Suppliers.

Sin embargo, **no es seguro migrar mecánicamente el directorio de Inventario siguiendo Activos**. Hay dos problemas previos:

1. **P0 de scope por sede**: varias lecturas y mutaciones validan organización pero no siempre las sedes autorizadas.
2. **modelo físico híbrido**: `inventory_items.site_id` funciona como sede maestra, pero el stock real vive en `inventory_stock_levels` por bodega y una transferencia puede mover stock a otra sede sin cambiar el `site_id` del artículo.

Por tanto, el orden recomendado es:

**P0 scope/no-fuga → definir autoridad física de sede/bodega → migración server-side → integración genérica con OT → capacidades comerciales avanzadas.**

---

# 2. Modelo de datos actual

## 2.1 inventory_items

Origen: `001_init.sql` y migraciones posteriores.

Campos principales actuales:

- `id`;
- `organization_id`;
- `site_id`;
- `location_id`;
- `supplier_id`;
- `category_id`;
- `warehouse_id`;
- `sku`;
- `name`;
- `description`;
- `presentation`;
- `unit`;
- `quantity`;
- `min_quantity`;
- `max_quantity`;
- `unit_cost`;
- `storage_location`;
- imagen;
- `active`;
- `subcategory`;
- `brand`;
- `model`;
- `barcode`;
- `reference_price`;
- `tax_rate`;
- timestamps.

Restricción relevante:

- SKU único por organización: `UNIQUE (organization_id, sku)`.

Índices relevantes:

- `inventory_low_stock_idx (organization_id, quantity, min_quantity)`;
- `inventory_items_location_idx`;
- índices por categoría y bodega;
- `inventory_items_barcode_idx (organization_id, barcode)` parcial.

### Observación estructural

El SKU es global dentro de la organización, pero el artículo conserva una única `site_id`. Esto entra en tensión con el stock multi-bodega cuando una misma referencia termina teniendo saldo en bodegas de diferentes sedes.

## 2.2 inventory_categories

Catálogo por organización:

- `id`;
- `organization_id`;
- `code`;
- `name`;
- `active`;
- timestamps.

Restricciones:

- código único por organización;
- nombre único por organización.

No es una entidad por sede. Puede seguir siendo catálogo organizacional.

## 2.3 inventory_warehouses

Campos:

- organización;
- sede;
- sububicación;
- código;
- nombre;
- tipo;
- responsable;
- capacidad;
- ubicación detalle;
- notas;
- estado;
- timestamps.

Restricción:

- código único por organización.

Índice:

- `(organization_id, site_id, active)`.

Actualmente `type` y `responsible` son texto libre. La capacidad se registra pero no existe lógica de ocupación/utilización.

## 2.4 inventory_stock_levels

Autoridad de saldo físico por bodega:

- `organization_id`;
- `item_id`;
- `warehouse_id`;
- `quantity`;
- `min_quantity`;
- `max_quantity`;
- `updated_at`.

PK:

- `(item_id, warehouse_id)`.

Restricciones:

- cantidades no negativas.

Índice:

- `(organization_id, warehouse_id, item_id)`.

## 2.5 inventory_transactions

Kardex append-oriented con:

- organización;
- artículo;
- `work_order_id`;
- tipo;
- cantidad;
- costo;
- bodega origen;
- bodega destino;
- documento;
- fecha del movimiento;
- usuario creador;
- lote;
- vencimiento;
- centro de costo;
- import batch/fila;
- requisición / línea de requisición;
- devolución a proveedor / línea;
- transacción origen;
- `source_movement_id`;
- notas;
- timestamps.

Tipos actuales:

- `receipt`;
- `issue`;
- `adjustment`;
- `return`;
- `transfer`;
- `supplier_return`.

Índices relevantes:

- artículo + fecha;
- organización + bodega + fecha;
- lote;
- requisición;
- supplier return;
- source transaction;
- `source_movement_id` único por organización cuando existe.

## 2.6 Trigger de stock

`cmms_apply_inventory_transaction()` es la autoridad actual para movimientos:

- exige bodega;
- convierte receipt/return en entrada;
- issue/supplier_return en salida;
- adjustment respeta signo;
- transfer resta origen y suma destino;
- bloquea saldo negativo;
- usa `FOR UPDATE` en saldo origen;
- actualiza `inventory_stock_levels`;
- recalcula `inventory_items.quantity` como suma de todas sus bodegas;
- cambia `unit_cost` al costo informado en receipt/return/adjustment.

Esto debe preservarse como autoridad. No crear una segunda lógica de saldo en UI o API.

### Falta de defensa estructural

El trigger no valida de forma explícita que:

- organización de transacción;
- organización del artículo;
- organización de bodega origen;
- organización de bodega destino

sean idénticas.

Las APIs normales realizan varias de esas verificaciones, pero la integridad no está expresada completamente en la capa SQL.

---

# 3. Qué funciona correctamente hoy

## 3.1 Kardex y stock

Funciona:

- entrada;
- salida;
- ajuste positivo/negativo;
- devolución a inventario;
- transferencia;
- devolución a proveedor;
- bloqueo de existencias negativas;
- saldo por bodega;
- total consolidado en `inventory_items.quantity`;
- trazabilidad de documento;
- costo;
- fecha;
- lote;
- vencimiento;
- centro de costo;
- usuario;
- batch de importación;
- movimiento externo único.

El smoke `scripts/inventory-kardex-smoke.mjs` valida recepción, salida, transferencia, ajuste y rechazo de stock negativo.

## 3.2 Requisiciones / abastecimiento

Existe integración general con Suppliers:

- cada artículo tiene proveedor;
- generación de requisiciones agrupa por organización + proveedor;
- una selección con varios proveedores genera requisiciones separadas;
- política de aprobación por organización;
- recepción parcial/total;
- recepción genera entrada real de Kardex;
- devolución a proveedor genera salida de Kardex;
- devolución conserva vínculo con recepción origen;
- conciliación documental existente.

Esta arquitectura es reusable y no debe reemplazarse.

## 3.3 Importación masiva

El flujo unificado ya es una fortaleza:

- una plantilla maestra Inventario/Kardex;
- entrada desde Inventario o desde contexto Proveedor;
- modo global/contextual;
- scope `all` / `context_only`;
- proveedor por ID → NIT → código → nombre exacto;
- validación antes de commit;
- actualización/omisión controlada de duplicados;
- servicios detectados y excluidos del inventario físico;
- bodegas nuevas deben venir explícitas en BODEGAS;
- stock inicial solo para nuevos productos;
- movimientos posteriores por Kardex;
- `MOVIMIENTO_ID` evita reprocesar movimientos externos;
- historial de importaciones;
- batch auditado;
- simulación de stock para detectar negativos antes del commit.

El smoke `unified-inventory-import-smoke.mjs` protege códigos de proveedor, metadatos del producto, `source_movement_id` y trazabilidad de batch/contexto.

## 3.4 Exportación

`/api/module-export` vuelve a consultar PostgreSQL y no depende de las filas montadas en el directorio.

XLSX/CSV exportan el conjunto autorizado según el scope actual del endpoint.

El PDF se limita a las primeras 250 filas por su generador actual. Debe documentarse como límite de presentación, no confundirse con el dataset XLSX/CSV.

---

# 4. Qué está parcialmente implementado

## 4.1 Metadatos de producto

La BD/importador ya soportan:

- subcategoría;
- marca;
- modelo;
- código de barras;
- precio de referencia;
- IVA.

Pero la UI principal y la ficha de artículo no exponen de forma completa estos atributos.

Resultado: existen en el modelo/importación, pero no son todavía una capacidad uniforme de administración manual.

## 4.2 Lotes y vencimientos

Los movimientos almacenan:

- lote;
- fecha de vencimiento.

Pero no existe saldo autoritativo por lote.

`inventory_stock_levels` agrega únicamente por artículo + bodega.

Por tanto hoy se puede responder:

- “qué movimientos registraron este lote”;

pero no de forma robusta:

- “cuántas unidades quedan actualmente del lote X”;
- “qué lote debe salir primero por FEFO”;
- “qué cantidad vence en los próximos N días”.

Esto es trazabilidad de lote **parcial**, no gestión de inventario por lote completa.

## 4.3 Work Orders

La BD ya contiene:

- `inventory_transactions.work_order_id`;
- `work_orders.parts_cost`.

Sin embargo no se encontró flujo operativo que:

- reserve materiales para una OT;
- emita materiales contra una OT;
- devuelva sobrantes desde una OT;
- muestre materiales planeados/consumidos en la OT;
- calcule `parts_cost` desde Kardex.

La relación está preparada en esquema pero no operacionalizada.

## 4.4 Reposición

Existen mínimo/máximo y clasificación visual de stock bajo/sin stock.

No existe aún:

- recomendación de cantidad a reponer;
- generación guiada de requisición desde faltantes sobre todo el catálogo;
- reglas de reorder configurables;
- alertas programadas de vencimiento/reposición.

---

# 5. P0 — Problemas de autorización / no fuga

Estos problemas deben resolverse antes de la paginación server-side porque afectan la definición del conjunto autorizado.

## P0.1 Directorio de bodegas

Archivo:

`app/dashboard/inventory/warehouses/page.tsx`

Para tenant filtra por `organization_id`, pero no por `session.siteIds`.

Un usuario limitado por sede con `inventory.read` puede recibir:

- otras bodegas;
- nombre de sede/sububicación;
- responsable;
- capacidad;
- cantidad;
- valor del stock.

### Impacto

Fuga lateral entre sedes de una misma organización.

## P0.2 KPIs de categorías

Archivo:

`app/dashboard/inventory/categories/page.tsx`

La categoría es organizacional, lo cual es válido, pero sus agregados:

- productos;
- cantidad;
- valor

usan todos los artículos activos de la organización.

Para un usuario limitado deben contar únicamente el stock/artículos autorizados.

## P0.3 Movimientos recientes del resumen

Archivo:

`app/dashboard/inventory/page.tsx`

La consulta de “Últimos movimientos” usa solo:

`WHERE t.organization_id=$1`

No aplica sedes para una sesión limitada.

## P0.4 Ficha individual — stock y selector de bodegas

Archivo:

`app/dashboard/inventory/[id]/page.tsx`

La entrada a la ficha sí valida el artículo con `canAccessSite`.

Después, sin embargo:

- `inventory_stock_levels` se consulta por `item_id` sin scope de bodega;
- el selector de bodegas trae todas las bodegas activas de la organización.

Si ese SKU tiene stock en otra sede, la ficha puede revelar ese saldo/bodega y presentar destinos no autorizados.

## P0.5 Imagen de producto

Archivo:

`app/api/inventory/[id]/image/route.ts`

Valida:

- sesión;
- `inventory.read`;
- organización.

No valida la sede del artículo.

Con un UUID conocido, una sesión limitada puede intentar leer la imagen de un producto de otra sede de su organización.

## P0.6 Edición / activar / desactivar producto

Archivo:

`app/api/inventory/[id]/route.ts`

La ruta obtiene únicamente `organization_id`.

Para tenant valida organización, pero no `site_id` / `canAccessSite`.

Un usuario con `inventory.write` y alcance limitado podría modificar o activar/desactivar un artículo fuera de sus sedes si conoce el ID.

## P0.7 Movimientos manuales

Archivos:

- `app/api/inventory/[id]/movement/route.ts`;
- `app/api/inventory/movements/route.ts`.

Sí validan la sede maestra del artículo.

Pero las bodegas origen/destino se validan únicamente por:

- organización;
- activa;
- ID.

No se valida:

- que la bodega esté en una sede autorizada;
- ni que corresponda a la sede/sububicación permitida por el modelo actual.

Esto permite seleccionar/mover a una bodega fuera del scope si se conoce el ID; además la UI actualmente expone bodegas de toda la organización.

## P0.8 Alta de producto con warehouse_id explícito

`app/api/inventory/route.ts`

La sede y sububicación del artículo sí se validan y `canAccessSite` se aplica.

Si llega `warehouse_id`, la bodega solo se valida por organización + activa.

No se comprueba que corresponda a la sede/sububicación seleccionada.

## P0.9 Activar/desactivar almacén

`app/api/inventory/warehouses/[id]/route.ts`

La actualización normal valida la nueva sede mediante `canAccessSite`.

La rama `intent=toggle` valida únicamente la organización del almacén existente.

Un usuario site-limited con ID conocido puede cambiar el estado de una bodega fuera de su sede.

## P0.10 Supplier → Inventory

`GET app/api/suppliers/[id]?view=inventory`

Exige `suppliers.manage` y limita por organización, pero no por sedes.

Devuelve:

- todos los productos del proveedor en la organización;
- todas las sedes;
- todas las sububicaciones;
- todas las bodegas.

Admin/Manager con scope limitado puede recibir información fuera de sus sedes.

## P0.11 Plantilla e importador

`app/api/bulk-import/template/route.ts`

Con `inventory.write`, obtiene por organización:

- todas las sedes;
- sububicaciones;
- bodegas;
- catálogos;
- y opcionalmente inventario actual.

No aplica `session.siteIds`.

`app/api/bulk-import/route.ts` también construye un catálogo organizacional completo antes de validar las filas.

Aunque el commit realiza comprobaciones de `canAccessSite` en varios puntos, el paso de plantilla/validación puede exponer nombres o metadatos fuera del scope.

---

# 6. P1 — Modelo físico de Inventario

Este es el punto arquitectónico más importante de la fase.

Actualmente existen simultáneamente:

- `inventory_items.site_id`;
- `inventory_items.location_id`;
- `inventory_items.warehouse_id`;
- `inventory_items.quantity`;
- múltiples filas de `inventory_stock_levels` por artículo.

Una transferencia solo cambia saldos de bodegas. No cambia `inventory_items.site_id`.

Ejemplo:

1. SKU X tiene `site_id=A`.
2. Existe stock en Bodega A.
3. Se transfiere a Bodega B de otra sede.
4. `inventory_items.site_id` sigue siendo A.
5. `inventory_items.quantity` suma A + B.
6. los scopes de directorio/exportación/Kardex usan principalmente `inventory_items.site_id`.

Consecuencias:

- sede A puede recibir un total que incluye físicamente stock de B;
- sede B puede no encontrar el SKU aun teniendo stock físico;
- filtros y KPI por sede pueden representar “sede maestra del artículo”, no “sede donde existe stock”;
- autorización por sede queda semánticamente ambigua.

## Dos modelos conceptuales posibles

### Modelo A — artículo por sede

El registro `inventory_items` pertenece a una sede.

Entonces:

- toda bodega de un item debe pertenecer a esa misma sede;
- una “transferencia entre sedes” no puede ser el mismo movimiento simple actual;
- tendría que existir un flujo inter-sede entre registros/recepción-despacho compatibles.

Ventaja: cambio mínimo respecto al modelo actual.

Problema: el SKU es único por organización, por lo que hoy no se puede tener naturalmente un registro del mismo SKU en cada sede.

### Modelo B — producto maestro organizacional + stock por bodega

`inventory_items` representa el producto/SKU de la empresa.

La presencia física y el scope se derivan de:

`inventory_stock_levels → inventory_warehouses → site_id`.

En ese modelo:

- el SKU único por organización encaja;
- una referencia puede estar en varias sedes;
- las transferencias inter-sede son naturales;
- el stock visible por sede se calcula desde bodegas;
- `inventory_items.site_id/location_id/warehouse_id` pasan a ser atributos legacy/default/primarios, no la autoridad física.

Este modelo es más general para un CMMS comercial multi-sede, pero implica una migración semántica importante.

## Recomendación del diagnóstico

**No decidirlo implícitamente durante la paginación.**

Antes de implementar la fase de listado debe definirse explícitamente cuál es la autoridad física.

Para mantener compatibilidad inmediata se puede primero cerrar P0 usando el modelo vigente y prohibir que una operación autorizada use bodegas fuera del scope. Pero si Desweb quiere transferencias reales entre sedes con un único SKU organizacional, debe planearse formalmente el Modelo B.

---

# 7. P1 — Directorio y paginación

`app/dashboard/inventory/page.tsx` todavía usa:

- `LIMIT 600`;
- búsqueda DOM;
- filtros DOM;
- facetas DOM;
- KPI calculados desde `items.rows`.

Consecuencias:

- artículo 601+ no se encuentra;
- filtros no representan todo el catálogo;
- KPI no representan todo el scope;
- el valor total queda truncado;
- “stock bajo/sin stock” queda truncado;
- facetas quedan truncadas.

## Dependencia adicional: RequisitionBuilder

El resumen pasa:

`items.rows.filter(...)`

a `RequisitionBuilder`.

Por tanto el selector de requisición también está limitado a las primeras 600 filas.

No se puede simplemente pasar la futura página de 24 al Builder.

La migración necesita separar:

1. página visible;
2. summary/KPI;
3. facetas;
4. catálogos de creación;
5. catálogo/fuente de selección para requisiciones;
6. movimientos recientes;
7. reportes/resúmenes;
8. import/export.

Patrón posterior, una vez resuelto P0:

**scope autorizado → búsqueda → filtros → sort → paginación**

Reutilizar:

- `ModuleHeader.serverState`;
- `UrlPagination`;
- `Pagination`;
- `CollectionView`.

---

# 8. P1 — Kardex

`app/dashboard/inventory/kardex/page.tsx` usa hasta `LIMIT 1000` movimientos y después búsqueda/filtros DOM.

Debe migrarse server-side, pero su scope debe definirse con la autoridad física elegida.

No conviene asumir que `i.site_id` es suficiente si stock/movimientos pueden utilizar bodegas de otra sede.

La búsqueda server-side futura debe cubrir como mínimo:

- SKU;
- producto;
- proveedor;
- bodega origen;
- bodega destino;
- documento;
- `MOVIMIENTO_ID`;
- batch de importación;
- lote;
- centro de costo;
- usuario;
- requisición;
- devolución;
- fecha/tipo.

Las exportaciones deben usar el mismo scope autorizado.

---

# 9. Dependencia con Suppliers

## Ya reusable

Suppliers ya aporta:

- proveedor único por artículo;
- clasificación materials/services/both;
- importación contextual;
- requisición por proveedor;
- recepción;
- devolución;
- documentos de compra;
- conciliación;
- métricas comerciales.

No construir un segundo subsistema de compras dentro de Inventario.

## Límites actuales

Un artículo tiene un único `supplier_id`.

No existe:

- proveedor alternativo;
- lista de precios por proveedor;
- lead time por artículo/proveedor;
- unidad/costo por proveedor.

Esto puede limitar clientes que compran el mismo repuesto a varias fuentes.

Debe tratarse como capacidad futura genérica, no como requerimiento de paginación.

---

# 10. Dependencia con Work Orders

## Relación existente

La base ya tiene:

`inventory_transactions.work_order_id → work_orders.id`.

Work Order ya tiene:

`parts_cost`.

## Relación operativa faltante

No existe flujo de usuario/API para utilizarla.

Capacidad genérica recomendable en una fase posterior:

1. materiales requeridos/planeados por OT;
2. reserva opcional;
3. salida de bodega vinculada a OT;
4. devolución de sobrante;
5. trazabilidad de quién/desde dónde;
6. costo real de repuestos derivado de movimientos;
7. historial visible en Inventario y OT.

No modificar Work Orders durante el saneamiento/Paginación de Inventario.

La integración debe diseñarse una vez el scope físico de bodegas esté resuelto.

---

# 11. Dependencia con Assets

No existe FK directa Inventario ↔ Asset.

La relación indirecta actual es:

Inventario → posible `work_order_id` → Work Order → Asset.

No se necesita cambiar Assets para completar la fase técnica inmediata.

Capacidades futuras posibles, solo si existe requisito general:

- repuestos compatibles por tipo/modelo de activo;
- BOM/lista de materiales;
- repuestos críticos;
- consumo histórico por activo.

No crear esa relación por intuición.

---

# 12. Permisos actuales

`inventory.read`:

- Admin;
- Manager;
- Technician;
- Viewer;
- Provider;
- External.

`inventory.write`:

- Admin;
- Manager.

Requester no tiene Inventory Read/Write, pero sí puede usar Requisitions según sus permisos.

Plataforma/Superadmin pasan por el bypass de plataforma existente.

Estos permisos son baseline. La fase no debe crear permisos alternativos para un cliente particular.

---

# 13. Capacidades comerciales adicionales

## Alta prioridad

### Consumo de materiales por OT

Aprovecha `work_order_id` existente y conecta mantenimiento real con costos y stock.

### Reserva / disponible

Separar conceptualmente:

- existencia física;
- reservado;
- disponible.

Especialmente útil cuando varias OT compiten por el mismo repuesto.

### Gestión real de lotes/vencimiento

Si una organización activa esta capacidad:

- saldo por lote;
- vencimiento;
- FEFO;
- alertas;
- trazabilidad de salida por lote.

No todas las industrias la necesitan, por lo que debe ser configurable.

### Reposición

Sobre min/max:

- cantidad sugerida;
- productos bajo punto;
- agrupación por proveedor;
- creación de requisición;
- alertas configurables.

## Prioridad media

### Proveedores alternativos por SKU

Tabla relacional producto-proveedor con costo, código del proveedor, lead time y prioridad.

### Unidades de medida

Catálogo + conversiones opcionales para compra/almacenamiento/consumo.

### Costeo configurable

Hoy `unit_cost` se comporta como último costo informado en ciertos movimientos.

Opciones futuras posibles:

- último costo;
- promedio ponderado;
- costeo por lote.

No implementar FIFO/FEFO contable sin requisito explícito.

### Reversión auditada

No editar/borrar movimientos de Kardex históricos.

Agregar, cuando sea necesario, una operación de reversión/contramovimiento auditada.

### Inventarios físicos / conteos cíclicos

- sesión de conteo;
- esperado;
- contado;
- diferencia;
- aprobación;
- ajuste de Kardex.

Muy reusable para clientes comerciales/industriales.

---

# 14. Cobertura potencial del caso NG26980

Sin un documento contractual completo disponible, solo puede hacerse una matriz de capacidad general.

## Ya cubierto o muy avanzado

- catálogo de repuestos/suministros;
- multiempresa;
- sede/sububicación;
- bodegas;
- proveedores;
- stock por bodega;
- entradas;
- salidas;
- ajustes;
- transferencias;
- Kardex;
- stock mínimo/máximo;
- costos;
- lotes/vencimientos como trazabilidad de movimiento;
- importación masiva;
- exportación;
- requisiciones;
- recepción;
- devoluciones;
- aprobación de requisiciones;
- conciliación documental;
- auditoría de importaciones;
- bloqueo de stock negativo.

## Parcial

- lote/vencimiento: sin saldo por lote;
- relación OT-material: FK existente, flujo faltante;
- metadatos comerciales del producto: BD/importación más completa que UI;
- reposición: min/max sí, automatización no;
- multi-sede: existe, pero requiere sanear la autoridad física y no-fuga.

## No demostrado / requiere especificación

- reservas por OT;
- consumo real por OT;
- devolución desde OT;
- costeo de repuestos en OT;
- inventario físico/conteo cíclico;
- FEFO;
- proveedor alternativo;
- aprobaciones específicas de movimientos;
- serialización individual de repuestos;
- cualquier SLA, formato o integración externa propia de NG26980.

No declarar estos puntos como cumplimiento hasta disponer de la fuente contractual.

---

# 15. Priorización

| Prioridad | Problema | Acción recomendada |
| --- | --- | --- |
| P0 | lecturas de bodegas/stock/movimientos fuera de `siteIds` | unificar scope de lectura |
| P0 | mutación de item por ID sin `canAccessSite` | revalidar item antes de toda mutación |
| P0 | movimientos permiten bodegas de cualquier sede de la organización | validar origen/destino contra scope |
| P0 | toggle de warehouse sin validar sede actual | revalidar warehouse + site |
| P0 | image endpoint solo valida organización | aplicar scope de sede |
| P0 | Supplier Inventory y plantilla/importador exponen catálogos organizacionales completos a usuarios limitados | aplicar scope correspondiente |
| P1 | modelo híbrido item.site vs stock por warehouse | decisión arquitectónica explícita |
| P1 | directorio `LIMIT 600` + filtros/KPI DOM | migración server-side después del P0 |
| P1 | RequisitionBuilder depende de primeras 600 filas | fuente independiente/server-search |
| P1 | Kardex `LIMIT 1000` + filtros DOM | paginación server-side |
| P1 | categorías/warehouse metrics agregan fuera de site scope | agregados autorizados |
| P1 | relación OT-material preparada pero inactiva | diseñar integración genérica posterior |
| P2 | lote/vencimiento sin saldo por lote | módulo opcional de lotes/FEFO |
| P2 | brand/model/barcode/reference_price/tax_rate incompletos en UI | completar ficha/catalogue UI |
| P2 | un solo proveedor por SKU | proveedor alternativo configurable |
| P2 | último costo como valoración implícita | política de costeo configurable |
| P2 | sin conteos físicos | inventario físico/cíclico |
| P3 | warehouse responsible/type libres | catálogo/usuario opcional si clientes lo necesitan |

---

# 16. Secuencia de implementación recomendada

## Inventario — Fase I0: seguridad y autoridad de scope

Antes de paginar:

- definir scope de artículo/bodega/movimiento;
- cerrar todas las fugas listadas P0;
- crear smoke de no fuga específico;
- probar Platform / tenant all-sites / tenant limited-sites;
- no tocar Work Orders.

## Inventario — Fase I1: colección principal server-side

Después:

- summary;
- facetas;
- página visible 24/40;
- KPI completos;
- Grid/List;
- catálogos independientes;
- RequisitionBuilder independiente de página;
- import/export intactos.

## Inventario — Fase I2: Kardex y superficies auxiliares

- Kardex server-side;
- categorías con conteos scoped;
- bodegas scoped;
- detalle con saldos/warehouses autorizados;
- supplier inventory scoped;
- plantilla/import validación scoped.

## Inventario — Fase I3: integración OT

Solo tras revisar I0–I2:

- consumo/reserva/devolución;
- work_order_id real;
- costo de partes;
- regresiones de OT.

## Inventario — Fase I4: capacidades comerciales opcionales

- lotes/FEFO;
- conteos físicos;
- reposición;
- proveedores alternativos;
- UOM;
- costeo configurable.

---

# 17. Pruebas obligatorias para la siguiente implementación

Como mínimo:

1. usuario limitado no puede listar bodega fuera de sede;
2. no puede leer stock de bodega fuera de sede;
3. no puede leer imagen de item fuera de sede;
4. no puede editar/activar/desactivar item fuera de sede por ID conocido;
5. no puede activar/desactivar warehouse fuera de sede por ID;
6. no puede emitir/recibir/ajustar en warehouse fuera de sede;
7. no puede transferir a warehouse fuera de scope;
8. Supplier Inventory no filtra ni revela sedes ajenas al scope;
9. template/import validation no revela sedes/bodegas fuera del scope;
10. COUNT/KPI/facetas representan todo el scope autorizado;
11. búsqueda recupera item fuera de página 1;
12. RequisitionBuilder puede seleccionar item fuera de página 1;
13. Grid/List presentan exactamente la misma página;
14. cambiar Grid/List no navega;
15. import global/contextual sigue funcionando;
16. recepción de requisición sigue actualizando Kardex;
17. devolución a proveedor sigue descontando stock;
18. stock negativo continúa bloqueado;
19. export no amplía scope;
20. ninguna modificación toca Activos o Work Orders salvo dependencia aprobada.

---

# 18. Decisiones que deben cerrarse antes de implementar

La única decisión arquitectónica realmente bloqueante es:

**¿La sede autorizada del inventario se define por el artículo maestro o por las bodegas donde existe stock?**

Para un producto multi-sede con SKU único por organización y transferencias entre sedes, el modelo más consistente a largo plazo es producto maestro organizacional + stock físico por bodega/sede.

Pero adoptar esa semántica requiere una migración deliberada. No debe introducirse silenciosamente dentro de la paginación.

Hasta que se apruebe esa decisión, la implementación debe limitarse a corregir no-fuga respetando el modelo vigente.
