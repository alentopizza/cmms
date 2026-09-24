import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");

  const org=await client.query("INSERT INTO organizations(name,slug) VALUES('CI Unified Import','ci-unified-import') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-UI-SITE','CI','Bogotá','CO') RETURNING id",[organizationId]);
  const siteId=site.rows[0].id;
  const location=await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Bodega','CI-UI-LOC') RETURNING id",[organizationId,siteId]);
  const locationId=location.rows[0].id;

  const supplier=await client.query(
    "INSERT INTO suppliers(organization_id,name,tax_id,supplier_type) VALUES($1,'Proveedor Import CI','900123456-7','materials') RETURNING id,code",
    [organizationId],
  );
  const supplierId=supplier.rows[0].id;
  const supplierCode=supplier.rows[0].code;
  if(!supplierCode||!String(supplierCode).startsWith("PROV-"))throw new Error("Supplier import code was not generated");

  const second=await client.query(
    "INSERT INTO suppliers(organization_id,name,tax_id,supplier_type) VALUES($1,'Proveedor Import CI 2','900123456-8','materials') RETURNING code",
    [organizationId],
  );
  if(second.rows[0].code===supplierCode)throw new Error("Supplier import codes must be unique");

  const warehouse=await client.query(
    "INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-UI-W','Bodega Import') RETURNING id",
    [organizationId,siteId,locationId],
  );
  const warehouseId=warehouse.rows[0].id;

  const item=await client.query(
    `INSERT INTO inventory_items(
       organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,
       storage_location,subcategory,brand,model,barcode,reference_price,tax_rate
     ) VALUES($1,$2,$3,$4,$5,'CI-UI-001','Producto import','unidad',0,1,20,100,'Bodega Import','Sub','Marca','Modelo','770000001',125,19)
     RETURNING id,subcategory,brand,model,barcode,reference_price::text,tax_rate::text`,
    [organizationId,siteId,locationId,supplierId,warehouseId],
  );
  const itemId=item.rows[0].id;
  const itemRow=item.rows[0];
  if(itemRow.subcategory!=="Sub"||itemRow.brand!=="Marca"||itemRow.model!=="Modelo"||itemRow.barcode!=="770000001"||Number(itemRow.reference_price)!==125||Number(itemRow.tax_rate)!==19){
    throw new Error("Imported inventory master metadata mismatch: "+JSON.stringify(itemRow));
  }

  await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,source_movement_id,document_number
     ) VALUES($1,$2,'receipt',5,100,$3,'MOV-CI-001','CI-DOC')`,
    [organizationId,itemId,warehouseId],
  );

  let duplicateRejected=false;
  await client.query("SAVEPOINT duplicate_movement");
  try{
    await client.query(
      `INSERT INTO inventory_transactions(
         organization_id,item_id,type,quantity,unit_cost,warehouse_id,source_movement_id,document_number
       ) VALUES($1,$2,'receipt',1,100,$3,'MOV-CI-001','CI-DOC-2')`,
      [organizationId,itemId,warehouseId],
    );
  }catch{
    duplicateRejected=true;
    await client.query("ROLLBACK TO SAVEPOINT duplicate_movement");
  }
  if(!duplicateRejected)throw new Error("Duplicate source MOVIMIENTO_ID was not rejected");

  const batch=await client.query(
    `INSERT INTO bulk_import_batches(
       organization_id,entity,file_name,file_hash,status,total_rows,imported_rows,omitted_rows,error_rows,warning_rows,
       origin,context_supplier_id,commit_scope,committed_at
     ) VALUES($1,'inventory','ci.xlsx','ci-hash','committed',12,8,4,0,2,'supplier',$2,'context_only',now())
     RETURNING import_number::text,origin,commit_scope,context_supplier_id,omitted_rows`,
    [organizationId,supplierId],
  );
  const row=batch.rows[0];
  if(!Number(row.import_number)||row.origin!=="supplier"||row.commit_scope!=="context_only"||row.context_supplier_id!==supplierId||row.omitted_rows!==4){
    throw new Error("Bulk import traceability metadata mismatch: "+JSON.stringify(row));
  }

  console.log("Unified inventory import smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
