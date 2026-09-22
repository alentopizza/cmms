import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { encryptEmbedding, validateEmbedding } from "@/lib/biometric";
import { pool } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Authorization helpers ────────────────────────────────────────────────────

async function targetUser(client:any, organizationId:string, userId:string){
  return client.query<{id:string;role:string;has_avatar:boolean}>(
    `SELECT u.id,om.role,(u.avatar_data IS NOT NULL) has_avatar
     FROM users u
     JOIN organization_members om ON om.user_id=u.id AND om.organization_id=$1
     WHERE u.id=$2 AND u.active=true`,
    [organizationId,userId],
  );
}

// ── Supervised enrollment ────────────────────────────────────────────────────

export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as {
    userId?:unknown; siteId?:unknown; embedding?:unknown; consent?:unknown; identityChecked?:unknown;
  }|null;

  const userId=typeof body?.userId==="string"?body.userId:"";
  const siteId=typeof body?.siteId==="string"?body.siteId:"";
  const embedding=validateEmbedding(body?.embedding);

  if(!UUID.test(userId)||!UUID.test(siteId)||!embedding||body?.consent!==true||body?.identityChecked!==true){
    return NextResponse.json({message:"El enrolamiento supervisado está incompleto."},{status:422});
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const person=await targetUser(client,session.organizationId,userId);
    if(!person.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El usuario no pertenece a esta empresa."},{status:404});
    }
    if(!person.rows[0].has_avatar){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El usuario debe tener foto de perfil antes del enrolamiento supervisado."},{status:422});
    }

    const site=await client.query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,session.organizationId]);
    if(!site.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La sede seleccionada no está disponible."},{status:422});
    }

    const existing=await client.query<{active:boolean}>(
      "SELECT (revoked_at IS NULL AND identity_verified_at IS NOT NULL) active FROM user_biometric_profiles WHERE user_id=$1",
      [userId],
    );
    const eventType=existing.rowCount?"reenrolled":"enrolled";
    const encrypted=encryptEmbedding(embedding);

    await client.query(
      `INSERT INTO user_biometric_profiles(
         user_id,organization_id,encrypted_embedding,consented_at,enrolled_at,revoked_at,updated_at,
         enrolled_by,enrollment_site_id,enrollment_method,identity_verified_at,revoked_by,revoked_reason
       ) VALUES($1,$2,$3,now(),now(),NULL,now(),$4,$5,'supervised_camera',now(),NULL,NULL)
       ON CONFLICT(user_id)
       DO UPDATE SET organization_id=EXCLUDED.organization_id,
                     encrypted_embedding=EXCLUDED.encrypted_embedding,
                     consented_at=now(),enrolled_at=now(),revoked_at=NULL,updated_at=now(),
                     enrolled_by=EXCLUDED.enrolled_by,enrollment_site_id=EXCLUDED.enrollment_site_id,
                     enrollment_method='supervised_camera',identity_verified_at=now(),
                     revoked_by=NULL,revoked_reason=NULL`,
      [userId,session.organizationId,encrypted,session.userId,siteId],
    );

    await client.query(
      `INSERT INTO biometric_enrollment_events(
         organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
       ) VALUES($1,$2,$3,$4,$5,'supervised_camera',$6::jsonb)`,
      [session.organizationId,userId,session.userId,siteId,eventType,JSON.stringify({identity_checked:true,consent:true})],
    );

    await client.query("COMMIT");
    return NextResponse.json({enrolled:true,eventType});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}

// ── Administrative revocation ────────────────────────────────────────────────

export async function DELETE(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as {userId?:unknown;reason?:unknown}|null;
  const userId=typeof body?.userId==="string"?body.userId:"";
  const reason=typeof body?.reason==="string"?body.reason.trim().slice(0,500):"Revocación administrativa";
  if(!UUID.test(userId))return NextResponse.json({message:"Usuario inválido."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const open=await client.query(
      `SELECT 1 FROM attendance_shifts
       WHERE organization_id=$1 AND user_id=$2 AND status='open'`,
      [session.organizationId,userId],
    );
    if(open.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Finaliza la jornada abierta antes de revocar la biometría."},{status:409});
    }

    const revoked=await client.query(
      `UPDATE user_biometric_profiles
       SET encrypted_embedding=NULL,revoked_at=now(),revoked_by=$1,revoked_reason=$2,updated_at=now()
       WHERE user_id=$3 AND organization_id=$4 AND revoked_at IS NULL
       RETURNING enrollment_site_id`,
      [session.userId,reason,userId,session.organizationId],
    );
    if(!revoked.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"No hay una biometría activa para revocar."},{status:409});
    }

    await client.query(
      `INSERT INTO biometric_enrollment_events(
         organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
       ) VALUES($1,$2,$3,$4,'revoked',NULL,$5::jsonb)`,
      [session.organizationId,userId,session.userId,revoked.rows[0].enrollment_site_id||null,JSON.stringify({reason})],
    );

    await client.query("COMMIT");
    return NextResponse.json({revoked:true});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
