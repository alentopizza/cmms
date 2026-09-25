import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { attendanceOrganizationId } from "@/lib/attendance-context";
import { pool } from "@/lib/db";

// ── One-time human identity decision ────────────────────────────────────────
// Approval is the only point where a self-service request becomes an active
// biometric profile. The pending encrypted template/preview are then removed.
export async function POST(
  request:Request,
  context:{params:Promise<{id:string}>},
){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await context.params;
  const body=await request.json().catch(()=>null) as {
    organizationId?:unknown;decision?:unknown;note?:unknown;
  }|null;
  const organizationId=attendanceOrganizationId(session,body?.organizationId);
  const decision=body?.decision==="approve"?"approve":body?.decision==="reject"?"reject":null;
  const note=typeof body?.note==="string"?body.note.trim().slice(0,1000):"";
  if(!organizationId||!decision)return NextResponse.json({message:"Empresa o decisión inválida."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const result=await client.query<{
      id:string;organization_id:string;user_id:string;site_id:string;policy_version_id:string;
      encrypted_embedding:Buffer|null;has_preview:boolean;consented_at:string;status:string;full_name:string;
    }>(
      `SELECT request.id::text,request.organization_id::text,request.user_id::text,request.site_id::text,
              request.policy_version_id::text,request.encrypted_embedding,
              (request.encrypted_preview IS NOT NULL) has_preview,request.consented_at::text,
              request.status,user_account.full_name
       FROM biometric_enrollment_requests request
       JOIN users user_account ON user_account.id=request.user_id AND user_account.active=true
       JOIN organization_members membership
         ON membership.organization_id=request.organization_id AND membership.user_id=request.user_id
       WHERE request.id=$1 AND request.organization_id=$2
       FOR UPDATE`,
      [id,organizationId],
    );
    const enrollment=result.rows[0];
    if(!enrollment){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La solicitud biométrica no existe en esta empresa."},{status:404});
    }
    if(!canAccessSite(session,enrollment.site_id)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }
    if(enrollment.status!=="pending"){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Esta solicitud ya fue revisada."},{status:409});
    }

    const expired=await client.query<{expired:boolean}>(
      "SELECT (preview_expires_at IS NOT NULL AND preview_expires_at<=now()) expired FROM biometric_enrollment_requests WHERE id=$1",
      [id],
    );
    if(expired.rows[0]?.expired){
      await client.query(
        `UPDATE biometric_enrollment_requests
         SET status='expired',encrypted_embedding=NULL,encrypted_preview=NULL,preview_mime=NULL,updated_at=now()
         WHERE id=$1`,
        [id],
      );
      await client.query(
        `INSERT INTO biometric_enrollment_events(
           organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
         ) VALUES($1,$2,$3,$4,'expired','self_camera_approved',$5::jsonb)`,
        [organizationId,enrollment.user_id,session.userId,enrollment.site_id,JSON.stringify({request_id:id,reason:"review_after_preview_expiry"})],
      );
      await client.query("COMMIT");
      return NextResponse.json({message:"La evidencia temporal expiró. La persona debe repetir el enrolamiento."},{status:409});
    }

    if(decision==="reject"){
      await client.query(
        `UPDATE biometric_enrollment_requests
         SET status='rejected',reviewed_by=$1,reviewed_at=now(),review_note=$2,
             encrypted_embedding=NULL,encrypted_preview=NULL,preview_mime=NULL,updated_at=now()
         WHERE id=$3`,
        [session.userId,note||"Identidad no aprobada",id],
      );
      await client.query(
        `INSERT INTO biometric_enrollment_events(
           organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
         ) VALUES($1,$2,$3,$4,'rejected','self_camera_approved',$5::jsonb)`,
        [organizationId,enrollment.user_id,session.userId,enrollment.site_id,JSON.stringify({
          request_id:id,reason:note||"Identidad no aprobada",actor_platform_role:session.platformRole,actor_email:session.email,
        })],
      );
      await client.query("COMMIT");
      return NextResponse.json({status:"rejected",message:"Solicitud rechazada. La evidencia biométrica temporal fue eliminada."});
    }

    if(!enrollment.encrypted_embedding||!enrollment.has_preview){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La solicitud ya no conserva evidencia temporal suficiente para aprobar identidad."},{status:409});
    }

    await client.query(
      `INSERT INTO user_biometric_profiles(
         user_id,organization_id,encrypted_embedding,consented_at,enrolled_at,revoked_at,updated_at,
         enrolled_by,enrollment_site_id,enrollment_method,identity_verified_at,revoked_by,revoked_reason
       ) VALUES($1,$2,$3,$4,now(),NULL,now(),$5,$6,'self_camera_approved',now(),NULL,NULL)
       ON CONFLICT(user_id)
       DO UPDATE SET organization_id=EXCLUDED.organization_id,
                     encrypted_embedding=EXCLUDED.encrypted_embedding,
                     consented_at=EXCLUDED.consented_at,enrolled_at=now(),revoked_at=NULL,updated_at=now(),
                     enrolled_by=EXCLUDED.enrolled_by,enrollment_site_id=EXCLUDED.enrollment_site_id,
                     enrollment_method='self_camera_approved',identity_verified_at=now(),
                     revoked_by=NULL,revoked_reason=NULL`,
      [
        enrollment.user_id,organizationId,enrollment.encrypted_embedding,enrollment.consented_at,
        session.userId,enrollment.site_id,
      ],
    );

    await client.query(
      `UPDATE biometric_enrollment_requests
       SET status='approved',reviewed_by=$1,reviewed_at=now(),review_note=$2,
           encrypted_embedding=NULL,encrypted_preview=NULL,preview_mime=NULL,updated_at=now()
       WHERE id=$3`,
      [session.userId,note||null,id],
    );

    await client.query(
      `INSERT INTO biometric_enrollment_events(
         organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
       ) VALUES($1,$2,$3,$4,'approved','self_camera_approved',$5::jsonb)`,
      [organizationId,enrollment.user_id,session.userId,enrollment.site_id,JSON.stringify({
        request_id:id,
        policy_version_id:enrollment.policy_version_id,
        actor_platform_role:session.platformRole,
        actor_email:session.email,
        note:note||null,
      })],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      status:"approved",
      userId:enrollment.user_id,
      message:`Identidad de ${enrollment.full_name} aprobada. Desde ahora las marcaciones biométricas se validan automáticamente.`,
    });
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}
