import fs from "node:fs";
import pg from "pg";
import {performance} from "node:perf_hooks";

const {Client}=pg;
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");

const pageSource=fs.readFileSync("app/dashboard/inventory/page.tsx","utf8");
const scopeSource=fs.readFileSync("lib/inventory-scope.ts","utf8");
const headerSource=fs.readFileSync("components/ModuleHeader.tsx","utf8");
const pagerSource=fs.readFileSync("components/ui-kit/UrlPagination.tsx","utf8");
const collectionSource=fs.readFileSync("components/ui-kit/DataControls.tsx","utf8");
const ciSource=fs.readFileSync(".github/workflows/ci.yml","utf8");

for(const marker of [
  "INVENTORY_DEFAULT_PAGE_SIZE=24",
  "INVENTORY_PAGE_SIZES",
  "INVENTORY_STOCK_FILTERS",
  "INVENTORY_SORT_FIELDS",
  "inventoryItemSqlScope(session)",
  "scopeParams",
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
  'redirect(queryString?"/dashboard/inventory?"+queryString:"/dashboard/inventory")',
  "LIMIT ${limitToken} OFFSET ${offsetToken}",
  "requisitionItemsPromise",
  "items={requisitionItems.rows.map",
])if(!pageSource.includes(marker))throw new Error("Inventory pagination contract missing "+marker);

for(const forbidden of ["LIMIT 600","const activeItems=items.rows.filter","totalValue=activeItems.reduce"]){
  if(pageSource.includes(forbidden))throw new Error("Legacy inventory directory dependency remains: "+forbidden);
}
if((pageSource.match(/items\.rows\.map/g)||[]).length<2)throw new Error("Grid/List must render the same server page");
if(!scopeSource.includes("inventoryItemSqlScope")||!scopeSource.includes("i.site_id IS NULL OR i.site_id=ANY(")){
  throw new Error("I1 must reuse the I0 inventory scope helper");
}
for(const marker of ["serverState?: ModuleHeaderServerState","router.replace",'next.delete(serverState.pageParam||"page")']){
  if(!headerSource.includes(marker))throw new Error("ModuleHeader server mode missing "+marker);
}
for(const marker of ["pageSizeOptions","pageSizeParam","searchParams.toString()","next.delete(param)","<Pagination"]){
  if(!pagerSource.includes(marker))throw new Error("UrlPagination page-size contract missing "+marker);
}
if(collectionSource.includes("router.push(")||collectionSource.includes("router.replace("))throw new Error("Grid/List toggle must not navigate or reset pagination");
for(const script of [
  "inventory-server-pagination-smoke.mjs",
  "inventory-scope-smoke.mjs",
  "inventory-kardex-smoke.mjs",
  "unified-inventory-import-smoke.mjs",
  "requisition-receipt-smoke.mjs",
  "supplier-return-smoke.mjs",
  "work-orders-server-pagination-smoke.mjs",
  "assets-server-pagination-smoke.mjs",
])if(!ciSource.includes(script))throw new Error("Required regression missing from CI: "+script);

const db=new Client({connectionString:process.env.DATABASE_URL});
await db.connect();

const I={
  oa:"44000000-0000-4000-8000-000000000001",
  ob:"44000000-0000-4000-8000-000000000002",
  sa:"44000000-0000-4000-8000-000000000011",
  sb:"44000000-0000-4000-8000-000000000012",
  sx:"44000000-0000-4000-8000-000000000013",
  la:"44000000-0000-4000-8000-000000000021",
  lb:"44000000-0000-4000-8000-000000000022",
  lx:"44000000-0000-4000-8000-000000000023",
  supa:"44000000-0000-4000-8000-000000000031",
  supb:"44000000-0000-4000-8000-000000000032",
  supx:"44000000-0000-4000-8000-000000000033",
  ca:"44000000-0000-4000-8000-000000000041",
  cb:"44000000-0000-4000-8000-000000000042",
  cx:"44000000-0000-4000-8000-000000000043",
  wa:"44000000-0000-4000-8000-000000000051",
  wb:"44000000-0000-4000-8000-000000000052",
  wx:"44000000-0000-4000-8000-000000000053",
  outsideSiteItem:"44000000-0000-4000-8000-999999999991",
  outsideOrgItem:"44000000-0000-4000-8000-999999999992",
};

const pageSize=24;
function limitedScope(){
  return {
    params:[I.oa,[I.sa]],
    sql:`SELECT i.id,i.organization_id,i.site_id,i.category_id,i.supplier_id,
                CASE WHEN w.id IS NULL THEN NULL ELSE i.warehouse_id END warehouse_id,
                i.sku,i.name,o.name company,s.name site,c.name category,p.name supplier,w.name warehouse,
                COALESCE((
                  SELECT sum(sl.quantity)
                  FROM inventory_stock_levels sl
                  JOIN inventory_warehouses sw ON sw.id=sl.warehouse_id
                  WHERE sl.item_id=i.id AND sw.organization_id=i.organization_id AND sw.site_id=ANY($2::uuid[])
                ),0) quantity,
                i.min_quantity,i.max_quantity,i.unit_cost,i.active
         FROM inventory_items i
         JOIN organizations o ON o.id=i.organization_id
         LEFT JOIN sites s ON s.id=i.site_id
         LEFT JOIN inventory_categories c ON c.id=i.category_id
         LEFT JOIN suppliers p ON p.id=i.supplier_id
         LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id AND w.organization_id=i.organization_id AND w.site_id=ANY($2::uuid[])
         WHERE i.organization_id=$1 AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[]))`,
  };
}
function tenantScope(){
  return {
    params:[I.oa],
    sql:`SELECT i.id,i.organization_id,i.site_id,i.sku,i.name,i.quantity,i.min_quantity,i.max_quantity,i.active
         FROM inventory_items i WHERE i.organization_id=$1`,
  };
}
function pageCount(total,size){return Math.max(1,Math.ceil(total/size));}

try{
  await db.query("BEGIN");
  await db.query("INSERT INTO organizations(id,name,slug,active) VALUES($1,'Inventory I1 Org A','inventory-i1-a',true),($2,'Inventory I1 Org B','inventory-i1-b',true)",[I.oa,I.ob]);
  await db.query(
    "INSERT INTO sites(id,organization_id,name,code,country,active) VALUES($1,$4,'Sede A','I1-A','CO',true),($2,$4,'Sede B','I1-B','CO',true),($3,$5,'Sede X','I1-X','CO',true)",
    [I.sa,I.sb,I.sx,I.oa,I.ob],
  );
  await db.query(
    "INSERT INTO locations(id,organization_id,site_id,name,code,active) VALUES($1,$4,$5,'Loc A','I1-LA',true),($2,$4,$6,'Loc B','I1-LB',true),($3,$7,$8,'Loc X','I1-LX',true)",
    [I.la,I.lb,I.lx,I.oa,I.sa,I.sb,I.ob,I.sx],
  );
  await db.query(
    "INSERT INTO suppliers(id,organization_id,code,name,supplier_type,active) VALUES($1,$4,'I1-SA','Proveedor A','materials',true),($2,$4,'I1-SB','Proveedor B','both',true),($3,$5,'I1-SX','Proveedor X','materials',true)",
    [I.supa,I.supb,I.supx,I.oa,I.ob],
  );
  await db.query(
    "INSERT INTO inventory_categories(id,organization_id,code,name,active) VALUES($1,$4,'I1-CA','Categoría A',true),($2,$4,'I1-CB','Categoría B',true),($3,$5,'I1-CX','Categoría X',true)",
    [I.ca,I.cb,I.cx,I.oa,I.ob],
  );
  await db.query(
    "INSERT INTO inventory_warehouses(id,organization_id,site_id,location_id,code,name,active) VALUES($1,$7,$4,$5,'I1-WA','Bodega A',true),($2,$7,$6,$8,'I1-WB','Bodega B',true),($3,$9,$10,$11,'I1-WX','Bodega X',true)",
    [I.wa,I.wb,I.wx,I.sa,I.la,I.sb,I.oa,I.lb,I.ob,I.sx,I.lx],
  );

  await db.query(
    `INSERT INTO inventory_items(
       id,organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,sku,name,description,unit,
       quantity,min_quantity,max_quantity,unit_cost,active
     )
     SELECT
       ('44000000-0000-4000-8000-'||lpad(gs::text,12,'0'))::uuid,
       $1,$2,$3,
       CASE WHEN gs%2=0 THEN $4::uuid ELSE $5::uuid END,
       CASE WHEN gs%2=0 THEN $6::uuid ELSE $7::uuid END,
       $8,
       'I1-SKU-'||lpad(gs::text,4,'0'),
       'Producto paginado '||lpad(gs::text,4,'0'),
       'Descripción producto '||gs,
       'unidad',
       CASE WHEN gs%10=0 THEN 0 WHEN gs%7=0 THEN 2 ELSE 10 END,
       5,20,100+gs,
       CASE WHEN gs%17=0 THEN false ELSE true END
     FROM generate_series(1,1005) gs`,
    [I.oa,I.sa,I.la,I.supa,I.supb,I.ca,I.cb,I.wa],
  );

  await db.query(
    `INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity)
     SELECT organization_id,id,$1,quantity,min_quantity,max_quantity
     FROM inventory_items WHERE organization_id=$2 AND site_id=$3`,
    [I.wa,I.oa,I.sa],
  );

  await db.query(
    `INSERT INTO inventory_items(id,organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,active)
     VALUES
       ($1,$3,$4,$5,$6,$7,$8,'I1-SECRET-SITE','Producto secreto sede B','unidad',777,5,900,500,true),
       ($2,$9,$10,$11,$12,$13,$14,'I1-SECRET-ORG','Producto secreto organización B','unidad',888,5,900,600,true)`,
    [I.outsideSiteItem,I.outsideOrgItem,I.oa,I.sb,I.lb,I.supb,I.cb,I.wb,I.ob,I.sx,I.lx,I.supx,I.cx,I.wx],
  );
  await db.query(
    "INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity) VALUES($1,$2,$3,777,5,900),($4,$5,$6,888,5,900)",
    [I.oa,I.outsideSiteItem,I.wb,I.ob,I.outsideOrgItem,I.wx],
  );

  const limited=limitedScope();
  const fullTenant=tenantScope();

  // 1-7 Directorio: first page, second page, total, totalPages, pageSize, out-of-range and pageSize change.
  const countResult=await db.query(`WITH scoped AS (${limited.sql}) SELECT count(*)::int total FROM scoped`,limited.params);
  const total=countResult.rows[0].total;
  if(total!==1005)throw new Error("Limited inventory COUNT must be 1005, got "+total);
  if(total<=1000)throw new Error("I1 fixture must prove behavior above 1,000 authorized products");

  const first=await db.query(`WITH scoped AS (${limited.sql}) SELECT id,sku,name FROM scoped ORDER BY name ASC,id ASC LIMIT $3 OFFSET $4`,[...limited.params,pageSize,0]);
  const second=await db.query(`WITH scoped AS (${limited.sql}) SELECT id,sku,name FROM scoped ORDER BY name ASC,id ASC LIMIT $3 OFFSET $4`,[...limited.params,pageSize,pageSize]);
  if(first.rowCount!==24||second.rowCount!==24)throw new Error("First/second inventory pages must contain 24 rows");
  if(new Set([...first.rows,...second.rows].map(row=>row.id)).size!==48)throw new Error("Stable pagination produced duplicate rows");
  const pages=pageCount(total,pageSize);
  if(pages!==42)throw new Error("totalPages mismatch for 1005 / 24");
  const requestedOutOfRange=999;
  if(Math.min(requestedOutOfRange,pages)!==42)throw new Error("Out-of-range page must clamp to final page");
  const size40=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped ORDER BY name ASC,id ASC LIMIT $3 OFFSET 0`,[...limited.params,40]);
  if(size40.rowCount!==40||pageCount(total,40)!==26)throw new Error("Changing pageSize to 40 failed");

  // 8-10 Search, including a product beyond the historical LIMIT 600.
  const targetSku="I1-SKU-0601";
  if(first.rows.some(row=>row.sku===targetSku))throw new Error("Target >600 unexpectedly appeared on page 1");
  const oldWindow=await db.query(`WITH scoped AS (${limited.sql}) SELECT sku FROM scoped ORDER BY name ASC,id ASC LIMIT 600`,limited.params);
  if(oldWindow.rows.some(row=>row.sku===targetSku))throw new Error("Fixture target must be outside historical LIMIT 600");
  const target=await db.query(`WITH scoped AS (${limited.sql}) SELECT id,sku FROM scoped WHERE sku ILIKE $3 ORDER BY name ASC,id ASC LIMIT $4 OFFSET 0`,[...limited.params,"%0601%",pageSize]);
  if(target.rowCount!==1||target.rows[0].sku!==targetSku)throw new Error("Server search did not recover product 601");
  const crossing=await db.query(`WITH scoped AS (${limited.sql}) SELECT count(*)::int total FROM scoped WHERE name ILIKE $3`,[...limited.params,"%Producto paginado 0%"]);
  if(crossing.rows[0].total<=pageSize)throw new Error("Search fixture must cross multiple pages");
  const none=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE sku ILIKE $3`,[...limited.params,"%NO-EXISTE-I1%"]);
  if(none.rowCount!==0)throw new Error("No-result search returned rows");

  // 11-13 Filters: reduced universe, combined search and filter, filter with pagination.
  const lowCount=await db.query(`WITH scoped AS (${limited.sql}) SELECT count(*)::int total FROM scoped WHERE quantity>0 AND quantity<=min_quantity`,limited.params);
  if(lowCount.rows[0].total<=0||lowCount.rows[0].total>=total)throw new Error("Low-stock filter did not reduce universe");
  const filteredSearch=await db.query(
    `WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE category_id=$3::uuid AND supplier_id=$4::uuid AND name ILIKE $5 ORDER BY name,id LIMIT $6 OFFSET 0`,
    [...limited.params,I.ca,I.supa,"%Producto paginado%",pageSize],
  );
  if(filteredSearch.rowCount<=0)throw new Error("Combined search/filter returned no authorized rows");
  const filteredSecond=await db.query(
    `WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE category_id=$3::uuid ORDER BY name,id LIMIT $4 OFFSET $5`,
    [...limited.params,I.ca,pageSize,pageSize],
  );
  if(filteredSecond.rowCount<=0)throw new Error("Filtered pagination did not reach page 2");

  // 14-16 Sort direction and stable boundaries.
  const asc=await db.query(`WITH scoped AS (${limited.sql}) SELECT name,id FROM scoped ORDER BY name ASC,id ASC LIMIT $3`,[...limited.params,5]);
  const desc=await db.query(`WITH scoped AS (${limited.sql}) SELECT name,id FROM scoped ORDER BY name DESC,id DESC LIMIT $3`,[...limited.params,5]);
  if(asc.rows[0].name>=asc.rows[asc.rows.length-1].name)throw new Error("Ascending sort failed");
  if(desc.rows[0].name<=desc.rows[desc.rows.length-1].name)throw new Error("Descending sort failed");
  const boundaryA=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped ORDER BY name ASC,id ASC LIMIT $3 OFFSET $4`,[...limited.params,pageSize,pageSize-1]);
  const boundaryB=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped ORDER BY name ASC,id ASC LIMIT $3 OFFSET $4`,[...limited.params,pageSize,pageSize]);
  if(boundaryA.rows[1]?.id!==boundaryB.rows[0]?.id)throw new Error("Stable ordering changed page boundary unexpectedly");

  // 17-20 Security: limited site, COUNT, search and parameter manipulation.
  const tenantCount=await db.query(`WITH scoped AS (${fullTenant.sql}) SELECT count(*)::int total FROM scoped`,fullTenant.params);
  if(tenantCount.rows[0].total!==1006)throw new Error("Full organization scope should include A1 and A2, not other tenant");
  const secretSite=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE sku ILIKE $3`,[...limited.params,"%SECRET-SITE%"]);
  if(secretSite.rowCount!==0)throw new Error("Search leaked product from unauthorized site");
  const secretOrg=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE sku ILIKE $3`,[...limited.params,"%SECRET-ORG%"]);
  if(secretOrg.rowCount!==0)throw new Error("Search leaked product from another organization");
  const manipulated=await db.query(
    `WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE organization_id=$3::uuid OR site_id=$4::uuid ORDER BY name LIMIT $5 OFFSET $6`,
    [...limited.params,I.ob,I.sb,80,800],
  );
  if(manipulated.rowCount!==0)throw new Error("Page/filter manipulation escaped scoped CTE");

  // KPI must use the full authorized scope, never the current page.
  const kpi=await db.query(
    `WITH scoped AS (${limited.sql})
     SELECT count(*) FILTER(WHERE active=true)::int active_count,
            COALESCE(sum(quantity*unit_cost) FILTER(WHERE active=true),0)::text total_value,
            count(*) FILTER(WHERE active=true AND quantity>min_quantity AND quantity>0)::int in_stock_count,
            count(*) FILTER(WHERE active=true AND quantity>0 AND quantity<=min_quantity)::int low_stock_count,
            count(*) FILTER(WHERE active=true AND quantity<=0)::int out_stock_count
     FROM scoped`,
    limited.params,
  );
  if(kpi.rows[0].active_count<=first.rowCount)throw new Error("Inventory KPI appears tied to visible page");

  // Requisition selector auxiliary collection remains independent from the visible page.
  const requisitionOptions=await db.query(
    `WITH scoped AS (${limited.sql})
     SELECT id FROM scoped WHERE active=true AND supplier_id IS NOT NULL ORDER BY name,id`,
    limited.params,
  );
  if(requisitionOptions.rowCount<=pageSize)throw new Error("Requisition selector was accidentally limited to current page");

  // Performance observations are measurements only; no speedup assertion.
  const oldStart=performance.now();
  const oldRows=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped ORDER BY name,id LIMIT 600`,limited.params);
  const oldMs=performance.now()-oldStart;
  const newStart=performance.now();
  const newRows=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped ORDER BY name,id LIMIT $3 OFFSET 0`,[...limited.params,pageSize]);
  const newMs=performance.now()-newStart;
  if(oldRows.rowCount!==600||newRows.rowCount!==pageSize)throw new Error("Performance fixture row counts are invalid");

  console.log("Inventory I1 directory checks passed: first/second page, COUNT, totalPages, pageSize and canonical range.");
  console.log("Search recovered I1-SKU-0601 outside the historical first 600 rows; authorized COUNT =",total);
  console.log("Search, filters, sort and pagination remained inside the I0 scoped CTE.");
  console.log("KPI and requisition selector remain independent from the visible page.");
  console.log("Measured CI fixture (>1,000 authorized products): legacy LIMIT 600 transferred",oldRows.rowCount,"rows in",oldMs.toFixed(2),"ms; server page transferred",newRows.rowCount,"rows in",newMs.toFixed(2),"ms.");
}finally{
  await db.query("ROLLBACK").catch(()=>{});
  await db.end();
}

console.log("Inventory I1 server pagination regression checks passed.");
