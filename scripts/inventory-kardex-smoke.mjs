import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");
  const org=await client.query("INSERT INTO organizations(name,slug) VALUES('CI Kardex','ci-kardex-smoke') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-SITE','CI','Bogotá','CO') RETURNING id",[organizationId]);
  const siteId=site.rows[0].id;
  const location=await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Almacén','CI-LOC') RETURNING id",[organizationId,siteId]);
  const locationId=location.rows[0].id;
  const supplier=await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Proveedor CI','materials') RETURNING id",[organizationId]);
  const supplierId=supplier.rows[0].id;
  const w1=await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-A','Bodega A') RETURNING id",[organizationId,siteId,locationId]);
  const w2=await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-B','Bodega B') RETURNING id",[organizationId,siteId,locationId]);
  const item=await client.query(
    "INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,storage_location) VALUES($1,$2,$3,$4,$5,'CI-001','Repuesto CI','unidad',0,2,20,100,'Bodega A') RETURNING id",
    [organizationId,siteId,locationId,supplierId,w1.rows[0].id],
  );
  const itemId=item.rows[0].id;

  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number) VALUES($1,$2,'receipt',10,100,$3,'CI-REC')",[organizationId,itemId,w1.rows[0].id]);
  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,document_number) VALUES($1,$2,'issue',3,$3,'CI-ISS')",[organizationId,itemId,w1.rows[0].id]);
  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,destination_warehouse_id,document_number) VALUES($1,$2,'transfer',2,$3,$4,'CI-TRF')",[organizationId,itemId,w1.rows[0].id,w2.rows[0].id]);
  await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id,document_number,lot_number,cost_center) VALUES($1,$2,'adjustment',-1,$3,'CI-ADJ','LOTE-CI','Mantenimiento')",[organizationId,itemId,w2.rows[0].id]);

  const totals=await client.query(
    "SELECT i.quantity::text total,COALESCE(sum(CASE WHEN s.warehouse_id=$2 THEN s.quantity ELSE 0 END),0)::text a,COALESCE(sum(CASE WHEN s.warehouse_id=$3 THEN s.quantity ELSE 0 END),0)::text b FROM inventory_items i LEFT JOIN inventory_stock_levels s ON s.item_id=i.id WHERE i.id=$1 GROUP BY i.quantity",
    [itemId,w1.rows[0].id,w2.rows[0].id],
  );
  const row=totals.rows[0];
  if(Number(row.total)!==6||Number(row.a)!==5||Number(row.b)!==1){
    throw new Error("Kardex stock mismatch: "+JSON.stringify(row));
  }

  let rejected=false;
  await client.query("SAVEPOINT inventory_negative");
  try{
    await client.query("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id) VALUES($1,$2,'issue',999,$3)",[organizationId,itemId,w1.rows[0].id]);
  }catch{
    rejected=true;
    await client.query("ROLLBACK TO SAVEPOINT inventory_negative");
  }
  if(!rejected)throw new Error("Negative stock movement was not rejected");

  console.log("Inventory Kardex smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
