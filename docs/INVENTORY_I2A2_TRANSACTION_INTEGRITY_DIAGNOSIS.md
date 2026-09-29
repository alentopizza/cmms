# Inventario I2-A2 — Diagnóstico técnico de integridad transaccional

Fecha: 2026-09-29  
Tipo: **diagnóstico; sin implementación funcional**.

Referencia I2-A1 validada:

`5ace3c040415e38d0f118182d934cf843c6705e2`

HEAD inspeccionado para este diagnóstico:

`62da1f53e6d4c9d916151ced1f6309a2cf70068e`

El HEAD actual contiene cambios posteriores a I2-A1, entre ellos ajustes de organization scope. Este documento describe el comportamiento real del código actual sin modificar I2-A1 ni resolver todavía I2-A2.

---

## 1. Resumen ejecutivo

La integridad transaccional de Inventario tiene una base sólida, pero no está cerrada frente a todos los escenarios de duplicación e incompatibilidad relacional.

Aspectos correctamente protegidos:

- `inventory_transactions` continúa siendo el Kardex operativo único;
- `inventory_stock_levels` continúa siendo la autoridad de existencia física por artículo+bodega;
- `cmms_apply_inventory_transaction()` sigue siendo el punto central que aplica los movimientos al stock;
- crear un movimiento y modificar stock forman parte de la misma sentencia/transacción PostgreSQL;
- el trigger bloquea la fila de stock de origen con `FOR UPDATE`;
- una salida/transferencia que dejaría saldo negativo se rechaza;
- una transferencia se aplica de forma atómica: origen y destino se actualizan dentro del mismo trigger;
- los endpoints manuales de Inventario validan organización del artículo y bodegas antes del INSERT;
- importación tiene mecanismos específicos de idempotencia mediante hash de archivo, advisory lock y `source_movement_id`;
- supplier returns tienen validación relacional adicional en PostgreSQL;
- aprobación y conciliación documental de Requisiciones revalidan site scope completo.

Brechas confirmadas:

1. **Movimientos manuales no son idempotentes.**
   Los dos endpoints manuales crean un nuevo `inventory_transactions` por cada POST válido. No envían `source_movement_id`, `document_number` es opcional y no existe otra UNIQUE o clave de operación manual.

2. **Duplicación concurrente también es posible.**
   El lock de stock protege consistencia y saldo negativo, pero no identifica dos solicitudes equivalentes como la misma operación. Si el saldo permite ambas, ambas pueden contabilizarse.

3. **PostgreSQL no garantiza actualmente todas las invariantes organization → item → warehouse.**
   Los FK de `inventory_transactions` y `inventory_stock_levels` son individuales. No existe constraint compuesta ni validación general que obligue a que:
   - transaction.organization_id = item.organization_id;
   - source warehouse.organization_id = item.organization_id;
   - destination warehouse.organization_id = item.organization_id;
   - stock_level.organization_id coincida simultáneamente con item y warehouse.

4. **Requisiciones siguen teniendo scope de lectura más amplio que varias mutaciones.**
   Para usuarios tenant, el listado y el detalle se autorizan por organización. Un usuario limitado a site A puede, si tiene `requisitions.read`, leer una requisición de site B dentro de la misma organización porque el listado y el detalle no filtran por `session.siteIds`.

5. **El export base de Requisición hereda el mismo alcance organizacional.**
   Los ítems y devoluciones se cargan por `requisition_id`; solo la sección de conciliación documental aplica cobertura completa por site.

6. **El POST de edición general de Requisición valida organización, pero no site scope de las líneas.**
   Por tanto, un usuario con `requisitions.write` y scope limitado podría editar cantidades/costos de una requisición de otro site de la misma organización si conoce el ID y el permiso RBAC se lo permite.

7. **El selector de bodega del detalle sigue mostrando bodegas legacy con `site_id IS NULL` a usuarios limitados.**
   Las rutas de recepción/devolución, en cambio, exigen una bodega cuyo `site_id` esté expresamente en `session.siteIds`. Existe una inconsistencia lectura/selector vs mutación.

No se implementó ninguna corrección durante este diagnóstico.

---

## 2. Arquitectura actual

### 2.1 Flujo central de stock

```text
UI / import / requisición
        ↓
API / route
        ↓
validaciones de autorización e integridad de aplicación
        ↓
INSERT inventory_transactions
        ↓
AFTER INSERT trigger
        ↓
cmms_apply_inventory_transaction()
        ↓
inventory_stock_levels
        ↓
inventory_items.quantity
```

### 2.2 Caminos que crean `inventory_transactions`

#### A. Movimiento manual desde Kardex

UI:

`app/dashboard/inventory/kardex/page.tsx`

API:

`POST /api/inventory/movements`

Archivo:

`app/api/inventory/movements/route.ts`

Tipos:

- receipt;
- issue;
- adjustment;
- transfer;
- return.

Validaciones principales:

- sesión;
- `inventory.write`;
- artículo activo;
- `canAccessInventoryItem()`;
- cantidad > 0;
- costo válido;
- transferencia con destino diferente;
- bodegas de la misma organización del artículo;
- `canAccessInventoryWarehouse()` en origen y destino.

Después:

`INSERT inventory_transactions`

y el trigger aplica stock.

#### B. Movimiento manual desde ficha de producto

API:

`POST /api/inventory/[id]/movement`

Archivo:

`app/api/inventory/[id]/movement/route.ts`

Realiza esencialmente el mismo flujo que `/api/inventory/movements`, con diferencias de navegación/feedback.

Los dos endpoints duplican la lógica funcional de creación manual de movimiento.

#### C. Existencia inicial al crear un producto

Archivo:

`app/api/inventory/route.ts`

Flujo:

```text
BEGIN
↓
INSERT inventory_items con quantity = 0
↓
INSERT/UPSERT inventory_stock_levels quantity = 0
   (mínimo/máximo)
↓
si existencia inicial > 0:
    INSERT inventory_transactions type=receipt
↓
trigger
↓
COMMIT
```

La escritura directa a `inventory_stock_levels` no agrega existencia física: crea/actualiza la fila con cantidad 0 y parámetros min/max. La existencia inicial real entra por Kardex.

#### D. Importación unificada

Archivo:

`app/api/bulk-import/route.ts`

Producto nuevo con stock inicial:

`INSERT inventory_transactions(type='receipt')`

Movimientos de hoja Kardex:

`INSERT inventory_transactions(...source_movement_id...)`

Protecciones adicionales:

- hash del archivo;
- scope de commit;
- `pg_advisory_xact_lock`;
- UNIQUE de `source_movement_id` por organización cuando existe;
- transacción explícita;
- validación de bodegas y sedes.

También crea/actualiza filas de `inventory_stock_levels` con cantidad 0 para min/max. No reemplaza el movimiento Kardex.

#### E. Recepción de requisición

Archivo:

`app/api/requisitions/[id]/receive/route.ts`

Flujo:

```text
BEGIN
↓
requisición por organización
↓
supplier_requisition_items FOR UPDATE
↓
validación cantidad pendiente
↓
validación site del artículo enviado
↓
validación bodega organization + site
↓
INSERT inventory_transactions type=receipt
↓
trigger de stock
↓
UPDATE supplier_requisition_items.quantity_received
↓
UPDATE supplier_requisitions.status
↓
COMMIT
```

#### F. Devolución a proveedor

Archivo:

`app/api/requisitions/[id]/returns/route.ts`

Flujo:

```text
BEGIN
↓
supplier_requisitions FOR UPDATE
↓
receipts inventory_transactions FOR UPDATE
↓
calcular cantidad ya devuelta
↓
INSERT supplier_returns
↓
INSERT supplier_return_items
↓
trigger cmms_validate_supplier_return_item()
↓
INSERT inventory_transactions type=supplier_return
↓
trigger de stock
↓
audit_log
↓
COMMIT
```

#### G. Excepción histórica / bootstrap

La migración `030_bulk_import_inventory_kardex.sql` creó saldos iniciales en `inventory_stock_levels` a partir del campo legacy `inventory_items.quantity`.

Esto fue una migración de transición, no un segundo camino operativo actual.

### 2.3 Single source of truth

El sistema operativo actual conserva:

```text
Kardex        = inventory_transactions
stock físico  = inventory_stock_levels
total maestro = inventory_items.quantity derivado del stock físico
```

No se encontró un segundo mecanismo operativo actual que incremente/decremente existencia física saltándose deliberadamente `inventory_transactions`.

---

## 3. Idempotencia

### 3.1 Endpoints manuales

| Archivo | Ruta | Método | Tipos | Clave idempotencia |
| --- | --- | --- | --- | --- |
| `app/api/inventory/movements/route.ts` | `/api/inventory/movements` | POST | receipt, issue, adjustment, transfer, return | No |
| `app/api/inventory/[id]/movement/route.ts` | `/api/inventory/[id]/movement` | POST | receipt, issue, adjustment, transfer, return | No |

Ambos:

- hacen un INSERT nuevo por cada POST válido;
- no rellenan `source_movement_id`;
- permiten `document_number=NULL`;
- no exigen una clave natural;
- no existe UNIQUE sobre el conjunto de campos manuales.

### 3.2 Repetición secuencial

Escenario:

```text
POST movimiento X
POST movimiento X
```

Resultado deducido del código actual:

- se crean dos `inventory_transactions` si ambas solicitudes pasan las validaciones;
- el trigger se ejecuta dos veces;
- el stock se modifica dos veces;
- si es una salida/transferencia y la segunda ya no tiene stock suficiente, la segunda falla;
- si existe stock suficiente para las dos, ambas se contabilizan.

`document_number` no evita esto porque:

- es opcional;
- no es UNIQUE;
- un mismo documento puede representar legítimamente más de una línea/movimiento.

`source_movement_id` tampoco lo evita porque los endpoints manuales no lo escriben.

### 3.3 Repetición concurrente

La función `cmms_apply_inventory_transaction()` usa:

`SELECT ... FROM inventory_stock_levels ... FOR UPDATE`

sobre el saldo origen.

Ese lock protege el saldo, pero no representa idempotencia.

Dos requests equivalentes concurrentes:

- pueden crear dos transactions;
- quedan serializadas al aplicar el saldo de origen cuando la fila existe;
- si después del primer movimiento todavía hay stock suficiente, el segundo también se aplica;
- si el segundo dejaría saldo negativo, el segundo INSERT falla y se revierte.

Para receipts positivos, dos requests duplicados pueden sumar dos veces.

Para transferencias, dos requests duplicados pueden transferir dos veces si el origen tiene saldo suficiente.

No existe:

- advisory lock por operación manual;
- UNIQUE de request;
- token de formulario persistido;
- idempotency-key;
- correlación manual con `source_movement_id`.

### 3.4 Requisición — recepción

No existe una idempotency key del request.

Sin embargo, la ruta bloquea `supplier_requisition_items` con `FOR UPDATE` y recalcula el saldo pendiente.

Consecuencia:

- una recepción total repetida suele ser rechazada por exceder el pendiente;
- una recepción parcial duplicada puede aplicarse dos veces si, después de la primera, todavía queda cantidad suficiente;
- dos requests concurrentes se serializan por el lock, pero el segundo puede seguir siendo válido si la cantidad pendiente lo permite.

La protección es de **no sobre-recepción**, no de identidad de operación.

### 3.5 Supplier return

No existe idempotency key de request.

La ruta bloquea la requisición y los receipts origen, calcula el total ya devuelto y evita devolver más que la recepción disponible.

Consecuencia:

- evita superar el saldo retornable;
- no identifica dos devoluciones parciales equivalentes como un mismo request;
- una repetición parcial puede crear una segunda devolución legítima desde la perspectiva de las constraints si todavía existe cantidad retornable.

### 3.6 Importación

La importación sí dispone de idempotencia explícita:

- UNIQUE de `inventory_transactions(organization_id, upper(source_movement_id))` cuando `source_movement_id` no está vacío;
- hash del archivo y scope de commit;
- UNIQUE de batch confirmado por scope/hash;
- `pg_advisory_xact_lock` para serializar confirmaciones del mismo archivo;
- recheck de duplicado dentro de la transacción.

El smoke actual `unified-inventory-import-smoke.mjs` confirma que un `source_movement_id` repetido es rechazado.

### 3.7 Riesgo principal

El riesgo no es que PostgreSQL pierda atomicidad.

El riesgo es que dos solicitudes equivalentes sean interpretadas como dos operaciones distintas y válidas.

---

## 4. Invariantes

| Invariante | API | PostgreSQL | Evidencia | Riesgo |
| --- | --- | --- | --- | --- |
| transaction.organization_id = item.organization_id | Sí en endpoints manuales y flujos revisados | No de forma compuesta | Los endpoints obtienen organization del item; FK son independientes | 🔴 una escritura alternativa/raw puede crear combinación cross-org |
| source warehouse.organization_id = item.organization_id | Sí en endpoints manuales | No de forma compuesta | Query de warehouse usa `organization_id=row.organization_id` | 🔴 DB no impide warehouse de otra org |
| destination warehouse.organization_id = item.organization_id | Sí en endpoints manuales/import | No | misma prevalidación de warehouse | 🔴 DB no impide destino cross-org |
| source warehouse != destination | Sí | Sí | API y trigger rechazan destino igual a origen | 🟢 |
| saldo físico >= 0 | Validación indirecta por error del trigger | Sí | CHECK quantity >= 0 + trigger + FOR UPDATE | 🟢 |
| transfer no deja stock negativo | Sí por resultado DB | Sí | lock + current_qty + delta | 🟢 |
| transferencia origen+destino atómica | N/A | Sí | ambos cambios se ejecutan dentro del trigger del mismo INSERT | 🟢 |
| stock_level.item pertenece a stock_level.organization | Normalmente sí por aplicación | No compuesto | FK organization/item independientes | 🔴 |
| stock_level.warehouse pertenece a stock_level.organization | Normalmente sí por aplicación | No compuesto | FK organization/warehouse independientes | 🔴 |
| requisition_item.organization = requisition.organization | Sí en generate | No compuesto | dos FK independientes | 🟡 |
| requisition_item.inventory_item pertenece a misma org | Sí en generate | No compuesto | FK simple | 🟡 |
| supplier_return relaciona requisición, receipt, item, warehouse y org | Sí | Sí, trigger dedicado | `cmms_validate_supplier_return_item()` | 🟢 |
| source_movement_id único | Solo importación lo usa | Sí cuando no vacío | unique index por org | 🟢 para importación; no cubre manual |
| item.site_id = warehouse.site_id | No es una regla general | No | transferencias intra-org pueden cruzar sedes | ⚪ decisión de dominio pendiente |

### 4.1 Garantizado por aplicación

Los endpoints manuales garantizan antes del INSERT:

```text
item.organization
=
warehouse.organization
=
destination.organization (cuando aplica)
```

y además aplican autorización de sesión sobre item y bodegas.

La recepción/devolución de requisiciones también limita bodegas por organization y, para usuarios site-limited, por `session.siteIds`.

### 4.2 Garantizado por PostgreSQL

PostgreSQL garantiza actualmente:

- existencia de organization, item y warehouses mediante FK individuales;
- tipos de movimiento permitidos;
- stock no negativo;
- origen distinto de destino en transferencia a través del trigger;
- serialización del saldo origen mediante `FOR UPDATE`;
- aplicación atómica origen/destino;
- unicidad de source movement para importaciones;
- relaciones detalladas de supplier returns mediante `cmms_validate_supplier_return_item()`.

### 4.3 No garantizado actualmente

PostgreSQL no demuestra de forma general:

```text
NEW.organization_id = inventory_items.organization_id

NEW.organization_id = source warehouse.organization_id

NEW.organization_id = destination warehouse.organization_id

inventory_stock_levels.organization_id
  = item.organization_id
  = warehouse.organization_id
```

Por tanto, el modelo depende de que todos los caminos de escritura usen correctamente las validaciones de aplicación.

### 4.4 Casos negativos solicitados

#### Caso A

```text
organization A
+ item organization B
+ warehouse organization A
```

API manual: rechazado porque el usuario debe tener acceso al item y la organization del movimiento se deriva del item.

PostgreSQL raw/directo: no existe constraint compuesta que exprese la incompatibilidad.

#### Caso B

```text
organization A
+ item organization A
+ warehouse organization B
```

API manual: rechazado por la búsqueda de warehouse filtrada por organization del item.

PostgreSQL raw/directo: FK individuales permiten que item y warehouse existan aunque sean de organizaciones diferentes.

#### Caso C

```text
organization A
+ item A
+ origin warehouse A
+ destination warehouse B
```

API manual/importación: rechazado.

PostgreSQL: el trigger comprueba que el destino exista y sea distinto, pero no compara organization del destino con organization del item/transacción.

#### Caso D

```text
item organization A
+ warehouse A2 en otra sede de la misma organización
```

Esto no es automáticamente una inconsistencia de datos.

- usuario limitado a site A1: `canAccessInventoryWarehouse()` impide usar A2;
- usuario con acceso a todas las sedes: el flujo puede utilizar una bodega A2 de la misma organización;
- PostgreSQL no impone igualdad entre `item.site_id` y `warehouse.site_id`.

La validez comercial de transferencias cross-site dentro de una organización sigue siendo una decisión de dominio abierta y no debe confundirse con una fuga de autorización.

---

## 5. Transferencias

### 5.1 Organización

Los endpoints manuales consultan origen y destino con:

`WHERE organization_id = organization del item`

por lo que ambos deben ser de la misma organización en la aplicación.

La importación obtiene bodegas desde catálogos de la organización y aplica `canAccessInventoryWarehouse()`.

PostgreSQL no vuelve a validar expresamente esta igualdad.

### 5.2 Sedes

Una transferencia entre sedes de la misma organización es técnicamente posible cuando la sesión tiene autorización sobre ambas.

Un usuario limitado a una sola sede no puede seleccionar/usar una bodega fuera de `session.siteIds` en las rutas manuales protegidas por I0.

### 5.3 Item

Los endpoints manuales obtienen el item directamente y aplican `canAccessInventoryItem()`.

### 5.4 Atomicidad

Una transferencia utiliza un solo registro:

`inventory_transactions(type='transfer')`

El trigger:

1. bloquea saldo origen;
2. valida saldo;
3. resta origen;
4. suma destino;
5. recalcula total del item.

Si cualquier parte falla, el INSERT y el trigger completo se revierten.

No existe escenario normal en que el movimiento quede confirmado con solo la salida y sin la entrada.

### 5.5 Stock insuficiente

Si:

`current_qty + delta < 0`

el trigger lanza:

`Insufficient inventory stock for movement`

y el INSERT se revierte.

### 5.6 Concurrencia

El `FOR UPDATE` sobre origen serializa movimientos que consumen el mismo saldo.

No obstante:

- dos transferencias duplicadas pueden ejecutarse ambas si hay saldo suficiente;
- el lock no es una idempotency key;
- transferencias opuestas entre las mismas bodegas pueden generar espera/deadlock y PostgreSQL podría abortar una de las transacciones; eso preserva consistencia aunque exige manejo de error.

### 5.7 Cross-organization

Aplicación: bloqueado en los caminos revisados.

PostgreSQL: no existe una invariancia general que garantice que origin/destination warehouses coincidan con organization del item.

---

## 6. Requisiciones

La tabla `supplier_requisitions` no tiene `site_id`.

El site scope está representado a nivel de:

`supplier_requisition_items.site_id`

Una misma requisición puede contener múltiples sedes cuando el creador tiene alcance suficiente, porque `generate/route.ts` agrupa por:

`organization_id + supplier_id`

y no por site.

Esto hace que definir el scope de lectura de una requisición sea una decisión de dominio real, no solo una corrección SQL.

| Área | Scope actual | Scope esperado | Evidencia | Riesgo |
| --- | --- | --- | --- | --- |
| Listado `/dashboard/requisitions` | tenant: organization | Debe definirse política site-aware para usuario limitado | query solo `r.organization_id=$1` | 🔴 puede listar requisiciones de otra sede |
| Detalle `/dashboard/requisitions/[id]` | organization | Debe aplicar política aprobada de requisición completa/mixed-site | `canAccessOrganization()` solamente | 🔴 usuario site A puede abrir req site B |
| Líneas | requisition_id | Heredar scope del recurso requisición | sin filtro site | 🔴 expone líneas de otras sedes |
| Recepciones visibles | requisition_id | Heredar scope de requisición | query por `t.requisition_id` | 🔴 expone recepción de otras sedes |
| Supplier returns visibles | requisition_id | Heredar scope de requisición | query por `sr.requisition_id` | 🔴 expone devoluciones |
| Export base | organization + requisition id | Mismo scope que detalle | carga items/returns sin site filter | 🔴 export puede filtrar menos que la política deseada |
| Conciliación en export | organization + todos los sites no-null autorizados | coherente | check explícito de sites antes de reconciliación | 🟢 |
| Selector de bodegas | limited: site null OR authorized sites | Debe ser compatible con mutación | incluye `w.site_id IS NULL` | 🟡 opción legacy visible pero no utilizable |
| Generación | organization + item site | correcto | `canAccessOrganization` + `canAccessSite` | 🟢 |
| Edición general POST | organization | Debe respetar política site de requisición | no revisa sites de líneas | 🔴 mutación cross-site dentro de org posible |
| Aprobación | organization + cobertura de todos los sites no-null | correcto para recurso completo | compara DISTINCT site_id con session.siteIds | 🟢 |
| Recepción | organization + site del item enviado + warehouse site | correcto para línea mutada | check de item + warehouse `site_id=ANY` | 🟢/🟡 solo valida líneas enviadas |
| Supplier return | organization + site del receipt enviado + warehouse site | correcto para línea mutada | check de receipt + warehouse `site_id=ANY` | 🟢/🟡 solo valida líneas enviadas |
| Documento procurement create/update/download | organization + cobertura completa de sites no-null | correcto | site check sobre líneas de la requisición | 🟢 |

### 6.1 Confirmación del posible leak de lectura

Sí: la hipótesis previa sigue siendo válida.

Un usuario tenant limitado a site A, con `requisitions.read`, puede leer una requisición de site B de la misma organización si conoce el ID, porque:

1. el detalle carga la requisición por ID;
2. valida `canAccessOrganization()`;
3. no valida `session.siteIds` antes de devolver el recurso;
4. luego carga todas las líneas/recepciones/devoluciones por `requisition_id`.

El listado también opera a nivel organización.

### 6.2 Selector de bodegas legacy

Para una sesión limitada:

```sql
WHERE w.organization_id=$1
  AND w.active=true
  AND (w.site_id IS NULL OR w.site_id=ANY($2::uuid[]))
```

Las rutas de recepción/devolución utilizan:

```sql
AND site_id=ANY($3::uuid[])
```

sin permitir `site_id IS NULL`.

Por tanto, el detalle puede mostrar una bodega legacy que el servidor rechazará cuando se intente usar.

### 6.3 Mutación vs lectura

No existe una sola política homogénea:

- list/detail/export base: organization;
- edit general: organization;
- approval/reconciliation: complete-site coverage;
- receipt/return: site de las líneas que se están mutando + bodega;
- warehouse selector: authorized site o null.

I2-A2 necesita definir una política explícita y aplicarla consistentemente.

---

## 7. Pruebas exploratorias

No se creó ningún test permanente.

El entorno disponible permite ejecutar los smokes ya existentes, pero no permite agregar comandos ad hoc sin modificar workflow/script, acción expresamente prohibida para este diagnóstico.

### 7.1 Estado de regresiones actuales

Run actual revisado:

`36546657502`

HEAD:

`62da1f53e6d4c9d916151ced1f6309a2cf70068e`

Resultado:

**SUCCESS**

Pasaron:

- `inventory-kardex-smoke.mjs`;
- `inventory-kardex-server-pagination-smoke.mjs`;
- `inventory-scope-smoke.mjs`;
- `inventory-server-pagination-smoke.mjs`;
- `unified-inventory-import-smoke.mjs`;
- `requisition-receipt-smoke.mjs`;
- `requisition-approval-smoke.mjs`;
- `supplier-return-smoke.mjs`;
- `procurement-reconciliation-smoke.mjs`;
- `npm run build`.

### 7.2 Stock negativo y transferencia

Escenario:

`receipt → issue → transfer → adjustment → issue inválido`

Resultado esperado:

- stock final consistente;
- issue que deja saldo negativo rechazado.

Resultado observado:

`inventory-kardex-smoke.mjs` pasa y verifica ambos comportamientos.

Evidencia:

el smoke crea dos bodegas, ejecuta receipt/issue/transfer/adjustment, compara `inventory_items.quantity` contra stock físico y exige que un issue de 999 sea rechazado.

Conclusión:

**🟢 atomicidad básica y negative-stock protection comprobadas.**

### 7.3 Idempotencia de importación

Escenario:

mismo `source_movement_id` dos veces.

Resultado esperado:

segundo movimiento rechazado.

Resultado observado:

`unified-inventory-import-smoke.mjs` pasa.

Evidencia:

usa SAVEPOINT, intenta duplicar `source_movement_id` y comprueba que el UNIQUE rechace el duplicado.

Conclusión:

**🟢 idempotencia externa/importación protegida.**

### 7.4 Supplier return inválido

Escenario:

devolver más cantidad que la recepción origen.

Resultado esperado:

rechazo.

Resultado observado:

`supplier-return-smoke.mjs` pasa.

Evidencia:

el smoke intenta una línea inválida dentro de SAVEPOINT y exige que `cmms_validate_supplier_return_item()` la rechace.

Conclusión:

**🟢 protección del máximo por receipt confirmada.**

### 7.5 Double POST manual

Escenario:

```text
POST movimiento X
POST movimiento X
```

Resultado esperado para una futura protección:

una única aplicación física o replay idempotente.

Resultado observado:

**prueba HTTP no ejecutada**, porque no existe un test de este caso y agregar un script/workflow temporal violaría la instrucción.

Evidencia disponible:

los dos endpoints no generan ni validan una idempotency key y cada POST válido ejecuta un INSERT independiente.

Conclusión:

**🔴 código actual permite duplicación si ambas solicitudes son válidas.**

### 7.6 Concurrent duplicate POST

Escenario:

dos POST equivalentes simultáneos.

Resultado esperado futuro:

una sola operación lógica.

Resultado observado:

**no ejecutado** por la misma restricción.

Evidencia:

el trigger tiene `FOR UPDATE` de saldo pero no lock/UNIQUE de identidad de request.

Conclusión:

**🔴 consistencia de saldo sí; idempotencia no.**

### 7.7 Cross-organization item/warehouse

Escenarios:

```text
org A + item B + warehouse A
org A + item A + warehouse B
org A + item A + origin A + destination B
```

Resultado esperado futuro:

rechazo también en capa DB.

Resultado observado:

**no ejecutado como inserción ad hoc** porque no existe smoke específico y no se agregó SQL temporal.

Evidencia:

el esquema contiene FK individuales y el trigger no compara organizations.

Conclusión:

**🔴 aplicación protege los caminos conocidos; DB no expresa la invariancia.**

### 7.8 Site-limited requisition read

Escenario:

usuario site A → requisición site B en misma organización.

Resultado esperado futuro:

depende de la política de dominio que se apruebe, pero no debe existir lectura accidental no definida.

Resultado observado:

**no ejecutado con sesión HTTP controlada**.

Evidencia:

lista y detalle filtran por organización; no aplican site filter.

Conclusión:

**🔴 exposición cross-site posible por diseño actual del query.**

### 7.9 Warehouse selector legacy

Escenario:

usuario limitado visualiza warehouse `site_id=NULL`.

Resultado esperado futuro:

selector y mutación deben usar la misma política.

Resultado observado:

evidencia directa de query: el selector incluye NULL, receipt/return routes no.

Conclusión:

**🟡 inconsistencia confirmada por código.**

---

## 8. Hallazgos

### 🔴 Crítico

#### Ausencia de idempotencia manual

Un doble POST válido puede generar dos transactions y dos aplicaciones al stock.

Impacto:

- doble entrada;
- doble salida;
- doble ajuste;
- doble transferencia;
- doble devolución a inventario.

#### Ausencia de invariantes cross-organization a nivel PostgreSQL

Las FK individuales no impiden combinaciones incompatibles item/warehouse/organization cuando una escritura evita la capa API.

Impacto:

- corrupción multiempresa potencial ante un nuevo camino de escritura, script o error futuro;
- `inventory_stock_levels.organization_id` podría no representar realmente la organización simultánea de item+warehouse.

#### Requisition read scope a nivel organización

Un usuario limitado por site puede leer requisiciones, líneas y trazabilidad de otra sede de la misma organización.

Impacto:

- fuga lateral de información operacional;
- diferencia entre lectura y mutación.

#### Requisition edit POST sin site revalidation

La ruta de edición general autoriza organización pero no comprueba los sites de las líneas.

Impacto:

- usuario site-limited con permiso de escritura podría modificar cantidad/costo/estado de una requisición fuera de su site scope.

#### Export base de requisición sin site scope

El export carga ítems/devoluciones por requisition ID tras validar organización.

Impacto:

- posible extracción de información cross-site aunque la conciliación documental tenga un check más estricto.

### 🟡 Parcial

#### Receipt idempotency

Locks evitan carreras sobre `quantity_received` y sobre-recepción, pero no distinguen un retry de una segunda recepción parcial válida.

#### Supplier-return idempotency

Locks y triggers evitan devolver más que lo recibido, pero no distinguen un retry de una segunda devolución parcial válida.

#### Dos endpoints manuales equivalentes

La misma semántica está duplicada en:

- `/api/inventory/movements`;
- `/api/inventory/[id]/movement`.

Esto aumenta el riesgo de que futuras protecciones se apliquen a uno y no al otro.

#### Selector de warehouse legacy

La UI puede ofrecer un warehouse `site_id=NULL` que la mutación rechaza.

#### Requisition mixed-site

La cabecera no tiene site. La requisición puede agrupar múltiples sites, por lo que la política correcta de lectura parcial/completa debe definirse antes de implementar.

### 🟢 Correcto

- un solo Kardex operativo;
- `inventory_stock_levels` como autoridad física;
- trigger central de stock;
- negative-stock protection;
- transferencias atómicas;
- source/destination authorization I0 en endpoints manuales;
- import idempotency;
- supplier-return relation trigger;
- approval site validation;
- procurement reconciliation site validation;
- CI/regresiones actuales en verde.

---

## 9. Propuesta de alcance de I2-A2

### Indispensable para I2-A2

#### A. Idempotencia de movimientos manuales

I2-A2 debe definir y aplicar una identidad de operación a los dos endpoints manuales.

Debe garantizar:

```text
mismo request lógico
+ retry secuencial
+ retry concurrente
→ una sola operación física
```

No debe asumirse automáticamente que el actual `source_movement_id` de importación sea la solución correcta.

La decisión debe definir:

- origen de la clave;
- persistencia;
- alcance por organización;
- comportamiento de replay;
- respuesta ante payload distinto con misma clave;
- compatibilidad con ambos endpoints.

#### B. Invariantes organization/item/warehouse en PostgreSQL

Debe existir una garantía DB para que una transaction no pueda relacionar:

- organization A con item B;
- item A con warehouse B de otra organization;
- destination warehouse de otra organization.

También debe garantizarse que `inventory_stock_levels.organization_id` no contradiga item y warehouse.

Antes de agregar constraints/triggers definitivos debe ejecutarse un preflight de datos existentes y legacy.

No se recomienda una migración destructiva ni reescritura de Kardex histórico.

#### C. Scope de Requisiciones

Antes del cambio se debe aprobar una regla de dominio para una requisición mixed-site.

Después, la misma política debe aplicarse al menos a:

- listado;
- detalle;
- líneas;
- receipts;
- returns;
- export;
- edición general;
- documentos relacionados.

Approval/reconciliation ya ofrecen una referencia de política de recurso completo, pero I2-A2 no debe asumirla sin decisión explícita.

#### D. Selector de bodegas

Debe quedar alineado con la misma regla que usan las mutaciones.

Para usuario limited-site debe decidirse explícitamente qué hacer con warehouse `site_id=NULL` legacy.

#### E. Idempotencia de recepciones/devoluciones auxiliares

Debe decidirse si los requests de:

- receipt de requisición;
- supplier return

también necesitan una identidad de operación independiente de sus locks de cantidad.

Desde integridad transaccional, el riesgo de doble parcial existe y debe cerrarse o quedar explícitamente aceptado/documentado.

#### F. Smoke permanente de I2-A2

Solo durante implementación futura deberá crearse:

`scripts/inventory-i2a2-transaction-integrity-smoke.mjs`

Casos mínimos:

1. double POST;
2. concurrent duplicate POST;
3. cross-organization item;
4. cross-organization warehouse;
5. cross-organization destination warehouse;
6. invalid transfer;
7. valid same-org transfer;
8. site-limited requisition read;
9. site-limited warehouse selector;
10. legacy warehouse `site_id=NULL`.

Casos adicionales recomendables:

11. duplicate partial requisition receipt;
12. concurrent partial requisition receipt;
13. duplicate partial supplier return;
14. transfer with insufficient stock;
15. two concurrent issues against same stock;
16. raw DB invariant attempts;
17. mixed-site requisition policy;
18. requisition export scope.

### Fuera de I2-A2

#### I2-B

- inmutabilidad general de `inventory_transactions`;
- auditoría adicional;
- motivo obligatorio de ajustes;
- consistencia exacta de export Kardex;
- historial individual `LIMIT 200`.

#### I2-C

- saldo por lote;
- FEFO;
- reservas;
- valoración.

#### I3

- materiales de Work Orders;
- reserva;
- consumo;
- devolución de sobrantes;
- `parts_cost`.

No deben mezclarse con I2-A2.

---

## 10. Decisiones de dominio pendientes

### 10.1 Clave de idempotencia

Pendiente definir si:

- se reutiliza formalmente `source_movement_id`;
- se crea una identidad de operación manual separada;
- la clave la genera frontend, backend o ambos;
- el mismo mecanismo se extiende a receipt/supplier return.

No cerrar esta decisión accidentalmente.

### 10.2 Scope organization/site de Requisiciones

La cabecera es organization-level y las líneas pueden representar distintos sites.

Debe definirse si un limited-site user:

- solo puede ver requisiciones cuyas líneas estén 100 % dentro de su scope;
- puede ver una requisición mixed-site con visibilidad parcial;
- puede verla completa si contiene al menos una línea propia.

La segunda/tercera alternativa introduce riesgos importantes de totales, documentos y auditoría parcial.

### 10.3 Invariantes DB vs API

Debe decidirse cuáles invariantes deben ser imposibles incluso desde SQL directo.

Candidatas claras para DB:

- transaction organization/item;
- transaction organization/source warehouse;
- transaction organization/destination warehouse;
- stock-level organization/item/warehouse.

Autorización de usuario/site debe permanecer en API/RBAC, no trasladarse a constraints estáticas.

### 10.4 Movimientos históricos/legacy

Existen movimientos históricos creados antes del modelo completo de warehouse y migraciones que inicializaron stock.

Cualquier constraint nuevo debe auditar:

- `warehouse_id NULL` histórico;
- posibles warehouses legacy `site_id=NULL`;
- datos creados antes de constraints nuevas.

No debe borrarse ni reescribirse historia para simplificar I2-A2.

### 10.5 Transferencias entre sedes

Actualmente una transferencia same-organization cross-site es posible para quien tenga autorización sobre ambas sedes.

Debe definirse si esa capacidad:

- es comportamiento comercial esperado;
- requiere una política adicional;
- depende del tipo de warehouse/site.

No confundir esto con cross-organization, que sí debe considerarse incompatible.

---

## 11. Compatibilidad

### Inventario existente

I2-A2 no debe recalcular stock histórico ni crear una segunda fuente de verdad.

### Kardex

No debe reescribirse `inventory_transactions`.

Una futura idempotency key debe preservar movimientos históricos sin dicha clave.

### Importaciones

La semántica actual de:

- `source_movement_id`;
- hash de archivo;
- commit scope;
- advisory lock

debe mantenerse.

Una protección manual no debe producir colisiones con IDs externos/importados.

### Procurement

Recepciones y supplier returns dependen del mismo trigger de stock.

Cambios de integridad DB deben seguir permitiendo estas relaciones válidas.

### Requisiciones

La política site-aware debe manejar requisiciones mixed-site sin romper:

- aprobación;
- recepción parcial;
- supplier returns;
- conciliación;
- export.

### Supplier returns

Debe preservarse `cmms_validate_supplier_return_item()` y la inmutabilidad específica ya existente.

### Multi-sede

No imponer por accidente:

`item.site_id = warehouse.site_id`

mientras esa decisión de dominio siga abierta.

### Organizaciones

El HEAD actual incorpora organization scope explícito para platform owner/superadmin. Las nuevas invariantes DB deben ser independientes del rol y garantizar coherencia del dato para cualquier escritor.

### Movimientos históricos

No proponer migraciones destructivas.

Antes de cualquier constraint nueva debe existir:

1. auditoría de incompatibilidades actuales;
2. tratamiento explícito de legacy;
3. estrategia backward-compatible.

---

## Cierre

La integridad actual está bien protegida frente a:

- stock negativo;
- aplicación parcial de una transferencia;
- sobre-retorno supplier return;
- duplicados identificados en importación;
- operaciones manuales fuera del scope I0 mediante los endpoints conocidos.

No está suficientemente protegida frente a:

- retries/double submit de movimientos manuales;
- retries parciales de recepción/devolución;
- escrituras cross-organization que eviten la capa API;
- lectura/export/edit de Requisiciones por site de forma consistente.

Este diagnóstico no implementa ninguna corrección.

No se creó `scripts/inventory-i2a2-transaction-integrity-smoke.mjs`.

No se modificó I2-A1, Inventario funcional, PostgreSQL, Procurement, Assets ni Work Orders.
