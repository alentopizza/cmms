import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { RoutineCreateModal } from "@/components/ContextCreateModals";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader, { type ModuleFacetOptionMap } from "@/components/ModuleHeader";
import { MaintenanceCard } from "@/components/business-ui";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Badge } from "@/components/ui-kit/Badge";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import { UrlPagination } from "@/components/ui-kit/UrlPagination";

type AssetOption={id:string;organization_id:string;site_id:string;name:string;code:string;label:string};
type PlanRow={id:string;organization_id:string;site_id:string;site:string;name:string;asset_id:string;asset_has_image:boolean;asset:string;company:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean};
type RoutineSummary={total_count:number;filtered_count:number;active_count:number;overdue_count:number;due_soon_count:number};
type RoutineFacetValue={value:string;label:string};
type RoutineFacetRow={organizations:RoutineFacetValue[];sites:RoutineFacetValue[];frequencies:RoutineFacetValue[]};
type RoutineSearchParams={
  created?:string;error?:string;q?:string;status?:string;organization?:string;site?:string;frequency?:string;sort?:string;page?:string;
};

const ROUTINE_PAGE_SIZE=24;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROUTINE_STATUSES=new Set(["all","active","inactive"]);
const ROUTINE_FREQUENCIES=new Set(["day","week","month","year","meter"]);
const ROUTINE_SORTS=new Set(["due"]);

function safeText(value:string|undefined,max=120){
  return String(value||"").trim().slice(0,max);
}
function safeUuid(value:string|undefined){
  const normalized=safeText(value,36);
  return UUID_RE.test(normalized)?normalized:"";
}
function safePage(value:string|undefined){
  const parsed=Number.parseInt(String(value||"1"),10);
  return Number.isFinite(parsed)&&parsed>0?parsed:1;
}
function likePattern(value:string){
  return "%"+value.replace(/[\\%_]/g,match=>"\\"+match)+"%";
}
function frequencyLabel(value:string){
  return ({day:"Día",week:"Semana",month:"Mes",year:"Año",meter:"Medidor"} as Record<string,string>)[value]||value;
}
function routinePageWindow(page:number){
  return {limit:ROUTINE_PAGE_SIZE,offset:(page-1)*ROUTINE_PAGE_SIZE};
}

// ── Responsive maintenance directory: desktop table + mobile cards ─────────

export default async function MaintenancePage({searchParams}:{searchParams:Promise<RoutineSearchParams>}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "maintenance.read")) redirect("/dashboard");
  const feedback=await searchParams;
  const canWrite=can(session,"maintenance.write");
  const canReadAssets=can(session,"assets.read");
  const owner=isPlatformOwner(session);
  const platform=session.platformRole!=="user";
  const organizationScope=organizationScopeFor(session);
  const platformScopeParams:unknown[]=[organizationScope.unrestricted,organizationScope.organizationIds];
  const creationGatePromise=getCreationGateForScope("routine",session.organizationId,platform,session.platformRole==="superadmin"?session.platformOrganizationIds:undefined);

  const q=safeText(feedback.q);
  const status=ROUTINE_STATUSES.has(feedback.status||"")?String(feedback.status):"all";
  const organization=safeUuid(feedback.organization);
  const site=safeUuid(feedback.site);
  const frequency=ROUTINE_FREQUENCIES.has(feedback.frequency||"")?String(feedback.frequency):"";
  const sort=ROUTINE_SORTS.has(feedback.sort||"")?String(feedback.sort):"due";
  const requestedPage=safePage(feedback.page);

  const scopeParams:unknown[]=[];
  const scopeConditions:string[]=[];
  if(session.platformRole==="superadmin"){
    scopeParams.push(organizationScope.organizationIds);
    scopeConditions.push("p.organization_id=ANY($"+scopeParams.length+"::uuid[])");
  }else if(session.platformRole==="user"){
    scopeParams.push(session.organizationId);
    scopeConditions.push("p.organization_id=$"+scopeParams.length);
    if(!session.accessAllSites){
      scopeParams.push(session.siteIds);
      scopeConditions.push("a.site_id=ANY($"+scopeParams.length+"::uuid[])");
    }
  }
  const scopeWhere=scopeConditions.length?"WHERE "+scopeConditions.join(" AND "):"";
  const scopedSql=`
    SELECT p.id,p.organization_id,a.site_id,s.name site,p.name,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,
           a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at,p.active
    FROM maintenance_plans p
    JOIN assets a ON a.id=p.asset_id
    JOIN organizations o ON o.id=p.organization_id
    JOIN sites s ON s.id=a.site_id
    ${scopeWhere}`;

  const filteredParams=[...scopeParams];
  const filteredConditions:string[]=[];
  if(q){
    filteredParams.push(likePattern(q));
    const token="$"+filteredParams.length;
    filteredConditions.push(`(name ILIKE ${token} ESCAPE E'\\\\' OR asset ILIKE ${token} ESCAPE E'\\\\' OR company ILIKE ${token} ESCAPE E'\\\\' OR site ILIKE ${token} ESCAPE E'\\\\' OR frequency_unit ILIKE ${token} ESCAPE E'\\\\')`);
  }
  if(status!=="all"){
    filteredParams.push(status==="active");
    filteredConditions.push("active=$"+filteredParams.length);
  }
  if(organization){
    filteredParams.push(organization);
    filteredConditions.push("organization_id=$"+filteredParams.length+"::uuid");
  }
  if(site){
    filteredParams.push(site);
    filteredConditions.push("site_id=$"+filteredParams.length+"::uuid");
  }
  if(frequency){
    filteredParams.push(frequency);
    filteredConditions.push("frequency_unit=$"+filteredParams.length);
  }
  const filteredWhere=filteredConditions.length?"WHERE "+filteredConditions.join(" AND "):"";

  const today=new Date();
  today.setHours(0,0,0,0);
  const dueSoonEnd=new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate()+8);
  const summaryParams=[...filteredParams,today.toISOString(),dueSoonEnd.toISOString()];
  const todayToken="$"+(summaryParams.length-1);
  const dueSoonToken="$"+summaryParams.length;

  const summaryPromise=query<RoutineSummary>(
    `WITH scoped AS (${scopedSql}),
          filtered AS (SELECT * FROM scoped ${filteredWhere})
     SELECT
       (SELECT count(*)::int FROM scoped) total_count,
       (SELECT count(*)::int FROM filtered) filtered_count,
       (SELECT count(*)::int FROM scoped WHERE active=true) active_count,
       (SELECT count(*)::int FROM scoped WHERE active=true AND next_due_at IS NOT NULL AND next_due_at<${todayToken}::timestamptz) overdue_count,
       (SELECT count(*)::int FROM scoped WHERE active=true AND next_due_at>=${todayToken}::timestamptz AND next_due_at<${dueSoonToken}::timestamptz) due_soon_count`,
    summaryParams,
  );

  const facetsPromise=query<RoutineFacetRow>(
    `WITH scoped AS (${scopedSql})
     SELECT
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT organization_id::text value,company label FROM scoped) value_row),'[]'::jsonb) organizations,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT site_id::text value,site label FROM scoped) value_row),'[]'::jsonb) sites,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT frequency_unit value,frequency_unit label FROM scoped) value_row),'[]'::jsonb) frequencies`,
    scopeParams,
  );

  const assetsPromise=canWrite
    ? platform
      ? query<AssetOption>(
          `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,o.name||' · '||s.name||' · '||a.code||' '||a.name label
           FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
           WHERE a.status<>'retired' AND ($1::boolean OR a.organization_id=ANY($2::uuid[])) ORDER BY o.name,s.name,a.name`,platformScopeParams)
      : session.accessAllSites
        ? query<AssetOption>(
            `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,s.name||' · '||a.code||' '||a.name label
             FROM assets a JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.status<>'retired' ORDER BY s.name,a.name`,
            [session.organizationId])
        : query<AssetOption>(
            `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,s.name||' · '||a.code||' '||a.name label
             FROM assets a JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.status<>'retired' AND a.site_id=ANY($2::uuid[])
             ORDER BY s.name,a.name`,
            [session.organizationId,session.siteIds])
    : Promise.resolve({rows:[]} as {rows:AssetOption[]});

  const [creationGate,summaryResult,facetsResult,assets]=await Promise.all([
    creationGatePromise,summaryPromise,facetsPromise,assetsPromise,
  ]);
  const summary=summaryResult.rows[0]||{total_count:0,filtered_count:0,active_count:0,overdue_count:0,due_soon_count:0};
  const pageCount=Math.max(1,Math.ceil(summary.filtered_count/ROUTINE_PAGE_SIZE));
  const page=Math.min(requestedPage,pageCount);
  if(requestedPage!==page){
    const canonical=new URLSearchParams();
    if(feedback.created)canonical.set("created",feedback.created);
    if(feedback.error)canonical.set("error",feedback.error);
    if(q)canonical.set("q",q);
    if(status!=="all")canonical.set("status",status);
    if(organization)canonical.set("organization",organization);
    if(site)canonical.set("site",site);
    if(frequency)canonical.set("frequency",frequency);
    if(sort!=="due")canonical.set("sort",sort);
    if(page>1)canonical.set("page",String(page));
    const queryString=canonical.toString();
    redirect(queryString?"/dashboard/maintenance?"+queryString:"/dashboard/maintenance");
  }
  const pageWindow=routinePageWindow(page);
  const pageParams=[...filteredParams,pageWindow.limit,pageWindow.offset];
  const limitToken="$"+(pageParams.length-1);
  const offsetToken="$"+pageParams.length;
  const orderSql=sort==="due"?"next_due_at ASC NULLS LAST,name ASC,id ASC":"next_due_at ASC NULLS LAST,name ASC,id ASC";
  const plans=await query<PlanRow>(
    `WITH scoped AS (${scopedSql})
     SELECT id,organization_id,site_id,site,name,asset_id,asset_has_image,asset,company,frequency_value,frequency_unit,next_due_at::text,active
     FROM scoped
     ${filteredWhere}
     ORDER BY ${orderSql}
     LIMIT ${limitToken} OFFSET ${offsetToken}`,
    pageParams,
  );

  const rawFacets=facetsResult.rows[0]||{organizations:[],sites:[],frequencies:[]};
  const facetOptions:ModuleFacetOptionMap={
    organization:Array.isArray(rawFacets.organizations)?rawFacets.organizations:[],
    site:Array.isArray(rawFacets.sites)?rawFacets.sites:[],
    frequency:(Array.isArray(rawFacets.frequencies)?rawFacets.frequencies:[]).map(item=>({...item,label:frequencyLabel(item.value)})),
  };

  return <div className="phase9-maintenance">
    <ModuleHeader
      eyebrow="Mantenimiento preventivo"
      title="Rutinas"
      description="Planes por calendario asociados a los activos visibles para tu cuenta."
      count={summary.total_count}
      countLabel="rutinas"
      searchPlaceholder="Buscar rutina, empresa, sede o activo"
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"frequency",label:"Frecuencia",allLabel:"Todas las frecuencias"},
      ]}
      serverState={{
        search:q,
        filter:status,
        facetValues:{organization,site,frequency},
        facetOptions,
        filteredCount:summary.filtered_count,
      }}
      action={canWrite && creationGate.ready ? <RoutineCreateModal triggerLabel="Agregar" assets={assets.rows} returnTo="/dashboard/maintenance" /> : undefined}
    />
    {feedback.created==="routine" && <div className="section"><Alert variant="success" title="Rutina creada">Rutina creada correctamente.</Alert></div>}
    {feedback.error && <div className="section"><Alert variant="danger" title="No fue posible crear la rutina">{feedback.error==="sequence" ? creationGate.message : "Revisa los datos e inténtalo nuevamente."}</Alert></div>}
    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="maintenance"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/assets"}
      action={creationGate.action || "Continuar"}
    />}
    {creationGate.ready && <section className="section phase9-maintenance-note"><Alert variant="info" title="Creación contextual">Desde el módulo puedes escoger el activo. Si creas la rutina entrando al activo, esa relación queda preseleccionada automáticamente.</Alert></section>}
    <MetricGrid className="section phase9-kpi-grid">
      <KpiCard label="Rutinas visibles" value={String(summary.total_count)} hint="según tu alcance" icon="maintenance"/>
      <KpiCard label="Activas" value={String(summary.active_count)} hint="planes habilitados" icon="check" tone="success"/>
      <KpiCard label="Vencidas" value={String(summary.overdue_count)} hint="fecha anterior a hoy" icon="warning" tone={summary.overdue_count?"danger":"success"}/>
      <KpiCard label="Próximos 7 días" value={String(summary.due_soon_count)} hint="vencimientos próximos" icon="clock" tone={summary.due_soon_count?"warning":"default"}/>
    </MetricGrid>
    <section className="section maintenance-directory-section">
      <CollectionView storageKey="maintenance" label="Vista de rutinas" grid={<div className="maintenance-mobile-list" data-collection-grid>
        {plans.rows.map(p=><MaintenanceCard
          key={p.id}
          name={p.name}
          asset={p.asset}
          company={p.company}
          frequency={"Cada "+p.frequency_value+" "+p.frequency_unit}
          nextDue={p.next_due_at ? new Date(p.next_due_at).toLocaleDateString("es-CO") : "Sin programar"}
          active={p.active}
          recordProps={{
            "data-module-record":true,"data-status":p.active?"active":"inactive",
            "data-search":[p.name,p.asset,p.company,p.site,p.frequency_unit].filter(Boolean).join(" "),
            "data-filter-organization":p.organization_id,"data-filter-organization-label":p.company,
            "data-filter-site":p.site_id,"data-filter-site-label":p.site,
            "data-filter-frequency":p.frequency_unit,"data-filter-frequency-label":p.frequency_unit,
          }}
          actions={owner?<OwnerRecordActions table="maintenance_plans" id={p.id} label={p.name} fields={[
            {name:"name",label:"Nombre",value:p.name},
            {name:"frequency_value",label:"Frecuencia",value:p.frequency_value,type:"number"},
            {name:"frequency_unit",label:"Unidad",value:p.frequency_unit,type:"select",options:[
              {value:"day",label:"Día"},{value:"week",label:"Semana"},{value:"month",label:"Mes"},{value:"year",label:"Año"},{value:"meter",label:"Medidor"}
            ]},
            {name:"next_due_at",label:"Próxima ejecución",value:p.next_due_at?p.next_due_at.slice(0,10):"",type:"date"},
            {name:"active",label:"Estado",value:p.active,type:"checkbox"},
          ]}/>:undefined}
        />)}
      </div>} list={<StaticDataTable
        className="maintenance-directory-table"
        caption="Rutinas de mantenimiento preventivo"
        columns={[
          {key:"plan",label:"Rutina",width:"34%"},
          {key:"company",label:"Empresa"},
          {key:"asset",label:"Equipo"},
          {key:"due",label:"Próximo vencimiento"},
          {key:"state",label:"Estado"},
          ...(owner?[{key:"actions",label:"Acciones",align:"end" as const}]:[]),
        ]}
        rows={plans.rows.map(p=>({id:p.id,recordProps:{
          "data-module-record":true,"data-status":p.active?"active":"inactive",
          "data-search":[p.name,p.asset,p.company,p.site,p.frequency_unit].filter(Boolean).join(" "),
          "data-filter-organization":p.organization_id,"data-filter-organization-label":p.company,
          "data-filter-site":p.site_id,"data-filter-site-label":p.site,
          "data-filter-frequency":p.frequency_unit,"data-filter-frequency-label":p.frequency_unit,
        },cells:{
          plan:<EntityIdentityCell
            imageSrc={canReadAssets&&p.asset_has_image?"/api/assets/"+p.asset_id+"/image":null}
            imageAlt={canReadAssets&&p.asset_has_image?"Imagen de "+p.asset:""}
            icon="maintenance"
            variant="thumbnail"
            title={p.name}
            subtitle={"Cada "+p.frequency_value+" "+p.frequency_unit}
            meta={p.site}
          />,
          company:p.company,
          asset:p.asset,
          due:p.next_due_at?new Date(p.next_due_at).toLocaleDateString("es-CO"):"Sin programar",
          state:<Badge variant={p.active?"success":"neutral"}>{p.active?"Activa":"Inactiva"}</Badge>,
          ...(owner?{actions:<ListQuickActions><OwnerRecordActions table="maintenance_plans" id={p.id} label={p.name} fields={[
            {name:"name",label:"Nombre",value:p.name},
            {name:"frequency_value",label:"Frecuencia",value:p.frequency_value,type:"number"},
            {name:"frequency_unit",label:"Unidad",value:p.frequency_unit,type:"select",options:[
              {value:"day",label:"Día"},{value:"week",label:"Semana"},{value:"month",label:"Mes"},{value:"year",label:"Año"},{value:"meter",label:"Medidor"}
            ]},
            {name:"next_due_at",label:"Próxima ejecución",value:p.next_due_at?p.next_due_at.slice(0,10):"",type:"date"},
            {name:"active",label:"Estado",value:p.active,type:"checkbox"},
          ]}/></ListQuickActions>}:{})
        }}))}
        empty={<EmptyState icon="file" title="No hay rutinas disponibles" description="Cuando existan rutinas visibles para tu alcance aparecerán aquí."/>}
      />}/>
      <UrlPagination page={page} pageCount={pageCount} label="Páginas de rutinas"/>
    </section>
  </div>;
}
