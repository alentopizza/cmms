import type { AuthSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { scheduleDayForDate, validIsoDate } from "@/lib/attendance-schedules";
import type { BusinessDaySchedule } from "@/lib/business-hours";

const MAX_REPORT_DAYS=366;
const ATTENDANCE_ROLES=["admin","manager","technician","provider","external"];

type PersonRow={
  id:string;
  full_name:string;
  role:string;
};

type SiteRow={id:string;name:string};

type ScheduleRow={
  id:string;
  user_id:string;
  base_site_id:string;
  base_site_name:string;
  business_schedule:BusinessDaySchedule[];
  timezone:string;
  effective_from:string;
  effective_until:string|null;
};

type ShiftRow={
  id:string;
  user_id:string;
  local_date:string;
  origin_site_id:string;
  origin_site_name:string;
  final_site_id:string|null;
  final_site_name:string|null;
  status:"open"|"closed";
  check_in_at:string;
  check_out_at:string|null;
  check_in_verification_mode:"standard"|"contingency";
  check_out_verification_mode:"standard"|"contingency"|null;
  actual_minutes:string;
};

type SegmentRow={
  id:string;
  attendance_shift_id:string;
  segment_type:"site"|"travel";
  site_id:string|null;
  site_name:string|null;
  from_site_id:string|null;
  from_site_name:string|null;
  to_site_id:string|null;
  to_site_name:string|null;
  started_at:string;
  ended_at:string|null;
  duration_minutes:string;
  reaction_sample_count:number;
};

type ActivityRow={
  user_id:string;
  local_date:string;
  attendance_shift_id:string|null;
  within_shift:boolean;
};

type ContingencyRow={
  user_id:string;
  local_date:string;
  status:string;
};

export type AttendanceReportFilters={
  organizationId:string;
  from:string;
  to:string;
  userId:string|null;
  siteId:string|null;
};

export type AttendanceReportDailyRow={
  id:string;
  date:string;
  userId:string;
  fullName:string;
  role:string;
  scheduleState:"scheduled"|"day_off"|"none";
  plannedSiteId:string|null;
  plannedSiteName:string|null;
  scheduledStart:string|null;
  scheduledEnd:string|null;
  scheduledMinutes:number|null;
  actualMinutes:number;
  scheduledDayActualMinutes:number;
  varianceMinutes:number|null;
  onSiteMinutes:number;
  travelMinutes:number;
  travelCount:number;
  shiftCount:number;
  multiSiteShiftCount:number;
  originSites:string[];
  finalSites:string[];
  visitedSites:string[];
  completedInShift:number;
  completedOutsideShift:number;
  contingencyRequests:number;
  contingencyUsed:number;
  contingencyMarkings:number;
  reactionSamples:number;
  openNow:boolean;
};

export type AttendanceReportPersonRow={
  userId:string;
  fullName:string;
  role:string;
  scheduledDays:number;
  daysWithAttendance:number;
  scheduledDaysWithoutAttendance:number;
  daysWithUnplannedAttendance:number;
  scheduledMinutes:number;
  scheduledDayActualMinutes:number;
  actualMinutes:number;
  varianceMinutes:number;
  unplannedMinutes:number;
  onSiteMinutes:number;
  travelMinutes:number;
  shifts:number;
  multiSiteShifts:number;
  travelCount:number;
  completedInShift:number;
  completedOutsideShift:number;
  contingencyRequests:number;
  contingencyUsed:number;
  contingencyMarkings:number;
  reactionSamples:number;
};

export type AttendanceOperationalReport={
  filters:AttendanceReportFilters;
  organization:{id:string;name:string;timezone:string};
  scope:{limited:boolean;siteIds:string[]};
  summary:{
    people:number;
    scheduledDays:number;
    daysWithAttendance:number;
    scheduledDaysWithoutAttendance:number;
    daysWithUnplannedAttendance:number;
    scheduledMinutes:number;
    scheduledDayActualMinutes:number;
    actualMinutes:number;
    varianceMinutes:number;
    unplannedMinutes:number;
    onSiteMinutes:number;
    travelMinutes:number;
    shifts:number;
    multiSiteShifts:number;
    travelCount:number;
    completedInShift:number;
    completedOutsideShift:number;
    contingencyRequests:number;
    contingencyUsed:number;
    contingencyMarkings:number;
    reactionSamples:number;
  };
  people:AttendanceReportPersonRow[];
  daily:AttendanceReportDailyRow[];
  options:{
    people:Array<{id:string;name:string;role:string}>;
    sites:Array<{id:string;name:string}>;
  };
};

export class AttendanceReportError extends Error{
  status:number;
  constructor(status:number,message:string){
    super(message);
    this.name="AttendanceReportError";
    this.status=status;
  }
}

function dayMinutes(openTime:string,closeTime:string){
  const [openHour,openMinute]=openTime.split(":").map(Number);
  const [closeHour,closeMinute]=closeTime.split(":").map(Number);
  return Math.max(0,(closeHour*60+closeMinute)-(openHour*60+openMinute));
}

function isoAddDays(date:string,amount:number){
  const parsed=new Date(date+"T12:00:00Z");
  parsed.setUTCDate(parsed.getUTCDate()+amount);
  return parsed.toISOString().slice(0,10);
}

function daysBetweenInclusive(from:string,to:string){
  const start=new Date(from+"T12:00:00Z").getTime();
  const end=new Date(to+"T12:00:00Z").getTime();
  return Math.floor((end-start)/86400000)+1;
}

function rangeDates(from:string,to:string){
  const total=daysBetweenInclusive(from,to);
  return Array.from({length:total},(_,index)=>isoAddDays(from,index));
}

function localDate(timezone:string,at=new Date()){
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:timezone||"America/Bogota",
      year:"numeric",month:"2-digit",day:"2-digit",
    }).formatToParts(at);
    const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }catch{
    return at.toISOString().slice(0,10);
  }
}

function unique(values:Array<string|null|undefined>){
  return [...new Set(values.filter((value):value is string=>Boolean(value)))];
}

function number(value:string|number|null|undefined){
  const parsed=Number(value||0);
  return Number.isFinite(parsed)?parsed:0;
}

function scopeFor(session:AuthSession){
  const all=session.platformRole!=="user"||session.accessAllSites;
  return {all,siteIds:all?[]:session.siteIds};
}

function activeSchedule(schedules:ScheduleRow[],date:string){
  return schedules
    .filter(item=>item.effective_from<=date&&(!item.effective_until||item.effective_until>=date))
    .sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0]||null;
}

function reportDates(rawFrom:string|null|undefined,rawTo:string|null|undefined,timezone:string){
  const today=localDate(timezone);
  const to=validIsoDate(rawTo)||today;
  const from=validIsoDate(rawFrom)||isoAddDays(to,-29);
  if(from>to)throw new AttendanceReportError(422,"La fecha inicial no puede ser posterior a la fecha final.");
  if(daysBetweenInclusive(from,to)>MAX_REPORT_DAYS){
    throw new AttendanceReportError(422,`El reporte admite un máximo de ${MAX_REPORT_DAYS} días por consulta.`);
  }
  return {from,to};
}

// ── Scoped report composition ───────────────────────────────────────────────
// This is a read model only. It never persists a worker score or denormalized
// report ledger. Organization/Site scope is re-derived from the authenticated
// session and all exports consume this same composed dataset.
export async function buildAttendanceOperationalReport(
  session:AuthSession,
  input:{organizationId:string;from?:string|null;to?:string|null;userId?:string|null;siteId?:string|null},
):Promise<AttendanceOperationalReport>{
  const organizationId=input.organizationId;
  const scope=scopeFor(session);
  const client=await pool.connect();

  try{
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

    const organizationResult=await client.query<{id:string;name:string;timezone:string}>(
      "SELECT id,name,timezone FROM organizations WHERE id=$1 AND active=true",
      [organizationId],
    );
    const organization=organizationResult.rows[0];
    if(!organization)throw new AttendanceReportError(404,"La empresa seleccionada no está disponible.");

    const dates=reportDates(input.from,input.to,organization.timezone);
    const requestedUserId=typeof input.userId==="string"&&input.userId.trim()?input.userId.trim():null;
    const requestedSiteId=typeof input.siteId==="string"&&input.siteId.trim()?input.siteId.trim():null;

    const peopleResult=await client.query<PersonRow>(
      `SELECT u.id,u.full_name,om.role
       FROM organization_members om
       JOIN users u ON u.id=om.user_id
       WHERE om.organization_id=$1
         AND u.active=true
         AND om.role=ANY($2::text[])
         AND (
           $3::boolean
           OR (
             COALESCE(om.access_all_sites,true)=true
             AND cardinality($4::uuid[])>0
           )
           OR EXISTS(
             SELECT 1 FROM organization_member_sites oms
             WHERE oms.organization_id=om.organization_id
               AND oms.user_id=om.user_id
               AND oms.site_id=ANY($4::uuid[])
           )
         )
       ORDER BY u.full_name`,
      [organizationId,ATTENDANCE_ROLES,scope.all,scope.siteIds],
    );

    const sitesResult=await client.query<SiteRow>(
      `SELECT id,name
       FROM sites
       WHERE organization_id=$1 AND active=true
         AND ($2::boolean OR id=ANY($3::uuid[]))
       ORDER BY name`,
      [organizationId,scope.all,scope.siteIds],
    );

    if(requestedSiteId&&!sitesResult.rows.some(site=>site.id===requestedSiteId)){
      throw new AttendanceReportError(403,"La sede seleccionada no está dentro de tu alcance.");
    }
    if(requestedUserId&&!peopleResult.rows.some(person=>person.id===requestedUserId)){
      throw new AttendanceReportError(403,"La persona seleccionada no está dentro de tu alcance.");
    }

    const people=requestedUserId
      ?peopleResult.rows.filter(person=>person.id===requestedUserId)
      :peopleResult.rows;
    const userIds=people.map(person=>person.id);

    if(!userIds.length){
      await client.query("COMMIT");
      return {
        filters:{organizationId,from:dates.from,to:dates.to,userId:requestedUserId,siteId:requestedSiteId},
        organization,
        scope:{limited:!scope.all,siteIds:scope.siteIds},
        summary:{
          people:0,scheduledDays:0,daysWithAttendance:0,scheduledDaysWithoutAttendance:0,daysWithUnplannedAttendance:0,
          scheduledMinutes:0,scheduledDayActualMinutes:0,actualMinutes:0,varianceMinutes:0,unplannedMinutes:0,
          onSiteMinutes:0,travelMinutes:0,shifts:0,multiSiteShifts:0,travelCount:0,
          completedInShift:0,completedOutsideShift:0,contingencyRequests:0,contingencyUsed:0,
          contingencyMarkings:0,reactionSamples:0,
        },
        people:[],
        daily:[],
        options:{
          people:peopleResult.rows.map(person=>({id:person.id,name:person.full_name,role:person.role})),
          sites:sitesResult.rows,
        },
      };
    }

    const schedules=await client.query<ScheduleRow>(
      `SELECT schedule.id,schedule.user_id,schedule.base_site_id,site.name base_site_name,
              schedule.business_schedule,schedule.timezone,
              schedule.effective_from::text,schedule.effective_until::text
       FROM user_attendance_schedules schedule
       JOIN sites site ON site.id=schedule.base_site_id
       WHERE schedule.organization_id=$1
         AND schedule.user_id=ANY($2::uuid[])
         AND schedule.effective_from<=$3::date
         AND (schedule.effective_until IS NULL OR schedule.effective_until>=$4::date)
         AND ($5::boolean OR schedule.base_site_id=ANY($6::uuid[]))
       ORDER BY schedule.user_id,schedule.effective_from`,
      [organizationId,userIds,dates.to,dates.from,scope.all,scope.siteIds],
    );

    const shifts=await client.query<ShiftRow>(
      `SELECT shift.id,shift.user_id,
              ((shift.check_in_at AT TIME ZONE $5)::date)::text local_date,
              shift.site_id::text origin_site_id,origin.name origin_site_name,
              shift.check_out_site_id::text final_site_id,final.name final_site_name,
              shift.status,shift.check_in_at::text,shift.check_out_at::text,
              shift.check_in_verification_mode,shift.check_out_verification_mode,
              round(EXTRACT(EPOCH FROM (COALESCE(shift.check_out_at,now())-shift.check_in_at))/60.0::numeric,2)::text actual_minutes
       FROM attendance_shifts shift
       JOIN sites origin ON origin.id=shift.site_id
       LEFT JOIN sites final ON final.id=shift.check_out_site_id
       WHERE shift.organization_id=$1
         AND shift.user_id=ANY($2::uuid[])
         AND shift.check_in_at >= (($3::date)::timestamp AT TIME ZONE $5)
         AND shift.check_in_at < ((($4::date+1)::timestamp) AT TIME ZONE $5)
         AND (
           $6::boolean
           OR (
             shift.site_id=ANY($7::uuid[])
             AND (shift.check_out_site_id IS NULL OR shift.check_out_site_id=ANY($7::uuid[]))
             AND NOT EXISTS(
               SELECT 1
               FROM attendance_shift_segments scoped
               WHERE scoped.attendance_shift_id=shift.id
                 AND (
                   (scoped.segment_type='site' AND NOT (scoped.site_id=ANY($7::uuid[])))
                   OR
                   (scoped.segment_type='travel' AND (
                     NOT (scoped.from_site_id=ANY($7::uuid[]))
                     OR NOT (scoped.to_site_id=ANY($7::uuid[]))
                   ))
                 )
             )
           )
         )
         AND (
           $8::uuid IS NULL
           OR shift.site_id=$8::uuid
           OR shift.check_out_site_id=$8::uuid
           OR EXISTS(
             SELECT 1 FROM attendance_shift_segments related
             WHERE related.attendance_shift_id=shift.id
               AND (
                 related.site_id=$8::uuid
                 OR related.from_site_id=$8::uuid
                 OR related.to_site_id=$8::uuid
               )
           )
         )
       ORDER BY shift.check_in_at`,
      [organizationId,userIds,dates.from,dates.to,organization.timezone,scope.all,scope.siteIds,requestedSiteId],
    );

    const shiftIds=shifts.rows.map(shift=>shift.id);
    const segments=shiftIds.length
      ?await client.query<SegmentRow>(
          `SELECT segment.id::text,segment.attendance_shift_id::text,segment.segment_type,
                  segment.site_id::text,site.name site_name,
                  segment.from_site_id::text,origin.name from_site_name,
                  segment.to_site_id::text,destination.name to_site_name,
                  segment.started_at::text,segment.ended_at::text,
                  round(EXTRACT(EPOCH FROM (COALESCE(segment.ended_at,now())-segment.started_at))/60.0::numeric,2)::text duration_minutes,
                  CASE WHEN segment.segment_type='travel' THEN COALESCE((
                    SELECT count(*)::int
                    FROM technician_location_samples sample
                    WHERE sample.attendance_shift_id=segment.attendance_shift_id
                      AND sample.source='connected_app'
                      AND sample.recorded_at>=segment.started_at
                      AND sample.recorded_at<=COALESCE(segment.ended_at,now())
                  ),0) ELSE 0 END reaction_sample_count
           FROM attendance_shift_segments segment
           LEFT JOIN sites site ON site.id=segment.site_id
           LEFT JOIN sites origin ON origin.id=segment.from_site_id
           LEFT JOIN sites destination ON destination.id=segment.to_site_id
           WHERE segment.attendance_shift_id=ANY($1::uuid[])
           ORDER BY segment.attendance_shift_id,segment.sequence`,
          [shiftIds],
        )
      :{rows:[]} as {rows:SegmentRow[]};

    const activities=await client.query<ActivityRow>(
      `SELECT DISTINCT ON (event.task_id)
              event.user_id,
              ((event.occurred_at AT TIME ZONE $5)::date)::text local_date,
              event.attendance_shift_id::text,
              event.within_shift
       FROM activity_execution_events event
       JOIN work_order_tasks task ON task.id=event.task_id
       JOIN work_orders work_order ON work_order.id=task.work_order_id
       WHERE event.organization_id=$1
         AND event.user_id=ANY($2::uuid[])
         AND event.event_type='completed'
         AND event.occurred_at >= (($3::date)::timestamp AT TIME ZONE $5)
         AND event.occurred_at < ((($4::date+1)::timestamp) AT TIME ZONE $5)
         AND ($6::boolean OR work_order.site_id=ANY($7::uuid[]))
         AND ($8::uuid IS NULL OR work_order.site_id=$8::uuid)
       ORDER BY event.task_id,event.occurred_at DESC`,
      [organizationId,userIds,dates.from,dates.to,organization.timezone,scope.all,scope.siteIds,requestedSiteId],
    );

    const contingencies=await client.query<ContingencyRow>(
      `SELECT request.user_id,
              ((request.requested_at AT TIME ZONE $5)::date)::text local_date,
              request.status
       FROM attendance_contingency_requests request
       WHERE request.organization_id=$1
         AND request.user_id=ANY($2::uuid[])
         AND request.requested_at >= (($3::date)::timestamp AT TIME ZONE $5)
         AND request.requested_at < ((($4::date+1)::timestamp) AT TIME ZONE $5)
         AND ($6::boolean OR request.site_id=ANY($7::uuid[]))
         AND ($8::uuid IS NULL OR request.site_id=$8::uuid)
       ORDER BY request.requested_at`,
      [organizationId,userIds,dates.from,dates.to,organization.timezone,scope.all,scope.siteIds,requestedSiteId],
    );

    const schedulesByUser=new Map<string,ScheduleRow[]>();
    for(const row of schedules.rows)(schedulesByUser.get(row.user_id)||schedulesByUser.set(row.user_id,[]).get(row.user_id)!).push(row);

    const shiftsByUserDate=new Map<string,ShiftRow[]>();
    for(const row of shifts.rows){
      const key=row.user_id+"|"+row.local_date;
      (shiftsByUserDate.get(key)||shiftsByUserDate.set(key,[]).get(key)!).push(row);
    }

    const segmentsByShift=new Map<string,SegmentRow[]>();
    for(const row of segments.rows)(segmentsByShift.get(row.attendance_shift_id)||segmentsByShift.set(row.attendance_shift_id,[]).get(row.attendance_shift_id)!).push(row);

    const activitiesByUserDate=new Map<string,{inside:number;outside:number}>();
    for(const row of activities.rows){
      const key=row.user_id+"|"+row.local_date;
      const current=activitiesByUserDate.get(key)||{inside:0,outside:0};
      if(row.within_shift)current.inside+=1;else current.outside+=1;
      activitiesByUserDate.set(key,current);
    }

    const contingenciesByUserDate=new Map<string,{requests:number;used:number}>();
    for(const row of contingencies.rows){
      const key=row.user_id+"|"+row.local_date;
      const current=contingenciesByUserDate.get(key)||{requests:0,used:0};
      current.requests+=1;
      if(row.status==="used")current.used+=1;
      contingenciesByUserDate.set(key,current);
    }

    const daily:AttendanceReportDailyRow[]=[];
    const datesInRange=rangeDates(dates.from,dates.to);

    for(const person of people){
      const personSchedules=schedulesByUser.get(person.id)||[];

      for(const date of datesInRange){
        const schedule=activeSchedule(personSchedules,date);
        const scheduledDay=schedule?scheduleDayForDate(schedule.business_schedule,date):null;
        const scheduleState:AttendanceReportDailyRow["scheduleState"]=schedule
          ?scheduledDay?.enabled?"scheduled":"day_off"
          :"none";
        const scheduledMinutes=scheduleState==="scheduled"&&scheduledDay
          ?dayMinutes(scheduledDay.openTime,scheduledDay.closeTime)
          :scheduleState==="none"?null:0;

        const key=person.id+"|"+date;
        const dayShifts=shiftsByUserDate.get(key)||[];
        const activity=activitiesByUserDate.get(key)||{inside:0,outside:0};
        const contingency=contingenciesByUserDate.get(key)||{requests:0,used:0};

        let actualMinutes=0;
        let onSiteMinutes=0;
        let travelMinutes=0;
        let travelCount=0;
        let multiSiteShiftCount=0;
        let reactionSamples=0;
        let contingencyMarkings=0;
        const originSites:string[]=[];
        const finalSites:string[]=[];
        const visitedSites:string[]=[];

        for(const shift of dayShifts){
          actualMinutes+=number(shift.actual_minutes);
          originSites.push(shift.origin_site_name);
          finalSites.push(shift.final_site_name||shift.origin_site_name);
          if(shift.check_in_verification_mode==="contingency")contingencyMarkings+=1;
          if(shift.check_out_verification_mode==="contingency")contingencyMarkings+=1;

          const shiftSegments=segmentsByShift.get(shift.id)||[];
          const siteIds=unique([
            shift.origin_site_id,
            shift.final_site_id,
            ...shiftSegments.flatMap(segment=>[segment.site_id,segment.from_site_id,segment.to_site_id]),
          ]);
          if(siteIds.length>1)multiSiteShiftCount+=1;

          for(const segment of shiftSegments){
            const duration=number(segment.duration_minutes);
            if(segment.segment_type==="travel"){
              travelMinutes+=duration;
              travelCount+=1;
              reactionSamples+=Number(segment.reaction_sample_count||0);
              if(segment.from_site_name)visitedSites.push(segment.from_site_name);
              if(segment.to_site_name)visitedSites.push(segment.to_site_name);
            }else{
              onSiteMinutes+=duration;
              if(segment.site_name)visitedSites.push(segment.site_name);
            }
          }
        }

        const siteRelated=!requestedSiteId
          || schedule?.base_site_id===requestedSiteId
          || dayShifts.length>0
          || activity.inside+activity.outside>0
          || contingency.requests>0;
        const hasEvidence=dayShifts.length>0||activity.inside+activity.outside>0||contingency.requests>0;
        const plannedVisible=scheduleState==="scheduled"&&siteRelated;
        if(!siteRelated||(!plannedVisible&&!hasEvidence))continue;

        daily.push({
          id:person.id+"-"+date,
          date,
          userId:person.id,
          fullName:person.full_name,
          role:person.role,
          scheduleState,
          plannedSiteId:schedule?.base_site_id||null,
          plannedSiteName:schedule?.base_site_name||null,
          scheduledStart:scheduledDay?.enabled?scheduledDay.openTime:null,
          scheduledEnd:scheduledDay?.enabled?scheduledDay.closeTime:null,
          scheduledMinutes,
          actualMinutes,
          scheduledDayActualMinutes:scheduleState==="scheduled"?actualMinutes:0,
          varianceMinutes:scheduleState==="scheduled"&&scheduledMinutes!==null?actualMinutes-scheduledMinutes:null,
          onSiteMinutes,
          travelMinutes,
          travelCount,
          shiftCount:dayShifts.length,
          multiSiteShiftCount,
          originSites:unique(originSites),
          finalSites:unique(finalSites),
          visitedSites:unique(visitedSites),
          completedInShift:activity.inside,
          completedOutsideShift:activity.outside,
          contingencyRequests:contingency.requests,
          contingencyUsed:contingency.used,
          contingencyMarkings,
          reactionSamples,
          openNow:dayShifts.some(shift=>shift.status==="open"),
        });
      }
    }

    daily.sort((left,right)=>right.date.localeCompare(left.date)||left.fullName.localeCompare(right.fullName,"es"));

    const personRows:AttendanceReportPersonRow[]=people.map(person=>{
      const rows=daily.filter(row=>row.userId===person.id);
      const scheduledRows=rows.filter(row=>row.scheduleState==="scheduled");
      const attendedRows=rows.filter(row=>row.actualMinutes>0);
      const scheduledMinutes=scheduledRows.reduce((sum,row)=>sum+number(row.scheduledMinutes),0);
      const scheduledDayActualMinutes=scheduledRows.reduce((sum,row)=>sum+row.actualMinutes,0);
      const actualMinutes=rows.reduce((sum,row)=>sum+row.actualMinutes,0);
      return {
        userId:person.id,
        fullName:person.full_name,
        role:person.role,
        scheduledDays:scheduledRows.length,
        daysWithAttendance:attendedRows.length,
        scheduledDaysWithoutAttendance:scheduledRows.filter(row=>row.actualMinutes<=0).length,
        daysWithUnplannedAttendance:rows.filter(row=>row.actualMinutes>0&&row.scheduleState!=="scheduled").length,
        scheduledMinutes,
        scheduledDayActualMinutes,
        actualMinutes,
        varianceMinutes:scheduledDayActualMinutes-scheduledMinutes,
        unplannedMinutes:rows.filter(row=>row.scheduleState!=="scheduled").reduce((sum,row)=>sum+row.actualMinutes,0),
        onSiteMinutes:rows.reduce((sum,row)=>sum+row.onSiteMinutes,0),
        travelMinutes:rows.reduce((sum,row)=>sum+row.travelMinutes,0),
        shifts:rows.reduce((sum,row)=>sum+row.shiftCount,0),
        multiSiteShifts:rows.reduce((sum,row)=>sum+row.multiSiteShiftCount,0),
        travelCount:rows.reduce((sum,row)=>sum+row.travelCount,0),
        completedInShift:rows.reduce((sum,row)=>sum+row.completedInShift,0),
        completedOutsideShift:rows.reduce((sum,row)=>sum+row.completedOutsideShift,0),
        contingencyRequests:rows.reduce((sum,row)=>sum+row.contingencyRequests,0),
        contingencyUsed:rows.reduce((sum,row)=>sum+row.contingencyUsed,0),
        contingencyMarkings:rows.reduce((sum,row)=>sum+row.contingencyMarkings,0),
        reactionSamples:rows.reduce((sum,row)=>sum+row.reactionSamples,0),
      };
    }).filter(row=>
      row.scheduledDays>0||row.daysWithAttendance>0||row.completedInShift>0||row.completedOutsideShift>0||row.contingencyRequests>0
    );

    personRows.sort((left,right)=>left.fullName.localeCompare(right.fullName,"es"));

    const summary=personRows.reduce<AttendanceOperationalReport["summary"]>((total,row)=>({
      people:total.people+1,
      scheduledDays:total.scheduledDays+row.scheduledDays,
      daysWithAttendance:total.daysWithAttendance+row.daysWithAttendance,
      scheduledDaysWithoutAttendance:total.scheduledDaysWithoutAttendance+row.scheduledDaysWithoutAttendance,
      daysWithUnplannedAttendance:total.daysWithUnplannedAttendance+row.daysWithUnplannedAttendance,
      scheduledMinutes:total.scheduledMinutes+row.scheduledMinutes,
      scheduledDayActualMinutes:total.scheduledDayActualMinutes+row.scheduledDayActualMinutes,
      actualMinutes:total.actualMinutes+row.actualMinutes,
      varianceMinutes:total.varianceMinutes+row.varianceMinutes,
      unplannedMinutes:total.unplannedMinutes+row.unplannedMinutes,
      onSiteMinutes:total.onSiteMinutes+row.onSiteMinutes,
      travelMinutes:total.travelMinutes+row.travelMinutes,
      shifts:total.shifts+row.shifts,
      multiSiteShifts:total.multiSiteShifts+row.multiSiteShifts,
      travelCount:total.travelCount+row.travelCount,
      completedInShift:total.completedInShift+row.completedInShift,
      completedOutsideShift:total.completedOutsideShift+row.completedOutsideShift,
      contingencyRequests:total.contingencyRequests+row.contingencyRequests,
      contingencyUsed:total.contingencyUsed+row.contingencyUsed,
      contingencyMarkings:total.contingencyMarkings+row.contingencyMarkings,
      reactionSamples:total.reactionSamples+row.reactionSamples,
    }),{
      people:0,scheduledDays:0,daysWithAttendance:0,scheduledDaysWithoutAttendance:0,daysWithUnplannedAttendance:0,
      scheduledMinutes:0,scheduledDayActualMinutes:0,actualMinutes:0,varianceMinutes:0,unplannedMinutes:0,
      onSiteMinutes:0,travelMinutes:0,shifts:0,multiSiteShifts:0,travelCount:0,
      completedInShift:0,completedOutsideShift:0,contingencyRequests:0,contingencyUsed:0,
      contingencyMarkings:0,reactionSamples:0,
    });

    await client.query("COMMIT");

    return {
      filters:{organizationId,from:dates.from,to:dates.to,userId:requestedUserId,siteId:requestedSiteId},
      organization,
      scope:{limited:!scope.all,siteIds:scope.siteIds},
      summary,
      people:personRows,
      daily,
      options:{
        people:peopleResult.rows.map(person=>({id:person.id,name:person.full_name,role:person.role})),
        sites:sitesResult.rows,
      },
    };
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}
