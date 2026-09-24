import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");

  const org=await client.query(
    "INSERT INTO organizations(name,slug) VALUES('CI Procurement Approval','ci-procurement-approval') RETURNING id",
  );
  const organizationId=org.rows[0].id;
  const supplier=await client.query(
    "INSERT INTO suppliers(organization_id,name,supplier_type) VALUES($1,'Proveedor aprobación CI','materials') RETURNING id",
    [organizationId],
  );
  const supplierId=supplier.rows[0].id;

  await client.query(
    `INSERT INTO organization_procurement_policies(
       organization_id,approval_mode,approval_threshold,approver_scope,allow_requester_self_approval
     ) VALUES($1,'threshold',1000,'admin_manager',false)`,
    [organizationId],
  );

  const requisition=await client.query(
    `INSERT INTO supplier_requisitions(
       organization_id,supplier_id,status,approval_required,approval_state,approval_policy_mode,
       approval_threshold,approval_approver_scope,approval_self_allowed,approval_requested_at,sent_at
     ) VALUES($1,$2,'sent',true,'pending','threshold',1000,'admin_manager',false,now(),now())
     RETURNING id`,
    [organizationId,supplierId],
  );
  const requisitionId=requisition.rows[0].id;

  await client.query(
    `INSERT INTO supplier_requisition_approval_events(
       organization_id,requisition_id,actor_label,action,from_state,to_state,metadata
     ) VALUES($1,$2,'CI requester','requested','not_required','pending',$3::jsonb)`,
    [organizationId,requisitionId,JSON.stringify({estimated_total:1500,threshold:1000})],
  );

  let state=await client.query(
    `SELECT r.approval_required,r.approval_state,r.approval_policy_mode,r.approval_threshold::text,
            p.approval_mode,p.approver_scope,p.allow_requester_self_approval
     FROM supplier_requisitions r
     JOIN organization_procurement_policies p ON p.organization_id=r.organization_id
     WHERE r.id=$1`,
    [requisitionId],
  );
  let row=state.rows[0];
  if(!row.approval_required||row.approval_state!=="pending"||row.approval_policy_mode!=="threshold"
    ||Number(row.approval_threshold)!==1000||row.approval_mode!=="threshold"
    ||row.approver_scope!=="admin_manager"||row.allow_requester_self_approval!==false){
    throw new Error("Procurement approval snapshot mismatch: "+JSON.stringify(row));
  }

  await client.query(
    `UPDATE supplier_requisitions
     SET approval_state='approved',status='approved',approval_decided_at=now(),approved_at=now()
     WHERE id=$1`,
    [requisitionId],
  );
  await client.query(
    `INSERT INTO supplier_requisition_approval_events(
       organization_id,requisition_id,actor_label,action,from_state,to_state
     ) VALUES($1,$2,'CI approver','approved','pending','approved')`,
    [organizationId,requisitionId],
  );

  await client.query(
    `UPDATE supplier_requisitions
     SET approval_state='pending',status='sent',approval_requested_at=now(),approval_decided_at=NULL
     WHERE id=$1`,
    [requisitionId],
  );
  await client.query(
    `INSERT INTO supplier_requisition_approval_events(
       organization_id,requisition_id,actor_label,action,from_state,to_state,notes
     ) VALUES($1,$2,'CI editor','reopened','approved','pending','Cambio posterior a la aprobación')`,
    [organizationId,requisitionId],
  );

  const history=await client.query(
    `SELECT r.approval_state,r.status,count(e.id)::int event_count,
            array_agg(e.action ORDER BY e.created_at,e.id) actions
     FROM supplier_requisitions r
     JOIN supplier_requisition_approval_events e ON e.requisition_id=r.id
     WHERE r.id=$1
     GROUP BY r.approval_state,r.status`,
    [requisitionId],
  );
  row=history.rows[0];
  if(row.approval_state!=="pending"||row.status!=="sent"||row.event_count!==3
    ||!row.actions.includes("requested")||!row.actions.includes("approved")||!row.actions.includes("reopened")){
    throw new Error("Procurement approval audit mismatch: "+JSON.stringify(row));
  }

  console.log("Procurement approval smoke checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
