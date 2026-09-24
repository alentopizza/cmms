import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import RequisitionExportMenu from "@/components/RequisitionExportMenu";
import UiIcon from "@/components/UiIcon";
import { countryDefinition } from "@/lib/international-catalog";

type Req={
  id:string;organization_id:string;number:string;status:string;created_at:string;needed_by:string|null;notes:string|null;
  supplier_id:string;supplier_name:string;supplier_email:string|null;supplier_phone:string|null;organization_name:string;
  organization_country:string|null;requested_by:string|null;requested_by_name:string|null;
  approval_required:boolean;approval_state:"not_required"|"pending"|"approved"|"rejected";
  approval_policy_mode:"none"|"all"|"threshold";approval_threshold:string;
  approval_approver_scope:"admin_only"|"admin_manager";approval_self_allowed:boolean;
  approval_requested_at:string|null;approval_decided_at:string|null;approval_decision_notes:string|null;approval_decided_by_name:string|null;
};
type Item={
  id:string;inventory_item_id:string|null;warehouse_id:string|null;inventory_active:boolean|null;site_id:string|null;
  sku:string;description:string;unit:string;quantity_requested:string;quantity_received:string;unit_cost_estimated:string;
  site_name:string|null;location_name:string|null;
};
type Warehouse={id:string;name:string;site_name:string|null};
type ReceiptTx={
  id:string;sku:string;description:string;unit:string;quantity:string;unit_cost:string|null;warehouse:string|null;document_number:string|null;
  movement_at:string;lot_number:string|null;expires_at:string|null;cost_center:string|null;created_by_name:string|null;
};
type ApprovalEvent={
  id:string;action:"requested"|"approved"|"rejected"|"reopened"|"amended";from_state:string|null;to_state:string;notes:string|null;
  actor_label:string;created_at:string;
};

function statusLabel(status:string){return ({draft:"Borrador",sent:"Enviada",approved:"Aprobada",rejected:"Rechazada",partial:"Parcialmente atendida",fulfilled:"Atendida",closed:"Cerrada",cancelled:"Cancelada"} as Record<string,string>)[status]||status;}
function approvalLabel(state:Req["approval_state"]){return ({not_required:"No requerida",pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada"} as Record<string,string>)[state]||state;}
function approvalEventLabel(action:ApprovalEvent["action"]){return ({requested:"Enviada a aprobación",approved:"Aprobada",rejected:"Rechazada",reopened:"Aprobación reabierta",amended:"Requisición modificada"} as Record<string,string>)[action]||action;}

export default async function RequisitionDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{updated?:string;received?:string;approval?:string;error?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"requisitions.read"))redirect("/dashboard");
  const {id}=await params;
  const feedback=await searchParams;
  const result=await query<Req>(
    `SELECT r.id,r.organization_id,r.number::text,r.status,r.created_at::text,r.needed_by::text,r.notes,
            r.supplier_id,s.name supplier_name,s.email supplier_email,s.phone supplier_phone,
            o.name organization_name,COALESCE(o.default_country,o.legal_country) organization_country,
            r.requested_by,u.full_name requested_by_name,
            r.approval_required,r.approval_state,r.approval_policy_mode,r.approval_threshold::text,
            r.approval_approver_scope,r.approval_self_allowed,r.approval_requested_at::text,
            r.approval_decided_at::text,r.approval_decision_notes,approver.full_name approval_decided_by_name
     FROM supplier_requisitions r
     JOIN suppliers s ON s.id=r.supplier_id
     JOIN organizations o ON o.id=r.organization_id
     LEFT JOIN users u ON u.id=r.requested_by
     LEFT JOIN users approver ON approver.id=r.approval_decided_by
     WHERE r.id=$1`,[id],
  );
  if(!result.rowCount)notFound();
  const req=result.rows[0];
  if(session.platformRole==="user"&&session.organizationId!==req.organization_id)notFound();

  const items=await query<Item>(
    `SELECT ri.id,ri.inventory_item_id,i.warehouse_id,i.active inventory_active,ri.site_id,ri.sku,ri.description,ri.unit,
            ri.quantity_requested::text,ri.quantity_received::text,ri.unit_cost_estimated::text,
            s.name site_name,l.name location_name
     FROM supplier_requisition_items ri
     LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id
     LEFT JOIN sites s ON s.id=ri.site_id
     LEFT JOIN locations l ON l.id=ri.location_id
     WHERE ri.requisition_id=$1 ORDER BY ri.created_at,ri.description`,[id],
  );

  const currency=countryDefinition(req.organization_country)?.currency||"USD";
  const total=items.rows.reduce((sum,item)=>sum+Number(item.quantity_requested)*Number(item.unit_cost_estimated),0);
  const format=(value:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency,maximumFractionDigits:2}).format(value);
  const requestedTotal=items.rows.reduce((sum,item)=>sum+Number(item.quantity_requested||0),0);
  const receivedTotal=items.rows.reduce((sum,item)=>sum+Number(item.quantity_received||0),0);
  const receivedPct=requestedTotal>0?Math.min(100,Math.round(receivedTotal/requestedTotal*100)):0;

  const canWrite=can(session,"requisitions.write");
  const canEditItems=canWrite&&!["fulfilled","closed","cancelled"].includes(req.status);
  const receiveLifecycleOpen=canWrite&&can(session,"inventory.write")&&!["rejected","fulfilled","closed","cancelled"].includes(req.status);
  const approvalBlocksReceipt=req.approval_required&&req.approval_state!=="approved";
  const canReceive=receiveLifecycleOpen&&!approvalBlocksReceipt;

  const policyRoleAllowed=session.platformRole!=="user"
    ||(req.approval_approver_scope==="admin_only"
      ?session.role==="admin"
      :session.role==="admin"||session.role==="manager");
  const selfApprovalAllowed=req.approval_self_allowed||!req.requested_by||session.userId!==req.requested_by;
  const approvalSiteAllowed=session.platformRole!=="user"||session.accessAllSites
    ||items.rows.every(item=>!item.site_id||session.siteIds.includes(item.site_id));
  const canApprove=req.approval_required
    &&req.approval_state==="pending"
    &&can(session,"requisitions.approve")
    &&policyRoleAllowed
    &&selfApprovalAllowed
    &&approvalSiteAllowed
    &&!["fulfilled","closed","cancelled"].includes(req.status);

  const allStatuses=[
    ["draft","Borrador"],["sent","Enviada"],["approved","Aprobada"],["rejected","Rechazada"],
    ["partial","Parcialmente atendida"],["fulfilled","Atendida"],["closed","Cerrada"],["cancelled","Cancelada"],
  ] as const;
  const lifecycleStatuses=allStatuses.filter(([value])=>!["approved","rejected"].includes(value)||value===req.status);
  const statusChoices=req.status==="fulfilled"
    ?lifecycleStatuses.filter(([value])=>value==="fulfilled"||value==="closed")
    :["closed","cancelled"].includes(req.status)
      ?lifecycleStatuses.filter(([value])=>value===req.status)
      :req.approval_required&&["pending","rejected"].includes(req.approval_state)
        ?lifecycleStatuses.filter(([value])=>value===req.status||value==="cancelled")
        :req.approval_required&&req.approval_state==="approved"
          ?lifecycleStatuses.filter(([value])=>value===req.status||value==="closed"||value==="cancelled")
          :lifecycleStatuses;

  const [warehouses,receipts,approvalEvents]=await Promise.all([
    canReceive
      ?session.platformRole==="user"&&!session.accessAllSites
        ?query<Warehouse>(
          `SELECT w.id,w.name,s.name site_name
           FROM inventory_warehouses w LEFT JOIN sites s ON s.id=w.site_id
           WHERE w.organization_id=$1 AND w.active=true AND (w.site_id IS NULL OR w.site_id=ANY($2::uuid[]))
           ORDER BY s.name NULLS LAST,w.name`,
          [req.organization_id,session.siteIds],
        )
        :query<Warehouse>(
          `SELECT w.id,w.name,s.name site_name
           FROM inventory_warehouses w LEFT JOIN sites s ON s.id=w.site_id
           WHERE w.organization_id=$1 AND w.active=true ORDER BY s.name NULLS LAST,w.name`,
          [req.organization_id],
        )
      :Promise.resolve({rows:[]} as {rows:Warehouse[]}),
    query<ReceiptTx>(
      `SELECT t.id,ri.sku,ri.description,ri.unit,t.quantity::text,t.unit_cost::text,w.name warehouse,t.document_number,
              t.movement_at::text,t.lot_number,t.expires_at::text,t.cost_center,u.full_name created_by_name
       FROM inventory_transactions t
       JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id
       LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id
       LEFT JOIN users u ON u.id=t.created_by
       WHERE t.requisition_id=$1 AND t.type='receipt'
       ORDER BY t.movement_at DESC,t.created_at DESC`,
      [id],
    ),
    query<ApprovalEvent>(
      `SELECT id,action,from_state,to_state,notes,actor_label,created_at::text
       FROM supplier_requisition_approval_events
       WHERE requisition_id=$1
       ORDER BY created_at DESC`,
      [id],
    ),
  ]);

  return <>
    <nav className="entity-breadcrumbs" aria-label="Migas de pan">
      <Link href="/dashboard"><UiIcon name="home" size={13}/><span>Inicio</span></Link><span className="entity-breadcrumb-separator"><UiIcon name="chevron-right" size={13}/></span>
      <Link href="/dashboard/requisitions"><span>Requisiciones</span></Link><span className="entity-breadcrumb-separator"><UiIcon name="chevron-right" size={13}/></span>
      <span className="current">REQ-{req.number.padStart(6,"0")}</span>
    </nav>

    <header className="entity-profile-page-head requisition-page-head">
      <div className="entity-profile-page-identity"><span className="entity-profile-page-icon"><UiIcon name="file" size={27}/></span><div><span className="eyebrow">Requisición</span><h1>REQ-{req.number.padStart(6,"0")}</h1><p>{req.supplier_name} · {req.organization_name}</p></div></div>
      <div className="entity-profile-toolbar-actions">
        <Link className="button secondary entity-action-button entity-action-wide" href={"/dashboard/suppliers?supplier="+req.supplier_id}><UiIcon name="company"/><span>Proveedor</span></Link>
        <RequisitionExportMenu id={req.id}/>
      </div>
    </header>

    {feedback.updated&&<div className="notice success section">Requisición actualizada correctamente.</div>}
    {feedback.received&&<div className="notice success section">{feedback.received} ítem{feedback.received==="1"?"":"s"} recibido{feedback.received==="1"?"":"s"}; Kardex y estado de la requisición fueron conciliados.</div>}
    {feedback.approval==="approved"&&<div className="notice success section">Aprobación registrada. La requisición ya puede continuar con su recepción.</div>}
    {feedback.approval==="rejected"&&<div className="notice success section">Rechazo registrado con trazabilidad de auditoría.</div>}
    {feedback.error==="items"&&<div className="notice error section">Revisa cantidades y costos. La cantidad solicitada no puede ser menor que lo ya recibido.</div>}
    {feedback.error==="received"&&<div className="notice error section">No puedes retirar un ítem que ya tiene unidades recibidas.</div>}
    {feedback.error==="empty"&&<div className="notice error section">La requisición debe conservar al menos un ítem.</div>}
    {feedback.error==="fulfillment"&&<div className="notice error section">No puedes marcar la requisición como Atendida mientras existan cantidades pendientes por recibir.</div>}
    {feedback.error==="status_locked"&&<div className="notice error section">El estado actual está cerrado para retrocesos.</div>}
    {feedback.error==="approval_route"&&<div className="notice error section">Aprobar o rechazar requiere usar el bloque de Aprobación y auditoría; no puede hacerse desde el selector de estado.</div>}
    {feedback.error==="approval_locked"&&<div className="notice error section">La aprobación no está disponible en el estado actual o la requisición sigue pendiente de decisión.</div>}
    {feedback.error==="approval_self"&&<div className="notice error section">La política de la empresa no permite que el solicitante apruebe su propia requisición.</div>}
    {feedback.error==="approval_notes"&&<div className="notice error section">Para rechazar una requisición debes registrar el motivo.</div>}
    {feedback.error==="receive_locked"&&<div className="notice error section">El estado actual no permite registrar nuevas recepciones.</div>}
    {feedback.error==="receive_approval"&&<div className="notice error section">La recepción está bloqueada hasta que la requisición tenga una aprobación vigente.</div>}
    {feedback.error==="receive_empty"&&<div className="notice error section">Ingresa una cantidad a recibir en al menos un ítem.</div>}
    {feedback.error==="receive_over"&&<div className="notice error section">La cantidad recibida no puede superar el saldo pendiente de la requisición.</div>}
    {feedback.error==="receive_item"&&<div className="notice error section">Uno de los ítems ya no está enlazado a un artículo activo de Inventario.</div>}
    {feedback.error==="receive_warehouse"&&<div className="notice error section">Selecciona una bodega activa y válida para cada ítem recibido.</div>}
    {feedback.error&&feedback.error.startsWith("receive_")&&!["receive_locked","receive_approval","receive_empty","receive_over","receive_item","receive_warehouse"].includes(feedback.error)&&<div className="notice error section">No fue posible registrar la recepción. Revisa cantidades, costos, fechas y bodegas.</div>}
    {feedback.error&& !["items","received","empty","fulfillment","status_locked","approval_route","approval_locked","approval_self","approval_notes"].includes(feedback.error)&&!feedback.error.startsWith("receive")&&<div className="notice error section">No fue posible completar la acción. Revisa la requisición y vuelve a intentarlo.</div>}

    <section className="requisition-sheet card section">
      <div className="requisition-sheet-header">
        <div><span>Proveedor</span><strong>{req.supplier_name}</strong><small>{req.supplier_email||"Sin correo"}{req.supplier_phone?" · "+req.supplier_phone:""}</small></div>
        <div><span>Estado</span><strong className={"requisition-status "+req.status}>{statusLabel(req.status)}</strong></div>
        <div><span>Solicitante</span><strong>{req.requested_by_name||"Sistema"}</strong></div>
        <div><span>Fecha requerida</span><strong>{req.needed_by?new Date(req.needed_by+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha"}</strong></div>
      </div>

      <div className={"requisition-approval-summary "+req.approval_state}>
        <div>
          <span>Control de aprobación</span>
          <strong>{approvalLabel(req.approval_state)}</strong>
          <small>{req.approval_required
            ?req.approval_policy_mode==="threshold"
              ?"Requerida desde "+format(Number(req.approval_threshold||0))
              :"Aprobación obligatoria para todas las requisiciones."
            :"Esta requisición no requería aprobación según la política vigente al crearla."}</small>
        </div>
        {req.approval_decided_at&&<div>
          <span>Última decisión</span>
          <strong>{req.approval_decided_by_name||"Operador de plataforma"}</strong>
          <small>{new Date(req.approval_decided_at).toLocaleString("es-CO")}</small>
        </div>}
      </div>

      <div className="requisition-sheet-items">
        <div className="requisition-sheet-row head"><span>SKU</span><span>Insumo</span><span>Cantidad</span><span>Unidad</span><span>Estimado</span><span>Subtotal</span></div>
        {items.rows.map(item=>{
          const subtotal=Number(item.quantity_requested)*Number(item.unit_cost_estimated);
          return <div className="requisition-sheet-row" key={item.id}>
            <span>{item.sku}</span><strong>{item.description}<small>{item.site_name||"Sin sede"}{item.location_name?" · "+item.location_name:""}</small></strong>
            <span>{item.quantity_requested}</span><span>{item.unit}</span><span>{format(Number(item.unit_cost_estimated))}</span><b>{format(subtotal)}</b>
          </div>;
        })}
      </div>
      <div className="requisition-sheet-progress">
        <div><span>Recepción física</span><strong>{receivedPct}%</strong><small>{receivedTotal.toLocaleString("es-CO")} de {requestedTotal.toLocaleString("es-CO")} unidades acumuladas</small></div>
        <div className="requisition-progress-track"><i style={{width:receivedPct+"%"}}/></div>
      </div>
      <div className="requisition-sheet-total"><span>Total estimado</span><strong>{format(total)}</strong></div>
      {req.notes&&<div className="requisition-sheet-notes"><span>Observaciones</span><p>{req.notes}</p></div>}
    </section>

    {req.approval_required&&<section className="card section requisition-approval-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Aprobación y auditoría</span><h2>{approvalLabel(req.approval_state)}</h2><p className="muted">La decisión queda registrada con usuario, fecha, alcance de la política y observaciones. Una modificación posterior de cantidad, costo o fecha requerida reabre la aprobación.</p></div>
        <span className={"requisition-approval-badge "+req.approval_state}>{approvalLabel(req.approval_state)}</span>
      </div>

      {req.approval_state==="pending"&&canApprove&&<form className="form-grid requisition-approval-form" method="post" action={"/api/requisitions/"+req.id+"/approval"}>
        <div className="field form-span-2"><label>Observaciones de la decisión</label><textarea name="notes" rows={3} placeholder="Opcional al aprobar. Obligatorio si vas a rechazar."/></div>
        <div className="form-span-2 form-actions">
          <button className="button secondary danger-text" type="submit" name="decision" value="reject">Rechazar requisición</button>
          <button className="button" type="submit" name="decision" value="approve">Aprobar requisición</button>
        </div>
      </form>}

      {req.approval_state==="pending"&&!canApprove&&<div className="requisition-approval-message">
        <strong>Esperando decisión autorizada</strong>
        <span>{!selfApprovalAllowed
          ?"Eres el solicitante y la política impide la autoaprobación."
          :!policyRoleAllowed
            ?"La política exige un rol de aprobación superior."
            :!approvalSiteAllowed
              ?"Tu alcance de sedes no cubre todos los ítems de esta requisición."
              :"No tienes permiso para aprobar requisiciones."}</span>
      </div>}

      {req.approval_state!=="pending"&&req.approval_decision_notes&&<div className="requisition-approval-message">
        <strong>Observación de la última decisión</strong><span>{req.approval_decision_notes}</span>
      </div>}

      <div className="requisition-approval-history">
        <div className="requisition-approval-history-head"><strong>Historial de aprobación</strong><span>{approvalEvents.rowCount||0} eventos</span></div>
        {approvalEvents.rowCount?<div className="requisition-approval-timeline">{approvalEvents.rows.map(event=><article key={event.id}>
          <i className={event.action}/>
          <div><strong>{approvalEventLabel(event.action)}</strong><span>{event.actor_label}</span>{event.notes&&<p>{event.notes}</p>}</div>
          <time>{new Date(event.created_at).toLocaleString("es-CO")}</time>
        </article>)}</div>:<div className="empty-state"><strong>Sin eventos de aprobación.</strong><span>El historial aparecerá cuando la requisición entre al flujo de aprobación.</span></div>}
      </div>
    </section>}

    {receiveLifecycleOpen&&approvalBlocksReceipt&&<section className="card section requisition-receive-approval-lock">
      <div><strong>Recepción bloqueada por aprobación</strong><span>{req.approval_state==="rejected"?"La requisición fue rechazada. Modifícala para reabrir el flujo de aprobación antes de recibir.":"La requisición debe ser aprobada antes de generar entradas en Kardex."}</span></div>
    </section>}

    {canReceive&&<section className="card section requisition-receive-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Recepción física</span><h2>Recibir contra Inventario / Kardex</h2><p className="muted">Registra únicamente lo entregado. Cada cantidad genera una Entrada de Kardex y actualiza el acumulado recibido de esta requisición.</p></div>
        <span className="requisition-receive-badge">{receivedPct}% recibido</span>
      </div>
      <form className="form-grid" method="post" action={"/api/requisitions/"+req.id+"/receive"}>
        <div className="field"><label>Documento de recepción</label><input name="document_number" placeholder="Factura, remisión, OC..."/></div>
        <div className="field"><label>Fecha / hora</label><input name="movement_at" type="datetime-local"/></div>
        <div className="field"><label>Centro de costo</label><input name="cost_center" placeholder="Contrato, sede, área o proyecto"/></div>
        <div className="field"><label>Observaciones de recepción</label><input name="receipt_notes" placeholder="Estado de entrega, novedad o referencia"/></div>

        <div className="form-span-2 requisition-receive-items">
          {items.rows.map(item=>{
            const requested=Number(item.quantity_requested||0);
            const received=Number(item.quantity_received||0);
            const remaining=Math.max(0,requested-received);
            const receivable=remaining>0&&Boolean(item.inventory_item_id)&&item.inventory_active!==false;
            return <article className={"requisition-receive-item"+(receivable?"":" locked")} key={item.id}>
              <div className="requisition-receive-identity">
                <span><strong>{item.sku}</strong><small>{item.description}</small></span>
                <div><small>Solicitado</small><strong>{item.quantity_requested} {item.unit}</strong></div>
                <div><small>Recibido</small><strong>{item.quantity_received} {item.unit}</strong></div>
                <div><small>Pendiente</small><strong>{remaining.toLocaleString("es-CO")} {item.unit}</strong></div>
              </div>
              {receivable?<div className="requisition-receive-fields">
                <div className="field"><label>Recibir ahora</label><input name={"receive_qty_"+item.id} type="number" min="0.001" max={remaining} step="0.001" placeholder="0"/></div>
                <div className="field"><label>Bodega</label><select name={"warehouse_"+item.id} defaultValue={item.warehouse_id||""}><option value="">Selecciona</option>{warehouses.rows.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.site_name?warehouse.site_name+" · ":""}{warehouse.name}</option>)}</select></div>
                <div className="field"><label>Costo unitario</label><input name={"receive_cost_"+item.id} type="number" min="0" step="0.01" defaultValue={item.unit_cost_estimated}/></div>
                <div className="field"><label>Lote</label><input name={"lot_"+item.id} placeholder="Opcional"/></div>
                <div className="field"><label>Vencimiento</label><input name={"expires_"+item.id} type="date"/></div>
              </div>:<div className="requisition-receive-locked-note">{remaining<=0?"Ítem recibido completamente.":"Ítem no enlazado a un artículo activo de Inventario."}</div>}
            </article>;
          })}
        </div>
        <div className="form-span-2 form-actions"><button className="button" type="submit"><UiIcon name="download" size={15}/> Registrar recepción</button></div>
      </form>
    </section>}

    {canWrite&&<section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Edición y flujo</span><h2>Actualizar requisición</h2><p className="muted">{req.approval_required&&["approved","rejected"].includes(req.approval_state)?"Cambiar cantidad, costo o fecha requerida reabrirá la aprobación antes de permitir nuevas recepciones.":"Puedes ajustar cantidades y costos mientras la requisición siga abierta. El Kardex se modifica únicamente al registrar una recepción."}</p></div></div>
      <form className="form-grid requisition-edit-form" method="post" action={"/api/requisitions/"+req.id}>
        <div className="field"><label>Estado</label><select name="status" defaultValue={req.status} disabled={req.status==="closed"||req.status==="cancelled"}>
          {statusChoices.map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select>{(req.status==="closed"||req.status==="cancelled")&&<input type="hidden" name="status" value={req.status}/>}</div>
        <div className="field"><label>Fecha requerida</label><input type="date" name="needed_by" defaultValue={req.needed_by||""}/></div>

        <div className="form-span-2 requisition-edit-items">
          <div className="requisition-edit-items-head"><strong>Ítems solicitados</strong><span>{canEditItems?"Cantidades y costos editables; marca Retirar para quitar un ítem sin recepción.":"Los ítems están bloqueados por el estado actual."}</span></div>
          <div className="requisition-edit-table">
            <div className="requisition-edit-row head"><span>SKU / insumo</span><span>Cantidad</span><span>Recibido</span><span>Costo estimado</span><span>Retirar</span></div>
            {items.rows.map(item=><div className="requisition-edit-row" key={item.id}>
              <span><strong>{item.sku}</strong><small>{item.description}</small></span>
              <input name={"qty_"+item.id} type="number" min={Math.max(.001,Number(item.quantity_received)||.001)} step="0.001" defaultValue={item.quantity_requested} disabled={!canEditItems}/>
              <span>{item.quantity_received} {item.unit}</span>
              <input name={"cost_"+item.id} type="number" min="0" step="0.01" defaultValue={item.unit_cost_estimated} disabled={!canEditItems}/>
              <label className="requisition-remove-check"><input type="checkbox" name="remove_item" value={item.id} disabled={!canEditItems||Number(item.quantity_received)>0}/><span>Retirar</span></label>
            </div>)}
          </div>
        </div>

        <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3} defaultValue={req.notes||""}/></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar requisición</button></div>
      </form>
    </section>}

    <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Trazabilidad</span><h2>Recepciones registradas</h2><p className="muted">Movimientos de Kardex originados desde esta requisición.</p></div><small>{receipts.rowCount||0} movimientos</small></div>
      {receipts.rowCount?<div className="inventory-kardex-table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>SKU / artículo</th><th>Cantidad</th><th>Bodega</th><th>Documento</th><th>Costo</th><th>Lote / vencimiento</th><th>Centro</th><th>Usuario</th></tr></thead><tbody>
        {receipts.rows.map(receipt=><tr key={receipt.id}>
          <td>{new Date(receipt.movement_at).toLocaleString("es-CO")}</td>
          <td><strong>{receipt.sku}</strong><small className="table-subline">{receipt.description}</small></td>
          <td><strong className="kardex-positive">+{receipt.quantity} {receipt.unit}</strong></td>
          <td>{receipt.warehouse||"—"}</td><td>{receipt.document_number||"—"}</td>
          <td>{receipt.unit_cost?format(Number(receipt.unit_cost)):"—"}</td>
          <td>{receipt.lot_number||"—"}{receipt.expires_at?<small className="table-subline">Vence {new Date(receipt.expires_at+"T12:00:00").toLocaleDateString("es-CO")}</small>:null}</td>
          <td>{receipt.cost_center||"—"}</td><td>{receipt.created_by_name||"Sistema"}</td>
        </tr>)}
      </tbody></table></div>:<div className="empty-state"><strong>Aún no hay recepciones.</strong><span>Cuando registres una entrega, aparecerá aquí y también en el Kardex del artículo.</span></div>}
    </section>
  </>;
}
