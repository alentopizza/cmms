import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import ModuleHeader from "@/components/ModuleHeader";
import UiIcon from "@/components/UiIcon";

type Req={
  id:string;number:string;status:string;created_at:string;needed_by:string|null;supplier_id:string;supplier_name:string;
  organization_name:string;requested_by_name:string|null;item_count:number;total_estimated:string;
};

function statusLabel(status:string){
  return ({draft:"Borrador",sent:"Enviada",approved:"Aprobada",rejected:"Rechazada",partial:"Parcialmente atendida",fulfilled:"Atendida",closed:"Cerrada",cancelled:"Cancelada"} as Record<string,string>)[status]||status;
}

export default async function RequisitionsPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string;error?:string;requisition_created?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"requisitions.read"))redirect("/dashboard");
  const params=await searchParams;
  const platform=session.platformRole!=="user";

  const reqs=platform
    ? await query<Req>(
      `SELECT r.id,r.number::text,r.status,r.created_at::text,r.needed_by::text,r.supplier_id,s.name supplier_name,o.name organization_name,
              u.full_name requested_by_name,count(ri.id)::int item_count,
              COALESCE(sum(ri.quantity_requested*ri.unit_cost_estimated),0)::text total_estimated
       FROM supplier_requisitions r
       JOIN suppliers s ON s.id=r.supplier_id
       JOIN organizations o ON o.id=r.organization_id
       LEFT JOIN users u ON u.id=r.requested_by
       LEFT JOIN supplier_requisition_items ri ON ri.requisition_id=r.id
       GROUP BY r.id,s.name,o.name,u.full_name
       ORDER BY r.created_at DESC LIMIT 300`)
    : await query<Req>(
      `SELECT r.id,r.number::text,r.status,r.created_at::text,r.needed_by::text,r.supplier_id,s.name supplier_name,o.name organization_name,
              u.full_name requested_by_name,count(ri.id)::int item_count,
              COALESCE(sum(ri.quantity_requested*ri.unit_cost_estimated),0)::text total_estimated
       FROM supplier_requisitions r
       JOIN suppliers s ON s.id=r.supplier_id
       JOIN organizations o ON o.id=r.organization_id
       LEFT JOIN users u ON u.id=r.requested_by
       LEFT JOIN supplier_requisition_items ri ON ri.requisition_id=r.id
       WHERE r.organization_id=$1
       GROUP BY r.id,s.name,o.name,u.full_name
       ORDER BY r.created_at DESC LIMIT 300`,[session.organizationId]);

  return <>
    <ModuleHeader
      eyebrow="Abastecimiento"
      title="Requisiciones"
      description="Cada requisición pertenece a un único proveedor. Las selecciones mixtas de inventario se separan automáticamente por proveedor."
      count={reqs.rowCount||0}
      countLabel="requisiciones"
      searchPlaceholder="Buscar requisición, proveedor, estado o solicitante"
      filters={[
        {value:"all",label:"Todos"},{value:"draft",label:"Borrador"},{value:"sent",label:"Enviadas"},
        {value:"approved",label:"Aprobadas"},{value:"partial",label:"Parciales"},{value:"fulfilled",label:"Atendidas"},{value:"closed",label:"Cerradas"},
      ]}
      action={can(session,"requisitions.write")?<Link className="button" href="/dashboard/inventory#crear-requisicion"><UiIcon name="plus" size={16}/> Crear desde inventario</Link>:undefined}
    />

    {(params.requisition_created||params.created)&&<div className="notice success section">{params.requisition_created||params.created} requisición{(params.requisition_created||params.created)==="1"?"":"es"} creada{(params.requisition_created||params.created)==="1"?"":"s"} correctamente.</div>}
    {params.error&&<div className="notice error section">No fue posible generar la requisición. Revisa los ítems y cantidades seleccionadas.</div>}

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Historial</span><h2>Requisiciones por proveedor</h2></div></div>
      {reqs.rowCount?<div className="requisition-directory-grid">
        {reqs.rows.map(req=><article key={req.id} className="card requisition-directory-card" data-module-record data-status={req.status} data-search={[req.number,req.supplier_name,req.organization_name,req.status,req.requested_by_name].filter(Boolean).join(" ")}>
          <div className="requisition-directory-head">
            <span className="requisition-directory-icon"><UiIcon name="file" size={18}/></span>
            <div><small>REQ-{req.number.padStart(6,"0")}</small><strong>{req.supplier_name}</strong><span>{req.organization_name}</span></div>
            <span className={"requisition-status "+req.status}>{statusLabel(req.status)}</span>
          </div>
          <div className="requisition-directory-meta">
            <div><span>Ítems</span><strong>{req.item_count}</strong></div>
            <div><span>Creada</span><strong>{new Date(req.created_at).toLocaleDateString("es-CO")}</strong></div>
            <div><span>Requerida</span><strong>{req.needed_by?new Date(req.needed_by+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha"}</strong></div>
            <div><span>Solicitante</span><strong>{req.requested_by_name||"Sistema"}</strong></div>
          </div>
          <div className="requisition-directory-actions">
            <Link href={"/dashboard/requisitions/"+req.id}><UiIcon name="file" size={15}/> Ver requisición</Link>
            <Link href={"/dashboard/suppliers?supplier="+req.supplier_id}><UiIcon name="company" size={15}/> Ver proveedor</Link>
          </div>
        </article>)}
      </div>:<div className="card empty-state"><strong>Aún no hay requisiciones.</strong><span>Selecciona insumos desde Inventario o entra a la ficha de un proveedor para generar la primera.</span></div>}
    </section>
  </>;
}
