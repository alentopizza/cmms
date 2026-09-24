import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import RequisitionExportMenu from "@/components/RequisitionExportMenu";
import FileDropzone from "@/components/FileDropzone";
import UiIcon from "@/components/UiIcon";
import { countryDefinition } from "@/lib/international-catalog";
import { loadProcurementReconciliation,procurementDocumentTypeLabel,procurementMatchLabel,procurementReviewLabel } from "@/lib/procurement-reconciliation";

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
  id:string;sku:string;description:string;unit:string;quantity:string;unit_cost:string|null;warehouse_id:string|null;warehouse:string|null;document_number:string|null;
  movement_at:string;lot_number:string|null;expires_at:string|null;cost_center:string|null;created_by_name:string|null;returned_quantity:string;
};
type SupplierReturnLine={
  return_id:string;return_number:string;status:string;reason_code:string;expected_resolution:string;reason_detail:string|null;document_number:string|null;
  returned_at:string;created_by_name:string|null;sku:string;description:string;unit:string;quantity:string;unit_cost:string;warehouse:string|null;
  source_receipt_id:string;source_receipt_at:string;
};
type ApprovalEvent={
  id:string;action:"requested"|"approved"|"rejected"|"reopened"|"amended";from_state:string|null;to_state:string;notes:string|null;
  actor_label:string;created_at:string;
};

function statusLabel(status:string){return ({draft:"Borrador",sent:"Enviada",approved:"Aprobada",rejected:"Rechazada",partial:"Parcialmente atendida",fulfilled:"Atendida",closed:"Cerrada",cancelled:"Cancelada"} as Record<string,string>)[status]||status;}
function approvalLabel(state:Req["approval_state"]){return ({not_required:"No requerida",pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada"} as Record<string,string>)[state]||state;}
function approvalEventLabel(action:ApprovalEvent["action"]){return ({requested:"Enviada a aprobación",approved:"Aprobada",rejected:"Rechazada",reopened:"Aprobación reabierta",amended:"Requisición modificada"} as Record<string,string>)[action]||action;}
function returnReasonLabel(value:string){return ({damaged:"Producto averiado",wrong_item:"Artículo incorrecto",quality:"Problema de calidad",excess:"Exceso recibido",other:"Otro motivo"} as Record<string,string>)[value]||value;}
function returnResolutionLabel(value:string){return ({replacement:"Reposición esperada",credit_note:"Nota crédito esperada",other:"Otra resolución"} as Record<string,string>)[value]||value;}

export default async function RequisitionDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{updated?:string;received?:string;returned?:string;approval?:string;document_saved?:string;document_linked?:string;document_review?:string;error?:string}>}){
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
  const canReturn=canWrite&&can(session,"inventory.write");
  const hasReconcilePermission=can(session,"requisitions.reconcile");
  const reconcileSiteAllowed=session.platformRole!=="user"||session.accessAllSites||items.rows.every(item=>!item.site_id||session.siteIds.includes(item.site_id));
  const canReconcile=hasReconcilePermission&&reconcileSiteAllowed;

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

  const [warehouses,receipts,approvalEvents,returnLines]=await Promise.all([
    (canReceive||canReturn)
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
      `SELECT t.id,ri.sku,ri.description,ri.unit,t.quantity::text,t.unit_cost::text,t.warehouse_id,w.name warehouse,t.document_number,
              t.movement_at::text,t.lot_number,t.expires_at::text,t.cost_center,u.full_name created_by_name,
              COALESCE((SELECT sum(sri.quantity) FROM supplier_return_items sri WHERE sri.receipt_transaction_id=t.id),0)::text returned_quantity
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
    query<SupplierReturnLine>(
      `SELECT sr.id return_id,sr.number::text return_number,sr.status,sr.reason_code,sr.expected_resolution,sr.reason_detail,
              sr.document_number,sr.returned_at::text,u.full_name created_by_name,
              ri.sku,ri.description,ri.unit,sri.quantity::text,sri.unit_cost::text,w.name warehouse,
              sri.receipt_transaction_id source_receipt_id,receipt.movement_at::text source_receipt_at
       FROM supplier_returns sr
       JOIN supplier_return_items sri ON sri.return_id=sr.id
       JOIN supplier_requisition_items ri ON ri.id=sri.requisition_item_id
       JOIN inventory_transactions receipt ON receipt.id=sri.receipt_transaction_id
       LEFT JOIN inventory_warehouses w ON w.id=sri.warehouse_id
       LEFT JOIN users u ON u.id=sr.created_by
       WHERE sr.requisition_id=$1
       ORDER BY sr.returned_at DESC,sr.number DESC,ri.sku`,
      [id],
    ),
  ]);

  const reconciliation=canReconcile
    ?await loadProcurementReconciliation(id)
    :{documents:[],lines:[],events:[]};
  const returnedTotal=returnLines.rows.reduce((sum,row)=>sum+Number(row.quantity||0),0);
  const retainedTotal=Math.max(0,receivedTotal-returnedTotal);
  const returnableReceipts=receipts.rows.filter(row=>Number(row.quantity)-Number(row.returned_quantity)>0.000001);
  const returnEvidence=[...returnLines.rows.reduce((map,line)=>{
    const existing=map.get(line.return_id);
    if(existing)existing.quantity+=Number(line.quantity||0);
    else map.set(line.return_id,{id:line.return_id,number:line.return_number,returned_at:line.returned_at,quantity:Number(line.quantity||0)});
    return map;
  },new Map<string,{id:string;number:string;returned_at:string;quantity:number}>()).values()];
  const matchedDocuments=reconciliation.documents.filter(doc=>doc.match_state==="matched"&&!doc.voided_at).length;
  const differenceDocuments=reconciliation.documents.filter(doc=>doc.match_state==="difference"&&!doc.voided_at).length;
  const pendingDocuments=reconciliation.documents.filter(doc=>doc.match_state==="pending_evidence"&&!doc.voided_at).length;
  const disputedDocuments=reconciliation.documents.filter(doc=>doc.review_status==="disputed"&&!doc.voided_at).length;
  const documentMoney=(value:number,code:string|null)=>{
    const effective=code||currency;
    try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:effective,maximumFractionDigits:2}).format(value);}
    catch{return value.toLocaleString("es-CO",{maximumFractionDigits:2})+" "+effective;}
  };

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
    {feedback.returned&&<div className="notice success section">{feedback.returned} línea{feedback.returned==="1"?"":"s"} devuelta{feedback.returned==="1"?"":"s"} al proveedor; Kardex registró la salida y conservó el vínculo con la recepción original.</div>}
    {feedback.document_saved&&<div className="notice success section">Documento comercial registrado y conciliación inicial calculada.</div>}
    {feedback.document_linked&&<div className="notice success section">{feedback.document_linked} vínculo{feedback.document_linked==="1"?"":"s"} de evidencia agregado{feedback.document_linked==="1"?"":"s"}; la revisión volvió a Pendiente para recalcular la conciliación.</div>}
    {feedback.document_review==="verified"&&<div className="notice success section">Documento verificado contra la evidencia vinculada.</div>}
    {feedback.document_review==="exception_accepted"&&<div className="notice success section">Diferencia aceptada con justificación auditada.</div>}
    {feedback.document_review==="disputed"&&<div className="notice success section">Documento marcado en disputa con trazabilidad de revisión.</div>}
    {feedback.document_review==="voided"&&<div className="notice success section">Documento anulado sin eliminar la evidencia histórica.</div>}
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
    {feedback.error==="return_reason"&&<div className="notice error section">Selecciona el motivo y la resolución esperada. Si eliges Otro motivo, describe la novedad.</div>}
    {feedback.error==="return_empty"&&<div className="notice error section">Ingresa una cantidad a devolver en al menos una recepción.</div>}
    {feedback.error==="return_qty"&&<div className="notice error section">La cantidad a devolver debe ser mayor que cero.</div>}
    {feedback.error==="return_over"&&<div className="notice error section">La devolución supera la cantidad disponible de la recepción seleccionada.</div>}
    {feedback.error==="return_warehouse"&&<div className="notice error section">Selecciona una bodega activa y autorizada para la salida de la devolución.</div>}
    {feedback.error==="return_stock"&&<div className="notice error section">La bodega no tiene existencias suficientes para registrar esta devolución al proveedor.</div>}
    {feedback.error==="document_fields"&&<div className="notice error section">Completa tipo y número del documento comercial.</div>}
    {feedback.error==="document_date"&&<div className="notice error section">La fecha del documento no es válida.</div>}
    {feedback.error==="document_currency"&&<div className="notice error section">La moneda debe usar un código ISO de tres letras, por ejemplo COP o USD.</div>}
    {feedback.error==="document_amount"&&<div className="notice error section">Los valores del documento no pueden ser negativos.</div>}
    {feedback.error==="document_lines"&&<div className="notice error section">Registra al menos una línea documental con cantidad válida.</div>}
    {feedback.error==="document_file"&&<div className="notice error section">Adjunta el PDF o imagen que servirá como evidencia comercial.</div>}
    {feedback.error==="document_evidence"&&<div className="notice error section">La evidencia seleccionada no corresponde al tipo de documento o a esta requisición.</div>}
    {feedback.error==="document_evidence_empty"&&<div className="notice error section">Selecciona al menos una recepción o DEV para agregar como evidencia.</div>}
    {feedback.error==="document_evidence_duplicate"&&<div className="notice error section">La evidencia seleccionada ya estaba vinculada a este documento.</div>}
    {feedback.error==="document_verify_match"&&<div className="notice error section">Solo puedes verificar un documento cuando la conciliación automática indica Coincide.</div>}
    {feedback.error==="document_exception_state"&&<div className="notice error section">Solo puedes aceptar una excepción cuando existe una diferencia calculada.</div>}
    {feedback.error==="document_review_notes"&&<div className="notice error section">Aceptar una excepción o marcar una disputa requiere una observación.</div>}
    {feedback.error==="document_void_reason"&&<div className="notice error section">Anular un documento requiere registrar el motivo.</div>}
    {feedback.error==="document_voided"&&<div className="notice error section">El documento está anulado y ya no admite cambios de revisión o evidencia.</div>}
    {feedback.error&&feedback.error.startsWith("document_")&&!["document_fields","document_date","document_currency","document_amount","document_lines","document_file","document_evidence","document_evidence_empty","document_evidence_duplicate","document_verify_match","document_exception_state","document_review_notes","document_void_reason","document_voided"].includes(feedback.error)&&<div className="notice error section">No fue posible completar la conciliación documental. Revisa los datos y vuelve a intentarlo.</div>}
    {feedback.error&&feedback.error.startsWith("receive_")&&!["receive_locked","receive_approval","receive_empty","receive_over","receive_item","receive_warehouse"].includes(feedback.error)&&<div className="notice error section">No fue posible registrar la recepción. Revisa cantidades, costos, fechas y bodegas.</div>}
    {feedback.error&& !["items","received","empty","fulfillment","status_locked","approval_route","approval_locked","approval_self","approval_notes","return_reason","return_empty","return_qty","return_over","return_warehouse","return_stock"].includes(feedback.error)&&!feedback.error.startsWith("receive")&&!feedback.error.startsWith("return")&&!feedback.error.startsWith("document")&&<div className="notice error section">No fue posible completar la acción. Revisa la requisición y vuelve a intentarlo.</div>}
    {feedback.error==="return"&&<div className="notice error section">No fue posible registrar la devolución. Revisa cantidades, fecha, bodega y trazabilidad de la recepción.</div>}

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
        <div><span>Recepción física</span><strong>{receivedPct}%</strong><small>{receivedTotal.toLocaleString("es-CO")} recibidas · {returnedTotal.toLocaleString("es-CO")} devueltas · {retainedTotal.toLocaleString("es-CO")} netas en historial de compra</small></div>
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


    {canReturn&&(receipts.rowCount||0)>0&&<section className="card section supplier-return-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Devolución a proveedor</span><h2>Registrar salida contra una recepción</h2><p className="muted">La devolución no borra la recepción original. Genera una salida de Kardex enlazada a la requisición y al movimiento de entrada que la originó.</p></div>
        <span className="supplier-return-badge">{returnedTotal.toLocaleString("es-CO")} devuelto</span>
      </div>
      {returnableReceipts.length?<form className="form-grid supplier-return-form" method="post" action={"/api/requisitions/"+req.id+"/returns"}>
        <div className="field"><label>Motivo *</label><select name="reason_code" required defaultValue="damaged"><option value="damaged">Producto averiado</option><option value="wrong_item">Artículo incorrecto</option><option value="quality">Problema de calidad</option><option value="excess">Exceso recibido</option><option value="other">Otro motivo</option></select></div>
        <div className="field"><label>Resolución esperada *</label><select name="expected_resolution" required defaultValue="replacement"><option value="replacement">Reposición</option><option value="credit_note">Nota crédito</option><option value="other">Otra resolución</option></select></div>
        <div className="field"><label>Documento / referencia</label><input name="document_number" placeholder="Acta, remisión, RMA, nota..."/></div>
        <div className="field"><label>Fecha / hora</label><input name="returned_at" type="datetime-local"/></div>
        <div className="field form-span-2"><label>Detalle del motivo</label><textarea name="reason_detail" rows={2} placeholder="Estado del producto, novedad o acuerdo con el proveedor. Obligatorio si eliges Otro motivo."/></div>
        <div className="form-span-2 supplier-return-source-list">
          {returnableReceipts.map(receipt=>{
            const received=Number(receipt.quantity||0);
            const returned=Number(receipt.returned_quantity||0);
            const available=Math.max(0,received-returned);
            return <article className="supplier-return-source" key={receipt.id}>
              <div className="supplier-return-source-head">
                <span><strong>{receipt.sku}</strong><small>{receipt.description}</small></span>
                <div><small>Recepción origen</small><strong>{new Date(receipt.movement_at).toLocaleDateString("es-CO")}</strong></div>
                <div><small>Recibido</small><strong>{received.toLocaleString("es-CO")} {receipt.unit}</strong></div>
                <div><small>Ya devuelto</small><strong>{returned.toLocaleString("es-CO")} {receipt.unit}</strong></div>
                <div><small>Disponible</small><strong>{available.toLocaleString("es-CO")} {receipt.unit}</strong></div>
              </div>
              <div className="supplier-return-source-fields">
                <div className="field"><label>Devolver ahora</label><input name={"return_qty_"+receipt.id} type="number" min="0.001" max={available} step="0.001" placeholder="0"/></div>
                <div className="field"><label>Bodega de salida</label><select name={"return_warehouse_"+receipt.id} defaultValue={receipt.warehouse_id||""}><option value="">Selecciona</option>{warehouses.rows.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.site_name?warehouse.site_name+" · ":""}{warehouse.name}</option>)}</select></div>
                <div className="supplier-return-source-meta"><span>Entrada: {receipt.document_number||"sin documento"}</span><span>{receipt.lot_number?"Lote "+receipt.lot_number:"Sin lote"}</span><span>{receipt.unit_cost?format(Number(receipt.unit_cost))+" / "+receipt.unit:"Costo no registrado"}</span></div>
              </div>
            </article>;
          })}
        </div>
        <div className="form-span-2 form-actions"><button className="button danger-secondary" type="submit"><UiIcon name="upload" size={15}/> Registrar devolución al proveedor</button></div>
      </form>:<div className="empty-state"><strong>No hay cantidades pendientes por devolver.</strong><span>Todas las recepciones de esta requisición ya fueron devueltas completamente.</span></div>}
    </section>}

    {(returnLines.rowCount||0)>0&&<section className="card section supplier-return-history">
      <div className="section-heading"><div><span className="eyebrow">Trazabilidad</span><h2>Devoluciones al proveedor</h2><p className="muted">Cada línea conserva la recepción de origen, bodega de salida, motivo, resolución esperada y movimiento de Kardex.</p></div><small>{returnLines.rowCount} líneas</small></div>
      <div className="inventory-kardex-table-wrap"><table className="table"><thead><tr><th>DEV</th><th>Fecha</th><th>SKU / artículo</th><th>Cantidad</th><th>Bodega</th><th>Motivo</th><th>Resolución</th><th>Documento</th><th>Recepción origen</th><th>Usuario</th></tr></thead><tbody>
        {returnLines.rows.map(line=><tr key={line.return_id+"-"+line.source_receipt_id+"-"+line.sku}>
          <td><strong>DEV-{line.return_number.padStart(6,"0")}</strong><small className="table-subline">{line.status==="posted"?"Registrada":line.status}</small></td>
          <td>{new Date(line.returned_at).toLocaleString("es-CO")}</td>
          <td><strong>{line.sku}</strong><small className="table-subline">{line.description}</small></td>
          <td><strong className="kardex-negative">-{line.quantity} {line.unit}</strong><small className="table-subline">{format(Number(line.unit_cost||0))} / {line.unit}</small></td>
          <td>{line.warehouse||"—"}</td>
          <td>{returnReasonLabel(line.reason_code)}{line.reason_detail&&<small className="table-subline">{line.reason_detail}</small>}</td>
          <td>{returnResolutionLabel(line.expected_resolution)}</td>
          <td>{line.document_number||"—"}</td>
          <td>{new Date(line.source_receipt_at).toLocaleString("es-CO")}<small className="table-subline">Movimiento {line.source_receipt_id.slice(0,8)}</small></td>
          <td>{line.created_by_name||"Sistema"}</td>
        </tr>)}
      </tbody></table></div>
    </section>}


    {hasReconcilePermission&&!reconcileSiteAllowed&&<section className="card section procurement-reconciliation-lock">
      <div><strong>Conciliación documental restringida por sedes</strong><span>Tu alcance no cubre todos los ítems de esta requisición. La evidencia comercial solo puede conciliarse cuando el revisor tiene alcance sobre la requisición completa.</span></div>
    </section>}

    {canReconcile&&<section className="card section procurement-reconciliation-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Conciliación documental</span><h2>Orden de compra · remisión · factura · nota crédito</h2><p className="muted">Compara evidencia comercial contra lo solicitado, las recepciones físicas y las devoluciones DEV. La conciliación no modifica Kardex ni reescribe el histórico.</p></div>
        <span className="procurement-document-count">{reconciliation.documents.filter(doc=>!doc.voided_at).length} documentos</span>
      </div>

      <div className="procurement-reconciliation-summary">
        <article><span>Coinciden</span><strong>{matchedDocuments}</strong><small>cantidad/valor dentro de tolerancia</small></article>
        <article><span>Con diferencia</span><strong>{differenceDocuments}</strong><small>requieren revisión</small></article>
        <article><span>Pendientes</span><strong>{pendingDocuments}</strong><small>falta evidencia física vinculada</small></article>
        <article><span>En disputa</span><strong>{disputedDocuments}</strong><small>marcados por un revisor</small></article>
      </div>

      <div className="procurement-document-create">
        <div className="procurement-document-create-head"><div><strong>Registrar documento comercial</strong><span>El archivo y sus líneas quedan inmutables; una corrección se hace anulando y cargando un nuevo documento.</span></div></div>
        <form className="form-grid procurement-document-form" method="post" action={"/api/requisitions/"+req.id+"/documents"} encType="multipart/form-data">
          <div className="field"><label>Tipo *</label><select name="document_type" required defaultValue="invoice">
            <option value="purchase_order">Orden de compra</option><option value="delivery_note">Remisión / entrega</option><option value="invoice">Factura</option><option value="credit_note">Nota crédito</option><option value="other">Otro documento</option>
          </select></div>
          <div className="field"><label>Número *</label><input name="document_number" required maxLength={160} placeholder="Factura, OC, remisión..."/></div>
          <div className="field"><label>Fecha documento</label><input name="issue_date" type="date"/></div>
          <div className="field"><label>Moneda</label><input name="currency_code" defaultValue={currency} maxLength={3}/></div>
          <div className="field"><label>Subtotal</label><input name="subtotal" type="number" min="0" step="0.01" placeholder="Se calcula desde líneas si queda vacío"/></div>
          <div className="field"><label>Impuestos</label><input name="tax_total" type="number" min="0" step="0.01" placeholder="0"/></div>
          <div className="field"><label>Total documento</label><input name="total" type="number" min="0" step="0.01" placeholder="Subtotal + impuestos si queda vacío"/></div>
          <div className="field"><label>Observaciones</label><input name="notes" placeholder="Referencia contractual, condición o novedad"/></div>

          <div className="form-span-2 procurement-document-lines">
            <div className="procurement-document-subhead"><strong>Líneas del documento</strong><span>Registra solo los ítems que aparecen en el documento. En factura/nota crédito el valor de línea se compara con la evidencia física enlazada.</span></div>
            {items.rows.map(item=><article className="procurement-document-line-entry" key={item.id}>
              <div><strong>{item.sku}</strong><span>{item.description}</span><small>Solicitado {item.quantity_requested} {item.unit} · Recibido {item.quantity_received} {item.unit}</small></div>
              <div className="field"><label>Cantidad documento</label><input name={"doc_qty_"+item.id} type="number" min="0.001" step="0.001" placeholder="0"/></div>
              <div className="field"><label>Costo unitario</label><input name={"doc_cost_"+item.id} type="number" min="0" step="0.01" defaultValue={item.unit_cost_estimated}/></div>
              <div className="field"><label>Total línea</label><input name={"doc_total_"+item.id} type="number" min="0" step="0.01" placeholder="Cantidad × costo"/></div>
            </article>)}
          </div>

          {(receipts.rows.length>0||returnEvidence.length>0)&&<div className="form-span-2 procurement-document-evidence-picker">
            <div className="procurement-document-subhead"><strong>Evidencia física inicial</strong><span>Marca recepciones solo para Remisión/Factura. Marca DEV solo para Nota crédito. Puedes agregar más evidencia después sin reemplazar el archivo.</span></div>
            {receipts.rows.length>0&&<div className="procurement-evidence-group"><strong>Recepciones</strong>{receipts.rows.map(receipt=><label key={receipt.id}>
              <input type="checkbox" name="receipt_id" value={receipt.id}/><span><b>{receipt.sku}</b> · {receipt.quantity} {receipt.unit} · {new Date(receipt.movement_at).toLocaleDateString("es-CO")} · {receipt.document_number||"sin referencia"}</span>
            </label>)}</div>}
            {returnEvidence.length>0&&<div className="procurement-evidence-group"><strong>DEV proveedor</strong>{returnEvidence.map(ret=><label key={ret.id}>
              <input type="checkbox" name="return_id" value={ret.id}/><span><b>DEV-{ret.number.padStart(6,"0")}</b> · {ret.quantity.toLocaleString("es-CO")} unidades · {new Date(ret.returned_at).toLocaleDateString("es-CO")}</span>
            </label>)}</div>}
          </div>}

          <div className="form-span-2"><FileDropzone name="file" label="Evidencia documental" description="PDF, PNG, JPG o WebP. Máximo 10 MB." accept=".pdf,image/png,image/jpeg,image/webp" maxSizeMb={10} required kind="document"/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit"><UiIcon name="file" size={15}/> Registrar y conciliar</button></div>
        </form>
      </div>

      <div className="procurement-document-history">
        <div className="procurement-document-history-head"><strong>Documentos registrados</strong><span>{reconciliation.documents.length} históricos, incluidos anulados</span></div>
        {reconciliation.documents.length?<div className="procurement-document-list">{reconciliation.documents.map(doc=>{
          const docLines=reconciliation.lines.filter(line=>line.document_id===doc.id);
          const docEvents=reconciliation.events.filter(event=>event.document_id===doc.id);
          const receiptCandidates=receipts.rows.filter(receipt=>!doc.receipt_ids.includes(receipt.id));
          const returnCandidates=returnEvidence.filter(ret=>!doc.return_ids.includes(ret.id));
          const canLinkReceipts=["delivery_note","invoice"].includes(doc.document_type)&&receiptCandidates.length>0;
          const canLinkReturns=doc.document_type==="credit_note"&&returnCandidates.length>0;
          return <article className={"procurement-document-card "+doc.match_state+(doc.voided_at?" voided":"")} key={doc.id}>
            <div className="procurement-document-card-head">
              <div><span>{procurementDocumentTypeLabel(doc.document_type)}</span><strong>{doc.document_number}</strong><small>{doc.issue_date?new Date(doc.issue_date+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha"} · {doc.file_name}</small></div>
              <div className="procurement-document-badges"><span className={"procurement-match-badge "+doc.match_state}>{procurementMatchLabel(doc.match_state)}</span>{!doc.voided_at&&<span className={"procurement-review-badge "+doc.review_status}>{procurementReviewLabel(doc.review_status)}</span>}</div>
            </div>

            <div className="procurement-document-metrics">
              <div><span>Documento</span><strong>{Number(doc.document_quantity).toLocaleString("es-CO")} u.</strong><small>{documentMoney(Number(doc.document_value),doc.currency_code)}</small></div>
              <div><span>Esperado</span><strong>{doc.expected_quantity===null?"—":doc.expected_quantity.toLocaleString("es-CO")+" u."}</strong><small>{doc.expected_value===null?"No aplica":documentMoney(doc.expected_value,doc.currency_code)}</small></div>
              <div><span>Diferencia</span><strong>{doc.quantity_difference===null?"—":doc.quantity_difference.toLocaleString("es-CO")+" u."}</strong><small>{doc.value_difference===null?"No aplica":documentMoney(doc.value_difference,doc.currency_code)}</small></div>
              <div><span>Total cabecera</span><strong>{documentMoney(Number(doc.total),doc.currency_code)}</strong><small>{doc.receipt_count} recepciones · {doc.return_count} DEV</small></div>
            </div>

            {docLines.length>0&&<div className="inventory-kardex-table-wrap procurement-document-line-table"><table className="table"><thead><tr><th>SKU</th><th>Documento</th><th>Esperado</th><th>Diferencia</th><th>Valor documento</th><th>Valor esperado</th><th>Estado</th></tr></thead><tbody>
              {docLines.map(line=><tr key={line.id}>
                <td><strong>{line.sku}</strong><small className="table-subline">{line.description}</small></td>
                <td>{Number(line.quantity).toLocaleString("es-CO")} {line.unit}</td>
                <td>{line.expected_quantity===null?"—":line.expected_quantity.toLocaleString("es-CO")+" "+line.unit}</td>
                <td>{line.quantity_difference===null?"—":line.quantity_difference.toLocaleString("es-CO")+" "+line.unit}</td>
                <td>{documentMoney(Number(line.line_total),doc.currency_code)}</td>
                <td>{line.expected_value===null?"—":documentMoney(line.expected_value,doc.currency_code)}</td>
                <td><span className={"procurement-match-mini "+line.match_state}>{line.match_state==="matched"?"Coincide":line.match_state==="difference"?"Diferencia":line.match_state==="pending_evidence"?"Pendiente":"Informativo"}</span></td>
              </tr>)}
            </tbody></table></div>}

            <div className="procurement-document-actions">
              <a className="button secondary" href={"/api/requisitions/"+req.id+"/documents/"+doc.id}><UiIcon name="download" size={14}/> Descargar</a>
              {doc.file_mime_type==="application/pdf"&&<a className="button secondary" href={"/api/requisitions/"+req.id+"/documents/"+doc.id+"?inline=1"} target="_blank" rel="noreferrer">Vista previa</a>}
            </div>

            {!doc.voided_at&&(canLinkReceipts||canLinkReturns)&&<form className="procurement-document-link-form" method="post" action={"/api/requisitions/"+req.id+"/documents/"+doc.id}>
              <input type="hidden" name="intent" value="link_evidence"/>
              <div className="procurement-document-subhead"><strong>Agregar evidencia</strong><span>Agregar evidencia reabre la revisión a Pendiente.</span></div>
              {canLinkReceipts&&<div className="procurement-evidence-group">{receiptCandidates.map(receipt=><label key={receipt.id}><input type="checkbox" name="receipt_id" value={receipt.id}/><span>{receipt.sku} · {receipt.quantity} {receipt.unit} · {new Date(receipt.movement_at).toLocaleDateString("es-CO")}</span></label>)}</div>}
              {canLinkReturns&&<div className="procurement-evidence-group">{returnCandidates.map(ret=><label key={ret.id}><input type="checkbox" name="return_id" value={ret.id}/><span>DEV-{ret.number.padStart(6,"0")} · {ret.quantity.toLocaleString("es-CO")} unidades</span></label>)}</div>}
              <div className="field"><label>Nota de enlace</label><input name="notes" placeholder="Opcional"/></div>
              <div className="form-actions"><button className="button secondary" type="submit">Vincular evidencia</button></div>
            </form>}

            {!doc.voided_at&&<div className="procurement-document-review">
              <div className="procurement-document-subhead"><strong>Revisión</strong><span>{doc.reviewed_at?"Última revisión "+new Date(doc.reviewed_at).toLocaleString("es-CO")+" por "+(doc.reviewed_by_name||"Sistema"):"Aún no revisado"}</span></div>
              {doc.review_notes&&<p className="procurement-review-note">{doc.review_notes}</p>}
              <form className="procurement-document-review-form" method="post" action={"/api/requisitions/"+req.id+"/documents/"+doc.id}>
                <div className="field"><label>Observación</label><input name="notes" placeholder="Obligatoria para excepción, disputa o anulación"/></div>
                <div className="form-actions">
                  {doc.match_state==="matched"&&<button className="button" type="submit" name="intent" value="verify">Verificar</button>}
                  {doc.match_state==="difference"&&<button className="button secondary" type="submit" name="intent" value="accept_exception">Aceptar excepción</button>}
                  <button className="button secondary" type="submit" name="intent" value="dispute">Marcar disputa</button>
                  <button className="button secondary danger-text" type="submit" name="intent" value="void">Anular documento</button>
                </div>
              </form>
            </div>}

            {doc.voided_at&&<div className="procurement-document-voided"><strong>Documento anulado</strong><span>{new Date(doc.voided_at).toLocaleString("es-CO")} · {doc.void_reason||"Sin motivo"}</span></div>}

            {docEvents.length>0&&<details className="procurement-document-events"><summary>Historial de auditoría · {docEvents.length} eventos</summary><div>
              {docEvents.map(event=><article key={event.id}><span>{event.action==="uploaded"?"Cargado":event.action==="evidence_linked"?"Evidencia vinculada":event.action==="verified"?"Verificado":event.action==="exception_accepted"?"Excepción aceptada":event.action==="disputed"?"En disputa":"Anulado"}</span><strong>{event.actor_label}</strong><time>{new Date(event.created_at).toLocaleString("es-CO")}</time>{event.notes&&<p>{event.notes}</p>}</article>)}
            </div></details>}
          </article>;
        })}</div>:<div className="empty-state"><strong>Aún no hay documentos comerciales.</strong><span>Registra la orden de compra, remisión, factura o nota crédito para empezar la conciliación.</span></div>}
      </div>
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
      {receipts.rowCount?<div className="inventory-kardex-table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>SKU / artículo</th><th>Recibido</th><th>Devuelto</th><th>Bodega</th><th>Documento</th><th>Costo</th><th>Lote / vencimiento</th><th>Centro</th><th>Usuario</th></tr></thead><tbody>
        {receipts.rows.map(receipt=><tr key={receipt.id}>
          <td>{new Date(receipt.movement_at).toLocaleString("es-CO")}</td>
          <td><strong>{receipt.sku}</strong><small className="table-subline">{receipt.description}</small></td>
          <td><strong className="kardex-positive">+{receipt.quantity} {receipt.unit}</strong></td>
          <td>{Number(receipt.returned_quantity)>0?<strong className="kardex-negative">-{receipt.returned_quantity} {receipt.unit}</strong>:"—"}</td>
          <td>{receipt.warehouse||"—"}</td><td>{receipt.document_number||"—"}</td>
          <td>{receipt.unit_cost?format(Number(receipt.unit_cost)):"—"}</td>
          <td>{receipt.lot_number||"—"}{receipt.expires_at?<small className="table-subline">Vence {new Date(receipt.expires_at+"T12:00:00").toLocaleDateString("es-CO")}</small>:null}</td>
          <td>{receipt.cost_center||"—"}</td><td>{receipt.created_by_name||"Sistema"}</td>
        </tr>)}
      </tbody></table></div>:<div className="empty-state"><strong>Aún no hay recepciones.</strong><span>Cuando registres una entrega, aparecerá aquí y también en el Kardex del artículo.</span></div>}
    </section>
  </>;
}
