import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessSite, getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Button } from "@/components/ui-kit/Button";
import { Card } from "@/components/ui-kit/Card";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { ProgressBar, StepProgress, Timeline } from "@/components/ui-kit/TimelineProgress";
import { ActivityStatusBadge, PriorityBadge, WorkOrderStatusBadge } from "@/components/maintenance-ui/OperationStatus";
import { Badge } from "@/components/ui-kit/Badge";
import UiIcon from "@/components/UiIcon";

type Order={
  id:string;organization_id:string;site_id:string;number:string;title:string;description:string|null;
  status:string;priority:string;type:string;asset_name:string;asset_code:string;company_name:string;site_name:string;timezone:string;requested_at:string;
};
type Activity={
  id:string;description:string;status:string;completed:boolean;assigned_name:string|null;crew_name:string|null;
  supplier_name:string|null;started_at:string|null;completed_at:string|null;notes:string|null;due_date:string|null;
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
    `SELECT w.id,w.organization_id,w.site_id,w.number::text,w.title,w.description,w.status,w.priority,w.type,w.requested_at::text,
            a.name asset_name,a.code asset_code,o.name company_name,s.name site_name,o.timezone
     FROM work_orders w
     JOIN organizations o ON o.id=w.organization_id
     JOIN sites s ON s.id=w.site_id
     LEFT JOIN assets a ON a.id=w.asset_id
     WHERE w.id=$1`,
    [id],
  );
  if(!orderResult.rowCount) notFound();
  const order=orderResult.rows[0];

  if(!canAccessOrganization(session,order.organization_id)) redirect("/dashboard/work-orders");
  if(session.platformRole==="user"){
    if(!canAccessSite(session,order.site_id)) redirect("/dashboard/work-orders");
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
                  t.started_at::text,t.completed_at::text,t.notes,t.due_date::text
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
                    t.started_at::text,t.completed_at::text,t.notes,t.due_date::text
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
                    t.started_at::text,t.completed_at::text,t.notes,t.due_date::text
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
  const totalActivities=activities.rows.length;
  const completedActivities=activities.rows.filter(activity=>activity.status==="completed").length;
  const inProgressActivities=activities.rows.filter(activity=>activity.status==="in_progress").length;
  const pendingActivities=activities.rows.filter(activity=>activity.status==="pending").length;
  const completionPercent=totalActivities?Math.round(completedActivities/totalActivities*100):0;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:order.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const overdueActivities=activities.rows.filter(activity=>activity.due_date&&activity.due_date<today&&!["completed","cancelled"].includes(activity.status)).length;
  const phaseIndex=order.status==="open"?0:order.status==="assigned"?1:["in_progress","paused"].includes(order.status)?2:order.status==="completed"?3:0;
  const processSteps=["Solicitud","Asignación","Ejecución","Cierre"].map((label,index)=>({
    id:String(index+1),label,
    description:index===0?"OT registrada":index===1?"Responsable definido":index===2?"Actividades en campo":"Orden completada",
    status:(order.status==="completed"||index<phaseIndex?"complete":index===phaseIndex?"current":"upcoming") as "complete"|"current"|"upcoming",
  }));
  const timelineItems=[
    {id:"request",title:"OT registrada",description:order.title,meta:new Date(order.requested_at).toLocaleString("es-CO"),icon:"work-order" as const,tone:"brand" as const},
    ...activities.rows.flatMap(activity=>{
      const events=[];
      if(activity.started_at)events.push({id:activity.id+"-start",title:"Actividad iniciada",description:activity.description,meta:new Date(activity.started_at).toLocaleString("es-CO"),icon:"activity" as const,tone:"info" as const});
      if(activity.completed_at)events.push({id:activity.id+"-complete",title:"Actividad completada",description:activity.description,meta:new Date(activity.completed_at).toLocaleString("es-CO"),icon:"check" as const,tone:"success" as const});
      return events;
    }),
  ];

  return <div className="phase9-work-order-detail">
    <header className="page-header">
      <div><Link className="back-link" href="/dashboard/work-orders">← Órdenes de trabajo</Link><span className="eyebrow">OT #{order.number}</span><h1 className="page-title">{order.title}</h1><p className="muted">{order.company_name} · {order.site_name} · {order.asset_code} {order.asset_name}</p></div>
      <div className="phase9-order-head-badges"><PriorityBadge priority={order.priority}/><WorkOrderStatusBadge status={order.status}/></div>
    </header>

    {(feedback.created||feedback.updated)&&<div className="section phase9-feedback-stack">
      {feedback.created&&<Alert variant="success" title="Actividad creada">Actividad creada correctamente.</Alert>}
      {feedback.updated&&<Alert variant="success" title="Actividad actualizada">La ejecución de la actividad quedó actualizada.</Alert>}
    </div>}
    {message&&<div className="section"><Alert variant="danger" title="No fue posible completar la acción">{message}</Alert></div>}

    <MetricGrid className="section phase9-kpi-grid">
      <KpiCard label="Actividades" value={String(totalActivities)} hint="trabajo definido" icon="activity"/>
      <KpiCard label="En ejecución" value={String(inProgressActivities)} hint="actividades iniciadas" icon="clock" tone={inProgressActivities?"info":"default"}/>
      <KpiCard label="Completadas" value={String(completedActivities)} hint={completionPercent+"% del total"} icon="check" tone="success"/>
      <KpiCard label="Vencidas" value={String(overdueActivities)} hint="compromiso superado" icon="warning" tone={overdueActivities?"danger":"success"}/>
    </MetricGrid>

    <section className="section phase9-order-process-grid">
      <Card header={<div><span className="eyebrow">Flujo de OT</span><h2>Estado del proceso</h2></div>}>
        <StepProgress steps={processSteps}/>
      </Card>
      <Card header={<div><span className="eyebrow">Avance</span><h2>Ejecución de actividades</h2></div>}>
        <ProgressBar value={completedActivities} max={Math.max(totalActivities,1)} tone={completionPercent>=100?"success":overdueActivities?"warning":"brand"} label="Actividades completadas" caption={pendingActivities+" pendientes · "+inProgressActivities+" en ejecución"}/>
        <div className="phase9-order-facts">
          <span><small>Tipo</small><strong>{order.type}</strong></span>
          <span><small>Activo</small><strong>{order.asset_code} · {order.asset_name}</strong></span>
          <span><small>Sede</small><strong>{order.site_name}</strong></span>
        </div>
      </Card>
    </section>

    {canManage && <section className="card section setup-flow-card">
      <div className="setup-flow-head"><div><span className="eyebrow">Secuencia obligatoria</span><h2>Actividades con ejecutor definido</h2></div><Badge variant={gate.ready?"success":"warning"}>{gate.ready?"Habilitado":"Paso pendiente"}</Badge></div>
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
        <div className="field"><label>Fecha compromiso *</label><input type="date" name="due_date" required defaultValue={new Intl.DateTimeFormat("en-CA",{timeZone:order.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}/></div>
        <div className="field"><label>Notas iniciales</label><input name="notes" placeholder="Indicaciones, alcance o condición de seguridad"/></div>
        <div className="form-span-2 form-actions"><Button type="submit" iconLeft="plus">Crear actividad</Button></div>
      </form>
    </section>}

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Ejecución</span><h2>Actividades de la orden</h2></div></div>
      {activities.rowCount ? <div className="activity-grid phase9-activity-grid">{activities.rows.map((activity,index)=>{
        const overdue=Boolean(activity.due_date&&activity.due_date<today&&!["completed","cancelled"].includes(activity.status));
        return <Card className={"activity-card phase9-activity-card"+(overdue?" overdue":"")} key={activity.id}>
          <div className="activity-card-head">
            <span className="activity-number">{String(index+1).padStart(2,"0")}</span>
            <div><strong>{activity.description}</strong><span>{activity.assigned_name || activity.crew_name || activity.supplier_name || "Sin responsable"}</span></div>
            <div className="phase9-activity-status">{overdue&&<Badge variant="danger" icon="warning">Vencida</Badge>}<ActivityStatusBadge status={activity.status}/></div>
          </div>
          {activity.notes&&<p>{activity.notes}</p>}
          <div className="activity-meta">
            <span><UiIcon name="clock" size={13}/> Compromiso: {activity.due_date?new Date(activity.due_date+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha"}</span>
            <span><UiIcon name="activity" size={13}/> Inicio: {activity.started_at?new Date(activity.started_at).toLocaleString("es-CO"):"Pendiente"}</span>
            <span><UiIcon name="check" size={13}/> Fin: {activity.completed_at?new Date(activity.completed_at).toLocaleString("es-CO"):"Pendiente"}</span>
          </div>
          {canExecute&&<form className="activity-update-form" method="post" action={"/api/work-orders/"+order.id+"/activities"}>
            <input type="hidden" name="intent" value="update"/><input type="hidden" name="activity_id" value={activity.id}/>
            <label><span className="sr-only">Estado de {activity.description}</span><select name="status" defaultValue={activity.status}><option value="pending">Pendiente</option><option value="in_progress">En ejecución</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></label>
            <input name="notes" defaultValue={activity.notes||""} placeholder="Observación de ejecución"/>
            <Button type="submit" variant="secondary" iconLeft="check">Actualizar</Button>
          </form>}
          {owner&&<div className="owner-inline-row"><OwnerDeleteButton table="work_order_tasks" id={activity.id} label={activity.description}/></div>}
        </Card>;
      })}</div>:<EmptyState icon="file" title="Aún no hay actividades" description="Define el trabajo, el responsable y luego registra su ejecución."/>}
    </section>

    <section className="section">
      <Card header={<div><span className="eyebrow">Trazabilidad</span><h2>Timeline de la orden</h2></div>}>
        <Timeline items={timelineItems} label={"Historial de OT "+order.number}/>
      </Card>
    </section>
  </div>;
}
