import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { attendanceOrganizationId } from "@/lib/attendance-context";

// ── Supervisor review: temporary, one-time authorization ────────────────────

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  const body=await request.json().catch(()=>null) as {
    organizationId?:unknown; decision?:unknown; note?:unknown; minutes?:unknown;
  }|null;
  const organizationId=attendanceOrganizationId(session,body?.organizationId);
  const decision=body?.decision==="approve"?"approve":body?.decision==="reject"?"reject":null;
  const note=typeof body?.note==="string"?body.note.trim().slice(0,1000):"";
  const requestedMinutes=Number(body?.minutes);
  const minutes=Number.isFinite(requestedMinutes)?Math.max(15,Math.min(120,Math.round(requestedMinutes))):30;

  if(!organizationId||!decision)return NextResponse.json({message:"Empresa o decisión inválida."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const item=await client.query<{site_id:string;status:string}>(
      `SELECT site_id,status FROM attendance_contingency_requests
       WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
      [id,organizationId],
    );
    const row=item.rows[0];
    if(!row){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Solicitud no encontrada."},{status:404});
    }
    if(row.status!=="pending"){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Esta solicitud ya fue revisada."},{status:409});
    }
    if(!canAccessSite(session,row.site_id)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    if(decision==="approve"){
      await client.query(
        `UPDATE attendance_contingency_requests SET
           status='approved',reviewed_by=$1,reviewed_at=now(),review_note=$2,
           approved_until=now()+($3::text||' minutes')::interval,updated_at=now()
         WHERE id=$4`,
        [session.userId,note||null,minutes,id],
      );
    }else{
      await client.query(
        `UPDATE attendance_contingency_requests SET
           status='rejected',reviewed_by=$1,reviewed_at=now(),review_note=$2,
           approved_until=NULL,updated_at=now()
         WHERE id=$3`,
        [session.userId,note||null,id],
      );
    }

    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,'attendance_contingency_request',$4,$5::jsonb)`,
      [organizationId,session.userId,`attendance_contingency_${decision}`,id,JSON.stringify({
        decision,
        minutes:decision==="approve"?minutes:null,
        note:note||null,
        actor_platform_role:session.platformRole,
        actor_email:session.email,
      })],
    );

    await client.query("COMMIT");
    return NextResponse.json({status:decision==="approve"?"approved":"rejected",minutes:decision==="approve"?minutes:null});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
