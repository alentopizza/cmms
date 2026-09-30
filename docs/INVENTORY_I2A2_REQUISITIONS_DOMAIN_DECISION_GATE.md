# I2-A2.2 — Domain Decision Gate

## Requisiciones por sede, centros de costo e históricos

Fecha: 2026-09-29  
Tipo: **decisión de dominio basada en evidencia; sin implementación funcional**.

HEAD inspeccionado:

`3a8a4ebd66889fbaa4e233390562f988f7cee402`

Diagnóstico técnico base:

`docs/INVENTORY_I2A2_REQUISITIONS_SITE_DIAGNOSIS.md`

Decisión de producto vigente:

> **Una requisición nueva = organización + sede + proveedor.**

Una requisición nueva no puede mezclar líneas de diferentes sedes.

Esta etapa no agrega `site_id`, no crea migraciones, no modifica APIs, SQL funcional, frontend, RBAC, datos ni smokes.

---

# 1. Decisiones cerradas

## 1.1 Históricos multi-sede

### Evidencia del repositorio

El modelo actual soporta de hecho requisiciones multi-sede:

```text
supplier_requisitions
├── organization_id
├── supplier_id
└── no site_id

supplier_requisition_items
└── site_id
```

El generador actual agrupa por:

`organization_id + supplier_id`.

Una misma cabecera puede contener líneas A1+A2.

Las dependencias históricas están enlazadas a la requisición y/o a sus líneas:

- `supplier_requisition_approval_events.requisition_id`;
- `inventory_transactions.requisition_id`;
- `inventory_transactions.requisition_item_id`;
- `supplier_returns.requisition_id`;
- `supplier_return_items.requisition_item_id`;
- `supplier_return_items.receipt_transaction_id`;
- `procurement_documents.requisition_id`;
- `procurement_document_lines.requisition_item_id`;
- `procurement_document_receipts.receipt_transaction_id`;
- `procurement_document_returns.supplier_return_id`;
- `audit_log.entity_id` guarda la referencia lógica de requisición.

Dos grupos de evidencia tienen además reglas de inmutabilidad fuertes:

1. `supplier_returns` y `supplier_return_items` no admiten UPDATE/DELETE normal después de publicados.
2. El núcleo de `procurement_documents`, sus líneas y enlaces de evidencia son inmutables. En particular no puede cambiarse `procurement_documents.requisition_id` mediante la operación normal.

Por tanto dividir una requisición histórica no equivale a separar líneas solamente.

### Alternativa A — dividir históricas

Para transformar:

```text
REQ-100
├── línea A1
└── línea A2
```

en:

```text
REQ-100? → A1
REQ-???  → A2
```

habría que decidir y migrar:

- qué ID conserva la identidad histórica;
- qué número conserva la requisición original;
- si se genera otro número retrospectivo;
- a qué nueva cabecera pertenecen approval events;
- qué ocurre con audit_log;
- cómo se reescriben `inventory_transactions.requisition_id`;
- cómo se preserva `requisition_item_id`;
- cómo se reasignan supplier returns inmutables;
- cómo se reasignan procurement documents inmutables;
- qué sucede con un documento que contiene líneas A1+A2;
- cómo se conservan estados globales y totales;
- cómo se interpreta una decisión de aprobación tomada sobre el total combinado.

La división puede destruir la semántica del documento comercial original aun si técnicamente se copian filas.

No existe en el repositorio una identidad de “batch de compra multi-requisición” que permita reconstruir después que las nuevas cabeceras eran una sola decisión histórica.

### Alternativa B — preservar legacy multi-sede

Mantener:

```text
supplier_requisitions.site_id = NULL
```

para una cabecera históricamente mixed-site.

Las líneas conservan sus sites históricos cuando los tienen.

No se parte la requisición.

### Alternativa C

No se encontró una necesidad técnica que justifique una tercera estrategia más invasiva.

Una tabla paralela de “requisiciones legacy” o duplicar documentos introduciría un segundo modelo del mismo dominio sin necesidad.

### Recomendación cerrada

**Preservar las requisiciones históricas verdaderamente multi-sede como legacy multi-sede con `supplier_requisitions.site_id=NULL`. No dividirlas.**

Esta política minimiza cambios de identidad y preserva:

- IDs;
- numeración;
- approvals;
- receipts;
- supplier returns;
- procurement documents;
- audit trail;
- exports históricos;
- referencias Kardex.

### Política de acceso para legacy multi-sede

#### Usuario limitado a una sola sede

No debe consultar una requisición legacy que tenga líneas en más de una sede.

Mostrar solo la parte A sería una nueva semántica parcial y puede exponer:

- estado global;
- total global;
- aprobación;
- notas;
- documentos binarios;
- devoluciones de otras sedes.

Resultado:

```text
site A user
+
legacy req A+B
→ no acceso
```

#### Usuario multi-sede

Puede consultar/operar una legacy mixed-site solo si su scope cubre **todos los sites explícitos de sus líneas**.

Ejemplo:

```text
user sites = [A,B]
legacy req sites = [A,B]
→ acceso

user sites = [A]
legacy req sites = [A,B]
→ no acceso
```

#### Línea con site desconocido

Si una legacy contiene al menos una línea cuyo site no puede determinarse, un usuario site-limited no puede demostrar cobertura completa.

Resultado:

```text
legacy req con site indeterminado
→ solo accessAllSites / plataforma con organization scope válido
  hasta regularización
```

No crear permiso nuevo para esto.

#### accessAllSites / perfil global

Mantener el modelo actual:

- autorización por organización;
- permiso funcional existente;
- acceso a legacy multi-sede.

### Edición legacy

No debe permitirse convertir una legacy mixed-site en una nueva requisición site-owned simplemente editando un campo de cabecera.

Recomendación:

- permitir operaciones de ciclo de vida que no reasignen identidad histórica, cuando el usuario cubra todo el scope;
- cantidades/costos/needed_by/notas pueden conservar las reglas actuales mientras la requisición esté editable;
- **no permitir agregar/reasignar una línea a otra sede**;
- evitar cambios estructurales que intenten “normalizar” automáticamente una mixed-site;
- una regularización administrativa de históricos debe ser un proceso explícito distinto.

### Aprobación legacy

La implementación actual ya exige cobertura completa de los sites de las líneas para un usuario limited-site.

Esa regla debe mantenerse para legacy:

```text
puede aprobar legacy
=
permiso approval
+
organization autorizada
+
cobertura de todos los sites conocidos
```

Si existen líneas sin site determinable:

- limited-site no aprueba;
- accessAllSites/global puede seguir el flujo actual.

### Recepción legacy

Una legacy multi-sede puede seguir recibiéndose por línea, porque el modelo ya relaciona receipt con:

- requisition;
- requisition item;
- inventory item;
- warehouse.

Para futuras protecciones:

```text
warehouse.site_id
=
line.site_id
```

en legacy.

No usar `header.site_id` porque será NULL.

El usuario debe cubrir la requisición legacy completa según la política anterior.

### Devolución legacy

Misma lógica:

- receipt determina la línea;
- línea determina el site histórico cuando es conocido;
- warehouse de devolución debe coincidir con el site de esa línea;
- no mover material implícitamente entre sedes.

### Export legacy

Export completo solamente cuando el usuario tiene autorización sobre el documento completo.

No crear export parcial.

### Documentos legacy

Documento procurement de una requisición mixed-site continúa siendo evidencia de esa requisición completa.

No clasificarlo automáticamente en A o B.

---

## 1.2 Históricos sin sede

### Evidencia disponible

Una línea puede tener:

`supplier_requisition_items.site_id IS NULL`.

Las fuentes potenciales son:

- `line.location_id`;
- `line.inventory_item_id → inventory_items.site_id`;
- receipts → warehouse.site_id;
- supplier returns → warehouse/site indirecto;
- procurement document lines;
- documentos binarios;
- contexto de cabecera.

No todas tienen la misma calidad histórica.

### Fuente 1 — line.location_id

Durante la generación actual se copian simultáneamente desde el item:

- `site_id`;
- `location_id`.

`locations` pertenece obligatoriamente a una sede.

La ruta normal de edición de location permite modificar:

- nombre;
- código;
- tipo;
- descripción;
- estado;

pero no cambia `location.site_id`.

Por ello, si una línea histórica tiene:

- `site_id=NULL`;
- `location_id` válido;
- location de la misma organización;

el site de esa location constituye la evidencia estructural más fuerte disponible en el repositorio.

### Fuente 2 — current inventory_item.site_id

No es una prueba histórica suficiente por sí sola.

La importación masiva actual puede ejecutar:

```sql
UPDATE inventory_items
SET site_id=...
```

Por tanto el item actual puede haber sido trasladado después de crear la requisición.

Clasificación:

**derivable con riesgo**, no automático por sí solo.

### Fuente 3 — warehouse de receipt

No es prueba inequívoca.

Hoy el flujo de recepción valida que el warehouse pertenezca a una sede autorizada, pero para usuarios con A+B o accessAllSites no exige que coincida con el site de la línea.

Una recepción A puede haber terminado en warehouse B.

Clasificación:

**derivable con riesgo**.

### Fuente 4 — supplier return warehouse

Tampoco prueba el site original.

La misma brecha cross-site existe en la selección de warehouse de devolución.

Clasificación:

**derivable con riesgo**.

### Fuente 5 — procurement documents

`procurement_documents` no tiene site.

`procurement_document_lines` referencia requisition item, pero tampoco almacena site.

Un PDF/archivo puede representar varias sedes.

Clasificación:

**no derivable desde el documento**.

### Fuente 6 — supplier documents

`supplier_documents` pertenece a organization+supplier, no a requisition/site.

No sirve para inferir sede.

### Política de derivación cerrada

#### Derivable inequívocamente

Una línea con `site_id=NULL` puede backfillearse automáticamente **solo** cuando existe una relación histórica directa y no ambigua.

Criterio mínimo aprobado:

```text
line.location_id IS NOT NULL
AND
location existe
AND
location.organization_id = line.organization_id
→ site = location.site_id
```

Antes de escribir debe comprobarse que no haya inconsistencia estructural evidente en la propia línea.

#### Derivable con riesgo

No auto-backfill desde:

- current inventory item site;
- receipt warehouse;
- return warehouse;
- nombre de ubicación;
- supplier;
- documento;
- texto libre.

Estas fuentes pueden usarse en un reporte de auditoría humana, no como verdad automática.

#### No derivable

Si no existe un location directo válido y no hay otra evidencia histórica inequívoca:

```text
line.site_id permanece NULL
```

No inventar.

### Política para cabecera con líneas NULL

Una requisición histórica puede obtener header.site_id solo si, después de resolver las líneas inequívocas:

1. todas las líneas tienen site determinable;
2. todas tienen exactamente el mismo site.

Si alguna línea sigue indeterminada:

`header.site_id = NULL`.

Si existen dos sites distintos:

`header.site_id = NULL` y se clasifica legacy multi-sede.

---

## 1.3 Thresholds de aprobación

### Estado actual

Configuración:

`organization_procurement_policies`

Una fila por organización.

Campos:

- `approval_mode`: `none | all | threshold`;
- `approval_threshold numeric(14,2)`;
- `approver_scope`: `admin_only | admin_manager`;
- `allow_requester_self_approval`.

No existe configuración:

- por proveedor;
- por site;
- por centro de costo;
- por rol aparte del scope de aprobadores;
- por moneda.

### Algoritmo de creación actual

En `POST /api/requisitions/generate`:

1. se cargan items;
2. se agrupan por `organization_id + supplier_id`;
3. para cada grupo se toma la cantidad enviada por formulario;
4. `unitCost = inventory_item.unit_cost`;
5. se calcula:

```text
estimatedTotal
=
Σ(quantity × unitCost)
```

6. se carga policy por organización;
7. si mode = `all` → approval required;
8. si mode = `threshold`:

```text
approvalRequired
=
estimatedTotal >= approval_threshold
```

9. la policy se copia a la requisición como snapshot;
10. el evento/audit guarda `estimated_total` y `threshold`.

### Reevaluación después de editar

`POST /api/requisitions/[id]` vuelve a calcular:

```text
totalEstimated
=
Σ(quantity_requested × unit_cost_estimated)
```

Si una requisición que antes no requería aprobación cruza el threshold:

- activa `approval_required`;
- pasa a pending;
- crea approval event;
- crea audit event.

Una vez que `approval_required=true`, el código evita que editar el monto permita “salirse” silenciosamente de la gobernanza.

Cambios de:

- cantidad;
- costo;
- needed_by;

pueden reabrir una aprobación ya decidida.

### Monto

El monto considerado es el **total estimado de las líneas de esa requisición**.

No se usa:

- valor de receipt;
- factura;
- purchase order;
- valor real del supplier return.

### Moneda

La policy no almacena moneda.

`supplier_requisitions` tampoco almacena moneda.

`inventory_items.unit_cost` es un numeric sin currency code.

La UI de settings muestra:

> Monto estimado mínimo

sin selector de moneda.

Por tanto, el algoritmo compara valores numéricos dentro del contexto monetario implícito de la organización.

Los documentos procurement sí tienen `currency_code`, pero ese campo no participa en el approval threshold de la requisición.

### Usuario/rol

El importe no cambia por usuario o rol.

El rol afecta quién puede aprobar mediante:

- `admin_only`;
- `admin_manager`.

Self-approval se controla aparte.

### Centro de costo

No participa.

No existe un cost center estructurado en la requisición.

### Ejemplo existente en pruebas

`scripts/requisition-approval-smoke.mjs` configura:

```text
approval_mode = threshold
approval_threshold = 1000
estimated_total registrado = 1500
```

y verifica el snapshot/event history.

Es un fixture técnico, no un dato productivo.

### Impacto del modelo futuro

Actual:

```text
Org A + Supplier X
Site A = 600
Site B = 600

group actual = 1200
threshold = 1000
→ approval required
```

Futuro:

```text
Org A + Site A + Supplier X = 600
Org A + Site B + Supplier X = 600
threshold = 1000

si threshold sigue siendo por requisición:
→ A no requiere
→ B no requiere
```

La separación por sede **sí puede cambiar el nivel de aprobación** cuando mode = `threshold`.

`none` y `all` no cambian por el split.

### Alternativas financieras

#### T1 — threshold por requisición site-specific

Mantener literalmente la semántica actual:

> cada requisición evalúa su propio total.

Después del cambio, cada site-specific requisition se evalúa por separado.

Ventaja:

- no requiere nueva entidad;
- conserva el algoritmo actual por requisición.

Consecuencia:

- una compra antes agregada puede dejar de cruzar threshold.

#### T2 — threshold agregado por compra lógica/proveedor

Evaluar juntos los grupos A+B nacidos de una misma acción.

Requeriría introducir una identidad adicional, por ejemplo:

- generation batch;
- purchase request;
- parent procurement request.

No existe hoy.

Además tendría que definirse si aprobación es:

- del batch;
- de cada requisición hija;
- una sola decisión propagada.

Es un cambio de dominio mayor.

#### T3 — threshold por sede

Configurar políticas distintas por site.

No existe hoy.

Requeriría cambiar `organization_procurement_policies` o introducir policy site-aware.

No hay evidencia de que este sea el objetivo actual.

### Decisión realmente pendiente

**El repositorio no determina cuál de T1/T2/T3 representa la política financiera deseada.**

No debe elegirse silenciosamente.

Antes de implementar la generación site-specific se necesita confirmar al menos:

> ¿El threshold continúa evaluándose por cada requisición individual después de separarla por sede?

---

## 1.4 Centros de costo

### Estado actual confirmado

No existe una tabla:

`cost_centers`.

No existe:

`cost_center_id`

en:

- supplier requisitions;
- requisition items;
- inventory items.

El único modelo encontrado es:

`inventory_transactions.cost_center text`.

Migración:

`031_inventory_kardex_metadata.sql`.

### Usos actuales confirmados

#### Movimiento manual general

`app/api/inventory/movements/route.ts`

recibe:

`form.get("cost_center")`.

#### Movimiento desde ficha de item

`app/api/inventory/[id]/movement/route.ts`

recibe el mismo texto.

#### Recepción de requisición

`app/api/requisitions/[id]/receive/route.ts`

recibe un único texto `cost_center` desde el formulario y lo graba en los receipt transactions generados por esa recepción.

No existe selección de master.

#### Supplier return

La devolución copia el `cost_center` del receipt origen al movimiento `supplier_return`.

#### Importación

`app/api/bulk-import/route.ts` reconoce columnas:

- `Centro de costo`;
- `Centro costo`.

El valor termina en `inventory_transactions.cost_center`.

#### Kardex

Se usa para:

- consulta;
- búsqueda;
- visualización;
- export.

#### Export de Kardex

`app/api/module-export/route.ts` exporta `cost_center`.

### ¿Existe otra entidad reutilizable con otro nombre?

No se encontró ninguna entidad del repositorio que tenga semántica equivalente a centro de costo.

`locations` representa jerarquía física.

`sites` representa sede.

`inventory_categories` representa clasificación de artículos.

Ninguna debe reutilizarse artificialmente como cost center.

### ¿Puede existir sin sede hoy?

Como texto libre: sí técnicamente, porque no tiene relación.

Como **nuevo centro de costo estructurado usado por Requisiciones**: la política propuesta es **no**.

Para cumplir:

```text
requisition.site_id = cost_center.site_id
```

el registro estructurado necesita site.

### ¿Puede pertenecer a varias sedes?

No existe evidencia de una semántica multi-sede actual porque no existe master.

Para el modelo mínimo de Procurement/Inventory, un registro individual debe pertenecer a una sola sede.

Si el mismo código conceptual se usa en varias sedes, puede existir un registro por sede.

No introducir many-to-many en el mínimo.

### Unicidad propuesta

Modelo mínimo:

```text
cost_centers
-------------
id
organization_id
site_id
code
name
status
created_at
updated_at
```

Índice/constraint propuesta:

```text
UNIQUE (organization_id, site_id, code)
```

### Relación con requisition items

Relación opcional:

`supplier_requisition_items.cost_center_id`.

Garantía futura:

```text
line.organization_id
=
cost_center.organization_id

line.site_id
=
cost_center.site_id
=
requisition.site_id
```

Preferir FK compuesta cuando el esquema esté preparado.

### Histórico

No mapear automáticamente `inventory_transactions.cost_center text` hacia IDs.

El texto histórico puede contener:

- variantes;
- abreviaturas;
- errores;
- códigos externos;
- valores que ya no existen.

Conservarlo como snapshot/auditoría.

### Impacto

Introducir master afectaría, como mínimo:

- RequisitionBuilder/detalle si se selecciona en la línea;
- generación;
- edición de líneas;
- recepción;
- movimientos manuales si se decide migrarlos al master;
- importación;
- Kardex display/export;
- catálogos/administración.

No debe mezclarse accidentalmente con la primera migración de `supplier_requisitions.site_id` si la definición de cost center todavía no está cerrada.

### Decisión cerrada

Para nuevas Requisiciones:

- un cost center estructurado debe ser site-owned;
- no debe ser multi-site;
- código único por organization+site;
- relación en requisition item;
- cost center opcional;
- si existe, debe coincidir con requisition.site_id;
- texto histórico de Kardex se preserva.

### Pregunta todavía pendiente de centro de costo

El repositorio no define:

- quién administra el catálogo;
- formato/regla del code;
- si toda línea de requisición debe exigir cost center o solo algunas.

Estas son decisiones de producto, no inferibles del código.

---

## 1.5 Documentos históricos multi-sede

### Tipos de documentos encontrados

#### supplier_documents

Tabla de expediente del proveedor.

Relación:

```text
organization
→ supplier
→ supplier_document
```

No referencia requisition.

No debe convertirse automáticamente en site-owned por I2-A2.2.

#### procurement_documents

Relación:

```text
organization
→ supplier
→ requisition
→ procurement_document
```

Tipos:

- purchase_order;
- delivery_note;
- invoice;
- credit_note;
- other.

Guarda:

- document number;
- currency;
- subtotal;
- tax;
- total;
- archivo binario;
- estado de revisión.

#### procurement_document_lines

Relaciona el documento con requisition items.

#### procurement_document_receipts

Relaciona documento con receipt transactions.

#### procurement_document_returns

Relaciona documento con supplier returns.

#### procurement_document_events

Auditoría del documento.

### Inmutabilidad

El núcleo del procurement document es inmutable:

- organization;
- supplier;
- requisition;
- document type/number;
- monetary values;
- file;
- metadata de creación.

Las líneas y enlaces de evidencia también son inmutables.

Esta es evidencia fuerte contra dividir/reasignar documentos históricos.

### ¿Puede un documento actual representar varias sedes?

Sí conceptualmente.

Como una procurement document pertenece a una requisición y la requisición actual puede ser multi-sede, el documento puede representar una compra/remisión/factura asociada a líneas A+B.

Además el archivo binario puede contener ambas sedes en un mismo PDF/imagen.

No existe un mecanismo para partir de manera segura el archivo por site.

### Futuro

Para una requisición nueva single-site:

```text
document
→ requisition
→ site
```

es suficiente como source of truth.

No es necesario duplicar `site_id` en `procurement_documents` únicamente para autorización.

La frontera debe ser:

1. autorizar requisition;
2. verificar que document.requisition_id = requisition.id;
3. operar documento.

### Históricos multi-sede

Política cerrada:

- mantener documento ligado a la requisición legacy original;
- no asignar un site artificial;
- no duplicar archivo;
- no cambiar requisition_id;
- no dividir líneas documentales;
- no reescribir receipts/returns evidence.

Acceso:

- limited user solo si cubre completamente el scope de la requisición legacy;
- site indeterminado → accessAllSites/global hasta regularización;
- export/document download sigue siendo completo, no parcial.

### ¿Necesitan clasificación adicional?

Puede ser útil **reportarlos** durante preflight:

```text
legacy mixed-site requisition
+
procurement_documents > 0
```

pero no necesitan una migración de site propia.

Su clasificación se hereda de la requisición legacy.

### Exports

Los exports de requisición son generados on demand.

No existe una tabla de export histórico que haya que migrar.

El futuro export site-aware autoriza la requisición antes de generar.

---

# 2. Política propuesta implementable

## 2.1 Nuevas requisiciones

```text
requisition.organization_id = O
requisition.site_id = S
requisition.supplier_id = P
```

Todas las líneas deben cumplir:

```text
line.organization_id = O
line.site_id = S
item.organization_id = O
item.site_id = S
```

Una línea nueva con item site NULL no es válida para una requisición site-owned.

## 2.2 Generación

Agrupar por:

```text
organization_id + site_id + supplier_id
```

Nunca mezclar A+B en una cabecera.

Multi-site user puede generar simultáneamente varias cabeceras, una por site.

## 2.3 Scope de usuario

### limited-site

```text
organization authorized
AND
requisition.site_id ∈ session.siteIds
```

### accessAllSites/global

Mantener organization scope y permisos existentes.

No crear RBAC paralelo.

## 2.4 Warehouse

Nueva requisición A:

```text
receipt warehouse.site_id = A
return warehouse.site_id = A
```

aunque el usuario tenga A+B.

Movimiento posterior A→B:

usar transferencia de Inventario.

## 2.5 Cost center

Cuando exista master:

```text
line.cost_center_id → cost_center(site A)
requisition.site_id = A
```

No cost center B en req A.

## 2.6 Legacy mixed-site

```text
header.site_id = NULL
classification = legacy_mixed
```

No dividir.

Autorización limited:

cobertura completa de line sites.

## 2.7 Legacy unresolved

```text
header.site_id = NULL
classification = legacy_unresolved
```

No limited-site access hasta regularización.

AccessAllSites/global mantiene acceso según permisos/organization.

## 2.8 Documentos

Nuevo:

`site heredado de requisition`.

Legacy:

`scope heredado de clasificación legacy de requisition`.

---

# 3. Casos históricos

| Caso | Acción |
| --- | --- |
| Single-site inequívoco | Backfill `supplier_requisitions.site_id` al único site demostrado. Conservar IDs, number, approvals, receipts, returns y documents. |
| Multi-site | Preservar como legacy. `supplier_requisitions.site_id=NULL`. No dividir ni renumerar. Limited user requiere cobertura completa de todos los sites conocidos. |
| Sin sede derivable | Preservar como legacy unresolved con header.site_id=NULL. No inventar site. Limited-site sin acceso hasta regularización. |
| Sede derivable inequívocamente | Poblar la línea/site únicamente desde evidencia directa aprobada (principalmente `line.location_id → locations.site_id` válida). Si todas las líneas convergen al mismo site, backfill de cabecera. |

## Evidencia que NO autoriza auto-backfill por sí sola

- current inventory item site;
- receipt warehouse;
- return warehouse;
- supplier;
- document;
- texto cost center.

Puede formar parte de reporte manual, no de actualización automática.

---

# 4. Thresholds

## Algoritmo actual

```text
policy = organization_procurement_policies[organization]

group = organization + supplier

estimatedTotal =
  Σ(line.quantity × item.unit_cost)

if mode == none:
  approvalRequired = false

if mode == all:
  approvalRequired = true

if mode == threshold:
  approvalRequired =
    estimatedTotal >= approval_threshold
```

La policy se snapshottea en la requisición.

Después, edición recalcula:

`Σ(quantity_requested × unit_cost_estimated)`

y puede:

- activar aprobación;
- mantener gobernanza;
- reabrir aprobación.

## Moneda

No hay `currency_code` en:

- organization procurement policy;
- requisition;
- approval event como campo normalizado.

El threshold actual es un numeric en el contexto monetario implícito de la organización.

## Impacto al separar por site

Si se mantiene “threshold por requisición”, el total se fragmenta.

Esto puede disminuir el número de requisiciones que requieren aprobación.

## Alternativas pendientes

### T1 — mantener threshold por requisición

La opción con menor cambio técnico.

### T2 — threshold sobre compra agregada

Requiere introducir una identidad superior a la requisición.

### T3 — política de threshold por site

Requiere nuevas policies site-aware.

## Gate

**No implementar el cambio de generación site-specific en producción sin confirmar T1/T2/T3 para `approval_mode='threshold'`.**

Los modos `none` y `all` no presentan esta ambigüedad.

---

# 5. Centros de costo

## Modelo actual

```text
inventory_transactions.cost_center TEXT
```

No master.

No FK.

No site.

No relation en requisition item.

## Modelo objetivo mínimo

```text
cost_centers
-------------
id uuid PK
organization_id uuid NOT NULL
site_id uuid NOT NULL
code text NOT NULL
name text NOT NULL
status/active
created_at
updated_at

UNIQUE(organization_id, site_id, code)
```

Relación:

```text
supplier_requisition_items.cost_center_id
```

opcional, salvo decisión futura que lo haga obligatorio.

## Invariantes

```text
cost_center.organization_id = line.organization_id
cost_center.site_id = line.site_id
line.site_id = requisition.site_id
```

## Histórico

Mantener `inventory_transactions.cost_center text`.

No backfill automático a IDs.

---

# 6. Documentos

## Supplier documents

Siguen organization+supplier.

No son propiedad de una requisición/site.

## Procurement documents nuevos

Heredan site desde requisition.

No duplicar site sin necesidad.

## Procurement documents legacy mixed-site

Preservar como evidencia immutable de la requisición original.

No:

- dividir;
- duplicar;
- mover;
- reclasificar automáticamente.

## Receipts/returns evidence

Mantener enlaces actuales.

No reescribir relaciones históricas para forzar single-site.

## Export

Nuevo: site-aware vía requisition.

Legacy: full-document authorization por cobertura completa.

---

# 7. Migración propuesta — no ejecutada

## Paso 1 — preflight productivo

Clasificar:

- single-site;
- mixed-site;
- line site NULL;
- derivable por location;
- unresolved;
- con approvals;
- con receipts;
- con supplier returns;
- con procurement documents.

## Paso 2 — agregar header.site_id nullable

Con FK organization-aware.

No NOT NULL todavía.

## Paso 3 — backfill line sites inequívocos

Solo reglas aprobadas.

No usar item/warehouse como verdad histórica automática.

## Paso 4 — backfill headers single-site

Solo cuando todas las líneas convergen inequívocamente.

## Paso 5 — clasificar legacy

- mixed-site → NULL;
- unresolved → NULL.

No dividir.

## Paso 6 — scope helper

Una sola abstracción de authorization para:

- site-owned;
- legacy mixed;
- legacy unresolved;
- accessAllSites/platform.

## Paso 7 — generation cutover

Nuevas requisiciones:

`organization + site + supplier`.

Bloquear item site NULL.

## Paso 8 — DB invariants nuevas

Header/site.

Line/header.

Item/line cuando viable.

## Paso 9 — receive/return

Warehouse igual al site de la nueva requisición.

Legacy mixed: warehouse igual al site de la línea/receipt.

## Paso 10 — documents/export

Authorization por cabecera/classification.

## Paso 11 — cost center

Solo después de definir catálogo y obligatoriedad.

## Paso 12 — NOT NULL

Solo si se decide que todas las legacy unresolved ya fueron regularizadas.

Mientras existan legacy mixed válidas, `supplier_requisitions.site_id` no puede ser globalmente NOT NULL sin una estrategia adicional.

Una alternativa futura es mantener NULL exclusivamente como marcador legacy controlado con una constraint/flag explícita.

---

# 8. Smoke test futuro

## Nuevas requisiciones

1. A + supplier X → req A.
2. B + supplier X → req B.
3. A+B seleccionados → dos requisiciones.
4. nunca una cabecera A+B.
5. item site NULL rechazado.
6. item fuera de scope rechazado server-side.

## Scope

7. user A lista A, no B.
8. user B lista B, no A.
9. user A+B lista ambas.
10. accessAllSites lista ambas.
11. detail UUID cross-site rechazado.
12. edit cross-site rechazado.
13. approve cross-site rechazado.
14. export cross-site rechazado.
15. document download cross-site rechazado.

## Legacy

16. legacy mixed A+B invisible para user A.
17. legacy mixed A+B visible para user A+B.
18. legacy mixed visible a accessAllSites.
19. legacy unresolved invisible para limited user.
20. legacy unresolved accesible a global autorizado.
21. legacy IDs/numbers no cambian.

## Historical derivation

22. line NULL + valid same-org location A → derivable A.
23. line NULL + current item A sin location → no auto-backfill.
24. line NULL + receipt warehouse A → no auto-backfill.
25. conflicting evidence → unresolved.
26. all derived lines A → header A.
27. derived lines A+B → header NULL legacy mixed.

## Warehouse

28. req A + warehouse A → allowed.
29. req A + warehouse B → rejected incluso para user A+B.
30. req A + warehouse NULL → rejected.
31. transfer A→B sigue siendo operación separada de Inventario.

## Approval

32. none mode unchanged.
33. all mode unchanged.
34. threshold mode conforme a decisión T1/T2/T3.
35. approved req change reopens approval.
36. legacy mixed approval requiere full-site coverage.

## Cost center

Cuando exista master:

37. CC-A + line A → allowed.
38. CC-B + line A → rejected.
39. duplicate code dentro de org+site → rejected.
40. mismo code en sites diferentes → permitido si se adopta UNIQUE org+site+code.

## Documents

41. document new req A inherits A.
42. user B cannot upload/download doc A.
43. legacy mixed document no se divide.
44. immutable evidence remains unchanged.
45. supplier documents remain supplier-level.

## Regresión

46. requisition receipt.
47. approval.
48. supplier return.
49. procurement reconciliation.
50. inventory transaction integrity.
51. inventory scope.
52. Kardex.
53. Assets.
54. Work Orders.
55. build.

---

# 9. Riesgos

## Datos

- mixed-site reales aún no cuantificados en producción;
- líneas NULL;
- locations eliminadas;
- inconsistencias históricas;
- items cuyo site cambió por importación.

## Dominio

- threshold financiero al dividir requisiciones;
- documento externo que cubra varias requisiciones/sites;
- obligatoriedad futura de cost center;
- política operativa de legacy unresolved.

## Seguridad

- list/detail/export/document current organization-only en varias superficies;
- supplier requisition views/analytics cross-site;
- acceso parcial a legacy puede filtrar totales/documentos.

## Compatibilidad

- inserts/tests actuales sin header.site_id;
- históricos no pueden convertirse todos a NOT NULL;
- supplier analytics deben recibir scope sin cambiar métricas legítimamente globales.

## Aprobación

- threshold puede cambiar;
- approvals históricas multi-site no deben reescribirse;
- current snapshot debe preservarse.

## Inventario

- recepción cross-site hoy posible para sesiones amplias;
- current item.site no siempre es evidencia histórica;
- warehouse NULL legacy.

## Documentos

- procurement evidence immutable;
- binary file no es separable por site;
- supplier documents no deben confundirse con procurement documents.

---

# 10. Preguntas realmente pendientes

La evidencia del repositorio permite cerrar históricos, derivación, modelo mínimo de cost center y documentos.

Persisten solamente decisiones que no están codificadas hoy:

## P1 — Threshold financiero

Cuando una selección A+B se convierta en dos requisiciones:

¿el threshold de aprobación debe evaluarse:

- T1: por cada requisición site-specific;
- T2: por el total agregado de la compra lógica;
- T3: con policies específicas por site?

Esta es la principal decisión que bloquea un rollout sin cambio financiero silencioso.

## P2 — Documento externo multi-site futuro

Si un proveedor emite **una sola factura/remisión** que cubre requisiciones A y B separadas:

¿el negocio espera:

- registrar un documento por requisición;
- duplicar referencia/archivo;
- o soportar en el futuro un documento ligado a múltiples requisiciones?

El modelo actual solo soporta un `requisition_id` por procurement document.

No es necesario resolverlo para preservar históricos, pero sí debe definirse antes de exigir que toda evidencia futura sea estrictamente site-specific.

## P3 — Cost center governance

El repositorio no determina:

- si cost center será obligatorio;
- quién administra el catálogo;
- formato de código;
- si una línea puede no tenerlo.

La pertenencia site sí queda propuesta y cerrada; la obligatoriedad no.

## P4 — Lifecycle de legacy unresolved

Debe definirse si una requisición legacy sin site determinable:

- permanece operable por accessAllSites/global;
- o pasa a read-only hasta regularización.

Por seguridad, limited-site no debe verla en ninguno de los dos casos.

---

# 11. Decisiones cerradas — lista final

1. Nuevas requisiciones serán single-site.
2. Multi-site user puede operar varias requisiciones, pero no mezclar sites en una.
3. Históricas mixed-site no se dividen.
4. Históricas mixed-site conservan header.site_id NULL.
5. Limited user necesita cobertura completa para legacy mixed.
6. Legacy con site indeterminado no se expone a limited-site.
7. Backfill automático de línea solo desde evidencia inequívoca.
8. Current item site y warehouse histórico no son evidencia suficiente por sí solos.
9. Nuevas receipts/returns deben usar warehouse del mismo site de requisition.
10. Transferencias A→B siguen siendo Inventory Transfer.
11. Procurement documents nuevos heredan site de requisition.
12. Procurement documents históricos mixed-site no se dividen.
13. Supplier documents siguen supplier-level.
14. Cost center estructurado futuro será site-owned.
15. Cost center no será many-to-many en el modelo mínimo.
16. Código de cost center será único por organization+site en el modelo mínimo.
17. Texto histórico `inventory_transactions.cost_center` no se reescribe.
18. Numeración histórica de requisiciones no cambia.
19. Approval events/audit/receipts/returns no se reasignan para “normalizar” históricos.
20. Threshold actual es organization-policy + per-requisition total; su semántica futura con split requiere decisión financiera explícita.

---

# 12. Implementación recomendada

No ejecutar hasta cerrar P1 y, si la primera entrega debe soportar documentos futuros multi-site, P2.

Orden:

1. Ejecutar preflight histórico real en staging/producción.
2. Clasificar requisiciones: single-site, mixed, unresolved.
3. Añadir `supplier_requisitions.site_id` nullable y estructuras organization-aware.
4. Backfill líneas NULL solo desde location directa inequívoca.
5. Backfill cabeceras single-site.
6. Mantener mixed/unresolved con header.site_id NULL.
7. Crear helper central de scope de Requisiciones con compatibilidad legacy.
8. Aplicar site scope a list/detail/edit/approve/export/documents/supplier views.
9. Cambiar generación a organization+site+supplier.
10. Aplicar la decisión financiera P1 al cálculo de aprobación.
11. Bloquear nuevos items sin site en RequisitionBuilder/backend.
12. Exigir warehouse.site = requisition.site en nuevas receipts/returns.
13. En legacy mixed, exigir warehouse.site = line.site.
14. Hacer supplier counts/analytics site-aware para limited users.
15. Resolver política P2 para documentos externos futuros si aplica.
16. Diseñar/crear cost center master solo después de cerrar governance P3.
17. Agregar relation line→cost_center e invariantes site-aware.
18. Crear `inventory-i2a2-requisitions-site-smoke.mjs`.
19. Actualizar fixtures de receipt/approval/return/reconciliation.
20. Ejecutar todas las regresiones y build.
21. Evaluar constraint final/NOT NULL solo cuando la política legacy permita hacerlo.

---

## Resultado requerido

```text
DOMAIN DECISION GATE: COMPLETADO

HEAD:
3a8a4ebd66889fbaa4e233390562f988f7cee402

CAMBIOS FUNCIONALES:
NINGUNO

MIGRACIONES:
NINGUNA

DATOS MODIFICADOS:
NINGUNO

ARCHIVOS:
docs/INVENTORY_I2A2_REQUISITIONS_DOMAIN_DECISION_GATE.md

DECISIONES CERRADAS:
- preservar históricas multi-sede sin dividir
- header.site_id NULL para legacy mixed/unresolved
- full-scope access para legacy mixed
- backfill automático solo con evidencia inequívoca
- location directa como evidencia histórica estructural
- item/warehouse/transaction no bastan por sí solos para inferir site
- nuevas requisiciones single-site
- warehouse de receipt/return debe coincidir con el site de la requisición
- transferencias cross-site siguen siendo operación de Inventario
- procurement documents nuevos heredan site de requisition
- procurement documents históricos mixed-site no se migran/dividen
- cost center futuro site-owned y unique por organization+site+code
- cost_center textual histórico se conserva
- threshold actual confirmado como policy organizacional aplicada al total de cada requisición

DECISIONES REALMENTE PENDIENTES:
- política financiera T1/T2/T3 para threshold tras separar por sede
- tratamiento de un documento externo futuro que cubra varias requisiciones/site
- obligatoriedad y governance del catálogo de centros de costo
- read-write vs read-only para legacy unresolved accesible por perfiles globales

IMPLEMENTACIÓN RECOMENDADA:
1. preflight histórico
2. site_id nullable
3. backfill inequívoco
4. clasificación legacy
5. helper central de scope
6. list/detail/supplier views site-aware
7. generación org+site+supplier
8. aplicar decisión threshold
9. edit/approve site-aware
10. receive/return warehouse exacto del site
11. documents/export site-aware
12. supplier analytics site-aware
13. cost center master cuando se cierre governance
14. smoke I2-A2.2 + regresiones
15. constraint final solo después de resolver legacy
```
