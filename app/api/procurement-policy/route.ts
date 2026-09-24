import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"settings.view"))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const mode=String(form.get("approval_mode")||"none");
  const approverScope=String(form.get("approver_scope")||"admin_only");
  const thresholdRaw=String(form.get("approval_threshold")||"0").trim();
  const threshold=Number(thresholdRaw||0);
  const selfApproval=form.get("allow_requester_self_approval")==="on";

  if(!["none","all","threshold"].includes(mode)
    ||!["admin_only","admin_manager"].includes(approverScope)
    ||!Number.isFinite(threshold)||threshold<0
    ||(mode==="threshold"&&threshold<=0)){
    return NextResponse.redirect(publicUrl("/dashboard/settings?procurement_error=invalid",request.url),303);
  }

  const explicitOrganization=String(form.get("organization_id")||"");
  const organizationId=session.platformRole==="user"?session.organizationId:(UUID.test(explicitOrganization)?explicitOrganization:null);
  if(!organizationId)return new NextResponse("Empresa requerida",{status:400});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const organization=await client.query<{id:string}>("SELECT id FROM organizations WHERE id=$1",[organizationId]);
    if(!organization.rowCount){
      await client.query("ROLLBACK");
      return new NextResponse("Empresa no encontrada",{status:404});
    }
    if(session.platformRole==="user"&&session.organizationId!==organizationId){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    await client.query(
      `INSERT INTO organization_procurement_policies(
         organization_id,approval_mode,approval_threshold,approver_scope,allow_requester_self_approval,updated_by,updated_at
       ) VALUES($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT(organization_id) DO UPDATE SET
         approval_mode=EXCLUDED.approval_mode,
         approval_threshold=EXCLUDED.approval_threshold,
         approver_scope=EXCLUDED.approver_scope,
         allow_requester_self_approval=EXCLUDED.allow_requester_self_approval,
         updated_by=EXCLUDED.updated_by,
         updated_at=now()`,
      [organizationId,mode,mode==="threshold"?threshold:0,approverScope,selfApproval,session.userId||null],
    );
    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,'procurement.approval_policy_updated','organization',$1::text,$3::jsonb)`,
      [
        organizationId,session.userId||null,
        JSON.stringify({
          approval_mode:mode,
          approval_threshold:mode==="threshold"?threshold:0,
          approver_scope:approverScope,
          allow_requester_self_approval:selfApproval,
        }),
      ],
    );
    await client.query("COMMIT");
    return NextResponse.redirect(publicUrl("/dashboard/settings?procurement_saved=1",request.url),303);
  }catch(error){
    await client.query("ROLLBACK");
    console.error("procurement policy update failed",error);
    return NextResponse.redirect(publicUrl("/dashboard/settings?procurement_error=save",request.url),303);
  }finally{
    client.release();
  }
}
