# Inventario I2-A2.1 — Implementación de integridad de movimientos

Fecha: 2026-09-29  
Diagnóstico base: `3843d5c970f14427836cfa822af5e0824b22ee80`

## 1. Problema

El diagnóstico I2-A2 confirmó dos riesgos dentro del flujo manual de Inventario:

1. cada POST válido generaba un nuevo `inventory_transactions`, por lo que retries y doble submit podían aplicar stock dos veces;
2. las relaciones organization/item/warehouse estaban protegidas por la aplicación, pero PostgreSQL tenía solamente FK individuales.

I2-A2.1 corrige únicamente esos dos grupos junto con transferencias y pruebas permanentes.

No modifica Requisiciones, Work Orders, Assets, lotes, FEFO, valoración, reservas ni el historial individual del Kardex.

## 2. Decisión de idempotencia

Se agrega a `inventory_transactions`:

- `manual_idempotency_key uuid NULL`;
- `manual_payload_hash text NULL`.

Solo los nuevos movimientos manuales utilizan estos campos.

Los movimientos históricos, importaciones, recepciones de requisiciones y supplier returns pueden mantener ambos campos en NULL.

La clave representa una operación lógica del cliente. La UI genera un UUID por formulario renderizado. También se acepta el header HTTP:

`Idempotency-Key`

No se reutiliza `source_movement_id`: ese campo conserva exclusivamente su semántica externa/importación.

## 3. Hash del payload

La API calcula SHA-256 sobre los campos que definen el movimiento:

- organization;
- item;
- type;
- signed quantity;
- unit cost;
- source warehouse;
- destination warehouse;
- document;
- movement timestamp enviado;
- actor;
- lot;
- expiration;
- cost center;
- notes.

Resultado:

```text
key A + payload X
key A + payload X
→ replay

key A + payload X
key A + payload Y
→ HTTP 409
```

No se deduce identidad desde cantidad, documento o fecha.

## 4. Concurrencia

El helper compartido `lib/inventory-manual-movement.ts` utiliza una transacción PostgreSQL y:

`pg_advisory_xact_lock(hashtextextended(organization + key))`

El lock está limitado a una organización+clave concreta; no es global.

Después del lock:

1. busca un movimiento previo con la misma clave;
2. si el hash coincide, devuelve `replayed`;
3. si el hash no coincide, devuelve `conflict`;
4. si no existe, inserta exactamente un `inventory_transactions`.

Además existe un UNIQUE parcial:

```text
(organization_id, manual_idempotency_key)
WHERE manual_idempotency_key IS NOT NULL
```

La constraint es la garantía estructural incluso si otro escritor no usa el advisory lock.

## 5. Camino de stock preservado

I2-A2.1 no reemplaza ni modifica `cmms_apply_inventory_transaction()`.

El flujo continúa siendo:

```text
manual endpoint
↓
shared idempotent insert helper
↓
inventory_transactions
↓
existing AFTER INSERT trigger
↓
cmms_apply_inventory_transaction()
↓
inventory_stock_levels
↓
inventory_items.quantity
```

Se preservan:

- `SELECT ... FOR UPDATE`;
- protección de stock negativo;
- atomicidad de transferencias;
- única fuente de stock físico.

## 6. Invariantes PostgreSQL

Se agregan claves de referencia organization-aware para filas nuevas/actualizadas:

### inventory_transactions

- `(item_id, organization_id)` → `inventory_items(id, organization_id)`;
- `(warehouse_id, organization_id)` → `inventory_warehouses(id, organization_id)`;
- `(destination_warehouse_id, organization_id)` → `inventory_warehouses(id, organization_id)`.

### inventory_stock_levels

- `(item_id, organization_id)` → `inventory_items(id, organization_id)`;
- `(warehouse_id, organization_id)` → `inventory_warehouses(id, organization_id)`.

Esto impide nuevos estados cross-organization incluso si una escritura evita la validación de API.

## 7. Compatibilidad histórica

Las FK nuevas se crean `NOT VALID`.

PostgreSQL las aplica inmediatamente a filas nuevas o relaciones modificadas, pero no obliga a reescribir movimientos históricos.

La migración audita el histórico:

- si una relación está limpia, valida la constraint;
- si detecta incompatibilidades legacy, deja esa constraint `NOT VALID` y emite un warning con el conteo.

No borra ni corrige silenciosamente historia.

## 8. Transferencias

I2-A2.1 conserva transferencias entre dos sedes distintas de la misma organización.

No se exige:

`item.site_id = warehouse.site_id`

La restricción es únicamente de organización.

Así se mantiene multi-sede:

```text
Org A / Site A1 / Warehouse A1
→
Org A / Site A2 / Warehouse A2
```

Una destination warehouse de otra organización queda rechazada por PostgreSQL.

Si una transferencia inválida falla después de comenzar la sentencia, toda la sentencia y el trigger se revierten; no queda una salida parcial.

## 9. Validaciones API

Los dos endpoints manuales siguen validando:

- permiso `inventory.write`;
- item activo;
- `canAccessInventoryItem()`;
- cantidad/costo;
- origen y destino;
- `canAccessInventoryWarehouse()`;
- site scope.

Además ahora requieren una clave UUID de idempotencia desde:

- campo `idempotency_key`, o
- header `Idempotency-Key`.

Los dos endpoints llaman al mismo helper compartido.

## 10. Importación

No se modifica:

- `source_movement_id`;
- hash de archivo;
- advisory lock de importación;
- batches;
- semántica de importación.

La nueva idempotencia manual es una semántica separada.

## 11. Pruebas

Se agrega:

`scripts/inventory-i2a2-transaction-integrity-smoke.mjs`

Valida:

1. double POST lógico → 1 transaction / 1 aplicación;
2. dos requests concurrentes → 1 created + 1 replayed;
3. misma key + payload diferente → conflict sin cambio de stock;
4. organization A + item B → rechazo;
5. organization A + warehouse B → rechazo;
6. destination warehouse B → rechazo;
7. transferencia válida same-org entre A1 y A2;
8. transferencia cross-org sin modificación parcial;
9. stock negativo;
10. duplicado `source_movement_id` de importación;
11. wiring de ambos endpoints y formularios;
12. permanencia de regresiones en CI.

## 12. Archivos

- `db/migrations/047_inventory_transaction_integrity.sql`;
- `lib/inventory-manual-movement.ts`;
- `app/api/inventory/movements/route.ts`;
- `app/api/inventory/[id]/movement/route.ts`;
- `app/dashboard/inventory/kardex/page.tsx`;
- `app/dashboard/inventory/[id]/page.tsx`;
- `scripts/inventory-i2a2-transaction-integrity-smoke.mjs`;
- `.github/workflows/ci.yml`;
- este documento.

## 13. Limitaciones restantes

Fuera de I2-A2.1 permanecen:

- scope de lectura/edición/export de Requisiciones → I2-A2.2;
- selector legacy de bodegas de Requisiciones → I2-A2.2;
- inmutabilidad general → I2-B;
- motivo obligatorio de ajustes → I2-B;
- historial individual LIMIT 200 → I2-B;
- lotes/FEFO/reservas/valoración → I2-C;
- materiales y costos de Work Orders → I3.

I2-A2.1 no inicia ninguna de esas fases.
