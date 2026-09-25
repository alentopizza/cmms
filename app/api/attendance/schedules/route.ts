import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { resolveAttendanceOrganization } from "@/lib/attendance-scope";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

type Day={day:number;enabled:boolean;startTime:string;endTime:string;breakMinutes:number};

function parseWeeklySchedule(value:unknown):Day[]|null{
  if(!Array.isArray(value)||value.length!==7)return null;
  const normalized:Day[]=[];
  for(const entry of value){
    if(!entry||typeof entry!=="object")return null;
    const item=entry as Record<string,unknown>;
    const day=Number(item.day);
    const enabled=Boolean(item.enabled);
    const startTime=typeof item.startTime==="string"?item.startTime:"";
    const endTime=typeof item.endTime==="string"?item.endTime:"";
    const breakMinutes=Number(item.breakMinutes??0);
    if(!Number.isInteger(day)||day<1||day>7||!TIME.test(startTime)||!TIME.test(endTime)||
       !Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes>360)return null;
    normalized.push({day,enabled,startTime,endTime,breakMinutes});
  }
  normalized.sort((a,b)=>a.day-b.day);
  if(new Set(normalized.map(item=>item.day)).size!==7)return null;
  return normalized;
}

// ── Server-authoritative per-user schedule assignment ───────────────────────
export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const organizationId=resolveAttendanceOrganization(session,body?.organizationId);
  const userId=typeof body?.userId==="string"?body.userId:"";
  const name=typeof body?.name==="string"?body.name.trim().slice(0,120):"Jornada principal";
  const weeklySchedule=parseWeeklySchedule(body?.weeklySchedule);
  const graceBefore=Number(body?.graceBeforeMinutes??15);
  const graceAfter=Number(body?.graceAfterMinutes??15);
  const active=body?.active!==false;

  if(!organizationId||!UUID.test(organizationId)||!UUID.test(userId)||!weeklySchedule||
     !Number.isInteger(graceBefore)||graceBefore<0||graceBefore>240||
     !Number.isInteger(graceAfter)||graceAfter<0||graceAfter>240){
    return NextResponse.json({message:"La configuración de jornada está incompleta o contiene valores inválidos."},{status:422});
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const membership=await client.query(
      `SELECT 1 FROM organization_members om
       JOIN users u ON u.id=om.user_id
       WHERE om.organization_id=$1 AND om.user_id=$2 AND u.active=true`,
      [organizationId,userId],
    );
    if(!membership.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El usuario no pertenece a la empresa seleccionada o está inactivo."},{status:404});
    }

    const saved=await client.query(
      `INSERT INTO user_attendance_schedules(
         organization_id,user_id,name,weekly_schedule,grace_before_minutes,grace_after_minutes,active,updated_by,updated_at
       ) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,now())
       ON CONFLICT(organization_id,user_id)
       DO UPDATE SET name=EXCLUDED.name,weekly_schedule=EXCLUDED.weekly_schedule,
                     grace_before_minutes=EXCLUDED.grace_before_minutes,
                     grace_after_minutes=EXCLUDED.grace_after_minutes,
                     active=EXCLUDED.active,updated_by=EXCLUDED.updated_by,updated_at=now()
       RETURNING id,name,weekly_schedule,grace_before_minutes,grace_after_minutes,active,updated_at::text`,
      [organizationId,userId,name||"Jornada principal",JSON.stringify(weeklySchedule),graceBefore,graceAfter,active,session.userId||null],
    );

    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,'attendance.schedule.updated','user_attendance_schedule',$3,$4::jsonb)`,
      [organizationId,session.userId||null,saved.rows[0].id,JSON.stringify({subject_user_id:userId,active,grace_before_minutes:graceBefore,grace_after_minutes:graceAfter})],
    );
    await client.query("COMMIT");
    return NextResponse.json({schedule:saved.rows[0]});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
