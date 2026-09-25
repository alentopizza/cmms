import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { canAccessSite, getSession, type AuthSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { finiteCoordinate, haversineMeters } from "@/lib/biometric";
import { pool } from "@/lib/db";
import { DEFAULT_ATTENDANCE_POLICY, attendanceRoleEnabled } from "@/lib/attendance-policy";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Policy={
  enabled:boolean;
  enabled_roles:string[];
  require_geolocation:boolean;
  max_location_accuracy_m:number;
};

type MovementSite={
  id:string;
  name:string;
  latitude:number|null;
  longitude:number|null;
  geofence_radius_m:number;
  active:boolean;
};

type OpenSegment={
  id:string;
  attendance_shift_id:string;
  sequence:number;
  segment_type:"site"|"travel";
  site_id:string|null;
  from_site_id:string|null;
  to_site_id:string|null;
  destination_task_id:string|null;
  started_at:string;
};

type LocationEvidence={
  latitude:number|null;
  longitude:number|null;
  accuracy:number|null;
  distance:number|null;
};

async function loadPolicy(client:PoolClient,organizationId:string){
  const result=await client.query<Policy>(
    `SELECT enabled,enabled_roles,require_geolocation,max_location_accuracy_m
     FROM organization_attendance_policies
     WHERE organization_id=$1
     FOR UPDATE`,
    [organizationId],
  );
  return result.rows[0]||DEFAULT_ATTENDANCE_POLICY;
}

async function loadSite(client:PoolClient,organizationId:string,siteId:string){
  const result=await client.query<MovementSite>(
    `SELECT id,name,latitude,longitude,geofence_radius_m,active
     FROM sites WHERE id=$1 AND organization_id=$2`,
    [siteId,organizationId],
  );
  return result.rows[0]||null;
}

function validateLocation(
  body:{latitude?:unknown;longitude?:unknown;accuracy?:unknown},
  site:MovementSite,
  policy:Policy,
):LocationEvidence|NextResponse{
  if(!policy.require_geolocation){
    return {latitude:null,longitude:null,accuracy:null,distance:null};
  }
  const latitude=finiteCoordinate(body.latitude,-90,90);
  const longitude=finiteCoordinate(body.longitude,-180,180);
  const accuracy=Number(body.accuracy);
  if(latitude===null||longitude===null||!Number.isFinite(accuracy)||accuracy<0){
    return NextResponse.json({message:"No fue posible validar tu ubicación para registrar el desplazamiento."},{status:422});
  }
  if(accuracy>policy.max_location_accuracy_m){
    return NextResponse.json({
      message:`La precisión GPS actual es de ${Math.round(accuracy)} m. Se requieren ${policy.max_location_accuracy_m} m o menos.`,
    },{status:422});
  }
  if(site.latitude===null||site.longitude===null){
    return NextResponse.json({message:"La sede todavía no tiene geocerca configurada."},{status:409});
  }
  const distance=haversineMeters(latitude,longitude,site.latitude,site.longitude);
  if(distance>site.geofence_radius_m){
    return NextResponse.json({
      message:`Estás a ${Math.round(distance)} m de ${site.name}. La geocerca permite ${site.geofence_radius_m} m.`,
    },{status:422});
  }
  return {latitude,longitude,accuracy,distance};
}

async function assignedDestinationTask(
  client:PoolClient,
  session:AuthSession,
  organizationId:string,
  taskId:string,
  siteId:string,
){
  if(!UUID.test(taskId))return null;
  const task=await client.query<{
    id:string;
    assigned_to:string|null;
    crew_id:string|null;
    service_supplier_id:string|null;
    status:string;
    site_id:string;
  }>(
    `SELECT t.id,t.assigned_to,t.crew_id,t.service_supplier_id,t.status,w.site_id
     FROM work_order_tasks t
     JOIN work_orders w ON w.id=t.work_order_id
     WHERE t.id=$1 AND t.organization_id=$2
       AND t.status IN ('pending','in_progress')
       AND COALESCE(t.completed,false)=false
       AND w.status NOT IN ('completed','cancelled')`,
    [taskId,organizationId],
  );
  const row=task.rows[0];
  if(!row||row.site_id!==siteId)return null;
  if(row.assigned_to===session.userId)return row;
  if(session.role==="provider"&&row.service_supplier_id&&row.service_supplier_id===session.externalSupplierId)return row;
  if(row.crew_id&&session.userId&&session.role!=="provider"){
    const crew=await client.query(
      "SELECT 1 FROM crew_members WHERE organization_id=$1 AND crew_id=$2 AND user_id=$3",
      [organizationId,row.crew_id,session.userId],
    );
    if(crew.rowCount)return row;
  }
  return null;
}

async function audit(
  client:PoolClient,
  session:AuthSession,
  organizationId:string,
  action:string,
  segmentId:string,
  metadata:Record<string,unknown>,
){
  await client.query(
    `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
     VALUES($1,$2,$3,'attendance_shift_segment',$4,$5::jsonb)`,
    [organizationId,session.userId,action,segmentId,JSON.stringify(metadata)],
  );
}

// ── Server-authoritative displacement lifecycle ─────────────────────────────
// Departure and arrival are explicit Attendance events. Reaction may contribute
// route samples while connected, but it never decides whether a movement is
// valid or which Site the attendance jornada currently belongs to.
export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as {
    action?:unknown;
    toSiteId?:unknown;
    destinationTaskId?:unknown;
    notes?:unknown;
    latitude?:unknown;
    longitude?:unknown;
    accuracy?:unknown;
  }|null;
  const action=body?.action==="start_travel"?"start_travel":body?.action==="arrive"?"arrive":null;
  if(!action)return NextResponse.json({message:"Acción de desplazamiento inválida."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const policy=await loadPolicy(client,session.organizationId);
    if(!policy.enabled||!attendanceRoleEnabled(session,policy.enabled_roles)){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El control de asistencia no está habilitado para tu rol."},{status:409});
    }

    const shift=await client.query<{id:string}>(
      `SELECT id FROM attendance_shifts
       WHERE organization_id=$1 AND user_id=$2 AND status='open'
       FOR UPDATE`,
      [session.organizationId,session.userId],
    );
    if(!shift.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Debes tener una jornada abierta para registrar desplazamientos."},{status:409});
    }
    const shiftId=shift.rows[0].id;

    const currentResult=await client.query<OpenSegment>(
      `SELECT id,attendance_shift_id,sequence,segment_type,site_id,from_site_id,to_site_id,
              destination_task_id,started_at::text
       FROM attendance_shift_segments
       WHERE attendance_shift_id=$1 AND ended_at IS NULL
       FOR UPDATE`,
      [shiftId],
    );
    const current=currentResult.rows[0];
    if(!current){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La jornada no tiene un tramo activo. Actualiza la pantalla e intenta nuevamente."},{status:409});
    }

    if(action==="start_travel"){
      if(current.segment_type!=="site"||!current.site_id){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"Ya existe un desplazamiento abierto. Registra la llegada antes de iniciar otro."},{status:409});
      }
      const toSiteId=typeof body?.toSiteId==="string"?body.toSiteId:"";
      if(!UUID.test(toSiteId)||toSiteId===current.site_id){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"Selecciona una sede de destino diferente a la sede actual."},{status:422});
      }
      if(!canAccessSite(session,toSiteId)){
        await client.query("ROLLBACK");
        return new NextResponse("Forbidden",{status:403});
      }

      const [fromSite,toSite]=await Promise.all([
        loadSite(client,session.organizationId,current.site_id),
        loadSite(client,session.organizationId,toSiteId),
      ]);
      if(!fromSite?.active||!toSite?.active){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"La sede de origen o destino no está disponible."},{status:422});
      }
      if(policy.require_geolocation&&(toSite.latitude===null||toSite.longitude===null)){
        await client.query("ROLLBACK");
        return NextResponse.json({message:"La sede de destino no tiene geocerca configurada y no puede recibir un desplazamiento geolocalizado."},{status:409});
      }

      const location=validateLocation({
        latitude:body?.latitude,longitude:body?.longitude,accuracy:body?.accuracy,
      },fromSite,policy);
      if(location instanceof NextResponse){
        await client.query("ROLLBACK");
        return location;
      }

      const requestedTaskId=typeof body?.destinationTaskId==="string"?body.destinationTaskId:"";
      let destinationTaskId:string|null=null;
      if(requestedTaskId){
        const task=await assignedDestinationTask(client,session,session.organizationId,requestedTaskId,toSiteId);
        if(!task){
          await client.query("ROLLBACK");
          return NextResponse.json({message:"La actividad seleccionada no está asignada a tu cuenta o no pertenece a la sede de destino."},{status:422});
        }
        destinationTaskId=task.id;
      }

      const tracking=await client.query<{id:string}>(
        `SELECT id FROM technician_tracking_sessions
         WHERE organization_id=$1 AND user_id=$2 AND status='active'
           AND last_seen_at>now()-interval '30 minutes'
         ORDER BY connected_at DESC LIMIT 1`,
        [session.organizationId,session.userId],
      );

      await client.query(
        `UPDATE attendance_shift_segments SET
           ended_at=now(),end_latitude=$1,end_longitude=$2,end_accuracy_m=$3,end_distance_m=$4
         WHERE id=$5`,
        [location.latitude,location.longitude,location.accuracy,location.distance,current.id],
      );

      const inserted=await client.query<{id:string;started_at:string}>(
        `INSERT INTO attendance_shift_segments(
           organization_id,attendance_shift_id,user_id,sequence,segment_type,
           from_site_id,to_site_id,destination_task_id,tracking_session_id,
           started_at,start_latitude,start_longitude,start_accuracy_m,start_distance_m,notes
         ) VALUES($1,$2,$3,$4,'travel',$5,$6,$7,$8,now(),$9,$10,$11,$12,$13)
         RETURNING id,started_at::text`,
        [
          session.organizationId,shiftId,session.userId,current.sequence+1,current.site_id,toSiteId,
          destinationTaskId,tracking.rows[0]?.id||null,
          location.latitude,location.longitude,location.accuracy,location.distance,
          typeof body?.notes==="string"?body.notes.trim().slice(0,500)||null:null,
        ],
      );

      await client.query(
        `UPDATE attendance_contingency_requests
         SET status='cancelled',updated_at=now()
         WHERE organization_id=$1 AND user_id=$2 AND action='check_out'
           AND status IN ('pending','approved')`,
        [session.organizationId,session.userId],
      );

      await audit(client,session,session.organizationId,"attendance_travel_started",inserted.rows[0].id,{
        attendance_shift_id:shiftId,
        from_site_id:current.site_id,
        to_site_id:toSiteId,
        destination_task_id:destinationTaskId,
        tracking_session_id:tracking.rows[0]?.id||null,
      });

      await client.query("COMMIT");
      return NextResponse.json({
        action:"start_travel",
        segmentId:inserted.rows[0].id,
        at:inserted.rows[0].started_at,
        fromSite:{id:fromSite.id,name:fromSite.name},
        toSite:{id:toSite.id,name:toSite.name},
        destinationTaskId,
        reactionTracking:Boolean(tracking.rowCount),
      });
    }

    if(current.segment_type!=="travel"||!current.from_site_id||!current.to_site_id){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"No tienes un desplazamiento pendiente de llegada."},{status:409});
    }
    if(!canAccessSite(session,current.to_site_id)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    const destination=await loadSite(client,session.organizationId,current.to_site_id);
    if(!destination?.active){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La sede de destino ya no está disponible."},{status:409});
    }
    const location=validateLocation({
      latitude:body?.latitude,longitude:body?.longitude,accuracy:body?.accuracy,
    },destination,policy);
    if(location instanceof NextResponse){
      await client.query("ROLLBACK");
      return location;
    }

    const tracking=await client.query<{id:string}>(
      `SELECT id FROM technician_tracking_sessions
       WHERE organization_id=$1 AND user_id=$2 AND status='active'
       ORDER BY connected_at DESC LIMIT 1`,
      [session.organizationId,session.userId],
    );

    const closed=await client.query<{ended_at:string}>(
      `UPDATE attendance_shift_segments SET
         ended_at=now(),end_latitude=$1,end_longitude=$2,end_accuracy_m=$3,end_distance_m=$4,
         tracking_session_id=COALESCE(tracking_session_id,$5)
       WHERE id=$6
       RETURNING ended_at::text`,
      [location.latitude,location.longitude,location.accuracy,location.distance,tracking.rows[0]?.id||null,current.id],
    );

    const siteSegment=await client.query<{id:string}>(
      `INSERT INTO attendance_shift_segments(
         organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,
         destination_task_id,started_at,start_latitude,start_longitude,start_accuracy_m,start_distance_m
       ) VALUES($1,$2,$3,$4,'site',$5,$6,now(),$7,$8,$9,$10)
       RETURNING id`,
      [
        session.organizationId,shiftId,session.userId,current.sequence+1,current.to_site_id,
        current.destination_task_id,location.latitude,location.longitude,location.accuracy,location.distance,
      ],
    );

    await audit(client,session,session.organizationId,"attendance_travel_arrived",current.id,{
      attendance_shift_id:shiftId,
      from_site_id:current.from_site_id,
      to_site_id:current.to_site_id,
      destination_task_id:current.destination_task_id,
      arrival_site_segment_id:siteSegment.rows[0].id,
    });

    await client.query("COMMIT");
    return NextResponse.json({
      action:"arrive",
      segmentId:current.id,
      at:closed.rows[0].ended_at,
      site:{id:destination.id,name:destination.name},
      destinationTaskId:current.destination_task_id,
    });
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
