import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { finiteCoordinate, haversineMeters } from "@/lib/biometric";
import { pool } from "@/lib/db";
import { DEFAULT_ATTENDANCE_POLICY } from "@/lib/attendance-policy";
import { canAccessAttendanceSite } from "@/lib/attendance-scope";

type Policy={require_geolocation:boolean;max_location_accuracy_m:number};
type Site={id:string;name:string;latitude:number|null;longitude:number|null;geofence_radius_m:number;active:boolean};

async function validateLocation(
  client:any,
  organizationId:string,
  siteId:string,
  body:Record<string,unknown>,
  policy:Policy,
){
  const siteResult=await client.query(
    `SELECT id,name,latitude,longitude,geofence_radius_m,active
     FROM sites WHERE id=$1 AND organization_id=$2`,
    [siteId,organizationId],
  );
  const site=siteResult.rows[0] as Site|undefined;
  if(!site?.active)throw new Error("SITE_UNAVAILABLE");
  if(!policy.require_geolocation)return {site,latitude:null,longitude:null,accuracy:null,distance:null};

  const latitude=finiteCoordinate(body.latitude,-90,90);
  const longitude=finiteCoordinate(body.longitude,-180,180);
  const accuracy=Number(body.accuracy);
  if(latitude===null||longitude===null||!Number.isFinite(accuracy)||accuracy<0)throw new Error("GPS_INVALID");
  if(accuracy>policy.max_location_accuracy_m)throw new Error("GPS_ACCURACY");
  if(site.latitude===null||site.longitude===null)throw new Error("GEOFENCE_MISSING");
  const distance=haversineMeters(latitude,longitude,site.latitude,site.longitude);
  if(distance>site.geofence_radius_m)throw new Error("GEOFENCE_OUT");
  return {site,latitude,longitude,accuracy,distance};
}

function failure(error:unknown,policy:Policy){
  const code=error instanceof Error?error.message:"";
  if(code==="SITE_UNAVAILABLE")return ["La sede seleccionada no está disponible.",422] as const;
  if(code==="GPS_INVALID")return ["No fue posible validar tu ubicación.",422] as const;
  if(code==="GPS_ACCURACY")return [`La precisión GPS debe ser de ${policy.max_location_accuracy_m} m o menos.`,422] as const;
  if(code==="GEOFENCE_MISSING")return ["La sede aún no tiene geocerca configurada.",409] as const;
  if(code==="GEOFENCE_OUT")return ["Debes estar dentro de la geocerca de la sede para registrar este evento.",422] as const;
  return null;
}

// ── Explicit intra-shift displacement lifecycle ─────────────────────────────
export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const action=body?.action==="arrive"?"arrive":body?.action==="start"?"start":null;
  if(!action)return NextResponse.json({message:"Acción de desplazamiento inválida."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const policyResult=await client.query<Policy>(
      `SELECT require_geolocation,max_location_accuracy_m
       FROM organization_attendance_policies WHERE organization_id=$1`,
      [session.organizationId],
    );
    const policy=policyResult.rows[0]||DEFAULT_ATTENDANCE_POLICY;

    const shiftResult=await client.query<{id:string;current_site_id:string;site_id:string}>(
      `SELECT id,COALESCE(current_site_id,site_id)::text current_site_id,site_id::text
       FROM attendance_shifts
       WHERE user_id=$1 AND organization_id=$2 AND status='open'
       FOR UPDATE`,
      [session.userId,session.organizationId],
    );
    if(!shiftResult.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Debes tener una jornada abierta para registrar desplazamientos."},{status:409});
    }
    const shift=shiftResult.rows[0];

    if(action==="start"){
      const destinationSiteId=typeof body.destinationSiteId==="string"?body.destinationSiteId:"";
      if(!destinationSiteId||destinationSiteId===shift.current_site_id){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"Selecciona una sede de destino diferente a tu ubicación actual."},{status:422});
      }
      if(!canAccessAttendanceSite(session,session.organizationId,destinationSiteId)){
        await client.query("ROLLBACK");
        return new NextResponse("Forbidden",{status:403});
      }
      const open=await client.query(
        "SELECT 1 FROM attendance_displacements WHERE attendance_shift_id=$1 AND status='in_transit'",
        [shift.id],
      );
      if(open.rowCount){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"Ya tienes un desplazamiento en curso."},{status:409});
      }
      const departure=await validateLocation(client,session.organizationId,shift.current_site_id,body||{},policy);
      const destination=await client.query<{name:string}>(
        "SELECT name FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",
        [destinationSiteId,session.organizationId],
      );
      if(!destination.rowCount){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"La sede de destino no está disponible."},{status:422});
      }
      const inserted=await client.query(
        `INSERT INTO attendance_displacements(
           organization_id,attendance_shift_id,user_id,from_site_id,to_site_id,status,
           departure_latitude,departure_longitude,departure_accuracy_m,departure_distance_m
         ) VALUES($1,$2,$3,$4,$5,'in_transit',$6,$7,$8,$9)
         RETURNING id,departed_at::text`,
        [session.organizationId,shift.id,session.userId,shift.current_site_id,destinationSiteId,
         departure.latitude,departure.longitude,departure.accuracy,departure.distance],
      );
      await client.query("COMMIT");
      return NextResponse.json({
        displacement:{id:inserted.rows[0].id,from_site_id:shift.current_site_id,to_site_id:destinationSiteId,
          from_site_name:departure.site.name,to_site_name:destination.rows[0].name,departed_at:inserted.rows[0].departed_at,status:"in_transit"},
      });
    }

    const movement=await client.query<{
      id:string;from_site_id:string;to_site_id:string;from_site_name:string;to_site_name:string;departed_at:string;
    }>(
      `SELECT d.id,d.from_site_id::text,d.to_site_id::text,origin.name from_site_name,destination.name to_site_name,d.departed_at::text
       FROM attendance_displacements d
       JOIN sites origin ON origin.id=d.from_site_id
       JOIN sites destination ON destination.id=d.to_site_id
       WHERE d.attendance_shift_id=$1 AND d.status='in_transit'
       FOR UPDATE`,
      [shift.id],
    );
    if(!movement.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"No tienes un desplazamiento pendiente de llegada."},{status:409});
    }
    const current=movement.rows[0];
    if(!canAccessAttendanceSite(session,session.organizationId,current.to_site_id)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }
    const arrival=await validateLocation(client,session.organizationId,current.to_site_id,body||{},policy);
    const arrived=await client.query(
      `UPDATE attendance_displacements SET status='arrived',arrived_at=now(),
         arrival_latitude=$1,arrival_longitude=$2,arrival_accuracy_m=$3,arrival_distance_m=$4,updated_at=now()
       WHERE id=$5 RETURNING arrived_at::text`,
      [arrival.latitude,arrival.longitude,arrival.accuracy,arrival.distance,current.id],
    );
    await client.query(
      "UPDATE attendance_shifts SET current_site_id=$1,updated_at=now() WHERE id=$2",
      [current.to_site_id,shift.id],
    );
    await client.query("COMMIT");
    return NextResponse.json({
      displacement:{...current,status:"arrived",arrived_at:arrived.rows[0].arrived_at},
      currentSite:{id:current.to_site_id,name:current.to_site_name},
    });
  }catch(error){
    await client.query("ROLLBACK");
    const mapped=failure(error,DEFAULT_ATTENDANCE_POLICY);
    if(mapped)return NextResponse.json({message:mapped[0]},{status:mapped[1]});
    throw error;
  }finally{
    client.release();
  }
}
