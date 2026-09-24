import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");
  const org=await client.query("INSERT INTO organizations(name,slug) VALUES('CI Requisition Receipt','ci-requisition-receipt') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-R-SITE','CI','Bogotá','CO') RETURNING id",[organizationId]);
  const siteId=site.rows[0].id;
  const location=await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Bodega','CI-R-LOC') RETURNING id",[organizationId,siteId]);
  const locationId=location.rows[0].id;
  const supplier=await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Proveedor Recepción CI','materials') RETURNING id",[organizationId]);
  const supplierId=supplier.rows[0].id;
  const warehouse=await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-R-W','Bodega Recepción') RETURNING id",[organizationId,siteId,locationId]);
  const warehouseId=warehouse.rows[0].id;
  const item=await client.query(
    "INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,storage_location) VALUES($1,$2,$3,$4,$5,'CI-R-001','Insumo recepción','unidad',0,1,20,50,'Bodega Recepción') RETURNING id",
    [organizationId,siteId,locationId,supplierId,warehouseId],
  );
  const itemId=item.rows[0].id;
  const requisition=await client.query(
    "INSERT INTO supplier_requisitions(organization_id,supplier_id,status) VALUES($1,$2,'approved') RETURNING id",
    [organizationId,supplierId],
  );
  const requisitionId=requisition.rows[0].id;
  const reqItem=await client.query(
    `INSERT INTO supplier_requisition_items(
       requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,quantity_requested,unit_cost_estimated
     ) VALUES($1,$2,$3,$4,$5,'CI-R-001','Insumo recepción','unidad',10,50) RETURNING id`,
    [requisitionId,organizationId,itemId,siteId,locationId],
  );
  const requisitionItemId=reqItem.rows[0].id;

  await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,requisition_id,requisition_item_id
     ) VALUES($1,$2,'receipt',4,55,$3,'CI-REM-1',$4,$5)`,
    [organizationId,itemId,warehouseId,requisitionId,requisitionItemId],
  );
  await client.query("UPDATE supplier_requisition_items SET quantity_received=quantity_received+4 WHERE id=$1",[requisitionItemId]);
  await client.query("UPDATE supplier_requisitions SET status='partial',updated_at=now() WHERE id=$1",[requisitionId]);

  let check=await client.query(
    `SELECT i.quantity::text stock,ri.quantity_received::text received,r.status,t.requisition_id::text linked
     FROM inventory_items i
     JOIN supplier_requisition_items ri ON ri.inventory_item_id=i.id
     JOIN supplier_requisitions r ON r.id=ri.requisition_id
     JOIN inventory_transactions t ON t.requisition_item_id=ri.id
     WHERE i.id=$1 ORDER BY t.created_at DESC LIMIT 1`,
    [itemId],
  );
  let row=check.rows[0];
  if(Number(row.stock)!==4||Number(row.received)!==4||row.status!=="partial"||row.linked!==requisitionId){
    throw new Error("Partial requisition receipt mismatch: "+JSON.stringify(row));
  }

  await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,requisition_id,requisition_item_id
     ) VALUES($1,$2,'receipt',6,52,$3,'CI-REM-2',$4,$5)`,
    [organizationId,itemId,warehouseId,requisitionId,requisitionItemId],
  );
  await client.query("UPDATE supplier_requisition_items SET quantity_received=quantity_received+6 WHERE id=$1",[requisitionItemId]);
  await client.query("UPDATE supplier_requisitions SET status='fulfilled',fulfilled_at=now(),updated_at=now() WHERE id=$1",[requisitionId]);

  check=await client.query(
    `SELECT i.quantity::text stock,ri.quantity_received::text received,r.status,r.fulfilled_at IS NOT NULL fulfilled,
            count(t.id)::int receipt_count
     FROM inventory_items i
     JOIN supplier_requisition_items ri ON ri.inventory_item_id=i.id
     JOIN supplier_requisitions r ON r.id=ri.requisition_id
     LEFT JOIN inventory_transactions t ON t.requisition_item_id=ri.id AND t.requisition_id=r.id AND t.type='receipt'
     WHERE i.id=$1 GROUP BY i.quantity,ri.quantity_received,r.status,r.fulfilled_at`,
    [itemId],
  );
  row=check.rows[0];
  if(Number(row.stock)!==10||Number(row.received)!==10||row.status!=="fulfilled"||!row.fulfilled||row.receipt_count!==2){
    throw new Error("Completed requisition receipt mismatch: "+JSON.stringify(row));
  }

  console.log("Requisition receipt smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
