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
  organization_country:string|null;requested_by_name:string|null;
};
type Item={id:string;sku:string;description:string;unit:string;quantity_requested:string;quantity_received:string;unit_cost_estimated:string;site_name:string|null;location_name:string|null};

function statusLabel(status:string){return ({draft:"Borrador",sent:"Enviada",approved:"Aprobada",rejected:"Rechazada",partial:"Parcialmente atendida",fulfilled:"Atendida",closed:"Cerrada",cancelled:"Cancelada"} as Record<string,string>)[status]||status;}

export default async function RequisitionDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{updated?:string;error?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"requisitions.read"))redirect("/dashboard");
  const {id}=await params;
  const feedback=await searchParams;
  const result=await query<Req>(
    `SELECT r.id,r.organization_id,r.number::text,r.status,r.created_at::text,r.needed_by::text,r.notes,
            r.supplier_id,s.name supplier_name,s.email supplier_email,s.phone supplier_phone,
            o.name organization_name,COALESCE(o.default_country,o.legal_country) organization_country,u.full_name requested_by_name
     FROM supplier_requisitions r JOIN suppliers s ON s.id=r.supplier_id JOIN organizations o ON o.id=r.organization_id
     LEFT JOIN users u ON u.id=r.requested_by WHERE r.id=$1`,[id],
  );
  if(!result.rowCount)notFound();
  const req=result.rows[0];
  if(session.platformRole==="user"&&session.organizationId!==req.organization_id)notFound();
  const items=await query<Item>(
    `SELECT ri.id,ri.sku,ri.description,ri.unit,ri.quantity_requested::text,ri.quantity_received::text,ri.unit_cost_estimated::text,
            s.name site_name,l.name location_name
     FROM supplier_requisition_items ri LEFT JOIN sites s ON s.id=ri.site_id LEFT JOIN locations l ON l.id=ri.location_id
     WHERE ri.requisition_id=$1 ORDER BY ri.created_at,ri.description`,[id],
  );
  const currency=countryDefinition(req.organization_country)?.currency||"USD";
  const total=items.rows.reduce((sum,item)=>sum+Number(item.quantity_requested)*Number(item.unit_cost_estimated),0);
  const format=(value:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency,maximumFractionDigits:2}).format(value);

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
    {feedback.error&&<div className="notice error section">Revisa el estado o fecha requerida.</div>}

    <section className="requisition-sheet card section">
      <div className="requisition-sheet-header">
        <div><span>Proveedor</span><strong>{req.supplier_name}</strong><small>{req.supplier_email||"Sin correo"}{req.supplier_phone?" · "+req.supplier_phone:""}</small></div>
        <div><span>Estado</span><strong className={"requisition-status "+req.status}>{statusLabel(req.status)}</strong></div>
        <div><span>Solicitante</span><strong>{req.requested_by_name||"Sistema"}</strong></div>
        <div><span>Fecha requerida</span><strong>{req.needed_by?new Date(req.needed_by+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha"}</strong></div>
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
      <div className="requisition-sheet-total"><span>Total estimado</span><strong>{format(total)}</strong></div>
      {req.notes&&<div className="requisition-sheet-notes"><span>Observaciones</span><p>{req.notes}</p></div>}
    </section>

    {can(session,"requisitions.write")&&<section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Flujo</span><h2>Actualizar requisición</h2><p className="muted">La requisición no modifica existencias automáticamente; la recepción de inventario se registra por separado.</p></div></div>
      <form className="form-grid" method="post" action={"/api/requisitions/"+req.id}>
        <div className="field"><label>Estado</label><select name="status" defaultValue={req.status}>
          <option value="draft">Borrador</option><option value="sent">Enviada</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option>
          <option value="partial">Parcialmente atendida</option><option value="fulfilled">Atendida</option><option value="closed">Cerrada</option><option value="cancelled">Cancelada</option>
        </select></div>
        <div className="field"><label>Fecha requerida</label><input type="date" name="needed_by" defaultValue={req.needed_by||""}/></div>
        <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3} defaultValue={req.notes||""}/></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar estado</button></div>
      </form>
    </section>}
  </>;
}
