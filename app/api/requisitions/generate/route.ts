import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProcurementPolicy={
  organization_id:string;
  approval_mode:"none"|"all"|"threshold";
  approval_threshold:string;
  approver_scope:"admin_only"|"admin_manager";
  allow_requester_self_approval:boolean;
};

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write"))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const ids=[...new Set(form.getAll("item_id").map(value=>String(value)).filter(value=>UUID.test(value)))].slice(0,100);
  const neededBy=String(form.get("needed_by")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const returnTo=String(form.get("return_to")||"/dashboard/requisitions");
  const safeReturn=returnTo.startsWith("/dashboard/")?returnTo:"/dashboard/requisitions";

  if(!ids.length)return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=items",request.url),303);
  if(neededBy&&!/^\d{4}-\d{2}-\d{2}$/.test(neededBy))return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=date",request.url),303);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const items=await client.query<{
      id:string;organization_id:string;site_id:string|null;location_id:string|null;supplier_id:string;supplier_name:string;
      sku:string;name:string;unit:string;unit_cost:string;
    }>(
      `SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,s.name supplier_name,
              i.sku,i.name,i.unit,i.unit_cost::text
       FROM inventory_items i
       JOIN suppliers s ON s.id=i.supplier_id AND s.organization_id=i.organization_id
       WHERE i.id=ANY($1::uuid[]) AND i.active=true AND s.active=true AND s.supplier_type IN ('materials','both')`,
      [ids],
    );

    if(items.rowCount!==ids.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=relation",request.url),303);
    }

    for(const item of items.rows){
      if(session.platformRole==="user"){
        if(session.organizationId!==item.organization_id || (item.site_id&&!canAccessSite(session,item.site_id))){
          await client.query("ROLLBACK");
          return new NextResponse("Forbidden",{status:403});
        }
      }
    }

    const groups=new Map<string,typeof items.rows>();
    for(const item of items.rows){
      const key=item.organization_id+":"+item.supplier_id;
      const group=groups.get(key)||[];
      group.push(item);
      groups.set(key,group);
    }

    const organizationIds=[...new Set(items.rows.map(item=>item.organization_id))];
    const policyRows=await client.query<ProcurementPolicy>(
      `SELECT o.id organization_id,
              COALESCE(p.approval_mode,'none') approval_mode,
              COALESCE(p.approval_threshold,0)::text approval_threshold,
              COALESCE(p.approver_scope,'admin_only') approver_scope,
              COALESCE(p.allow_requester_self_approval,false) allow_requester_self_approval
       FROM organizations o
       LEFT JOIN organization_procurement_policies p ON p.organization_id=o.id
       WHERE o.id=ANY($1::uuid[])`,
      [organizationIds],
    );
    const policyByOrganization=new Map(policyRows.rows.map(policy=>[policy.organization_id,policy]));

    const createdIds:string[]=[];
    for(const group of groups.values()){
      const first=group[0];
      const prepared=group.map(item=>{
        const quantity=Number(form.get("qty_"+item.id)||0);
        if(!Number.isFinite(quantity)||quantity<=0)return null;
        return {item,quantity,unitCost:Number(item.unit_cost||0)};
      });
      if(prepared.some(row=>!row)){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=quantity",request.url),303);
      }
      const validPrepared=prepared as {item:(typeof group)[number];quantity:number;unitCost:number}[];
      const estimatedTotal=validPrepared.reduce((sum,row)=>sum+(row.quantity*row.unitCost),0);
      const policy=policyByOrganization.get(first.organization_id)||{
        organization_id:first.organization_id,
        approval_mode:"none" as const,
        approval_threshold:"0",
        approver_scope:"admin_only" as const,
        allow_requester_self_approval:false,
      };
      const threshold=Number(policy.approval_threshold||0);
      const approvalRequired=policy.approval_mode==="all"
        ||(policy.approval_mode==="threshold"&&estimatedTotal>=threshold);

      // ── Approval-policy snapshot ───────────────────────────────────────────
      // The requisition keeps the policy that applied at creation even if Company settings change later.
      const req=await client.query<{id:string}>(
        `INSERT INTO supplier_requisitions(
           organization_id,supplier_id,requested_by,needed_by,notes,status,sent_at,
           approval_required,approval_state,approval_policy_mode,approval_threshold,
           approval_approver_scope,approval_self_allowed,approval_requested_at
         ) VALUES(
           $1,$2,$3,$4,$5,$6,CASE WHEN $7 THEN now() ELSE NULL END,
           $7,$8,$9,$10,$11,$12,CASE WHEN $7 THEN now() ELSE NULL END
         ) RETURNING id`,
        [
          first.organization_id,first.supplier_id,session.userId||null,neededBy||null,notes||null,
          approvalRequired?"sent":"draft",approvalRequired,approvalRequired?"pending":"not_required",
          policy.approval_mode,threshold,policy.approver_scope,policy.allow_requester_self_approval,
        ],
      );
      const requisitionId=req.rows[0].id;
      createdIds.push(requisitionId);

      for(const row of validPrepared){
        await client.query(
          `INSERT INTO supplier_requisition_items(
             requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,
             quantity_requested,unit_cost_estimated
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            requisitionId,row.item.organization_id,row.item.id,row.item.site_id,row.item.location_id,
            row.item.sku,row.item.name,row.item.unit,row.quantity,row.unitCost,
          ],
        );
      }

      if(approvalRequired){
        const actorLabel=session.fullName||session.email||"Sistema";
        await client.query(
          `INSERT INTO supplier_requisition_approval_events(
             organization_id,requisition_id,actor_user_id,actor_label,action,from_state,to_state,notes,metadata
           ) VALUES($1,$2,$3,$4,'requested','not_required','pending',NULL,$5::jsonb)`,
          [
            first.organization_id,requisitionId,session.userId||null,actorLabel,
            JSON.stringify({
              policy_mode:policy.approval_mode,
              threshold,
              estimated_total:estimatedTotal,
              approver_scope:policy.approver_scope,
              self_approval:policy.allow_requester_self_approval,
            }),
          ],
        );
        await client.query(
          `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
           VALUES($1,$2,'requisition.approval_requested','supplier_requisition',$3,$4::jsonb)`,
          [
            first.organization_id,session.userId||null,requisitionId,
            JSON.stringify({estimated_total:estimatedTotal,policy_mode:policy.approval_mode,threshold}),
          ],
        );
      }
    }

    await client.query("COMMIT");
    const join=safeReturn.includes("?")?"&":"?";
    return NextResponse.redirect(publicUrl(safeReturn+join+"requisition_created="+createdIds.length,request.url),303);
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
