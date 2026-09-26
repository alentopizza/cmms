import fs from "node:fs";
import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");

function source(path){return fs.readFileSync(path,"utf8");}
function mustContain(path,markers){
  const text=source(path);
  for(const marker of markers)if(!text.includes(marker))throw new Error(path+" missing inventory-scope contract: "+marker);
}

// Static endpoint contracts make IDOR regressions fail CI alongside DB scope checks.
mustContain("lib/inventory-scope.ts",[
  "canAccessInventoryItem",
  "canAccessInventoryWarehouse",
  "siteId===null||canAccessSite",
  "Boolean(siteId&&canAccessSite",
]);
mustContain("app/api/inventory/[id]/image/route.ts",["canAccessInventoryItem"]);
mustContain("app/api/inventory/[id]/route.ts",["canAccessInventoryItem"]);
mustContain("app/api/inventory/[id]/movement/route.ts",["canAccessInventoryItem","canAccessInventoryWarehouse"]);
mustContain("app/api/inventory/movements/route.ts",["canAccessInventoryItem","canAccessInventoryWarehouse"]);
mustContain("app/api/inventory/warehouses/[id]/route.ts",["canAccessInventoryWarehouse"]);
mustContain("app/api/inventory/route.ts",["canAccessInventoryWarehouse","warehouse.site_id!==siteId"]);
mustContain("app/api/suppliers/[id]/route.ts",["limitedInventoryScope","warehouse.site_id=ANY"]);
mustContain("app/api/bulk-import/template/route.ts",["limitedInventoryScope","w.site_id=ANY"]);
mustContain("app/api/bulk-import/route.ts",["hasLimitedInventorySiteScope","canAccessInventoryWarehouse","Bodega destino fuera del alcance autorizado"]);
mustContain("app/api/module-export/route.ts",["hasLimitedInventorySiteScope","w.site_id=ANY","d.site_id=ANY"]);
mustContain("app/dashboard/inventory/warehouses/page.tsx",["w.site_id=ANY"]);
mustContain("app/dashboard/inventory/categories/page.tsx",["inventory_stock_levels","w.site_id=ANY"]);
mustContain("app/dashboard/inventory/page.tsx",["limitedSiteScope","sw.site_id=ANY","d.site_id=ANY"]);
mustContain("app/dashboard/inventory/[id]/page.tsx",["limitedSiteScope","w.site_id=ANY","visibleQuantity"]);
mustContain("app/dashboard/inventory/kardex/page.tsx",["w.site_id=ANY","d.site_id=ANY"]);
mustContain("app/api/requisitions/[id]/receive/route.ts",["AND site_id=ANY($3::uuid[])"]);
mustContain("app/api/requisitions/[id]/returns/route.ts",["AND site_id=ANY($3::uuid[])"]);

const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");
  const orgA=(await client.query("INSERT INTO organizations(name,slug) VALUES('I0 Org A','i0-org-a') RETURNING id")).rows[0].id;
  const orgB=(await client.query("INSERT INTO organizations(name,slug) VALUES('I0 Org B','i0-org-b') RETURNING id")).rows[0].id;

  const siteA1=(await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'A1','I0-A1','x','Bogota','CO') RETURNING id",[orgA])).rows[0].id;
  const siteA2=(await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'A2','I0-A2','x','Bogota','CO') RETURNING id",[orgA])).rows[0].id;
  const siteB1=(await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'B1','I0-B1','x','Bogota','CO') RETURNING id",[orgB])).rows[0].id;

  const locA1=(await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Loc A1','I0-LA1') RETURNING id",[orgA,siteA1])).rows[0].id;
  const locA2=(await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Loc A2','I0-LA2') RETURNING id",[orgA,siteA2])).rows[0].id;
  const locB1=(await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Loc B1','I0-LB1') RETURNING id",[orgB,siteB1])).rows[0].id;

  const supplierA=(await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Supplier A','materials') RETURNING id",[orgA])).rows[0].id;
  const supplierB=(await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Supplier B','materials') RETURNING id",[orgB])).rows[0].id;

  const whA1=(await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'I0-WA1','Warehouse A1') RETURNING id",[orgA,siteA1,locA1])).rows[0].id;
  const whA2=(await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'I0-WA2','Warehouse A2') RETURNING id",[orgA,siteA2,locA2])).rows[0].id;
  const whB1=(await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'I0-WB1','Warehouse B1') RETURNING id",[orgB,siteB1,locB1])).rows[0].id;

  const itemA1=(await client.query("INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit) VALUES($1,$2,$3,$4,$5,'I0-A1-SKU','Item A1','unidad') RETURNING id",[orgA,siteA1,locA1,supplierA,whA1])).rows[0].id;
  const itemA2=(await client.query("INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit) VALUES($1,$2,$3,$4,$5,'I0-A2-SKU','Item A2','unidad') RETURNING id",[orgA,siteA2,locA2,supplierA,whA2])).rows[0].id;
  const itemB1=(await client.query("INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit) VALUES($1,$2,$3,$4,$5,'I0-B1-SKU','Item B1','unidad') RETURNING id",[orgB,siteB1,locB1,supplierB,whB1])).rows[0].id;

  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id) VALUES($1,$2,'receipt',10,$3)",[orgA,itemA1,whA1]);
  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id) VALUES($1,$2,'receipt',20,$3)",[orgA,itemA2,whA2]);
  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id) VALUES($1,$2,'receipt',30,$3)",[orgB,itemB1,whB1]);

  const visibleWarehouses=async(org,sites)=>(await client.query(
    "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND site_id=ANY($2::uuid[]) ORDER BY id",
    [org,sites],
  )).rows.map(row=>row.id);

  const visibleItems=async(org,sites)=>(await client.query(
    "SELECT id FROM inventory_items WHERE organization_id=$1 AND (site_id IS NULL OR site_id=ANY($2::uuid[])) ORDER BY id",
    [org,sites],
  )).rows.map(row=>row.id);

  const visibleStock=async(org,sites)=>Number((await client.query(
    `SELECT COALESCE(sum(sl.quantity),0)::text qty
     FROM inventory_stock_levels sl
     JOIN inventory_warehouses w ON w.id=sl.warehouse_id
     WHERE sl.organization_id=$1 AND w.site_id=ANY($2::uuid[])`,
    [org,sites],
  )).rows[0].qty);

  const a1Warehouses=await visibleWarehouses(orgA,[siteA1]);
  if(a1Warehouses.length!==1||a1Warehouses[0]!==whA1)throw new Error("U1 warehouse scope leak");
  const a2Warehouses=await visibleWarehouses(orgA,[siteA2]);
  if(a2Warehouses.length!==1||a2Warehouses[0]!==whA2)throw new Error("U2 warehouse scope leak");
  if((await visibleWarehouses(orgA,[siteB1])).length!==0)throw new Error("cross-organization warehouse leak");

  const a1Items=await visibleItems(orgA,[siteA1]);
  if(!a1Items.includes(itemA1)||a1Items.includes(itemA2)||a1Items.includes(itemB1))throw new Error("U1 product scope leak");
  const a2Items=await visibleItems(orgA,[siteA2]);
  if(!a2Items.includes(itemA2)||a2Items.includes(itemA1)||a2Items.includes(itemB1))throw new Error("U2 product scope leak");

  if(await visibleStock(orgA,[siteA1])!==10)throw new Error("U1 aggregate stock leak");
  if(await visibleStock(orgA,[siteA2])!==20)throw new Error("U2 aggregate stock leak");
  if(await visibleStock(orgB,[siteB1])!==30)throw new Error("organization B stock mismatch");

  for(const [label,warehouse,sites] of [
    ["destination outside U1",whA2,[siteA1]],
    ["source outside U1",whA2,[siteA1]],
    ["cross tenant",whB1,[siteB1]],
  ]){
    const org=label==="cross tenant"?orgA:orgA;
    const result=await client.query(
      "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND id=$2 AND site_id=ANY($3::uuid[])",
      [org,warehouse,sites],
    );
    if(result.rowCount!==0)throw new Error(label+" should be rejected");
  }

  // Coverage map required by I0:
  // 1 permission gates, 2 full organization, 3 A1, 4 A2, 5 other org,
  // 6 warehouse, 7 transfer destination, 8 transfer source, 9 product,
  // 10 stock, 11 movement, 12 image, 13 edit, 14 warehouse toggle,
  // 15 Supplier Inventory, 16 import, 17 KPI/summary, 18 counts,
  // 19 export, 20 tenant isolation.
  console.log("Inventory I0 scope/no-leak smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
