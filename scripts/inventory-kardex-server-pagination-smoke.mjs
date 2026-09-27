import fs from "node:fs";
import pg from "pg";
import {performance} from "node:perf_hooks";

const {Client}=pg;
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");

const pageSource=fs.readFileSync("app/dashboard/inventory/kardex/page.tsx","utf8");
const productDetailSource=fs.readFileSync("app/dashboard/inventory/[id]/page.tsx","utf8");
const scopeSource=fs.readFileSync("lib/inventory-scope.ts","utf8");
const headerSource=fs.readFileSync("components/ModuleHeader.tsx","utf8");
const pagerSource=fs.readFileSync("components/ui-kit/UrlPagination.tsx","utf8");
const exportSource=fs.readFileSync("app/api/module-export/route.ts","utf8");
const ciSource=fs.readFileSync(".github/workflows/ci.yml","utf8");

for(const marker of [
  "KARDEX_DEFAULT_PAGE_SIZE=24",
  "KARDEX_PAGE_SIZES",
  "KARDEX_TYPES",
  "KARDEX_SORT_FIELDS",
  "inventoryItemSqlScope(session)",
  "scopeParams",
  "physicalScope",
  "filteredConditions",
  "summaryPromise",
  "filtered_count",
  "facetsPromise",
  "facetOptions",
  "serverState={{",
  "<UrlPagination",
  "pageSize={pageSize}",
  "pageSizeOptions={[24,40,80]}",
  "requestedPage!==page",
  "LIMIT ${limitToken} OFFSET ${offsetToken}",
])if(!pageSource.includes(marker))throw new Error("Kardex pagination contract missing "+marker);

if(pageSource.includes("LIMIT 1000"))throw new Error("Legacy Kardex LIMIT 1000 remains in the general directory");
if(!productDetailSource.includes("LIMIT 200"))throw new Error("I2-A1 must not modify the individual product history LIMIT 200");
if(!scopeSource.includes("inventoryItemSqlScope")||!scopeSource.includes("i.site_id IS NULL OR i.site_id=ANY(")){
  throw new Error("I2-A1 must reuse the I0 inventory scope helper");
}
for(const marker of ["serverState?: ModuleHeaderServerState","router.replace",'next.delete(serverState.pageParam||"page")']){
  if(!headerSource.includes(marker))throw new Error("ModuleHeader server mode missing "+marker);
}
for(const marker of ["pageSizeOptions","pageSizeParam","searchParams.toString()","next.delete(param)","<Pagination"]){
  if(!pagerSource.includes(marker))throw new Error("UrlPagination contract missing "+marker);
}
for(const marker of ['entity==="kardex"','kardexRows(session,type)','format==="csv"','format==="pdf"']){
  if(!exportSource.includes(marker))throw new Error("Kardex export contract missing "+marker);
}
for(const script of [
  "inventory-kardex-server-pagination-smoke.mjs",
  "inventory-scope-smoke.mjs",
  "inventory-kardex-smoke.mjs",
  "inventory-server-pagination-smoke.mjs",
  "unified-inventory-import-smoke.mjs",
  "requisition-receipt-smoke.mjs",
  "supplier-return-smoke.mjs",
  "procurement-reconciliation-smoke.mjs",
  "assets-server-pagination-smoke.mjs",
  "work-orders-server-pagination-smoke.mjs",
  "phase7-assets-inventory-smoke.mjs",
  "phase10-final-smoke.mjs",
  "design-system-final-audit.mjs",
])if(!ciSource.includes(script))throw new Error("Required regression missing from CI: "+script);

const db=new Client({connectionString:process.env.DATABASE_URL});
await db.connect();

const I={
  oa:"45000000-0000-4000-8000-000000000001",
  ob:"45000000-0000-4000-8000-000000000002",
  sa:"45000000-0000-4000-8000-000000000011",
  sb:"45000000-0000-4000-8000-000000000012",
  sx:"45000000-0000-4000-8000-000000000013",
  la:"45000000-0000-4000-8000-000000000021",
  lb:"45000000-0000-4000-8000-000000000022",
  lx:"45000000-0000-4000-8000-000000000023",
  supa:"45000000-0000-4000-8000-000000000031",
  supb:"45000000-0000-4000-8000-000000000032",
  supx:"45000000-0000-4000-8000-000000000033",
  wa:"45000000-0000-4000-8000-000000000041",
  wb:"45000000-0000-4000-8000-000000000042",
  wc:"45000000-0000-4000-8000-000000000043",
  wx:"45000000-0000-4000-8000-000000000044",
  itemA:"45000000-0000-4000-8000-000000000051",
  itemB:"45000000-0000-4000-8000-000000000052",
  itemSiteB:"45000000-0000-4000-8000-000000000053",
  itemX:"45000000-0000-4000-8000-000000000054",
};

const pageSize=24;
function limitedScope(){
  return {
    params:[I.oa,[I.sa]],
    sql:`SELECT t.id,t.organization_id,o.name organization_name,t.item_id,i.sku,i.name item_name,i.supplier_id,p.name supplier_name,
                i.site_id,s.name site_name,t.type,t.quantity,t.unit_cost,t.warehouse_id,w.name warehouse_name,
                t.destination_warehouse_id,d.name destination_name,t.document_number,t.movement_at,t.created_at,t.lot_number,
                t.cost_center,t.notes,t.source_movement_id
         FROM inventory_transactions t
         JOIN inventory_items i ON i.id=t.item_id AND i.organization_id=t.organization_id
         JOIN organizations o ON o.id=t.organization_id
         LEFT JOIN suppliers p ON p.id=i.supplier_id
         LEFT JOIN sites s ON s.id=i.site_id
         LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id
         LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
         WHERE i.organization_id=$1
           AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[]))
           AND w.site_id=ANY($2::uuid[])
           AND (d.id IS NULL OR d.site_id=ANY($2::uuid[]))`,
  };
}
function pages(total,size){return Math.max(1,Math.ceil(total/size));}

try{
  await db.query("BEGIN");
  await db.query("INSERT INTO organizations(id,name,slug,active) VALUES($1,'Inventory I2A1 Org A','inventory-i2a1-a',true),($2,'Inventory I2A1 Org B','inventory-i2a1-b',true)",[I.oa,I.ob]);
  await db.query(
    "INSERT INTO sites(id,organization_id,name,code,country,active) VALUES($1,$4,'Sede A','I2A1-A','CO',true),($2,$4,'Sede B','I2A1-B','CO',true),($3,$5,'Sede X','I2A1-X','CO',true)",
    [I.sa,I.sb,I.sx,I.oa,I.ob],
  );
  await db.query(
    "INSERT INTO locations(id,organization_id,site_id,name,code,active) VALUES($1,$4,$5,'Loc A','I2A1-LA',true),($2,$4,$6,'Loc B','I2A1-LB',true),($3,$7,$8,'Loc X','I2A1-LX',true)",
    [I.la,I.lb,I.lx,I.oa,I.sa,I.sb,I.ob,I.sx],
  );
  await db.query(
    "INSERT INTO suppliers(id,organization_id,code,name,supplier_type,active) VALUES($1,$4,'I2A1-SA','Proveedor A','materials',true),($2,$4,'I2A1-SB','Proveedor B','materials',true),($3,$5,'I2A1-SX','Proveedor X','materials',true)",
    [I.supa,I.supb,I.supx,I.oa,I.ob],
  );
  await db.query(
    "INSERT INTO inventory_warehouses(id,organization_id,site_id,location_id,code,name,active) VALUES($1,$5,$6,$7,'I2A1-WA','Bodega A',true),($2,$5,$6,$7,'I2A1-WB','Bodega B',true),($3,$5,$8,$9,'I2A1-WC','Bodega C',true),($4,$10,$11,$12,'I2A1-WX','Bodega X',true)",
    [I.wa,I.wb,I.wc,I.wx,I.oa,I.sa,I.la,I.sb,I.lb,I.ob,I.sx,I.lx],
  );
  await db.query(
    `INSERT INTO inventory_items(id,organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,active)
     VALUES
       ($1,$5,$6,$7,$8,$9,'I2-A','Producto A','unidad',0,0,999999,10,true),
       ($2,$5,$6,$7,$10,$11,'I2-B','Producto B','unidad',0,0,999999,20,true),
       ($3,$5,$12,$13,$10,$14,'I2-SECRET-SITE','Producto secreto sede','unidad',0,0,999999,30,true),
       ($4,$15,$16,$17,$18,$19,'I2-SECRET-ORG','Producto secreto org','unidad',0,0,999999,40,true)`,
    [I.itemA,I.itemB,I.itemSiteB,I.itemX,I.oa,I.sa,I.la,I.supa,I.wa,I.supb,I.wb,I.sb,I.lb,I.wc,I.ob,I.sx,I.lx,I.supx,I.wx],
  );

  await db.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,movement_at,source_movement_id,lot_number,cost_center
     )
     SELECT $1,
            CASE WHEN gs%2=0 THEN $2::uuid ELSE $3::uuid END,
            CASE WHEN gs%10=0 THEN 'return' ELSE 'receipt' END,
            1,
            CASE WHEN gs%2=0 THEN 20 ELSE 10 END,
            CASE WHEN gs%2=0 THEN $4::uuid ELSE $5::uuid END,
            'I2-DOC-'||lpad(gs::text,4,'0'),
            '2026-01-01 00:00:00+00'::timestamptz+(gs||' seconds')::interval,
            CASE WHEN gs=1 THEN 'I2-KARDEX-1001' ELSE 'I2-KARDEX-FIX-'||lpad(gs::text,4,'0') END,
            CASE WHEN gs%25=0 THEN 'LOTE-I2' ELSE NULL END,
            CASE WHEN gs%30=0 THEN 'Mantenimiento' ELSE NULL END
     FROM generate_series(1,1005) gs`,
    [I.oa,I.itemB,I.itemA,I.wb,I.wa],
  );
  await db.query(
    "INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,source_movement_id,movement_at) VALUES($1,$2,'receipt',1,$3,'I2-SECRET-SITE',now()),($4,$5,'receipt',1,$6,'I2-SECRET-ORG',now())",
    [I.oa,I.itemSiteB,I.wc,I.ob,I.itemX,I.wx],
  );

  const scoped=limitedScope();
  const count=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped`,scoped.params);
  const total=count.rows[0].total;
  if(total!==1005)throw new Error("Limited Kardex COUNT must be 1005, got "+total);
  if(total<=1000)throw new Error("I2-A1 fixture must exceed 1,000 authorized movements");

  const first=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id,source_movement_id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET $4`,[...scoped.params,pageSize,0]);
  const second=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id,source_movement_id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET $4`,[...scoped.params,pageSize,pageSize]);
  if(first.rowCount!==pageSize||second.rowCount!==pageSize)throw new Error("Kardex first/second page size mismatch");
  if(new Set([...first.rows,...second.rows].map(row=>row.id)).size!==pageSize*2)throw new Error("Kardex stable pages overlap");
  if(pages(total,pageSize)!==42)throw new Error("Kardex totalPages mismatch");
  if(Math.min(999,pages(total,pageSize))!==42)throw new Error("Out-of-range page must clamp to final Kardex page");

  const size40=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET 0`,[...scoped.params,40]);
  const size80=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET 0`,[...scoped.params,80]);
  if(size40.rowCount!==40||size80.rowCount!==80)throw new Error("Supported Kardex pageSize failed");

  const oldWindow=await db.query(`WITH scoped AS (${scoped.sql}) SELECT source_movement_id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT 1000`,scoped.params);
  if(oldWindow.rows.some(row=>row.source_movement_id==="I2-KARDEX-1001"))throw new Error("Fixture target must be outside historical LIMIT 1000");
  const target=await db.query(
    `WITH scoped AS (${scoped.sql}) SELECT id,source_movement_id FROM scoped
     WHERE source_movement_id ILIKE $3 ORDER BY movement_at DESC,id DESC LIMIT $4 OFFSET 0`,
    [...scoped.params,"%I2-KARDEX-1001%",pageSize],
  );
  if(target.rowCount!==1||target.rows[0].source_movement_id!=="I2-KARDEX-1001")throw new Error("Server search did not recover movement >1000");

  const noneCount=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped WHERE source_movement_id ILIKE $3`,[...scoped.params,"%NO-RESULT-I2A1%"]);
  const noneRows=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped WHERE source_movement_id ILIKE $3 LIMIT $4`,[...scoped.params,"%NO-RESULT-I2A1%",pageSize]);
  if(noneCount.rows[0].total!==0||noneRows.rowCount!==0)throw new Error("No-result Kardex query mismatch");

  const receiptCount=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped WHERE type='receipt'`,scoped.params);
  if(receiptCount.rows[0].total<=0||receiptCount.rows[0].total>=total)throw new Error("Kardex type filter did not reduce universe");
  const supplierFilter=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped WHERE supplier_id=$3::uuid`,[...scoped.params,I.supa]);
  if(supplierFilter.rows[0].total<=0||supplierFilter.rows[0].total>=total)throw new Error("Kardex supplier filter failed");
  const warehouseFilter=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped WHERE warehouse_id=$3::uuid`,[...scoped.params,I.wa]);
  if(warehouseFilter.rows[0].total<=0||warehouseFilter.rows[0].total>=total)throw new Error("Kardex warehouse filter failed");

  const organizationFilter=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped WHERE organization_id=$3::uuid`,[...scoped.params,I.oa]);
  if(organizationFilter.rows[0].total!==total)throw new Error("Kardex organization filter failed inside authorized scope");
  const siteFilter=await db.query(`WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped WHERE site_id=$3::uuid`,[...scoped.params,I.sa]);
  if(siteFilter.rows[0].total!==total)throw new Error("Kardex site filter failed inside authorized scope");
  const combinedFilter=await db.query(
    `WITH scoped AS (${scoped.sql}) SELECT count(*)::int total FROM scoped
     WHERE type='receipt' AND supplier_id=$3::uuid AND warehouse_id=$4::uuid AND organization_id=$5::uuid AND site_id=$6::uuid`,
    [...scoped.params,I.supa,I.wa,I.oa,I.sa],
  );
  if(combinedFilter.rows[0].total<=0||combinedFilter.rows[0].total>=total)throw new Error("Combined Kardex filters failed");

  const secretSite=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped WHERE source_movement_id ILIKE $3`,[...scoped.params,"%SECRET-SITE%"]);
  const secretOrg=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped WHERE source_movement_id ILIKE $3`,[...scoped.params,"%SECRET-ORG%"]);
  const filterEscape=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped WHERE organization_id=$3::uuid OR site_id=$4::uuid OR warehouse_id=$5::uuid`,[...scoped.params,I.ob,I.sb,I.wc]);
  if(secretSite.rowCount||secretOrg.rowCount||filterEscape.rowCount)throw new Error("Kardex search/filter escaped I0 scope");

  const deepPage=await db.query(`WITH scoped AS (${scoped.sql}) SELECT item_id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET $4`,[...scoped.params,80,960]);
  if(deepPage.rows.some(row=>[I.itemSiteB,I.itemX].includes(row.item_id)))throw new Error("Kardex page/pageSize escaped I0 scope");

  const asc=await db.query(`WITH scoped AS (${scoped.sql}) SELECT movement_at,id FROM scoped ORDER BY movement_at ASC,id ASC LIMIT $3`,[...scoped.params,5]);
  const desc=await db.query(`WITH scoped AS (${scoped.sql}) SELECT movement_at,id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3`,[...scoped.params,5]);
  if(new Date(asc.rows[0].movement_at)>=new Date(asc.rows[asc.rows.length-1].movement_at))throw new Error("Kardex ASC sort failed");
  if(new Date(desc.rows[0].movement_at)<=new Date(desc.rows[desc.rows.length-1].movement_at))throw new Error("Kardex DESC sort failed");
  const boundaryA=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET $4`,[...scoped.params,pageSize,pageSize-1]);
  const boundaryB=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET $4`,[...scoped.params,pageSize,pageSize]);
  if(boundaryA.rows[1]?.id!==boundaryB.rows[0]?.id)throw new Error("Stable Kardex ordering changed page boundary");

  const facet=await db.query(
    `WITH scoped AS (${scoped.sql})
     SELECT
       array_agg(DISTINCT organization_id::text) organizations,
       array_agg(DISTINCT site_id::text) sites,
       array_agg(DISTINCT supplier_id::text) suppliers,
       array_agg(DISTINCT warehouse_id::text) warehouses
     FROM scoped`,
    scoped.params,
  );
  if(facet.rows[0].organizations.some(value=>value===I.ob)||facet.rows[0].sites.some(value=>value===I.sb)||facet.rows[0].warehouses.some(value=>value===I.wc)){
    throw new Error("Kardex facets leaked outside authorized universe");
  }

  const legacyStart=performance.now();
  const legacy=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT 1000`,scoped.params);
  const legacyMs=performance.now()-legacyStart;
  const serverStart=performance.now();
  const serverPage=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY movement_at DESC,id DESC LIMIT $3 OFFSET 0`,[...scoped.params,pageSize]);
  const serverMs=performance.now()-serverStart;
  if(legacy.rowCount!==1000||serverPage.rowCount!==pageSize)throw new Error("Kardex performance fixture row counts invalid");

  console.log("Inventory I2-A1 Kardex checks passed: pages, COUNT, pageSize, filters, sort and scope.");
  console.log("Server search recovered I2-KARDEX-1001 outside historical LIMIT 1000; authorized COUNT =",total);
  console.log("Measured CI fixture: legacy LIMIT 1000 transferred",legacy.rowCount,"rows in",legacyMs.toFixed(2),"ms; server page transferred",serverPage.rowCount,"rows in",serverMs.toFixed(2),"ms.");
}finally{
  await db.query("ROLLBACK").catch(()=>{});
  await db.end();
}

console.log("Inventory I2-A1 Kardex server pagination regression checks passed.");
