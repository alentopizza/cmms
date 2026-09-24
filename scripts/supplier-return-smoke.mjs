import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");

  const org=await client.query("INSERT INTO organizations(name,slug) VALUES('CI Supplier Return','ci-supplier-return') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-SR-SITE','CI','Bogotá','CO') RETURNING id",[organizationId]);
  const siteId=site.rows[0].id;
  const location=await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Bodega','CI-SR-LOC') RETURNING id",[organizationId,siteId]);
  const locationId=location.rows[0].id;
  const supplier=await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Proveedor Devolución CI','materials') RETURNING id",[organizationId]);
  const supplierId=supplier.rows[0].id;
  const warehouse=await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-SR-W','Bodega Devolución') RETURNING id",[organizationId,siteId,locationId]);
  const warehouseId=warehouse.rows[0].id;
  const inventory=await client.query(
    "INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,storage_location) VALUES($1,$2,$3,$4,$5,'CI-SR-001','Insumo devolución','unidad',0,0,100,100,'Bodega Devolución') RETURNING id",
    [organizationId,siteId,locationId,supplierId,warehouseId],
  );
  const itemId=inventory.rows[0].id;
  const requisition=await client.query(
    "INSERT INTO supplier_requisitions(organization_id,supplier_id,status) VALUES($1,$2,'fulfilled') RETURNING id",
    [organizationId,supplierId],
  );
  const requisitionId=requisition.rows[0].id;
  const reqItem=await client.query(
    `INSERT INTO supplier_requisition_items(
       requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,quantity_requested,quantity_received,unit_cost_estimated
     ) VALUES($1,$2,$3,$4,$5,'CI-SR-001','Insumo devolución','unidad',10,10,100) RETURNING id`,
    [requisitionId,organizationId,itemId,siteId,locationId],
  );
  const requisitionItemId=reqItem.rows[0].id;

  const receipt=await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,requisition_id,requisition_item_id
     ) VALUES($1,$2,'receipt',10,100,$3,'CI-REC-1',$4,$5) RETURNING id`,
    [organizationId,itemId,warehouseId,requisitionId,requisitionItemId],
  );
  const receiptId=receipt.rows[0].id;

  let stock=await client.query("SELECT quantity::text FROM inventory_items WHERE id=$1",[itemId]);
  if(Number(stock.rows[0].quantity)!==10)throw new Error("Receipt stock setup failed");

  const header=await client.query(
    `INSERT INTO supplier_returns(
       organization_id,supplier_id,requisition_id,reason_code,expected_resolution,reason_detail,document_number
     ) VALUES($1,$2,$3,'damaged','replacement','Empaque golpeado','CI-DEV-1') RETURNING id,number::text`,
    [organizationId,supplierId,requisitionId],
  );
  const returnId=header.rows[0].id;

  const line=await client.query(
    `INSERT INTO supplier_return_items(
       return_id,organization_id,requisition_item_id,receipt_transaction_id,inventory_item_id,warehouse_id,quantity,unit_cost
     ) VALUES($1,$2,$3,$4,$5,$6,4,100) RETURNING id`,
    [returnId,organizationId,requisitionItemId,receiptId,itemId,warehouseId],
  );
  const returnItemId=line.rows[0].id;

  await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,
       requisition_id,requisition_item_id,supplier_return_id,supplier_return_item_id,source_transaction_id
     ) VALUES($1,$2,'supplier_return',4,100,$3,'CI-DEV-1',$4,$5,$6,$7,$8)`,
    [organizationId,itemId,warehouseId,requisitionId,requisitionItemId,returnId,returnItemId,receiptId],
  );

  const check=await client.query(
    `SELECT i.quantity::text stock,ri.quantity_received::text gross_received,
            COALESCE(sum(sri.quantity),0)::text returned,
            count(t.id) FILTER(WHERE t.type='supplier_return')::int return_movements,
            bool_and(t.source_transaction_id=$1) FILTER(WHERE t.type='supplier_return') source_ok
     FROM inventory_items i
     JOIN supplier_requisition_items ri ON ri.inventory_item_id=i.id
     LEFT JOIN supplier_return_items sri ON sri.requisition_item_id=ri.id
     LEFT JOIN inventory_transactions t ON t.supplier_return_item_id=sri.id
     WHERE i.id=$2
     GROUP BY i.quantity,ri.quantity_received`,
    [receiptId,itemId],
  );
  const row=check.rows[0];
  if(Number(row.stock)!==6||Number(row.gross_received)!==10||Number(row.returned)!==4||row.return_movements!==1||row.source_ok!==true){
    throw new Error("Supplier return traceability mismatch: "+JSON.stringify(row));
  }

  const returned=await client.query(
    "SELECT COALESCE(sum(quantity),0)::float8 quantity FROM supplier_return_items WHERE receipt_transaction_id=$1",
    [receiptId],
  );
  const returnable=10-Number(returned.rows[0].quantity||0);
  if(returnable!==6)throw new Error("Returnable receipt balance mismatch: "+returnable);

  let rejected=false;
  try{
    await client.query("SAVEPOINT invalid_return");
    await client.query(
      `INSERT INTO supplier_return_items(
         return_id,organization_id,requisition_item_id,receipt_transaction_id,inventory_item_id,warehouse_id,quantity,unit_cost
       ) VALUES($1,$2,$3,$4,$5,$6,11,100)`,
      [returnId,organizationId,requisitionItemId,receiptId,itemId,warehouseId],
    );
    await client.query("RELEASE SAVEPOINT invalid_return");
  }catch{
    rejected=true;
    await client.query("ROLLBACK TO SAVEPOINT invalid_return");
  }
  if(!rejected)throw new Error("Supplier return source quantity validation did not reject invalid line");

  // Existing return-to-stock semantics remain inbound and distinct from supplier_return.
  await client.query(
    "INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,warehouse_id) VALUES($1,$2,'return',1,$3)",
    [organizationId,itemId,warehouseId],
  );
  stock=await client.query("SELECT quantity::text FROM inventory_items WHERE id=$1",[itemId]);
  if(Number(stock.rows[0].quantity)!==7)throw new Error("Legacy return-to-stock semantic changed unexpectedly");

  console.log("Supplier return smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
