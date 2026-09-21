import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel } from "@/lib/permissions";
import { query } from "@/lib/db";
import DashboardControls from "@/components/DashboardControls";
import {
  appendCompanyStatus,
  appendPeriod,
  appendValue,
  parseDashboardFilters,
  type DashboardFilterInput,
  type DashboardFilters,
} from "@/lib/dashboard-filters";

type C={count:string};
type Card={label:string;value:string;hint:string;icon:string;tone?:"default"|"success"|"warning"|"danger";href?:string};
type B={key:string;label:string;count:number};
type Option={value:string;label:string};

const n=(v:string|number|null|undefined)=>Number(v||0);
const pct=(v:number,t:number)=>t>0?Math.round(v/t*100):0;
const money=(v:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(v);
const hrs=(v:number)=>new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(v)+" h";

const WORK_ORDER_STATUS_OPTIONS:Option[]=[
  {value:"open",label:"Abiertas"},{value:"assigned",label:"Asignadas"},{value:"in_progress",label:"En progreso"},
  {value:"paused",label:"Pausadas"},{value:"completed",label:"Completadas"},{value:"cancelled",label:"Canceladas"},
];
const TASK_STATUS_OPTIONS:Option[]=[
  {value:"pending",label:"Pendientes"},{value:"in_progress",label:"En progreso"},
  {value:"completed",label:"Completadas"},{value:"cancelled",label:"Canceladas"},
];
const SUBSCRIPTION_STATUS_OPTIONS:Option[]=[
  {value:"active",label:"Activas"},{value:"trialing",label:"Prueba"},
  {value:"past_due",label:"Pago pendiente"},{value:"suspended",label:"Suspendidas"},
  {value:"canceled",label:"Canceladas"},{value:"trial_expired",label:"Prueba vencida"},
];

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
function Frame({
  role,title,subtitle,cards,children,filters,mode,companyStatusOptions,activityStatusOptions,
}:{
  role:string;title:string;subtitle:string;cards:Card[];children:React.ReactNode;filters:DashboardFilters;
  mode:"platform"|"operation"|"field"|"requester";companyStatusOptions?:Option[];activityStatusOptions?:Option[];
}) {
  return <div className="role-dashboard">
    <section className="dashboard-intro">
      <div><span className="eyebrow">{role}</span><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="dashboard-period"><span>Periodo</span><strong>{filters.label}</strong></div>
    </section>
    <DashboardControls mode={mode} companyStatusOptions={companyStatusOptions} activityStatusOptions={activityStatusOptions}/>
    <section className="dashboard-kpi-grid">{cards.map(x=><Kpi key={x.label} x={x}/>)}</section>
    {children}
  </div>;
}

function scope(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,alias:string) {
  return session.accessAllSites
    ? {sql:alias+".organization_id=$1",params:[session.organizationId] as unknown[]}
    : {sql:alias+".organization_id=$1 AND "+alias+".site_id=ANY($2::uuid[])",params:[session.organizationId,session.siteIds] as unknown[]};
}

async function platform(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:DashboardFilters) {
  const owner=session.platformRole==="platform_owner";
  const orgParams:unknown[]=[];
  const companyStatus=appendCompanyStatus(orgParams,"o.active",filters);
  const companyPeriod=appendPeriod(orgParams,"o.created_at",filters);
  const companies=await query<C>("SELECT count(*)::text count FROM organizations o WHERE "+companyStatus+" AND "+companyPeriod,orgParams);

  const subscriptionWhere=(withActivityStatus=false)=>{
    const params:unknown[]=[];
    const period=appendPeriod(params,"s.created_at",filters);
    const company=appendCompanyStatus(params,"o.active",filters);
    const status=withActivityStatus&&filters.activityStatus!=="all" ? " AND "+appendValue(params,"s.status",filters.activityStatus) : "";
    return {params,where:period+" AND "+company+status};
  };
  const paidFilter=subscriptionWhere(),trialFilter=subscriptionWhere(),pastDueFilter=subscriptionWhere(),mrrFilter=subscriptionWhere(),planFilter=subscriptionWhere(true),recentFilter=subscriptionWhere(true);

  const [paid,trials,pastDue,mrr,plans,recent,openWo,down]=await Promise.all([
    query<C>("SELECT count(*)::text count FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id JOIN organizations o ON o.id=s.organization_id WHERE "+paidFilter.where+" AND s.status='active' AND p.code<>'trial'",paidFilter.params),
    query<C>("SELECT count(*)::text count FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id WHERE "+trialFilter.where+" AND s.status='trialing'",trialFilter.params),
    query<C>("SELECT count(*)::text count FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id WHERE "+pastDueFilter.where+" AND s.status='past_due'",pastDueFilter.params),
    query<{amount:string}>("SELECT COALESCE(sum(COALESCE(p.monthly_price_cop,0)),0)::text amount FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id JOIN organizations o ON o.id=s.organization_id WHERE "+mrrFilter.where+" AND s.status='active' AND p.code<>'trial'",mrrFilter.params),
    query<{code:string;name:string;count:string}>("SELECT p.code,p.name,count(*)::text count FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id JOIN organizations o ON o.id=s.organization_id WHERE "+planFilter.where+" GROUP BY p.code,p.name,p.sort_order ORDER BY p.sort_order",planFilter.params),
    query<{id:string;name:string;plan:string;status:string;period_end:string|null}>("SELECT o.id,o.name,p.name plan,s.status,s.current_period_end::text period_end FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id JOIN billing_plans p ON p.id=s.plan_id WHERE "+recentFilter.where+" ORDER BY s.updated_at DESC LIMIT 10",recentFilter.params),
    query<C>("SELECT count(*)::text count FROM work_orders WHERE created_at >= $1::date AND created_at < $2::date AND status IN ('open','assigned','in_progress','paused')",[filters.startDate,filters.endDateExclusive]),
    query<C>("SELECT count(*)::text count FROM assets WHERE created_at >= $1::date AND created_at < $2::date AND status='down'",[filters.startDate,filters.endDateExclusive]),
  ]);

  const leadParams:unknown[]=[];
  const leadPeriod=appendPeriod(leadParams,"created_at",filters);
  const leads=await query<{status:string;count:string}>("SELECT status,count(*)::text count FROM sales_leads WHERE "+leadPeriod+" GROUP BY status ORDER BY status",leadParams);

  const planRows=plans.rows.map(r=>({key:r.code,label:r.name,count:n(r.count)}));
  const labels:Record<string,string>={new:"Nuevos",contacted:"Contactados",qualified:"Calificados",closed:"Cerrados",discarded:"Descartados"};
  const leadRows=leads.rows.map(r=>({key:r.status,label:labels[r.status]||r.status,count:n(r.count)}));
  const leadTotal=leadRows.reduce((s,r)=>s+r.count,0), closed=leadRows.find(r=>r.key==="closed")?.count||0;

  const cards:Card[]=owner?[
    {label:"Planes vendidos",value:paid.rows[0]?.count||"0",hint:"Pagos activos creados en el periodo",icon:"▣",tone:"success",href:"/dashboard/companies"},
    {label:"MRR estimado",value:money(n(mrr.rows[0]?.amount)),hint:"Tarifas mensuales de altas del periodo",icon:"$",tone:"success"},
    {label:"Empresas creadas",value:companies.rows[0]?.count||"0",hint:filters.companyStatus==="all"?"Todos los estados":"Estado filtrado",icon:"◫",href:"/dashboard/companies"},
    {label:"Leads del periodo",value:String(leadTotal),hint:String(closed)+" cerrados · "+String(pct(closed,leadTotal))+"% conversión",icon:"✦",href:"/dashboard/leads"},
  ]:[
    {label:"Empresas creadas",value:companies.rows[0]?.count||"0",hint:"Dentro del periodo filtrado",icon:"◫",href:"/dashboard/companies"},
    {label:"Pruebas iniciadas",value:trials.rows[0]?.count||"0",hint:"Trials del periodo",icon:"◷",tone:"warning"},
    {label:"Pago pendiente",value:pastDue.rows[0]?.count||"0",hint:"Suscripciones past_due del periodo",icon:"!",tone:"danger"},
    {label:"OT abiertas",value:openWo.rows[0]?.count||"0",hint:(down.rows[0]?.count||"0")+" activos detenidos creados",icon:"✓",href:"/dashboard/work-orders"},
  ];

  return <Frame
    role={owner?"Propietario Desweb":"Superadministrador"}
    title={owner?"Control de negocio y plataforma":"Operación global de la plataforma"}
    subtitle={owner?"Ventas, suscripciones, crecimiento y salud de Desweb CMMS.":"Clientes, suscripciones y operación que requieren seguimiento administrativo."}
    cards={cards}
    filters={filters}
    mode="platform"
    companyStatusOptions={[{value:"active",label:"Activas"},{value:"inactive",label:"Inactivas"}]}
    activityStatusOptions={SUBSCRIPTION_STATUS_OPTIONS}
  >
    <div className="dashboard-layout-main">
      <Panel eyebrow="Suscripciones" title="Distribución de planes">{planRows.length?<Bars rows={planRows}/>:<Empty>No hay suscripciones para los filtros seleccionados.</Empty>}</Panel>
      <Panel eyebrow="Comercial" title="Embudo de leads" action={<Link className="text-button" href="/dashboard/leads">Ver leads →</Link>}>{leadRows.length?<Bars rows={leadRows}/>:<Empty>No hay leads en el periodo seleccionado.</Empty>}</Panel>
    </div>
    <Panel eyebrow="Clientes" title="Suscripciones filtradas"><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Periodo</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/companies/"+r.id}>{r.name}</Link></td><td>{r.plan}</td><td><Status value={r.status}/></td><td>{r.period_end?new Date(r.period_end).toLocaleDateString("es-CO"):"—"}</td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

async function operation(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:DashboardFilters) {
  if(!session.organizationId)return null;
  const w=scope(session,"w"),a=scope(session,"a"),org=session.organizationId;
  const woFilter=(base:unknown[],dateColumn="w.created_at")=>{
    const period=appendPeriod(base,dateColumn,filters);
    const status=filters.activityStatus!=="all" ? " AND "+appendValue(base,"w.status",filters.activityStatus) : "";
    return period+status;
  };

  const assets=can(session,"assets.read")?await query<C>("SELECT count(*)::text count FROM assets a WHERE "+a.sql+" AND a.status<>'retired'",a.params):{rows:[{count:"0"}]} as any;

  const openParams=[...w.params],openWhere=woFilter(openParams);
  const doneParams=[...w.params],doneWhere=woFilter(doneParams,"COALESCE(w.completed_at,w.updated_at)");
  const lateParams=[...w.params],lateWhere=woFilter(lateParams);
  const impactParams=[...w.params],impactWhere=woFilter(impactParams);
  const statusParams=[...w.params],statusWhere=woFilter(statusParams);
  const recentParams=[...w.params],recentWhere=woFilter(recentParams);

  const [open,done,late,due,stock,techs,impact,statuses,recent]=await Promise.all([
    can(session,"work_orders.read")?query<C>("SELECT count(*)::text count FROM work_orders w WHERE "+w.sql+" AND "+openWhere+" AND w.status IN ('open','assigned','in_progress','paused')",openParams):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<C>("SELECT count(*)::text count FROM work_orders w WHERE "+w.sql+" AND "+doneWhere+" AND w.status='completed'",doneParams):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<C>("SELECT count(*)::text count FROM work_orders w WHERE "+w.sql+" AND "+lateWhere+" AND w.due_at<now() AND w.status NOT IN ('completed','cancelled')",lateParams):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"maintenance.read")?query<C>("SELECT count(*)::text count FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id WHERE "+a.sql+" AND p.active=true AND p.next_due_at >= $"+String(a.params.length+1)+"::date AND p.next_due_at < $"+String(a.params.length+2)+"::date",a.params.concat([filters.startDate,filters.endDateExclusive])):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"inventory.read")?query<C>("SELECT count(*)::text count FROM inventory_items WHERE organization_id=$1 AND active=true AND quantity<=min_quantity",[org]):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"users.manage")?query<C>("SELECT count(*)::text count FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND u.active=true AND om.role IN ('technician','external')",[org]):Promise.resolve({rows:[{count:"0"}]} as any),
    can(session,"work_orders.read")?query<{cost:string;downtime:string}>("SELECT COALESCE(sum(labor_cost+parts_cost+external_cost),0)::text cost,COALESCE(sum(downtime_minutes),0)::text downtime FROM work_orders w WHERE "+w.sql+" AND "+impactWhere,impactParams):Promise.resolve({rows:[{cost:"0",downtime:"0"}]} as any),
    can(session,"work_orders.read")?query<{status:string;count:string}>("SELECT status,count(*)::text count FROM work_orders w WHERE "+w.sql+" AND "+statusWhere+" GROUP BY status",statusParams):Promise.resolve({rows:[]} as any),
    can(session,"work_orders.read")?query<{id:string;number:string;title:string;status:string;priority:string;asset:string|null}>("SELECT w.id,w.number::text,w.title,w.status,w.priority,a.name asset FROM work_orders w LEFT JOIN assets a ON a.id=w.asset_id WHERE "+w.sql+" AND "+recentWhere+" ORDER BY w.updated_at DESC LIMIT 10",recentParams):Promise.resolve({rows:[]} as any),
  ]);

  const role=session.role, cards:Card[]=[
    {label:"Activos visibles",value:assets.rows[0]?.count||"0",hint:"Foto actual del alcance autorizado",icon:"◇",href:"/dashboard/assets"},
    {label:"OT abiertas",value:open.rows[0]?.count||"0",hint:(late.rows[0]?.count||"0")+" vencidas en el periodo",icon:"✓",tone:n(late.rows[0]?.count)>0?"warning":"default",href:"/dashboard/work-orders"},
    {label:"Completadas",value:done.rows[0]?.count||"0",hint:"Cerradas en el periodo",icon:"✓",tone:"success"},
    {label:"Preventivos",value:due.rows[0]?.count||"0",hint:"Vencimientos dentro del periodo",icon:"↻",tone:n(due.rows[0]?.count)>0?"warning":"default",href:"/dashboard/maintenance"},
  ];
  if(role==="admin")cards[3]={label:"Equipo técnico",value:techs.rows[0]?.count||"0",hint:(stock.rows[0]?.count||"0")+" artículos bajo mínimo",icon:"◎",href:"/dashboard/users"};
  if(role==="manager")cards[3]={label:"Costo periodo",value:money(n(impact.rows[0]?.cost)),hint:hrs(n(impact.rows[0]?.downtime)/60)+" indisponibilidad",icon:"$",tone:"warning"};
  if(role==="viewer")cards[3]={label:"Inventario crítico",value:stock.rows[0]?.count||"0",hint:"Foto actual del inventario",icon:"▤",tone:n(stock.rows[0]?.count)>0?"warning":"default"};

  const names:Record<string,string>={open:"Abiertas",assigned:"Asignadas",in_progress:"En progreso",paused:"Pausadas",completed:"Completadas",cancelled:"Canceladas"};
  const rows=statuses.rows.map(r=>({key:r.status,label:names[r.status]||r.status,count:n(r.count)}));

  return <Frame
    role={roleLabel(session)}
    title={role==="admin"?"Salud operativa de la empresa":role==="manager"?"Control de mantenimiento":"Indicadores operativos"}
    subtitle={"Información de "+(session.organizationName||"tu organización")+" dentro de tu alcance autorizado."}
    cards={cards}
    filters={filters}
    mode="operation"
    activityStatusOptions={WORK_ORDER_STATUS_OPTIONS}
  >
    <div className="dashboard-layout-main">
      <Panel eyebrow="Órdenes de trabajo" title="Distribución del periodo">{rows.length?<Bars rows={rows}/>:<Empty>No hay órdenes para los filtros seleccionados.</Empty>}</Panel>
      <Panel eyebrow="Costos y continuidad" title="Impacto del periodo"><div className="dashboard-impact-grid"><div><span>Costo mantenimiento</span><strong>{money(n(impact.rows[0]?.cost))}</strong><small>Mano de obra + repuestos + externos</small></div><div><span>Indisponibilidad</span><strong>{hrs(n(impact.rows[0]?.downtime)/60)}</strong><small>Downtime acumulado</small></div><div><span>Inventario bajo mínimo</span><strong>{stock.rows[0]?.count||"0"}</strong><small>Foto actual</small></div></div></Panel>
    </div>
    <Panel eyebrow="Actividad reciente" title="Órdenes filtradas" action={<Link className="text-button" href="/dashboard/work-orders">Ver órdenes →</Link>}><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Trabajo</th><th>Activo</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/work-orders/"+r.id}>#{r.number}</Link></td><td>{r.title}</td><td>{r.asset||"—"}</td><td>{r.priority}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

async function field(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:DashboardFilters) {
  if(!session.userId||!session.organizationId)return null;
  const provider=session.role==="provider",sid=session.externalSupplierId,org=session.organizationId,uid=session.userId;
  const pred=provider&&sid?"t.organization_id=$1 AND t.service_supplier_id=$2":"t.organization_id=$1 AND (t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2))";
  const base=provider&&sid?[org,sid] as unknown[]:[org,uid] as unknown[];
  const taskFilter=(params:unknown[])=>{
    const period=appendPeriod(params,"COALESCE(t.completed_at,t.started_at,w.updated_at)",filters);
    const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"t.status",filters.activityStatus) : "";
    return period+status;
  };
  const p1=[...base],w1=taskFilter(p1);
  const p2=[...base],w2=taskFilter(p2);
  const p3=[...base],w3=taskFilter(p3);
  const pr=[...base],wr=taskFilter(pr);

  const execParams:unknown[]=[org,uid];
  const execPeriod=appendPeriod(execParams,"occurred_at",filters);
  const shiftParams:unknown[]=[org,uid];
  const shiftPeriod=appendPeriod(shiftParams,"check_in_at",filters);

  const [pending,progress,done,exec,worked,recent,shift]=await Promise.all([
    query<C>("SELECT count(*)::text count FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+pred+" AND "+w1+" AND t.status='pending'",p1),
    query<C>("SELECT count(*)::text count FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+pred+" AND "+w2+" AND t.status='in_progress'",p2),
    query<C>("SELECT count(*)::text count FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+pred+" AND "+w3+" AND t.status='completed'",p3),
    provider?Promise.resolve({rows:[{total:"0",inside:"0"}]} as any):query<{total:string;inside:string}>("SELECT count(*)::text total,count(*) FILTER(WHERE within_shift=true)::text inside FROM activity_execution_events WHERE organization_id=$1 AND user_id=$2 AND event_type='completed' AND "+execPeriod,execParams),
    provider?Promise.resolve({rows:[{hours:"0"}]} as any):query<{hours:string}>("SELECT COALESCE(sum(EXTRACT(EPOCH FROM(COALESCE(check_out_at,now())-check_in_at))/3600),0)::numeric(12,1)::text hours FROM attendance_shifts WHERE organization_id=$1 AND user_id=$2 AND "+shiftPeriod,shiftParams),
    query<{id:string;description:string;status:string;wo:string;number:string;title:string}>("SELECT t.id,t.description,t.status,w.id wo,w.number::text,w.title FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+pred+" AND "+wr+" ORDER BY COALESCE(t.completed_at,t.started_at,w.updated_at) DESC LIMIT 10",pr),
    provider?Promise.resolve({rows:[]} as any):query<{site:string}>("SELECT s.name site FROM attendance_shifts sh JOIN sites s ON s.id=sh.site_id WHERE sh.organization_id=$1 AND sh.user_id=$2 AND sh.status='open' LIMIT 1",[org,uid]),
  ]);

  const total=n(exec.rows[0]?.total),inside=n(exec.rows[0]?.inside);
  const cards:Card[]=[
    {label:"Completadas",value:done.rows[0]?.count||"0",hint:"Actividades del periodo",icon:"✓",tone:"success"},
    {label:"Pendientes",value:pending.rows[0]?.count||"0",hint:"Dentro del periodo filtrado",icon:"○",tone:n(pending.rows[0]?.count)>0?"warning":"default"},
    {label:"En progreso",value:progress.rows[0]?.count||"0",hint:"Dentro del periodo filtrado",icon:"▶"},
    provider?{label:"Carga activa",value:String(n(pending.rows[0]?.count)+n(progress.rows[0]?.count)),hint:"Asignaciones filtradas",icon:"▣"}:{label:"Productividad validada",value:String(pct(inside,total))+"%",hint:String(inside)+"/"+String(total)+" completadas dentro del turno",icon:"◎",tone:"success"},
  ];

  return <Frame
    role={roleLabel(session)}
    title={provider?"Ejecución del proveedor":"Mi productividad"}
    subtitle={provider?"Trabajo asignado al proveedor y avance de ejecución.":"Actividades, asistencia y rendimiento del periodo seleccionado."}
    cards={cards}
    filters={filters}
    mode="field"
    activityStatusOptions={TASK_STATUS_OPTIONS}
  >
    <div className="dashboard-layout-main">
      {!provider&&<Panel eyebrow="Asistencia" title="Tiempo registrado"><div className="dashboard-worker-focus"><strong>{hrs(n(worked.rows[0]?.hours))}</strong><span>{shift.rows[0]?"Turno abierto · "+shift.rows[0].site:"Sin turno abierto actualmente"}</span></div></Panel>}
      <Panel eyebrow="Productividad" title={provider?"Carga de trabajo":"Cumplimiento dentro del turno"}><div className="dashboard-donut-like"><strong>{provider?done.rows[0]?.count||"0":String(pct(inside,total))+"%"}</strong><span>{provider?"completadas en el periodo":"validación de horario"}</span></div></Panel>
    </div>
    <Panel eyebrow="Trabajo reciente" title="Actividades filtradas" action={<Link className="text-button" href="/dashboard/work-orders">Ver órdenes →</Link>}><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Actividad</th><th>Orden</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/work-orders/"+r.wo}>#{r.number}</Link></td><td>{r.description}</td><td>{r.title}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

async function requester(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:DashboardFilters) {
  if(!session.userId||!session.organizationId)return null;
  const base:unknown[]=[session.organizationId,session.userId];
  const filter=(params:unknown[],dateColumn="requested_at")=>{
    const period=appendPeriod(params,dateColumn,filters);
    const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"status",filters.activityStatus) : "";
    return period+status;
  };
  const p1=[...base],w1=filter(p1);
  const p2=[...base],w2=filter(p2,"COALESCE(completed_at,updated_at)");
  const p3=[...base],w3=filter(p3,"COALESCE(completed_at,updated_at)");
  const pr=[...base],wr=filter(pr);
  const [open,done,avg,recent]=await Promise.all([
    query<C>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND "+w1+" AND status IN ('open','assigned','in_progress','paused')",p1),
    query<C>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND "+w2+" AND status='completed'",p2),
    query<{hours:string}>("SELECT COALESCE(avg(EXTRACT(EPOCH FROM(completed_at-requested_at))/3600),0)::numeric(12,1)::text hours FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND completed_at IS NOT NULL AND "+w3,p3),
    query<{id:string;number:string;title:string;status:string;requested_at:string}>("SELECT id,number::text,title,status,requested_at::text FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND "+wr+" ORDER BY requested_at DESC LIMIT 10",pr),
  ]);
  const total=n(open.rows[0]?.count)+n(done.rows[0]?.count);
  return <Frame
    role="Solicitante"
    title="Mis solicitudes"
    subtitle="Seguimiento de mantenimiento y tiempos de resolución."
    cards={[
      {label:"Abiertas",value:open.rows[0]?.count||"0",hint:"Dentro del periodo",icon:"○",tone:n(open.rows[0]?.count)>0?"warning":"default",href:"/dashboard/work-orders"},
      {label:"Cerradas",value:done.rows[0]?.count||"0",hint:"Completadas en el periodo",icon:"✓",tone:"success"},
      {label:"Tiempo medio",value:hrs(n(avg.rows[0]?.hours)),hint:"Resolución del periodo",icon:"◷"},
      {label:"Resolución",value:String(pct(n(done.rows[0]?.count),total))+"%",hint:"Cerradas frente a abiertas",icon:"◎"},
    ]}
    filters={filters}
    mode="requester"
    activityStatusOptions={WORK_ORDER_STATUS_OPTIONS}
  >
    <Panel eyebrow="Seguimiento" title="Solicitudes filtradas"><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Solicitud</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(r=><tr key={r.id}><td><Link href={"/dashboard/work-orders/"+r.id}>#{r.number}</Link></td><td>{r.title}</td><td>{new Date(r.requested_at).toLocaleDateString("es-CO")}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

export default async function Dashboard({searchParams}:{searchParams:Promise<DashboardFilterInput>}){
  const session=await getSession();
  if(!session)redirect("/login");
  const filters=parseDashboardFilters(await searchParams);
  if(session.platformRole==="platform_owner"||session.platformRole==="superadmin")return platform(session,filters);
  if(session.role==="technician"||session.role==="external"||session.role==="provider")return field(session,filters);
  if(session.role==="requester")return requester(session,filters);
  return operation(session,filters);
}
