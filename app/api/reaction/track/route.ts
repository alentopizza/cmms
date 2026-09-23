import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";

function coordinate(value:unknown,min:number,max:number){
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"reaction.track")) return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as any;
  const action=body?.action;
  if(!["connect","sample","disconnect"].includes(action)){
    return NextResponse.json({message:"Acción inválida."},{status:422});
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    if(action==="disconnect"){
      await client.query(
        `UPDATE technician_tracking_sessions
         SET status='closed',disconnected_at=now(),last_seen_at=now()
         WHERE user_id=$1 AND status='active'`,
        [session.userId],
      );
      await client.query("COMMIT");
      return NextResponse.json({status:"closed"});
    }

    const latitude=coordinate(body?.latitude,-90,90);
    const longitude=coordinate(body?.longitude,-180,180);
    const accuracy=Number(body?.accuracy);
    if(latitude===null||longitude===null||!Number.isFinite(accuracy)||accuracy<0){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Ubicación inválida."},{status:422});
    }

    let active=await client.query<{id:string;last_seen_at:string}>(
      `SELECT id,last_seen_at::text
       FROM technician_tracking_sessions
       WHERE user_id=$1 AND status='active'
       FOR UPDATE`,
      [session.userId],
    );

    const stale=active.rows[0]
      ? Date.now()-new Date(active.rows[0].last_seen_at).getTime()>120000
      : false;

    if(action==="connect" || stale){
      if(active.rowCount){
        await client.query(
          `UPDATE technician_tracking_sessions
           SET status='closed',disconnected_at=now(),last_seen_at=now()
           WHERE id=$1`,
          [active.rows[0].id],
        );
      }
      active=await client.query<{id:string;last_seen_at:string}>(
        `INSERT INTO technician_tracking_sessions(
           organization_id,user_id,status,last_latitude,last_longitude,last_accuracy_m,last_seen_at
         ) VALUES($1,$2,'active',$3,$4,$5,now())
         RETURNING id,last_seen_at::text`,
        [session.organizationId,session.userId,latitude,longitude,accuracy],
      );
    }else if(active.rowCount){
      await client.query(
        `UPDATE technician_tracking_sessions
         SET last_latitude=$1,last_longitude=$2,last_accuracy_m=$3,last_seen_at=now()
         WHERE id=$4`,
        [latitude,longitude,accuracy,active.rows[0].id],
      );
    }else{
      active=await client.query<{id:string;last_seen_at:string}>(
        `INSERT INTO technician_tracking_sessions(
           organization_id,user_id,status,last_latitude,last_longitude,last_accuracy_m,last_seen_at
         ) VALUES($1,$2,'active',$3,$4,$5,now())
         RETURNING id,last_seen_at::text`,
        [session.organizationId,session.userId,latitude,longitude,accuracy],
      );
    }

    const shift=await client.query<{id:string}>(
      "SELECT id FROM attendance_shifts WHERE user_id=$1 AND status='open' ORDER BY check_in_at DESC LIMIT 1",
      [session.userId],
    );

    const heading=Number(body?.heading);
    const speed=Number(body?.speed);
    await client.query(
      `INSERT INTO technician_location_samples(
         organization_id,user_id,attendance_shift_id,tracking_session_id,
         latitude,longitude,accuracy_m,heading_deg,speed_mps,source
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'connected_app')`,
      [
        session.organizationId,session.userId,shift.rows[0]?.id||null,active.rows[0].id,
        latitude,longitude,accuracy,
        Number.isFinite(heading)&&heading>=0&&heading<=360?heading:null,
        Number.isFinite(speed)&&speed>=0?speed:null,
      ],
    );

    await client.query("COMMIT");
    return NextResponse.json({status:"active",trackingSessionId:active.rows[0].id});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
