import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader, { type ModuleFacetOptionMap } from "@/components/ModuleHeader";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import CreateRecordModal from "@/components/CreateRecordModal";
import { WorkOrderCard } from "@/components/business-ui";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import UiIcon from "@/components/UiIcon";
import { PriorityBadge, WorkOrderStatusBadge } from "@/components/maintenance-ui/OperationStatus";
import { UrlPagination } from "@/components/ui-kit/UrlPagination";

type OrderRow={id:string;organization_id:string;site_id:string;site:string;number:string;title:string;asset_id:string|null;asset_has_image:boolean;asset:string;company:string;type:string;priority:string;status:string;requested_at:string};

type WorkOrderSummary={total_count:number;filtered_count:number;active_count:number;in_progress_count:number;urgent_count:number;completed_count:number};
type WorkOrderFacetValue={value:string;label:string};
type WorkOrderFacetRow={organizations:WorkOrderFacetValue[];sites:WorkOrderFacetValue[];priorities:WorkOrderFacetValue[];types:WorkOrderFacetValue[]};
type WorkOrderSearchParams={error?:string;q?:string;status?:string;organization?:string;site?:string;priority?:string;type?:string;sort?:string;page?:string};

const WORK_ORDER_PAGE_SIZE=24;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_ORDER_STATUSES=new Set(["all","open","assigned","in_progress","paused","completed","cancelled"]);
const WORK_ORDER_PRIORITIES=new Set(["low","medium","high","urgent"]);
const WORK_ORDER_TYPES=new Set(["corrective","preventive","inspection","emergency","improvement"]);
const WORK_ORDER_SORTS=new Set(["requested"]);

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
function workOrderPageWindow(page:number){
  return {limit:WORK_ORDER_PAGE_SIZE,offset:(page-1)*WORK_ORDER_PAGE_SIZE};
}

// ── Responsive work-order directory: desktop table + mobile cards ──────────

export default async function WorkOrdersPage({searchParams}:{searchParams:Promise<WorkOrderSearchParams>}) {
  const session=await getSession();
  const feedback=await searchParams;
  if(!session) redirect("/login");
  if(!can(session,"work_orders.read")) redirect("/dashboard");

  const platform=session.platformRole!=="user";
  const orgId=session.organizationId;
  const organizationScope=organizationScopeFor(session);
  const platformScopeParams:unknown[]=[organizationScope.unrestricted,organizationScope.organizationIds];
  const canWrite=can(session,"work_orders.write");
  const canReadAssets=can(session,"assets.read");
  const owner=isPlatformOwner(session);
  const creationGatePromise=getCreationGateForScope("work_order",session.organizationId,platform,session.platformRole==="superadmin"?session.platformOrganizationIds:undefined);
  const requesterOnly=session.role==="requester"&&Boolean(session.userId);
  const providerOnly=session.role==="provider"&&Boolean(session.userId);
  const externalOnly=session.role==="external"&&Boolean(session.userId);

  const q=safeText(feedback.q);
  const status=WORK_ORDER_STATUSES.has(feedback.status||"")?String(feedback.status):"all";
  const organization=safeUuid(feedback.organization);
  const site=safeUuid(feedback.site);
  const priority=WORK_ORDER_PRIORITIES.has(feedback.priority||"")?String(feedback.priority):"";
  const type=WORK_ORDER_TYPES.has(feedback.type||"")?String(feedback.type):"";
  const sort=WORK_ORDER_SORTS.has(feedback.sort||"")?String(feedback.sort):"requested";
  const requestedPage=safePage(feedback.page);

  const scopeParams:unknown[]=[];
  const scopeConditions:string[]=[];
  if(session.platformRole==="superadmin"){
    scopeParams.push(organizationScope.organizationIds);
    scopeConditions.push("w.organization_id=ANY($"+scopeParams.length+"::uuid[])");
  }else if(session.platformRole==="user"){
    scopeParams.push(orgId);
    scopeConditions.push("w.organization_id=$"+scopeParams.length);

    if(requesterOnly){
      scopeParams.push(session.userId);
      scopeConditions.push("w.requested_by=$"+scopeParams.length);
    }else if(providerOnly){
      scopeParams.push(session.externalSupplierId);
      const supplierToken="$"+scopeParams.length;
      scopeConditions.push(supplierToken+"::uuid IS NOT NULL AND (w.service_supplier_id="+supplierToken+" OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id="+supplierToken+"))");
    }else if(externalOnly){
      scopeParams.push(session.userId);
      const userToken="$"+scopeParams.length;
      scopeConditions.push("(w.assigned_to="+userToken+" OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (t.assigned_to="+userToken+" OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id="+userToken+"))))");
    }

    if(!session.accessAllSites){
      scopeParams.push(session.siteIds);
      scopeConditions.push("w.site_id=ANY($"+scopeParams.length+"::uuid[])");
    }
  }
  const scopeWhere=scopeConditions.length?"WHERE "+scopeConditions.join(" AND "):"";
  const scopedSql=`
    SELECT DISTINCT w.id,w.organization_id,w.site_id,s.name site,w.number::text number,w.title,
           a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,
           o.name company,w.type,w.priority,w.status,w.requested_at
    FROM work_orders w
    JOIN organizations o ON o.id=w.organization_id
    JOIN sites s ON s.id=w.site_id
    LEFT JOIN assets a ON a.id=w.asset_id
    ${scopeWhere}`;

  const filteredParams=[...scopeParams];
  const filteredConditions:string[]=[];
  if(q){
    filteredParams.push(likePattern(q));
    const token="$"+filteredParams.length;
    filteredConditions.push(`(number ILIKE ${token} ESCAPE E'\\\\' OR title ILIKE ${token} ESCAPE E'\\\\' OR company ILIKE ${token} ESCAPE E'\\\\' OR site ILIKE ${token} ESCAPE E'\\\\' OR asset ILIKE ${token} ESCAPE E'\\\\' OR type ILIKE ${token} ESCAPE E'\\\\' OR priority ILIKE ${token} ESCAPE E'\\\\' OR status ILIKE ${token} ESCAPE E'\\\\')`);
  }
  if(status!=="all"){
    filteredParams.push(status);
    filteredConditions.push("status=$"+filteredParams.length);
  }
  if(organization){
    filteredParams.push(organization);
    filteredConditions.push("organization_id=$"+filteredParams.length+"::uuid");
  }
  if(site){
    filteredParams.push(site);
    filteredConditions.push("site_id=$"+filteredParams.length+"::uuid");
  }
  if(priority){
    filteredParams.push(priority);
    filteredConditions.push("priority=$"+filteredParams.length);
  }
  if(type){
    filteredParams.push(type);
    filteredConditions.push("type=$"+filteredParams.length);
  }
  const filteredWhere=filteredConditions.length?"WHERE "+filteredConditions.join(" AND "):"";

  const summaryPromise=query<WorkOrderSummary>(
    `WITH scoped AS (${scopedSql}),
          filtered AS (SELECT * FROM scoped ${filteredWhere})
     SELECT
       (SELECT count(*)::int FROM scoped) total_count,
       (SELECT count(*)::int FROM filtered) filtered_count,
       (SELECT count(*)::int FROM scoped WHERE status NOT IN ('completed','cancelled')) active_count,
       (SELECT count(*)::int FROM scoped WHERE status='in_progress') in_progress_count,
       (SELECT count(*)::int FROM scoped WHERE priority='urgent' AND status NOT IN ('completed','cancelled')) urgent_count,
       (SELECT count(*)::int FROM scoped WHERE status='completed') completed_count`,
    filteredParams,
  );

  const facetsPromise=query<WorkOrderFacetRow>(
    `WITH scoped AS (${scopedSql})
     SELECT
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT organization_id::text value,company label FROM scoped) value_row),'[]'::jsonb) organizations,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT site_id::text value,site label FROM scoped) value_row),'[]'::jsonb) sites,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.value)
                 FROM (SELECT DISTINCT priority value,priority label FROM scoped) value_row),'[]'::jsonb) priorities,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.value)
                 FROM (SELECT DISTINCT type value,type label FROM scoped) value_row),'[]'::jsonb) types`,
    scopeParams,
  );

  const assetsPromise=canWrite
    ? platform
      ? query<{id:string;label:string}>(`SELECT a.id,o.name||' · '||s.name||' · '||a.code||' '||a.name label FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id WHERE a.status<>'retired' AND ($1::boolean OR a.organization_id=ANY($2::uuid[])) ORDER BY o.name,a.name`,platformScopeParams)
      : session.accessAllSites
        ? query<{id:string;label:string}>(`SELECT a.id,s.name||' · '||a.code||' '||a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.status<>'retired' ORDER BY a.name`,[orgId])
        : query<{id:string;label:string}>(`SELECT a.id,s.name||' · '||a.code||' '||a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[]) AND a.status<>'retired' ORDER BY a.name`,[orgId,session.siteIds])
    : Promise.resolve({rows:[]} as {rows:{id:string;label:string}[]});

  const [creationGate,summaryResult,facetsResult,assets]=await Promise.all([
    creationGatePromise,summaryPromise,facetsPromise,assetsPromise,
  ]);
  const summary=summaryResult.rows[0]||{total_count:0,filtered_count:0,active_count:0,in_progress_count:0,urgent_count:0,completed_count:0};
  const pageCount=Math.max(1,Math.ceil(summary.filtered_count/WORK_ORDER_PAGE_SIZE));
  const page=Math.min(requestedPage,pageCount);
  if(requestedPage!==page){
    const canonical=new URLSearchParams();
    if(feedback.error)canonical.set("error",feedback.error);
    if(q)canonical.set("q",q);
    if(status!=="all")canonical.set("status",status);
    if(organization)canonical.set("organization",organization);
    if(site)canonical.set("site",site);
    if(priority)canonical.set("priority",priority);
    if(type)canonical.set("type",type);
    if(sort!=="requested")canonical.set("sort",sort);
    if(page>1)canonical.set("page",String(page));
    const queryString=canonical.toString();
    redirect(queryString?"/dashboard/work-orders?"+queryString:"/dashboard/work-orders");
  }

  const pageWindow=workOrderPageWindow(page);
  const pageParams=[...filteredParams,pageWindow.limit,pageWindow.offset];
  const limitToken="$"+(pageParams.length-1);
  const offsetToken="$"+pageParams.length;
  const orderSql=sort==="requested"?"requested_at DESC,id DESC":"requested_at DESC,id DESC";
  const orders=await query<OrderRow>(
    `WITH scoped AS (${scopedSql})
     SELECT id,organization_id,site_id,site,number,title,asset_id,asset_has_image,asset,company,type,priority,status,requested_at::text
     FROM scoped
     ${filteredWhere}
     ORDER BY ${orderSql}
     LIMIT ${limitToken} OFFSET ${offsetToken}`,
    pageParams,
  );

  const rawFacets=facetsResult.rows[0]||{organizations:[],sites:[],priorities:[],types:[]};
  const facetOptions:ModuleFacetOptionMap={
    organization:Array.isArray(rawFacets.organizations)?rawFacets.organizations:[],
    site:Array.isArray(rawFacets.sites)?rawFacets.sites:[],
    priority:Array.isArray(rawFacets.priorities)?rawFacets.priorities:[],
    type:Array.isArray(rawFacets.types)?rawFacets.types:[],
  };

  const activeOrders=summary.active_count;
  const urgentOrders=summary.urgent_count;
  const inProgressOrders=summary.in_progress_count;
  const completedOrders=summary.completed_count;

  return <div className="phase9-work-orders">
    <ModuleHeader
      eyebrow="Mantenimiento"
      title="Órdenes de trabajo"
      description={providerOnly?"Solo ves trabajo asignado a tu empresa proveedora.":externalOnly?"Solo ves órdenes y actividades asignadas directamente a tu cuenta o cuadrilla.":requesterOnly?"Consulta y registra tus solicitudes de mantenimiento.":"Correctivos, preventivos, inspecciones y emergencias."}
      count={summary.total_count}
      countLabel="órdenes"
      searchPlaceholder="Buscar OT, trabajo, empresa o equipo"
      filters={[
        {value:"all",label:"Todas"},
        {value:"open",label:"Abiertas"},
        {value:"assigned",label:"Asignadas"},
        {value:"in_progress",label:"En progreso"},
        {value:"paused",label:"Pausadas"},
        {value:"completed",label:"Completadas"},
        {value:"cancelled",label:"Canceladas"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"priority",label:"Prioridad",allLabel:"Todas las prioridades"},
        {key:"type",label:"Tipo",allLabel:"Todos los tipos"},
      ]}
      serverState={{
        search:q,
        filter:status,
        facetValues:{organization,site,priority,type},
        facetOptions,
        filteredCount:summary.filtered_count,
      }}
      action={canWrite && creationGate.ready && assets.rows.length>0 ? <CreateRecordModal title={requesterOnly?"Crear solicitud":"Crear orden de trabajo"} eyebrow={requesterOnly?"Nueva solicitud":"Nueva orden"} description="Relaciona el trabajo con un activo y define los datos iniciales de atención." triggerLabel="Agregar" iconName="work-order">
        <form className="form-grid unified-popup-form" method="post" action="/api/work-orders">
          <div className="field form-span-2"><label>Equipo *</label><select name="asset_id" required><option value="">Selecciona un activo</option>{assets.rows.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
          <div className="field form-span-2"><label>Título *</label><input name="title" required placeholder="Ej. Revisar temperatura irregular en cámara 02"/></div>
          {!requesterOnly && <><div className="field"><label>Tipo</label><select name="type"><option value="corrective">Correctivo</option><option value="preventive">Preventivo</option><option value="inspection">Inspección</option><option value="emergency">Emergencia</option><option value="improvement">Mejora</option></select></div><div className="field"><label>Prioridad</label><select name="priority"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div></>}
          <div className="form-span-2 form-actions"><button className="button" type="submit">{requesterOnly?"Enviar solicitud":"Crear orden"}</button></div>
        </form>
      </CreateRecordModal> : undefined}
    />

    {feedback.error==="sequence" && <div className="section"><Alert variant="danger" title="Jerarquía incompleta">{creationGate.message}</Alert></div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="work-order"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/assets"}
      action={creationGate.action || "Continuar"}
    />}

    <MetricGrid className="section phase9-kpi-grid">
      <KpiCard label="Órdenes activas" value={String(activeOrders)} hint="abiertas, asignadas, en progreso o pausadas" icon="work-order"/>
      <KpiCard label="En progreso" value={String(inProgressOrders)} hint="ejecución activa" icon="activity" tone="info"/>
      <KpiCard label="Urgentes" value={String(urgentOrders)} hint="pendientes de cierre" icon="warning" tone={urgentOrders?"danger":"success"}/>
      <KpiCard label="Completadas" value={String(completedOrders)} hint="según tu alcance" icon="check" tone="success"/>
    </MetricGrid>
    <section className="section work-order-directory-section">
      <CollectionView storageKey="work-orders" label="Vista de órdenes" grid={<div className="work-order-mobile-list" data-collection-grid>
        {orders.rows.map(w=><WorkOrderCard
          key={w.id}
          id={w.id}
          number={w.number}
          title={w.title}
          asset={w.asset}
          company={w.company}
          priority={w.priority}
          status={w.status}
          recordProps={{
            "data-module-record":true,"data-status":w.status,
            "data-search":[w.number,w.title,w.company,w.site,w.asset,w.type,w.priority,w.status].join(" "),
            "data-filter-organization":w.organization_id,"data-filter-organization-label":w.company,
            "data-filter-site":w.site_id,"data-filter-site-label":w.site,
            "data-filter-priority":w.priority,"data-filter-priority-label":w.priority,
            "data-filter-type":w.type,"data-filter-type-label":w.type,
          }}
          actions={owner?<OwnerRecordActions table="work_orders" id={w.id} label={"OT #"+w.number} fields={[
            {name:"title",label:"Título",value:w.title},
            {name:"priority",label:"Prioridad",value:w.priority,type:"select",options:[
              {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"}
            ]},
            {name:"status",label:"Estado",value:w.status,type:"select",options:[
              {value:"open",label:"Abierta"},{value:"assigned",label:"Asignada"},{value:"in_progress",label:"En progreso"},{value:"paused",label:"Pausada"},{value:"completed",label:"Completada"},{value:"cancelled",label:"Cancelada"}
            ]},
          ]}/>:undefined}
        />)}
      </div>} list={<StaticDataTable
        className="work-order-directory-table"
        caption="Órdenes de trabajo visibles"
        columns={[
          {key:"order",label:"Orden",width:"34%"},
          {key:"company",label:"Empresa"},
          {key:"asset",label:"Equipo"},
          {key:"priority",label:"Prioridad"},
          {key:"status",label:"Estado"},
          {key:"actions",label:"Acciones",align:"end"},
        ]}
        rows={orders.rows.map(w=>({id:w.id,recordProps:{
          "data-module-record":true,"data-status":w.status,
          "data-search":[w.number,w.title,w.company,w.site,w.asset,w.type,w.priority,w.status].join(" "),
          "data-filter-organization":w.organization_id,"data-filter-organization-label":w.company,
          "data-filter-site":w.site_id,"data-filter-site-label":w.site,
          "data-filter-priority":w.priority,"data-filter-priority-label":w.priority,
          "data-filter-type":w.type,"data-filter-type-label":w.type,
        },cells:{
          order:<EntityIdentityCell
            imageSrc={canReadAssets&&w.asset_id&&w.asset_has_image?"/api/assets/"+w.asset_id+"/image":null}
            imageAlt={canReadAssets&&w.asset_id&&w.asset_has_image?"Imagen de "+w.asset:""}
            icon="work-order"
            variant="thumbnail"
            title={"OT #"+w.number}
            subtitle={w.title}
            meta={[w.type,w.site].filter(Boolean).join(" · ")}
          />,
          company:w.company,
          asset:w.asset,
          priority:<PriorityBadge priority={w.priority}/>,
          status:<WorkOrderStatusBadge status={w.status}/>,
          actions:<ListQuickActions>
            <Link className="ds-list-action primary" href={"/dashboard/work-orders/"+w.id} title="Ver actividades" data-tooltip="Ver actividades" aria-label={"Ver actividades de OT #"+w.number}><UiIcon name="eye" size={16}/></Link>
            {owner&&<OwnerRecordActions table="work_orders" id={w.id} label={"OT #"+w.number} fields={[
              {name:"title",label:"Título",value:w.title},
              {name:"priority",label:"Prioridad",value:w.priority,type:"select",options:[
                {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"}
              ]},
              {name:"status",label:"Estado",value:w.status,type:"select",options:[
                {value:"open",label:"Abierta"},{value:"assigned",label:"Asignada"},{value:"in_progress",label:"En progreso"},{value:"paused",label:"Pausada"},{value:"completed",label:"Completada"},{value:"cancelled",label:"Cancelada"}
              ]},
            ]}/>}
          </ListQuickActions>,
        }}))}
        empty={(providerOnly||externalOnly||creationGate.ready)?<EmptyState icon="file" title="No hay órdenes disponibles" description={providerOnly||externalOnly?"Cuando te asignen trabajo aparecerá aquí.":"La jerarquía está lista. Usa Agregar para crear la primera orden."}/>:undefined}
      />}/>
      <UrlPagination page={page} pageCount={pageCount} label="Páginas de órdenes de trabajo"/>
    </section>
  </div>;
}
