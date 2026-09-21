import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel } from "@/lib/permissions";
import { query } from "@/lib/db";

type C={count:string};
type Card={label:string;value:string;hint:string;icon:string;tone?:"default"|"success"|"warning"|"danger";href?:string};
type B={key:string;label:string;count:number};
const n=(v:string|number|null|undefined)=>Number(v||0);
const pct=(v:number,t:number)=>t>0?Math.round(v/t*100):0;
const money=(v:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(v);
const hrs=(v:number)=>new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(v)+" h";

function Kpi({x}:{x:Card}) {
  const body=<article className={"dashboard-kpi dashboard-kpi-"+(x.tone||"default")}><div className="dashboard-kpi-icon">{x.icon}</div><div className="dashboard-kpi-copy"><span>{x.label}</span><strong>{x.value}</strong><small>{x.hint}</small></div></article>;
  return x.href?<Link className="dashboard-kpi-link" href={x.href}>{body}</Link>:body;
}
function Bars({rows}:{rows:B[]}) {
  const total=rows.reduce((s,r)=>s+r.count,0);
  return <div className="dashboard-progress-list">{rows.map(r=>{const p=pct(r.count,total);return <div className="dashboard-progress-row" key={r.key}><div><strong>{r.label}</strong><span>{r.count}</span></div><div className="dashboard-progress-track"><span style={{width:String(p)+"%"}}/></div><small>{p}%</small></div>})}</div>;
}
function Panel({eyebrow,title,children,action}:{eyebrow:string;title:string;children:React.ReactNode;action?:React.ReactNode}) {
  return <section className="card dashboard-panel"><header className="dashboard-panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</header>{children}</section>;
}
function Empty({children}:{children:React.ReactNode}){return <div className="dashboard-empty">{children}</div>}
function Status({value}:{value:string}){return <span className={"dashboard-status dashboard-status-"+value}>{value.replaceAll("_"," ")}</span>}
function Frame({role,title,subtitle,cards,children}:{role:string;title:string;subtitle:string;cards:Card[];children:React.ReactNode}) {
  return <div className="role-dashboard"><section className="dashboard-intro"><div><span className="eyebrow">{role}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="dashboard-period"><span>Periodo</span><strong>Mes actual</strong></div></section><section className="dashboard-kpi-grid">{cards.map(x=><Kpi key={x.label} x={x}/>)}</section>{children}</div>;
}

async function platform(session:NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const owner=session.platformRole==="platform_owner";
  const [companies,paid,trials,pastDue,mrr,plans,leads,recent,openWo,down]=await Promise.all([
    query<C>("SELECT count(*)::text count FROM organizations WHERE active=true"),
    query<C>("SELECT count(*)::text count FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id WHERE s.status='active' AND p.code<>'trial'"),
    query<C>("SELECT count(*)::text count FROM organization_subscriptions WHERE status='trialing'"),
    query<C>("SELECT count(*)::text count FROM organization_subscriptions WHERE status='past_due'"),
    query<{amount:string}>("SELECT COALESCE(sum(COALESCE(p.monthly_price_cop,0)),0)::text amount FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id WHERE s.status='active' AND p.code<>'trial'"),
    query<{code:string;name:string;count:string}>("SELECT p.code,p.name,count(*)::text count FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id WHERE s.status IN ('active','trialing') GROUP BY p.code,p.name,p.sort_order ORDER BY p.sort_order"),
    query<{status:string;count:string}>("SELECT status,count(*)::text count FROM sales_leads WHERE created_at>=now()-interval '90 days' GROUP BY status ORDER BY status"),
    query<{id:string;name:string;plan:string;status:string;period_end:string|null}>("SELECT o.id,o.name,p.name plan,s.status,s.current_period_end::text period_end FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id JOIN billing_plans p ON p.id=s.plan_id ORDER BY s.updated_at DESC LIMIT 8"),
    query<C>("SELECT count(*)::text count FROM work_orders WHERE status IN ('open','assigned','in_progress','paused')"),
    query<C>("SELECT count(*)::text count FROM assets WHERE status='down'"),
  ]);
  const planRows=plans.rows.map(r=>({key:r.code,label:r.name,count:n(r.count)}));
  const labels:Record<string,string>={new:"Nuevos",contacted:"Contactados",qualified:"Calificados",closed:"Cerrados",discarded:"Descartados"};
  const leadRows=leads.rows.map(r=>({key:r.status,label:labels[r.status]||r.status,count:n(r.count)}));
  const leadTotal=leadRows.reduce((s,r)=>s+r.count,0), closed=leadRows.find(r=>r.key==="closed")?.count||0;
  const cards:Card[]=owner?[
    {label:"Planes vendidos",value:paid.rows[0]?.count||"0",hint:"Suscripciones pagas activas",icon:"▣",tone:"success",href:"/dashboard/companies"},
    {label:"MRR estimado",value:money(n(mrr.rows[0]?.amount)),hint:"Según tarifas mensuales configuradas",icon:"$",tone:"success"},
    {label:"Empresas activas",value:companies.rows[0]?.count||"0",hint:"Clientes habilitados",icon:"◫",href:"/dashboard/companies"},
    {label:"Leads 90 días",value:String(leadTotal),hint:String(closed)+" cerrados · "+String(pct(closed,leadTotal))+"% conversión",icon:"✦",href:"/dashboard/leads"},
  ]:[
    {label:"Empresas activas",value:companies.rows[0]?.count||"0",hint:"Clientes habilitados",icon:"◫",href:"/dashboard/companies"},
    {label:"Pruebas activas",value:trials.rows[0]?.count||"0",hint:"Organizaciones en trial",icon:"◷",tone:"warning"},
    {label:"Pago pendiente",value:pastDue.rows[0]?.count||"0",hint:"Suscripciones con alerta",icon:"!",tone:"danger"},
    {label:"OT abiertas",value:openWo.rows[0]?.count||"0",hint:(down.rows[0]?.count||"0")+" activos detenidos",icon:"✓",href:"/dashboard/work-orders"},
  ];
  return <Frame role={owner?"Propietario Desweb":"Superadministrador"} title={owner?"Control de negocio y plataforma":"Operación global de la plataforma"} subtitle={owner?"Ventas, suscripciones, crecimiento y salud de Desweb CMMS.":"Clientes, suscripciones y operación que requieren seguimiento administrativo."} cards={cards}>
    <div className="dashboard-layout-main"><Panel eyebrow="Suscripciones" title="Distribución de planes">{planRows.length?<Bars rows={planRows}/>:<Empty>Aún no hay suscripciones.</Empty>}</Panel><Panel eyebrow="Comercial" title="Embudo de leads · 90 días" action={<Link className="text-button" href="/dashboard/leads">Ver leads →</Link>}>{leadRows.length?<Bars rows={leadRows}/>:<Empty>No hay leads recientes.</Empty>}</Panel></div>
    <Panel eyebrow="Clientes" title="Suscripciones recientes"><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Periodo</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/companies/"+r.id}>{r.name}</Link></td><td>{r.plan}</td><td><Status value={r.status}/></td><td>{r.period_end?new Date(r.period_end).toLocaleDateString("es-CO"):"—"}</td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

function scope(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,alias:string) {
  return session.accessAllSites?{sql:alias+".organization_id=$1",params:[session.organizationId]}:{sql:alias+".organization_id=$1 AND "+alias+".site_id=ANY($2::uuid[])",params:[session.organizationId,session.siteIds]};
}
async function operation(session:NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  if(!session.organizationId)return null;
  const w=scope(session,"w"),a=scope(session,"a"),org=session.organizationId;
  const [assets,open,done,late,due,stock,techs,impact,statuses,recent]=await Promise.all([
    can(session,"assets.read")?query<C>("SELECT count(*)::text count FROM assets a WHERE "+a.sql+" AND a.status<>'retired'",a.params):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<C>("SELECT count(*)::text count FROM work_orders w WHERE "+w.sql+" AND w.status IN ('open','assigned','in_progress','paused')",w.params):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<C>("SELECT count(*)::text count FROM work_orders w WHERE "+w.sql+" AND w.status='completed' AND w.completed_at>=date_trunc('month',now())",w.params):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<C>("SELECT count(*)::text count FROM work_orders w WHERE "+w.sql+" AND w.due_at<now() AND w.status NOT IN ('completed','cancelled')",w.params):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"maintenance.read")?query<C>("SELECT count(*)::text count FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id WHERE "+a.sql+" AND p.active=true AND p.next_due_at IS NOT NULL AND p.next_due_at<=now()+interval '7 days'",a.params):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"inventory.read")?query<C>("SELECT count(*)::text count FROM inventory_items WHERE organization_id=$1 AND active=true AND quantity<=min_quantity",[org]):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"users.manage")?query<C>("SELECT count(*)::text count FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND u.active=true AND om.role IN ('technician','external')",[org]):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<{cost:string;downtime:string}>("SELECT COALESCE(sum(labor_cost+parts_cost+external_cost),0)::text cost,COALESCE(sum(downtime_minutes),0)::text downtime FROM work_orders w WHERE "+w.sql+" AND w.created_at>=date_trunc('month',now())",w.params):Promise.resolve({rows:[{cost:"0",downtime:"0"}]} as any),
    can(session,"work_orders.read")?query<{status:string;count:string}>("SELECT status,count(*)::text count FROM work_orders w WHERE "+w.sql+" AND w.created_at>=now()-interval '90 days' GROUP BY status",w.params):Promise.resolve({rows:[]} as any),
    can(session,"work_orders.read")?query<{id:string;number:string;title:string;status:string;priority:string;asset:string|null}>("SELECT w.id,w.number::text,w.title,w.status,w.priority,a.name asset FROM work_orders w LEFT JOIN assets a ON a.id=w.asset_id WHERE "+w.sql+" ORDER BY w.updated_at DESC LIMIT 8",w.params):Promise.resolve({rows:[]} as any),
  ]);
  const role=session.role, cards:Card[]=[
    {label:"Activos visibles",value:assets.rows[0]?.count||"0",hint:"Equipos activos en tu alcance",icon:"◇",href:"/dashboard/assets"},
    {label:"OT abiertas",value:open.rows[0]?.count||"0",hint:(late.rows[0]?.count||"0")+" vencidas",icon:"✓",tone:n(late.rows[0]?.count)>0?"warning":"default",href:"/dashboard/work-orders"},
    {label:"Completadas este mes",value:done.rows[0]?.count||"0",hint:"Órdenes cerradas",icon:"✓",tone:"success"},
    {label:"Preventivos próximos",value:due.rows[0]?.count||"0",hint:"Próximos 7 días",icon:"↻",tone:n(due.rows[0]?.count)>0?"warning":"default",href:"/dashboard/maintenance"},
  ];
  if(role==="admin")cards[3]={label:"Equipo técnico",value:techs.rows[0]?.count||"0",hint:(stock.rows[0]?.count||"0")+" artículos bajo mínimo",icon:"◎",href:"/dashboard/users"};
  if(role==="manager")cards[3]={label:"Costo del mes",value:money(n(impact.rows[0]?.cost)),hint:hrs(n(impact.rows[0]?.downtime)/60)+" indisponibilidad",icon:"$",tone:"warning"};
  if(role==="viewer")cards[3]={label:"Inventario crítico",value:stock.rows[0]?.count||"0",hint:"En o bajo el mínimo",icon:"▤",tone:n(stock.rows[0]?.count)>0?"warning":"default"};
  const names:Record<string,string>={open:"Abiertas",assigned:"Asignadas",in_progress:"En progreso",paused:"Pausadas",completed:"Completadas",cancelled:"Canceladas"};
  const rows=statuses.rows.map((r:{status:string;count:string})=>({key:r.status,label:names[r.status]||r.status,count:n(r.count)}));
  return <Frame role={roleLabel(session)} title={role==="admin"?"Salud operativa de la empresa":role==="manager"?"Control de mantenimiento":"Indicadores operativos"} subtitle={"Información de "+(session.organizationName||"tu organización")+" dentro de tu alcance autorizado."} cards={cards}>
    <div className="dashboard-layout-main"><Panel eyebrow="Órdenes de trabajo" title="Distribución · 90 días">{rows.length?<Bars rows={rows}/>:<Empty>No hay órdenes recientes.</Empty>}</Panel><Panel eyebrow="Costos y continuidad" title="Impacto del mes"><div className="dashboard-impact-grid"><div><span>Costo mantenimiento</span><strong>{money(n(impact.rows[0]?.cost))}</strong><small>Mano de obra + repuestos + externos</small></div><div><span>Indisponibilidad</span><strong>{hrs(n(impact.rows[0]?.downtime)/60)}</strong><small>Downtime acumulado</small></div><div><span>Inventario bajo mínimo</span><strong>{stock.rows[0]?.count||"0"}</strong><small>Requiere revisión</small></div></div></Panel></div>
    <Panel eyebrow="Actividad reciente" title="Últimas órdenes actualizadas" action={<Link className="text-button" href="/dashboard/work-orders">Ver órdenes →</Link>}><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Trabajo</th><th>Activo</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>{recent.rows.map((r:{id:string;number:string;title:string;status:string;priority:string;asset:string|null})=><tr key={r.id}><td><Link href={"/dashboard/work-orders/"+r.id}>#{r.number}</Link></td><td>{r.title}</td><td>{r.asset||"—"}</td><td>{r.priority}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

async function field(session:NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  if(!session.userId||!session.organizationId)return null;
  const provider=session.role==="provider", sid=session.externalSupplierId, org=session.organizationId, uid=session.userId;
  const pred=provider&&sid?"t.organization_id=$1 AND t.service_supplier_id=$2":"t.organization_id=$1 AND (t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2))";
  const params=provider&&sid?[org,sid]:[org,uid];
  const [pending,progress,done,exec,worked,recent,shift]=await Promise.all([
    query<C>("SELECT count(*)::text count FROM work_order_tasks t WHERE "+pred+" AND t.status='pending'",params),
    query<C>("SELECT count(*)::text count FROM work_order_tasks t WHERE "+pred+" AND t.status='in_progress'",params),
    query<C>("SELECT count(*)::text count FROM work_order_tasks t WHERE "+pred+" AND t.status='completed' AND t.completed_at>=date_trunc('month',now())",params),
    provider?Promise.resolve({rows:[{total:"0",inside:"0"}]} as any):query<{total:string;inside:string}>("SELECT count(*)::text total,count(*) FILTER(WHERE within_shift=true)::text inside FROM activity_execution_events WHERE organization_id=$1 AND user_id=$2 AND event_type='completed' AND occurred_at>=date_trunc('month',now())",[org,uid]),
    provider?Promise.resolve({rows:[{hours:"0"}]} as any):query<{hours:string}>("SELECT COALESCE(sum(EXTRACT(EPOCH FROM(COALESCE(check_out_at,now())-check_in_at))/3600),0)::numeric(12,1)::text hours FROM attendance_shifts WHERE organization_id=$1 AND user_id=$2 AND check_in_at>=date_trunc('month',now())",[org,uid]),
    query<{id:string;description:string;status:string;wo:string;number:string;title:string}>("SELECT t.id,t.description,t.status,w.id wo,w.number::text,w.title FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+pred+" ORDER BY COALESCE(t.completed_at,t.started_at,w.updated_at) DESC LIMIT 8",params),
    provider?Promise.resolve({rows:[]} as any):query<{site:string}>("SELECT s.name site FROM attendance_shifts sh JOIN sites s ON s.id=sh.site_id WHERE sh.organization_id=$1 AND sh.user_id=$2 AND sh.status='open' LIMIT 1",[org,uid]),
  ]);
  const total=n(exec.rows[0]?.total), inside=n(exec.rows[0]?.inside);
  const cards:Card[]=[
    {label:"Completadas este mes",value:done.rows[0]?.count||"0",hint:"Actividades ejecutadas",icon:"✓",tone:"success"},
    {label:"Pendientes",value:pending.rows[0]?.count||"0",hint:"Por iniciar",icon:"○",tone:n(pending.rows[0]?.count)>0?"warning":"default"},
    {label:"En progreso",value:progress.rows[0]?.count||"0",hint:"Actualmente abiertas",icon:"▶"},
    provider?{label:"Carga activa",value:String(n(pending.rows[0]?.count)+n(progress.rows[0]?.count)),hint:"Asignaciones del proveedor",icon:"▣"}:{label:"Productividad validada",value:String(pct(inside,total))+"%",hint:String(inside)+"/"+String(total)+" dentro del turno",icon:"◎",tone:"success"},
  ];
  return <Frame role={roleLabel(session)} title={provider?"Ejecución del proveedor":"Mi productividad"} subtitle={provider?"Trabajo asignado al proveedor y avance de ejecución.":"Actividades, asistencia y rendimiento del periodo actual."} cards={cards}>
    <div className="dashboard-layout-main">{!provider&&<Panel eyebrow="Asistencia" title="Tiempo registrado este mes"><div className="dashboard-worker-focus"><strong>{hrs(n(worked.rows[0]?.hours))}</strong><span>{shift.rows[0]?"Turno abierto · "+shift.rows[0].site:"Sin turno abierto actualmente"}</span></div></Panel>}<Panel eyebrow="Productividad" title={provider?"Carga de trabajo":"Cumplimiento dentro del turno"}><div className="dashboard-donut-like"><strong>{provider?done.rows[0]?.count||"0":String(pct(inside,total))+"%"}</strong><span>{provider?"completadas este mes":"validación de horario"}</span></div></Panel></div>
    <Panel eyebrow="Trabajo reciente" title="Mis actividades" action={<Link className="text-button" href="/dashboard/work-orders">Ver órdenes →</Link>}><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Actividad</th><th>Orden</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/work-orders/"+r.wo}>#{r.number}</Link></td><td>{r.description}</td><td>{r.title}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

async function requester(session:NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  if(!session.userId||!session.organizationId)return null;
  const [open,done,avg,recent]=await Promise.all([
    query<C>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND status IN ('open','assigned','in_progress','paused')",[session.organizationId,session.userId]),
    query<C>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND status='completed' AND completed_at>=date_trunc('month',now())",[session.organizationId,session.userId]),
    query<{hours:string}>("SELECT COALESCE(avg(EXTRACT(EPOCH FROM(completed_at-requested_at))/3600),0)::numeric(12,1)::text hours FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND status='completed' AND completed_at>=now()-interval '90 days'",[session.organizationId,session.userId]),
    query<{id:string;number:string;title:string;status:string;requested_at:string}>("SELECT id,number::text,title,status,requested_at::text FROM work_orders WHERE organization_id=$1 AND requested_by=$2 ORDER BY requested_at DESC LIMIT 8",[session.organizationId,session.userId]),
  ]);
  const total=n(open.rows[0]?.count)+n(done.rows[0]?.count);
  return <Frame role="Solicitante" title="Mis solicitudes" subtitle="Seguimiento de mantenimiento y tiempos de resolución." cards={[
    {label:"Abiertas",value:open.rows[0]?.count||"0",hint:"Pendientes de cierre",icon:"○",tone:n(open.rows[0]?.count)>0?"warning":"default",href:"/dashboard/work-orders"},
    {label:"Cerradas este mes",value:done.rows[0]?.count||"0",hint:"Solicitudes completadas",icon:"✓",tone:"success"},
    {label:"Tiempo medio",value:hrs(n(avg.rows[0]?.hours)),hint:"Resolución últimos 90 días",icon:"◷"},
    {label:"Resolución",value:String(pct(n(done.rows[0]?.count),total))+"%",hint:"Cerradas frente a abiertas",icon:"◎"},
  ]}><Panel eyebrow="Seguimiento" title="Solicitudes recientes"><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Solicitud</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/work-orders/"+r.id}>#{r.number}</Link></td><td>{r.title}</td><td>{new Date(r.requested_at).toLocaleDateString("es-CO")}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div></Panel></Frame>;
}

export default async function Dashboard(){
  const session=await getSession();
  if(!session)redirect("/login");
  if(session.platformRole==="platform_owner"||session.platformRole==="superadmin")return platform(session);
  if(session.role==="technician"||session.role==="external"||session.role==="provider")return field(session);
  if(session.role==="requester")return requester(session);
  return operation(session);
}
