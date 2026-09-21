import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessSite, getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";

type Order={
  id:string;organization_id:string;site_id:string;number:string;title:string;description:string|null;
  status:string;priority:string;type:string;asset_name:string;asset_code:string;company_name:string;site_name:string;
};
type Activity={
  id:string;description:string;status:string;completed:boolean;assigned_name:string|null;crew_name:string|null;
  supplier_name:string|null;started_at:string|null;completed_at:string|null;notes:string|null;
};
type Worker={id:string;full_name:string;role:string;supplier_name:string|null};
type Crew={id:string;name:string};
type Supplier={id:string;name:string};

export default async function WorkOrderDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{created?:string;updated?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"work_orders.read")) redirect("/dashboard");
  const owner=isPlatformOwner(session);

  const [{id},feedback]=await Promise.all([params,searchParams]);

  const orderResult=await query<Order>(
    `SELECT w.id,w.organization_id,w.site_id,w.number::text,w.title,w.description,w.status,w.priority,w.type,
            a.name asset_name,a.code asset_code,o.name company_name,s.name site_name
     FROM work_orders w
     JOIN organizations o ON o.id=w.organization_id
     JOIN sites s ON s.id=w.site_id
     LEFT JOIN assets a ON a.id=w.asset_id
     WHERE w.id=$1`,
    [id],
  );
  if(!orderResult.rowCount) notFound();
  const order=orderResult.rows[0];

  if(session.platformRole==="user"){
    if(session.organizationId!==order.organization_id || !canAccessSite(session,order.site_id)) redirect("/dashboard/work-orders");
    if(session.role==="provider"){
      const visible=await query(
        `SELECT 1 FROM work_orders w
         WHERE w.id=$1 AND $2::uuid IS NOT NULL AND (
           w.service_supplier_id=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id=$2)
         )`,
        [id,session.externalSupplierId],
      );
      if(!visible.rowCount) redirect("/dashboard/work-orders");
    }
    if(session.role==="external"){
      const visible=await query(
        `SELECT 1 FROM work_orders w
         WHERE w.id=$1 AND (
           w.assigned_to=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (
             t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2)
           ))
         )`,
        [id,session.userId],
      );
      if(!visible.rowCount) redirect("/dashboard/work-orders");
    }
  }

  const [activities,workers,crews,suppliers]=await Promise.all([
    session.role === "provider"
      ? query<Activity>(
          `SELECT t.id,t.description,t.status,t.completed,u.full_name assigned_name,c.name crew_name,s.name supplier_name,
                  t.started_at::text,t.completed_at::text,t.notes
           FROM work_order_tasks t
           LEFT JOIN users u ON u.id=t.assigned_to
           LEFT JOIN crews c ON c.id=t.crew_id
           LEFT JOIN suppliers s ON s.id=t.service_supplier_id
           WHERE t.work_order_id=$1 AND t.service_supplier_id=$2
           ORDER BY t.sort_order,t.id`,
          [id,session.externalSupplierId],
        )
      : session.role === "external"
        ? query<Activity>(
            `SELECT t.id,t.description,t.status,t.completed,u.full_name assigned_name,c.name crew_name,s.name supplier_name,
                    t.started_at::text,t.completed_at::text,t.notes
             FROM work_order_tasks t
             LEFT JOIN users u ON u.id=t.assigned_to
             LEFT JOIN crews c ON c.id=t.crew_id
             LEFT JOIN suppliers s ON s.id=t.service_supplier_id
             WHERE t.work_order_id=$1 AND (
               t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2)
             )
             ORDER BY t.sort_order,t.id`,
            [id,session.userId],
          )
        : query<Activity>(
            `SELECT t.id,t.description,t.status,t.completed,u.full_name assigned_name,c.name crew_name,s.name supplier_name,
                    t.started_at::text,t.completed_at::text,t.notes
             FROM work_order_tasks t
             LEFT JOIN users u ON u.id=t.assigned_to
             LEFT JOIN crews c ON c.id=t.crew_id
             LEFT JOIN suppliers s ON s.id=t.service_supplier_id
             WHERE t.work_order_id=$1
             ORDER BY t.sort_order,t.id`,
            [id],
          ),
    query<Worker>(
      `SELECT u.id,u.full_name,om.role,s.name supplier_name
       FROM organization_members om JOIN users u ON u.id=om.user_id
       LEFT JOIN suppliers s ON s.id=om.external_supplier_id
       WHERE om.organization_id=$1 AND u.active=true AND om.role IN ('technician','external')
       ORDER BY u.full_name`,
      [order.organization_id],
    ),
    query<Crew>("SELECT id,name FROM crews WHERE organization_id=$1 AND active=true ORDER BY name",[order.organization_id]),
    query<Supplier>("SELECT id,name FROM suppliers WHERE organization_id=$1 AND active=true AND supplier_type IN ('services','both') ORDER BY name",[order.organization_id]),
  ]);

  const setup=await getSetupState(order.organization_id);
  const gate=gateFor(setup,"activity");
  const canManage=can(session,"activities.manage");
  const canExecute=can(session,"activities.execute");

  const message=feedback.error==="sequence" ? "Primero completa activos y personal ejecutor antes de crear actividades."
    : feedback.error==="executor" ? "Selecciona un único responsable: persona, cuadrilla o proveedor de servicios."
    : feedback.error ? "No fue posible completar la acción." : "";

  return <>
    <header className="page-header">
      <div><Link className="back-link" href="/dashboard/work-orders">← Órdenes de trabajo</Link><span className="eyebrow">OT #{order.number}</span><h1 className="page-title">{order.title}</h1><p className="muted">{order.company_name} · {order.site_name} · {order.asset_code} {order.asset_name}</p></div>
      <span className="status">{order.status}</span>
    </header>

    {feedback.created && <div className="notice success section">Actividad creada correctamente.</div>}
    {feedback.updated && <div className="notice success section">Actividad actualizada.</div>}
    {message && <div className="notice error section">{message}</div>}

    <section className="card section work-order-overview">
      <div><span>Tipo</span><strong>{order.type}</strong></div><div><span>Prioridad</span><strong>{order.priority}</strong></div><div><span>Estado</span><strong>{order.status}</strong></div><div><span>Actividades</span><strong>{activities.rowCount}</strong></div>
    </section>

    {canManage && <section className="card section setup-flow-card">
      <div className="setup-flow-head"><div><span className="eyebrow">Secuencia obligatoria</span><h2>Actividades con ejecutor definido</h2></div><span className={"setup-flow-state "+(gate.ready?"ready":"blocked")}>{gate.ready?"Habilitado":"Paso pendiente"}</span></div>
      <div className="setup-flow-steps"><span className="done"><b>1</b> Empresa</span><span className="done"><b>2</b> Estructura</span><span className="done"><b>3</b> Proveedor</span><span className="done"><b>4</b> Activo</span><span className={gate.ready?"done":""}><b>5</b> Personal</span><span className={gate.ready?"active":""}><b>6</b> Actividad</span></div>
      {!gate.ready && gate.href && <Link className="button secondary" href={gate.href}>{gate.action}</Link>}
    </section>}

    {canManage && gate.ready && <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Nueva actividad</span><h2>Definir trabajo y responsable</h2><p className="muted">Asigna la actividad a una persona, una cuadrilla o directamente a un proveedor de servicios.</p></div></div>
      <form className="form-grid" method="post" action={"/api/work-orders/"+order.id+"/activities"}>
        <input type="hidden" name="intent" value="create"/>
        <div className="field form-span-2"><label>Actividad *</label><input name="description" required placeholder="Ej. Revisar presión, limpiar serpentín y registrar lectura"/></div>
        <div className="field"><label>Persona responsable</label><select name="assigned_to"><option value="">Sin asignar</option>{workers.rows.map(w=><option key={w.id} value={w.id}>{w.full_name} · {w.role==="external"?"Externo · "+(w.supplier_name||"Proveedor"):"Técnico"}</option>)}</select></div>
        <div className="field"><label>Cuadrilla</label><select name="crew_id"><option value="">Sin cuadrilla</option>{crews.rows.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>Proveedor de servicios</label><select name="service_supplier_id"><option value="">Sin proveedor</option>{suppliers.rows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label>Notas iniciales</label><input name="notes" placeholder="Indicaciones, alcance o condición de seguridad"/></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Crear actividad</button></div>
      </form>
    </section>}

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Ejecución</span><h2>Actividades de la orden</h2></div></div>
      {activities.rowCount ? <div className="activity-grid">{activities.rows.map((activity,index)=><article className="card activity-card" key={activity.id}>
        <div className="activity-card-head"><span className="activity-number">{String(index+1).padStart(2,"0")}</span><div><strong>{activity.description}</strong><span>{activity.assigned_name || activity.crew_name || activity.supplier_name || "Sin responsable"}</span></div><span className={"activity-status activity-status-"+activity.status}>{activity.status}</span></div>
        {activity.notes && <p>{activity.notes}</p>}
        <div className="activity-meta"><span>Inicio: {activity.started_at?new Date(activity.started_at).toLocaleString("es-CO"):"Pendiente"}</span><span>Fin: {activity.completed_at?new Date(activity.completed_at).toLocaleString("es-CO"):"Pendiente"}</span></div>
        {canExecute && <form className="activity-update-form" method="post" action={"/api/work-orders/"+order.id+"/activities"}>
          <input type="hidden" name="intent" value="update"/><input type="hidden" name="activity_id" value={activity.id}/>
          <select name="status" defaultValue={activity.status}><option value="pending">Pendiente</option><option value="in_progress">En ejecución</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select>
          <input name="notes" defaultValue={activity.notes||""} placeholder="Observación de ejecución"/>
          <button className="button secondary" type="submit">Actualizar</button>
        </form>}
        {owner&&<div className="owner-inline-row"><OwnerDeleteButton table="work_order_tasks" id={activity.id} label={activity.description} /></div>}
      </article>)}</div> : <div className="card empty-state"><strong>Aún no hay actividades.</strong><span>Define el trabajo, el responsable y luego registra su ejecución.</span></div>}
    </section>
  </>;
}
