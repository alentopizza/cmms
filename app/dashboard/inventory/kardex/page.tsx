import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import ModuleHeader, { type ModuleFacetOptionMap } from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import InventorySubnav from "@/components/InventorySubnav";
import UiIcon from "@/components/UiIcon";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { UrlPagination } from "@/components/ui-kit/UrlPagination";
import { inventoryItemSqlScope } from "@/lib/inventory-scope";

type Tx={
  id:string;organization_id:string;organization_name:string;item_id:string;sku:string;item_name:string;unit:string;supplier_id:string|null;supplier_name:string|null;
  site_id:string|null;site_name:string|null;type:string;quantity:string;unit_cost:string|null;warehouse_id:string|null;warehouse_name:string|null;
  destination_warehouse_id:string|null;destination_name:string|null;document_number:string|null;movement_at:string;lot_number:string|null;expires_at:string|null;
  cost_center:string|null;notes:string|null;created_by_name:string|null;requisition_id:string|null;requisition_number:string|null;supplier_return_number:string|null;
  source_movement_id:string|null;import_number:string|null;import_created_at:string|null;
};
type Item={id:string;sku:string;name:string;unit:string;organization_id:string;site_id:string|null;warehouse_id:string|null};
type Warehouse={id:string;name:string;organization_id:string;site_id:string|null};

type KardexSummary={total_count:number;filtered_count:number};
type KardexFacetValue={value:string;label:string};
type KardexFacetRow={
  organizations:KardexFacetValue[];
  sites:KardexFacetValue[];
  suppliers:KardexFacetValue[];
  warehouses:KardexFacetValue[];
};
type KardexSearchParams={
  type?:string;created?:string;error?:string;
  q?:string;organization?:string;site?:string;supplier?:string;warehouse?:string;
  sortBy?:string;sortDirection?:string;page?:string;pageSize?:string;
};

const KARDEX_DEFAULT_PAGE_SIZE=24;
const KARDEX_PAGE_SIZES=new Set([24,40,80]);
const KARDEX_TYPES=new Set(["receipt","issue","adjustment","transfer","return","supplier_return"]);
const KARDEX_SORT_FIELDS:Record<string,string>={
  date:"movement_at",
  item:"item_name",
  type:"type",
  quantity:"quantity",
  cost:"unit_cost",
};

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
  const parsed=Number.parseInt(String(value||KARDEX_DEFAULT_PAGE_SIZE),10);
  return KARDEX_PAGE_SIZES.has(parsed)?parsed:KARDEX_DEFAULT_PAGE_SIZE;
}
function likePattern(value:string){
  return "%"+value.replace(/[\\%_]/g,match=>"\\"+match)+"%";
}

function typeTone(type:string,quantity:number):BadgeVariant{
  if(type==="receipt"||type==="return")return "success";
  if(type==="issue"||type==="supplier_return")return "warning";
  if(type==="transfer")return "info";
  return quantity<0?"danger":"brand";
}
function typeLabel(type:string,quantity:number){
  if(type==="receipt")return "Entrada";
  if(type==="issue")return "Salida";
  if(type==="return")return "Devolución a inventario";
  if(type==="supplier_return")return "Devolución a proveedor";
  if(type==="transfer")return "Transferencia";
  return quantity<0?"Ajuste negativo":"Ajuste positivo";
}
function sectionTitle(type:string|undefined){
  if(type==="receipt")return "Entradas";
  if(type==="issue")return "Salidas";
  if(type==="adjustment")return "Ajustes";
  if(type==="transfer")return "Transferencias";
  if(type==="return")return "Devoluciones a inventario";
  if(type==="supplier_return")return "Devoluciones a proveedor";
  return "Kardex";
}
function activeSection(type:string|undefined){
  if(type==="receipt")return "entries" as const;
  if(type==="issue")return "issues" as const;
  if(type==="adjustment")return "adjustments" as const;
  if(type==="transfer")return "transfers" as const;
  return "kardex" as const;
}

export default async function InventoryKardexPage({searchParams}:{searchParams:Promise<KardexSearchParams>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"inventory.read"))redirect("/dashboard");
  const params=await searchParams;
  const q=safeText(params.q);
  const requestedType=KARDEX_TYPES.has(params.type||"")?String(params.type):"";
  const organization=safeUuid(params.organization);
  const site=safeUuid(params.site);
  const supplier=safeUuid(params.supplier);
  const warehouse=safeUuid(params.warehouse);
  const sortBy=KARDEX_SORT_FIELDS[params.sortBy||""]?String(params.sortBy):"date";
  const sortDirection=params.sortDirection==="asc"?"asc":"desc";
  const requestedPage=safePage(params.page);
  const pageSize=safePageSize(params.pageSize);
  const canWrite=can(session,"inventory.write");
  const orgId=session.organizationId;

  // I2-A1 deliberately reuses the I0 product/site scope instead of rebuilding
  // organization and legacy site semantics inside the Kardex.
  const itemScope=inventoryItemSqlScope(session);
  const scopeParams=[...itemScope.params];
  const limitedSiteScope=itemScope.limitedSiteScope;
  const siteScopeToken=itemScope.siteParamToken;
  if(limitedSiteScope&&!siteScopeToken)throw new Error("Inventory site scope token is required for limited Kardex sessions");

  const physicalScope=limitedSiteScope
    ?` AND w.site_id=ANY(${siteScopeToken}::uuid[]) AND (d.id IS NULL OR d.site_id=ANY(${siteScopeToken}::uuid[]))`
    :"";
  const scopeWhere=itemScope.where+physicalScope;

  const scopedSql=`
    SELECT t.id,t.organization_id,o.name organization_name,t.item_id,i.sku,i.name item_name,i.unit,i.supplier_id,p.name supplier_name,
           i.site_id,s.name site_name,t.type,t.quantity,t.unit_cost,t.warehouse_id,w.name warehouse_name,
           t.destination_warehouse_id,d.name destination_name,t.document_number,t.movement_at,t.created_at,t.lot_number,t.expires_at,
           t.cost_center,t.notes,u.full_name created_by_name,t.requisition_id,r.number requisition_number,
           sr.number supplier_return_number,t.source_movement_id,b.import_number,b.created_at import_created_at
    FROM inventory_transactions t
    JOIN inventory_items i ON i.id=t.item_id AND i.organization_id=t.organization_id
    JOIN organizations o ON o.id=t.organization_id
    LEFT JOIN suppliers p ON p.id=i.supplier_id
    LEFT JOIN sites s ON s.id=i.site_id
    LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id
    LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
    LEFT JOIN users u ON u.id=t.created_by
    LEFT JOIN supplier_requisitions r ON r.id=t.requisition_id
    LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id
    LEFT JOIN bulk_import_batches b ON b.id=t.import_batch_id
    ${scopeWhere}`;

  const filteredParams=[...scopeParams];
  const filteredConditions:string[]=[];
  if(q){
    filteredParams.push(likePattern(q));
    const token="$"+filteredParams.length;
    filteredConditions.push(`(
      sku ILIKE ${token} ESCAPE E'\\\\' OR
      item_name ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(document_number,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(source_movement_id,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(supplier_name,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(warehouse_name,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(destination_name,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(lot_number,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(cost_center,'') ILIKE ${token} ESCAPE E'\\\\' OR
      COALESCE(created_by_name,'') ILIKE ${token} ESCAPE E'\\\\' OR
      CASE WHEN requisition_number IS NULL THEN '' ELSE 'REQ-'||lpad(requisition_number::text,6,'0') END ILIKE ${token} ESCAPE E'\\\\' OR
      CASE WHEN supplier_return_number IS NULL THEN '' ELSE 'DEV-'||lpad(supplier_return_number::text,6,'0') END ILIKE ${token} ESCAPE E'\\\\' OR
      CASE WHEN import_number IS NULL THEN '' ELSE
        'IMP-'||EXTRACT(YEAR FROM COALESCE(import_created_at,movement_at))::int::text||'-'||lpad(import_number::text,6,'0')
      END ILIKE ${token} ESCAPE E'\\\\'
    )`);
  }
  if(requestedType){
    filteredParams.push(requestedType);
    filteredConditions.push("type=$"+filteredParams.length);
  }
  if(organization){
    filteredParams.push(organization);
    filteredConditions.push("organization_id=$"+filteredParams.length+"::uuid");
  }
  if(site){
    filteredParams.push(site);
    filteredConditions.push("site_id=$"+filteredParams.length+"::uuid");
  }
  if(supplier){
    filteredParams.push(supplier);
    filteredConditions.push("supplier_id=$"+filteredParams.length+"::uuid");
  }
  if(warehouse){
    filteredParams.push(warehouse);
    filteredConditions.push("warehouse_id=$"+filteredParams.length+"::uuid");
  }
  const filteredWhere=filteredConditions.length?"WHERE "+filteredConditions.join(" AND "):"";

  const summaryPromise=query<KardexSummary>(
    `WITH scoped AS (${scopedSql}),
          filtered AS (SELECT * FROM scoped ${filteredWhere})
     SELECT
       (SELECT count(*)::int FROM scoped) total_count,
       (SELECT count(*)::int FROM filtered) filtered_count`,
    filteredParams,
  );
  const facetsPromise=query<KardexFacetRow>(
    `WITH scoped AS (${scopedSql})
     SELECT
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (
         SELECT DISTINCT organization_id::text value,organization_name label FROM scoped
       ) v),'[]'::jsonb) organizations,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (
         SELECT DISTINCT site_id::text value,site_name label FROM scoped WHERE site_id IS NOT NULL AND site_name IS NOT NULL
       ) v),'[]'::jsonb) sites,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (
         SELECT DISTINCT supplier_id::text value,supplier_name label FROM scoped WHERE supplier_id IS NOT NULL AND supplier_name IS NOT NULL
       ) v),'[]'::jsonb) suppliers,
       COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.label) FROM (
         SELECT DISTINCT warehouse_id::text value,warehouse_name label FROM scoped WHERE warehouse_id IS NOT NULL AND warehouse_name IS NOT NULL
       ) v),'[]'::jsonb) warehouses`,
    scopeParams,
  );

  const itemsPromise=orgId
    ?session.accessAllSites
      ?query<Item>(`SELECT id,sku,name,unit,organization_id,site_id,warehouse_id FROM inventory_items
                    WHERE organization_id=$1 AND active=true ORDER BY name`,[orgId])
      :query<Item>(`SELECT id,sku,name,unit,organization_id,site_id,warehouse_id FROM inventory_items
                    WHERE organization_id=$1 AND active=true AND (site_id IS NULL OR site_id=ANY($2::uuid[])) ORDER BY name`,[orgId,session.siteIds])
    :Promise.resolve({rows:[]} as {rows:Item[]});
  const warehousesPromise=orgId
    ?session.accessAllSites
      ?query<Warehouse>("SELECT id,name,organization_id,site_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[orgId])
      :query<Warehouse>("SELECT id,name,organization_id,site_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND site_id=ANY($2::uuid[]) ORDER BY name",[orgId,session.siteIds])
    :Promise.resolve({rows:[]} as {rows:Warehouse[]});

  const [summaryResult,facetsResult,items,warehouses]=await Promise.all([
    summaryPromise,facetsPromise,itemsPromise,warehousesPromise,
  ]);
  const summary=summaryResult.rows[0]||{total_count:0,filtered_count:0};
  const pageCount=Math.max(1,Math.ceil(summary.filtered_count/pageSize));
  const page=Math.min(requestedPage,pageCount);
  if(requestedPage!==page){
    const canonical=new URLSearchParams();
    if(params.created)canonical.set("created",params.created);
    if(params.error)canonical.set("error",params.error);
    if(q)canonical.set("q",q);
    if(requestedType)canonical.set("type",requestedType);
    if(organization)canonical.set("organization",organization);
    if(site)canonical.set("site",site);
    if(supplier)canonical.set("supplier",supplier);
    if(warehouse)canonical.set("warehouse",warehouse);
    if(sortBy!=="date")canonical.set("sortBy",sortBy);
    if(sortDirection!=="desc")canonical.set("sortDirection",sortDirection);
    if(pageSize!==KARDEX_DEFAULT_PAGE_SIZE)canonical.set("pageSize",String(pageSize));
    if(page>1)canonical.set("page",String(page));
    const queryString=canonical.toString();
    redirect(queryString?"/dashboard/inventory/kardex?"+queryString:"/dashboard/inventory/kardex");
  }

  const pageParams=[...filteredParams,pageSize,(page-1)*pageSize];
  const limitToken="$"+(pageParams.length-1);
  const offsetToken="$"+pageParams.length;
  const orderColumn=KARDEX_SORT_FIELDS[sortBy]||KARDEX_SORT_FIELDS.date;
  const orderDirection=sortDirection==="asc"?"ASC":"DESC";
  const transactions=await query<Tx>(
    `WITH scoped AS (${scopedSql})
     SELECT id,organization_id,organization_name,item_id,sku,item_name,unit,supplier_id,supplier_name,
            site_id,site_name,type,quantity::text,unit_cost::text,warehouse_id,warehouse_name,
            destination_warehouse_id,destination_name,document_number,movement_at::text,lot_number,expires_at::text,
            cost_center,notes,created_by_name,requisition_id,requisition_number::text,supplier_return_number::text,
            source_movement_id,import_number::text,import_created_at::text
     FROM scoped
     ${filteredWhere}
     ORDER BY ${orderColumn} ${orderDirection},id ${orderDirection}
     LIMIT ${limitToken} OFFSET ${offsetToken}`,
    pageParams,
  );

  const rawFacets=facetsResult.rows[0]||{organizations:[],sites:[],suppliers:[],warehouses:[]};
  const facetOptions:ModuleFacetOptionMap={
    organization:Array.isArray(rawFacets.organizations)?rawFacets.organizations:[],
    site:Array.isArray(rawFacets.sites)?rawFacets.sites:[],
    supplier:Array.isArray(rawFacets.suppliers)?rawFacets.suppliers:[],
    warehouse:Array.isArray(rawFacets.warehouses)?rawFacets.warehouses:[],
  };

  const error=params.error==="stock"?"El movimiento fue rechazado porque dejaría existencias negativas o incumple las reglas del Kardex."
    :params.error==="relation"?"La bodega seleccionada no pertenece a la empresa."
    :params.error?"Revisa artículo, movimiento, cantidad y bodegas.":"";
  const initialMovement=requestedType==="receipt"?"receipt":requestedType==="issue"?"issue":requestedType==="transfer"?"transfer":requestedType==="adjustment"?"adjustment_positive":"receipt";

  return <div className="phase7-inventory phase7-kardex">
    <ModuleHeader
      eyebrow="Inventario"
      title={sectionTitle(requestedType)}
      description="Historial auditable de entradas, salidas, ajustes, devoluciones y transferencias por bodega."
      count={summary.total_count}
      countLabel="movimientos"
      searchPlaceholder="Buscar SKU, producto, documento, MOVIMIENTO_ID, IMP, proveedor, bodega o lote"
      filters={[
        {value:"all",label:"Todos"},{value:"receipt",label:"Entradas"},{value:"issue",label:"Salidas"},
        {value:"adjustment",label:"Ajustes"},{value:"return",label:"Dev. a inventario"},{value:"supplier_return",label:"Dev. a proveedor"},{value:"transfer",label:"Transferencias"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
        {key:"warehouse",label:"Bodega",allLabel:"Todas las bodegas"},
      ]}
      serverState={{
        search:q,
        filter:requestedType||"all",
        facetValues:{
          organization:organization||"all",
          site:site||"all",
          supplier:supplier||"all",
          warehouse:warehouse||"all",
        },
        facetOptions,
        filteredCount:summary.filtered_count,
        searchParam:"q",
        filterParam:"type",
        pageParam:"page",
      }}
      action={<div className="module-header-action-group">
        <ModuleExportMenu entity="kardex" type={requestedType||undefined}/>
        {canWrite&&orgId?<CreateRecordModal title="Registrar movimiento" eyebrow="Kardex" description="El saldo se actualizará únicamente después de validar la existencia y las bodegas." triggerLabel="Nuevo movimiento" iconName="inventory">
        <form className="form-grid unified-popup-form" method="post" action="/api/inventory/movements">
          <div className="field form-span-2"><label>Artículo *</label><select name="item_id" required><option value="">Selecciona SKU / producto</option>{items.rows.map(item=><option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></div>
          <div className="field"><label>Movimiento *</label><select name="movement_type" defaultValue={initialMovement} required><option value="receipt">Entrada</option><option value="issue">Salida</option><option value="adjustment_positive">Ajuste positivo</option><option value="adjustment_negative">Ajuste negativo</option><option value="return">Devolución a inventario</option><option value="transfer">Transferencia</option></select><small>Las devoluciones a proveedor se registran únicamente desde la requisición/recepción de origen.</small></div>
          <div className="field"><label>Cantidad *</label><input name="quantity" type="number" min="0.001" step="0.001" required/></div>
          <div className="field"><label>Bodega origen *</label><select name="warehouse_id" required><option value="">Selecciona</option>{warehouses.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="field"><label>Bodega destino</label><select name="destination_warehouse_id"><option value="">Solo para transferencia</option>{warehouses.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="field"><label>Fecha / hora</label><input name="movement_at" type="datetime-local"/></div>
          <div className="field"><label>Documento</label><input name="document_number" placeholder="OC, REQ, ajuste..."/></div>
          <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" min="0" step="0.01"/></div>
          <div className="field"><label>Lote</label><input name="lot_number"/></div>
          <div className="field"><label>Vencimiento</label><input name="expires_at" type="date"/></div>
          <div className="field"><label>Centro de costo</label><input name="cost_center"/></div>
          <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3}/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Registrar movimiento</button></div>
        </form>
      </CreateRecordModal>:null}
      </div>}
    />
    <InventorySubnav active={activeSection(requestedType)}/>
    {params.created&&<div className="section"><Alert variant="success" title="Movimiento registrado">Existencias actualizadas correctamente en Kardex.</Alert></div>}
    {error&&<div className="section"><Alert variant="danger" title="Movimiento rechazado">{error}</Alert></div>}

    <section className="card section inventory-kardex-directory phase7-anchor">
      <div className="ds-data-table-shell inventory-kardex-table-wrap"><div className="ds-data-table-scroll"><table className="ds-data-table inventory-kardex-table"><thead><tr>
        <th>Fecha</th><th>Movimiento</th><th>SKU / producto</th><th>Documento</th><th>Bodega</th><th>Cantidad</th><th>Costo</th><th>Lote / centro</th><th>Usuario</th>
      </tr></thead><tbody>
        {transactions.rows.map(tx=>{
          const qty=Number(tx.quantity||0);
          const displayQty=tx.type==="issue"||tx.type==="supplier_return"?-Math.abs(qty):qty;
          return <tr key={tx.id} data-module-record data-status={tx.type}
            data-search={[tx.sku,tx.item_name,tx.document_number,tx.source_movement_id,tx.import_number?"IMP-"+new Date(tx.import_created_at||tx.movement_at).getFullYear()+"-"+tx.import_number.padStart(6,"0"):null,tx.supplier_name,tx.warehouse_name,tx.destination_name,tx.lot_number,tx.cost_center,tx.created_by_name,tx.requisition_number?"REQ-"+tx.requisition_number.padStart(6,"0"):null,tx.supplier_return_number?"DEV-"+tx.supplier_return_number.padStart(6,"0"):null].filter(Boolean).join(" ")}
            data-filter-organization={tx.organization_id} data-filter-organization-label={tx.organization_name}
            data-filter-site={tx.site_id||""} data-filter-site-label={tx.site_name||""}
            data-filter-supplier={tx.supplier_id||""} data-filter-supplier-label={tx.supplier_name||""}
            data-filter-warehouse={tx.warehouse_id||""} data-filter-warehouse-label={tx.warehouse_name||""}>
            <td><strong>{new Date(tx.movement_at).toLocaleDateString("es-CO")}</strong><small className="table-subline">{new Date(tx.movement_at).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</small></td>
            <td><Badge variant={typeTone(tx.type,qty)}>{typeLabel(tx.type,qty)}</Badge></td>
            <td><strong>{tx.sku}</strong><small className="table-subline">{tx.item_name} · {tx.supplier_name||"Sin proveedor"}</small></td>
            <td>{tx.document_number||"—"}{tx.source_movement_id?<small className="table-subline">MOV · {tx.source_movement_id}</small>:null}{tx.import_number?<small className="table-subline">IMP-{new Date(tx.import_created_at||tx.movement_at).getFullYear()}-{tx.import_number.padStart(6,"0")}</small>:null}{tx.supplier_return_number?<small className="table-subline">DEV-{tx.supplier_return_number.padStart(6,"0")}</small>:null}{tx.requisition_id&&tx.requisition_number?<Link className="table-subline kardex-requisition-link" href={"/dashboard/requisitions/"+tx.requisition_id}>REQ-{tx.requisition_number.padStart(6,"0")}</Link>:null}</td>
            <td>{tx.warehouse_name||"—"}{tx.destination_name?<small className="table-subline">→ {tx.destination_name}</small>:null}</td>
            <td><strong className={displayQty<0?"kardex-negative":"kardex-positive"}>{displayQty>0?"+":""}{displayQty} {tx.unit}</strong></td>
            <td>{tx.unit_cost?Number(tx.unit_cost).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}):"—"}</td>
            <td>{tx.lot_number||"—"}<small className="table-subline">{tx.cost_center||""}{tx.expires_at?" · vence "+new Date(tx.expires_at+"T12:00:00").toLocaleDateString("es-CO"):""}</small></td>
            <td>{tx.created_by_name||"Sistema"}</td>
          </tr>;
        })}
      </tbody></table></div></div>
      {!transactions.rowCount&&<EmptyState icon="file" title="No hay movimientos para este filtro" description="Registra un movimiento o cambia la sección del Kardex."/>}
      <UrlPagination
        page={page}
        pageCount={pageCount}
        label="Paginación del Kardex"
        pageSize={pageSize}
        pageSizeOptions={[24,40,80]}
        total={summary.filtered_count}
      />
    </section>
  </div>;
}
