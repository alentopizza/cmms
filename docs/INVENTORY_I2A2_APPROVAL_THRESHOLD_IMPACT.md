# I2-A2.2-F — Approval Threshold Impact Analysis

Fecha: 2026-09-29  
Tipo: **diagnóstico y análisis de impacto; sin implementación funcional**.

HEAD funcional inspeccionado:

`cd3e9ca77b5e3acd4a1984d2e9d96fb4d289a184`

Decisión de dominio vigente:

> Una requisición nueva pertenece a una única organización + sede + proveedor.

Este documento analiza exclusivamente el impacto de esa decisión sobre approval y thresholds. No implementa migraciones, schema, APIs, frontend, RBAC, policies, thresholds, generación, compra lógica, centros de costo, documentos, datos ni smokes.

---

# 1. Estado actual

## 1.1 Policy de aprobación

La tabla `organization_procurement_policies` tiene una fila por organización. `organization_id` es la PK.

Campos relevantes:

- `approval_mode`: `none | all | threshold`;
- `approval_threshold numeric(14,2)`;
- `approver_scope`: `admin_only | admin_manager`;
- `allow_requester_self_approval`;
- `updated_by`, `updated_at`.

No existe policy por proveedor, sede, centro de costo, usuario o moneda.

Cada requisición copia un snapshot de la policy al crearse: `approval_required`, `approval_state`, `approval_policy_mode`, `approval_threshold`, `approval_approver_scope`, `approval_self_allowed` y datos de decisión. Cambiar la policy de la organización no reescribe requisiciones históricas.

## 1.2 Estados y auditoría

Estados: `not_required`, `pending`, `approved`, `rejected`.

`supplier_requisition_approval_events` registra `requested`, `approved`, `rejected`, `reopened` y `amended`, con actor, transición, notas, metadata y fecha.

## 1.3 Algoritmo actual al crear

Ruta: `POST /api/requisitions/generate`.

```text
items seleccionados
→ validar organization/site/supplier
→ agrupar por organization + supplier
→ quantity desde formulario
→ unitCost = inventory_items.unit_cost
→ estimatedTotal = Σ(quantity × unitCost)
→ cargar policy de la organización
→ evaluar mode/threshold
→ crear requisition
→ snapshot de policy
→ approval event si aplica
```

Regla:

```text
mode=none      → approvalRequired=false
mode=all       → approvalRequired=true
mode=threshold → approvalRequired=(estimatedTotal >= approval_threshold)
```

## 1.4 Reevaluación al editar

`POST /api/requisitions/[id]` recalcula:

`Σ(quantity_requested × unit_cost_estimated)`.

Si una requisición que no requería approval cruza el threshold, activa `approval_required`, pasa a `pending` y registra eventos. Cambios posteriores de cantidad, costo o `needed_by` pueden reabrir una aprobación ya decidida. Una requisición que ya quedó gobernada no se saca silenciosamente de approval por reducir su monto.

## 1.5 Aprobadores

Primero se exige `can(session,"requisitions.approve")`.

El permiso existe para platform owner, superadmin, admin y manager; no para technician, requester, viewer, provider ni external.

Para usuarios tenant el snapshot `approval_approver_scope` limita además:

- `admin_only` → solo admin;
- `admin_manager` → admin o manager.

Si `approval_self_allowed=false`, el requester no puede aprobar su propia requisición. Hoy un tenant limited-site debe cubrir todos los sites explícitos de las líneas. Platform owner/superadmin conservan el modelo de permisos y organization scope existente.

No existen niveles de aprobación por rangos de monto ni escalación automática de un rol a otro según el total.

## 1.6 Moneda

`approval_threshold` no tiene `currency_code`. Requisition y requisition item tampoco almacenan currency para este cálculo. No se encontró conversión FX.

`procurement_documents.currency_code` existe, pero es documental y no participa en el threshold.

Conclusión factual: el sistema compara valores numéricos de costo estimado bajo la unidad monetaria implícita de la organización. El repositorio no formaliza cuál es esa moneda.

## 1.7 Centro de costo

El único modelo confirmado es `inventory_transactions.cost_center text`. No hay cost center en requisition, requisition item ni approval policy. Por tanto actualmente no interviene en el threshold.

---

# 2. Evidencia del repositorio

| Archivo / tabla | Función | Evidencia |
| --- | --- | --- |
| `db/migrations/034_requisition_approval_policy.sql` | schema | policy por organization, snapshot y approval events |
| `organization_procurement_policies` | configuración | una policy por organization |
| `supplier_requisitions` | snapshot | required/state/mode/threshold/approver scope |
| `supplier_requisition_approval_events` | auditoría | requested/approved/rejected/reopened/amended |
| `app/api/procurement-policy/route.ts` | POST settings | guarda policy organizacional |
| `app/dashboard/settings/page.tsx` | UI | mode, monto mínimo, approver scope y self-approval |
| `app/api/requisitions/generate/route.ts` | creación | suma quantity × unit_cost y aplica threshold |
| `app/api/requisitions/[id]/route.ts` | edición | recalcula total y activa/reabre approval |
| `app/api/requisitions/[id]/approval/route.ts` | decisión | permiso, roles, self-approval, site coverage y audit |
| `app/dashboard/requisitions/[id]/page.tsx` | UI | estado, policy, history y acciones |
| `lib/permissions.ts` | RBAC | define `requisitions.approve` |
| `scripts/requisition-approval-smoke.mjs` | fixture | threshold=1000, estimated_total=1500 |
| `scripts/seed.mjs` | seed | no existe seed automático |
| `db/migrations/036_procurement_document_reconciliation.sql` | documentos | PO/remisión/factura/nota crédito por requisition |
| `lib/procurement-reconciliation.ts` | conciliación | requested/receipt/return values de una requisition |

La UI denomina esta regla “Aprobar desde un monto estimado” y expresa que la policy se copia a cada requisición para conservar trazabilidad.

---

# 3. Impacto al pasar a requisiciones por sede

Actual:

```text
organization + supplier
→ una requisition
→ Total = Total(A) + Total(B) si mezcla sites
→ una evaluación de threshold
```

Futuro:

```text
organization + site A + supplier → RQ-A → Total(A)
organization + site B + supplier → RQ-B → Total(B)
```

Sea `T` el threshold. Hoy puede evaluarse `(A+B) >= T`. Si las nuevas requisiciones se evalúan de forma independiente, pasa a `A >= T` y `B >= T`. No son equivalentes.

Con `approval_mode=none` el split no introduce esta ambigüedad. Con `approval_mode=all`, todas las requisiciones resultantes requieren aprobación. La diferencia financiera crítica se concentra en `threshold`.

Cada requisición nueva seguirá siendo una unidad independiente de status, snapshot, approval events, edición/reopen, documentos y export, salvo que se introduzca explícitamente una entidad superior.

---

# 4. Ejemplos

No hay datos productivos embebidos. El smoke de approval usa un fixture técnico: `threshold=1000` y metadata `estimated_total=1500`; demuestra snapshot/audit, no una compra real.

> Ejemplo hipotético para ilustrar el comportamiento.

```text
T=1000
A=600
B=600

actual: A+B=1200 → approval required
separado: A=600 → no; B=600 → no
```

> Ejemplo hipotético para ilustrar el comportamiento.

```text
T=1000
A=1300
B=400

actual: 1700 → approval required
separado: A=1300 → required; B=400 → no
```

> Ejemplo hipotético para ilustrar el comportamiento.

```text
mode=all
A=100
B=200

actual: una requisition, una decisión
futuro: dos requisitions, ambas requieren approval
```

> Ejemplo hipotético para ilustrar el comportamiento.

```text
T=1000
RQ-A inicial=800 → no approval
edición posterior=1100 → el algoritmo actual puede activar approval
```

---

# 5. T1 — Threshold por requisición/site

Cada requisición site-specific evalúa su propio total contra el threshold organizacional snapshoteado.

Compatibilidad: después de creada, toda la arquitectura actual ya es requisition-scoped: snapshot, state, events, edit/reopen, approval endpoint, documents y export.

No necesita una entidad adicional para calcular approval.

Auditoría: cada requisición conserva su propia historia, como hoy.

Documentos: continúan ligados a una sola requisición.

Usuarios: A opera RQ-A; A+B puede operar RQ-A y RQ-B separadamente; global mantiene permisos/organization scope.

Impacto: la fragmentación puede cambiar qué importes cruzan el threshold frente al antiguo total A+B.

---

# 6. T2 — Compra lógica agregada

Concepto:

```text
Compra lógica X
├── RQ-A
├── RQ-B
└── RQ-C

threshold sobre Σ(total de las requisiciones de X)
```

## Estructura existente

No se encontró en Procurement/Requisiciones una entidad equivalente a purchase request, procurement request, parent requisition, requisition group, purchasing batch, procurement cycle o aggregate request.

Las tablas actuales relevantes son requisitions/items, policies/events, supplier returns y procurement documents/evidence. Ninguna persiste un parent/group/batch de intención de compra.

Los batches de importación de Inventario no representan procurement y no son reutilizables conceptualmente.

Por tanto T2 requeriría una nueva identidad de dominio o relación equivalente. No se crea ni diseña aquí.

Approval: habría que definir si el state vive en el grupo o en cada hija con cálculo agregado.

Auditoría: los events actuales apuntan a una sola requisición; habría que definir audit de grupo/hijos.

Documentos: los procurement documents actuales apuntan a una sola requisición.

Seguridad: un aprobador de A podría depender de montos B/C que no debe consultar; el modelo actual no tiene una proyección de approval agregado con ocultamiento cross-site.

T2 añade identidad, lifecycle, authorization, audit y coordinación entre requisiciones.

---

# 7. T3 — Policy por sede

Concepto: policy por `organization + site` en vez de una única policy por organization.

Hoy `organization_procurement_policies.organization_id` es PK y Settings administra una policy por empresa. No hay `site_id`, override, fallback ni UI site-aware.

La fórmula `estimatedTotal >= threshold` podría seguir siendo la misma, pero mode/threshold vendrían de la policy aplicable al site.

Administración: habría que definir policy obligatoria por site, default organizacional + override, u otra regla. El repositorio no define cuál.

Migración: debe definirse si la policy actual se copia a cada site, queda como default o genera overrides.

El snapshot actual seguiría siendo útil y protegería históricos.

T3 puede introducir comportamientos financieros distintos entre sedes que hoy no existen en la configuración.

---

# 8. Compra lógica

Resultado: **no existe actualmente una entidad de compra lógica que agrupe varias requisiciones**.

La generación puede devolver varios IDs creados, pero no persiste una relación común entre ellos. El único nexo es la acción HTTP que los originó.

T2 no puede implementarse correctamente reutilizando una entidad existente.

---

# 9. Históricos

Las requisiciones históricas pueden quedar `site_id=NULL` cuando sean mixed-site o unresolved.

Su approval histórico no debe recalcularse, invalidarse, reabrirse por la migración ni reinterpretarse con la futura policy.

El snapshot y los approval events preservan la regla aplicada en su momento. Una requisición histórica aprobada sobre A+B conserva esa semántica histórica.

La introducción futura de site afecta autorización operativa, no la validez de la decisión histórica.

---

# 10. Documentos / facturación

Existe un módulo de procurement documents con tipos `purchase_order`, `delivery_note`, `invoice`, `credit_note` y `other`.

Esto permite almacenar una factura como evidencia de procurement, pero no demuestra un sistema completo de cuentas por pagar/pagos.

Cardinalidad actual:

```text
procurement_document → exactamente 1 requisition_id
```

Las document lines pertenecen a requisition items de esa misma requisición.

Delivery note/invoice pueden enlazar múltiples receipts, pero de la requisición del documento. Credit note puede enlazar supplier returns, también de la misma requisición/supplier.

`procurement_documents.currency_code` existe; approval threshold no usa ese campo.

El modelo actual no soporta una sola factura/documento ligada simultáneamente a RQ-A y RQ-B. Esa brecha existe independientemente de cuál política T1/T2/T3 se adopte.

No se diseña una solución documental nueva en esta fase.

---

# 11. Centros de costo

`inventory_transactions.cost_center` es texto libre usado en movimientos, receipt de requisición, supplier return por copia, importación, Kardex y export.

No existe relación entre cost center y `approval_mode`, `approval_threshold`, approver scope, requisition o approval events.

Conclusión: **el threshold actual no depende de centro de costo**.

Una futura policy por cost center sería una regla financiera nueva y no está respaldada por el comportamiento actual.

---

# 12. Matriz comparativa

| Criterio | T1 — por requisición/site | T2 — compra lógica agregada | T3 — policy por sede |
| --- | --- | --- | --- |
| Cambios de modelo | Mantiene approval requisition-scoped | Requiere group/intención no existente | Requiere policy site-aware |
| Cambios en approval | Misma fórmula; cambia la unidad de agrupación | Debe definir approval del grupo vs hijos | Misma fórmula posible, distinta policy por site |
| Nuevas entidades | No necesita entidad adicional para threshold | Sí, o relación equivalente | Puede extender policy; diseño por definir |
| Migración | Principalmente site ownership | Además groups/enlaces | Migrar policy organization-only a default/site |
| Compatibilidad histórica | Snapshots intactos | Históricos no tienen group ID | Snapshots intactos |
| Complejidad técnica | Usa estructuras actuales | Lifecycle/auth/audit multi-RQ | Configuración/administración por site |
| Impacto multi-sede | Cada site evalúa su RQ | Puede conservar agregado entre RQ | Cada site puede tener regla diferente |
| Auditoría | History por requisición | Definir group audit vs child audit | History por requisición |
| Documentos | Documento por requisición | Definir relación documento-grupo/hijos | Documento por requisición |
| Usuario una sede | Solo su RQ | Aggregate puede depender de montos no visibles | Policy de su site |
| Usuario multi-sede | RQ independientes | Coverage de grupo por definir | Varias policies/site |
| Perfil global | Scope actual por RQ | Reglas de grupo nuevas | Scope actual sobre RQ/site policy |

La matriz es descriptiva. No usa puntuaciones, rankings ni declara ganador.

---

# 13. Compatibilidad con el nuevo modelo site-owned

Usuario A: solo puede aprobar requisiciones de A según permiso/policy.

Usuario A+B: puede aprobar RQ-A y RQ-B según permiso/policy. A+B no permite una requisición A+B.

Usuario global: mantiene acceso transversal según el modelo actual.

No se crean permisos nuevos.

El site continúa siendo la frontera de la requisición independientemente de T1/T2/T3.

---

# 14. Riesgos

## Aprobación
- fragmentación del total bajo threshold;
- más decisiones con `mode=all`;
- T2 necesita semántica de reopen/cancel entre hijos;
- T3 introduce configuración financiera por site.

## Auditoría
- T2 no tiene modelo actual de event de grupo;
- históricos no deben reinterpretarse.

## Documentos
- documentos actuales son single-requisition;
- factura externa multi-RQ no está soportada;
- currency documental no participa en threshold.

## Seguridad
- T2 puede requerir calcular con montos de sedes no visibles para un aprobador single-site;
- cualquier agregado futuro debe preservar aislamiento cross-site.

## Compatibilidad
- snapshots actuales protegen históricos;
- nuevas policies/groups no deben reescribir requisiciones existentes.

---

# 15. DECISIÓN DE PRODUCTO REQUERIDA

Antes de cambiar la generación a `organization + site + supplier` debe definirse expresamente qué unidad gobierna `approval_mode="threshold"`.

## T1

> Cada requisición site-specific evalúa independientemente el threshold organizacional actual.

Consecuencia conocida: A+B podía requerir aprobación aunque A y B separados no la requieran.

## T2

> Requisiciones site-specific de una misma intención de compra se evalúan sobre un total agregado.

Consecuencia conocida: requiere introducir y gobernar una compra lógica/grupo que hoy no existe.

## T3

> Cada sede tiene su propia policy/threshold de aprobación.

Consecuencia conocida: requiere convertir la configuración organization-only en site-aware y definir herencia/migración.

El repositorio no contiene evidencia que permita seleccionar automáticamente entre T1, T2 o T3.

La decisión debe ser tomada por producto/finanzas antes de cambiar el comportamiento del threshold.
