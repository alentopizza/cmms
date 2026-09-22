import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { finiteCoordinate } from "@/lib/biometric";
import { pool } from "@/lib/db";

const REASONS=new Set(["camera_failure","gps_unavailable","gps_accuracy","geofence_mismatch","connectivity","device_issue","other"]);

// ── Current user's active contingency request ────────────────────────────────

export async function GET(){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const client=await pool.connect();
  try{
    await client.query(
      `UPDATE attendance_contingency_requests
       SET status='expired',updated_at=now()
       WHERE user_id=$1 AND status='approved' AND approved_until<=now()`,
      [session.userId],
    );
    const result=await client.query(
      `SELECT r.id,r.site_id,s.name site_name,r.action,r.reason_code,r.details,r.status,
              r.requested_at::text,r.reviewed_at::text,r.review_note,r.approved_until::text
       FROM attendance_contingency_requests r
       JOIN sites s ON s.id=r.site_id
       WHERE r.user_id=$1 AND r.organization_id=$2
         AND r.status IN ('pending','approved')
       ORDER BY r.requested_at DESC
       LIMIT 1`,
      [session.userId,session.organizationId],
    );
    return NextResponse.json({request:result.rows[0]||null});
  }finally{
    client.release();
  }
}

// ── Request creation: no identity bypass, verified enrollment required ──────

export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as {
    siteId?:unknown; action?:unknown; reasonCode?:unknown; details?:unknown;
    latitude?:unknown; longitude?:unknown; accuracy?:unknown; diagnostic?:unknown;
  }|null;

  const siteId=typeof body?.siteId==="string"?body.siteId:"";
  const action=body?.action==="check_out"?"check_out":body?.action==="check_in"?"check_in":null;
  const reasonCode=typeof body?.reasonCode==="string"?body.reasonCode:"";
  const details=typeof body?.details==="string"?body.details.trim():"";

  if(!action||!siteId||!REASONS.has(reasonCode)||details.length<8||details.length>1000){
    return NextResponse.json({message:"Completa sede, motivo y una descripción de al menos 8 caracteres."},{status:422});
  }
  if(!canAccessSite(session,siteId))return new NextResponse("Forbidden",{status:403});

  const latitude=finiteCoordinate(body?.latitude,-90,90);
  const longitude=finiteCoordinate(body?.longitude,-180,180);
  const accuracy=Number(body?.accuracy);
  const safeAccuracy=Number.isFinite(accuracy)&&accuracy>=0?accuracy:null;
  const diagnostic=body?.diagnostic&&typeof body.diagnostic==="object"?body.diagnostic:{};

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const profile=await client.query(
      `SELECT 1 FROM user_biometric_profiles
       WHERE user_id=$1 AND organization_id=$2
         AND revoked_at IS NULL
         AND encrypted_embedding IS NOT NULL
         AND enrollment_method='supervised_camera'
         AND identity_verified_at IS NOT NULL`,
      [session.userId,session.organizationId],
    );
    if(!profile.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La contingencia no reemplaza el enrolamiento. Debes tener biometría supervisada verificada."},{status:409});
    }

    const site=await client.query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,session.organizationId]);
    if(!site.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La sede seleccionada no está disponible."},{status:422});
    }

    const open=await client.query("SELECT id,site_id FROM attendance_shifts WHERE user_id=$1 AND status='open' FOR UPDATE",[session.userId]);
    if(action==="check_in"&&open.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Ya tienes una jornada abierta."},{status:409});
    }
    if(action==="check_out"&&(!open.rowCount||open.rows[0].site_id!==siteId)){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La contingencia de salida debe corresponder a tu jornada abierta y a la misma sede."},{status:409});
    }

    const existing=await client.query(
      `SELECT id,status FROM attendance_contingency_requests
       WHERE user_id=$1 AND action=$2 AND status IN ('pending','approved')
       LIMIT 1 FOR UPDATE`,
      [session.userId,action],
    );
    if(existing.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Ya tienes una solicitud de contingencia pendiente o aprobada para este evento."},{status:409});
    }

    const inserted=await client.query(
      `INSERT INTO attendance_contingency_requests(
         organization_id,user_id,site_id,action,reason_code,details,
         requester_latitude,requester_longitude,requester_accuracy_m,diagnostic
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       RETURNING id,status,requested_at::text`,
      [session.organizationId,session.userId,siteId,action,reasonCode,details,latitude,longitude,safeAccuracy,JSON.stringify(diagnostic)],
    );

    await client.query("COMMIT");
    return NextResponse.json({request:inserted.rows[0]},{status:201});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
