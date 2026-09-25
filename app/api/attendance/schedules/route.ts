import { NextResponse } from "next/server";
import { canAccessSite, getSession, type AuthSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { attendanceOrganizationId } from "@/lib/attendance-context";
import {
  ATTENDANCE_SCHEDULE_SOURCES,
  normalizeAttendanceSchedule,
  organizationLocalDate,
  rangesOverlap,
  validIsoDate,
  type AttendanceScheduleRecord,
  type AttendanceScheduleSource,
} from "@/lib/attendance-schedules";
import { normalizeBusinessHoursRow } from "@/lib/business-hours";
import type { PoolClient } from "pg";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCHEDULE_ROLES=new Set(["admin","manager","technician","provider","external"]);

type TargetUser={
  id:string;
  full_name:string;
  role:string;
  access_all_sites:boolean;
  site_ids:string[];
};

type ScheduleSite={
  id:string;
  name:string;
  business_days:number[];
  business_open_time:string;
  business_close_time:string;
  business_schedule:unknown;
};

function previousDate(value:string){
  const date=new Date(value+"T12:00:00Z");
  date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}

async function targetUser(client:PoolClient,organizationId:string,userId:string){
  return client.query<TargetUser>(
    `SELECT u.id,u.full_name,om.role,COALESCE(om.access_all_sites,true) access_all_sites,
            COALESCE((
              SELECT array_agg(oms.site_id::text ORDER BY oms.site_id::text)
              FROM organization_member_sites oms
              WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
            ),ARRAY[]::text[]) site_ids
     FROM organization_members om
     JOIN users u ON u.id=om.user_id
     WHERE om.organization_id=$1 AND om.user_id=$2 AND u.active=true`,
    [organizationId,userId],
  );
}

function visibleSites(session:AuthSession,person:TargetUser,sites:ScheduleSite[]){
  const subjectAllowed=person.access_all_sites?null:new Set(person.site_ids);
  const managerAllowed=session.platformRole!=="user"||session.accessAllSites?null:new Set(session.siteIds);
  return sites.filter(site=>
    (!subjectAllowed||subjectAllowed.has(site.id))
    &&(!managerAllowed||managerAllowed.has(site.id))
  );
}

async function loadContext(client:PoolClient,session:AuthSession,organizationId:string,userId:string){
  const [organization,personResult,sitesResult]=await Promise.all([
    client.query<{
      id:string;name:string;timezone:string;
      business_days:number[];business_open_time:string;business_close_time:string;business_schedule:unknown;
    }>(
      `SELECT id,name,timezone,business_days,business_open_time::text,business_close_time::text,business_schedule
       FROM organizations WHERE id=$1 AND active=true`,
      [organizationId],
    ),
    targetUser(client,organizationId,userId),
    client.query<ScheduleSite>(
      `SELECT id,name,business_days,business_open_time::text,business_close_time::text,business_schedule
       FROM sites WHERE organization_id=$1 AND active=true ORDER BY name`,
      [organizationId],
    ),
  ]);
  if(!organization.rowCount)return {error:NextResponse.json({message:"La empresa seleccionada no está disponible."},{status:404})};
  if(!personResult.rowCount)return {error:NextResponse.json({message:"El usuario no pertenece a esta empresa."},{status:404})};
  const person=personResult.rows[0];
  if(!SCHEDULE_ROLES.has(person.role))return {error:NextResponse.json({message:"El rol del usuario no utiliza jornada de asistencia."},{status:422})};
  const sites=visibleSites(session,person,sitesResult.rows);
  if(!sites.length)return {error:new NextResponse("Forbidden",{status:403})};
  return {organization:organization.rows[0],person,sites};
}

function scheduleSource(value:unknown):AttendanceScheduleSource{
  const candidate=typeof value==="string"?value:"custom";
  return (ATTENDANCE_SCHEDULE_SOURCES as readonly string[]).includes(candidate)
    ? candidate as AttendanceScheduleSource
    : "custom";
}

function schedulePayload(body:any,timezone:string){
  const effectiveFrom=validIsoDate(body?.effectiveFrom);
  const effectiveUntil=body?.effectiveUntil?validIsoDate(body.effectiveUntil):null;
  const baseSiteId=typeof body?.baseSiteId==="string"?body.baseSiteId:"";
  const source=scheduleSource(body?.sourceType);
  const sourceSiteId=source==="site"&&typeof body?.sourceSiteId==="string"?body.sourceSiteId:"";
  const notes=typeof body?.notes==="string"?body.notes.trim().slice(0,1000):"";
  const hours=normalizeAttendanceSchedule(body?.schedule);
  if(!effectiveFrom)throw new Error("effective-date");
  if(body?.effectiveUntil&&!effectiveUntil)throw new Error("effective-date");
  if(effectiveUntil&&effectiveUntil<effectiveFrom)throw new Error("effective-date");
  return {effectiveFrom,effectiveUntil,baseSiteId,source,sourceSiteId,notes,hours,timezone};
}

function validateSiteScope(
  session:AuthSession,
  person:TargetUser,
  allowedSites:ScheduleSite[],
  baseSiteId:string,
  source:AttendanceScheduleSource,
  sourceSiteId:string,
){
  if(!UUID.test(baseSiteId)||!allowedSites.some(site=>site.id===baseSiteId))return "La sede base no está autorizada para esta persona y supervisor.";
  if(!canAccessSite(session,baseSiteId))return "La sede base está fuera de tu alcance.";
  if(source==="site"){
    if(!UUID.test(sourceSiteId)||!allowedSites.some(site=>site.id===sourceSiteId))return "La sede usada como plantilla no está autorizada.";
    if(!person.access_all_sites&&!person.site_ids.includes(sourceSiteId))return "La persona no tiene acceso a la sede usada como plantilla.";
  }
  return null;
}

async function audit(
  client:PoolClient,
  session:AuthSession,
  organizationId:string,
  action:string,
  scheduleId:string,
  metadata:Record<string,unknown>,
){
  await client.query(
    `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
     VALUES($1,$2,$3,'user_attendance_schedule',$4,$5::jsonb)`,
    [organizationId,session.userId,action,scheduleId,JSON.stringify({
      ...metadata,
      actor_platform_role:session.platformRole,
      actor_email:session.email,
    })],
  );
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const url=new URL(request.url);
  const organizationId=attendanceOrganizationId(session,url.searchParams.get("organization_id"));
  const userId=url.searchParams.get("user_id")||"";
  if(!organizationId||!UUID.test(userId))return NextResponse.json({message:"Empresa o usuario inválido."},{status:422});

  const client=await pool.connect();
  try{
    const context=await loadContext(client,session,organizationId,userId);
    if("error" in context)return context.error;
    const {organization,person,sites}=context;

    const schedules=await client.query<AttendanceScheduleRecord>(
      `SELECT uas.id,uas.organization_id,uas.user_id,uas.base_site_id,base.name base_site_name,
              uas.schedule_source,uas.source_site_id,source.name source_site_name,
              uas.business_schedule,uas.timezone,uas.effective_from::text,uas.effective_until::text,
              uas.notes,uas.created_at::text,uas.updated_at::text
       FROM user_attendance_schedules uas
       JOIN sites base ON base.id=uas.base_site_id
       LEFT JOIN sites source ON source.id=uas.source_site_id
       WHERE uas.organization_id=$1 AND uas.user_id=$2
       ORDER BY uas.effective_from DESC,uas.created_at DESC`,
      [organizationId,userId],
    );

    const allowedSiteIds=new Set(sites.map(site=>site.id));
    const visibleSchedules=schedules.rows.filter(item=>session.platformRole!=="user"||session.accessAllSites||allowedSiteIds.has(item.base_site_id));

    return NextResponse.json({
      user:{id:person.id,fullName:person.full_name,role:person.role},
      organization:{
        id:organization.id,
        name:organization.name,
        timezone:organization.timezone,
        schedule:normalizeBusinessHoursRow(organization).schedule,
      },
      sites:sites.map(site=>({
        id:site.id,
        name:site.name,
        schedule:normalizeBusinessHoursRow(site).schedule,
      })),
      today:organizationLocalDate(organization.timezone),
      schedules:visibleSchedules,
      hiddenScheduleCount:schedules.rowCount-visibleSchedules.length,
    });
  }finally{
    client.release();
  }
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});
  const body=await request.json().catch(()=>null) as any;
  const organizationId=attendanceOrganizationId(session,body?.organizationId);
  const userId=typeof body?.userId==="string"?body.userId:"";
  if(!organizationId||!UUID.test(userId))return NextResponse.json({message:"Empresa o usuario inválido."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const context=await loadContext(client,session,organizationId,userId);
    if("error" in context){await client.query("ROLLBACK");return context.error;}
    const {organization,person,sites}=context;
    let payload;
    try{payload=schedulePayload(body,organization.timezone);}
    catch{
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Revisa la vigencia y el horario semanal."},{status:422});
    }
    const today=organizationLocalDate(organization.timezone);
    if(payload.effectiveFrom<today){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Una nueva vigencia no puede iniciar en una fecha pasada. El historial de jornada se conserva como evidencia."},{status:422});
    }
    const siteError=validateSiteScope(session,person,sites,payload.baseSiteId,payload.source,payload.sourceSiteId);
    if(siteError){await client.query("ROLLBACK");return NextResponse.json({message:siteError},{status:422});}

    const existing=await client.query<{id:string;effective_from:string;effective_until:string|null}>(
      `SELECT id,effective_from::text,effective_until::text
       FROM user_attendance_schedules
       WHERE organization_id=$1 AND user_id=$2
       ORDER BY effective_from
       FOR UPDATE`,
      [organizationId,userId],
    );

    const overlaps=existing.rows.filter(row=>rangesOverlap(
      row.effective_from,row.effective_until,payload.effectiveFrom,payload.effectiveUntil,
    ));
    const replaceable=overlaps.filter(row=>row.effective_from<payload.effectiveFrom);
    if(replaceable.length===1){
      const prior=replaceable[0];
      await client.query(
        "UPDATE user_attendance_schedules SET effective_until=$1::date,updated_by=$2,updated_at=now() WHERE id=$3",
        [previousDate(payload.effectiveFrom),session.userId,prior.id],
      );
    }
    const remaining=overlaps.filter(row=>!replaceable.some(item=>item.id===row.id));
    if(remaining.length){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La vigencia se cruza con otro horario programado. Ajusta las fechas o edita la vigencia futura existente."},{status:409});
    }

    const inserted=await client.query<{id:string}>(
      `INSERT INTO user_attendance_schedules(
         organization_id,user_id,base_site_id,schedule_source,source_site_id,business_schedule,
         timezone,effective_from,effective_until,notes,created_by,updated_by
       ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::date,$9::date,$10,$11,$11)
       RETURNING id`,
      [
        organizationId,userId,payload.baseSiteId,payload.source,payload.source==="site"?payload.sourceSiteId:null,
        JSON.stringify(payload.hours.schedule),payload.timezone,payload.effectiveFrom,payload.effectiveUntil,
        payload.notes||null,session.userId,
      ],
    );
    const id=inserted.rows[0].id;
    await audit(client,session,organizationId,"attendance_schedule_created",id,{
      user_id:userId,
      base_site_id:payload.baseSiteId,
      source:payload.source,
      source_site_id:payload.source==="site"?payload.sourceSiteId:null,
      effective_from:payload.effectiveFrom,
      effective_until:payload.effectiveUntil,
      replaced_schedule_id:replaceable[0]?.id||null,
    });
    await client.query("COMMIT");
    return NextResponse.json({id,message:"Jornada individual guardada."},{status:201});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}

export async function PATCH(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});
  const body=await request.json().catch(()=>null) as any;
  const organizationId=attendanceOrganizationId(session,body?.organizationId);
  const userId=typeof body?.userId==="string"?body.userId:"";
  const scheduleId=typeof body?.scheduleId==="string"?body.scheduleId:"";
  if(!organizationId||!UUID.test(userId)||!UUID.test(scheduleId))return NextResponse.json({message:"Empresa, usuario o jornada inválida."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const context=await loadContext(client,session,organizationId,userId);
    if("error" in context){await client.query("ROLLBACK");return context.error;}
    const {organization,person,sites}=context;
    let payload;
    try{payload=schedulePayload(body,organization.timezone);}
    catch{
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Revisa la vigencia y el horario semanal."},{status:422});
    }
    const today=organizationLocalDate(organization.timezone);
    if(payload.effectiveFrom<today){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Las vigencias que ya comenzaron se conservan como evidencia. Crea una nueva vigencia para cambiar el horario."},{status:409});
    }
    const siteError=validateSiteScope(session,person,sites,payload.baseSiteId,payload.source,payload.sourceSiteId);
    if(siteError){await client.query("ROLLBACK");return NextResponse.json({message:siteError},{status:422});}

    const target=await client.query<{effective_from:string}>(
      `SELECT effective_from::text FROM user_attendance_schedules
       WHERE id=$1 AND organization_id=$2 AND user_id=$3 FOR UPDATE`,
      [scheduleId,organizationId,userId],
    );
    if(!target.rowCount){await client.query("ROLLBACK");return NextResponse.json({message:"La vigencia no existe."},{status:404});}
    if(target.rows[0].effective_from<today){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Esta vigencia ya inició y no se edita retroactivamente. Crea una nueva vigencia."},{status:409});
    }

    const others=await client.query<{id:string;effective_from:string;effective_until:string|null}>(
      `SELECT id,effective_from::text,effective_until::text
       FROM user_attendance_schedules
       WHERE organization_id=$1 AND user_id=$2 AND id<>$3
       FOR UPDATE`,
      [organizationId,userId,scheduleId],
    );
    if(others.rows.some(row=>rangesOverlap(row.effective_from,row.effective_until,payload.effectiveFrom,payload.effectiveUntil))){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La vigencia se cruza con otro horario programado."},{status:409});
    }

    await client.query(
      `UPDATE user_attendance_schedules SET
         base_site_id=$1,schedule_source=$2,source_site_id=$3,business_schedule=$4::jsonb,
         timezone=$5,effective_from=$6::date,effective_until=$7::date,notes=$8,
         updated_by=$9,updated_at=now()
       WHERE id=$10`,
      [
        payload.baseSiteId,payload.source,payload.source==="site"?payload.sourceSiteId:null,
        JSON.stringify(payload.hours.schedule),payload.timezone,payload.effectiveFrom,payload.effectiveUntil,
        payload.notes||null,session.userId,scheduleId,
      ],
    );
    await audit(client,session,organizationId,"attendance_schedule_updated",scheduleId,{
      user_id:userId,
      base_site_id:payload.baseSiteId,
      source:payload.source,
      effective_from:payload.effectiveFrom,
      effective_until:payload.effectiveUntil,
    });
    await client.query("COMMIT");
    return NextResponse.json({id:scheduleId,message:"Jornada futura actualizada."});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}

export async function DELETE(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});
  const body=await request.json().catch(()=>null) as any;
  const organizationId=attendanceOrganizationId(session,body?.organizationId);
  const userId=typeof body?.userId==="string"?body.userId:"";
  const scheduleId=typeof body?.scheduleId==="string"?body.scheduleId:"";
  if(!organizationId||!UUID.test(userId)||!UUID.test(scheduleId))return NextResponse.json({message:"Empresa, usuario o jornada inválida."},{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const context=await loadContext(client,session,organizationId,userId);
    if("error" in context){await client.query("ROLLBACK");return context.error;}
    const today=organizationLocalDate(context.organization.timezone);
    const target=await client.query<{effective_from:string}>(
      `SELECT effective_from::text FROM user_attendance_schedules
       WHERE id=$1 AND organization_id=$2 AND user_id=$3 FOR UPDATE`,
      [scheduleId,organizationId,userId],
    );
    if(!target.rowCount){await client.query("ROLLBACK");return NextResponse.json({message:"La vigencia no existe."},{status:404});}
    if(target.rows[0].effective_from<=today){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Solo una vigencia futura puede eliminarse. Las jornadas iniciadas permanecen como historial."},{status:409});
    }
    await client.query("DELETE FROM user_attendance_schedules WHERE id=$1",[scheduleId]);
    await audit(client,session,organizationId,"attendance_schedule_deleted",scheduleId,{user_id:userId,effective_from:target.rows[0].effective_from});
    await client.query("COMMIT");
    return NextResponse.json({deleted:true,message:"Vigencia futura eliminada."});
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
