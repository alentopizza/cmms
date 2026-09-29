# I2-A2.2-D — Decisión de dominio para Requisiciones multi-sede

Fecha: 2026-09-29  
Tipo: **diagnóstico y decisión de dominio; sin implementación funcional**.

HEAD inspeccionado:

`a844e72d36b7277989843e1585a1856ca5266aa1`

Estado confirmado:

- I2-A1 cerrada;
- I2-A2.1 cerrada y validada;
- migración `047_inventory_transaction_integrity.sql` presente;
- smoke `inventory-i2a2-transaction-integrity-smoke.mjs` presente;
- no existen cambios posteriores al HEAD esperado al iniciar este diagnóstico.

Este documento no implementa ninguna de las alternativas A/B/C.

---

## 1. Resumen ejecutivo

El modelo actual permite que una sola `supplier_requisition` contenga líneas de múltiples sedes de la misma organización.

La causa es estructural y explícita:

```text
supplier_requisitions
├── organization_id
├── supplier_id
└── no site_id

supplier_requisition_items
└── site_id
```

La generación agrupa artículos por:

```text
organization_id + supplier_id
```

No agrupa por sede.

Por tanto, si un usuario autorizado selecciona artículos de A1 y A2 del mismo proveedor, el sistema crea una sola requisición con líneas de ambas sedes.

El flujo posterior mezcla dos niveles:

- **cabecera/documento completo:** número, proveedor, estado, aprobación, notas, fechas, documentos procurement, export;
- **línea/evidencia física:** item, site, recepción, warehouse, receipt transaction y supplier-return item.

Esto vuelve especialmente importante distinguir entre **permiso funcional** y **scope de sede**.

Hallazgo principal:

> La requisición actual se comporta comercial y administrativamente como un documento único, aunque sus líneas puedan pertenecer a varias sedes.

La aprobación es de cabecera completa. El estado es de cabecera completa. Los documentos comerciales pertenecen a una requisición completa. El export genera el documento completo. Las recepciones y devoluciones sí pueden operar por líneas, pero actualizan o se relacionan con la misma cabecera global.

Consecuencias:

- **Opción A — requisición indivisible:** es la alternativa técnicamente más compatible con el modelo actual porque conserva la semántica de documento completo ya usada por aprobación, documentos y export. No requiere cambiar la generación ni el modelo.
- **Opción B — scope por línea:** puede funcionar para consulta física de líneas/recepciones concretas, pero no puede aplicarse de manera segura como un simple filtro. Obliga a redefinir qué significan estado, aprobación, totales, edición, documentos y export cuando parte de la requisición está oculta.
- **Opción C — requisición por sede:** elimina la ambigüedad para nuevas requisiciones y simplifica el aislamiento futuro, pero cambia explícitamente la semántica de generación, numeración, aprobación, umbrales y documentos comerciales. Es la alternativa que más cambia el dominio/proceso de negocio.

No se selecciona automáticamente una opción.

La decisión de negocio que bloquea I2-A2.2 sigue siendo:

> ¿Una requisición de compra debe considerarse un documento comercial indivisible aunque contenga varias sedes, o debe existir una identidad operativa separada por sede?

---

## 2. Modelo actual

### 2.1 Cabecera

`supplier_requisitions` almacena, entre otros:

- `id`;
- `organization_id`;
- `supplier_id`;
- número global de requisición;
- `status`;
- `requested_by`;
- `needed_by`;
- `notes`;
- timestamps de envío/aprobación/cumplimiento;
- snapshot de política de aprobación;
- `approval_required`;
- `approval_state`;
- threshold;
- scope de aprobador;
- decisión y auditoría de aprobación.

No existe `site_id` en la cabecera.

### 2.2 Líneas

`supplier_requisition_items` almacena:

- `requisition_id`;
- `organization_id`;
- `inventory_item_id`;
- `site_id`;
- `location_id`;
- SKU;
- descripción;
- unidad;
- cantidad solicitada;
- cantidad recibida;
- costo unitario estimado;
- notas.

La sede pertenece a la línea.

### 2.3 Aprobación

`supplier_requisition_approval_events` se relaciona con:

`requisition_id`

No con una línea.

El estado de aprobación está en la cabecera.

### 2.4 Recepción

Las recepciones son `inventory_transactions(type='receipt')` con:

- `requisition_id`;
- `requisition_item_id`;
- item;
- warehouse;
- cantidad.

Aquí sí existe trazabilidad de línea y bodega.

### 2.5 Supplier return

`supplier_returns` es una cabecera asociada a:

- organization;
- supplier;
- requisition.

`supplier_return_items` enlaza:

- requisition item;
- receipt transaction;
- inventory item;
- warehouse;
- cantidad.

Por tanto, la devolución tiene cabecera por requisición pero evidencia física por línea/receipt.

### 2.6 Documentos comerciales

`procurement_documents` pertenece a una única:

`requisition_id`

y guarda:

- tipo;
- número;
- moneda;
- subtotal;
- impuestos;
- total;
- archivo binario;
- revisión.

`procurement_document_lines` puede referenciar líneas concretas de la requisición.

El archivo adjunto, el subtotal/total y el estado de revisión pertenecen al documento completo, no a una sede.

### 2.7 Conclusión del modelo

La sede está presente donde existe una unidad operativa física —línea/item—, pero la requisición, aprobación y documento comercial son recursos de cabecera.

No existe hoy una entidad que represente:

```text
requisition + site
```

como recurso independiente.

---

## 3. Flujo actual

| Etapa | Nivel principal | Evidencia del comportamiento actual |
| --- | --- | --- |
| Selección de inventario | item / site | cada item tiene organization/site |
| Generación | organization + supplier | agrupa por `organization_id:supplier_id` |
| Cabecera | requisición | una cabecera por grupo organization+supplier |
| Líneas | requisition item / site | cada línea conserva `site_id` |
| Política de aprobación | requisición | snapshot y threshold en cabecera |
| Decisión de aprobación | requisición completa | cambia `approval_state` y `status` de cabecera |
| Recepción | línea + warehouse | cada cantidad genera receipt ligado a requisition item |
| Estado después de recibir | requisición completa | partial/fulfilled se calcula revisando todas las líneas |
| Supplier return | receipt + line + warehouse, con cabecera por requisición | cada devolución conserva receipt origen |
| Documento procurement | requisición completa | archivo/total/revisión en cabecera documental |
| Líneas documento | requisition item | puede seleccionar líneas concretas |
| Conciliación | documento + requisición | varios esperados se calculan contra el universo completo |
| Export | requisición completa | PDF/XLSX/DOC cargan todas las líneas y devoluciones |
| Listado UI | requisición | agrega item_count y cantidades de todas las líneas |
| Detalle UI | requisición | muestra cabecera, todas las líneas, total, trazabilidad y documentos |

---

## 4. Comportamiento multi-sede actual

### 4.1 Generación

La ruta `app/api/requisitions/generate/route.ts`:

1. carga los artículos;
2. comprueba organización y acceso a cada site;
3. agrupa por `organization_id + supplier_id`;
4. crea una cabecera;
5. inserta todas las líneas del grupo conservando su `site_id`.

Ejemplo:

```text
Org A
Supplier S
Item X → Site A1
Item Y → Site A2
```

Resultado:

```text
REQ-001
├── X → A1
└── Y → A2
```

### 4.2 Listado

El listado actual para un tenant filtra:

`r.organization_id = session.organizationId`

y agrega todas las líneas de cada requisición.

No existe site filter.

La tarjeta muestra:

- número;
- proveedor;
- empresa;
- estado;
- aprobación;
- documentos;
- cantidad de ítems;
- fecha;
- solicitante;
- porcentaje y cantidades acumuladas de recepción.

Aunque el total estimado se consulta, la tarjeta actual no lo presenta como métrica principal.

### 4.3 Detalle

La cabecera se autoriza por organización.

Después se cargan sin filtro de site:

- líneas;
- receipts;
- supplier returns;
- approval events.

El detalle muestra:

- proveedor;
- organización;
- estado;
- solicitante;
- fecha requerida;
- aprobación;
- todas las líneas;
- sede/localización de cada línea;
- total estimado de todas las líneas;
- porcentaje de recepción global;
- notas;
- receipts;
- returns.

### 4.4 Edición

La edición general:

- bloquea la cabecera;
- valida organización;
- carga todas las líneas;
- permite cambiar cantidades/costos o retirar líneas;
- recalcula el total completo;
- puede activar o reabrir aprobación;
- actualiza el estado de cabecera.

No existe edición independiente por sede.

### 4.5 Aprobación

La aprobación es explícitamente **por requisición completa**.

No hay:

- `approval_state` por línea;
- approver por línea;
- threshold por línea;
- decisión por sede.

Para un usuario tenant site-limited, la ruta de aprobación ya exige que todos los `site_id` no nulos de las líneas estén incluidos en `session.siteIds`.

Si REQ-001 tiene A1+A2 y el usuario solo tiene A1:

```text
puede aprobar = NO
```

La UI usa la misma regla para mostrar el control.

Una decisión aprobada/rechazada cambia la cabecera completa.

### 4.6 Recepción

La recepción sí es granular.

La ruta:

- carga todas las líneas con `FOR UPDATE`;
- solo procesa líneas cuyo campo `receive_qty_<line>` venga informado;
- valida el site del item seleccionado;
- valida la bodega;
- inserta un receipt por línea;
- actualiza `quantity_received` por línea.

Después calcula si queda cualquier línea pendiente en **toda la requisición**.

Si primero se recibe A1 de una requisición A1+A2:

```text
línea A1 → puede quedar completa
línea A2 → sigue pendiente
cabecera   → partial
```

Por tanto, recibir por línea funciona técnicamente sin alterar incorrectamente la cantidad de A2.

Lo que sigue siendo global es el estado de la cabecera.

### 4.7 Devoluciones

La devolución parte de receipts concretos.

Cada receipt conoce:

- requisition item;
- item;
- warehouse;
- cantidad;
- site del item.

Para usuarios site-limited, la ruta valida el site de cada receipt seleccionado y la warehouse.

Puede diferenciar A1 de A2 correctamente en la evidencia física.

No obstante, `supplier_returns` crea una cabecera asociada a la requisición completa y puede contener varias líneas cuando un usuario con alcance amplio selecciona varios receipts.

### 4.8 Documentos

La implementación actual trata explícitamente el documento comercial como evidencia de la **requisición completa**.

La ruta de creación contiene la regla:

> reconciliation documents represent the complete requisition.

Para un usuario site-limited, la creación de documentos se rechaza si alguna línea con site explícito queda fuera de su scope.

La descarga y acciones sobre documentos aplican la misma cobertura completa.

Esta es la parte existente del sistema que más claramente adopta ya una semántica equivalente a la Opción A.

### 4.9 Export

El export específico de requisición soporta:

- PDF;
- XLSX;
- Word.

Autoriza por organización y luego carga:

- todas las líneas;
- todas las devoluciones.

La conciliación documental solo se incluye si el usuario tiene permiso y, siendo site-limited, cubre todos los sites de la requisición.

Por tanto hoy puede existir:

```text
base export completo
+
conciliación omitida por falta de site scope completo
```

El export base todavía no resuelve el aislamiento por site.

---

## 5. Opción A — Requisición indivisible

### Regla

Una requisición es visible para un site-limited user solo si **todas** sus líneas con pertenencia operativa demostrable están dentro de sus sites autorizados.

Una interpretación segura para líneas legacy con `site_id=NULL` sería:

```text
site-limited
+
alguna línea sin site explícito
→ no puede demostrarse cobertura completa
```

Esto no implica modificar datos; solo describe la consecuencia de la política.

### Listado

El listado mostraría:

- requisición solo A1 → visible para A1;
- requisición A1+A2 → no visible para usuario solo A1;
- requisición solo A2 → no visible para A1;
- accessAllSites → A1, A2 y mixed-site visibles.

Los agregados continuarían siendo íntegros porque nunca se presenta una requisición parcial.

### Detalle

La URL directa aplicaría la misma condición de cobertura completa.

Si no cubre todos los sites:

- no se muestran cabecera;
- proveedor;
- líneas;
- totales;
- estado;
- documentos;
- receipts;
- returns.

No existe representación parcial.

### Edición

Solo quien pueda consultar la requisición completa puede editarla.

Esto encaja con la edición actual, que:

- modifica líneas de toda la requisición;
- recalcula total global;
- puede reabrir aprobación global.

### Aprobación

Es coherente con el comportamiento actual.

La aprobación actual ya requiere cobertura de todos los sites.

No exige crear aprobación por línea.

### Recepción

Una vez que el usuario tiene cobertura completa, puede seguir recibiendo solo una línea concreta.

El carácter indivisible de autorización no elimina la recepción parcial operativa.

### Devolución / supplier return

Misma lógica:

- autorización sobre documento completo;
- operación física puede seguir siendo sobre receipts/líneas concretos.

### Documentos

Encaja directamente con la regla existente de conciliación:

```text
documento comercial = evidencia de requisición completa
```

No es necesario decidir cómo ocultar partes de un PDF/factura.

### Export

El export puede seguir siendo un documento completo.

La única nueva condición conceptual sería:

```text
si requisición autorizada → export completo
si no → sin export
```

No hace falta recalcular un “subtotal visible”.

### Riesgo de exposición

Bajo si la misma condición se aplica consistentemente a:

- listado;
- detalle;
- edición;
- export;
- documentos.

### Limitación funcional

Un usuario A1 no puede trabajar una línea A1 incluida en una requisición A1+A2, aunque la línea físicamente le pertenezca.

El usuario necesita:

- accessAllSites, o
- cobertura sobre A1+A2, o
- intervención de un usuario con scope completo.

### Compatibilidad

Alta con:

- cabecera única;
- aprobación;
- estados;
- documentos;
- export;
- histórico multi-sede.

No obliga a cambiar generación ni esquema.

---

## 6. Opción B — Scope por línea

### Regla

La requisición continúa existiendo como un único documento, pero un usuario ve solo las líneas dentro de sus sites.

Ejemplo:

```text
REQ-001
├── A1 ← visible
└── A2 ← oculta
```

### 6.1 Cabecera

Surge inmediatamente una decisión:

- ¿puede el usuario saber que existe REQ-001 aunque no pueda ver todas sus líneas?
- ¿puede ver proveedor, número, solicitante, fecha y notas?
- ¿las notas son globales y podrían contener información de A2?

La cabecera no tiene site.

Ocultar solo líneas no hace site-scoped la cabecera.

### 6.2 Estado

`supplier_requisitions.status` es global.

Ejemplo:

- A1 recibida;
- A2 pendiente;
- estado global = `partial`.

Si el usuario A1 solo ve su línea completamente recibida pero ve `partial`, el estado revela que existe trabajo oculto.

Si se calcula un estado “visible” diferente, ya existirían dos semánticas:

- estado real;
- estado proyectado por site.

Actualmente el modelo no las soporta.

### 6.3 Totales

El detalle calcula el total estimado sobre todas las líneas.

Bajo scope por línea sería inseguro mostrarlo sin redefinirlo.

Habría que elegir entre:

- total completo → expone costo de líneas ocultas;
- total visible → deja de representar la requisición real.

Lo mismo aplica a:

- cantidad solicitada;
- cantidad recibida;
- porcentaje de recepción;
- devuelto;
- retenido.

### 6.4 Edición

La edición es especialmente problemática.

Modificar una línea A1 puede:

- cambiar el total completo;
- cruzar un threshold;
- activar aprobación;
- reabrir una aprobación previa;
- cambiar el estado global.

El usuario A1 no puede evaluar correctamente esos efectos si A2 permanece oculta.

Permitir editar solo líneas visibles manteniendo campos globales requeriría definir:

- qué campos de cabecera son editables;
- si `needed_by` es global;
- si `notes` es global;
- si puede cancelar/cerrar toda la requisición;
- si el threshold se calcula con líneas ocultas.

No existe hoy una semántica segura predefinida.

### 6.5 Aprobación

La aprobación actual no es compatible con aprobación parcial.

Una sola decisión cambia:

`supplier_requisitions.approval_state`

No existe estado por línea.

Por tanto un usuario A1:

- no puede aprobar únicamente A1 sin cambiar el modelo;
- no debería aprobar la requisición completa sin conocer A2.

La implementación actual ya resuelve esto prohibiendo la aprobación si no cubre todos los sites.

Adoptar Opción B para lectura no vuelve automáticamente parcial la aprobación.

### 6.6 Recepción

Es el área más compatible con scope por línea.

El backend ya puede recibir:

- una línea concreta;
- contra una bodega concreta;
- validando el site concreto.

A1 puede recibirse sin modificar la cantidad de A2.

El problema aparece en la experiencia posterior:

- el estado global puede ser partial por A2;
- porcentaje global no coincide con lo visible;
- receipts históricos de A2 deben filtrarse.

### 6.7 Devoluciones

También existe granularidad suficiente para una devolución por receipt.

Pero hay dos riesgos:

1. una `supplier_return` histórica creada por un usuario all-sites puede contener líneas de A1 y A2 bajo una misma cabecera DEV;
2. mostrar parcialmente esa DEV obliga a decidir qué cabecera, cantidad, documento y razón se muestran.

La evidencia física es separable; el documento de devolución no siempre lo es semánticamente.

### 6.8 Supplier return

El header `supplier_returns` contiene:

- supplier;
- requisition;
- reason;
- expected resolution;
- document number;
- fecha.

Sus items sí son line-level.

Una vista parcial tendría el mismo problema que la requisición: cabecera única con subconjunto de líneas.

### 6.9 Documentos y adjuntos

Este es el mayor riesgo de exposición de Opción B.

`procurement_documents` tiene:

- archivo completo;
- subtotal;
- tax total;
- total;
- review status;
- requisition ID.

Un PDF o imagen puede contener simultáneamente A1 y A2.

Aunque `procurement_document_lines` pueda filtrarse por requisition item, **no es posible filtrar el contenido binario del archivo de forma fiable**.

Un usuario A1 que pueda descargar la factura completa puede ver información A2.

Por eso el sistema actual exige cobertura completa para reconciliar y descargar documentos.

Para hacer documentos verdaderamente line-scoped sería necesario cambiar la semántica documental, no solo el query.

### 6.10 Export

Cada formato tendría que:

- filtrar líneas;
- filtrar receipts;
- filtrar returns;
- recalcular subtotal visible;
- recalcular cantidades y porcentaje;
- decidir qué estado mostrar;
- decidir si incluye notas globales;
- decidir si incluye aprobación global;
- excluir documentos no separables.

El resultado dejaría de ser una exportación fiel de REQ-001 y pasaría a ser una “vista parcial de REQ-001”.

Eso necesita definición de negocio y señalización explícita para no confundirse con el documento original.

### 6.11 UI

La UI actual está diseñada alrededor de una requisición completa.

Bajo Opción B serían problemáticos:

- encabezado;
- estado;
- aprobación;
- total estimado;
- recepción %;
- notas;
- edición de fecha requerida;
- selector de estado;
- historial de aprobación;
- documentos;
- DEV mixed-site;
- export.

No basta con filtrar `items.rows`.

### 6.12 Riesgo de exposición

Alto si se intenta implementar B como simple filtro.

La línea es site-scoped, pero muchos datos derivados son globales.

---

## 7. Opción C — Requisición por sede

### Regla conceptual

Cambiar la generación futura de:

```text
organization + supplier
```

a:

```text
organization + supplier + site
```

### Generación

Selección:

```text
A1 + A2 + mismo proveedor
```

produciría:

```text
REQ-001 → A1
REQ-002 → A2
```

En nuevas requisiciones, todas las líneas de una cabecera compartirían site.

### Modelo de datos

No es estrictamente obligatorio agregar `supplier_requisitions.site_id` para obtener esta propiedad: puede derivarse de sus líneas si la generación y las mutaciones garantizan un único site.

Sin embargo, si el negocio decide que “una requisición pertenece formalmente a una sede”, la conveniencia de persistir esa identidad sería una decisión de modelo posterior.

Este diagnóstico no propone la migración.

### Aprobación

Se volvería naturalmente site-homogeneous.

Pero cambia una consecuencia financiera importante:

Hoy un threshold se calcula sobre:

```text
total de A1 + A2 del mismo proveedor
```

Con C se calcularía separadamente:

```text
total A1
total A2
```

Dos requisiciones podrían quedar por debajo de un threshold que el documento agregado actual superaría.

Esto es una decisión de negocio, no una optimización técnica.

### Recepción

Se simplifica:

- cada requisición tiene líneas de una sola sede;
- la recepción continúa line-level;
- el estado global solo resume esa sede.

### Devoluciones

También se simplifica la pertenencia de la DEV porque todos los receipts de una requisición nueva corresponderían a la misma sede.

### Documentos comerciales

Aparece un nuevo trade-off.

Si un proveedor entrega una sola factura/remisión comercial que cubre A1+A2:

- hoy puede asociarse a una sola requisición multi-sede;
- con C existirían dos requisiciones.

El modelo actual de `procurement_documents` tiene un solo `requisition_id`.

Por tanto habría que decidir si:

- el proveedor debe emitir/registrarse documentalmente por sede;
- se duplica referencia/archivo en dos requisiciones;
- o procurement documents necesitan en el futuro una relación con múltiples requisiciones.

No debe suponerse ninguna de esas reglas.

### Export

Se simplifica porque el documento exportado ya correspondería a un único site.

### UI

Listado y detalle tendrían scope natural.

También habría más requisiciones visibles:

- mismo proveedor;
- misma selección de compra;
- diferentes números por site.

### Histórico

C solo elimina la ambigüedad para requisiciones futuras.

Las requisiciones históricas A1+A2 continuarían existiendo.

Sería necesario decidir una regla de compatibilidad para ellas, por ejemplo tratarlas como documento indivisible, sin reescribir ni partir el histórico.

### Compatibilidad

Requiere cambiar el comportamiento de generación y potencialmente procesos comerciales externos.

No es una migración técnica menor.

---

## 8. Matriz comparativa

| Área | Opción A — indivisible | Opción B — por línea | Opción C — por sede |
| --- | --- | --- | --- |
| Modelo de datos | conserva modelo | conserva tablas pero exige múltiples proyecciones parciales | nuevas req quedan homogéneas; posible formalización futura de site |
| Generación | sin cambio | sin cambio | cambia agrupación a org+supplier+site |
| Listado | solo req con cobertura completa | muestra req con al menos líneas visibles; agregados deben recalcularse | scope directo por site derivado de líneas |
| Detalle | completo o inaccesible | detalle parcial; muchos campos globales ambiguos | completo y homogéneo para nuevas req |
| Edición | solo con cobertura completa | muy compleja: línea visible puede alterar estado/aprobación global | coherente dentro de site |
| Aprobación | encaja con aprobación global actual | no existe aprobación por línea; debe mantenerse global o rediseñarse | aprobación global equivale a una sede |
| Recepción | recepción parcial por línea sigue funcionando | técnicamente viable por línea; estado global puede revelar ocultos | viable y más fácil de explicar |
| Devoluciones | completas en contexto de req autorizada | receipts filtrables; DEV cabecera puede ser mixed-site | homogéneas para nuevas req |
| Supplier return | sin cambio | cabecera global con líneas parciales puede ser ambigua | homogéneo por req/site |
| Documentos | encaja con documento completo actual | alto riesgo: archivo/total/revisión no se pueden filtrar por línea | simple si documentos comerciales también son site-specific |
| Export | documento completo | debe convertirse en export parcial y recalcular derivados | documento completo de un site |
| UI | cambios de autorización, no de semántica | rediseño de muchos bloques y etiquetas | más requisiciones, semántica clara por site |
| Permisos | permiso actual + cobertura completa de sites | permiso + filtrado line-level + reglas especiales para acciones globales | permiso + site de la req |
| Multi-sede | conserva req multi-sede, acceso exige cobertura | conserva req multi-sede y permite operación parcial | separa nuevas req por site |
| Compatibilidad | alta | media/baja por semántica parcial | histórica requiere regla legacy; proceso futuro cambia |
| Riesgo de exposición | bajo si la regla se usa en todas las superficies | alto si algún agregado/documento permanece global | bajo para nuevas req; legacy sigue necesitando política |
| Complejidad técnica | moderada | alta | alta, con impacto de dominio y procurement |

La matriz no constituye un ranking de negocio ni selecciona automáticamente una opción.

---

## 9. Casos concretos

### Caso 1

```text
Usuario → A1
REQ-001
└── A1
```

**Opción A**

- visible;
- detalle completo;
- edición según permiso;
- aprobación según rol/política;
- recepción A1;
- export completo.

**Opción B**

- visible;
- todas sus líneas coinciden con el scope, por lo que en la práctica se comporta como documento completo;
- no aparece la ambigüedad principal.

**Opción C**

- es el caso natural de una nueva requisición;
- visible para A1.

### Caso 2

```text
Usuario → A1
REQ-001
├── A1
└── A2
```

**Opción A**

- no visible;
- URL directa rechazada;
- no edición;
- no export;
- no documentos;
- recepción/devolución requieren un usuario que cubra A1+A2.

**Opción B**

- cabecera potencialmente visible;
- solo línea A1 visible;
- recepción A1 técnicamente posible;
- no puede aprobar solo A1 con el modelo actual;
- editar A1 puede alterar threshold/aprobación global;
- estado/total global requieren rediseño o pueden filtrar información;
- documentos completos no son seguros para A1.

**Opción C**

- una nueva selección equivalente produciría dos requisiciones;
- una histórica REQ-001 A1+A2 seguiría necesitando política legacy.

### Caso 3

```text
Usuario → A1
REQ-001
└── A2
```

**Opción A**

- invisible.

**Opción B**

- no existen líneas visibles;
- la requisición debe ser invisible para evitar exponer una cabecera sin contenido autorizado.

**Opción C**

- una requisición A2 nueva es invisible para A1.

### Caso 4

```text
Usuario → accessAllSites
REQ-001
├── A1
└── A2
```

**Opción A**

- visible completa.

**Opción B**

- visible completa; no hay necesidad de filtrado parcial.

**Opción C**

- las nuevas compras equivalentes serían dos requisiciones, ambas visibles;
- una requisición histórica mixed-site continuaría visible.

### Caso 5

```text
Organization A
REQ-001 → A1

Organization B
REQ-002 → B1
```

En las tres opciones el organization scope continúa siendo la primera frontera.

Un usuario tenant de Organization A:

- no debe ver REQ-002;
- no debe usar warehouses de B;
- el site scope nunca sustituye el organization scope.

---

## 10. Impacto sobre recepción, aprobación y devolución

### Aprobación

Hechos actuales:

- estado en cabecera;
- política snapshoteada en cabecera;
- decisión por requisición;
- eventos por requisición;
- cambio de cantidad/costo/fecha puede reabrir toda la aprobación;
- site-limited approver ya necesita cobertura sobre todas las líneas.

**A:** conserva exactamente esa semántica.

**B:** lectura parcial no puede convertirse en aprobación parcial sin nuevo modelo. Mantener aprobación global exigiría bloquearla para usuarios parciales.

**C:** conserva aprobación por requisición, pero al separar por site cambia la base sobre la que se calcula threshold.

### Recepción

Hechos actuales:

- cantidad recibida por línea;
- receipt ligado a line/item/warehouse;
- site validado sobre línea seleccionada;
- header pasa a `partial` mientras exista cualquier línea pendiente.

**A:** operación granular sigue disponible para usuarios con cobertura completa.

**B:** es técnicamente posible recibir A1 solamente; el problema es la representación del estado/avance global.

**C:** la cabecera resume solo una sede para nuevas requisiciones.

### Devolución / supplier return

Hechos actuales:

- devolución parte de receipt;
- receipt identifica requisition item;
- line identifica site;
- warehouse se valida;
- return header está ligado a requisition;
- return items son granulares.

**A:** toda la DEV se presenta en contexto de requisición autorizada completa.

**B:** una DEV mixed-site histórica puede necesitar visualización parcial de sus items, dejando una cabecera global.

**C:** nuevas DEV tenderían a ser homogéneas por site porque la requisición origen lo sería.

---

## 11. Impacto sobre documentos y export

### 11.1 Documentos

El archivo de procurement es una evidencia indivisible.

Puede contener:

- precios;
- cantidades;
- proveedor;
- direcciones;
- referencias;
- productos;
- información de múltiples sites.

No existe un mecanismo para entregar “solo la sección A1” de un PDF arbitrario.

Por ello:

**A:** coincide con el diseño actual de documentos completos.

**B:** requeriría bloquear documentos para usuarios parciales o redefinir su ownership/documentación. Filtrar solo las filas SQL no protege el contenido del archivo.

**C:** facilita documentos por site si el proceso comercial también emite documentos por site. Si la factura real agrupa sites, reaparece una necesidad de documento multi-requisición que el modelo actual no soporta.

### 11.2 Conciliación

Los cálculos de procurement usan información global en varios casos.

Ejemplo purchase order:

- expected requested quantity = suma de toda la requisición;
- expected requested value = suma de toda la requisición.

Las líneas documentales sí pueden compararse individualmente, pero el summary sigue teniendo semántica de documento/requisición.

### 11.3 Export

Actualmente PDF/XLSX/Word incluyen:

- cabecera;
- estado;
- aprobación;
- líneas;
- cantidades solicitadas/recibidas/devueltas;
- total;
- devoluciones;
- opcionalmente conciliación.

**A:** export completo solo si req completa autorizada.

**B:** necesitaría un nuevo concepto explícito de “export parcial”, con totales y evidencias recalculados y sin archivos/documents globales.

**C:** export completo coincide naturalmente con un site para nuevas requisiciones.

---

## 12. Impacto sobre permisos

Los permisos funcionales actuales incluyen:

- `requisitions.read`;
- `requisitions.write`;
- `requisitions.approve`;
- `requisitions.reconcile`.

El site scope vive en la sesión:

- `accessAllSites`;
- `siteIds`;
- `canAccessSite()`.

Son conceptos distintos.

Ejemplo:

```text
usuario tiene requisitions.read
pero
siteIds = [A1]
```

Debe significar:

```text
puede usar la función Requisiciones
dentro de su universo de sede
```

No se necesita un permiso nuevo para ninguna opción.

Lo que cambia entre A/B/C es qué se considera “recurso de requisición perteneciente al universo A1”.

### Opción A

```text
authorized requisition
=
organization authorized
AND
todas las líneas cubiertas
```

### Opción B

```text
authorized line
=
organization authorized
AND
line.site authorized
```

pero las acciones de cabecera necesitan reglas adicionales.

### Opción C

Para nuevas requisiciones:

```text
authorized requisition
=
organization authorized
AND
site único de sus líneas autorizado
```

No se crea segundo RBAC en ningún caso.

---

## 13. Compatibilidad y legacy

### Requisiciones históricas multi-sede

**A**

No exige transformarlas.

Se siguen considerando una unidad y solo se muestran con cobertura completa.

**B**

Permite mostrar partes, pero introduce todas las ambigüedades de estado, documentos, aprobación y export también para históricos.

**C**

No puede “desmezclar” de forma no destructiva el histórico.

Si C se elige para nuevas requisiciones, debe existir una regla separada de compatibilidad para requisiciones históricas mixed-site.

### Líneas con `site_id=NULL`

No existe un site que permita probar autorización.

Para un site-limited user:

- A: una línea NULL impide demostrar cobertura completa;
- B: la línea no puede considerarse autorizada, pero cualquier agregado global que la incluya se vuelve problemático;
- C: nuevas requisiciones deberían evitar ambigüedad, pero el histórico NULL sigue necesitando política legacy.

No se propone convertir automáticamente NULL a una sede.

### Warehouses `site_id=NULL`

Hecho confirmado para la futura implementación:

```text
site-limited
→ legacy warehouse NULL no debe aparecer
```

Interacción por opción:

- A: al operar una req autorizada, selector limitado a warehouses explícitamente autorizadas;
- B: cada operación de línea A1 solo puede seleccionar warehouse A1;
- C: selector puede restringirse naturalmente al site único de la requisición, además del scope del usuario.

### Documentos existentes

No deben dividirse ni modificarse.

A conserva su carácter completo.

B necesitaría decidir si un documento completo queda completamente oculto a usuarios parciales.

C necesita una regla legacy para documentos ligados a requisiciones históricas mixed-site.

### Export histórico

No debe reescribirse el histórico.

La política de autorización decide si un documento existente puede generarse/descargarse; no modifica sus datos fuente.

---

## 14. Decisiones de negocio necesarias

Las siguientes decisiones no pueden resolverse correctamente solo desde código.

### 14.1 Naturaleza de la requisición

¿Una requisición es:

- una solicitud comercial única por proveedor, potencialmente multi-sede;
- o una solicitud operativa perteneciente a una sede?

El modelo actual implementa principalmente la primera.

### 14.2 Visibilidad de mixed-site

Si un usuario A1 participa en una requisición A1+A2:

- ¿debe quedar completamente fuera?
- ¿debe poder operar su línea A1?

Responder esto define A frente a B/C.

### 14.3 Aprobación

Si se permite scope parcial:

- ¿la aprobación sigue siendo por documento completo?
- ¿un usuario parcial puede editar algo que reabra aprobación?
- ¿deberían existir aprobaciones por site/línea?

El modelo actual solo soporta aprobación completa.

### 14.4 Threshold financiero

Si se adopta C:

¿el threshold se evalúa:

- por cada requisición/site;
- o por la compra agregada del proveedor?

Cambiar a org+supplier+site puede cambiar qué compras requieren aprobación.

### 14.5 Documentos del proveedor

¿el proveedor normalmente emite:

- una factura/remisión por sede;
- o una factura que puede cubrir varias sedes?

C funciona de forma mucho más natural si la evidencia comercial también es site-specific.

### 14.6 Datos globales de cabecera

Para B debe definirse si un usuario parcial puede ver:

- proveedor;
- solicitante;
- needed_by;
- notes;
- estado global;
- aprobación global;
- total global.

No todos estos campos tienen pertenencia a una sola sede.

### 14.7 Históricos

Si se elige C para el futuro:

¿las requisiciones mixed-site históricas se tratan como indivisibles?

No debe intentarse dividirlas automáticamente sin una decisión explícita.

---

## 15. Recomendación técnica condicionada

### Opción técnicamente más compatible con el modelo actual

**Opción A — Requisición indivisible.**

Esta afirmación es de compatibilidad técnica, no una selección de negocio.

Razones:

1. la cabecera no tiene site;
2. aprobación es global;
3. status es global;
4. threshold es global;
5. edición recalcula efectos globales;
6. procurement documents son documentos completos;
7. los archivos adjuntos no pueden filtrarse por línea;
8. export representa una requisición completa;
9. conciliación ya aplica hoy la regla de cobertura de todos los sites;
10. no exige cambiar la generación ni reescribir históricos.

Su trade-off es funcional: un usuario A1 pierde acceso a su línea cuando la requisición también contiene A2.

### Opción que requeriría mayor cambio de dominio

**Opción C — Requisición por sede.**

Cambia el significado de generación:

`organization + supplier`

pasa a:

`organization + supplier + site`.

Además puede modificar:

- cantidad de requisiciones;
- numeración;
- threshold de aprobación;
- flujo comercial con proveedor;
- relación entre una factura y varias sedes;
- tratamiento de históricos.

Es conceptualmente limpia para aislamiento futuro, pero es una decisión de proceso de compra.

### Opción con mayor complejidad de representación/autorización

**Opción B — Scope por línea.**

No necesariamente cambia la creación, pero obliga a representar parcialmente un documento cuyo:

- estado;
- aprobación;
- notas;
- totales;
- documentos;
- archivos;
- export

son actualmente globales.

El principal riesgo es creer que basta con filtrar líneas. No basta.

### Decisiones puramente técnicas una vez elegida la política

Sin importar A/B/C:

- organization scope debe permanecer primero;
- site-limited no debe recibir warehouse `site_id=NULL`;
- warehouses de otras sedes/orgs deben excluirse;
- accessAllSites debe conservar comportamiento legítimo;
- no se necesita un RBAC nuevo;
- no se debe modificar masivamente el histórico.

---

## 16. Propuesta de siguiente paso

No implementar I2-A2.2 hasta definir la política de negocio.

La decisión mínima que permite continuar es escoger una de estas declaraciones:

### Política A

> La requisición es un documento indivisible. Un usuario limitado solo puede consultarla y operarla si todas sus líneas pertenecen a sedes dentro de su scope.

Con esa decisión, I2-A2.2 puede implementarse reutilizando la regla de cobertura completa que ya existe en aprobación/documentos.

### Política B

> El usuario puede trabajar únicamente sus líneas aunque la requisición sea multi-sede.

Antes de implementar deben definirse adicionalmente:

- qué campos de cabecera ve;
- qué totales se muestran;
- qué estado se muestra;
- qué puede editar;
- si puede recibir/devolver;
- cómo se presenta aprobación;
- cómo se tratan documentos binarios;
- qué significa un export parcial.

Sin esas definiciones B sigue incompleta como política.

### Política C

> Cada nueva requisición debe pertenecer a una sola sede.

Antes de implementar deben definirse adicionalmente:

- comportamiento del threshold;
- relación con documentos comerciales multi-sede;
- tratamiento de selección con varias sedes;
- compatibilidad de requisiciones históricas mixed-site.

---

## Cierre

El sistema actual no tiene un error de modelado accidental: deliberadamente permite una cabecera de requisición por organización+proveedor con líneas site-aware.

La ambigüedad aparece cuando se intenta añadir aislamiento de lectura por sede sobre un documento cuya semántica administrativa/comercial es global.

No existe una implementación segura de I2-A2.2 sin elegir primero la política de dominio.

Durante este diagnóstico:

- no se modificó Requisiciones;
- no se modificó Procurement;
- no se modificó UI;
- no se modificó SQL;
- no se agregó migración;
- no se creó smoke;
- no se modificaron I2-A1 ni I2-A2.1;
- no se inició I2-B, I2-C ni I3.

El único cambio permitido y realizado es este documento.
