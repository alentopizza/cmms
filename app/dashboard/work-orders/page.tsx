import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

type OrderRow={id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;requested_at:string};

export default async function WorkOrdersPage() {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"work_orders.read")) redirect("/dashboard");

  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"work_orders.write");
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
    <header className="page-header"><div><span className="eyebrow">Mantenimiento</span><h1 className="page-title">Órdenes de trabajo</h1><p className="muted">{providerOnly?"Solo ves trabajo asignado a tu empresa proveedora.":externalOnly?"Solo ves órdenes y actividades asignadas directamente a tu cuenta o cuadrilla.":requesterOnly?"Consulta y registra tus solicitudes de mantenimiento.":"Correctivos, preventivos, inspecciones y emergencias."}</p></div><div className="brand-pill"><span /> {orders.rowCount} órdenes</div></header>

    {canWrite && <section className="card section"><h2>{requesterOnly?"Nueva solicitud":"Nueva orden"}</h2>
      {assets.rows.length===0 ? <div className="setup-block"><strong>Primero registra un activo.</strong><span>Las órdenes necesitan un equipo previamente creado y relacionado con la estructura física.</span><Link className="button secondary" href="/dashboard/assets">Ir a activos</Link></div> :
      <form className="form-grid" method="post" action="/api/work-orders">
        <div className="field"><label>Equipo</label><select name="asset_id" required>{assets.rows.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
        <div className="field"><label>Título</label><input name="title" required placeholder="Revisar temperatura irregular"/></div>
        {!requesterOnly && <><div className="field"><label>Tipo</label><select name="type"><option value="corrective">Correctivo</option><option value="preventive">Preventivo</option><option value="inspection">Inspección</option><option value="emergency">Emergencia</option><option value="improvement">Mejora</option></select></div><div className="field"><label>Prioridad</label><select name="priority"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div></>}
        <div><button className="button" type="submit">{requesterOnly?"Enviar solicitud":"Crear orden"}</button></div>
      </form>}
    </section>}

    <section className="section"><table className="table"><thead><tr><th>OT</th><th>Trabajo</th><th>Empresa</th><th>Equipo</th><th>Prioridad</th><th>Estado</th><th></th></tr></thead><tbody>
      {orders.rows.map(w=><tr key={w.id}><td>#{w.number}</td><td><strong>{w.title}</strong></td><td>{w.company}</td><td>{w.asset}</td><td>{w.priority}</td><td><span className="status">{w.status}</span></td><td><Link className="text-button" href={"/dashboard/work-orders/"+w.id}>Actividades →</Link></td></tr>)}
    </tbody></table>{!orders.rowCount && <div className="card empty-state"><strong>No hay órdenes disponibles.</strong><span>{providerOnly||externalOnly?"Cuando te asignen trabajo aparecerá aquí.":"Crea la primera orden cuando exista un activo."}</span></div>}</section>
  </>;
}
