import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");
  const org=await client.query("INSERT INTO organizations(name,slug) VALUES('CI Supplier Analytics','ci-supplier-analytics') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await client.query("INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-SA-SITE','CI','Bogotá','CO') RETURNING id",[organizationId]);
  const siteId=site.rows[0].id;
  const location=await client.query("INSERT INTO locations(organization_id,site_id,name,code) VALUES($1,$2,'Bodega','CI-SA-LOC') RETURNING id",[organizationId,siteId]);
  const locationId=location.rows[0].id;
  const supplier=await client.query("INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Proveedor Analítica CI','materials') RETURNING id",[organizationId]);
  const supplierId=supplier.rows[0].id;
  const warehouse=await client.query("INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,'CI-SA-W','Bodega Analítica') RETURNING id",[organizationId,siteId,locationId]);
  const warehouseId=warehouse.rows[0].id;

  const makeItem=async(sku)=>{
    const item=await client.query(
      "INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,warehouse_id,sku,name,unit,quantity,min_quantity,max_quantity,unit_cost,storage_location) VALUES($1,$2,$3,$4,$5,$6,$6,'unidad',0,0,100,100,'Bodega Analítica') RETURNING id",
      [organizationId,siteId,locationId,supplierId,warehouseId,sku],
    );
    return item.rows[0].id;
  };

  const item1=await makeItem("CI-SA-001");
  const item2=await makeItem("CI-SA-002");

  const req1=await client.query(
    `INSERT INTO supplier_requisitions(organization_id,supplier_id,status,sent_at,needed_by)
     VALUES($1,$2,'fulfilled',now()-interval '4 days',current_date) RETURNING id`,
    [organizationId,supplierId],
  );
  const req1Id=req1.rows[0].id;
  const reqItem1=await client.query(
    `INSERT INTO supplier_requisition_items(
      requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,quantity_requested,quantity_received,unit_cost_estimated
    ) VALUES($1,$2,$3,$4,$5,'CI-SA-001','CI-SA-001','unidad',10,10,100) RETURNING id`,
    [req1Id,organizationId,item1,siteId,locationId],
  );
  const reqItem1Id=reqItem1.rows[0].id;
  await client.query(
    `INSERT INTO inventory_transactions(
      organization_id,item_id,type,quantity,unit_cost,warehouse_id,movement_at,requisition_id,requisition_item_id
    ) VALUES
      ($1,$2,'receipt',4,110,$3,now()-interval '2 days',$4,$5),
      ($1,$2,'receipt',6,90,$3,now()-interval '1 day',$4,$5)`,
    [organizationId,item1,warehouseId,req1Id,reqItem1Id],
  );

  const req2=await client.query(
    `INSERT INTO supplier_requisitions(organization_id,supplier_id,status,sent_at,needed_by)
     VALUES($1,$2,'partial',now()-interval '8 days',current_date+interval '2 days') RETURNING id`,
    [organizationId,supplierId],
  );
  const req2Id=req2.rows[0].id;
  const reqItem2=await client.query(
    `INSERT INTO supplier_requisition_items(
      requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,quantity_requested,quantity_received,unit_cost_estimated
    ) VALUES($1,$2,$3,$4,$5,'CI-SA-002','CI-SA-002','unidad',10,5,100) RETURNING id`,
    [req2Id,organizationId,item2,siteId,locationId],
  );
  const reqItem2Id=reqItem2.rows[0].id;
  await client.query(
    `INSERT INTO inventory_transactions(
      organization_id,item_id,type,quantity,unit_cost,warehouse_id,movement_at,requisition_id,requisition_item_id
    ) VALUES($1,$2,'receipt',5,120,$3,now()-interval '5 days',$4,$5)`,
    [organizationId,item2,warehouseId,req2Id,reqItem2Id],
  );

  const check=await client.query(
    `WITH item_totals AS (
       SELECT ri.requisition_id,sum(ri.quantity_requested)::float8 requested_quantity,sum(ri.quantity_received)::float8 received_quantity
       FROM supplier_requisition_items ri JOIN supplier_requisitions r ON r.id=ri.requisition_id
       WHERE r.supplier_id=$1 GROUP BY ri.requisition_id
     ), receipt_totals AS (
       SELECT t.requisition_id,min(t.movement_at) first_receipt_at,max(t.movement_at) last_receipt_at,
              sum(abs(t.quantity)*ri.unit_cost_estimated)::float8 estimated_received_value,
              sum(abs(t.quantity)*COALESCE(t.unit_cost,ri.unit_cost_estimated))::float8 actual_received_value
       FROM inventory_transactions t
       JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id
       WHERE t.type='receipt' AND t.requisition_id IS NOT NULL AND ri.requisition_id=t.requisition_id
       GROUP BY t.requisition_id
     ), perf AS (
       SELECT r.id,r.needed_by,it.requested_quantity,it.received_quantity,rt.first_receipt_at,rt.last_receipt_at,
              rt.estimated_received_value,rt.actual_received_value,
              GREATEST(EXTRACT(EPOCH FROM (rt.first_receipt_at-COALESCE(r.sent_at,r.created_at)))/86400.0,0)::float8 lead_time_days,
              (it.received_quantity+0.000001>=it.requested_quantity) completed,
              CASE WHEN it.received_quantity+0.000001>=it.requested_quantity AND r.needed_by IS NOT NULL
                   THEN rt.last_receipt_at::date<=r.needed_by ELSE NULL END completed_on_time
       FROM supplier_requisitions r JOIN item_totals it ON it.requisition_id=r.id JOIN receipt_totals rt ON rt.requisition_id=r.id
       WHERE r.supplier_id=$1
     )
     SELECT count(*)::int received_requisitions,
            count(*) FILTER(WHERE completed)::int completed_requisitions,
            count(*) FILTER(WHERE NOT completed)::int partial_requisitions,
            (100.0*sum(received_quantity)/sum(requested_quantity))::float8 fulfillment_pct,
            avg(lead_time_days)::float8 avg_lead_days,
            (100.0*count(*) FILTER(WHERE completed_on_time=true)/NULLIF(count(*) FILTER(WHERE completed_on_time IS NOT NULL),0))::float8 on_time_pct,
            ((sum(actual_received_value)-sum(estimated_received_value))/sum(estimated_received_value)*100.0)::float8 price_variance_pct
     FROM perf`,
    [supplierId],
  );

  const row=check.rows[0];
  const close=(a,b,t=.05)=>Math.abs(Number(a)-b)<=t;
  if(row.received_requisitions!==2||row.completed_requisitions!==1||row.partial_requisitions!==1
    ||!close(row.fulfillment_pct,75)||!close(row.avg_lead_days,2.5)
    ||!close(row.on_time_pct,100)||!close(row.price_variance_pct,5.3333,.1)){
    throw new Error("Supplier analytics mismatch: "+JSON.stringify(row));
  }

  console.log("Supplier commercial analytics smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
