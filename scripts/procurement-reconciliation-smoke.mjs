import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

async function expectRejected(label,fn){
  let rejected=false;
  await client.query("SAVEPOINT "+label);
  try{
    await fn();
    await client.query("RELEASE SAVEPOINT "+label);
  }catch{
    rejected=true;
    await client.query("ROLLBACK TO SAVEPOINT "+label);
  }
  if(!rejected)throw new Error(label+" should have been rejected");
}

try{
  await client.query("BEGIN");

  const org=await client.query("INSERT INTO organizations(name,slug) VALUES('CI Procurement Reconciliation','ci-procurement-reconciliation') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-PR-SITE','CI','Bogotá','CO') RETURNING id",[organizationId]);
  const siteId=site.rows[0].id;
  const location=await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Bodega','CI-PR-LOC') RETURNING id",[organizationId,siteId]);
  const locationId=location.rows[0].id;
  const supplier=await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Proveedor Conciliación CI','materials') RETURNING id",[organizationId]);
  const supplierId=supplier.rows[0].id;
  const warehouse=await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-PR-W','Bodega Conciliación') RETURNING id",[organizationId,siteId,locationId]);
  const warehouseId=warehouse.rows[0].id;
  const inventory=await client.query(
    "INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,storage_location) VALUES($1,$2,$3,$4,$5,'CI-PR-001','Insumo conciliación','unidad',0,0,100,100,'Bodega Conciliación') RETURNING id",
    [organizationId,siteId,locationId,supplierId,warehouseId],
  );
  const itemId=inventory.rows[0].id;
  const requisition=await client.query("INSERT INTO supplier_requisitions(organization_id,supplier_id,status) VALUES($1,$2,'fulfilled') RETURNING id",[organizationId,supplierId]);
  const requisitionId=requisition.rows[0].id;
  const reqItem=await client.query(
    `INSERT INTO supplier_requisition_items(
       requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,quantity_requested,quantity_received,unit_cost_estimated
     ) VALUES($1,$2,$3,$4,$5,'CI-PR-001','Insumo conciliación','unidad',10,10,100) RETURNING id`,
    [requisitionId,organizationId,itemId,siteId,locationId],
  );
  const requisitionItemId=reqItem.rows[0].id;
  const receipt=await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,requisition_id,requisition_item_id
     ) VALUES($1,$2,'receipt',10,100,$3,'CI-REM-001',$4,$5) RETURNING id`,
    [organizationId,itemId,warehouseId,requisitionId,requisitionItemId],
  );
  const receiptId=receipt.rows[0].id;

  const po=await client.query(
    `INSERT INTO procurement_documents(
       organization_id,supplier_id,requisition_id,document_type,document_number,currency_code,subtotal,tax_total,total,
       file_data,file_mime_type,file_name,file_size_bytes
     ) VALUES($1,$2,$3,'purchase_order','CI-OC-001','COP',1000,0,1000,$4,'application/pdf','oc-ci.pdf',$5)
     RETURNING id`,
    [organizationId,supplierId,requisitionId,Buffer.from("po"),2],
  );
  const poId=po.rows[0].id;
  await client.query(
    `INSERT INTO procurement_document_lines(
       document_id,organization_id,requisition_item_id,sku,description,unit,quantity,unit_cost,line_total
     ) VALUES($1,$2,$3,'CI-PR-001','Insumo conciliación','unidad',10,100,1000)`,
    [poId,organizationId,requisitionItemId],
  );
  const poCheck=await client.query(
    `SELECT
       (SELECT sum(l.quantity) FROM procurement_document_lines l WHERE l.document_id=$1)::float8 document_qty,
       (SELECT sum(ri.quantity_requested) FROM supplier_requisition_items ri WHERE ri.requisition_id=$2)::float8 expected_qty,
       (SELECT sum(l.line_total) FROM procurement_document_lines l WHERE l.document_id=$1)::float8 document_value,
       (SELECT sum(ri.quantity_requested*ri.unit_cost_estimated) FROM supplier_requisition_items ri WHERE ri.requisition_id=$2)::float8 expected_value`,
    [poId,requisitionId],
  );
  const poRow=poCheck.rows[0];
  if(poRow.document_qty!==10||poRow.expected_qty!==10||poRow.document_value!==1000||poRow.expected_value!==1000){
    throw new Error("Purchase order reconciliation inputs mismatch: "+JSON.stringify(poRow));
  }

  const invoice=await client.query(
    `INSERT INTO procurement_documents(
       organization_id,supplier_id,requisition_id,document_type,document_number,currency_code,subtotal,tax_total,total,
       file_data,file_mime_type,file_name,file_size_bytes,review_status,review_notes,reviewed_at
     ) VALUES($1,$2,$3,'invoice','CI-FAC-001','COP',1000,0,1000,$4,'application/pdf','factura-ci.pdf',$5,'verified','stale review',now())
     RETURNING id`,
    [organizationId,supplierId,requisitionId,Buffer.from("invoice"),7],
  );
  const invoiceId=invoice.rows[0].id;
  await client.query(
    `INSERT INTO procurement_document_lines(
       document_id,organization_id,requisition_item_id,sku,description,unit,quantity,unit_cost,line_total
     ) VALUES($1,$2,$3,'CI-PR-001','Insumo conciliación','unidad',10,100,1000)`,
    [invoiceId,organizationId,requisitionItemId],
  );

  let invoiceReview=await client.query("SELECT review_status,review_notes,reviewed_at FROM procurement_documents WHERE id=$1",[invoiceId]);
  if(invoiceReview.rows[0].review_status!=="verified")throw new Error("Invoice review setup failed");

  await client.query(
    "INSERT INTO procurement_document_receipts(document_id,receipt_transaction_id,organization_id) VALUES($1,$2,$3)",
    [invoiceId,receiptId,organizationId],
  );
  invoiceReview=await client.query("SELECT review_status,review_notes,reviewed_at FROM procurement_documents WHERE id=$1",[invoiceId]);
  if(invoiceReview.rows[0].review_status!=="pending"||invoiceReview.rows[0].review_notes!==null||invoiceReview.rows[0].reviewed_at!==null){
    throw new Error("Evidence link did not reopen document review: "+JSON.stringify(invoiceReview.rows[0]));
  }

  const invoiceCheck=await client.query(
    `SELECT
       (SELECT sum(l.quantity) FROM procurement_document_lines l WHERE l.document_id=$1)::float8 document_qty,
       (SELECT sum(abs(t.quantity)) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id WHERE pr.document_id=$1)::float8 receipt_qty,
       (SELECT sum(l.line_total) FROM procurement_document_lines l WHERE l.document_id=$1)::float8 document_value,
       (SELECT sum(abs(t.quantity)*t.unit_cost) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id WHERE pr.document_id=$1)::float8 receipt_value`,
    [invoiceId],
  );
  const invoiceRow=invoiceCheck.rows[0];
  if(invoiceRow.document_qty!==10||invoiceRow.receipt_qty!==10||invoiceRow.document_value!==1000||invoiceRow.receipt_value!==1000){
    throw new Error("Invoice reconciliation inputs mismatch: "+JSON.stringify(invoiceRow));
  }

  const diffInvoice=await client.query(
    `INSERT INTO procurement_documents(
       organization_id,supplier_id,requisition_id,document_type,document_number,currency_code,subtotal,tax_total,total,
       file_data,file_mime_type,file_name,file_size_bytes
     ) VALUES($1,$2,$3,'invoice','CI-FAC-002','COP',900,0,900,$4,'application/pdf','factura-dif-ci.pdf',$5)
     RETURNING id`,
    [organizationId,supplierId,requisitionId,Buffer.from("diff"),4],
  );
  const diffInvoiceId=diffInvoice.rows[0].id;
  await client.query(
    `INSERT INTO procurement_document_lines(
       document_id,organization_id,requisition_item_id,sku,description,unit,quantity,unit_cost,line_total
     ) VALUES($1,$2,$3,'CI-PR-001','Insumo conciliación','unidad',9,100,900)`,
    [diffInvoiceId,organizationId,requisitionItemId],
  );
  await client.query("INSERT INTO procurement_document_receipts(document_id,receipt_transaction_id,organization_id) VALUES($1,$2,$3)",[diffInvoiceId,receiptId,organizationId]);
  const difference=await client.query(
    `SELECT
       (SELECT sum(l.quantity) FROM procurement_document_lines l WHERE l.document_id=$1)
       -(SELECT sum(abs(t.quantity)) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id WHERE pr.document_id=$1) qty_diff,
       (SELECT sum(l.line_total) FROM procurement_document_lines l WHERE l.document_id=$1)
       -(SELECT sum(abs(t.quantity)*t.unit_cost) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id WHERE pr.document_id=$1) value_diff`,
    [diffInvoiceId],
  );
  if(Number(difference.rows[0].qty_diff)!==-1||Number(difference.rows[0].value_diff)!==-100){
    throw new Error("Difference inputs mismatch: "+JSON.stringify(difference.rows[0]));
  }

  const pendingInvoice=await client.query(
    `INSERT INTO procurement_documents(
       organization_id,supplier_id,requisition_id,document_type,document_number,currency_code,subtotal,tax_total,total,
       file_data,file_mime_type,file_name,file_size_bytes
     ) VALUES($1,$2,$3,'invoice','CI-FAC-003','COP',1000,0,1000,$4,'application/pdf','factura-pend-ci.pdf',$5)
     RETURNING id`,
    [organizationId,supplierId,requisitionId,Buffer.from("pending"),7],
  );
  const pendingInvoiceId=pendingInvoice.rows[0].id;
  await client.query(
    `INSERT INTO procurement_document_lines(
       document_id,organization_id,requisition_item_id,sku,description,unit,quantity,unit_cost,line_total
     ) VALUES($1,$2,$3,'CI-PR-001','Insumo conciliación','unidad',10,100,1000)`,
    [pendingInvoiceId,organizationId,requisitionItemId],
  );
  const evidenceCount=await client.query("SELECT count(*)::int count FROM procurement_document_receipts WHERE document_id=$1",[pendingInvoiceId]);
  if(evidenceCount.rows[0].count!==0)throw new Error("Pending invoice unexpectedly has receipt evidence");

  const ret=await client.query(
    `INSERT INTO supplier_returns(organization_id,supplier_id,requisition_id,reason_code,expected_resolution,reason_detail,document_number)
     VALUES($1,$2,$3,'damaged','credit_note','Novedad conciliación','CI-DEV-001') RETURNING id`,
    [organizationId,supplierId,requisitionId],
  );
  const returnId=ret.rows[0].id;
  const retLine=await client.query(
    `INSERT INTO supplier_return_items(
       return_id,organization_id,requisition_item_id,receipt_transaction_id,inventory_item_id,warehouse_id,quantity,unit_cost
     ) VALUES($1,$2,$3,$4,$5,$6,2,100) RETURNING id`,
    [returnId,organizationId,requisitionItemId,receiptId,itemId,warehouseId],
  );
  await client.query(
    `INSERT INTO inventory_transactions(
       organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,requisition_id,requisition_item_id,
       supplier_return_id,supplier_return_item_id,source_transaction_id
     ) VALUES($1,$2,'supplier_return',2,100,$3,'CI-DEV-001',$4,$5,$6,$7,$8)`,
    [organizationId,itemId,warehouseId,requisitionId,requisitionItemId,returnId,retLine.rows[0].id,receiptId],
  );

  const credit=await client.query(
    `INSERT INTO procurement_documents(
       organization_id,supplier_id,requisition_id,document_type,document_number,currency_code,subtotal,tax_total,total,
       file_data,file_mime_type,file_name,file_size_bytes
     ) VALUES($1,$2,$3,'credit_note','CI-NC-001','COP',200,0,200,$4,'application/pdf','nota-credito-ci.pdf',$5)
     RETURNING id`,
    [organizationId,supplierId,requisitionId,Buffer.from("credit"),6],
  );
  const creditId=credit.rows[0].id;
  await client.query(
    `INSERT INTO procurement_document_lines(
       document_id,organization_id,requisition_item_id,sku,description,unit,quantity,unit_cost,line_total
     ) VALUES($1,$2,$3,'CI-PR-001','Insumo conciliación','unidad',2,100,200)`,
    [creditId,organizationId,requisitionItemId],
  );
  await client.query("INSERT INTO procurement_document_returns(document_id,supplier_return_id,organization_id) VALUES($1,$2,$3)",[creditId,returnId,organizationId]);
  const creditCheck=await client.query(
    `SELECT
       (SELECT sum(l.quantity) FROM procurement_document_lines l WHERE l.document_id=$1)::float8 document_qty,
       (SELECT sum(sri.quantity) FROM procurement_document_returns pdr JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id WHERE pdr.document_id=$1)::float8 return_qty,
       (SELECT sum(l.line_total) FROM procurement_document_lines l WHERE l.document_id=$1)::float8 document_value,
       (SELECT sum(sri.quantity*sri.unit_cost) FROM procurement_document_returns pdr JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id WHERE pdr.document_id=$1)::float8 return_value`,
    [creditId],
  );
  if(creditCheck.rows[0].document_qty!==2||creditCheck.rows[0].return_qty!==2||creditCheck.rows[0].document_value!==200||creditCheck.rows[0].return_value!==200){
    throw new Error("Credit-note reconciliation inputs mismatch: "+JSON.stringify(creditCheck.rows[0]));
  }

  await expectRejected("invalid_po_receipt",()=>client.query(
    "INSERT INTO procurement_document_receipts(document_id,receipt_transaction_id,organization_id) VALUES($1,$2,$3)",
    [poId,receiptId,organizationId],
  ));
  await expectRejected("invalid_invoice_return",()=>client.query(
    "INSERT INTO procurement_document_returns(document_id,supplier_return_id,organization_id) VALUES($1,$2,$3)",
    [invoiceId,returnId,organizationId],
  ));
  await expectRejected("immutable_line",()=>client.query(
    "UPDATE procurement_document_lines SET quantity=8 WHERE document_id=$1",
    [invoiceId],
  ));
  await expectRejected("immutable_document_core",()=>client.query(
    "UPDATE procurement_documents SET document_number='MUTATED' WHERE id=$1",
    [invoiceId],
  ));

  await client.query(
    "UPDATE procurement_documents SET review_status='verified',review_notes='CI verified',reviewed_at=now() WHERE id=$1",
    [invoiceId],
  );
  const review=await client.query("SELECT review_status,review_notes FROM procurement_documents WHERE id=$1",[invoiceId]);
  if(review.rows[0].review_status!=="verified"||review.rows[0].review_notes!=="CI verified"){
    throw new Error("Allowed review update failed");
  }

  console.log("Procurement reconciliation smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
