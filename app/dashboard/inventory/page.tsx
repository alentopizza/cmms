import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import ModuleHeader, { type ModuleFacetOptionMap } from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import RequisitionBuilder from "@/components/RequisitionBuilder";
import BulkImportModal from "@/components/BulkImportModal";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import FileDropzone from "@/components/FileDropzone";
import InventorySubnav, { type InventorySection } from "@/components/InventorySubnav";
import { InventoryCard } from "@/components/business-ui";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Card } from "@/components/ui-kit/Card";
import { KpiCard, MetricGrid, StatTiles } from "@/components/ui-kit/Metrics";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { Badge } from "@/components/ui-kit/Badge";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { UrlPagination } from "@/components/ui-kit/UrlPagination";
import ConfigurableCatalogSelect from "@/components/ConfigurableCatalogSelect";
import { inventoryItemSqlScope } from "@/lib/inventory-scope";
import { canAccessOrganization } from "@/lib/organization-scope";

type Item={
  id:string;organization_id:string;site_id:string|null;location_id:string|null;supplier_id:string|null;category_id:string|null;warehouse_id:string|null;
  supplier_type:string|null;sku:string;name:string;description:string|null;presentation:string|null;company:string;site:string|null;location:string|null;
  category:string|null;warehouse:string|null;supplier:string|null;quantity:string;min_quantity:string;max_quantity:string;unit:string;unit_cost:string;storage_location:string|null;has_image:boolean;active:boolean;
};
type Site={id:string;label:string};
type Location={id:string;label:string};
type Supplier={id:string;name:string;supplier_type:string};
type Category={id:string;name:string};
type Warehouse={id:string;name:string;site_id:string|null;location_id:string|null};
type Movement={id:string;type:string;quantity:string;sku:string;name:string;warehouse:string|null;destination:string|null;movement_at:string;document_number:string|null};
type InventorySummary={
  total_count:number;filtered_count:number;active_count:number;total_value:string;
  in_stock_count:number;low_stock_count:number;out_stock_count:number;
};
type InventoryFacetValue={value:string;label:string};
type InventoryFacetRow={
  organizations:InventoryFacetValue[];sites:InventoryFacetValue[];categories:InventoryFacetValue[];
  suppliers:InventoryFacetValue[];warehouses:InventoryFacetValue[];records:InventoryFacetValue[];
};
type InventorySearchParams={
  view?:string;
  created?:string;updated?:string;movement?:string;error?:string;requisition_created?:string;
  q?:string;status?:string;organization?:string;site?:string;category?:string;supplier?:string;warehouse?:string;record?:string;
  sortBy?:string;sortDirection?:string;page?:string;pageSize?:string;
};

const INVENTORY_DEFAULT_PAGE_SIZE=24;
const INVENTORY_PAGE_SIZES=new Set([24,40,80]);
const INVENTORY_STOCK_FILTERS=new Set(["all","ok","low","out"]);
const INVENTORY_RECORD_FILTERS=new Set(["active","inactive"]);
const INVENTORY_SORT_FIELDS:Record<string,string>={name:"name",sku:"sku"};
const INVENTORY_MAIN_VIEWS=new Set<InventorySection>(["summary","products","reports","settings"]);

function safeText(value:string|undefined,max=120){
  return String(value||"").trim().slice(0,max);
}
function safeUuid(value:string|undefined){
  const normalized=safeText(value,36);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)?normalized:"";
}
function safePage(value:string|undefined){
  const parsed=Number.parseInt(String(value||"1"),10);
  return Number.isFinite(parsed)&&parsed>0?parsed:1;
}
function safePageSize(value:string|undefined){
  const parsed=Number.parseInt(String(value||INVENTORY_DEFAULT_PAGE_SIZE),10);
  return INVENTORY_PAGE_SIZES.has(parsed)?parsed:INVENTORY_DEFAULT_PAGE_SIZE;
}
function likePattern(value:string){
  return "%"+value.replace(/[\\%_]/g,match=>"\\"+match)+"%";
}

function money(value:number){
  return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
}
function stockState(item:Item){
  const q=Number(item.quantity||0),min=Number(item.min_quantity||0);
  if(q<=0)return {key:"out",label:"Sin stock"};
  if(q<=min)return {key:"low",label:"Stock bajo"};
  return {key:"ok",label:"En stock"};
}
function movementLabel(type:string,quantity:number){
  if(type==="receipt")return "Entrada";
  if(type==="issue")return "Salida";
  if(type==="return")return "Devolución";
  if(type==="transfer")return "Transferencia";
  return quantity<0?"Ajuste -":"Ajuste +";
}

export default async function InventoryPage({searchParams}:{searchParams:Promise<InventorySearchParams>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"inventory.read")) redirect("/dashboard");
  const params=await searchParams;
  const platform=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"inventory.write");
  const canCreateRequisitions=can(session,"requisitions.write");

  const view=INVENTORY_MAIN_VIEWS.has(params.view as InventorySection)?params.view as InventorySection:"summary";
  const q=safeText(params.q);
  const stockStatus=INVENTORY_STOCK_FILTERS.has(params.status||"")?String(params.status):"all";
  const organization=safeUuid(params.organization);
  const createOrganizationId=platform
    ?organization&&canAccessOrganization(session,organization)?organization:null
    :orgId;
  const site=safeUuid(params.site);
  const category=safeUuid(params.category);
  const supplier=safeUuid(params.supplier);
  const warehouse=safeUuid(params.warehouse);
  const record=INVENTORY_RECORD_FILTERS.has(params.record||"")?String(params.record):"";
  const sortBy=INVENTORY_SORT_FIELDS[params.sortBy||""]?String(params.sortBy):"name";
  const sortDirection=params.sortDirection==="desc"?"desc":"asc";
  const requestedPage=safePage(params.page);
  const pageSize=safePageSize(params.pageSize);

  const itemScope=inventoryItemSqlScope(session);
  const scopeParams=[...itemScope.params];
  const limitedSiteScope=itemScope.limitedSiteScope;
  const siteScopeToken=itemScope.siteParamToken;
  if(limitedSiteScope&&!siteScopeToken)throw new Error("Inventory site scope token is required for limited sessions");

  const quantitySql=limitedSiteScope
    ?`COALESCE((
        SELECT sum(sl.quantity)
        FROM inventory_stock_levels sl
        JOIN inventory_warehouses sw ON sw.id=sl.warehouse_id
        WHERE sl.item_id=i.id AND sw.organization_id=i.organization_id AND sw.site_id=ANY(${siteScopeToken}::uuid[])
      ),0)`
    :"i.quantity";
  const warehouseJoin=limitedSiteScope
    ?`LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id AND w.organization_id=i.organization_id AND w.site_id=ANY(${siteScopeToken}::uuid[])`
    :"LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id";

  const scopedSql=`
    SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,i.category_id,
           CASE WHEN w.id IS NULL THEN NULL ELSE i.warehouse_id END warehouse_id,
           p.supplier_type,i.sku,i.name,i.description,i.presentation,o.name company,s.name site,l.name location,c.name category,w.name warehouse,p.name supplier,
           ${quantitySql} quantity,i.min_quantity,i.max_quantity,i.unit,i.unit_cost,i.storage_location,
           (i.image_data IS NOT NULL) has_image,i.active
    FROM inventory_items i
    JOIN organizations o ON o.id=i.organization_id
    LEFT JOIN sites s ON s.id=i.site_id
    LEFT JOIN locations l ON l.id=i.location_id
    LEFT JOIN suppliers p ON p.id=i.supplier_id
    LEFT JOIN inventory_categories c ON c.id=i.category_id
    ${warehouseJoin}
    ${itemScope.where}`;

  const filteredParams=[...scopeParams];
  const filteredConditions:string[]=[];
  if(q){
    filteredParams.push(likePattern(q));
    const token="$"+filteredParams.length;
    filteredConditions.push(`(
      sku ILIKE ${token} ESCAPE E'\\\\' OR
      name ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(description,'') ILIKE ${token} ESCAPE E'\\\\' OR
      company ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(site,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(location,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(category,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(warehouse,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(supplier,'') ILIKE ${token} ESCAPE E'\\\\'
    )`);
  }
  if(stockStatus==="ok")filteredConditions.push("quantity>min_quantity AND quantity>0");
  if(stockStatus==="low")filteredConditions.push("quantity>0 AND quantity<=min_quantity");
  if(stockStatus==="out")filteredConditions.push("quantity<=0");
  if(organization){
    filteredParams.push(organization);
    filteredConditions.push("organization_id=$"+filteredParams.length+"::uuid");
  }
  if(site){
    filteredParams.push(site);
    filteredConditions.push("site_id=$"+filteredParams.length+"::uuid");
  }
  if(category){
    filteredParams.push(category);
    filteredConditions.push("category_id=$"+filteredParams.length+"::uuid");
  }
  if(supplier){
    filteredParams.push(supplier);
    filteredConditions.push("supplier_id=$"+filteredParams.length+"::uuid");
  }
  if(warehouse){
    filteredParams.push(warehouse);
    filteredConditions.push("warehouse_id=$"+filteredParams.length+"::uuid");
  }
  if(record==="active")filteredConditions.push("active=true");
  if(record==="inactive")filteredConditions.push("active=false");
  const filteredWhere=filteredConditions.length?"WHERE "+filteredConditions.join(" AND "):"";

  const summaryPromise=query<InventorySummary>(
    `WITH scoped AS (${scopedSql}),
          filtered AS (SELECT * FROM scoped ${filteredWhere})
     SELECT
       (SELECT count(*)::int FROM scoped) total_count,
       (SELECT count(*)::int FROM filtered) filtered_count,
       (SELECT count(*)::int FROM scoped WHERE active=true) active_count,
       COALESCE((SELECT sum(quantity*unit_cost) FROM scoped WHERE active=true),0)::text total_value,
       (SELECT count(*)::int FROM scoped WHERE active=true AND quantity>min_quantity AND quantity>0) in_stock_count,
       (SELECT count(*)::int FROM scoped WHERE active=true AND quantity>0 AND quantity<=min_quantity) low_stock_count,
       (SELECT count(*)::int FROM scoped WHERE active=true AND quantity<=0) out_stock_count`,
    filteredParams,
  );

  const facetsPromise=query<InventoryFacetRow>(
    `WITH scoped AS (${scopedSql})
     SELECT
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (SELECT DISTINCT organization_id::text value,company label FROM scoped) v),'[]'::jsonb) organizations,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (SELECT DISTINCT site_id::text value,site label FROM scoped WHERE site_id IS NOT NULL AND site IS NOT NULL) v),'[]'::jsonb) sites,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (SELECT DISTINCT category_id::text value,category label FROM scoped WHERE category_id IS NOT NULL AND category IS NOT NULL) v),'[]'::jsonb) categories,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (SELECT DISTINCT supplier_id::text value,supplier label FROM scoped WHERE supplier_id IS NOT NULL AND supplier IS NOT NULL) v),'[]'::jsonb) suppliers,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (SELECT DISTINCT warehouse_id::text value,warehouse label FROM scoped WHERE warehouse_id IS NOT NULL AND warehouse IS NOT NULL) v),'[]'::jsonb) warehouses,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.value) FROM (
         SELECT DISTINCT CASE WHEN active THEN 'active' ELSE 'inactive' END value,
                         CASE WHEN active THEN 'Activo' ELSE 'Inactivo' END label FROM scoped
       ) v),'[]'::jsonb) records`,
    scopeParams,
  );

  const sitesPromise=canWrite&&createOrganizationId
    ?platform||session.accessAllSites
      ?query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[createOrganizationId])
      :query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name",[createOrganizationId,session.siteIds])
    :Promise.resolve({rows:[]} as {rows:Site[]});
  const locationsPromise=canWrite&&createOrganizationId
    ?platform||session.accessAllSites
      ?query<Location>("SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name",[createOrganizationId])
      :query<Location>("SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name",[createOrganizationId,session.siteIds])
    :Promise.resolve({rows:[]} as {rows:Location[]});
  const suppliersPromise=canWrite&&createOrganizationId
    ?query<Supplier>("SELECT id,name,supplier_type FROM suppliers WHERE organization_id=$1 AND active=true AND supplier_type IN ('materials','both') ORDER BY name",[createOrganizationId])
    :Promise.resolve({rows:[]} as {rows:Supplier[]});
  const categoriesPromise=createOrganizationId
    ?query<Category>("SELECT id,name FROM inventory_categories WHERE organization_id=$1 AND active=true ORDER BY name",[createOrganizationId])
    :Promise.resolve({rows:[]} as {rows:Category[]});
  const warehousesPromise=createOrganizationId
    ?platform||session.accessAllSites
      ?query<Warehouse>("SELECT id,name,site_id,location_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[createOrganizationId])
      :query<Warehouse>("SELECT id,name,site_id,location_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND site_id=ANY($2::uuid[]) ORDER BY name",[createOrganizationId,session.siteIds])
    :Promise.resolve({rows:[]} as {rows:Warehouse[]});
  const movementsPromise=createOrganizationId
    ?platform||session.accessAllSites
      ?query<Movement>(`SELECT t.id,t.type,t.quantity::text,i.sku,i.name,w.name warehouse,d.name destination,t.movement_at::text,t.document_number
                         FROM inventory_transactions t JOIN inventory_items i ON i.id=t.item_id
                         LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
                         WHERE t.organization_id=$1 ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 10`,[createOrganizationId])
      :query<Movement>(`SELECT t.id,t.type,t.quantity::text,i.sku,i.name,w.name warehouse,d.name destination,t.movement_at::text,t.document_number
                         FROM inventory_transactions t JOIN inventory_items i ON i.id=t.item_id
                         JOIN inventory_warehouses w ON w.id=t.warehouse_id
                         LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
                         WHERE t.organization_id=$1 AND w.site_id=ANY($2::uuid[])
                           AND (d.id IS NULL OR d.site_id=ANY($2::uuid[]))
                         ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 10`,[createOrganizationId,session.siteIds])
    :Promise.resolve({rows:[]} as {rows:Movement[]});
  const requisitionScopeParams=[...scopeParams];
  let requisitionOrganizationCondition="";
  if(createOrganizationId){
    requisitionScopeParams.push(createOrganizationId);
    requisitionOrganizationCondition=" AND organization_id=$"+requisitionScopeParams.length+"::uuid";
  }
  const requisitionItemsPromise=canCreateRequisitions&&(!platform||Boolean(createOrganizationId))
    ?query<Item>(
      `WITH scoped AS (${scopedSql})
       SELECT id,organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,supplier_type,sku,name,description,presentation,
              company,site,location,category,warehouse,supplier,quantity::text,min_quantity::text,max_quantity::text,unit,unit_cost::text,
              storage_location,has_image,active
       FROM scoped
       WHERE active=true AND supplier_id IS NOT NULL AND supplier_type IN ('materials','both')${requisitionOrganizationCondition}
       ORDER BY name,id`,
      requisitionScopeParams,
    )
    :Promise.resolve({rows:[]} as {rows:Item[]});
  const creationGatePromise=createOrganizationId
    ?getCreationGateForScope("inventory",createOrganizationId,false)
    :getCreationGateForScope("inventory",session.organizationId,platform,session.platformRole==="superadmin"?session.platformOrganizationIds:undefined);

  const [summaryResult,facetsResult,sites,locations,suppliers,categories,warehouses,movements,requisitionItems,creationGate]=await Promise.all([
    summaryPromise,facetsPromise,sitesPromise,locationsPromise,suppliersPromise,categoriesPromise,warehousesPromise,movementsPromise,requisitionItemsPromise,creationGatePromise,
  ]);

  const summary=summaryResult.rows[0]||{
    total_count:0,filtered_count:0,active_count:0,total_value:"0",in_stock_count:0,low_stock_count:0,out_stock_count:0,
  };
  const pageCount=Math.max(1,Math.ceil(summary.filtered_count/pageSize));
  const page=Math.min(requestedPage,pageCount);
  if(requestedPage!==page){
    const canonical=new URLSearchParams();
    if(view!=="summary")canonical.set("view",view);
    if(params.created)canonical.set("created",params.created);
    if(params.updated)canonical.set("updated",params.updated);
    if(params.movement)canonical.set("movement",params.movement);
    if(params.error)canonical.set("error",params.error);
    if(params.requisition_created)canonical.set("requisition_created",params.requisition_created);
    if(q)canonical.set("q",q);
    if(stockStatus!=="all")canonical.set("status",stockStatus);
    if(organization)canonical.set("organization",organization);
    if(site)canonical.set("site",site);
    if(category)canonical.set("category",category);
    if(supplier)canonical.set("supplier",supplier);
    if(warehouse)canonical.set("warehouse",warehouse);
    if(record)canonical.set("record",record);
    if(sortBy!=="name")canonical.set("sortBy",sortBy);
    if(sortDirection!=="asc")canonical.set("sortDirection",sortDirection);
    if(pageSize!==INVENTORY_DEFAULT_PAGE_SIZE)canonical.set("pageSize",String(pageSize));
    if(page>1)canonical.set("page",String(page));
    const queryString=canonical.toString();
    redirect(queryString?"/dashboard/inventory?"+queryString:"/dashboard/inventory");
  }

  const pageParams=[...filteredParams,pageSize,(page-1)*pageSize];
  const limitToken="$"+(pageParams.length-1);
  const offsetToken="$"+pageParams.length;
  const orderColumn=INVENTORY_SORT_FIELDS[sortBy]||INVENTORY_SORT_FIELDS.name;
  const orderDirection=sortDirection==="desc"?"DESC":"ASC";
  const items=await query<Item>(
    `WITH scoped AS (${scopedSql})
     SELECT id,organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,supplier_type,sku,name,description,presentation,
            company,site,location,category,warehouse,supplier,quantity::text,min_quantity::text,max_quantity::text,unit,unit_cost::text,
            storage_location,has_image,active
     FROM scoped
     ${filteredWhere}
     ORDER BY ${orderColumn} ${orderDirection},id ${orderDirection}
     LIMIT ${limitToken} OFFSET ${offsetToken}`,
    pageParams,
  );

  const rawFacets=facetsResult.rows[0]||{organizations:[],sites:[],categories:[],suppliers:[],warehouses:[],records:[]};
  const facetOptions:ModuleFacetOptionMap={
    organization:Array.isArray(rawFacets.organizations)?rawFacets.organizations:[],
    site:Array.isArray(rawFacets.sites)?rawFacets.sites:[],
    category:Array.isArray(rawFacets.categories)?rawFacets.categories:[],
    supplier:Array.isArray(rawFacets.suppliers)?rawFacets.suppliers:[],
    warehouse:Array.isArray(rawFacets.warehouses)?rawFacets.warehouses:[],
    record:Array.isArray(rawFacets.records)?rawFacets.records:[],
  };

  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de artículos de inventario."
    : params.error==="sku" ? "El SKU ya existe dentro de la empresa."
    : params.error==="stock" ? "El movimiento no pudo aplicarse porque dejaría existencias negativas o contiene datos inválidos."
    : params.error==="movement" ? "Revisa el tipo de movimiento, cantidad y bodega."
    : params.error ? "Revisa la información del inventario." : "";

  const totalValue=Number(summary.total_value||0);
  const inStock=summary.in_stock_count;
  const lowStock=summary.low_stock_count;
  const outStock=summary.out_stock_count;
  const categoryTabs=facetOptions.category;
  const inventoryCategoryHref=(nextCategory:string)=>{
    const search=new URLSearchParams();
    search.set("view","products");
    if(q)search.set("q",q);
    if(stockStatus!=="all")search.set("status",stockStatus);
    if(organization)search.set("organization",organization);
    if(site)search.set("site",site);
    if(nextCategory)search.set("category",nextCategory);
    if(supplier)search.set("supplier",supplier);
    if(warehouse)search.set("warehouse",warehouse);
    if(record)search.set("record",record);
    if(sortBy!=="name")search.set("sortBy",sortBy);
    if(sortDirection!=="asc")search.set("sortDirection",sortDirection);
    if(pageSize!==INVENTORY_DEFAULT_PAGE_SIZE)search.set("pageSize",String(pageSize));
    const queryString=search.toString();
    return queryString?"/dashboard/inventory?"+queryString:"/dashboard/inventory?view=products";
  };

  return <div className="phase7-inventory">
    <ModuleHeader
      eyebrow="Inventario y suministros"
      title="Inventario"
      description="Productos, repuestos y suministros con trazabilidad por proveedor, ubicación, bodega y Kardex."
      count={summary.total_count}
      countLabel="artículos"
      searchPlaceholder="Buscar producto, código, categoría o proveedor"
      filters={[{value:"all",label:"Todos"},{value:"ok",label:"En stock"},{value:"low",label:"Stock bajo"},{value:"out",label:"Sin stock"}]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"category",label:"Categoría",allLabel:"Todas las categorías"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
        {key:"warehouse",label:"Bodega",allLabel:"Todas las bodegas"},
        {key:"record",label:"Registro",allLabel:"Todos los registros"},
      ]}
      serverState={{
        search:q,
        filter:stockStatus,
        facetValues:{
          organization:organization||"all",
          site:site||"all",
          category:category||"all",
          supplier:supplier||"all",
          warehouse:warehouse||"all",
          record:record||"all",
        },
        facetOptions,
        filteredCount:summary.filtered_count,
        searchParam:"q",
        filterParam:"status",
        pageParam:"page",
      }}
      action={<div className="module-header-action-group">
        {canWrite&&createOrganizationId&&<BulkImportModal entity="inventory" organizationId={createOrganizationId}/>}
        <ModuleExportMenu entity="inventory"/>
        {can(session,"requisitions.read")&&<Link className="button secondary" href="/dashboard/requisitions"><UiIcon name="file" size={15}/> Requisiciones</Link>}
        {canWrite && creationGate.ready && createOrganizationId ? <CreateRecordModal title="Crear artículo" eyebrow="Nuevo inventario" description="Registra el artículo y su posición inicial. La existencia inicial quedará registrada en Kardex." triggerLabel="Agregar" iconName="inventory">
          <form className="form-grid unified-popup-form" method="post" action="/api/inventory" encType="multipart/form-data">
            <div className="field"><label>Sede *</label><select name="site_id" required><option value="">Selecciona sede</option>{sites.rows.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div className="field"><label>Sububicación *</label><select name="location_id" required><option value="">Selecciona sububicación</option>{locations.rows.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
            <div className="field"><label>Proveedor *</label><select name="supplier_id" required><option value="">Selecciona proveedor</option>{suppliers.rows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label>SKU *</label><input name="sku" required placeholder="Ej. REP-FLT-001"/></div>
            <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Filtro plisado 20 x 20"/></div>
            <ConfigurableCatalogSelect name="category" label="Categoría" catalog="inventory_categories" organizationId={createOrganizationId} submitValue="label" allowCreate allowManage placeholder="Selecciona o crea una categoría" />
            <ConfigurableCatalogSelect name="item_type" label="Tipo" catalog="inventory_types" organizationId={createOrganizationId} allowCreate allowManage placeholder="Selecciona o crea un tipo" />
            <div className="field form-span-2"><label>Descripción</label><input name="description" placeholder="Descripción del producto o repuesto"/></div>
            <div className="form-span-2"><FileDropzone name="image" label="Imagen del producto" description="PNG, JPG o WebP. Se mostrará en las tarjetas y ficha del inventario." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image"/></div>
            <div className="field"><label>Presentación</label><input name="presentation" placeholder="Ej. caja x 12, rollo 100 m"/></div>
            <ConfigurableCatalogSelect name="unit" label="Unidad de medida" catalog="inventory_units" organizationId={createOrganizationId} defaultValue="unidad" allowCreate allowManage required />
            <ConfigurableCatalogSelect name="catalog_status" label="Estado" catalog="inventory_statuses" organizationId={createOrganizationId} defaultValue="active" required allowManage />
            <div className="field"><label>Bodega / almacén</label><input name="warehouse_name" list="inventory-warehouse-list" defaultValue="Almacén principal"/><datalist id="inventory-warehouse-list">{warehouses.rows.map(w=><option value={w.name} key={w.id}/>)}</datalist></div>
            <div className="field"><label>Existencia inicial</label><input name="quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
            <div className="field"><label>Stock mínimo</label><input name="min_quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
            <div className="field"><label>Stock máximo</label><input name="max_quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
            <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
            <div className="form-span-2 form-actions"><button className="button" type="submit">Crear artículo</button></div>
          </form>
        </CreateRecordModal> : null}
      </div>}
    />
    <InventorySubnav active={view}/>

    {view==="products"&&<>
    <nav className="section inventory-category-nav" aria-label="Categorías del inventario">
      <Link href={inventoryCategoryHref("")} className={!category?"active":""}>Todos</Link>
      {categoryTabs.map(option=><Link key={option.value} href={inventoryCategoryHref(option.value)} className={category===option.value?"active":""}>{option.label}</Link>)}
      <Link href="/dashboard/inventory?view=settings" className="inventory-category-nav-settings"><UiIcon name="settings" size={14}/>Configuración</Link>
    </nav>
    </>}

    {platform&&canWrite&&!createOrganizationId&&<div className="section"><Alert variant="info" title="Selecciona una empresa">Usa el filtro Empresa para definir el contexto antes de crear productos, importar archivos, revisar movimientos recientes o generar requisiciones. Solo aparecen empresas de tu alcance autorizado.</Alert></div>}

    {(params.created||params.updated||params.movement||params.requisition_created)&&<div className="section phase7-feedback-stack">
      {params.created&&<Alert variant="success" title="Producto creado">Artículo creado y existencia inicial registrada en Kardex.</Alert>}
      {params.updated&&<Alert variant="success" title="Producto actualizado">Artículo actualizado correctamente.</Alert>}
      {params.movement&&<Alert variant="success" title="Kardex actualizado">Movimiento de Kardex registrado correctamente.</Alert>}
      {params.requisition_created&&<Alert variant="success" title="Requisiciones creadas">{params.requisition_created} requisición{params.requisition_created==="1"?"":"es"} creada{params.requisition_created==="1"?"":"s"} correctamente y separada{params.requisition_created==="1"?"":"s"} por proveedor.</Alert>}
    </div>}
    {error&&<div className="section"><Alert variant="danger" title="Revisa la información">{error}</Alert></div>}

    {canWrite && createOrganizationId && !creationGate.ready && <CreationPrerequisiteState
      icon="inventory" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message}
      href={creationGate.href || "/dashboard/locations"} action={creationGate.action || "Continuar"}
    />}

    {view==="summary"&&<>
    <MetricGrid className="section phase7-kpi-grid">
      <KpiCard label="Valor total inventario" value={money(totalValue)} hint={summary.active_count+" productos activos"} icon="inventory"/>
      <KpiCard label="Productos en stock" value={String(inStock)} hint={(summary.active_count?Math.round(inStock/summary.active_count*100):0)+"% del total activo"} icon="check" tone="success"/>
      <KpiCard label="Stock bajo" value={String(lowStock)} hint={(summary.active_count?Math.round(lowStock/summary.active_count*100):0)+"% del total activo"} icon="warning" tone="warning"/>
      <KpiCard label="Sin stock" value={String(outStock)} hint={(summary.active_count?Math.round(outStock/summary.active_count*100):0)+"% del total activo"} icon="error" tone="danger"/>
    </MetricGrid>
    <section className="section inventory-movements-section inventory-central-view">
      <div className="inventory-movements-panel card">
        <div className="inventory-secondary-heading">
          <div><span className="eyebrow">Kardex</span><h2>Últimos movimientos</h2><p className="muted">Trazabilidad reciente de entradas, salidas, devoluciones y traslados.</p></div>
          <Link className="button secondary" href="/dashboard/inventory/kardex"><UiIcon name="activity" size={15}/>Ver Kardex</Link>
        </div>
        <div className="inventory-movement-list">
          {movements.rows.length?movements.rows.map(move=>{
            const qty=Number(move.quantity||0);
            return <article key={move.id} className={"inventory-movement-item "+move.type}>
              <span><UiIcon name={move.type==="issue"||qty<0?"upload":move.type==="transfer"?"activity":"download"} size={17}/></span>
              <div><strong>{movementLabel(move.type,qty)}</strong><small>{move.sku} · {move.name}</small><em>{move.warehouse||"Sin bodega"}{move.destination?" → "+move.destination:""} · {new Date(move.movement_at).toLocaleDateString("es-CO")}</em></div>
              <Badge variant={move.type==="issue"||qty<0?"warning":"success"}>{qty>0?"+":""}{qty}</Badge>
            </article>;
          }):<div className="location-detail-empty">Todavía no hay movimientos registrados.</div>}
        </div>
      </div>
    </section>
    {canCreateRequisitions&&<section className="card section" id="crear-requisicion">
      <RequisitionBuilder
        items={requisitionItems.rows.map(item=>({
          id:item.id,supplier_id:item.supplier_id||"",supplier_name:item.supplier||"Proveedor",sku:item.sku,name:item.name,unit:item.unit,
          unit_cost:item.unit_cost,quantity:item.quantity,min_quantity:item.min_quantity,site_name:item.site,location_name:item.location,
        }))}
        returnTo="/dashboard/inventory"
        title="Generar requisiciones desde inventario"
        description="Selecciona insumos y cantidades. Si pertenecen a proveedores distintos, Desweb CMMS crea una requisición independiente para cada proveedor."
      />
    </section>}
    </>}

    {view==="products"&&<>
    <section className="section inventory-catalog-section inventory-central-view">
      <div className="inventory-products-panel">
        <div className="inventory-catalog-heading">
          <div><span className="eyebrow">Listado de inventario</span><h2>Catálogo y existencias</h2><p className="muted">La existencia se calcula desde movimientos de Kardex y bodegas.</p></div>
          <div className="inventory-catalog-heading-tools">
            <form className="inventory-catalog-sort" method="get">
              <input type="hidden" name="view" value="products"/>
              {q&&<input type="hidden" name="q" value={q}/>}
              {stockStatus!=="all"&&<input type="hidden" name="status" value={stockStatus}/>}
              {organization&&<input type="hidden" name="organization" value={organization}/>}
              {site&&<input type="hidden" name="site" value={site}/>}
              {category&&<input type="hidden" name="category" value={category}/>}
              {supplier&&<input type="hidden" name="supplier" value={supplier}/>}
              {warehouse&&<input type="hidden" name="warehouse" value={warehouse}/>}
              {record&&<input type="hidden" name="record" value={record}/>}
              {pageSize!==INVENTORY_DEFAULT_PAGE_SIZE&&<input type="hidden" name="pageSize" value={String(pageSize)}/>}
              <label>Ordenar por
                <select name="sortBy" defaultValue={sortBy} aria-label="Ordenar inventario">
                  <option value="name">Nombre</option>
                  <option value="sku">Código</option>
                </select>
              </label>
              <select name="sortDirection" defaultValue={sortDirection} aria-label="Dirección del orden">
                <option value="asc">A–Z</option>
                <option value="desc">Z–A</option>
              </select>
              <button className="ds-button ds-button-secondary ds-button-sm" type="submit">Ordenar</button>
            </form>
            <span>Mostrando {items.rowCount} de {summary.filtered_count} productos</span>
          </div>
        </div>

        {items.rows.length?<CollectionView storageKey="inventory" label="Vista de inventario" grid={<div className="inventory-product-grid inventory-catalog-grid" data-collection-grid>{items.rows.map(item=>{
          const state=stockState(item);
          const quantity=Number(item.quantity||0);
          return <InventoryCard
            key={item.id}
            variant="catalog"
            name={item.name}
            sku={item.sku}
            category={item.category||"Sin categoría"}
            presentation={item.presentation||item.unit}
            quantity={quantity}
            unit={item.unit}
            min={Number(item.min_quantity||0)}
            max={Number(item.max_quantity||0)}
            supplier={item.supplier||"Sin proveedor"}
            warehouse={item.warehouse||item.storage_location||"Sin bodega"}
            unitValue={money(Number(item.unit_cost||0))}
            status={state.label}
            statusTone={state.key==="out"?"danger":state.key==="low"?"warning":"success"}
            active={item.active}
            imageSrc={item.has_image?"/api/inventory/"+item.id+"/image":null}
            recordProps={{
              "data-module-record":true,"data-status":state.key,
              "data-search":[item.sku,item.name,item.description,item.category,item.company,item.site,item.location,item.warehouse,item.supplier].filter(Boolean).join(" "),
              "data-filter-organization":item.organization_id,"data-filter-organization-label":item.company,
              "data-filter-site":item.site_id||"","data-filter-site-label":item.site||"",
              "data-filter-category":item.category_id||"","data-filter-category-label":item.category||"",
              "data-filter-supplier":item.supplier_id||"","data-filter-supplier-label":item.supplier||"",
              "data-filter-warehouse":item.warehouse_id||"","data-filter-warehouse-label":item.warehouse||"",
              "data-filter-record":item.active?"active":"inactive","data-filter-record-label":item.active?"Activo":"Inactivo",
            }}
            actions={<>
              {canWrite&&<Link href={"/dashboard/inventory/"+item.id} className="inventory-catalog-action inventory-catalog-action-primary"><UiIcon name="eye" size={16}/>Ver detalles</Link>}
              {canWrite&&<Link href={"/dashboard/inventory/"+item.id+"#inventory-edit"} className="inventory-catalog-action inventory-catalog-action-secondary"><UiIcon name="edit" size={16}/>Editar</Link>}
              {item.supplier_id&&<details className="inventory-catalog-more">
                <summary title="Más opciones" aria-label={"Más opciones de "+item.name}><UiIcon name="more" size={18}/></summary>
                <div><Link href={"/dashboard/suppliers?supplier="+item.supplier_id+"&tab=inventory"}><UiIcon name="supplier" size={14}/>Ver proveedor</Link></div>
              </details>}
            </>}
          />;
        })}</div>} list={<StaticDataTable
          className="inventory-directory-list"
          caption="Listado de inventario"
          columns={[
            {key:"item",label:"Material / producto",width:"30%"},
            {key:"status",label:"Estado"},
            {key:"category",label:"Categoría"},
            {key:"stock",label:"Existencia",align:"end"},
            {key:"unit",label:"Unidad"},
            {key:"location",label:"Ubicación / bodega"},
            {key:"supplier",label:"Proveedor"},
            {key:"actions",label:"Acciones",align:"end"},
          ]}
          rows={items.rows.map(item=>{
            const state=stockState(item);
            const quantity=Number(item.quantity||0);
            return {
              id:item.id,
              recordProps:{
                "data-module-record":true,"data-status":state.key,
                "data-search":[item.sku,item.name,item.description,item.category,item.company,item.site,item.location,item.warehouse,item.supplier].filter(Boolean).join(" "),
                "data-filter-organization":item.organization_id,"data-filter-organization-label":item.company,
                "data-filter-site":item.site_id||"","data-filter-site-label":item.site||"",
                "data-filter-category":item.category_id||"","data-filter-category-label":item.category||"",
                "data-filter-supplier":item.supplier_id||"","data-filter-supplier-label":item.supplier||"",
                "data-filter-warehouse":item.warehouse_id||"","data-filter-warehouse-label":item.warehouse||"",
                "data-filter-record":item.active?"active":"inactive","data-filter-record-label":item.active?"Activo":"Inactivo",
              },
              cells:{
                item:<EntityIdentityCell
                  imageSrc={item.has_image?"/api/inventory/"+item.id+"/image":null}
                  imageAlt={item.has_image?"Imagen de "+item.name:""}
                  icon="inventory"
                  variant="thumbnail"
                  title={item.name}
                  subtitle={item.sku}
                  meta={item.presentation||item.description||null}
                />,
                status:<Badge variant={state.key==="out"?"danger":state.key==="low"?"warning":"success"}>{state.label}</Badge>,
                category:item.category||"Sin categoría",
                stock:quantity+" "+item.unit,
                unit:item.unit,
                location:item.warehouse||item.location||item.storage_location||item.site||"Sin registrar",
                supplier:item.supplier||"Sin proveedor",
                actions:<ListQuickActions>
                  {item.supplier_id&&<Link href={"/dashboard/suppliers?supplier="+item.supplier_id+"&tab=inventory"} className="ds-list-action" title="Ver proveedor" data-tooltip="Ver proveedor" aria-label={"Ver proveedor de "+item.name}><UiIcon name="supplier" size={16}/></Link>}
                  {canWrite&&<Link href={"/dashboard/inventory/"+item.id} className="ds-list-action primary" title="Ver detalles" data-tooltip="Ver detalles" aria-label={"Ver detalles de "+item.name}><UiIcon name="eye" size={16}/></Link>}
                </ListQuickActions>,
              },
            };
          })}
        />}/>:<EmptyState icon="asset" title={summary.total_count?"No hay artículos con estos filtros":"Aún no hay artículos"} description={summary.total_count?"Ajusta la búsqueda o los filtros para ver otros productos.":"Usa Agregar o Importar para comenzar."}/>}
        <UrlPagination
          page={page}
          pageCount={pageCount}
          label="Paginación de inventario"
          pageSize={pageSize}
          pageSizeOptions={[24,40,80]}
          total={summary.filtered_count}
        />
      </div>
    </section>
    </>}

    {view==="reports"&&<>
    <section className="section inventory-central-view">
      <Card header={<div><span className="eyebrow">Reportes</span><h2>Resumen de abastecimiento</h2></div>}>
        <StatTiles items={[
          {label:"Valor total",value:money(totalValue),hint:"existencia activa"},
          {label:"Cobertura saludable",value:String(inStock),hint:"productos sobre mínimo",tone:"success"},
          {label:"Riesgo de reposición",value:String(lowStock+outStock),hint:"stock bajo o agotado",tone:(lowStock+outStock)>0?"warning":"success"},
          {label:"Movimientos recientes",value:String(movements.rows.length),hint:"últimos registros Kardex"},
        ]}/>
        <div className="phase7-report-actions">
          <ModuleExportMenu entity="inventory"/>
          <Link className="button secondary" href="/dashboard/inventory/kardex"><UiIcon name="file" size={15}/> Abrir Kardex</Link>
        </div>
      </Card>
    </section>
    </>}

    {view==="settings"&&<>
    <section className="section inventory-central-view">
      <Card header={<div><span className="eyebrow">Configuración</span><h2>Catálogos y trazabilidad</h2></div>}>
        <div className="phase7-settings-grid">
          <Link href="/dashboard/inventory/categories"><UiIcon name="file"/><span><strong>Categorías</strong><small>{categories.rows.length} categorías activas disponibles</small></span></Link>
          <Link href="/dashboard/inventory/warehouses"><UiIcon name="location"/><span><strong>Almacenes</strong><small>{warehouses.rows.length} bodegas activas disponibles</small></span></Link>
          <Link href="/dashboard/suppliers"><UiIcon name="supplier"/><span><strong>Proveedores</strong><small>{suppliers.rows.length} proveedores de materiales disponibles</small></span></Link>
          <Link href="/dashboard/inventory/kardex"><UiIcon name="activity"/><span><strong>Reglas de stock</strong><small>El Kardex sigue siendo la autoridad de movimientos y saldos.</small></span></Link>
        </div>
      </Card>
    </section>
    </>}
  </div>;
}