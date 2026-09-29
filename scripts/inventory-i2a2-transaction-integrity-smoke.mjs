import fs from "node:fs";
import {createHash,randomUUID} from "node:crypto";
import pg from "pg";

const {Client}=pg;
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");

const sources={
  helper:fs.readFileSync("lib/inventory-manual-movement.ts","utf8"),
  general:fs.readFileSync("app/api/inventory/movements/route.ts","utf8"),
  item:fs.readFileSync("app/api/inventory/[id]/movement/route.ts","utf8"),
  kardex:fs.readFileSync("app/dashboard/inventory/kardex/page.tsx","utf8"),
  detail:fs.readFileSync("app/dashboard/inventory/[id]/page.tsx","utf8"),
  migration:fs.readFileSync("db/migrations/047_inventory_transaction_integrity.sql","utf8"),
  ci:fs.readFileSync(".github/workflows/ci.yml","utf8"),
};

for(const marker of [
  "manual_idempotency_key",
  "manual_payload_hash",
  "pg_advisory_xact_lock",
  'createHash("sha256")',
  "status:\"created\"|\"replayed\"|\"conflict\"",
])if(!sources.helper.includes(marker))throw new Error("manual movement helper missing "+marker);

for(const sourceName of ["general","item"]){
  for(const marker of ["readManualMovementIdempotencyKey","insertManualInventoryMovement","result.status===\"conflict\""]){
    if(!sources[sourceName].includes(marker))throw new Error(sourceName+" route missing "+marker);
  }
}
for(const sourceName of ["kardex","detail"]){
  if(!sources[sourceName].includes('name="idempotency_key"'))throw new Error(sourceName+" form missing idempotency key");
  if(!sources[sourceName].includes("randomUUID()"))throw new Error(sourceName+" form must generate a logical-operation UUID");
}
for(const marker of [
  "inventory_transactions_manual_idempotency_idx",
  "inventory_transactions_item_org_fkey",
  "inventory_transactions_warehouse_org_fkey",
  "inventory_transactions_destination_warehouse_org_fkey",
  "inventory_stock_levels_item_org_fkey",
  "inventory_stock_levels_warehouse_org_fkey",
  "NOT VALID",
])if(!sources.migration.includes(marker))throw new Error("integrity migration missing "+marker);
if(sources.migration.includes("CREATE OR REPLACE FUNCTION cmms_apply_inventory_transaction")){
  throw new Error("I2-A2.1 must not replace the stock trigger function");
}
for(const script of [
  "inventory-i2a2-transaction-integrity-smoke.mjs",
  "inventory-kardex-smoke.mjs",
  "inventory-scope-smoke.mjs",
  "inventory-server-pagination-smoke.mjs",
  "unified-inventory-import-smoke.mjs",
  "requisition-receipt-smoke.mjs",
  "requisition-approval-smoke.mjs",
  "supplier-return-smoke.mjs",
  "procurement-reconciliation-smoke.mjs",
  "maintenance-server-pagination-smoke.mjs",
  "work-orders-server-pagination-smoke.mjs",
  "assets-server-pagination-smoke.mjs",
  "phase10-final-smoke.mjs",
  "npm run build",
])if(!sources.ci.includes(script))throw new Error("CI regression missing "+script);

function hashPayload(p){
  return createHash("sha256").update(JSON.stringify({
    organization_id:p.organizationId,item_id:p.itemId,type:p.type,quantity:p.quantity,unit_cost:p.unitCost,
    warehouse_id:p.warehouseId,destination_warehouse_id:p.destinationWarehouseId,document_number:p.documentNumber,
    movement_at:p.movementAt,created_by:p.createdBy,lot_number:p.lotNumber,expires_at:p.expiresAt,cost_center:p.costCenter,notes:p.notes,
  })).digest("hex");
}

async function submitManual(client,p,key){
  const payloadHash=hashPayload(p);
  await client.query("BEGIN");
  try{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[p.organizationId+"|manual_inventory|"+key]);
    const existing=await client.query(
      "SELECT id,manual_payload_hash FROM inventory_transactions WHERE organization_id=$1 AND manual_idempotency_key=$2::uuid LIMIT 1",
      [p.organizationId,key],
    );
    if(existing.rowCount){
      await client.query("COMMIT");
      return existing.rows[0].manual_payload_hash===payloadHash?"replayed":"conflict";
    }
    await client.query(
      `INSERT INTO inventory_transactions(
         organization_id,item_id,type,quantity,unit_cost,warehouse_id,destination_warehouse_id,document_number,movement_at,
         created_by,lot_number,expires_at,cost_center,notes,manual_idempotency_key,manual_payload_hash
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz,now()),$10,$11,$12,$13,$14,$15::uuid,$16)`,
      [p.organizationId,p.itemId,p.type,p.quantity,p.unitCost,p.warehouseId,p.destinationWarehouseId,p.documentNumber,p.movementAt,
       p.createdBy,p.lotNumber,p.expiresAt,p.costCenter,p.notes,key,payloadHash],
    );
    await client.query("COMMIT");
    return "created";
  }catch(error){
    await client.query("ROLLBACK").catch(()=>{});
    throw error;
  }
}

async function expectRejected(client,sql,params,label){
  try{
    await client.query(sql,params);
  }catch{
    return;
  }
  throw new Error(label+" was not rejected");
}

const setup=new Client({connectionString:process.env.DATABASE_URL});
const c1=new Client({connectionString:process.env.DATABASE_URL});
const c2=new Client({connectionString:process.env.DATABASE_URL});
await Promise.all([setup.connect(),c1.connect(),c2.connect()]);
const orgIds=[];
try{
  const suffix=Date.now().toString(36);
  const orgA=(await setup.query("INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id",["I2A2 Org A","i2a2-a-"+suffix])).rows[0].id;
  const orgB=(await setup.query("INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id",["I2A2 Org B","i2a2-b-"+suffix])).rows[0].id;
  orgIds.push(orgA,orgB);
  const siteA1=(await setup.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'A1',$2,'CI','Bogotá','CO') RETURNING id",[orgA,"I2A2-A1-"+suffix])).rows[0].id;
  const siteA2=(await setup.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'A2',$2,'CI','Bogotá','CO') RETURNING id",[orgA,"I2A2-A2-"+suffix])).rows[0].id;
  const siteB1=(await setup.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'B1',$2,'CI','Bogotá','CO') RETURNING id",[orgB,"I2A2-B1-"+suffix])).rows[0].id;
  const locA1=(await setup.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Loc A1',$3) RETURNING id",[orgA,siteA1,"I2A2-LA1-"+suffix])).rows[0].id;
  const locA2=(await setup.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Loc A2',$3) RETURNING id",[orgA,siteA2,"I2A2-LA2-"+suffix])).rows[0].id;
  const locB1=(await setup.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Loc B1',$3) RETURNING id",[orgB,siteB1,"I2A2-LB1-"+suffix])).rows[0].id;
  const whA1=(await setup.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,'Warehouse A1') RETURNING id",[orgA,siteA1,locA1,"I2A2-WA1-"+suffix])).rows[0].id;
  const whA2=(await setup.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,'Warehouse A2') RETURNING id",[orgA,siteA2,locA2,"I2A2-WA2-"+suffix])).rows[0].id;
  const whB1=(await setup.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,'Warehouse B1') RETURNING id",[orgB,siteB1,locB1,"I2A2-WB1-"+suffix])).rows[0].id;
  const itemA=(await setup.query("INSERT INTO inventory_items(organization_id,site_id,location_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost) VALUES($1,$2,$3,$4,$5,'Item A','unidad',0,0,1000,10) RETURNING id",[orgA,siteA1,locA1,whA1,"I2A2-A-"+suffix])).rows[0].id;
  const itemB=(await setup.query("INSERT INTO inventory_items(organization_id,site_id,location_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost) VALUES($1,$2,$3,$4,$5,'Item B','unidad',0,0,1000,10) RETURNING id",[orgB,siteB1,locB1,whB1,"I2A2-B-"+suffix])).rows[0].id;

  await setup.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,document_number) VALUES($1,$2,'receipt',20,$3,'I2A2-SEED')",[orgA,itemA,whA1]);

  const base={organizationId:orgA,itemId:itemA,type:"receipt",quantity:3,unitCost:10,warehouseId:whA1,destinationWarehouseId:null,documentNumber:"I2A2-DOUBLE",movementAt:null,createdBy:null,lotNumber:null,expiresAt:null,costCenter:null,notes:"double post"};
  const doubleKey=randomUUID();
  if(await submitManual(c1,base,doubleKey)!=="created")throw new Error("first double POST was not created");
  if(await submitManual(c1,base,doubleKey)!=="replayed")throw new Error("sequential retry was not replayed");
  const doubleCount=await setup.query("SELECT count(*)::int count FROM inventory_transactions WHERE organization_id=$1 AND manual_idempotency_key=$2",[orgA,doubleKey]);
  if(doubleCount.rows[0].count!==1)throw new Error("double POST created more than one transaction");

  const concurrentKey=randomUUID();
  const concurrentPayload={...base,quantity:4,documentNumber:"I2A2-CONCURRENT"};
  const concurrent=await Promise.all([submitManual(c1,concurrentPayload,concurrentKey),submitManual(c2,concurrentPayload,concurrentKey)]);
  if(concurrent.filter(v=>v==="created").length!==1||concurrent.filter(v=>v==="replayed").length!==1){
    throw new Error("concurrent duplicate did not resolve to one create and one replay: "+JSON.stringify(concurrent));
  }
  const concurrentCount=await setup.query("SELECT count(*)::int count FROM inventory_transactions WHERE organization_id=$1 AND manual_idempotency_key=$2",[orgA,concurrentKey]);
  if(concurrentCount.rows[0].count!==1)throw new Error("concurrent duplicate created more than one transaction");

  const conflictKey=randomUUID();
  const conflictPayload={...base,quantity:2,documentNumber:"I2A2-CONFLICT"};
  if(await submitManual(c1,conflictPayload,conflictKey)!=="created")throw new Error("conflict fixture not created");
  const beforeConflict=Number((await setup.query("SELECT quantity FROM inventory_items WHERE id=$1",[itemA])).rows[0].quantity);
  if(await submitManual(c1,{...conflictPayload,quantity:7},conflictKey)!=="conflict")throw new Error("same key + different payload was not rejected");
  const afterConflict=Number((await setup.query("SELECT quantity FROM inventory_items WHERE id=$1",[itemA])).rows[0].quantity);
  if(afterConflict!==beforeConflict)throw new Error("payload conflict changed stock");

  const transferKey=randomUUID();
  const transferPayload={...base,type:"transfer",quantity:5,warehouseId:whA1,destinationWarehouseId:whA2,documentNumber:"I2A2-TRANSFER"};
  if(await submitManual(c1,transferPayload,transferKey)!=="created")throw new Error("valid same-org transfer failed");
  const transferStock=await setup.query(
    "SELECT warehouse_id,quantity::float8 quantity FROM inventory_stock_levels WHERE item_id=$1 AND warehouse_id=ANY($2::uuid[]) ORDER BY warehouse_id",
    [itemA,[whA1,whA2]],
  );
  const byWh=new Map(transferStock.rows.map(r=>[r.warehouse_id,Number(r.quantity)]));
  if(byWh.get(whA2)!==5)throw new Error("valid same-org cross-site transfer did not credit destination");

  const txSql="INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,destination_warehouse_id) VALUES($1,$2,$3,$4,$5,$6)";
  await expectRejected(setup,txSql,[orgA,itemB,"receipt",1,whA1,null],"cross-organization item");
  await expectRejected(setup,txSql,[orgA,itemA,"receipt",1,whB1,null],"cross-organization source warehouse");

  const beforeInvalid=await setup.query(
    "SELECT warehouse_id,quantity::float8 quantity FROM inventory_stock_levels WHERE item_id=$1 AND warehouse_id=ANY($2::uuid[]) ORDER BY warehouse_id",
    [itemA,[whA1,whA2]],
  );
  await expectRejected(setup,txSql,[orgA,itemA,"transfer",1,whA1,whB1],"cross-organization destination warehouse");
  const afterInvalid=await setup.query(
    "SELECT warehouse_id,quantity::float8 quantity FROM inventory_stock_levels WHERE item_id=$1 AND warehouse_id=ANY($2::uuid[]) ORDER BY warehouse_id",
    [itemA,[whA1,whA2]],
  );
  if(JSON.stringify(beforeInvalid.rows)!==JSON.stringify(afterInvalid.rows))throw new Error("invalid transfer changed stock partially");

  await expectRejected(setup,txSql,[orgA,itemA,"issue",999999,whA1,null],"negative stock movement");

  const importMovementId="I2A2-IMPORT-"+suffix;
  await setup.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,source_movement_id) VALUES($1,$2,'receipt',1,$3,$4)",[orgA,itemA,whA1,importMovementId]);
  await expectRejected(
    setup,
    "INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,source_movement_id) VALUES($1,$2,'receipt',1,$3,$4)",
    [orgA,itemA,whA1,importMovementId],
    "duplicate import source_movement_id",
  );

  const manualRows=await setup.query("SELECT count(*)::int count FROM inventory_transactions WHERE organization_id=$1 AND manual_idempotency_key IS NOT NULL",[orgA]);
  if(manualRows.rows[0].count!==4)throw new Error("unexpected manual logical movement count: "+manualRows.rows[0].count);

  console.log("Inventory I2-A2.1 transaction integrity checks passed.");
  console.log("Double POST, concurrent replay, payload conflict, organization invariants and same-org cross-site transfer passed.");
}finally{
  if(orgIds.length)await setup.query("DELETE FROM organizations WHERE id=ANY($1::uuid[])",[orgIds]).catch(()=>{});
  await Promise.all([setup.end(),c1.end(),c2.end()]);
}
