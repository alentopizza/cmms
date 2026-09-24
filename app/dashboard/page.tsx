import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel } from "@/lib/permissions";
import { query } from "@/lib/db";
import DashboardControls from "@/components/DashboardControls";
import {
  DashboardKpis,
  DashboardRoleIntro,
  DashboardStatTiles,
  DashboardTrendChart,
  type DashboardKpiCard,
} from "@/components/DashboardAnalytics";
import {
  appendCompanyStatus,
  appendPeriod,
  appendPriorityFilter,
  appendSiteFilter,
  appendValue,
  comparisonFilters,
  parseDashboardFilters,
  type DashboardFilterInput,
  type DashboardFilters,
} from "@/lib/dashboard-filters";

type C={count:string};
type B={key:string;label:string;count:number};
type Option={value:string;label:string};
type Session=NonNullable<Awaited<ReturnType<typeof getSession>>>;

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
const PRIORITY_OPTIONS:Option[]=[
  {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"},
];

function Bars({rows}:{rows:B[]}) {
  const total=rows.reduce((s,r)=>s+r.count,0);
  return <div className="dashboard-progress-list">{rows.map(r=>{
    const p=pct(r.count,total);
    return <div className="dashboard-progress-row" key={r.key}>
      <div><strong>{r.label}</strong><span>{r.count}</span></div>
      <div className="dashboard-progress-track"><span style={{width:String(p)+"%"}}/></div>
      <small>{p}%</small>
    </div>;
  })}</div>;
}
function Panel({eyebrow,title,children,action}:{eyebrow:string;title:string;children:React.ReactNode;action?:React.ReactNode}) {
  return <section className="card dashboard-panel"><header className="dashboard-panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</header>{children}</section>;
}
function Empty({children}:{children:React.ReactNode}){return <div className="dashboard-empty">{children}</div>}
function Status({value}:{value:string}){return <span className={"dashboard-status dashboard-status-"+value}>{value.replaceAll("_"," ")}</span>}

function scope(session:Session,alias:string) {
  return session.accessAllSites
    ? {sql:alias+".organization_id=$1",params:[session.organizationId] as unknown[]}
    : {sql:alias+".organization_id=$1 AND "+alias+".site_id=ANY($2::uuid[])",params:[session.organizationId,session.siteIds] as unknown[]};
}

async function siteOptions(session:Session):Promise<Option[]>{
  if(!session.organizationId)return [];
  const result=session.accessAllSites
    ?await query<{id:string;name:string}>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[session.organizationId])
    :await query<{id:string;name:string}>("SELECT id,name FROM sites WHERE organization_id=$1 AND id=ANY($2::uuid[]) AND active=true ORDER BY name",[session.organizationId,session.siteIds]);
  return result.rows.map(row=>({value:row.id,label:row.name}));
}

function Frame({
  session,filters,cards,children,mode,companyStatusOptions,activityStatusOptions,siteOptions:sites=[],priorityOptions=[],
}:{
  session:Session;
  filters:DashboardFilters;
  cards:DashboardKpiCard[];
  children:React.ReactNode;
  mode:"platform"|"operation"|"field"|"requester";
  companyStatusOptions?:Option[];
  activityStatusOptions?:Option[];
  siteOptions?:Option[];
  priorityOptions?:Option[];
}) {
  const role=session.platformRole==="platform_owner"
    ?"Platform Owner"
    :session.platformRole==="superadmin"
      ?"Superadministración"
      :roleLabel(session);
  const descriptions:Record<string,string>={
    platform:"Crecimiento comercial, adopción de clientes y salud global de la plataforma.",
    operation:"Mantenimiento, continuidad, costos y cumplimiento dentro del alcance autorizado.",
    field:"Carga operativa, ejecución y evidencia de campo del periodo seleccionado.",
    requester:"Seguimiento de solicitudes, tiempos de resolución y evolución mensual.",
  };
  return <div className="role-dashboard role-dashboard-v2">
    <DashboardRoleIntro
      eyebrow={"Dashboard · "+role}
      title={"Indicadores para "+role}
      description={descriptions[mode]}
      period={filters.label}
      comparison={filters.comparisonLabel}
    />
    <DashboardControls
      mode={mode}
      companyStatusOptions={companyStatusOptions}
      activityStatusOptions={activityStatusOptions}
      siteOptions={sites}
      priorityOptions={priorityOptions}
    />
    <DashboardKpis cards={cards}/>
    {children}
  </div>;
}

function iso(value:Date){return value.toISOString().slice(0,10)}
function utc(value:string){
  const [y,m,d]=value.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d));
}
function trendWindow(filters:DashboardFilters){
  const last=new Date(utc(filters.endDateExclusive).getTime()-86400000);
  const lastMonth=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),1));
  const start=new Date(Date.UTC(lastMonth.getUTCFullYear(),lastMonth.getUTCMonth()-5,1));
  const end=new Date(Date.UTC(lastMonth.getUTCFullYear(),lastMonth.getUTCMonth()+1,1));
  const keys=Array.from({length:6},(_,index)=>{
    const date=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+index,1));
    return iso(date).slice(0,7);
  });
  const labels=keys.map(key=>{
    const [year,month]=key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-CO",{month:"short",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1))).replace(".","");
  });
  return {start:iso(start),end:iso(end),keys,labels};
}
function monthValues(keys:string[],rows:unknown[],field:string){
  const map=new Map(rows.map(item=>{
    const row=item as Record<string,unknown>;
    return [String(row.month),n(row[field] as string|number|null|undefined)] as const;
  }));
  return keys.map(key=>map.get(key)||0);
}

async function platformPeriodMetrics(filters:DashboardFilters){
  const orgParams:unknown[]=[];
  const companyStatus=appendCompanyStatus(orgParams,"o.active",filters);
  const companyPeriod=appendPeriod(orgParams,"o.created_at",filters);
  const companies=await query<C>("SELECT count(*)::text count FROM organizations o WHERE "+companyStatus+" AND "+companyPeriod,orgParams);

  const subscription=(extra:string)=>{
    const params:unknown[]=[];
    const period=appendPeriod(params,"s.created_at",filters);
    const company=appendCompanyStatus(params,"o.active",filters);
    const status=filters.activityStatus!=="all"?" AND "+appendValue(params,"s.status",filters.activityStatus):"";
    return query<C>("SELECT count(*)::text count FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id JOIN billing_plans p ON p.id=s.plan_id WHERE "+period+" AND "+company+status+extra,params);
  };
  const mrrParams:unknown[]=[];
  const mrrPeriod=appendPeriod(mrrParams,"s.created_at",filters);
  const mrrCompany=appendCompanyStatus(mrrParams,"o.active",filters);
  const leadsParams:unknown[]=[];
  const leadsPeriod=appendPeriod(leadsParams,"created_at",filters);
  const openParams:unknown[]=[];
  const openPeriod=appendPeriod(openParams,"created_at",filters);

  const [paid,trials,pastDue,mrr,leads,openWo]=await Promise.all([
    subscription(" AND s.status='active' AND p.code<>'trial'"),
    subscription(" AND s.status='trialing'"),
    subscription(" AND s.status='past_due'"),
    query<{amount:string}>("SELECT COALESCE(sum(COALESCE(p.monthly_price_cop,0)),0)::text amount FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id JOIN organizations o ON o.id=s.organization_id WHERE "+mrrPeriod+" AND "+mrrCompany+" AND s.status='active' AND p.code<>'trial'",mrrParams),
    query<{total:string;closed:string}>("SELECT count(*)::text total,count(*) FILTER(WHERE status='closed')::text closed FROM sales_leads WHERE "+leadsPeriod,leadsParams),
    query<C>("SELECT count(*)::text count FROM work_orders WHERE "+openPeriod+" AND status IN ('open','assigned','in_progress','paused')",openParams),
  ]);

  return {
    companies:n(companies.rows[0]?.count),
    paid:n(paid.rows[0]?.count),
    trials:n(trials.rows[0]?.count),
    pastDue:n(pastDue.rows[0]?.count),
    mrr:n(mrr.rows[0]?.amount),
    leads:n(leads.rows[0]?.total),
    closedLeads:n(leads.rows[0]?.closed),
    openWo:n(openWo.rows[0]?.count),
  };
}

async function platformTrend(filters:DashboardFilters){
  const window=trendWindow(filters);
  const companyParams:unknown[]=[window.start,window.end];
  const companyStatus=appendCompanyStatus(companyParams,"o.active",filters);
  const subscriptionParams:unknown[]=[window.start,window.end];
  const subscriptionStatus=filters.activityStatus!=="all"?" AND "+appendValue(subscriptionParams,"s.status",filters.activityStatus):"";
  const [companies,subscriptions,leads]=await Promise.all([
    query<{month:string;count:string}>("SELECT to_char(date_trunc('month',o.created_at),'YYYY-MM') month,count(*)::text count FROM organizations o WHERE o.created_at >= $1::date AND o.created_at < $2::date AND "+companyStatus+" GROUP BY 1 ORDER BY 1",companyParams),
    query<{month:string;count:string}>("SELECT to_char(date_trunc('month',s.created_at),'YYYY-MM') month,count(*)::text count FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id WHERE s.created_at >= $1::date AND s.created_at < $2::date"+subscriptionStatus+" GROUP BY 1 ORDER BY 1",subscriptionParams),
    query<{month:string;count:string}>("SELECT to_char(date_trunc('month',created_at),'YYYY-MM') month,count(*)::text count FROM sales_leads WHERE created_at >= $1::date AND created_at < $2::date GROUP BY 1 ORDER BY 1",[window.start,window.end]),
  ]);
  return {
    labels:window.labels,
    companies:monthValues(window.keys,companies.rows,"count"),
    subscriptions:monthValues(window.keys,subscriptions.rows,"count"),
    leads:monthValues(window.keys,leads.rows,"count"),
  };
}

async function platform(session:Session,filters:DashboardFilters) {
  const owner=session.platformRole==="platform_owner";
  const previousFilters=comparisonFilters(filters);
  const [metrics,previous,trend]=await Promise.all([
    platformPeriodMetrics(filters),
    platformPeriodMetrics(previousFilters),
    platformTrend(filters),
  ]);

  const planParams:unknown[]=[];
  const planPeriod=appendPeriod(planParams,"s.created_at",filters);
  const planCompany=appendCompanyStatus(planParams,"o.active",filters);
  const planStatus=filters.activityStatus!=="all"?" AND "+appendValue(planParams,"s.status",filters.activityStatus):"";
  const leadParams:unknown[]=[];
  const leadPeriod=appendPeriod(leadParams,"created_at",filters);
  const recentParams:unknown[]=[];
  const recentPeriod=appendPeriod(recentParams,"s.created_at",filters);
  const recentCompany=appendCompanyStatus(recentParams,"o.active",filters);
  const recentStatus=filters.activityStatus!=="all"?" AND "+appendValue(recentParams,"s.status",filters.activityStatus):"";

  const [plans,leads,recent]=await Promise.all([
    query<{code:string;name:string;count:string}>("SELECT p.code,p.name,count(*)::text count FROM organization_subscriptions s JOIN billing_plans p ON p.id=s.plan_id JOIN organizations o ON o.id=s.organization_id WHERE "+planPeriod+" AND "+planCompany+planStatus+" GROUP BY p.code,p.name,p.sort_order ORDER BY p.sort_order",planParams),
    query<{status:string;count:string}>("SELECT status,count(*)::text count FROM sales_leads WHERE "+leadPeriod+" GROUP BY status ORDER BY status",leadParams),
    query<{id:string;name:string;plan:string;status:string;period_end:string|null}>("SELECT o.id,o.name,p.name plan,s.status,s.current_period_end::text period_end FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id JOIN billing_plans p ON p.id=s.plan_id WHERE "+recentPeriod+" AND "+recentCompany+recentStatus+" ORDER BY s.updated_at DESC LIMIT 10",recentParams),
  ]);

  const planRows=plans.rows.map(row=>({key:row.code,label:row.name,count:n(row.count)}));
  const leadNames:Record<string,string>={new:"Nuevos",contacted:"Contactados",qualified:"Calificados",closed:"Cerrados",discarded:"Descartados"};
  const leadRows=leads.rows.map(row=>({key:row.status,label:leadNames[row.status]||row.status,count:n(row.count)}));

  const cards:DashboardKpiCard[]=owner?[
    {label:"Planes vendidos",value:String(metrics.paid),hint:"Altas pagas activas del periodo",icon:"company",tone:"success",href:"/dashboard/companies",current:metrics.paid,previous:previous.paid,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Nuevo MRR estimado",value:money(metrics.mrr),hint:"Tarifa mensual de altas activas",icon:"activity",tone:"success",current:metrics.mrr,previous:previous.mrr,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Empresas creadas",value:String(metrics.companies),hint:filters.companyStatus==="all"?"Todos los estados":"Estado de empresa filtrado",icon:"company",href:"/dashboard/companies",current:metrics.companies,previous:previous.companies,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Leads",value:String(metrics.leads),hint:String(metrics.closedLeads)+" cerrados · "+String(pct(metrics.closedLeads,metrics.leads))+"% conversión",icon:"user",current:metrics.leads,previous:previous.leads,comparisonLabel:filters.comparisonLabel,direction:"higher-better",href:"/dashboard/leads"},
  ]:[
    {label:"Empresas creadas",value:String(metrics.companies),hint:"Dentro del periodo filtrado",icon:"company",current:metrics.companies,previous:previous.companies,comparisonLabel:filters.comparisonLabel,direction:"higher-better",href:"/dashboard/companies"},
    {label:"Pruebas iniciadas",value:String(metrics.trials),hint:"Trials iniciados en el periodo",icon:"clock",tone:"warning",current:metrics.trials,previous:previous.trials,comparisonLabel:filters.comparisonLabel,direction:"neutral"},
    {label:"Pago pendiente",value:String(metrics.pastDue),hint:"Suscripciones past_due",icon:"activity",tone:metrics.pastDue>0?"danger":"default",current:metrics.pastDue,previous:previous.pastDue,comparisonLabel:filters.comparisonLabel,direction:"lower-better"},
    {label:"OT abiertas",value:String(metrics.openWo),hint:"Actividad operativa global creada",icon:"work-order",current:metrics.openWo,previous:previous.openWo,comparisonLabel:filters.comparisonLabel,direction:"lower-better",href:"/dashboard/work-orders"},
  ];

  return <Frame
    session={session}
    filters={filters}
    cards={cards}
    mode="platform"
    companyStatusOptions={[{value:"active",label:"Activas"},{value:"inactive",label:"Inactivas"}]}
    activityStatusOptions={SUBSCRIPTION_STATUS_OPTIONS}
  >
    <div className="dashboard-layout-main dashboard-layout-analytics">
      <Panel eyebrow="Tendencia" title="Evolución de los últimos 6 meses">
        <DashboardTrendChart labels={trend.labels} series={[
          {name:"Empresas",values:trend.companies},
          {name:"Suscripciones",values:trend.subscriptions},
          {name:"Leads",values:trend.leads},
        ]}/>
      </Panel>
      <Panel eyebrow="Conversión" title="Resumen comercial">
        <DashboardStatTiles items={[
          {label:"Conversión de leads",value:String(pct(metrics.closedLeads,metrics.leads))+"%",hint:String(metrics.closedLeads)+" cierres del periodo",tone:"success"},
          {label:"Trials",value:String(metrics.trials),hint:"Altas de prueba",tone:"warning"},
          {label:"Pago pendiente",value:String(metrics.pastDue),hint:"Requieren revisión",tone:metrics.pastDue>0?"danger":"default"},
        ]}/>
      </Panel>
    </div>
    <div className="dashboard-layout-main">
      <Panel eyebrow="Suscripciones" title="Distribución de planes">{planRows.length?<Bars rows={planRows}/>:<Empty>No hay suscripciones para los filtros seleccionados.</Empty>}</Panel>
      <Panel eyebrow="Comercial" title="Embudo de leads" action={<Link className="text-button" href="/dashboard/leads">Ver leads →</Link>}>{leadRows.length?<Bars rows={leadRows}/>:<Empty>No hay leads en el periodo seleccionado.</Empty>}</Panel>
    </div>
    <Panel eyebrow="Clientes" title="Suscripciones filtradas"><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Periodo</th></tr></thead><tbody>{recent.rows.map(row=><tr key={row.id}><td><Link href={"/dashboard/companies/"+row.id}>{row.name}</Link></td><td>{row.plan}</td><td><Status value={row.status}/></td><td>{row.period_end?new Date(row.period_end).toLocaleDateString("es-CO"):"—"}</td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

async function operationPeriodMetrics(session:Session,filters:DashboardFilters){
  const sc=scope(session,"w");
  const params=[...sc.params];
  const site=appendSiteFilter(params,"w.site_id",filters);
  const priority=appendPriorityFilter(params,"w.priority",filters);
  const status=filters.activityStatus!=="all"?" AND "+appendValue(params,"w.status",filters.activityStatus):"";
  const start=params.length+1;
  params.push(filters.startDate,filters.endDateExclusive);
  const created="w.created_at >= $"+start+"::date AND w.created_at < $"+String(start+1)+"::date";
  const completed="COALESCE(w.completed_at,w.updated_at) >= $"+start+"::date AND COALESCE(w.completed_at,w.updated_at) < $"+String(start+1)+"::date";
  const result=await query<{
    open:string;completed:string;late:string;cost:string;downtime:string;preventive:string;preventive_done:string;total:string;
  }>(
    "SELECT "+
    "count(*) FILTER(WHERE "+created+" AND w.status IN ('open','assigned','in_progress','paused'))::text open,"+
    "count(*) FILTER(WHERE "+completed+" AND w.status='completed')::text completed,"+
    "count(*) FILTER(WHERE w.due_at >= $"+start+"::date AND w.due_at < $"+String(start+1)+"::date AND w.due_at<now() AND w.status NOT IN ('completed','cancelled'))::text late,"+
    "COALESCE(sum(w.labor_cost+w.parts_cost+w.external_cost) FILTER(WHERE "+created+"),0)::text cost,"+
    "COALESCE(sum(w.downtime_minutes) FILTER(WHERE "+created+"),0)::text downtime,"+
    "count(*) FILTER(WHERE "+created+" AND w.type='preventive')::text preventive,"+
    "count(*) FILTER(WHERE "+created+" AND w.type='preventive' AND w.status='completed')::text preventive_done,"+
    "count(*) FILTER(WHERE "+created+")::text total "+
    "FROM work_orders w WHERE "+sc.sql+site+priority+status,
    params,
  );
  const row=result.rows[0]||{open:"0",completed:"0",late:"0",cost:"0",downtime:"0",preventive:"0",preventive_done:"0",total:"0"};
  return {
    open:n(row.open),completed:n(row.completed),late:n(row.late),cost:n(row.cost),downtime:n(row.downtime),
    preventive:n(row.preventive),preventiveDone:n(row.preventive_done),total:n(row.total),
  };
}

async function operationTrend(session:Session,filters:DashboardFilters){
  const window=trendWindow(filters);
  const sc=scope(session,"w");
  const build=(dateColumn:string,completedOnly=false)=>{
    const params=[...sc.params];
    const site=appendSiteFilter(params,"w.site_id",filters);
    const priority=appendPriorityFilter(params,"w.priority",filters);
    const status=filters.activityStatus!=="all"?" AND "+appendValue(params,"w.status",filters.activityStatus):"";
    const start=params.length+1;
    params.push(window.start,window.end);
    return {
      params,
      sql:"SELECT to_char(date_trunc('month',"+dateColumn+"),'YYYY-MM') month,count(*)::text count FROM work_orders w WHERE "+sc.sql+site+priority+status+
        " AND "+dateColumn+" >= $"+start+"::date AND "+dateColumn+" < $"+String(start+1)+"::date"+
        (completedOnly?" AND w.status='completed'":"")+" GROUP BY 1 ORDER BY 1",
    };
  };
  const created=build("w.created_at");
  const completed=build("w.completed_at",true);
  const [createdRows,completedRows]=await Promise.all([
    query<{month:string;count:string}>(created.sql,created.params),
    query<{month:string;count:string}>(completed.sql,completed.params),
  ]);
  return {
    labels:window.labels,
    created:monthValues(window.keys,createdRows.rows,"count"),
    completed:monthValues(window.keys,completedRows.rows,"count"),
  };
}

async function operation(session:Session,filters:DashboardFilters) {
  if(!session.organizationId)return null;
  const sites=await siteOptions(session);
  const previousFilters=comparisonFilters(filters);
  const [metrics,previous,trend]=await Promise.all([
    operationPeriodMetrics(session,filters),
    operationPeriodMetrics(session,previousFilters),
    operationTrend(session,filters),
  ]);

  const assetScope=scope(session,"a");
  const assetParams=[...assetScope.params];
  const assetSite=appendSiteFilter(assetParams,"a.site_id",filters);
  const assets=can(session,"assets.read")
    ?await query<C>("SELECT count(*)::text count FROM assets a WHERE "+assetScope.sql+assetSite+" AND a.status<>'retired'",assetParams)
    :{rows:[{count:"0"}]} as any;

  const stockParams:unknown[]=[session.organizationId];
  let stockWhere="organization_id=$1 AND active=true AND quantity<=min_quantity";
  stockWhere+=appendSiteFilter(stockParams,"site_id",filters);
  const stock=can(session,"inventory.read")
    ?await query<C>("SELECT count(*)::text count FROM inventory_items WHERE "+stockWhere,stockParams)
    :{rows:[{count:"0"}]} as any;

  const techs=can(session,"users.manage")
    ?await query<C>("SELECT count(*)::text count FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND u.active=true AND om.role IN ('technician','external')",[session.organizationId])
    :{rows:[{count:"0"}]} as any;

  const distributionScope=scope(session,"w");
  const distParams=[...distributionScope.params];
  const distSite=appendSiteFilter(distParams,"w.site_id",filters);
  const distPriority=appendPriorityFilter(distParams,"w.priority",filters);
  const distStatus=filters.activityStatus!=="all"?" AND "+appendValue(distParams,"w.status",filters.activityStatus):"";
  const distPeriod=appendPeriod(distParams,"w.created_at",filters);
  const recentParams=[...distributionScope.params];
  const recentSite=appendSiteFilter(recentParams,"w.site_id",filters);
  const recentPriority=appendPriorityFilter(recentParams,"w.priority",filters);
  const recentStatus=filters.activityStatus!=="all"?" AND "+appendValue(recentParams,"w.status",filters.activityStatus):"";
  const recentPeriod=appendPeriod(recentParams,"w.created_at",filters);

  const [statuses,types,siteDist,recent]=await Promise.all([
    query<{status:string;count:string}>("SELECT w.status,count(*)::text count FROM work_orders w WHERE "+distributionScope.sql+distSite+distPriority+distStatus+" AND "+distPeriod+" GROUP BY w.status",distParams),
    query<{type:string;count:string}>("SELECT w.type,count(*)::text count FROM work_orders w WHERE "+distributionScope.sql+distSite+distPriority+distStatus+" AND "+distPeriod+" GROUP BY w.type ORDER BY count(*) DESC",distParams),
    query<{site:string;count:string}>("SELECT s.name site,count(*)::text count FROM work_orders w JOIN sites s ON s.id=w.site_id WHERE "+distributionScope.sql+distSite+distPriority+distStatus+" AND "+distPeriod+" GROUP BY s.name ORDER BY count(*) DESC LIMIT 6",distParams),
    query<{id:string;number:string;title:string;status:string;priority:string;asset:string|null}>("SELECT w.id,w.number::text,w.title,w.status,w.priority,a.name asset FROM work_orders w LEFT JOIN assets a ON a.id=w.asset_id WHERE "+distributionScope.sql+recentSite+recentPriority+recentStatus+" AND "+recentPeriod+" ORDER BY w.updated_at DESC LIMIT 10",recentParams),
  ]);

  const statusNames:Record<string,string>={open:"Abiertas",assigned:"Asignadas",in_progress:"En progreso",paused:"Pausadas",completed:"Completadas",cancelled:"Canceladas"};
  const typeNames:Record<string,string>={corrective:"Correctivo",preventive:"Preventivo",inspection:"Inspección",emergency:"Emergencia",improvement:"Mejora"};
  const statusRows=statuses.rows.map(row=>({key:row.status,label:statusNames[row.status]||row.status,count:n(row.count)}));
  const typeRows=types.rows.map(row=>({key:row.type,label:typeNames[row.type]||row.type,count:n(row.count)}));
  const siteRows=siteDist.rows.map(row=>({key:row.site,label:row.site,count:n(row.count)}));
  const preventiveCompliance=pct(metrics.preventiveDone,metrics.preventive);
  const previousPreventiveCompliance=pct(previous.preventiveDone,previous.preventive);

  const role=session.role;
  let cards:DashboardKpiCard[]=[
    {label:"OT abiertas",value:String(metrics.open),hint:String(metrics.late)+" vencidas con compromiso en el periodo",icon:"work-order",current:metrics.open,previous:previous.open,comparisonLabel:filters.comparisonLabel,direction:"lower-better",href:"/dashboard/work-orders",tone:metrics.late>0?"warning":"default"},
    {label:"Completadas",value:String(metrics.completed),hint:"Cierres registrados en el periodo",icon:"check",tone:"success",current:metrics.completed,previous:previous.completed,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Cumplimiento preventivo",value:String(preventiveCompliance)+"%",hint:String(metrics.preventiveDone)+"/"+String(metrics.preventive)+" preventivas del periodo",icon:"activity",current:preventiveCompliance,previous:previousPreventiveCompliance,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Costo de mantenimiento",value:money(metrics.cost),hint:hrs(metrics.downtime/60)+" de indisponibilidad",icon:"clock",current:metrics.cost,previous:previous.cost,comparisonLabel:filters.comparisonLabel,direction:"lower-better",tone:"warning"},
  ];
  if(role==="admin"){
    cards=[
      {label:"Activos visibles",value:String(n(assets.rows[0]?.count)),hint:"Foto actual del alcance autorizado",icon:"asset",href:"/dashboard/assets"},
      cards[0],
      cards[2],
      {label:"Equipo técnico",value:String(n(techs.rows[0]?.count)),hint:String(n(stock.rows[0]?.count))+" artículos bajo mínimo",icon:"user",href:"/dashboard/users"},
    ];
  }
  if(role==="viewer"){
    cards=[
      {label:"Activos visibles",value:String(n(assets.rows[0]?.count)),hint:"Foto actual del alcance autorizado",icon:"asset",href:"/dashboard/assets"},
      cards[1],
      cards[2],
      cards[3],
    ];
  }

  return <Frame
    session={session}
    filters={filters}
    cards={cards}
    mode="operation"
    activityStatusOptions={WORK_ORDER_STATUS_OPTIONS}
    siteOptions={sites}
    priorityOptions={PRIORITY_OPTIONS}
  >
    <div className="dashboard-layout-main dashboard-layout-analytics">
      <Panel eyebrow="Tendencia" title="Órdenes mes a mes">
        <DashboardTrendChart labels={trend.labels} series={[
          {name:"Creadas",values:trend.created},
          {name:"Completadas",values:trend.completed},
        ]}/>
      </Panel>
      <Panel eyebrow="Continuidad" title="Impacto operacional">
        <DashboardStatTiles items={[
          {label:"Costo",value:money(metrics.cost),hint:"Mano de obra + repuestos + externos",tone:"warning"},
          {label:"Indisponibilidad",value:hrs(metrics.downtime/60),hint:"Downtime acumulado"},
          {label:"Inventario bajo mínimo",value:String(n(stock.rows[0]?.count)),hint:"Foto actual de existencias",tone:n(stock.rows[0]?.count)>0?"warning":"default"},
        ]}/>
      </Panel>
    </div>
    <div className="dashboard-layout-thirds">
      <Panel eyebrow="Estados" title="Distribución de OT">{statusRows.length?<Bars rows={statusRows}/>:<Empty>Sin órdenes para los filtros seleccionados.</Empty>}</Panel>
      <Panel eyebrow="Tipo de mantenimiento" title="Origen del trabajo">{typeRows.length?<Bars rows={typeRows}/>:<Empty>Sin datos por tipo.</Empty>}</Panel>
      <Panel eyebrow="Sedes" title="Carga por ubicación">{siteRows.length?<Bars rows={siteRows}/>:<Empty>Sin datos por sede.</Empty>}</Panel>
    </div>
    <Panel eyebrow="Actividad reciente" title="Órdenes filtradas" action={<Link className="text-button" href="/dashboard/work-orders">Ver órdenes →</Link>}><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Trabajo</th><th>Activo</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(row=><tr key={row.id}><td><Link href={"/dashboard/work-orders/"+row.id}>#{row.number}</Link></td><td>{row.title}</td><td>{row.asset||"—"}</td><td>{row.priority}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

function fieldBase(session:Session,filters:DashboardFilters){
  const provider=session.role==="provider";
  const second=provider?session.externalSupplierId:session.userId;
  const params:unknown[]=[session.organizationId,second];
  let predicate=provider
    ?"t.organization_id=$1 AND t.service_supplier_id=$2"
    :"t.organization_id=$1 AND (t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2))";
  if(!session.accessAllSites){
    const index=params.length+1;
    params.push(session.siteIds);
    predicate+=" AND w.site_id=ANY($"+index+"::uuid[])";
  }
  predicate+=appendSiteFilter(params,"w.site_id",filters);
  predicate+=appendPriorityFilter(params,"w.priority",filters);
  if(filters.activityStatus!=="all")predicate+=" AND "+appendValue(params,"t.status",filters.activityStatus);
  return {params,predicate,provider};
}

async function fieldPeriodMetrics(session:Session,filters:DashboardFilters){
  const base=fieldBase(session,filters);
  const taskParams=[...base.params];
  const period=appendPeriod(taskParams,"COALESCE(t.completed_at,t.started_at,w.updated_at)",filters);
  const tasks=await query<{pending:string;progress:string;completed:string}>(
    "SELECT count(*) FILTER(WHERE t.status='pending')::text pending,count(*) FILTER(WHERE t.status='in_progress')::text progress,count(*) FILTER(WHERE t.status='completed')::text completed FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+base.predicate+" AND "+period,
    taskParams,
  );
  if(base.provider){
    const row=tasks.rows[0]||{pending:"0",progress:"0",completed:"0"};
    return {pending:n(row.pending),progress:n(row.progress),completed:n(row.completed),hours:0,totalExec:0,insideExec:0};
  }

  const eventParams:unknown[]=[session.organizationId,session.userId];
  let eventWhere="e.organization_id=$1 AND e.user_id=$2";
  if(!session.accessAllSites){
    const index=eventParams.length+1;
    eventParams.push(session.siteIds);
    eventWhere+=" AND w.site_id=ANY($"+index+"::uuid[])";
  }
  eventWhere+=appendSiteFilter(eventParams,"w.site_id",filters);
  eventWhere+=appendPriorityFilter(eventParams,"w.priority",filters);
  const eventPeriod=appendPeriod(eventParams,"e.occurred_at",filters);
  const shiftParams:unknown[]=[session.organizationId,session.userId];
  let shiftWhere="organization_id=$1 AND user_id=$2";
  if(!session.accessAllSites){
    const index=shiftParams.length+1;
    shiftParams.push(session.siteIds);
    shiftWhere+=" AND site_id=ANY($"+index+"::uuid[])";
  }
  shiftWhere+=appendSiteFilter(shiftParams,"site_id",filters);
  const shiftPeriod=appendPeriod(shiftParams,"check_in_at",filters);

  const [exec,worked]=await Promise.all([
    query<{total:string;inside:string}>("SELECT count(*)::text total,count(*) FILTER(WHERE e.within_shift=true)::text inside FROM activity_execution_events e JOIN work_orders w ON w.id=e.work_order_id WHERE "+eventWhere+" AND e.event_type='completed' AND "+eventPeriod,eventParams),
    query<{hours:string}>("SELECT COALESCE(sum(EXTRACT(EPOCH FROM(COALESCE(check_out_at,now())-check_in_at))/3600),0)::numeric(12,1)::text hours FROM attendance_shifts WHERE "+shiftWhere+" AND "+shiftPeriod,shiftParams),
  ]);
  const row=tasks.rows[0]||{pending:"0",progress:"0",completed:"0"};
  return {
    pending:n(row.pending),progress:n(row.progress),completed:n(row.completed),
    hours:n(worked.rows[0]?.hours),totalExec:n(exec.rows[0]?.total),insideExec:n(exec.rows[0]?.inside),
  };
}

async function fieldTrend(session:Session,filters:DashboardFilters){
  const window=trendWindow(filters);
  const base=fieldBase(session,{...filters,activityStatus:"all"});
  const params=[...base.params];
  const start=params.length+1;
  params.push(window.start,window.end);
  const rows=await query<{month:string;completed:string;active:string}>(
    "SELECT to_char(date_trunc('month',COALESCE(t.completed_at,t.started_at,w.updated_at)),'YYYY-MM') month,"+
    "count(*) FILTER(WHERE t.status='completed')::text completed,"+
    "count(*) FILTER(WHERE t.status IN ('pending','in_progress'))::text active "+
    "FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+base.predicate+
    " AND COALESCE(t.completed_at,t.started_at,w.updated_at) >= $"+start+"::date AND COALESCE(t.completed_at,t.started_at,w.updated_at) < $"+String(start+1)+"::date GROUP BY 1 ORDER BY 1",
    params,
  );
  return {
    labels:window.labels,
    completed:monthValues(window.keys,rows.rows,"completed"),
    active:monthValues(window.keys,rows.rows,"active"),
  };
}

async function field(session:Session,filters:DashboardFilters) {
  if(!session.userId||!session.organizationId)return null;
  const sites=await siteOptions(session);
  const previousFilters=comparisonFilters(filters);
  const [metrics,previous,trend]=await Promise.all([
    fieldPeriodMetrics(session,filters),
    fieldPeriodMetrics(session,previousFilters),
    fieldTrend(session,filters),
  ]);
  const provider=session.role==="provider";
  const base=fieldBase(session,filters);
  const recentParams=[...base.params];
  const recentPeriod=appendPeriod(recentParams,"COALESCE(t.completed_at,t.started_at,w.updated_at)",filters);
  const recent=await query<{id:string;description:string;status:string;wo:string;number:string;title:string;priority:string;site:string}>(
    "SELECT t.id,t.description,t.status,w.id wo,w.number::text,w.title,w.priority,s.name site FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id JOIN sites s ON s.id=w.site_id WHERE "+base.predicate+" AND "+recentPeriod+" ORDER BY COALESCE(t.completed_at,t.started_at,w.updated_at) DESC LIMIT 10",
    recentParams,
  );

  let shift:{site:string}|undefined;
  if(!provider){
    const shiftParams:unknown[]=[session.organizationId,session.userId];
    let shiftWhere="sh.organization_id=$1 AND sh.user_id=$2 AND sh.status='open'";
    if(!session.accessAllSites){
      const index=shiftParams.length+1;
      shiftParams.push(session.siteIds);
      shiftWhere+=" AND sh.site_id=ANY($"+index+"::uuid[])";
    }
    shiftWhere+=appendSiteFilter(shiftParams,"sh.site_id",filters);
    const result=await query<{site:string}>("SELECT s.name site FROM attendance_shifts sh JOIN sites s ON s.id=sh.site_id WHERE "+shiftWhere+" LIMIT 1",shiftParams);
    shift=result.rows[0];
  }

  const compliance=pct(metrics.insideExec,metrics.totalExec);
  const previousCompliance=pct(previous.insideExec,previous.totalExec);
  const cards:DashboardKpiCard[]=provider?[
    {label:"Completadas",value:String(metrics.completed),hint:"Actividades del periodo",icon:"check",tone:"success",current:metrics.completed,previous:previous.completed,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Pendientes",value:String(metrics.pending),hint:"Trabajo aún no iniciado",icon:"work-order",tone:metrics.pending>0?"warning":"default",current:metrics.pending,previous:previous.pending,comparisonLabel:filters.comparisonLabel,direction:"lower-better"},
    {label:"En progreso",value:String(metrics.progress),hint:"Ejecución activa",icon:"activity",current:metrics.progress,previous:previous.progress,comparisonLabel:filters.comparisonLabel,direction:"neutral"},
    {label:"Carga activa",value:String(metrics.pending+metrics.progress),hint:"Pendientes + en progreso",icon:"company",current:metrics.pending+metrics.progress,previous:previous.pending+previous.progress,comparisonLabel:filters.comparisonLabel,direction:"lower-better"},
  ]:[
    {label:"Completadas",value:String(metrics.completed),hint:"Actividades del periodo",icon:"check",tone:"success",current:metrics.completed,previous:previous.completed,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Pendientes",value:String(metrics.pending),hint:"Trabajo aún no iniciado",icon:"work-order",tone:metrics.pending>0?"warning":"default",current:metrics.pending,previous:previous.pending,comparisonLabel:filters.comparisonLabel,direction:"lower-better"},
    {label:"Horas de campo",value:hrs(metrics.hours),hint:shift?"Turno abierto · "+shift.site:"Sin turno abierto actualmente",icon:"clock",current:metrics.hours,previous:previous.hours,comparisonLabel:filters.comparisonLabel,direction:"neutral"},
    {label:"Cumplimiento en turno",value:String(compliance)+"%",hint:String(metrics.insideExec)+"/"+String(metrics.totalExec)+" completadas dentro del turno",icon:"activity",current:compliance,previous:previousCompliance,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
  ];

  return <Frame
    session={session}
    filters={filters}
    cards={cards}
    mode="field"
    activityStatusOptions={TASK_STATUS_OPTIONS}
    siteOptions={sites}
    priorityOptions={PRIORITY_OPTIONS}
  >
    <div className="dashboard-layout-main dashboard-layout-analytics">
      <Panel eyebrow="Tendencia" title="Actividades mes a mes">
        <DashboardTrendChart labels={trend.labels} series={[
          {name:"Completadas",values:trend.completed},
          {name:"Carga activa",values:trend.active},
        ]}/>
      </Panel>
      <Panel eyebrow={provider?"Servicio":"Campo"} title={provider?"Resumen de ejecución":"Evidencia operativa"}>
        <DashboardStatTiles items={provider?[
          {label:"Completadas",value:String(metrics.completed),hint:"Cerradas en el periodo",tone:"success"},
          {label:"Pendientes",value:String(metrics.pending),hint:"Aún sin iniciar",tone:metrics.pending>0?"warning":"default"},
          {label:"En progreso",value:String(metrics.progress),hint:"Trabajo activo"},
        ]:[
          {label:"Horas registradas",value:hrs(metrics.hours),hint:"Asistencia del periodo"},
          {label:"Dentro del turno",value:String(compliance)+"%",hint:"Actividades completadas con evidencia",tone:"success"},
          {label:"Turno actual",value:shift?"Abierto":"Cerrado",hint:shift?.site||"Sin turno abierto"},
        ]}/>
      </Panel>
    </div>
    <Panel eyebrow="Trabajo reciente" title="Actividades filtradas" action={<Link className="text-button" href="/dashboard/work-orders">Ver órdenes →</Link>}><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Actividad</th><th>Sede</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(row=><tr key={row.id}><td><Link href={"/dashboard/work-orders/"+row.wo}>#{row.number}</Link></td><td>{row.description}</td><td>{row.site}</td><td>{row.priority}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></Panel>
  </Frame>;
}

function requesterBase(session:Session,filters:DashboardFilters){
  const params:unknown[]=[session.organizationId,session.userId];
  let where="w.organization_id=$1 AND w.requested_by=$2";
  if(!session.accessAllSites){
    const index=params.length+1;
    params.push(session.siteIds);
    where+=" AND w.site_id=ANY($"+index+"::uuid[])";
  }
  where+=appendSiteFilter(params,"w.site_id",filters);
  where+=appendPriorityFilter(params,"w.priority",filters);
  if(filters.activityStatus!=="all")where+=" AND "+appendValue(params,"w.status",filters.activityStatus);
  return {params,where};
}

async function requesterPeriodMetrics(session:Session,filters:DashboardFilters){
  const base=requesterBase(session,filters);
  const params=[...base.params];
  const start=params.length+1;
  params.push(filters.startDate,filters.endDateExclusive);
  const created="w.requested_at >= $"+start+"::date AND w.requested_at < $"+String(start+1)+"::date";
  const completed="w.completed_at >= $"+start+"::date AND w.completed_at < $"+String(start+1)+"::date";
  const result=await query<{open:string;done:string;total:string;hours:string;late:string}>(
    "SELECT "+
    "count(*) FILTER(WHERE "+created+" AND w.status IN ('open','assigned','in_progress','paused'))::text open,"+
    "count(*) FILTER(WHERE "+completed+" AND w.status='completed')::text done,"+
    "count(*) FILTER(WHERE "+created+")::text total,"+
    "COALESCE(avg(EXTRACT(EPOCH FROM(w.completed_at-w.requested_at))/3600) FILTER(WHERE "+completed+" AND w.completed_at IS NOT NULL),0)::numeric(12,1)::text hours,"+
    "count(*) FILTER(WHERE w.due_at >= $"+start+"::date AND w.due_at < $"+String(start+1)+"::date AND w.due_at<now() AND w.status NOT IN ('completed','cancelled'))::text late "+
    "FROM work_orders w WHERE "+base.where,
    params,
  );
  const row=result.rows[0]||{open:"0",done:"0",total:"0",hours:"0",late:"0"};
  return {open:n(row.open),done:n(row.done),total:n(row.total),hours:n(row.hours),late:n(row.late)};
}

async function requesterTrend(session:Session,filters:DashboardFilters){
  const window=trendWindow(filters);
  const base=requesterBase(session,{...filters,activityStatus:"all"});
  const createdParams=[...base.params,window.start,window.end];
  const createdStart=createdParams.length-1;
  const completedParams=[...base.params,window.start,window.end];
  const completedStart=completedParams.length-1;
  const [created,completed]=await Promise.all([
    query<{month:string;count:string}>("SELECT to_char(date_trunc('month',w.requested_at),'YYYY-MM') month,count(*)::text count FROM work_orders w WHERE "+base.where+" AND w.requested_at >= $"+createdStart+"::date AND w.requested_at < $"+String(createdStart+1)+"::date GROUP BY 1 ORDER BY 1",createdParams),
    query<{month:string;count:string}>("SELECT to_char(date_trunc('month',w.completed_at),'YYYY-MM') month,count(*)::text count FROM work_orders w WHERE "+base.where+" AND w.status='completed' AND w.completed_at >= $"+completedStart+"::date AND w.completed_at < $"+String(completedStart+1)+"::date GROUP BY 1 ORDER BY 1",completedParams),
  ]);
  return {
    labels:window.labels,
    created:monthValues(window.keys,created.rows,"count"),
    completed:monthValues(window.keys,completed.rows,"count"),
  };
}

async function requester(session:Session,filters:DashboardFilters) {
  if(!session.userId||!session.organizationId)return null;
  const sites=await siteOptions(session);
  const previousFilters=comparisonFilters(filters);
  const [metrics,previous,trend]=await Promise.all([
    requesterPeriodMetrics(session,filters),
    requesterPeriodMetrics(session,previousFilters),
    requesterTrend(session,filters),
  ]);
  const base=requesterBase(session,filters);
  const recentParams=[...base.params];
  const recentPeriod=appendPeriod(recentParams,"w.requested_at",filters);
  const priorityParams=[...base.params];
  const priorityPeriod=appendPeriod(priorityParams,"w.requested_at",filters);
  const [recent,priorities]=await Promise.all([
    query<{id:string;number:string;title:string;status:string;requested_at:string;priority:string;site:string}>("SELECT w.id,w.number::text,w.title,w.status,w.requested_at::text,w.priority,s.name site FROM work_orders w JOIN sites s ON s.id=w.site_id WHERE "+base.where+" AND "+recentPeriod+" ORDER BY w.requested_at DESC LIMIT 10",recentParams),
    query<{priority:string;count:string}>("SELECT w.priority,count(*)::text count FROM work_orders w WHERE "+base.where+" AND "+priorityPeriod+" GROUP BY w.priority ORDER BY count(*) DESC",priorityParams),
  ]);
  const priorityNames:Record<string,string>={low:"Baja",medium:"Media",high:"Alta",urgent:"Urgente"};
  const priorityRows=priorities.rows.map(row=>({key:row.priority,label:priorityNames[row.priority]||row.priority,count:n(row.count)}));
  const resolution=pct(metrics.done,metrics.open+metrics.done);
  const previousResolution=pct(previous.done,previous.open+previous.done);

  const cards:DashboardKpiCard[]=[
    {label:"Abiertas",value:String(metrics.open),hint:String(metrics.late)+" vencidas con compromiso en el periodo",icon:"work-order",tone:metrics.open>0?"warning":"default",href:"/dashboard/work-orders",current:metrics.open,previous:previous.open,comparisonLabel:filters.comparisonLabel,direction:"lower-better"},
    {label:"Cerradas",value:String(metrics.done),hint:"Solicitudes completadas",icon:"check",tone:"success",current:metrics.done,previous:previous.done,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
    {label:"Tiempo medio",value:hrs(metrics.hours),hint:"Resolución de solicitudes completadas",icon:"clock",current:metrics.hours,previous:previous.hours,comparisonLabel:filters.comparisonLabel,direction:"lower-better"},
    {label:"Resolución",value:String(resolution)+"%",hint:"Cerradas frente a abiertas",icon:"activity",current:resolution,previous:previousResolution,comparisonLabel:filters.comparisonLabel,direction:"higher-better"},
  ];

  return <Frame
    session={session}
    filters={filters}
    cards={cards}
    mode="requester"
    activityStatusOptions={WORK_ORDER_STATUS_OPTIONS}
    siteOptions={sites}
    priorityOptions={PRIORITY_OPTIONS}
  >
    <div className="dashboard-layout-main dashboard-layout-analytics">
      <Panel eyebrow="Tendencia" title="Solicitudes mes a mes">
        <DashboardTrendChart labels={trend.labels} series={[
          {name:"Creadas",values:trend.created},
          {name:"Cerradas",values:trend.completed},
        ]}/>
      </Panel>
      <Panel eyebrow="Prioridad" title="Distribución de solicitudes">{priorityRows.length?<Bars rows={priorityRows}/>:<Empty>No hay solicitudes en el periodo.</Empty>}</Panel>
    </div>
    <Panel eyebrow="Seguimiento" title="Solicitudes filtradas"><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>OT</th><th>Solicitud</th><th>Sede</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>{recent.rows.map(row=><tr key={row.id}><td><Link href={"/dashboard/work-orders/"+row.id}>#{row.number}</Link></td><td>{row.title}</td><td>{row.site}</td><td>{row.priority}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></Panel>
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
