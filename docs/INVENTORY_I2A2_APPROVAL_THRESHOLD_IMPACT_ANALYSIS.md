# I2-A2.2 — Approval Threshold Impact Analysis

Fecha: 2026-09-30  
Tipo: **diagnóstico exclusivamente; sin implementación funcional**.

HEAD inspeccionado antes de este documento:

`4be6886afa6d27696f94e95c0589b64a95157fa3`

Decisión de dominio ya tomada:

> Una requisición nueva pertenecerá a una única organización + sede + proveedor.  
> Una requisición nueva no podrá mezclar líneas de diferentes sedes.  
> Las requisiciones históricas mixed-site o cuyo sitio no pueda determinarse inequívocamente deben preservarse sin dividirse, destruirse ni reinterpretarse.

Este documento analiza únicamente cómo esa separación por sede afecta el sistema existente de aprobación por threshold. No modifica schema, migraciones, APIs, UI, RBAC, queries, generación, aprobación, recepción, devoluciones, documentos, exportaciones, fixtures ni smokes.

> Nota de nomenclatura: existe un documento anterior `docs/INVENTORY_I2A2_APPROVAL_THRESHOLD_IMPACT.md` con etiquetas T1/T2/T3 diferentes. Para este gate se usan **exclusivamente** las definiciones solicitadas aquí:
>
> - **T1:** umbral por requisición;
> - **T2:** umbral acumulado por sitio durante un período;
> - **T3:** preservar la lógica económica anterior mediante una relación de compra/necesidad lógica.

---

# 1. Estado actual verificado

## 1.1 Modelo de requisición vigente

Migración base:

`db/migrations/028_supplier_profiles_requisitions.sql`

La cabecera actual `supplier_requisitions` contiene:

- `organization_id`;
- `supplier_id`;
- número;
- status;
- solicitante;
- fecha requerida;
- notas;
- timestamps operativos.

**No contiene `site_id`.**

Las líneas `supplier_requisition_items` sí contienen:

- `requisition_id`;
- `organization_id`;
- `inventory_item_id`;
- `site_id` nullable;
- `location_id`;
- SKU/descripcion/unidad;
- `quantity_requested numeric(14,3)`;
- `quantity_received numeric(14,3)`;
- `unit_cost_estimated numeric(14,2) NOT NULL DEFAULT 0`.

El generador actual:

`POST /api/requisitions/generate`

agrupa por:

`organization_id + supplier_id`

y no por sede.

Por tanto, si el mismo proveedor tiene líneas de Site A y Site B dentro de una misma selección, el sistema puede crear una sola requisición mixed-site.

## 1.2 Dónde se define approval_threshold

Migración:

`db/migrations/034_requisition_approval_policy.sql`

Tabla:

`organization_procurement_policies`

Campos:

- `organization_id uuid PRIMARY KEY`;
- `approval_mode = none | all | threshold`;
- `approval_threshold numeric(14,2)`;
- `approver_scope = admin_only | admin_manager`;
- `allow_requester_self_approval boolean`;
- `updated_by`;
- `updated_at`.

La PK es `organization_id`.

**Conclusión:** la policy actual es de **organización**, no de sede, proveedor, centro de costo, usuario o grupo de compra.

Si no existe fila de policy para la organización, el generador usa:

- mode `none`;
- threshold `0`;
- approver scope `admin_only`;
- self approval `false`.

## 1.3 Dónde se configura

UI:

`app/dashboard/settings/page.tsx`

Sección:

`Aprobación de requisiciones`

Campos visibles:

- Política de aprobación;
- Monto estimado mínimo;
- Quién puede aprobar;
- Permitir autoaprobación del solicitante.

Texto de UI verificado:

> La regla se copia a cada requisición al momento de crearla para conservar trazabilidad histórica.

Endpoint:

`POST /api/procurement-policy`

El endpoint exige:

- sesión;
- `can(session,"settings.view")`;
- organización accesible;
- mode válido;
- threshold válido;
- approver scope válido.

Cuando `approval_mode="threshold"`, la ruta rechaza threshold `<= 0`.

La tabla en sí permite `0`, pero la UI/API de configuración exige un valor positivo para mode threshold.

### Permiso de configuración

En `lib/permissions.ts`:

- Platform Owner: `can()` devuelve true para cualquier permiso;
- tenant `admin`: tiene `settings.view`;
- `manager`: no tiene `settings.view`;
- Superadmin: su lista explícita de permisos no contiene `settings.view`.

La UI company-scoped de Settings es la superficie normal de configuración de esta policy. No se encontró una policy separada por site.

## 1.4 Snapshot de policy por requisición

Migración 034 agrega a `supplier_requisitions`:

- `approval_required`;
- `approval_state`;
- `approval_policy_mode`;
- `approval_threshold`;
- `approval_approver_scope`;
- `approval_self_allowed`;
- `approval_requested_at`;
- `approval_decided_at`;
- `approval_decided_by`;
- `approval_decision_notes`.

Estados de aprobación:

- `not_required`;
- `pending`;
- `approved`;
- `rejected`.

La policy organizacional vigente se copia a la cabecera en el momento de creación.

Cambiar después la policy de la organización **no reescribe** el snapshot de requisiciones ya creadas.

## 1.5 Auditoría de aprobación

Tabla:

`supplier_requisition_approval_events`

Acciones permitidas:

- `requested`;
- `approved`;
- `rejected`;
- `reopened`;
- `amended`.

Cada evento referencia **una requisición**.

Campos relevantes:

- organization;
- requisition;
- actor;
- from_state;
- to_state;
- notes;
- metadata JSON;
- created_at.

Además las rutas escriben `audit_log` para policy changes, approval request, approval, rejection, reopen y pending amendment.

No existe tabla de eventos de grupo de compra, ventana de acumulación o aprobación multi-requisition.

## 1.6 Quién puede aprobar

Endpoint autoritativo:

`POST /api/requisitions/[id]/approval`

Primera barrera:

`can(session,"requisitions.approve")`

Según `lib/permissions.ts`:

- Platform Owner: sí;
- Superadmin: sí;
- Admin: sí;
- Manager: sí;
- Technician: no;
- Requester: no;
- Viewer: no;
- Provider: no;
- External: no.

Para usuarios tenant, el snapshot de la requisición vuelve a limitar:

### admin_only

Solo:

- `admin`.

### admin_manager

- `admin`;
- `manager`.

Platform Owner y Superadmin no pasan por esa segunda comprobación de role tenant, pero sí deben superar el organization scope vigente.

### Autoaprobación

Si:

`approval_self_allowed=false`

y:

`session.userId === requested_by`

la decisión es rechazada.

### Cobertura de sedes hoy

Para usuario tenant con `accessAllSites=false`, el endpoint consulta:

`SELECT DISTINCT site_id FROM supplier_requisition_items WHERE requisition_id=$1 AND site_id IS NOT NULL`

y exige que todas esas sedes estén en `session.siteIds`.

Por tanto hoy la sede afecta **autorización**, pero no el cálculo del threshold.

Las líneas con `site_id=NULL` no forman parte de ese conjunto de cobertura.

## 1.7 Niveles de aprobación

No se encontró:

- aprobación nivel 1 / nivel 2;
- escalación por rangos;
- aprobador financiero adicional;
- workflow secuencial;
- matriz por monto.

Hay una sola decisión de approval por requisición en un momento dado:

`pending → approved | rejected`

Una modificación relevante puede reabrirla a `pending`.

## 1.8 Dependencias de la policy

La policy **no depende** de:

- proveedor;
- sede;
- centro de costo;
- categoría;
- almacén;
- solicitante;
- moneda;
- tipo de material.

Matiz importante:

aunque la **policy** no depende del proveedor, el generador crea hoy una requisición por:

`organization + supplier`

Por tanto el supplier sí define indirectamente la **unidad sobre la cual se calcula el total**.

Ejemplo:

si una sola operación selecciona S1 y S2, el sistema crea dos requisiciones y evalúa el threshold de cada una por separado.

## 1.9 Centro de costo

Migración:

`db/migrations/031_inventory_kardex_metadata.sql`

`cost_center` existe en:

`inventory_transactions.cost_center text`

Se captura en recepción de requisiciones y se conserva en movimientos/devoluciones.

No existe `cost_center` en:

- `supplier_requisitions`;
- `supplier_requisition_items`;
- `organization_procurement_policies`;
- `supplier_requisition_approval_events`.

**Conclusión:** el centro de costo actual no participa en approval ni threshold.

## 1.10 Moneda

El threshold:

`organization_procurement_policies.approval_threshold numeric(14,2)`

no tiene currency.

Los costos estimados de las líneas tampoco guardan currency.

El detalle/export de una requisición usa:

`countryDefinition(req.organization_country)?.currency || "USD"`

para **presentación**.

Los documentos comerciales sí pueden almacenar:

`procurement_documents.currency_code`

pero ese campo se crea después y no participa en el threshold.

No se encontró conversión FX.

**Conclusión:** el algoritmo actual compara números monetarios bajo una moneda implícita de la organización; el schema de approval no formaliza esa moneda.

## 1.11 Compra lógica / purchase group

No se encontró una entidad equivalente a:

- purchase group;
- logical purchase;
- parent requisition;
- procurement batch de compra;
- request bundle;
- approval group.

En `POST /api/requisitions/generate` existe un array local `createdIds`, pero solo vive durante la request y al final se devuelve el **conteo** de requisiciones creadas.

No se persiste una relación común entre las requisiciones nacidas de una misma selección.

Los batch de importación de Inventario no representan compra/procurement y no son equivalentes.

---

# 2. Código, rutas y SQL involucrados

| Archivo / entidad | Responsabilidad actual |
| --- | --- |
| `db/migrations/028_supplier_profiles_requisitions.sql` | cabecera y líneas de requisición |
| `db/migrations/034_requisition_approval_policy.sql` | policy organizacional, snapshot y approval events |
| `organization_procurement_policies` | una policy por organización |
| `supplier_requisitions` | unidad actual de approval y snapshot |
| `supplier_requisition_items` | cantidades, costos y site por línea |
| `app/dashboard/settings/page.tsx` | UI de policy |
| `app/api/procurement-policy/route.ts` | persistencia de policy |
| `components/RequisitionBuilder.tsx` | preview de creación, hoy por proveedor |
| `app/api/requisitions/generate/route.ts` | agrupación, total inicial, evaluación y snapshot |
| `app/api/requisitions/[id]/route.ts` | edición, recálculo, activation/reopen/amend |
| `app/api/requisitions/[id]/approval/route.ts` | decisión y autorización |
| `app/api/requisitions/[id]/receive/route.ts` | bloquea recepción cuando approval requerido no está approved |
| `app/api/requisitions/[id]/returns/route.ts` | devolución al proveedor ligada a requisition/receipt |
| `app/api/requisitions/[id]/documents/route.ts` | documento comercial ligado a una requisición |
| `app/api/requisitions/[id]/documents/[documentId]/route.ts` | evidencia/revisión documental |
| `app/api/requisitions/[id]/export/route.ts` | export por requisición |
| `lib/procurement-reconciliation.ts` | compara documentos con requested/receipt/return value |
| `lib/permissions.ts` | RBAC de approve/write/reconcile |
| `scripts/requisition-approval-smoke.mjs` | snapshot/events básicos de approval |
| `scripts/requisition-receipt-smoke.mjs` | recepción parcial/completa |
| `scripts/supplier-return-smoke.mjs` | DEV proveedor y trazabilidad a receipt |
| `scripts/procurement-reconciliation-smoke.mjs` | documentos, evidencia, diferencias e inmutabilidad |

---

# 3. Algoritmo actual de aprobación

## 3.1 Creación

Ruta:

`POST /api/requisitions/generate`

Secuencia real:

1. recibe hasta 100 `item_id`;
2. carga inventory item + organization + site + supplier;
3. valida organization scope y site access cuando el item tiene site;
4. agrupa por:
   `organization_id + supplier_id`;
5. lee quantity enviada por el formulario;
6. toma `unitCost` desde `inventory_items.unit_cost`;
7. calcula el total del grupo;
8. carga la policy de la organización;
9. evalúa approval;
10. crea cabecera con snapshot;
11. crea las líneas;
12. si requiere approval, escribe evento `requested` y `audit_log`.

## 3.2 Fórmula del total

Código:

`app/api/requisitions/generate/route.ts`

Fórmula:

`estimatedTotal = Σ(quantity × unitCost)`

Donde:

- `quantity` viene del formulario;
- `unitCost = Number(item.unit_cost || 0)`.

La línea persiste:

`unit_cost_estimated`

con ese valor.

### Línea sin costo

Si `inventory_items.unit_cost` es null/falsy, el generador lo convierte a `0`.

La línea contribuye:

`quantity × 0 = 0`

al threshold.

Además el modelo de requisition item permite costo estimado cero.

## 3.3 Impuestos, descuentos, fletes y otros valores

No participan.

La cabecera de requisición no tiene campos de:

- impuesto;
- descuento;
- flete;
- retención;
- recargo;
- total fiscal.

`procurement_documents` sí tiene:

- subtotal;
- `tax_total`;
- total;
- currency.

Pero esos valores son evidencia comercial posterior y **no retroalimentan** approval threshold.

## 3.4 Regla de threshold

La creación evalúa:

`mode=none → approvalRequired=false`

`mode=all → approvalRequired=true`

`mode=threshold → approvalRequired=(estimatedTotal >= approval_threshold)`

La comparación es **mayor o igual**.

Ejemplo exacto de frontera:

`total=1000, threshold=1000 → requiere aprobación`.

## 3.5 Estado inicial

Si requiere aprobación:

- requisition `status='sent'`;
- `approval_required=true`;
- `approval_state='pending'`;
- `sent_at=now()`;
- `approval_requested_at=now()`.

Si no requiere:

- `status='draft'`;
- `approval_required=false`;
- `approval_state='not_required'`.

## 3.6 Reevaluación después de editar

Ruta:

`POST /api/requisitions/[id]`

La edición puede cambiar:

- quantity;
- estimated cost;
- needed_by;
- notes;
- status permitido;
- retirar una línea sin recepción.

Después de las mutaciones, la ruta recalcula:

`SUM(quantity_requested × unit_cost_estimated)`

sobre las líneas restantes.

La reevaluación usa el **snapshot de policy de la requisición**, no la policy organizacional actual.

### Cruce posterior del threshold

Si originalmente:

`approval_required=false`

pero el nuevo total cumple la rule snapshoteada:

- activa `approval_required=true`;
- pasa a `pending`;
- status `sent` o `partial` si ya hubo recepción;
- registra `requested`;
- metadata incluye total, threshold y razón `approval_threshold_crossed`.

### Una vez gobernada, no se desactiva automáticamente

El código contiene expresamente la regla:

> Once approval becomes required it remains required.

Por tanto, bajar después el monto por debajo del threshold **no** convierte la requisición otra vez a `not_required`.

## 3.7 Qué cambios reabren una decisión

`approvalRelevantChange` incluye:

- cambio de `needed_by`;
- cambio de quantity;
- cambio de cost;
- retirar línea.

Cambiar solo `notes` no activa esa bandera.

Si una requisición ya requerida estaba:

- `approved`; o
- `rejected`;

y ocurre un cambio relevante:

- vuelve a `pending`;
- limpia decisión previa;
- registra `reopened`;
- bloquea nuevas recepciones hasta nueva aprobación.

Si ya estaba `pending` y cambia:

- continúa `pending`;
- registra `amended`.

## 3.8 Decisión de aprobación

Ruta:

`POST /api/requisitions/[id]/approval`

Solo opera cuando:

- `approval_required=true`;
- `approval_state='pending'`;
- status no es fulfilled/closed/cancelled;
- usuario autorizado;
- role permitido por snapshot;
- self-approval permitido;
- site coverage permitido.

### Aprobar

`approval_state='approved'`.

Status:

- `approved` si no hay recepción;
- `partial` si ya había recepción.

### Rechazar

`approval_state='rejected'`.

Status:

- `rejected` si no hay recepción;
- `partial` si ya había recepción.

El evento de decisión queda en `supplier_requisition_approval_events`.

## 3.9 Qué ocurre después de aprobar

Ruta de recepción:

`POST /api/requisitions/[id]/receive`

Regla:

si:

`approval_required=true`

y:

`approval_state!='approved'`

la recepción se bloquea.

Una requisición aprobada puede continuar con recepciones. Los receipts crean `inventory_transactions` ligados a:

- `requisition_id`;
- `requisition_item_id`.

Una edición relevante posterior puede reabrir approval y volver a bloquear recepciones pendientes.

---

# 4. Impacto directo de separar la requisición por sitio

## 4.1 Unidad económica actual

Hoy:

`organization + supplier`

es la unidad creada por el generador.

Si dentro de ese grupo existen líneas A y B:

`Total actual = Total(Site A) + Total(Site B)`

y se ejecuta una única evaluación.

## 4.2 Unidad técnica futura

Decisión de dominio:

`organization + site + supplier`

Por tanto una misma selección puede producir:

- RQ-A;
- RQ-B.

Si no se agrega otra capa de policy, el total disponible de forma natural será el de cada child requisition.

## 4.3 Ejemplo solicitado

Supuesto:

- mismo organization;
- mismo supplier;
- threshold = 1.000;
- mode = threshold;
- Site A = 600;
- Site B = 500.

### Actualmente

El generador agrupa A+B porque comparte organization+supplier:

`600 + 500 = 1.100`

Como:

`1.100 >= 1.000`

resultado:

- una requisición;
- approval required;
- pending.

### Si se separa técnicamente por site sin otra regla

RQ-A:

`600 < 1.000`

RQ-B:

`500 < 1.000`

Resultado técnico natural:

- RQ-A no requiere;
- RQ-B no requiere.

Ese cambio de comportamiento es precisamente el impacto que este gate debe resolver.

## 4.4 Otros ejemplos

### A=1.200, B=200, threshold=1.000

Actual:

`1.400 → approval required`.

T1:

- A: required;
- B: not required.

T3, si A+B pertenecen al mismo grupo económico:

`1.400 → group requires approval`.

T2 depende además de los demás montos acumulados de cada site durante su período.

### Dos requisiciones separadas del mismo Site A: 600 y 500

Hoy, si nacen de dos operaciones distintas, cada requisición se evalúa separadamente:

- 600 → no;
- 500 → no.

T2 las podría acumular:

`1.100 → cruza threshold`.

Esto demuestra que T2 no solo resuelve el split por site: introduce una nueva regla económica temporal que el sistema actual no tiene.

### Una sola selección con dos proveedores

Supplier S1:

- Site A = 600;
- Site B = 500.

Supplier S2:

- Site A = 900.

Hoy se crean:

- requisition S1 = 1.100 → required;
- requisition S2 = 900 → not required.

Si T3 pretende preservar **exactamente** la lógica económica anterior, no debe asumirse que S1 y S2 pertenecen a un mismo total. El sistema actual ya separa threshold por supplier porque crea cabeceras distintas.

---

# 5. T1 — Umbral por requisición

Definición:

cada requisición site-specific evalúa independientemente su total contra el snapshot de la policy organizacional.

## 5.1 Cambios de modelo requeridos

Para approval, no requiere una entidad económica adicional.

Sí depende del cambio general de I2-A2.2 que hará a la requisición site-owned.

El snapshot actual puede seguir viviendo en cada requisición.

## 5.2 Cambios de código requeridos

En el futuro:

- generador agrupa por organization+site+supplier;
- calcula el total de cada grupo;
- aplica el mismo algoritmo actual a cada requisición;
- edición sigue recalculando solo sus líneas;
- approval endpoint sigue tomando una requisición.

No sería necesario construir acumuladores ni parent groups solo para threshold.

## 5.3 Impacto sobre aprobación

Puede cambiar el resultado respecto al sistema mixed-site.

Casos antes aprobables por:

`A+B >= threshold`

pueden quedar:

`A < threshold` y `B < threshold`.

Con `approval_mode=all`, todas las child requisitions seguirían requiriendo approval, pero habría más decisiones porque habría más cabeceras.

Con `approval_mode=none`, no cambia el requisito de approval.

## 5.4 Auditoría

El modelo actual de events por requisition es directamente compatible.

Cada child tendría:

- su snapshot;
- su `requested`;
- su decisión;
- sus reopen/amend events.

La auditoría histórica anterior debe permanecer en la requisición original.

## 5.5 Trazabilidad

Trazabilidad simple:

`approval event → requisition → site`

para nuevas requisiciones site-owned.

No existe vínculo económico entre RQ-A y RQ-B, salvo información contextual que pudiera compartir la generación.

## 5.6 Usuarios multi-sitio

Un usuario A+B vería/operaría dos requisiciones separadas.

Un aprobador limited-site de A solo podría aprobar RQ-A.

No necesita conocer el total de B para T1.

## 5.7 Proveedores

Un mismo proveedor puede recibir varias requisiciones por una selección que antes producía una sola.

Esto aumenta:

- cantidad de requisiciones;
- números de requisición;
- decisiones;
- exports;
- documentos potenciales.

No cambia la policy del proveedor porque no existe una policy supplier-specific.

## 5.8 Reportes y exportaciones

Los exports actuales son por requisition.

T1 es compatible técnicamente, pero el mismo requerimiento económico previo puede aparecer dividido en varios archivos/números.

Reportes que cuenten requisiciones verán más registros.

Comparaciones históricas de “número de requisiciones” antes/después del cambio dejan de ser homogéneas si no se explicita la nueva unidad.

## 5.9 Históricos

No requiere reagrupar ni recalcular históricos.

Mixed-site legacy conserva:

- su cabecera;
- su approval snapshot;
- sus events;
- sus receipts;
- returns;
- documents.

## 5.10 Riesgos

- fragmentación económica por debajo del threshold;
- incremento de decisiones/documentos;
- métricas históricas de conteo no comparables sin contexto;
- posible incentivo accidental a dividir compras si threshold es control financiero.

## 5.11 Complejidad

**Baja a media**, relativa a T2/T3, porque reutiliza el modelo requisition-scoped existente.

La complejidad principal proviene de la separación por site, no de approval.

## 5.12 Información adicional requerida

Producto debe confirmar explícitamente:

> El threshold debe gobernar cada requisición site-specific de forma independiente, aunque esto cambie resultados frente a la antigua requisición mixed-site.

---

# 6. T2 — Umbral acumulado por sitio

Definición:

las requisiciones del mismo site se acumulan durante un período definido y el threshold se evalúa con un total acumulado.

El sistema actual no implementa ningún período ni acumulador.

## 6.1 Cambios de modelo requeridos

Además del futuro site ownership de requisition, se necesitaría representar de forma auditable al menos:

- qué site se está acumulando;
- qué período aplica;
- inicio/fin o identificador de ventana;
- qué requisiciones forman la base;
- total evaluado;
- threshold/policy utilizada;
- resultado de la evaluación.

Puede persistirse mediante una entidad de ventana/ledger o mediante snapshots suficientes en requisitions/events. El repositorio actual no define cuál.

La policy organizacional actual tampoco contiene configuración temporal.

## 6.2 Decisiones de modelo no resolubles por código actual

### Período

Debe definirse:

- día calendario;
- semana;
- mes;
- rolling N días;
- ciclo contable;
- período configurable.

También debe definirse timezone.

La organización tiene timezone, pero procurement no usa hoy un concepto de período.

### Clave de acumulación

La instrucción dice “mismo sitio”, pero el comportamiento actual separa por supplier.

Debe decidirse si T2 acumula:

- organization + site;
- organization + site + supplier;
- organization + site + cost center;
- otra combinación.

No puede inferirse del código.

### Estados incluidos

Debe decidirse si cuentan:

- draft;
- sent;
- pending;
- approved;
- rejected;
- partial;
- fulfilled;
- cancelled.

### Monto incluido

Debe decidirse si el acumulado usa:

- monto al crear;
- monto actual editable;
- monto aprobado;
- monto recibido;
- monto neto después de devoluciones.

El algoritmo actual usa monto estimado de líneas, no receipts ni returns.

## 6.3 Cambios de código requeridos

La evaluación ya no podría resolverse con:

`sum(lines de esta requisition)`.

Se necesitaría obtener/actualizar el acumulado aplicable dentro de la misma frontera transaccional.

Además deben manejarse concurrencias.

Ejemplo:

dos requests concurrentes de 600 contra threshold 1.000.

Si ambas leen un acumulado previo de 0 de forma independiente, ambas podrían concluir “no requiere” aunque juntas sean 1.200.

T2 necesita un mecanismo transaccional/lock para que la evaluación sea serializable desde el punto de vista de la policy.

## 6.4 Impacto sobre aprobación

Pregunta central sin respuesta actual:

cuando el período cruza threshold, ¿qué queda pendiente?

Opciones conceptuales posibles, no seleccionadas:

- solo la requisición que provoca el cruce;
- todas las requisiciones abiertas de la ventana;
- todas las requisiciones aún no recibidas;
- esperar al cierre del período antes de liberar cualquiera.

El código actual no tiene estado de approval compartido.

### Problema temporal

Si una requisición de 600 no requería aprobación y ya fue recibida, y después otra de 500 hace que el período llegue a 1.100, no existe una forma de “bloquear antes de recibir” la primera retroactivamente.

Por tanto T2 exige una decisión de negocio sobre el momento de bloqueo.

## 6.5 Ediciones

Editar una requisición cambia el total acumulado.

Debe definirse:

- qué approval se reabre;
- si afecta solo la requisición editada;
- si reabre otras de la misma ventana;
- qué ocurre si el acumulado vuelve a bajar;
- qué ocurre con una requisición ya fulfilled.

La regla actual “once approval becomes required it remains required” solo existe a nivel de una requisition.

No resuelve el lifecycle de una ventana acumulada.

## 6.6 Auditoría

Los events actuales no son suficientes para explicar T2 por sí solos porque apuntan a una requisición.

Para una decisión auditable debería poder reconstruirse:

- site;
- ventana;
- requisiciones incluidas;
- total acumulado;
- threshold;
- orden temporal;
- inclusiones/exclusiones posteriores;
- motivo de reopen.

Sin ese snapshot, una requisición de 500 podría figurar como “approval required” sin que su propio monto explique la decisión.

## 6.7 Trazabilidad

T2 crea una relación económica temporal entre requisiciones que hoy son independientes.

Esa relación debe quedar persistida o ser reproducible determinísticamente.

Una query dinámica sobre datos actuales no es suficiente para auditoría si las requisiciones pueden editarse, cancelarse o cambiar de status.

## 6.8 Usuarios multi-sitio

La acumulación es site-scoped.

Un usuario A+B puede tener simultáneamente ventanas independientes A y B.

Debe definirse si un usuario limitado a A puede ver solo:

- el total A; y
- la lista A.

No debe necesitar ver requisiciones B.

No requiere RBAC paralelo, pero cualquier agregado debe construirse sobre el mismo site scope autorizado.

## 6.9 Proveedores

Si la clave T2 es solo site, compras de proveedores diferentes influirían entre sí.

Eso sería una diferencia adicional respecto al comportamiento actual.

Si la clave incluye supplier, la policy conserva mejor la unidad supplier actual, pero eso es una decisión no definida por el repositorio.

## 6.10 Reportes/exportaciones

Los reportes deberían poder mostrar por qué una requisición individual quedó sujeta a approval:

- monto individual;
- período;
- acumulado;
- threshold;
- demás requisiciones que formaron la base.

El export actual es single-requisition y no contiene contexto de ventana acumulada.

Sería necesario decidir si:

- el export individual muestra el snapshot acumulado;
- existe un reporte de ventana;
- ambos.

## 6.11 Históricos

No existe historial de ventanas.

No es posible reconstruir T2 retrospectivamente de manera autoritativa porque:

- no existía site en header;
- existen requisiciones mixed-site;
- existen líneas site-null;
- no existe definición de período;
- no existe snapshot de membresía de ventana;
- estados y líneas pueden haber cambiado.

Con la decisión de preservación histórica, T2 debería tratarse como regla futura a partir de una fecha de vigencia, salvo decisión de dominio expresa en contrario.

## 6.12 Riesgos

- carrera concurrente al cruzar threshold;
- policy temporal difícil de auditar;
- approval retroactivo imposible de aplicar limpiamente a material ya recibido;
- cambios de una requisición afectando decisiones de otras;
- ambigüedad supplier/no-supplier;
- crecimiento de queries agregadas;
- diferencias por timezone y frontera de período.

## 6.13 Complejidad

**Alta**.

No es una extensión directa del algoritmo actual; introduce un dominio temporal compartido.

## 6.14 Información adicional requerida

Antes de diseñar T2 deben definirse como mínimo:

1. período;
2. timezone de corte;
3. clave de acumulación;
4. estados que cuentan;
5. monto que cuenta;
6. conducta al cruzar threshold;
7. conducta con requisiciones ya recibidas;
8. reglas de edición/reopen;
9. cancelaciones/rechazos;
10. reglas de concurrencia;
11. representación de auditoría.

---

# 7. T3 — Preservar la lógica económica anterior

Definición:

las requisiciones se separan técnicamente por site, pero varias requisiciones pueden representar la misma necesidad/compra y conservar una evaluación conjunta.

## 7.1 Qué significa “preservar” según el algoritmo actual

El algoritmo actual no agrega toda una selección indiscriminadamente.

Agrupa primero por:

`organization + supplier`.

Por tanto, para preservar exactamente la semántica actual, una compra lógica futura que nazca del split no debería asumir automáticamente que requisiciones de proveedores diferentes comparten threshold.

Ejemplo:

una selección con S1 y S2 ya produce hoy dos approvals independientes.

La unidad histórica a preservar es más cercana a:

`una requisición actual organization+supplier que, al separar por site, se convierte en varias requisiciones hijas`.

## 7.2 Cambios de modelo requeridos

No existe una entidad que pueda representar esa relación.

Se necesitaría una identidad persistente equivalente a:

- purchase group;
- requisition group;
- procurement intent;
- logical purchase;

o una relación con semántica equivalente.

El nombre/diseño final no se define aquí.

Debería poder relacionar:

- organization;
- supplier si se preserva exactamente la separación actual;
- child requisitions por site;
- solicitante/origen;
- total económico;
- policy snapshot;
- approval lifecycle;
- timestamps;
- audit.

## 7.3 Cambios de código requeridos

Generación:

1. recibir selección;
2. conservar la intención org+supplier;
3. separar físicamente por site;
4. asociar las child requisitions a una identidad común;
5. calcular total conjunto;
6. evaluar threshold conjunto.

Edición:

una modificación de RQ-A podría cambiar el total de todo el grupo.

Debe definirse si reabre:

- aprobación del grupo;
- todas las child;
- solo las no ejecutadas.

Approval:

el endpoint actual decide una sola `supplier_requisition`.

T3 requiere que la decisión conjunta tenga una autoridad clara.

Recepción:

el endpoint actual bloquea mirando:

`req.approval_required + req.approval_state`.

T3 debe definir cómo cada child conoce que el group approval está aprobado sin crear estados incoherentes.

## 7.4 Impacto sobre aprobación

Con el ejemplo:

- A=600;
- B=500;
- threshold=1.000.

Si A+B son hijos de la misma compra lógica:

`group total=1.100 → approval required`.

Así puede reproducirse la evaluación previa a la separación.

Pero T3 necesita definir qué ocurre si:

- una child se cancela;
- una child se edita;
- una child se recibe parcialmente;
- otra child todavía está pending;
- se agrega una sede después;
- cambia supplier;
- se genera una nueva requisición posteriormente por la misma necesidad.

## 7.5 Auditoría

Los events actuales solo admiten `requisition_id`.

Una decisión conjunta debe dejar evidencia de:

- group identity;
- child IDs;
- site IDs;
- total conjunto;
- threshold;
- policy;
- actor;
- decisión;
- modificaciones posteriores.

Guardar el mismo texto en varios approval events no crea por sí solo una fuente de verdad del grupo.

## 7.6 Trazabilidad

T3 ofrece una relación explícita entre las child requisitions, pero hoy esa relación no existe.

No debe inferirse por:

- timestamps cercanos;
- mismo requester;
- mismo needed_by;
- mismas notes;
- mismo supplier.

Esos campos pueden coincidir accidentalmente.

## 7.7 Usuarios multi-sitio

Este es un punto de decisión relevante.

Hoy una requisición mixed-site solo puede ser aprobada por un tenant limited-site si cubre todos los sites no-null de sus líneas.

Una compra lógica futura A+B puede preservar o cambiar esa regla.

Debe definirse si:

- el aprobador debe cubrir todas las sites del grupo;
- cada site aprueba una parte;
- existe una decisión financiera superior.

No se debe crear un RBAC paralelo sin esa decisión.

Un usuario que solo ve A no debería recibir datos sensibles de B únicamente para explicar un group approval, salvo que el modelo de permisos lo autorice.

## 7.8 Proveedores

Para preservar la lógica anterior, supplier es especialmente importante.

Hoy dos proveedores nunca comparten la misma cabecera generada.

Por tanto unir proveedores diferentes en un group threshold sería una policy nueva, no una preservación exacta.

## 7.9 Reportes/exportaciones

El export actual está ligado a una sola requisición.

T3 necesita decidir:

- si existe export de grupo;
- si cada child exporta su parte y muestra group reference;
- cómo se muestra total conjunto/approval;
- cómo se cuentan compras en reportes.

Sin esto, un auditor podría ver dos requisiciones de 600/500 y no entender por qué ambas están bloqueadas por threshold 1.000.

## 7.10 Documentos comerciales

Schema actual:

`procurement_documents.requisition_id NOT NULL`

Cada documento pertenece a exactamente una requisición.

Las líneas del documento deben pertenecer a items de esa misma requisición.

Receipts y supplier returns vinculados al documento también deben corresponder a esa requisición.

Por tanto el modelo actual no puede representar una sola factura/PO que abarque simultáneamente RQ-A y RQ-B.

Si T3 representa una compra externa conjunta, producto debe decidir si documentos siguen siendo por child o si una futura relación documental debe poder abarcar el group.

No se diseña aquí.

## 7.11 Históricos

No existe group ID histórico.

No puede reconstruirse de forma confiable si dos requisiciones separadas fueron “la misma necesidad”.

Para requisiciones mixed-site actuales no hace falta crear children históricos: la propia requisición original ya representa su unidad económica histórica y debe conservarse intacta.

T3 debe aplicarse solo a nuevas requisiciones separadas, salvo una decisión explícita de migración que hoy no tiene evidencia suficiente.

## 7.12 Riesgos

- nueva entidad/lifecycle;
- estados child vs group divergentes;
- approvals y receipts desincronizados;
- visibilidad cross-site;
- documentos comerciales single-requisition;
- reopen complejo;
- cancelaciones parciales;
- imposibilidad de backfill fiable.

## 7.13 Complejidad

**Alta**.

Introduce una capa de dominio superior a requisition y toca approval, audit y potencialmente reconciliación/reportes.

## 7.14 Información adicional requerida

1. qué crea un logical purchase;
2. si siempre está limitado a un supplier;
3. si solo agrupa children de la misma operación de generación;
4. si puede crecer después;
5. quién puede aprobar un grupo cross-site;
6. dónde vive approval state;
7. cómo child receipts consultan el approval;
8. reglas de edit/reopen/cancel;
9. export/report de grupo;
10. relación con documentos comerciales.

---

# 8. Comparación descriptiva T1 / T2 / T3

| Criterio | T1 — por requisición | T2 — acumulado por sitio/período | T3 — compra lógica |
| --- | --- | --- | --- |
| Unidad de evaluación | una requisición site-specific | suma de requisiciones dentro de una ventana de site | grupo económico de child requisitions |
| Modelo actual reutilizable | alto | parcial | parcial |
| Nueva identidad compartida | no para approval | ventana/ledger o snapshot equivalente | sí, group/intent o equivalente |
| Tiempo | instantáneo por requisition | depende de período | instantáneo por logical purchase |
| Supplier | cada requisition ya tiene uno | debe decidirse si forma parte de la clave | para preservar lógica actual debería considerarse |
| Approval events actuales | suficientes por requisition | insuficientes para explicar ventana sin metadata/modelo adicional | insuficientes como única fuente de verdad de grupo |
| Site-scoped user | decide su requisition | decide dentro de su site/window | group cross-site requiere regla adicional |
| Edit/reopen | ya existe | puede afectar otras requisitions de ventana | puede afectar todas las children del grupo |
| Export actual | funciona por child | necesita contexto acumulado para auditoría | necesita group reference o export de grupo |
| Documentos actuales | por child | pueden seguir por child | single-requisition puede ser insuficiente si documento externo cubre group |
| Histórico | preservar tal cual | no hay ventanas históricas | no hay group histórico |
| Concurrencia nueva | limitada a cada requisition | crítica al calcular acumulado | crítica para consistencia group/children |
| Complejidad relativa | baja-media | alta | alta |

La tabla es descriptiva. No selecciona alternativa.

---

# 9. Impacto sobre datos históricos

## 9.1 Clasificación posible por site

Con el modelo actual puede inspeccionarse `supplier_requisition_items.site_id`.

Una requisición histórica puede clasificarse como:

### Single-site inequívoca

Todas las líneas tienen el mismo `site_id` no-null.

### Mixed-site

Hay más de un `site_id` distinto no-null.

### Unresolved

Existe al menos una línea con site null, o no puede establecerse una sede única con certeza.

Esta clasificación sirve para migración futura, pero no debe cambiar la identidad económica histórica.

## 9.2 Requisiciones existentes

No dividir.

No renumerar.

No recalcular threshold.

No volver a ejecutar el generador.

No crear children artificiales.

## 9.3 Aprobadas/rechazadas

La migración 028 ya tenía lifecycle statuses:

- approved;
- rejected;

antes de que la migración 034 introdujera el modelo formal de approval snapshot/events.

Migración 034 agrega defaults:

- `approval_required=false`;
- `approval_state='not_required'`;
- mode `none`.

No se observa backfill de approval history para registros anteriores.

Por tanto una requisición histórica con `status='approved'` no necesariamente tiene un event formal de approval de la policy actual.

**No debe reinterpretarse.**

Para requisiciones creadas bajo la policy formal, el snapshot/events debe conservarse exactamente.

## 9.4 Recepciones

Migración 033 vincula:

`inventory_transactions → requisition_id + requisition_item_id`.

Ese vínculo conserva la requisición histórica original.

No debe reasignarse a nuevas requisiciones por site.

## 9.5 Devoluciones

`supplier_returns` referencia requisition.

`supplier_return_items` referencia:

- requisition item;
- receipt source;
- inventory item;
- warehouse.

Son evidencia histórica encadenada a la requisición original.

No deben moverse ni duplicarse.

## 9.6 Devoluciones a proveedor / Kardex

El movimiento `supplier_return` conserva:

- requisition;
- requisition item;
- supplier return;
- source receipt.

La trazabilidad histórica es suficiente para mantener la cadena original.

No es evidencia de logical purchase entre requisiciones distintas.

## 9.7 Documentos asociados

`procurement_documents` y sus líneas/evidencias son single-requisition.

Son inmutables en sus campos core según migración 036.

No deben relinkearse a children futuros.

## 9.8 Auditoría

Hay dos fuentes:

- `supplier_requisition_approval_events`;
- `audit_log`.

La metadata de eventos requested/reopened/amended puede incluir totals usados en distintos momentos.

Sin embargo no debe asumirse que todos los registros históricos tienen una secuencia completa de metadata de monto:

- legacy pre-migration puede no tener events;
- decision event aprobado/rechazado no persiste por sí solo el total económico;
- las líneas pueden haber cambiado y generado reopen/amended.

Los datos son adecuados para preservar la evidencia existente, pero no para inventar retrospectivamente una política T2/T3.

---

# 10. ¿Existe información suficiente para reconstruir site y compra lógica históricas?

## Site

### Sí, en algunos casos

Si todas las líneas históricas tienen el mismo site no-null, existe evidencia fuerte para clasificar la requisición como single-site.

### No, de forma universal

Mixed-site y site-null deben preservarse como legacy/unresolved.

## Compra lógica

**No.**

No existe:

- group ID;
- submission ID persistido;
- parent requisition;
- purchase intent;
- window ID.

Campos como:

- supplier;
- requested_by;
- needed_by;
- notes;
- timestamps cercanos;

no son una clave histórica fiable.

Por tanto no existe información suficiente para agrupar retrospectivamente varias requisiciones independientes como una misma compra lógica de forma auditable.

---

# 11. Impacto sobre auditoría y trazabilidad

## T1

La unidad de auditoría continúa siendo requisition.

Ventaja estructural: el modelo existente ya coincide con esa granularidad.

Debe quedar claro en reports que la unidad cambió de potentially mixed-site a site-specific.

## T2

La auditoría debe capturar el contexto acumulado en cada evaluación.

Sin eso no sería explicable por qué una requisición individual por debajo del threshold quedó pending.

La membresía de una ventana no debería depender solo de una query actual porque ediciones/cancelaciones cambian los datos.

## T3

La auditoría necesita una relación explícita entre:

- compra lógica;
- requisiciones hijas;
- sites;
- total conjunto;
- decisiones.

Los events actuales por requisition no constituyen un ledger de grupo.

---

# 12. Fixtures y pruebas actuales

## 12.1 Seed

`scripts/seed.mjs`

No contiene fixtures de:

- requisitions;
- approval policy;
- procurement documents;
- supplier returns.

La cobertura de Procurement está concentrada en smokes CI.

## 12.2 requisition-approval-smoke.mjs

Cubre:

- policy threshold = 1.000;
- snapshot `threshold/admin_manager/self=false`;
- requisition manualmente marcada pending;
- event requested con metadata:
  `estimated_total=1500`;
- transición manual a approved;
- event approved;
- reapertura manual a pending;
- event reopened;
- existencia del historial.

### No cubre

- `POST /api/requisitions/generate`;
- fórmula quantity × unit_cost;
- comparación `>=`;
- total mixed-site;
- split por site;
- mode none/all;
- línea de costo cero;
- edición que cruza threshold;
- edición que baja de threshold;
- reopen real del endpoint;
- self-approval real;
- admin_only/admin_manager real;
- limited-site coverage real;
- receipt gate real.

El smoke prueba principalmente schema/snapshot/event history, no el algoritmo HTTP completo.

## 12.3 requisition-receipt-smoke.mjs

Cubre un fixture **single-site**:

- requisition;
- item;
- receipt parcial;
- receipt final;
- link requisition/requisition item;
- stock;
- status partial/fulfilled.

No cubre approval gate ni mixed-site.

## 12.4 supplier-return-smoke.mjs

Cubre un fixture single-site:

- requisition fulfilled;
- receipt;
- supplier return;
- retorno parcial;
- source_transaction;
- stock;
- exceso rechazado;
- distinción entre return-to-stock y supplier_return.

No cubre group/site split ni approval.

## 12.5 procurement-reconciliation-smoke.mjs

Cubre:

- requisition single-site;
- purchase order/invoice/credit note;
- document lines;
- receipt evidence;
- supplier return evidence;
- diferencias de quantity/value;
- inmutabilidad;
- review.

Usa currency `COP` en documentos.

No prueba que `currency_code` afecte approval; de hecho no lo hace.

## 12.6 inventory-i2a2-transaction-integrity-smoke.mjs

Cubre integridad/idempotencia de movimientos y cross-organization invariants.

No cubre threshold de requisitions.

## 12.7 CI

CI actual ejecuta:

- `requisition-receipt-smoke.mjs`;
- `requisition-approval-smoke.mjs`;
- `supplier-return-smoke.mjs`;
- `procurement-reconciliation-smoke.mjs`;
- `inventory-i2a2-transaction-integrity-smoke.mjs`.

No existe un smoke específico de aprobación site-split.

---

# 13. Pruebas necesarias posteriormente

No se crean en esta fase.

## 13.1 Baseline del algoritmo actual

Antes de cambiar generación:

1. threshold exacto `total == threshold` requiere approval;
2. total menor no requiere;
3. mode all;
4. mode none;
5. costo cero contribuye cero;
6. múltiples suppliers se evalúan por separado;
7. mixed-site mismo supplier se evalúa hoy conjuntamente.

## 13.2 Separación site-owned

1. Site A + Site B + mismo supplier produce dos requisitions;
2. ninguna child mezcla líneas;
3. site-null nuevo se rechaza o resuelve según futura regla;
4. multi-site user puede crear ambas sin mezclarlas;
5. single-site user no puede crear la otra;
6. legacy mixed-site permanece intacta.

## 13.3 Approval post-split

La fixture exacta debe depender de T1/T2/T3.

Caso canónico:

- threshold 1.000;
- A 600;
- B 500.

El expected result no puede codificarse hasta tomar la decisión de policy.

## 13.4 Edición

1. bajo threshold → editar sobre threshold;
2. approved → cambio de quantity;
3. approved → cambio de cost;
4. approved → change needed_by;
5. pending → amendment;
6. reducción posterior al threshold;
7. child/group/window según policy seleccionada.

## 13.5 Roles

1. admin_only;
2. admin_manager;
3. requester self approval false;
4. requester self approval true cuando además es approver;
5. user limited-site;
6. user multi-site;
7. platform owner;
8. superadmin con organization scope.

## 13.6 Recepción

1. pending no recibe;
2. rejected no recibe;
3. approved recibe;
4. reopen vuelve a bloquear;
5. warehouse del mismo site tras I2-A2.2;
6. legacy requisition conserva reglas legacy sin mutar historia.

## 13.7 Históricos

1. single-site derivable;
2. mixed-site;
3. site-null;
4. legacy status approved sin formal events;
5. formal approved con events;
6. receipts/returns/documents continúan enlazados al ID original.

## 13.8 T2, si se selecciona

Además:

- frontera de período;
- timezone;
- acumulado concurrente;
- cross-supplier según decisión;
- cancel/reject;
- edit del acumulado;
- dos requests concurrentes que cruzan threshold;
- recepción antes/después del cruce;
- audit snapshot de ventana.

## 13.9 T3, si se selecciona

Además:

- creación de group + children;
- mismo supplier;
- children de varios sites;
- approval conjunto;
- edit/reopen;
- cancel child;
- user sin cobertura total;
- receipt gate por group;
- group export/report;
- documentos según decisión documental.

---

# 14. Decisiones de producto todavía pendientes

La decisión “una requisición nueva = organización + sede + proveedor” **no determina por sí sola** la unidad financiera del threshold.

Antes de implementación funcional debe elegirse explícitamente:

## D1 — Política principal

- T1;
- T2;
- T3.

## D2 — Si se elige T2

Definir:

- período;
- timezone;
- key de acumulación;
- supplier sí/no;
- estados incluidos;
- monto incluido;
- evento que dispara approval;
- tratamiento de requisiciones ya recibidas;
- reopen;
- cancel/reject.

## D3 — Si se elige T3

Definir:

- qué constituye una compra lógica;
- si group está siempre limitado a un supplier;
- si group se crea solo desde una misma operación;
- si admite children posteriores;
- quién puede aprobar cross-site;
- dónde vive approval state;
- comportamiento de receipts;
- documentos y export.

## D4 — Moneda

El threshold actual no persiste currency.

Debe decidirse si I2-A2.2 conserva explícitamente la convención monetaria implícita o si una formalización de moneda pertenece a otra fase.

No debe asumirse dentro de la implementación.

## D5 — Reportes

Definir qué representa una “requisición” en métricas después del split y si debe existir también una métrica de compra/grupo/ventana según T2/T3.

---

# 15. Riesgos

## Riesgo de cambio silencioso

Implementar primero el split por site y dejar el algoritmo actual sin decisión equivale de facto a T1.

Eso sería una decisión de negocio implícita y puede reducir approvals respecto al total mixed-site anterior.

## Riesgo histórico

Intentar repartir requisiciones históricas destruye la identidad que hoy enlaza:

- approval;
- receipts;
- returns;
- documents;
- audit.

## Riesgo T2

Acumulación sin locking puede permitir bypass por concurrencia.

Acumulación sin snapshot puede hacer imposible explicar una decisión antigua.

## Riesgo T3

Group sin fuente de verdad puede desincronizar:

- child approval states;
- receipt gates;
- audit;
- documentos.

## Riesgo de site scope

T3 cross-site puede obligar a decidir cómo mostrar/autorizar una compra cuyo total incluye sites no visibles para un usuario.

## Riesgo monetario

La ausencia de currency en threshold no es nueva, pero cualquier agregación T2/T3 amplifica el impacto de esa suposición implícita.

---

# 16. Secuencia técnica recomendada

Esta secuencia es técnica y **no selecciona T1/T2/T3**.

## Paso 1 — Cerrar el domain decision del threshold

No implementar el split con comportamiento financiero implícito.

Seleccionar T1/T2/T3 y resolver sus preguntas obligatorias.

## Paso 2 — Congelar compatibilidad histórica

Definir formalmente las categorías:

- single-site derivable;
- mixed-site;
- unresolved.

Establecer que:

- no se dividen;
- no se recalculan;
- no se reescriben approval events;
- descendants mantienen requisition_id original.

## Paso 3 — Diseñar únicamente el modelo adicional exigido por la policy elegida

T1:

- no requiere nueva capa de approval.

T2:

- requiere representación auditable de ventana/acumulado.

T3:

- requiere identidad persistente de compra lógica o equivalente.

No crear ambas arquitecturas.

## Paso 4 — Implementar ownership de requisition por site

En una nueva migración, no editando migraciones históricas.

La implementación deberá preservar legacy nullable/unresolved según el gate anterior.

## Paso 5 — Adaptar generación

Backend como autoridad:

`organization + site + supplier`.

RequisitionBuilder solo refleja la agrupación; no sustituye validación server-side.

Aplicar la policy seleccionada dentro de la misma transacción de creación.

## Paso 6 — Adaptar approval/audit

Solo después de que la unidad económica esté definida.

Evitar construir un segundo RBAC.

Usar el scope existente de organization/site.

## Paso 7 — Adaptar downstream

- detalle/listado;
- edición;
- receipt;
- supplier return;
- procurement documents;
- export;
- supplier analytics/reporting.

## Paso 8 — Añadir fixtures de regresión de la policy seleccionada

Primero baseline económico, después site split, después históricos/downstream.

## Paso 9 — Validar migración sobre datos legacy

No basarse solo en fixtures single-site.

Medir:

- cuántas requisitions son single-site;
- mixed-site;
- unresolved.

El conteo debe hacerse sobre un entorno autorizado; este análisis no contiene datos productivos.

---

# 17. Conclusión

## Estado actual verificado

El sistema actual tiene una policy de approval por organización y una evaluación por requisición.

La requisición actual se genera por:

`organization + supplier`

y puede contener múltiples sites.

El threshold se calcula como:

`Σ(quantity_requested × unit_cost_estimated)`

sin impuestos, descuentos, fletes, cost center ni FX.

## Impacto central

Al convertir una requisición mixed-site en varias requisiciones site-specific, cambia la unidad natural sobre la que se ejecuta el threshold.

Por tanto la separación técnica no es neutral para approval.

## Históricos

Existe información suficiente para preservar la requisición histórica y sus descendants.

Existe información suficiente para identificar algunas requisiciones single-site inequívocas.

No existe información suficiente para reconstruir de forma autoritativa una compra lógica entre varias requisiciones independientes.

## Gate

**El análisis no autoriza seleccionar T1/T2/T3.**

La implementación funcional de la separación por site requiere una decisión de dominio previa sobre la unidad de approval.

Hasta esa decisión, implementar el split equivaldría a escoger T1 implícitamente.

---

## Resultado del análisis

- Modelo actual de approval: verificado.
- Fórmula: verificada.
- Roles/alcance: verificados.
- Currency: no formalizada en approval.
- Multi-level approval: no existe.
- Policy por site/proveedor/cost center: no existe.
- Purchase group: no existe.
- Impacto de split: demostrado.
- T1/T2/T3: comparados descriptivamente.
- Históricos: preservables; logical group no reconstruible.
- Fixtures: revisados; cobertura de threshold es parcial y principalmente schema/audit.
- Implementación funcional: **ninguna**.

**Siguiente paso requerido: domain decision sobre T1/T2/T3 y, si corresponde, sus parámetros obligatorios.**
