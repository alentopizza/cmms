import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { canAccessOrganization, organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import Link from "next/link";
import { AssetCreateModal } from "@/components/ContextCreateModals";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader, { type ModuleFacetOptionMap } from "@/components/ModuleHeader";
import { AssetCard } from "@/components/business-ui";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import BulkImportModal from "@/components/BulkImportModal";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import AssetSubnav from "@/components/AssetSubnav";
import AssetCatalogOverview, { type AssetBrandSummary, type AssetCatalogSummary, type AssetCategorySummary, type AssetMaintenanceSummary, type AssetHistorySummary, type AssetDocumentSummary, type AssetModelSummary } from "@/components/AssetCatalogOverview";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Badge } from "@/components/ui-kit/Badge";
import UiIcon from "@/components/UiIcon";
import { UrlPagination } from "@/components/ui-kit/UrlPagination";

type Asset={id:string;organization_id:string;site_id:string;category_id:string|null;supplier_id:string|null;code:string;name:string;company:string;site:string;location:string|null;category:string|null;supplier:string|null;status:string;criticality:string;manufacturer:string|null;model:string|null;serial_number:string|null;has_image:boolean;created_at:string};
type AssetSummary=AssetCatalogSummary&{filtered_count:number};
type AssetFacetValue={value:string;label:string};
type AssetFacetRow={organizations:AssetFacetValue[];sites:AssetFacetValue[];criticalities:AssetFacetValue[];categories:AssetFacetValue[];suppliers:AssetFacetValue[]};
type AssetSearchParams={created?:string;error?:string;q?:string;status?:string;organization?:string;site?:string;criticality?:string;category?:string;supplier?:string;sort?:string;page?:string};
type Site={id:string;organization_id:string;label:string};
type Location={id:string;organization_id:string;site_id:string;label:string};
type Supplier={id:string;organization_id:string;name:string};

const ASSET_PAGE_SIZE=24;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_STATUSES=new Set(["all","operational","maintenance","down","retired"]);
const ASSET_CRITICALITIES=new Set(["low","medium","high","critical"]);
const ASSET_SORTS=new Set(["created"]);

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
function assetPageWindow(page:number){
  return {limit:ASSET_PAGE_SIZE,offset:(page-1)*ASSET_PAGE_SIZE};
}

function statusLabel(status:string){
  if(status==="operational")return "Operativo";
  if(status==="maintenance")return "En mantenimiento";
  if(status==="down")return "Fuera de servicio";
  return "Retirado";
}
function criticalityLabel(value:string){
  return ({low:"Baja",medium:"Media",high:"Alta",critical:"Crítica"} as Record<string,string>)[value]||value;
}

export default async function AssetsPage({searchParams}:{searchParams:Promise<AssetSearchParams>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"assets.read")) redirect("/dashboard");
  const params=await searchParams;
  const platform=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"assets.write");
  const owner=isPlatformOwner(session);
  const organizationScope=organizationScopeFor(session);
  const platformScopeParams:unknown[]=[organizationScope.unrestricted,organizationScope.organizationIds];

  const q=safeText(params.q);
  const status=ASSET_STATUSES.has(params.status||"")?String(params.status):"all";
  const organization=safeUuid(params.organization);
  const importOrganizationId=platform
    ?organization&&canAccessOrganization(session,organization)?organization:null
    :orgId;
  const site=safeUuid(params.site);
  const criticality=ASSET_CRITICALITIES.has(params.criticality||"")?String(params.criticality):"";
  const category=safeUuid(params.category);
  const supplier=safeUuid(params.supplier);
  const sort=ASSET_SORTS.has(params.sort||"")?String(params.sort):"created";
  const requestedPage=safePage(params.page);

  const scopeParams:unknown[]=[];
  const scopeConditions:string[]=[];
  if(session.platformRole==="superadmin"){
    scopeParams.push(organizationScope.organizationIds);
    scopeConditions.push("a.organization_id=ANY($"+scopeParams.length+"::uuid[])");
  }else if(session.platformRole==="user"){
    scopeParams.push(orgId);
    scopeConditions.push("a.organization_id=$"+scopeParams.length);
    if(!session.accessAllSites){
      scopeParams.push(session.siteIds);
      scopeConditions.push("a.site_id=ANY($"+scopeParams.length+"::uuid[])");
    }
  }
  const scopeWhere=scopeConditions.length?"WHERE "+scopeConditions.join(" AND "):"";
  const scopedSql=`
    SELECT a.id,a.organization_id,a.site_id,a.category_id,a.supplier_id,a.code,a.name,o.name company,s.name site,l.name location,c.name category,p.name supplier,
           a.status,a.criticality,a.manufacturer,a.model,a.serial_number,(a.image_data IS NOT NULL) has_image,a.created_at
    FROM assets a
    JOIN organizations o ON o.id=a.organization_id
    JOIN sites s ON s.id=a.site_id
    LEFT JOIN locations l ON l.id=a.location_id
    LEFT JOIN asset_categories c ON c.id=a.category_id
    LEFT JOIN suppliers p ON p.id=a.supplier_id
    ${scopeWhere}`;

  const filteredParams=[...scopeParams];
  const filteredConditions:string[]=[];
  if(q){
    filteredParams.push(likePattern(q));
    const token="$"+filteredParams.length;
    filteredConditions.push(`(code ILIKE ${token} ESCAPE E'\\\\' OR name ILIKE ${token} ESCAPE E'\\\\' OR company ILIKE ${token} ESCAPE E'\\\\' OR site ILIKE ${token} ESCAPE E'\\\\' OR COALESCE(location,'') ILIKE ${token} ESCAPE E'\\\\' OR COALESCE(category,'') ILIKE ${token} ESCAPE E'\\\\' OR COALESCE(supplier,'') ILIKE ${token} ESCAPE E'\\\\' OR status ILIKE ${token} ESCAPE E'\\\\' OR criticality ILIKE ${token} ESCAPE E'\\\\' OR COALESCE(manufacturer,'') ILIKE ${token} ESCAPE E'\\\\' OR COALESCE(model,'') ILIKE ${token} ESCAPE E'\\\\')`);
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
  if(criticality){
    filteredParams.push(criticality);
    filteredConditions.push("criticality=$"+filteredParams.length);
  }
  if(category){
    filteredParams.push(category);
    filteredConditions.push("category_id=$"+filteredParams.length+"::uuid");
  }
  if(supplier){
    filteredParams.push(supplier);
    filteredConditions.push("supplier_id=$"+filteredParams.length+"::uuid");
  }
  const filteredWhere=filteredConditions.length?"WHERE "+filteredConditions.join(" AND "):"";

  const summaryPromise=query<AssetSummary>(
    `WITH scoped AS (${scopedSql}),
          filtered AS (SELECT * FROM scoped ${filteredWhere})
     SELECT
       (SELECT count(*)::int FROM scoped) total_count,
       (SELECT count(*)::int FROM filtered) filtered_count,
       (SELECT count(*)::int FROM scoped WHERE status='operational') operational_count,
       (SELECT count(*)::int FROM scoped WHERE status='maintenance') maintenance_count,
       (SELECT count(*)::int FROM scoped WHERE status='down') down_count,
       (SELECT count(*)::int FROM scoped WHERE status='retired') retired_count,
       (SELECT count(*)::int FROM scoped WHERE criticality='critical') critical_count,
       (SELECT count(*)::int FROM scoped WHERE criticality IN ('high','critical')) high_critical_count,
       (SELECT count(*)::int FROM scoped WHERE category_id IS NOT NULL) with_category_count,
       (SELECT count(*)::int FROM scoped WHERE NULLIF(btrim(COALESCE(manufacturer,'')),'') IS NOT NULL) with_manufacturer_count,
       (SELECT count(*)::int FROM scoped WHERE NULLIF(btrim(COALESCE(model,'')),'') IS NOT NULL) with_model_count`,
    filteredParams,
  );

  const facetsPromise=query<AssetFacetRow>(
    `WITH scoped AS (${scopedSql})
     SELECT
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT organization_id::text value,company label FROM scoped) value_row),'[]'::jsonb) organizations,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT site_id::text value,site label FROM scoped) value_row),'[]'::jsonb) sites,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.value)
                 FROM (SELECT DISTINCT criticality value,criticality label FROM scoped) value_row),'[]'::jsonb) criticalities,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT category_id::text value,category label FROM scoped WHERE category_id IS NOT NULL AND category IS NOT NULL) value_row),'[]'::jsonb) categories,
       COALESCE((SELECT jsonb_agg(row_to_json(value_row) ORDER BY value_row.label)
                 FROM (SELECT DISTINCT supplier_id::text value,supplier label FROM scoped WHERE supplier_id IS NOT NULL AND supplier IS NOT NULL) value_row),'[]'::jsonb) suppliers`,
    scopeParams,
  );

  const brandsPromise=query<AssetBrandSummary>(
    `WITH scoped AS (${scopedSql})
     SELECT btrim(manufacturer) name,count(*)::int asset_count
     FROM scoped
     WHERE NULLIF(btrim(COALESCE(manufacturer,'')),'') IS NOT NULL
     GROUP BY btrim(manufacturer)
     ORDER BY btrim(manufacturer)`,
    scopeParams,
  );
  const modelsPromise=query<AssetModelSummary>(
    `WITH scoped AS (${scopedSql})
     SELECT DISTINCT concat_ws(' · ',NULLIF(btrim(COALESCE(manufacturer,'')),''),NULLIF(btrim(COALESCE(model,'')),'')) label
     FROM scoped
     WHERE NULLIF(concat_ws('',btrim(COALESCE(manufacturer,'')),btrim(COALESCE(model,''))),'') IS NOT NULL
     ORDER BY label`,
    scopeParams,
  );

  const catalogCategoriesPromise=query<AssetCategorySummary>(
    `WITH scoped AS (${scopedSql})
     SELECT c.id,c.name,p.name parent_name,count(scoped.id)::int asset_count
     FROM asset_categories c
     LEFT JOIN asset_categories p ON p.id=c.parent_id
     LEFT JOIN scoped ON scoped.category_id=c.id
     WHERE ($1::boolean OR c.organization_id=ANY($2::uuid[]))
     GROUP BY c.id,c.name,p.name
     ORDER BY p.name NULLS FIRST,c.name`,
    platformScopeParams,
  );

  const sitesPromise=canWrite
    ? platform
      ? query<Site>("SELECT s.id,s.organization_id,o.name||' · '||s.name label FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND ($1::boolean OR s.organization_id=ANY($2::uuid[])) ORDER BY o.name,s.name",platformScopeParams)
      : session.accessAllSites
        ? query<Site>("SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true ORDER BY s.name",[orgId])
        : query<Site>("SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true AND s.id=ANY($2::uuid[]) ORDER BY s.name",[orgId,session.siteIds])
    : Promise.resolve({rows:[]} as {rows:Site[]});
  const locationsPromise=canWrite
    ? platform
      ? query<Location>("SELECT l.id,l.organization_id,l.site_id,o.name||' · '||s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id JOIN organizations o ON o.id=l.organization_id WHERE l.active=true AND ($1::boolean OR l.organization_id=ANY($2::uuid[])) ORDER BY o.name,s.name,l.name",platformScopeParams)
      : session.accessAllSites
        ? query<Location>("SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name",[orgId])
        : query<Location>("SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name",[orgId,session.siteIds])
    : Promise.resolve({rows:[]} as {rows:Location[]});
  const suppliersPromise=canWrite
    ? platform
      ? query<Supplier>("SELECT id,organization_id,name FROM suppliers WHERE active=true AND ($1::boolean OR organization_id=ANY($2::uuid[])) ORDER BY name",platformScopeParams)
      : query<Supplier>("SELECT id,organization_id,name FROM suppliers WHERE active=true AND organization_id=$1 ORDER BY name",[orgId])
    : Promise.resolve({rows:[]} as {rows:Supplier[]});

  const maintenancePromise=platform
    ? query<AssetMaintenanceSummary>(`SELECT mp.id,mp.name,a.name asset_name,mp.frequency_value,mp.frequency_unit,mp.next_due_at::text,mp.active
        FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id
        WHERE ($1::boolean OR mp.organization_id=ANY($2::uuid[]))
        ORDER BY mp.active DESC,mp.next_due_at NULLS LAST LIMIT 250`,platformScopeParams)
    : session.accessAllSites
      ? query<AssetMaintenanceSummary>(`SELECT mp.id,mp.name,a.name asset_name,mp.frequency_value,mp.frequency_unit,mp.next_due_at::text,mp.active
          FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id
          WHERE mp.organization_id=$1 ORDER BY mp.active DESC,mp.next_due_at NULLS LAST LIMIT 250`,[orgId])
      : query<AssetMaintenanceSummary>(`SELECT mp.id,mp.name,a.name asset_name,mp.frequency_value,mp.frequency_unit,mp.next_due_at::text,mp.active
          FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id
          WHERE mp.organization_id=$1 AND a.site_id=ANY($2::uuid[])
          ORDER BY mp.active DESC,mp.next_due_at NULLS LAST LIMIT 250`,[orgId,session.siteIds]);

  const historyPromise=platform
    ? query<AssetHistorySummary>(`SELECT w.id,w.number::text,w.title,a.name asset_name,w.status,w.priority,w.requested_at::text
        FROM work_orders w JOIN assets a ON a.id=w.asset_id
        WHERE ($1::boolean OR w.organization_id=ANY($2::uuid[]))
        ORDER BY w.requested_at DESC LIMIT 250`,platformScopeParams)
    : session.accessAllSites
      ? query<AssetHistorySummary>(`SELECT w.id,w.number::text,w.title,a.name asset_name,w.status,w.priority,w.requested_at::text
          FROM work_orders w JOIN assets a ON a.id=w.asset_id
          WHERE w.organization_id=$1 ORDER BY w.requested_at DESC LIMIT 250`,[orgId])
      : query<AssetHistorySummary>(`SELECT w.id,w.number::text,w.title,a.name asset_name,w.status,w.priority,w.requested_at::text
          FROM work_orders w JOIN assets a ON a.id=w.asset_id
          WHERE w.organization_id=$1 AND w.site_id=ANY($2::uuid[])
          ORDER BY w.requested_at DESC LIMIT 250`,[orgId,session.siteIds]);

  const documentsPromise=platform
    ? query<AssetDocumentSummary>(`SELECT at.id,a.name asset_name,at.file_name,at.mime_type,at.size_bytes::text,at.created_at::text
        FROM attachments at JOIN assets a ON a.id=at.asset_id
        WHERE at.asset_id IS NOT NULL AND ($1::boolean OR at.organization_id=ANY($2::uuid[]))
        ORDER BY at.created_at DESC LIMIT 250`,platformScopeParams)
    : session.accessAllSites
      ? query<AssetDocumentSummary>(`SELECT at.id,a.name asset_name,at.file_name,at.mime_type,at.size_bytes::text,at.created_at::text
          FROM attachments at JOIN assets a ON a.id=at.asset_id
          WHERE at.asset_id IS NOT NULL AND at.organization_id=$1 ORDER BY at.created_at DESC LIMIT 250`,[orgId])
      : query<AssetDocumentSummary>(`SELECT at.id,a.name asset_name,at.file_name,at.mime_type,at.size_bytes::text,at.created_at::text
          FROM attachments at JOIN assets a ON a.id=at.asset_id
          WHERE at.asset_id IS NOT NULL AND at.organization_id=$1 AND a.site_id=ANY($2::uuid[])
          ORDER BY at.created_at DESC LIMIT 250`,[orgId,session.siteIds]);

  const creationGatePromise=getCreationGateForScope("asset",session.organizationId,platform,session.platformRole==="superadmin"?session.platformOrganizationIds:undefined);
  const [
    summaryResult,facetsResult,brandsResult,modelsResult,catalogCategories,sites,locations,suppliers,
    maintenanceSummary,historySummary,documentSummary,creationGate,
  ]=await Promise.all([
    summaryPromise,facetsPromise,brandsPromise,modelsPromise,catalogCategoriesPromise,sitesPromise,locationsPromise,suppliersPromise,
    maintenancePromise,historyPromise,documentsPromise,creationGatePromise,
  ]);

  const summary=summaryResult.rows[0]||{
    total_count:0,filtered_count:0,operational_count:0,maintenance_count:0,down_count:0,retired_count:0,
    critical_count:0,high_critical_count:0,with_category_count:0,with_manufacturer_count:0,with_model_count:0,
  };
  const pageCount=Math.max(1,Math.ceil(summary.filtered_count/ASSET_PAGE_SIZE));
  const page=Math.min(requestedPage,pageCount);
  if(requestedPage!==page){
    const canonical=new URLSearchParams();
    if(params.created)canonical.set("created",params.created);
    if(params.error)canonical.set("error",params.error);
    if(q)canonical.set("q",q);
    if(status!=="all")canonical.set("status",status);
    if(organization)canonical.set("organization",organization);
    if(site)canonical.set("site",site);
    if(criticality)canonical.set("criticality",criticality);
    if(category)canonical.set("category",category);
    if(supplier)canonical.set("supplier",supplier);
    if(sort!=="created")canonical.set("sort",sort);
    if(page>1)canonical.set("page",String(page));
    const queryString=canonical.toString();
    redirect(queryString?"/dashboard/assets?"+queryString:"/dashboard/assets");
  }

  const window=assetPageWindow(page);
  const pageParams=[...filteredParams,window.limit,window.offset];
  const limitToken="$"+(pageParams.length-1);
  const offsetToken="$"+pageParams.length;
  const orderSql=sort==="created"?"created_at DESC,id DESC":"created_at DESC,id DESC";
  const assets=await query<Asset>(
    `WITH scoped AS (${scopedSql})
     SELECT id,organization_id,site_id,category_id,supplier_id,code,name,company,site,location,category,supplier,status,criticality,manufacturer,model,serial_number,has_image,created_at::text
     FROM scoped
     ${filteredWhere}
     ORDER BY ${orderSql}
     LIMIT ${limitToken} OFFSET ${offsetToken}`,
    pageParams,
  );

  const rawFacets=facetsResult.rows[0]||{organizations:[],sites:[],criticalities:[],categories:[],suppliers:[]};
  const facetOptions:ModuleFacetOptionMap={
    organization:Array.isArray(rawFacets.organizations)?rawFacets.organizations:[],
    site:Array.isArray(rawFacets.sites)?rawFacets.sites:[],
    criticality:(Array.isArray(rawFacets.criticalities)?rawFacets.criticalities:[]).map(item=>({...item,label:criticalityLabel(item.value)})),
    category:Array.isArray(rawFacets.categories)?rawFacets.categories:[],
    supplier:Array.isArray(rawFacets.suppliers)?rawFacets.suppliers:[],
  };

  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de activos de su plan."
    : params.error ? "Revisa la información del activo." : "";

  return <div className="phase7-assets">
    <ModuleHeader
      eyebrow="Registro técnico"
      title="Activos"
      description="Gestión visual de equipos con ubicación, proveedor, categoría, estado y criticidad."
      count={summary.total_count}
      countLabel="activos"
      searchPlaceholder="Buscar activo por código, nombre, categoría, sede o proveedor"
      filters={[
        {value:"all",label:"Todos"},
        {value:"operational",label:"Operativos"},
        {value:"maintenance",label:"En mantenimiento"},
        {value:"down",label:"Fuera de servicio"},
        {value:"retired",label:"Retirados"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"criticality",label:"Criticidad",allLabel:"Todas las criticidades"},
        {key:"category",label:"Categoría",allLabel:"Todas las categorías"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
      ]}
      serverState={{
        search:q,
        filter:status,
        facetValues:{organization:organization||"all",site:site||"all",criticality:criticality||"all",category:category||"all",supplier:supplier||"all"},
        facetOptions,
        filteredCount:summary.filtered_count,
        searchParam:"q",
        filterParam:"status",
        pageParam:"page",
      }}
      action={<div className="module-header-action-group">
        {canWrite&&importOrganizationId&&<BulkImportModal entity="assets" organizationId={importOrganizationId}/>}
        <ModuleExportMenu entity="assets"/>
        {canWrite && creationGate.ready ? <AssetCreateModal triggerLabel="Agregar activo" sites={sites.rows.map(s=>({id:s.id,organization_id:s.organization_id,name:s.label}))} locations={locations.rows.map(l=>({id:l.id,organization_id:l.organization_id,site_id:l.site_id,name:l.label,label:l.label}))} suppliers={suppliers.rows} returnTo="/dashboard/assets" /> : undefined}
      </div>}
    />
    <AssetSubnav/>
    {platform&&canWrite&&!importOrganizationId&&<div className="section"><Alert variant="info" title="Selecciona una empresa para importar">La carga masiva de activos requiere un contexto empresarial explícito. Usa el filtro Empresa; únicamente se muestran empresas autorizadas para tu cuenta.</Alert></div>}
    {params.created && <div className="section"><Alert variant="success" title="Activo creado">El activo se registró correctamente.</Alert></div>}
    {error && <div className="section"><Alert variant="danger" title="Revisa la información">{error}</Alert></div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState icon="◇" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message} href={creationGate.href || "/dashboard/locations"} action={creationGate.action || "Continuar"}/>}

    <MetricGrid className="section phase7-kpi-grid">
      <KpiCard label="Total activos" value={String(summary.total_count)} hint="Todos los activos autorizados" icon="asset"/>
      <KpiCard label="Operativos" value={String(summary.operational_count)} hint={(summary.total_count?Math.round(summary.operational_count/summary.total_count*100):0)+"% del total"} icon="check" tone="success"/>
      <KpiCard label="En mantenimiento" value={String(summary.maintenance_count)} hint={(summary.total_count?Math.round(summary.maintenance_count/summary.total_count*100):0)+"% del total"} icon="maintenance" tone="warning"/>
      <KpiCard label="Fuera de servicio" value={String(summary.down_count)} hint={(summary.total_count?Math.round(summary.down_count/summary.total_count*100):0)+"% del total"} icon="warning" tone="danger"/>
    </MetricGrid>

    <section className="section phase7-anchor" id="asset-list">
      <div className="section-heading"><div><span className="eyebrow">Vista de tarjetas</span><h2>Activos registrados</h2><p className="muted">Abre un activo para consultar su ficha, rutinas, historial y órdenes relacionadas.</p></div></div>
      {assets.rows.length?<CollectionView storageKey="assets" label="Vista de activos" grid={<div className="asset-modern-grid" data-collection-grid>{assets.rows.map(a=><AssetCard
        key={a.id}
        name={a.name}
        code={a.code}
        category={a.category||"Sin categoría"}
        site={a.site}
        location={a.location}
        supplier={a.supplier||"Sin proveedor"}
        criticality={criticalityLabel(a.criticality)}
        manufacturerModel={[a.manufacturer,a.model].filter(Boolean).join(" · ")||"Sin registrar"}
        status={statusLabel(a.status)}
        statusTone={a.status==="operational"?"success":a.status==="maintenance"?"warning":a.status==="down"?"danger":"neutral"}
        imageSrc={a.has_image?"/api/assets/"+a.id+"/image":null}
        recordProps={{"data-module-record":true}}
        actions={<>
          <Link className="button secondary" href={"/dashboard/assets/"+a.id}>Ver detalles →</Link>
          {owner&&<OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
            {name:"code",label:"Código",value:a.code},{name:"name",label:"Nombre",value:a.name},
            {name:"status",label:"Estado",value:a.status,type:"select",options:[{value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Fuera de servicio"},{value:"retired",label:"Retirado"}]},
            {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[{value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}]},
          ]}/>}
        </>}
      />)}</div>} list={<StaticDataTable
        className="asset-directory-list"
        caption="Listado de activos"
        columns={[
          {key:"asset",label:"Activo",width:"30%"},
          {key:"status",label:"Estado"},
          {key:"category",label:"Tipo / categoría"},
          {key:"location",label:"Ubicación"},
          {key:"criticality",label:"Criticidad"},
          {key:"supplier",label:"Proveedor"},
          {key:"actions",label:"Acciones",align:"end"},
        ]}
        rows={assets.rows.map(a=>({
          id:a.id,
          recordProps:{"data-module-record":true},
          cells:{
            asset:<EntityIdentityCell
              imageSrc={a.has_image?"/api/assets/"+a.id+"/image":null}
              imageAlt={a.has_image?"Imagen de "+a.name:""}
              icon="asset"
              variant="thumbnail"
              title={a.name}
              subtitle={a.code}
              meta={[a.manufacturer,a.model].filter(Boolean).join(" · ")||null}
            />,
            status:<Badge variant={a.status==="operational"?"success":a.status==="maintenance"?"warning":a.status==="down"?"danger":"neutral"}>{statusLabel(a.status)}</Badge>,
            category:a.category||"Sin categoría",
            location:[a.site,a.location].filter(Boolean).join(" · "),
            criticality:criticalityLabel(a.criticality),
            supplier:a.supplier||"Sin proveedor",
            actions:<ListQuickActions>
              <Link className="ds-list-action primary" href={"/dashboard/assets/"+a.id} title="Ver detalles" data-tooltip="Ver detalles" aria-label={"Ver detalles de "+a.name}><UiIcon name="eye" size={16}/></Link>
              {owner&&<OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
                {name:"code",label:"Código",value:a.code},{name:"name",label:"Nombre",value:a.name},
                {name:"status",label:"Estado",value:a.status,type:"select",options:[{value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Fuera de servicio"},{value:"retired",label:"Retirado"}]},
                {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[{value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}]},
              ]}/>}
            </ListQuickActions>,
          },
        }))}
      />}/>:<EmptyState icon="asset" title={summary.total_count?"No hay activos con estos filtros":"Aún no hay activos"} description={summary.total_count?"Ajusta la búsqueda o los filtros para ver otros activos.":"Usa Agregar activo o Importar para comenzar."}/>}
      <UrlPagination page={page} pageCount={pageCount} label="Paginación de activos"/>
    </section>
    <AssetCatalogOverview
      summary={summary}
      brands={brandsResult.rows}
      models={modelsResult.rows}
      categories={catalogCategories.rows}
      maintenance={maintenanceSummary.rows}
      history={historySummary.rows}
      documents={documentSummary.rows}
    />
  </div>;
}
