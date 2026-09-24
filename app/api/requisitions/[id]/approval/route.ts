import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Req={
  organization_id:string;
  requested_by:string|null;
  status:string;
  approval_required:boolean;
  approval_state:string;
  approval_approver_scope:"admin_only"|"admin_manager";
  approval_self_allowed:boolean;
};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.approve"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const form=await request.formData();
  const decision=String(form.get("decision")||"");
  const notes=String(form.get("notes")||"").trim();
  if(!["approve","reject"].includes(decision)){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval_decision",request.url),303);
  }
  if(decision==="reject"&&!notes){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval_notes",request.url),303);
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    // ── Server-authoritative approval boundary ───────────────────────────────
    // UI visibility is advisory. Tenant, role, requester separation and Site scope are revalidated here.
    const result=await client.query<Req>(
      `SELECT organization_id,requested_by,status,approval_required,approval_state,approval_approver_scope,approval_self_allowed
       FROM supplier_requisitions
       WHERE id=$1
       FOR UPDATE`,
      [id],
    );
    if(!result.rowCount){
      await client.query("ROLLBACK");
      return new NextResponse("Requisición no encontrada",{status:404});
    }
    const req=result.rows[0];
    if(session.platformRole==="user"&&session.organizationId!==req.organization_id){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }
    if(!req.approval_required||req.approval_state!=="pending"||["fulfilled","closed","cancelled"].includes(req.status)){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval_locked",request.url),303);
    }

    if(session.platformRole==="user"){
      const roleAllowed=req.approval_approver_scope==="admin_only"
        ?session.role==="admin"
        :session.role==="admin"||session.role==="manager";
      if(!roleAllowed){
        await client.query("ROLLBACK");
        return new NextResponse("Forbidden",{status:403});
      }
      if(!req.approval_self_allowed&&req.requested_by&&session.userId===req.requested_by){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval_self",request.url),303);
      }
      if(!session.accessAllSites){
        const sites=await client.query<{site_id:string}>(
          "SELECT DISTINCT site_id FROM supplier_requisition_items WHERE requisition_id=$1 AND site_id IS NOT NULL",
          [id],
        );
        if(sites.rows.some(row=>!session.siteIds.includes(row.site_id))){
          await client.query("ROLLBACK");
          return new NextResponse("Forbidden",{status:403});
        }
      }
    }

    const received=await client.query<{received:boolean}>(
      "SELECT EXISTS(SELECT 1 FROM supplier_requisition_items WHERE requisition_id=$1 AND quantity_received>0) received",
      [id],
    );
    const hasReceived=Boolean(received.rows[0]?.received);
    const nextState=decision==="approve"?"approved":"rejected";
    const nextStatus=decision==="approve"
      ?(hasReceived?"partial":"approved")
      :(hasReceived?"partial":"rejected");

    await client.query(
      `UPDATE supplier_requisitions SET
         approval_state=$1,
         approval_decided_at=now(),
         approval_decided_by=$2,
         approval_decision_notes=$3,
         approved_at=CASE WHEN $1='approved' THEN now() ELSE approved_at END,
         status=$4,
         updated_at=now()
       WHERE id=$5`,
      [nextState,session.userId||null,notes||null,nextStatus,id],
    );

    const actorLabel=session.fullName||session.email||"Sistema";
    await client.query(
      `INSERT INTO supplier_requisition_approval_events(
         organization_id,requisition_id,actor_user_id,actor_label,action,from_state,to_state,notes,metadata
       ) VALUES($1,$2,$3,$4,$5,'pending',$6,$7,$8::jsonb)`,
      [
        req.organization_id,id,session.userId||null,actorLabel,
        decision==="approve"?"approved":"rejected",nextState,notes||null,
        JSON.stringify({status_before:req.status,status_after:nextStatus,approver_scope:req.approval_approver_scope}),
      ],
    );
    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,'supplier_requisition',$4,$5::jsonb)`,
      [
        req.organization_id,session.userId||null,
        decision==="approve"?"requisition.approved":"requisition.rejected",
        id,JSON.stringify({notes:notes||null,status_before:req.status,status_after:nextStatus}),
      ],
    );

    await client.query("COMMIT");
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?approval="+nextState,request.url),303);
  }catch(error){
    await client.query("ROLLBACK");
    console.error("requisition approval failed",error);
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval",request.url),303);
  }finally{
    client.release();
  }
}
