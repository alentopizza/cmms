import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { finiteCoordinate, haversineMeters } from "@/lib/biometric";
import { pool } from "@/lib/db";

// ── One-time use of an approved contingency authorization ────────────────────

export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as {
    requestId?:unknown; latitude?:unknown; longitude?:unknown; accuracy?:unknown;
  }|null;
  const requestId=typeof body?.requestId==="string"?body.requestId:"";
  if(!requestId)return NextResponse.json({message:"Autorización inválida."},{status:422});

  const latitude=finiteCoordinate(body?.latitude,-90,90);
  const longitude=finiteCoordinate(body?.longitude,-180,180);
  const accuracy=Number(body?.accuracy);
  const safeAccuracy=Number.isFinite(accuracy)&&accuracy>=0?accuracy:null;

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const contingency=await client.query<{
      id:string;site_id:string;action:"check_in"|"check_out";approved_until:string;
    }>(
      `SELECT id,site_id,action,approved_until::text
       FROM attendance_contingency_requests
       WHERE id=$1 AND organization_id=$2 AND user_id=$3 AND status='approved'
       FOR UPDATE`,
      [requestId,session.organizationId,session.userId],
    );
    const auth=contingency.rows[0];
    if(!auth){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La autorización no está disponible o ya fue utilizada."},{status:409});
    }
    if(new Date(auth.approved_until).getTime()<=Date.now()){
      await client.query("UPDATE attendance_contingency_requests SET status='expired',updated_at=now() WHERE id=$1",[auth.id]);
      await client.query("COMMIT");
      return NextResponse.json({message:"La autorización de contingencia venció. Solicita una nueva revisión."},{status:409});
    }
    if(!canAccessSite(session,auth.site_id)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    const profile=await client.query(
      `SELECT 1 FROM user_biometric_profiles
       WHERE user_id=$1 AND organization_id=$2
         AND revoked_at IS NULL AND encrypted_embedding IS NOT NULL
         AND enrollment_method='supervised_camera' AND identity_verified_at IS NOT NULL`,
      [session.userId,session.organizationId],
    );
    if(!profile.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Tu identidad biométrica supervisada ya no está activa."},{status:409});
    }

    const siteResult=await client.query<{name:string;latitude:number|null;longitude:number|null}>(
      "SELECT name,latitude,longitude FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",
      [auth.site_id,session.organizationId],
    );
    const site=siteResult.rows[0];
    if(!site){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La sede ya no está disponible."},{status:409});
    }

    const distance=latitude!==null&&longitude!==null&&site.latitude!==null&&site.longitude!==null
      ? haversineMeters(latitude,longitude,site.latitude,site.longitude)
      : null;

    const open=await client.query<{id:string;site_id:string}>(
      "SELECT id,site_id FROM attendance_shifts WHERE user_id=$1 AND status='open' FOR UPDATE",
      [session.userId],
    );

    let shiftId:string;
    let at:string;

    if(auth.action==="check_in"){
      if(open.rowCount){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"Ya tienes una jornada abierta."},{status:409});
      }
      const inserted=await client.query<{id:string;check_in_at:string}>(
        `INSERT INTO attendance_shifts(
           organization_id,user_id,site_id,status,
           check_in_latitude,check_in_longitude,check_in_accuracy_m,check_in_distance_m,
           check_in_verification_mode,check_in_contingency_id
         ) VALUES($1,$2,$3,'open',$4,$5,$6,$7,'contingency',$8)
         RETURNING id,check_in_at::text`,
        [session.organizationId,session.userId,auth.site_id,latitude,longitude,safeAccuracy,distance,auth.id],
      );
      shiftId=inserted.rows[0].id;
      at=inserted.rows[0].check_in_at;
      await client.query(
        `INSERT INTO attendance_shift_segments(
           organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,
           started_at,start_latitude,start_longitude,start_accuracy_m,start_distance_m
         ) VALUES($1,$2,$3,1,'site',$4,now(),$5,$6,$7,$8)`,
        [session.organizationId,shiftId,session.userId,auth.site_id,latitude,longitude,safeAccuracy,distance],
      );
    }else{
      if(!open.rowCount){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"No hay una jornada abierta válida para esta contingencia de salida."},{status:409});
      }
      shiftId=open.rows[0].id;
      const segment=await client.query<{id:string;segment_type:"site"|"travel";site_id:string|null}>(
        `SELECT id,segment_type,site_id
         FROM attendance_shift_segments
         WHERE attendance_shift_id=$1 AND ended_at IS NULL
         FOR UPDATE`,
        [shiftId],
      );
      const current=segment.rows[0];
      if(!current||current.segment_type==="travel"){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"Registra primero la llegada del desplazamiento antes de usar una contingencia de salida."},{status:409});
      }
      if(current.site_id!==auth.site_id){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"La autorización de salida no corresponde a la sede donde te encuentras actualmente."},{status:409});
      }
      const closed=await client.query<{check_out_at:string}>(
        `UPDATE attendance_shifts SET
           status='closed',check_out_at=now(),check_out_site_id=$1,
           check_out_latitude=$2,check_out_longitude=$3,check_out_accuracy_m=$4,check_out_distance_m=$5,
           check_out_verification_mode='contingency',check_out_contingency_id=$6,updated_at=now()
         WHERE id=$7
         RETURNING check_out_at::text`,
        [auth.site_id,latitude,longitude,safeAccuracy,distance,auth.id,shiftId],
      );
      await client.query(
        `UPDATE attendance_shift_segments SET
           ended_at=now(),end_latitude=$1,end_longitude=$2,end_accuracy_m=$3,end_distance_m=$4
         WHERE id=$5`,
        [latitude,longitude,safeAccuracy,distance,current.id],
      );
      at=closed.rows[0].check_out_at;
    }

    await client.query(
      `UPDATE attendance_contingency_requests
       SET status='used',used_at=now(),attendance_shift_id=$1,updated_at=now()
       WHERE id=$2`,
      [shiftId,auth.id],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      action:auth.action,
      shiftId,
      at,
      site:site.name,
      verificationMode:"contingency",
    });
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
