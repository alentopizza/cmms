import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import CreateRecordModal from "@/components/CreateRecordModal";

type OrderRow={id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;requested_at:string};

export default async function WorkOrdersPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const session=await getSession();
  const feedback=await searchParams;
  if(!session) redirect("/login");
  if(!can(session,"work_orders.read")) redirect("/dashboard");

  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"work_orders.write");
  const owner=isPlatformOwner(session);
  const creationGate=await getCreationGateForScope("work_order",session.organizationId,superadmin);
  const requesterOnly=session.role==="requester" && session.userId;
  const providerOnly=session.role==="provider" && session.userId;
  const externalOnly=session.role==="external" && session.userId;

  let orders;
  if(superadmin){
    orders=await query<OrderRow>(
      `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
       FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
       ORDER BY w.requested_at DESC LIMIT 200`);
  }else if(requesterOnly){
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.requested_by=$2 ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId])
      : await query<OrderRow>(
          `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.requested_by=$2 AND w.site_id=ANY($3::uuid[])
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId,session.siteIds]);
  }else if(providerOnly){
    const supplierId=session.externalSupplierId;
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT DISTINCT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND $2::uuid IS NOT NULL AND (
             w.service_supplier_id=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id=$2)
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,supplierId])
      : await query<OrderRow>(
          `SELECT DISTINCT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.site_id=ANY($3::uuid[]) AND $2::uuid IS NOT NULL AND (
             w.service_supplier_id=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id=$2)
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,supplierId,session.siteIds]);
  }else if(externalOnly){
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT DISTINCT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND (
             w.assigned_to=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (
               t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2)
             ))
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId])
      : await query<OrderRow>(
          `SELECT DISTINCT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.site_id=ANY($3::uuid[]) AND (
             w.assigned_to=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (
               t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2)
             ))
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId,session.siteIds]);
  }else{
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 ORDER BY w.requested_at DESC LIMIT 200`,[orgId])
      : await query<OrderRow>(
          `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.site_id=ANY($2::uuid[])
           ORDER BY w.requested_at DESC LIMIT 200`,[orgId,session.siteIds]);
  }

  const assets=canWrite
    ? superadmin
      ? await query<{id:string;label:string}>(`SELECT a.id,o.name||' · '||s.name||' · '||a.code||' '||a.name label FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id WHERE a.status<>'retired' ORDER BY o.name,a.name`)
      : session.accessAllSites
        ? await query<{id:string;label:string}>(`SELECT a.id,s.name||' · '||a.code||' '||a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.status<>'retired' ORDER BY a.name`,[orgId])
        : await query<{id:string;label:string}>(`SELECT a.id,s.name||' · '||a.code||' '||a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[]) AND a.status<>'retired' ORDER BY a.name`,[orgId,session.siteIds])
    : {rows:[]} as {rows:{id:string;label:string}[]};

  return <>
    <ModuleHeader
      eyebrow="Mantenimiento"
      title="Órdenes de trabajo"
      description={providerOnly?"Solo ves trabajo asignado a tu empresa proveedora.":externalOnly?"Solo ves órdenes y actividades asignadas directamente a tu cuenta o cuadrilla.":requesterOnly?"Consulta y registra tus solicitudes de mantenimiento.":"Correctivos, preventivos, inspecciones y emergencias."}
      count={orders.rowCount || 0}
      countLabel="órdenes"
      searchPlaceholder="Buscar OT, trabajo, empresa o equipo"
      filters={[
        {value:"all",label:"Todas"},
        {value:"open",label:"Abiertas"},
        {value:"assigned",label:"Asignadas"},
        {value:"in_progress",label:"En progreso"},
        {value:"completed",label:"Completadas"},
        {value:"cancelled",label:"Canceladas"},
      ]}
      action={canWrite && creationGate.ready && assets.rows.length>0 ? <CreateRecordModal title={requesterOnly?"Crear solicitud":"Crear orden de trabajo"} eyebrow={requesterOnly?"Nueva solicitud":"Nueva orden"} description="Relaciona el trabajo con un activo y define los datos iniciales de atención." triggerLabel="Agregar" icon="✓">
        <form className="form-grid unified-popup-form" method="post" action="/api/work-orders">
          <div className="field form-span-2"><label>Equipo *</label><select name="asset_id" required><option value="">Selecciona un activo</option>{assets.rows.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
          <div className="field form-span-2"><label>Título *</label><input name="title" required placeholder="Ej. Revisar temperatura irregular en cámara 02"/></div>
          {!requesterOnly && <><div className="field"><label>Tipo</label><select name="type"><option value="corrective">Correctivo</option><option value="preventive">Preventivo</option><option value="inspection">Inspección</option><option value="emergency">Emergencia</option><option value="improvement">Mejora</option></select></div><div className="field"><label>Prioridad</label><select name="priority"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div></>}
          <div className="form-span-2 form-actions"><button className="button" type="submit">{requesterOnly?"Enviar solicitud":"Crear orden"}</button></div>
        </form>
      </CreateRecordModal> : undefined}
    />

    {feedback.error==="sequence" && <div className="notice error section">{creationGate.message}</div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="✓"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/assets"}
      action={creationGate.action || "Continuar"}
    />}

    <section className="section"><table className="table"><thead><tr><th>OT</th><th>Trabajo</th><th>Empresa</th><th>Equipo</th><th>Prioridad</th><th>Estado</th><th></th>{owner&&<th>Acciones</th>}</tr></thead><tbody>
      {orders.rows.map(w=><tr key={w.id} data-module-record data-status={w.status} data-search={[w.number,w.title,w.company,w.asset,w.priority,w.status].join(" ")}><td>#{w.number}</td><td><strong>{w.title}</strong></td><td>{w.company}</td><td>{w.asset}</td><td>{w.priority}</td><td><span className="status">{w.status}</span></td><td><Link className="text-button" href={"/dashboard/work-orders/"+w.id}>Actividades →</Link></td>{owner&&<td><OwnerRecordActions table="work_orders" id={w.id} label={"OT #"+w.number} fields={[
        {name:"title",label:"Título",value:w.title},
        {name:"priority",label:"Prioridad",value:w.priority,type:"select",options:[
          {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"}
        ]},
        {name:"status",label:"Estado",value:w.status,type:"select",options:[
          {value:"open",label:"Abierta"},{value:"assigned",label:"Asignada"},{value:"in_progress",label:"En progreso"},{value:"paused",label:"Pausada"},{value:"completed",label:"Completada"},{value:"cancelled",label:"Cancelada"}
        ]},
      ]}/></td>}</tr>)}
    </tbody></table>{!orders.rowCount && (providerOnly||externalOnly||creationGate.ready) && <div className="card empty-state"><strong>No hay órdenes disponibles.</strong><span>{providerOnly||externalOnly?"Cuando te asignen trabajo aparecerá aquí.":"La jerarquía está lista. Usa Agregar para crear la primera orden."}</span></div>}</section>
  </>;
}
