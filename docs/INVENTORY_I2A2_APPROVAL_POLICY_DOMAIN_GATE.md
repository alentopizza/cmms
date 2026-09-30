# I2-A2.2 — Domain Decision Gate: Approval Policy for Site-Owned Requisitions

Fecha: 2026-09-30  
Tipo: **gate de decisión de producto; sin implementación funcional**.

HEAD funcional inspeccionado antes de este documento:

`9274adf05d1031c80fb17e02805e26cfda73df2b`

Documentos base:

- `docs/INVENTORY_I2A2_REQUISITIONS_SITE_DIAGNOSIS.md`
- `docs/INVENTORY_I2A2_REQUISITIONS_DOMAIN_DECISION_GATE.md`
- `docs/INVENTORY_I2A2_APPROVAL_THRESHOLD_IMPACT_ANALYSIS.md`

## Alcance

Este documento no selecciona T1, T2 ni T3.

No implementa:

- tablas;
- migraciones;
- APIs;
- queries;
- UI;
- permisos;
- generación;
- aprobación;
- recepción;
- devoluciones;
- documentos;
- exports;
- fixtures;
- smoke tests.

Su único objetivo es dejar explícitas las consecuencias de negocio y arquitectura de cada alternativa antes de avanzar a diseño técnico.

---

# 1. Decisiones ya cerradas y que este gate no reabre

## 1.1 Requisición nueva

La regla de dominio ya decidida es:

```text
requisition
=
organization
+
site
+
supplier
```

Una requisición nueva no puede mezclar líneas de sitios distintos.

Tener acceso a A+B permite operar requisiciones de A y requisiciones de B, pero no crear una requisición A+B.

## 1.2 Históricos

No dividir ni reconstruir retrospectivamente:

- IDs;
- números;
- approvals;
- approval events;
- receipts;
- supplier returns;
- procurement documents;
- audit log.

Las requisiciones legacy mixed-site y legacy unresolved se preservan.

## 1.3 Centro de costo futuro

El gate anterior dejó definido conceptualmente que un futuro centro de costo estructurado para Requisiciones sería site-owned:

```text
organization
+
site
+
cost_center
```

y que, si una línea tiene cost center estructurado, éste debe pertenecer al mismo site que la requisición.

Este documento analiza cómo T1/T2/T3 interactuarían con ese concepto futuro, pero no crea `cost_centers`.

## 1.4 Nomenclatura T1/T2/T3

Existe documentación anterior donde las etiquetas T1/T2/T3 se utilizaron con significados diferentes.

Para **este gate de approval policy**, las definiciones canónicas son exclusivamente:

- **T1 — Threshold por requisición**
- **T2 — Threshold acumulado por sitio**
- **T3 — Compra lógica**

Este documento no modifica los hechos técnicos de análisis anteriores; solo fija la nomenclatura de este decision gate.

---

# 2. Baseline actual verificado

## 2.1 Unidad técnica actual

El generador actual agrupa por:

`organization_id + supplier_id`

Una misma requisición puede contener líneas de distintos sites.

## 2.2 Fórmula actual

En creación:

```text
estimated_total
=
Σ(quantity × inventory_item.unit_cost)
```

Después de editar:

```text
total_estimated
=
Σ(quantity_requested × unit_cost_estimated)
```

## 2.3 Policy actual

`organization_procurement_policies` tiene una fila por organización.

La policy contiene:

- `approval_mode`;
- `approval_threshold`;
- `approver_scope`;
- `allow_requester_self_approval`.

No existe policy por:

- site;
- supplier;
- cost center;
- currency;
- purchase group.

## 2.4 Estados

Approval formal actual:

```text
not_required
pending
approved
rejected
```

Los eventos formales son requisition-scoped.

## 2.5 Regla threshold

```text
approval_mode = threshold
AND
estimated_total >= approval_threshold
→ approval_required
```

## 2.6 Edición

Una requisición puede empezar sin approval y cruzar el threshold después de editar.

Una vez que `approval_required=true`, el código evita que una reducción posterior simplemente saque a la requisición de gobernanza.

Cambios relevantes pueden reabrir una decisión.

## 2.7 Recepción

Si approval es requerido y el state no es `approved`, la recepción queda bloqueada.

## 2.8 Moneda

El approval threshold no tiene `currency_code`.

Los costos estimados de requisition items tampoco tienen moneda formal.

Los procurement documents sí pueden almacenar `currency_code`, pero ese valor no participa en approval.

No existe FX.

## 2.9 Compra lógica

No existe en el modelo actual una entidad persistente equivalente a:

- purchase group;
- requisition group;
- procurement intent;
- parent requisition;
- approval group.

## 2.10 Centro de costo actual

No existe master de cost centers para requisiciones.

Solo existe:

`inventory_transactions.cost_center text`

como metadata operativa/histórica.

---

# 3. Caso obligatorio 1

```text
Organization X
Threshold = 1.000

Site A:
  Solicitud = 600

Site B:
  Solicitud = 500

Mismo proveedor
```

## T1

Se crean dos requisiciones site-specific:

```text
RQ-A = 600
RQ-B = 500
```

Cada una evalúa su propio total.

Resultado:

```text
RQ-A → no requiere approval
RQ-B → no requiere approval
```

El total combinado de 1.100 no existe como unidad de approval.

## T2

La acumulación es site-scoped.

En ausencia de otras requisiciones del mismo período:

```text
Acumulado Site A = 600
Acumulado Site B = 500
```

Resultado:

ningún site cruza 1.000.

El hecho de que ambas solicitudes compartan proveedor no cambia este resultado a menos que producto defina una policy diferente a “acumulado por sitio”.

## T3

Si A y B forman parte de la **misma compra lógica**:

```text
Logical Purchase LP-1
├── RQ-A 600
└── RQ-B 500

Total LP-1 = 1.100
```

La unidad conjunta cruza threshold.

El comportamiento exacto posterior depende de dónde viva el approval state y cómo se bloquee cada child requisition.

Si producto decide que A y B no forman la misma compra lógica, se evalúan como unidades separadas según la definición que se adopte.

---

# 4. Caso obligatorio 2

```text
Site A:
  RQ-001 = 600
  RQ-002 = 600
```

## T1

Cada requisición se evalúa por separado:

```text
RQ-001 600 → no requiere
RQ-002 600 → no requiere
```

No existe acumulación temporal.

## T2

Si ambas requisiciones pertenecen a la misma ventana de acumulación:

```text
Site A acumulado = 1.200
```

El threshold se cruza.

Producto debe definir qué entidad queda pendiente cuando ocurre el cruce:

- solo RQ-002;
- RQ-001 + RQ-002;
- toda la ventana;
- otra regla.

No se puede inferir del sistema actual.

## T3

Si RQ-001 y RQ-002 pertenecen a la misma compra lógica:

```text
LP-1 total = 1.200
```

la compra lógica cruza threshold.

Si representan necesidades independientes, no se agrupan.

Por tanto T3 exige una definición explícita de “misma necesidad/compra”.

---

# 5. Caso obligatorio 3

```text
Site A:
  RQ-001 = 600

Site B:
  RQ-002 = 600
```

## T1

```text
RQ-001 → no requiere
RQ-002 → no requiere
```

## T2

La acumulación es por site:

```text
Site A = 600
Site B = 600
```

Ningún site cruza 1.000 salvo que existan otras requisiciones dentro de su respectiva ventana.

## T3

Si producto permite que una compra lógica abarque varios sites y ambas requisiciones pertenecen a la misma compra:

```text
LP-1 = 1.200
```

la unidad económica conjunta cruza threshold.

Si una compra lógica no puede ser cross-site, cada requisición permanece fuera del threshold.

Este punto es una decisión de producto, no una consecuencia obligatoria de T3.

---

# 6. Caso obligatorio 4

```text
Site A:
  RQ-001 = 600  Supplier S1

Site A:
  RQ-002 = 600  Supplier S2
```

## T1

Cada requisición es independiente:

```text
RQ-001 → no requiere
RQ-002 → no requiere
```

## T2

Aquí supplier se convierte en una decisión crítica de la clave de acumulación.

### Si supplier NO participa

```text
organization + site + período
→ 600 + 600 = 1.200
```

Se cruza threshold.

### Si supplier SÍ participa

```text
Site A + S1 = 600
Site A + S2 = 600
```

No se cruza threshold.

El sistema actual no resuelve cuál de estas dos semánticas sería correcta.

## T3

El algoritmo actual ya separa requisiciones por proveedor.

Por tanto, si el objetivo de T3 es **preservar la lógica económica anterior**, agrupar S1 y S2 dentro de una misma compra aprobable sería una nueva policy, no una simple preservación.

Producto debe decidir:

- una logical purchase siempre tiene un solo supplier; o
- puede abarcar varios suppliers.

Si permite varios suppliers, debe asumir explícitamente que está cambiando la unidad financiera respecto al comportamiento actual.

---

# 7. T1 — Threshold por requisición

## 7.1 Semántica de negocio

La unidad financiera es cada requisición site-specific.

```text
organization + site + supplier
→ requisition
→ threshold
```

No existe relación económica automática entre requisiciones diferentes.

## 7.2 Modelo de datos requerido

Para approval, el modelo actual de snapshot por requisition puede seguir siendo la fuente de verdad.

No requiere una entidad superior de aprobación.

Sí depende del futuro `supplier_requisitions.site_id` definido por I2-A2.2.

## 7.3 Flujo de creación

El generador deberá separar por:

`organization + site + supplier`.

Cada grupo calcula:

`Σ(quantity × unit_cost)`

y aplica la policy organizacional vigente.

## 7.4 Flujo de aprobación

Cada requisición puede quedar:

- not_required;
- pending;
- approved;
- rejected.

Una aprobación no autoriza automáticamente otra requisición del mismo site, proveedor o generación.

## 7.5 Edición / reapertura

La lógica actual es conceptualmente reutilizable:

- editar amount/needed_by puede cruzar threshold;
- una requisición gobernada puede reabrirse;
- la reevaluación solo considera las líneas de esa requisición.

Una edición de RQ-A no reabre RQ-B.

## 7.6 Recepción

La recepción consulta el state de su requisición.

```text
RQ-A approved
→ puede recibir A

RQ-B pending
→ B sigue bloqueada
```

## 7.7 Devoluciones

Las devoluciones siguen ligadas a:

- requisition;
- requisition item;
- source receipt.

No necesitan approval agregado.

## 7.8 Documentos comerciales

El modelo actual de documentos single-requisition encaja directamente.

Cada child requisition tendría sus propios:

- purchase orders;
- delivery notes;
- invoices;
- credit notes;

según el uso real.

Una factura externa que abarque varias requisiciones seguiría siendo una limitación del modelo actual.

## 7.9 Auditoría

Los approval events actuales pueden conservar granularidad por requisición.

No existiría un evento que explique un total combinado entre varias requisiciones, porque ese total no forma parte de la policy.

## 7.10 Usuarios multi-sitio

Un usuario A+B puede operar RQ-A y RQ-B separadamente.

Un usuario solo A no necesita conocer importes de B.

No se requiere una autoridad cross-site de approval.

## 7.11 Proveedores

Un proveedor puede recibir más requisiciones que hoy, porque el split añade la dimensión site.

Una selección antes representada por una sola requisition S1 puede convertirse en múltiples requisiciones S1-A, S1-B, etc.

## 7.12 Centros de costo

Un futuro cost center:

`organization + site + cost_center`

puede asociarse a líneas de la requisición del mismo site.

En T1 el cost center no altera el threshold salvo que producto introduzca posteriormente una policy financiera adicional.

No debe asumirse que varios cost centers se acumulen o separen para approval.

## 7.13 Reportes / exportaciones

Los reportes tendrán más unidades de requisition.

Métricas como:

- requisition count;
- approval count;
- average requisition value;

pueden cambiar estructuralmente después del cutover.

El export actual por requisition es compatible.

## 7.14 Datos históricos

Legacy mixed-site y unresolved permanecen intactas.

Las nuevas requisitions usan T1 desde la fecha de vigencia.

No se recalculan approvals históricos.

## 7.15 Concurrencia

No requiere un lock entre requisiciones independientes para calcular threshold.

Cada creación/edición necesita únicamente consistencia de su propia requisition.

## 7.16 Complejidad técnica

La arquitectura de approval permanece requisition-scoped.

El trabajo adicional está principalmente en site ownership, scope y downstream.

## 7.17 Riesgos de implementación

- fragmentación del monto;
- menor cantidad de approvals bajo `threshold` frente a mixed-site histórico;
- aumento de cantidad de requisitions;
- comparación de métricas pre/post cutover sin contexto.

## 7.18 Compatibilidad hacia atrás

Alta para el lifecycle de cada requisition.

No reproduce necesariamente la misma decisión financiera que una antigua requisition mixed-site.

Legacy conserva su comportamiento histórico.

## 7.19 Impacto sobre NG26980

No se encontró `NG26980` en el repositorio, documentación funcional ni diagnósticos anteriores.

Tampoco se identificó de forma verificable un requisito externo pertinente bajo ese identificador.

Por tanto el impacto de T1 sobre NG26980 **no puede determinarse sin definir primero qué representa NG26980 y qué obligación impone**.

No debe diseñarse ninguna lógica a partir de una interpretación supuesta.

## 7.20 Nuevas pruebas necesarias

- misma requisition site-specific por debajo/sobre threshold;
- igualdad exacta con threshold;
- split A/B mismo supplier;
- múltiples suppliers;
- edit que cruza threshold;
- edit que reabre;
- receipt gate por child;
- roles/site scope;
- legacy mixed/unresolved sin cambios.

---

# 8. T2 — Threshold acumulado por sitio

## 8.1 Semántica de negocio

La unidad financiera deja de ser una requisition individual.

Pasa a ser:

```text
organization
+
site
+
período
(+ supplier si producto lo decide)
→ accumulated amount
→ threshold
```

Varias requisitions independientes pueden influir en la aprobación de otras.

## 8.2 Modelo de datos requerido

El sistema necesita una forma auditable de representar la ventana de acumulación.

Como mínimo debe poder persistirse o reconstruirse de forma inmutable:

- organization;
- site;
- período;
- reglas de inclusión;
- requisitions participantes;
- total evaluado;
- policy snapshot;
- threshold;
- momento del cruce;
- resultado.

No se define aquí si será:

- una tabla de window;
- ledger;
- snapshot por evaluation;
- otra arquitectura.

## 8.3 Flujo de creación

Cada nueva requisition site-owned sigue creándose por:

`organization + site + supplier`.

Antes de decidir `approval_required`, el sistema debe evaluar el accumulated amount de la ventana aplicable.

La operación debe ser transaccional.

## 8.4 Flujo de aprobación

El sistema actual no define qué ocurre cuando una requisition provoca que el acumulado pase de 900 a 1.200.

Producto debe elegir la semántica de aprobación:

- approval solo para la requisition que cruza;
- approval para todas las abiertas de la ventana;
- approval de la ventana como una unidad;
- otra regla.

Hasta cerrar esa decisión no puede diseñarse el endpoint de approval.

## 8.5 Edición / reapertura

Editar una requisition cambia potencialmente el acumulado de toda la ventana.

Debe decidirse:

- si reabre solo esa requisition;
- si reabre la ventana;
- si reabre otras requisitions;
- si reducir el total después del cruce cambia algo;
- qué pasa con approved/fulfilled anteriores.

La regla actual requisition-scoped no resuelve este lifecycle.

## 8.6 Recepción

El problema central es temporal.

Ejemplo:

```text
09:00 RQ-001 = 600 → bajo threshold → recibida
11:00 RQ-002 = 600 → acumulado = 1.200
```

Debe decidirse si:

- RQ-001 podía legítimamente recibirse;
- el threshold solo afecta la nueva requisition;
- la ventana debió bloquear desde el primer gasto;
- existe una reserva/proyección antes de recepción.

No existe respuesta en el código actual.

## 8.7 Devoluciones

Debe decidirse si una devolución:

- reduce el acumulado;
- no altera el acumulado histórico;
- solo afecta reporting;
- puede desactivar/reabrir approval.

El algoritmo actual no usa supplier returns para threshold.

## 8.8 Documentos comerciales

Los documentos siguen siendo requisition-scoped.

Sin contexto adicional, un auditor no podría saber por qué una requisition de 400 requirió approval si el motivo fue un accumulated amount de 1.400.

El documento/report de approval debería poder referenciar la ventana.

## 8.9 Auditoría

T2 necesita conservar:

- snapshot de la ventana;
- membresía;
- orden temporal;
- amount de cada requisition;
- total antes/después;
- threshold;
- actor;
- decisión;
- modificaciones.

Una query dinámica sobre los datos actuales no es suficiente porque las requisitions se pueden editar/cancelar.

## 8.10 Usuarios multi-sitio

Las ventanas A y B son distintas.

Un usuario A+B podría gestionar ambas.

Un usuario solo A no debería necesitar ver importes de B.

Si approval de A depende únicamente de A, el site boundary se mantiene claro.

## 8.11 Proveedores

La participación del proveedor en la clave es una decisión obligatoria.

### Supplier no participa

Compras S1+S2 se acumulan.

### Supplier participa

Cada supplier mantiene su propio accumulated amount dentro de cada site.

Ambas semánticas son posibles técnicamente; ninguna está definida por el repositorio.

## 8.12 Centros de costo

Un futuro cost center es site-owned.

T2 debe decidir si el acumulado es:

- por site, ignorando cost center;
- por site + cost center;
- por otra combinación.

Introducir cost center como partición de threshold sería una policy financiera adicional y no debe asumirse.

El master futuro puede existir como dimensión informativa sin gobernar approval.

## 8.13 Reportes / exportaciones

Se necesitaría explicar:

- amount individual;
- window;
- accumulated amount;
- threshold;
- qué requisitions contribuyeron.

Los exports actuales por requisition no contienen esta información.

Los KPIs deben distinguir entre:

- requisition count;
- approved requisitions;
- approval windows;
- accumulated spend/requested amount.

## 8.14 Datos históricos

No existe definición histórica de período ni membership.

No se puede backfillear T2 de forma autoritativa sobre requisitions legacy.

La policy tendría que tener una fecha de vigencia futura.

## 8.15 Concurrencia

Este es un requisito crítico.

Dos requests simultáneas:

```text
RQ-A = 600
RQ-B = 600
```

pueden leer un accumulated amount previo igual a 0 y ambas concluir “no requiere” si no existe serialización.

T2 requiere locking o un mecanismo transaccional equivalente por clave de acumulación.

## 8.16 Complejidad técnica

Introduce una unidad temporal compartida que no existe hoy.

Afecta:

- creation;
- edit;
- approval;
- receipt gate;
- audit;
- reporting;
- concurrency.

## 8.17 Riesgos de implementación

- race conditions;
- approval retroactivo;
- ventanas ambiguas;
- timezone;
- supplier key no definida;
- cancelaciones/ediciones que alteran acumulado;
- dificultad de explicar decisiones antiguas;
- consultas agregadas costosas si no existe un ledger apropiado.

## 8.18 Compatibilidad hacia atrás

Legacy se conserva sin reinterpretar.

Las requisitions nuevas requieren una nueva regla temporal a partir de una fecha de vigencia.

No es compatible conceptualmente con “approval exclusivamente por requisition”, aunque puede reutilizar parte del RBAC.

## 8.19 Impacto sobre NG26980

No es evaluable mientras `NG26980` no tenga una definición verificable dentro del proyecto.

Si NG26980 impone una regla sobre acumulación, períodos, approvals o segregación, esa regla podría ser determinante para T2, pero **no existe evidencia que permita afirmar que lo hace**.

La identificación formal de NG26980 es una dependencia previa.

## 8.20 Nuevas pruebas necesarias

Además de las pruebas base:

- período exacto;
- frontera de período;
- timezone;
- supplier incluido/no incluido según decisión;
- dos requests concurrentes;
- cruce exacto del threshold;
- edit que cambia accumulated amount;
- cancel/reject;
- devolución;
- receipt antes/después del cruce;
- audit snapshot de membership;
- aislamiento site A/B.

---

# 9. T3 — Compra lógica

## 9.1 Semántica de negocio

La unidad financiera es una entidad superior que representa una misma necesidad/compra.

```text
Logical Purchase
├── requisition Site A
├── requisition Site B
└── ...
```

Las requisitions siguen siendo site-owned.

La logical purchase conserva una evaluación conjunta cuando producto declara que las requisitions pertenecen a la misma necesidad económica.

## 9.2 Modelo de datos requerido

Se necesita una identidad persistente superior.

Debe poder almacenar o relacionar:

- organization;
- supplier según la regla elegida;
- owner/requester/origin;
- child requisition IDs;
- site IDs;
- total económico;
- policy snapshot;
- approval state;
- decision audit;
- timestamps.

No se define aún nombre físico ni schema.

## 9.3 Flujo de creación

Debe definirse qué acción crea la logical purchase.

Posibilidades de negocio:

- una sola selección del builder;
- una solicitud previa;
- creación explícita por usuario;
- otra entidad upstream.

Después se crean children por:

`organization + site + supplier`.

El backend debe asociarlas al mismo logical purchase cuando corresponda.

## 9.4 Flujo de aprobación

Debe existir **una sola fuente de verdad** del approval.

No debe crearse un sistema paralelo donde:

- parent diga approved;
- child diga pending;

sin reglas deterministas.

Producto debe decidir si:

- approval vive en logical purchase;
- approval sigue en children pero es gobernado por un aggregate;
- otra representación única.

El diseño técnico se hace después del gate.

## 9.5 Edición / reapertura

Editar una child puede cambiar el total del group.

Debe definirse:

- qué cambios reabren;
- si la reapertura bloquea todas las children;
- qué pasa si una child ya fue recibida;
- qué pasa si una child se cancela;
- si pueden agregarse children posteriormente.

## 9.6 Recepción

Si approval pertenece al logical purchase, cada child necesita una forma inequívoca de saber si puede recibir.

Ejemplo:

```text
LP pending
├── RQ-A
└── RQ-B
```

Ambas deberían seguir la policy elegida.

Debe evitarse que una child pueda recibirse porque localmente aparece `not_required` mientras su parent está pending.

## 9.7 Devoluciones

Las supplier returns continúan ligadas a la child requisition y source receipt.

La devolución no debe destruir la relación con el logical purchase.

Debe decidirse si una devolución altera o no el amount aprobado del parent.

## 9.8 Documentos comerciales

Este es un impacto estructural relevante.

Hoy:

`procurement_document → exactamente una requisition`.

Si una factura/PO externa corresponde a toda la logical purchase A+B, el modelo actual no puede vincularla simultáneamente a ambas children.

Producto debe decidir si:

- cada child mantiene documentos separados;
- documentos pueden pertenecer al logical purchase;
- existe una relación group-document adicional.

No se diseña aquí.

## 9.9 Auditoría

Debe poder reconstruirse:

- logical purchase;
- children;
- sites;
- amount por child;
- total;
- threshold;
- policy;
- decisiones;
- reopen;
- membership changes.

Copiar el mismo event en varias requisitions no sustituye una identidad de auditoría del group.

## 9.10 Usuarios multi-sitio

Debe definirse quién puede aprobar un group cross-site.

Opciones de negocio no seleccionadas:

- approver debe cubrir todas las sites;
- aprobador global/all-sites;
- aprobación por partes;
- otra regla.

El RBAC actual no debe duplicarse; la nueva entidad debe usar el mismo organization/site scope una vez definida la semántica.

## 9.11 Proveedores

Para preservar estrictamente la lógica económica anterior, supplier es un límite importante porque el generador actual ya crea una requisition distinta por supplier.

Una logical purchase multi-supplier sería posible técnicamente, pero representaría una policy económica nueva.

Producto debe decidir si T3 exige un único supplier.

## 9.12 Centros de costo

Cada child puede contener únicamente cost centers de su propio site.

Un logical purchase podría abarcar varios site-owned cost centers si producto lo permite.

Debe decidirse si cost center:

- solo clasifica líneas;
- participa en la identidad de logical purchase;
- divide approvals.

No existe base actual para asumir que cost center gobierna threshold.

## 9.13 Reportes / exportaciones

Se necesitaría distinguir:

- logical purchase count;
- child requisition count;
- total parent;
- totals por site;
- approval state parent;
- execution/receipt state child.

El export actual por requisition no representa necesariamente el total del group.

Producto debe decidir si requiere export de logical purchase.

## 9.14 Datos históricos

No existe group ID histórico.

No se deben agrupar retrospectivamente requisitions independientes usando:

- timestamps;
- mismo supplier;
- mismo requester;
- mismo needed_by;
- notas similares.

Las legacy mixed-site ya conservan en una sola requisition la unidad económica histórica.

No deben dividirse para luego crearles un parent artificial.

## 9.15 Concurrencia

Debe protegerse:

- creación de children;
- membership del group;
- cálculo de total;
- approval state;
- edit/reopen.

Dos children concurrentes no pueden producir totals o approval states divergentes.

## 9.16 Complejidad técnica

Introduce una nueva entidad de dominio con lifecycle propio.

Afecta:

- generation;
- approval;
- edit;
- receipt;
- audit;
- documents;
- exports;
- reporting.

## 9.17 Riesgos de implementación

- parent/child states inconsistentes;
- RBAC cross-site ambiguo;
- documentos single-requisition insuficientes;
- reopen parcial;
- cancelaciones de children;
- membership mutable;
- backfill histórico no confiable.

## 9.18 Compatibilidad hacia atrás

Legacy conserva su requisition original.

T3 aplica solo a nuevas compras lógicas desde una fecha de vigencia.

No requiere inventar parent IDs históricos.

## 9.19 Impacto sobre NG26980

No puede determinarse mientras NG26980 no esté definido.

Si NG26980 exige una entidad agrupadora, segregación por site, límites por proveedor, trazabilidad o control financiero, podría influir en el diseño de T3; sin una fuente verificable, cualquier afirmación concreta sería especulación.

## 9.20 Nuevas pruebas necesarias

- creación parent + children;
- children varios sites;
- same supplier;
- supplier distinto según decisión;
- approval único;
- child receipt bloqueado por parent pending;
- edit child → reopen;
- cancel child;
- add/remove child según policy;
- multi-site approver;
- document behavior;
- group export/report;
- legacy sin parent artificial.

---

# 10. Comparación transversal

| Dimensión | T1 | T2 | T3 |
| --- | --- | --- | --- |
| Unidad de approval | requisition | site + período | logical purchase |
| Tiempo | instantáneo | acumulativo | por necesidad/compra |
| Relación entre requisitions | ninguna | ventana temporal | parent/group explícito |
| Cross-site | no agrega | no agrega entre sites | puede agregar si producto lo permite |
| Supplier | ya implícito en cada req | decisión de key | decisión de group; relevante para preservar lógica actual |
| Approval state | req | por definir entre req/window | parent/aggregate por definir |
| Receipt gate | req | depende de semántica de window | depende del parent/group |
| Audit extra | mínimo | window snapshot/ledger | group audit |
| Concurrencia | local | alta | alta |
| Documentos actuales | encajan | encajan, pero falta contexto de window | pueden ser insuficientes para un documento group-wide |
| Historical backfill | no | no | no |
| Cost center | metadata site-owned | puede o no particionar window | puede o no formar parte de group |
| Cambio económico vs hoy | fragmenta mixed-site | introduce acumulación temporal | puede preservar agrupación si se define como tal |

La tabla no selecciona una alternativa.

---

# 11. Compatibilidad histórica

## 11.1 Legacy mixed-site requisition

Se preserva exactamente como una requisition histórica.

No:

- dividir;
- copiar;
- renumerar;
- reaprobar;
- recrear receipts;
- mover returns;
- mover documentos;
- reconstruir parent group.

### T1

La legacy conserva su approval histórico original.

T1 solo gobierna nuevas requisitions site-owned.

### T2

No se inserta la legacy dentro de ventanas históricas inventadas.

Si T2 entra en vigencia, producto debe definir si requisitions legacy todavía abiertas participan desde la fecha de cutover o quedan bajo su política histórica.

Esa pregunta debe resolverse antes de implementación.

### T3

No se crea una logical purchase artificial para sustituir la legacy.

La requisition original ya es su unidad histórica.

## 11.2 Legacy unresolved requisition

Se preserva con site indeterminado.

No se le asigna site por inferencia débil.

### T1

Mantiene su approval histórico.

### T2

No puede asignarse confiablemente a una site window mientras el site siga unresolved.

### T3

No debe agregarse a un logical purchase retroactivo para “resolver” el site.

## 11.3 Approved/rejected históricos

No recalcular.

La existencia de status legacy `approved/rejected` anterior al formal approval model impide asumir que todos tienen approval events modernos completos.

## 11.4 Receipts / returns / documents

Conservar referencias originales.

La inmutabilidad existente refuerza esta regla.

---

# 12. Centros de costo futuros

Baseline conceptual ya cerrado:

```text
cost_center
=
organization
+
site
+
code
```

y una requisition Site A no puede usar un cost center Site B.

## T1

El cost center puede ser una dimensión de clasificación dentro de la requisition.

No altera threshold por defecto.

Si producto quisiera threshold por cost center, sería una policy adicional distinta de T1 puro.

## T2

Debe decidirse si el accumulated amount se particiona por cost center.

### Opción conceptual A

```text
organization + site + período
```

Todos los cost centers del site se suman.

### Opción conceptual B

```text
organization + site + cost_center + período
```

Cada cost center acumula independientemente.

No seleccionar aquí.

## T3

Una logical purchase podría incluir:

- un cost center;
- varios cost centers del mismo site;
- varios cost centers de varios sites.

Producto debe definir si cost center determina identidad de la compra o solo imputación.

No existe evidencia actual que obligue a una de esas opciones.

## Histórico de cost center

El texto existente en `inventory_transactions.cost_center` se preserva.

No usarlo para reconstruir groups o windows.

---

# 13. Moneda

## Estado actual

No hay currency normalizada en:

- organization procurement policy;
- requisition;
- approval threshold;
- requisition item estimated cost.

Sí existe `currency_code` en procurement documents.

No existe FX.

## T1

Sigue la convención monetaria implícita actual por organization.

El split por site no resuelve ni agrava conceptualmente FX, pero genera más unidades de requisition.

## T2

Acumular montos exige que todos los importes de la ventana sean comparables.

Hoy el modelo asume implícitamente una sola base monetaria de la organization.

Si en la práctica se cargaran costos heterogéneos, el sistema no tiene mecanismo para normalizarlos.

## T3

El total de una logical purchase también presupone importes comparables.

Un procurement document con currency distinta no debe cambiar retrospectivamente el threshold salvo que producto diseñe una policy monetaria futura.

## Gate de moneda

Este documento no diseña FX.

Antes de T2/T3, producto debe confirmar si la convención monetaria implícita actual es aceptable para esta fase o si currency debe formalizarse primero.

---

# 14. NG26980

Se realizó búsqueda exacta en el repositorio y no existe una referencia a:

`NG26980`

No aparece en:

- migraciones;
- documentación I2-A2.2;
- APIs;
- tests revisados;
- configuración.

Una búsqueda exacta externa tampoco identificó de forma fiable un estándar o requisito pertinente al dominio de Procurement/Approval bajo ese identificador.

Por tanto:

**NG26980 no tiene significado verificable dentro del alcance actual.**

No es correcto afirmar que T1, T2 o T3 cumplen, incumplen o impactan NG26980 hasta que producto entregue:

- nombre completo;
- fuente;
- alcance;
- obligación concreta;
- si es requisito legal, contable, contractual o interno.

Este punto queda como dependencia de información, no como decisión técnica.

---

# 15. Pruebas nuevas necesarias después de la decisión

## Comunes

1. organization + site + supplier invariant;
2. no mixed-site new requisition;
3. user single-site;
4. user multi-site;
5. accessAllSites/global;
6. threshold exact boundary;
7. mode none;
8. mode all;
9. edit crosses threshold;
10. approved edit reopens;
11. receipt pending blocked;
12. receipt approved allowed;
13. supplier return traceability;
14. procurement documents;
15. export;
16. legacy mixed unchanged;
17. legacy unresolved unchanged.

## T1 específicas

18. A600+B500 same supplier → two no-approval requisitions;
19. same site two requisitions do not accumulate;
20. supplier differences remain independent;
21. edit RQ-A does not alter RQ-B approval.

## T2 específicas

18. same site accumulation;
19. period boundary;
20. timezone;
21. supplier key behavior;
22. concurrent requests;
23. crossing threshold;
24. edit/cancel/reject;
25. receipt before/after crossing;
26. accumulated audit snapshot;
27. cost center key if selected.

## T3 específicas

18. logical purchase identity;
19. child membership;
20. cross-site group if allowed;
21. supplier restriction;
22. approval source of truth;
23. child receipt gate;
24. edit/reopen;
25. cancel child;
26. audit parent/child;
27. documents;
28. group export/report;
29. cost center behavior.

---

# 16. Decisión que debe tomar producto

```text
T1 / T2 / T3
```

Este documento no selecciona ninguna.

---

# 17. Preguntas que producto debe responder

Las siguientes son únicamente preguntas necesarias para implementar correctamente la alternativa elegida.

## Preguntas comunes

1. ¿La policy seleccionada entra en vigencia solo para nuevas requisitions site-owned o también afecta requisitions legacy todavía abiertas?
2. ¿La convención monetaria implícita actual por organization es aceptable para esta fase?
3. ¿Qué representa exactamente NG26980 y qué requisito vinculante debe satisfacer el sistema?
4. Cuando exista el master de cost centers, ¿cost center será solo imputación/clasificación o también una dimensión de approval threshold?

## Si producto selecciona T1

5. ¿Producto acepta explícitamente que dos requisitions site-specific por debajo del threshold no requieran approval aunque su antigua requisition mixed-site equivalente sí lo hubiera requerido?
6. ¿Se mantiene exactamente la policy organization-level actual para todas las sites?

## Si producto selecciona T2

5. ¿Cuál es el período de acumulación?
6. ¿Qué timezone define el corte?
7. ¿La clave es organization+site o organization+site+supplier?
8. ¿Cost center participa en la clave?
9. ¿Qué estados de requisition cuentan?
10. ¿Qué monto cuenta: estimated actual, approved snapshot, received u otro?
11. ¿Qué ocurre cuando una requisition provoca el cruce del threshold?
12. ¿Qué requisitions quedan pending al cruzar?
13. ¿Qué ocurre con requisitions ya recibidas antes del cruce?
14. ¿Una cancelación/rechazo reduce el acumulado?
15. ¿Una supplier return reduce el acumulado?
16. ¿Cómo se comporta edit/reopen dentro de una ventana ya aprobada?
17. ¿Qué se hace con una ventana ya cerrada si un registro se modifica?

## Si producto selecciona T3

5. ¿Qué constituye exactamente una misma compra lógica?
6. ¿Quién crea la compra lógica?
7. ¿Se crea únicamente a partir de una misma operación de generación?
8. ¿Puede agregarse una child requisition posteriormente?
9. ¿Puede una compra lógica abarcar varios sites?
10. ¿Debe tener un único supplier?
11. ¿Puede abarcar varios cost centers?
12. ¿Dónde vive el approval state autoritativo?
13. ¿Quién puede aprobar una compra cross-site?
14. ¿El aprobador debe tener cobertura de todas las sites?
15. ¿Qué children quedan bloqueadas mientras el group está pending?
16. ¿Qué cambios de una child reabren la compra?
17. ¿Qué ocurre si una child ya recibió material?
18. ¿Qué ocurre al cancelar una child?
19. ¿Los procurement documents siguen siendo child-scoped o deben poder relacionarse con la compra lógica?
20. ¿Se necesita export/reporte de compra lógica además de los exports por requisition?

---

# 18. Consecuencia técnica

La arquitectura posterior depende directamente de la decisión.

## Si se selecciona T1

Arquitectura:

```text
site-owned requisition
+
existing requisition-scoped approval snapshot/events
+
existing receipt gate
```

No se requiere una unidad agregada adicional para approval.

## Si se selecciona T2

Arquitectura:

```text
site-owned requisition
+
site-period accumulation model
+
transactional/locked evaluation
+
auditable window snapshot/ledger
+
defined propagation to requisition approval/receipt
```

El diseño debe asegurar una única fuente de verdad de la decisión.

## Si se selecciona T3

Arquitectura:

```text
logical purchase / procurement intent
        ↓
site-owned child requisitions
        ↓
single authoritative approval lifecycle
        ↓
child receipt/return/document/report integration
```

La relación parent/children debe ser persistente y auditable.

---

# 19. Orden recomendado

```text
1. Decisión de negocio
2. Confirmación del modelo
3. Diseño técnico
4. Migración/históricos
5. Implementación
6. Pruebas
7. Validación
```

**No avanzar al punto 3 hasta que la decisión de negocio esté cerrada.**

---

# 20. Estado del gate

- Site ownership de nuevas requisitions: **cerrado**.
- Preservación de legacy mixed/unresolved: **cerrado**.
- Approval policy T1/T2/T3: **pendiente de producto**.
- Cost center master: **no implementado**; ownership conceptual site-owned ya definido.
- Currency formal/FX: **no diseñado**.
- NG26980: **no definido en el repositorio; requiere identificación formal**.
- Cambios funcionales en esta fase: **ninguno**.

**Resultado: el sistema no debe avanzar a diseño técnico de approval policy hasta que producto seleccione T1, T2 o T3 y responda las preguntas condicionales de la alternativa elegida.**
