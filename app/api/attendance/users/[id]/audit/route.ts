import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getSession, type AuthSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { attendanceOrganizationId } from "@/lib/attendance-context";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIODS=new Map([["30",30],["90",90],["365",365],["all",null]] as const);
const AUDIT_ROLES=new Set(["admin","manager","technician","provider","external"]);

type TargetUser={
  id:string;
  full_name:string;
  email:string;
  role:string;
  access_all_sites:boolean;
  site_ids:string[];
  organization_name:string;
  timezone:string;
};

function siteScope(session:AuthSession){
  return session.platformRole!=="user"||session.accessAllSites?null:session.siteIds;
}

async function loadTarget(client:PoolClient,organizationId:string,userId:string){
  return client.query<TargetUser>(
    `SELECT u.id,u.full_name,u.email,om.role,COALESCE(om.access_all_sites,true) access_all_sites,
            COALESCE((
              SELECT array_agg(oms.site_id::text ORDER BY oms.site_id::text)
              FROM organization_member_sites oms
              WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
            ),ARRAY[]::text[]) site_ids,
            o.name organization_name,o.timezone
     FROM organization_members om
     JOIN users u ON u.id=om.user_id
     JOIN organizations o ON o.id=om.organization_id
     WHERE om.organization_id=$1 AND om.user_id=$2 AND u.active=true AND o.active=true`,
    [organizationId,userId],
  );
}

function targetVisibleInScope(person:TargetUser,scope:string[]|null){
  if(scope===null)return true;
  if(person.access_all_sites)return scope.length>0;
  const target=new Set(person.site_ids);
  return scope.some(siteId=>target.has(siteId));
}

function periodDays(value:string|null){
  return PERIODS.has(value as "30"|"90"|"365"|"all")
    ? PERIODS.get(value as "30"|"90"|"365"|"all") ?? null
    : 90;
}

// ── Consolidated per-user attendance evidence ───────────────────────────────
// This endpoint is read-only. It composes existing authoritative records and
// never turns browser filters into authorization. Organization and Site scope
// are re-derived from the authenticated session on every request.
export async function GET(
  request:Request,
  {params}:{params:Promise<{id:string}>},
){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const {id:userId}=await params;
  if(!UUID.test(userId))return NextResponse.json({message:"Usuario inválido."},{status:422});

  const url=new URL(request.url);
  const organizationId=attendanceOrganizationId(session,url.searchParams.get("organization_id"));
  if(!organizationId)return NextResponse.json({message:"Selecciona una empresa válida."},{status:422});
  const days=periodDays(url.searchParams.get("period"));
  const scope=siteScope(session);

  const client=await pool.connect();
  try{
    const personResult=await loadTarget(client,organizationId,userId);
    if(!personResult.rowCount)return NextResponse.json({message:"El usuario no pertenece a esta empresa."},{status:404});
    const person=personResult.rows[0];
    if(!AUDIT_ROLES.has(person.role))return NextResponse.json({message:"El rol de este usuario no utiliza control de asistencia."},{status:422});
    if(!targetVisibleInScope(person,scope))return new NextResponse("Forbidden",{status:403});

    const paramsBase=[organizationId,userId,days,scope] as const;

    // Each source remains authoritative on its own. The API only composes a
    // scoped dossier and intentionally does not persist aggregate audit state.
    const [
      summary,
      shifts,
      segments,
      biometricProfile,
      biometricEvents,
      contingencies,
      schedules,
      scheduleAudit,
    ]=await Promise.all([
      client.query<{
        shifts:number;
        field_hours:string;
        standard_check_ins:number;
        contingency_check_ins:number;
        open_now:boolean;
        completed_activities:number;
        contingencies:number;
        travels:number;
      }>(
        `SELECT
           count(*)::int shifts,
           round(COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(s.check_out_at,now())-s.check_in_at))),0)/3600.0::numeric,2)::text field_hours,
           count(*) FILTER (WHERE s.check_in_verification_mode='standard')::int standard_check_ins,
           count(*) FILTER (WHERE s.check_in_verification_mode='contingency')::int contingency_check_ins,
           COALESCE(bool_or(s.status='open'),false) open_now,
           COALESCE((
             SELECT count(*)::int
             FROM activity_execution_events e
             JOIN work_order_tasks task ON task.id=e.task_id
             JOIN work_orders work_order ON work_order.id=task.work_order_id
             WHERE e.organization_id=$1 AND e.user_id=$2 AND e.event_type='completed'
               AND ($3::int IS NULL OR e.occurred_at>=now()-($3::int*interval '1 day'))
               AND ($4::uuid[] IS NULL OR work_order.site_id=ANY($4::uuid[]))
           ),0)::int completed_activities,
           COALESCE((
             SELECT count(*)::int
             FROM attendance_contingency_requests c
             WHERE c.organization_id=$1 AND c.user_id=$2
               AND ($3::int IS NULL OR c.requested_at>=now()-($3::int*interval '1 day'))
               AND ($4::uuid[] IS NULL OR c.site_id=ANY($4::uuid[]))
           ),0)::int contingencies,
           COALESCE((
             SELECT count(*)::int
             FROM attendance_shift_segments segment
             WHERE segment.organization_id=$1 AND segment.user_id=$2
               AND segment.segment_type='travel'
               AND ($3::int IS NULL OR segment.started_at>=now()-($3::int*interval '1 day'))
               AND (
                 $4::uuid[] IS NULL
                 OR (segment.from_site_id=ANY($4::uuid[]) AND segment.to_site_id=ANY($4::uuid[]))
               )
           ),0)::int travels
         FROM attendance_shifts s
         WHERE s.organization_id=$1 AND s.user_id=$2
           AND ($3::int IS NULL OR s.check_in_at>=now()-($3::int*interval '1 day'))
           AND ($4::uuid[] IS NULL OR s.site_id=ANY($4::uuid[]))`,
        [...paramsBase],
      ),
      client.query(
        `SELECT s.id,s.site_id,site.name site_name,s.status,
                s.check_in_at::text,s.check_out_at::text,
                s.check_in_verification_mode,s.check_out_verification_mode,
                s.check_in_accuracy_m,s.check_out_accuracy_m,
                s.check_in_distance_m,s.check_out_distance_m,
                s.check_in_contingency_id,s.check_out_contingency_id,
                CASE WHEN $4::uuid[] IS NULL OR s.check_out_site_id IS NULL OR s.check_out_site_id=ANY($4::uuid[])
                     THEN checkout_site.name ELSE NULL END check_out_site_name,
                round(EXTRACT(EPOCH FROM (COALESCE(s.check_out_at,now())-s.check_in_at))/60.0::numeric,1)::text duration_minutes,
                COALESCE((
                  SELECT count(*)::int
                  FROM activity_execution_events e
                  JOIN work_order_tasks task ON task.id=e.task_id
                  JOIN work_orders work_order ON work_order.id=task.work_order_id
                  WHERE e.attendance_shift_id=s.id AND e.event_type='completed'
                    AND ($4::uuid[] IS NULL OR work_order.site_id=ANY($4::uuid[]))
                ),0)::int completed_activities,
                COALESCE((
                  SELECT count(*)::int FROM attendance_shift_segments travel
                  WHERE travel.attendance_shift_id=s.id AND travel.segment_type='travel'
                    AND ($4::uuid[] IS NULL OR (travel.from_site_id=ANY($4::uuid[]) AND travel.to_site_id=ANY($4::uuid[])))
                ),0)::int travel_count
         FROM attendance_shifts s
         JOIN sites site ON site.id=s.site_id
         LEFT JOIN sites checkout_site ON checkout_site.id=s.check_out_site_id
         WHERE s.organization_id=$1 AND s.user_id=$2
           AND ($3::int IS NULL OR s.check_in_at>=now()-($3::int*interval '1 day'))
           AND ($4::uuid[] IS NULL OR s.site_id=ANY($4::uuid[]))
         ORDER BY s.check_in_at DESC
         LIMIT 160`,
        [...paramsBase],
      ),
      client.query(
        `SELECT segment.id::text,segment.attendance_shift_id::text,segment.sequence,segment.segment_type,
                segment.site_id::text,site.name site_name,
                segment.from_site_id::text,from_site.name from_site_name,
                segment.to_site_id::text,to_site.name to_site_name,
                segment.destination_task_id::text,
                CASE WHEN task.id IS NOT NULL
                     THEN 'OT #'||work_order.number::text||' · '||task.description
                     ELSE NULL END destination_task_label,
                segment.tracking_session_id::text,
                segment.started_at::text,segment.ended_at::text,segment.notes,
                segment.start_accuracy_m,segment.start_distance_m,
                segment.end_accuracy_m,segment.end_distance_m,
                COALESCE((
                  SELECT count(*)::int
                  FROM technician_location_samples sample
                  WHERE sample.attendance_shift_id=segment.attendance_shift_id
                    AND sample.source='connected_app'
                    AND sample.recorded_at>=segment.started_at
                    AND sample.recorded_at<=COALESCE(segment.ended_at,now())
                ),0)::int reaction_sample_count
         FROM attendance_shift_segments segment
         JOIN attendance_shifts shift ON shift.id=segment.attendance_shift_id
         LEFT JOIN sites site ON site.id=segment.site_id
         LEFT JOIN sites from_site ON from_site.id=segment.from_site_id
         LEFT JOIN sites to_site ON to_site.id=segment.to_site_id
         LEFT JOIN work_order_tasks task ON task.id=segment.destination_task_id
         LEFT JOIN work_orders work_order ON work_order.id=task.work_order_id
         WHERE segment.organization_id=$1 AND segment.user_id=$2
           AND ($3::int IS NULL OR segment.started_at>=now()-($3::int*interval '1 day'))
           AND (
             $4::uuid[] IS NULL
             OR (
               segment.segment_type='site' AND segment.site_id=ANY($4::uuid[])
             )
             OR (
               segment.segment_type='travel'
               AND segment.from_site_id=ANY($4::uuid[])
               AND segment.to_site_id=ANY($4::uuid[])
             )
           )
         ORDER BY segment.started_at DESC
         LIMIT 320`,
        [...paramsBase],
      ),
      client.query(
        `SELECT bp.enrollment_method,bp.consented_at::text,bp.enrolled_at::text,
                bp.identity_verified_at::text,bp.last_verified_at::text,bp.revoked_at::text,bp.revoked_reason,
                CASE WHEN $3::uuid[] IS NULL OR bp.enrollment_site_id=ANY($3::uuid[])
                     THEN site.name ELSE NULL END enrollment_site_name,
                CASE WHEN $3::uuid[] IS NULL OR bp.enrollment_site_id=ANY($3::uuid[])
                     THEN bp.enrollment_site_id::text ELSE NULL END enrollment_site_id,
                CASE WHEN $3::uuid[] IS NULL OR bp.enrollment_site_id IS NULL OR bp.enrollment_site_id=ANY($3::uuid[])
                     THEN enroller.full_name ELSE NULL END enrolled_by_name,
                CASE WHEN $3::uuid[] IS NULL OR bp.enrollment_site_id IS NULL OR bp.enrollment_site_id=ANY($3::uuid[])
                     THEN revoker.full_name ELSE NULL END revoked_by_name,
                CASE
                  WHEN bp.revoked_at IS NOT NULL THEN 'revoked'
                  WHEN bp.enrollment_method='supervised_camera' AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
                  WHEN bp.user_id IS NOT NULL THEN 'legacy'
                  ELSE 'missing'
                END status
         FROM user_biometric_profiles bp
         LEFT JOIN sites site ON site.id=bp.enrollment_site_id
         LEFT JOIN users enroller ON enroller.id=bp.enrolled_by
         LEFT JOIN users revoker ON revoker.id=bp.revoked_by
         WHERE bp.organization_id=$1 AND bp.user_id=$2`,
        [organizationId,userId,scope],
      ),
      client.query(
        `SELECT e.id::text,e.event_type,e.enrollment_method,e.occurred_at::text,
                CASE WHEN $4::uuid[] IS NULL OR e.site_id IS NULL OR e.site_id=ANY($4::uuid[])
                     THEN site.name ELSE NULL END site_name,
                COALESCE(actor.full_name,e.metadata->>'actor_email','Sistema') actor_name,
                e.metadata->>'actor_platform_role' actor_platform_role,
                e.metadata->>'reason' reason
         FROM biometric_enrollment_events e
         LEFT JOIN sites site ON site.id=e.site_id
         LEFT JOIN users actor ON actor.id=e.actor_user_id
         WHERE e.organization_id=$1 AND e.user_id=$2
           AND ($3::int IS NULL OR e.occurred_at>=now()-($3::int*interval '1 day'))
           AND ($4::uuid[] IS NULL OR e.site_id IS NULL OR e.site_id=ANY($4::uuid[]))
         ORDER BY e.occurred_at DESC
         LIMIT 120`,
        [...paramsBase],
      ),
      client.query(
        `SELECT c.id::text,c.site_id,site.name site_name,c.action,c.reason_code,c.details,c.status,
                c.requested_at::text,c.reviewed_at::text,c.review_note,c.approved_until::text,c.used_at::text,
                COALESCE(reviewer.full_name,
                         CASE WHEN c.reviewed_by IS NULL THEN NULL ELSE 'Usuario' END) reviewed_by_name,
                c.requester_accuracy_m
         FROM attendance_contingency_requests c
         JOIN sites site ON site.id=c.site_id
         LEFT JOIN users reviewer ON reviewer.id=c.reviewed_by
         WHERE c.organization_id=$1 AND c.user_id=$2
           AND ($3::int IS NULL OR c.requested_at>=now()-($3::int*interval '1 day'))
           AND ($4::uuid[] IS NULL OR c.site_id=ANY($4::uuid[]))
         ORDER BY c.requested_at DESC
         LIMIT 120`,
        [...paramsBase],
      ),
      client.query(
        `SELECT s.id::text,s.base_site_id,site.name base_site_name,s.schedule_source,
                source.name source_site_name,s.business_schedule,s.timezone,
                s.effective_from::text,s.effective_until::text,s.notes,
                s.created_at::text,s.updated_at::text
         FROM user_attendance_schedules s
         JOIN sites site ON site.id=s.base_site_id
         LEFT JOIN sites source ON source.id=s.source_site_id
         WHERE s.organization_id=$1 AND s.user_id=$2
           AND ($4::uuid[] IS NULL OR s.base_site_id=ANY($4::uuid[]))
         ORDER BY s.effective_from DESC,s.created_at DESC
         LIMIT 80`,
        [...paramsBase],
      ),
      client.query(
        `SELECT a.id::text,a.action,a.entity_id,a.created_at::text,
                COALESCE(actor.full_name,a.metadata->>'actor_email','Sistema') actor_name,
                a.metadata->>'actor_platform_role' actor_platform_role,
                a.metadata->>'base_site_id' base_site_id,
                a.metadata->>'effective_from' effective_from,
                a.metadata->>'effective_until' effective_until
         FROM audit_log a
         LEFT JOIN users actor ON actor.id=a.user_id
         WHERE a.organization_id=$1
           AND a.entity_type='user_attendance_schedule'
           AND a.metadata->>'user_id'=$2
           AND ($3::int IS NULL OR a.created_at>=now()-($3::int*interval '1 day'))
           AND (
             $4::text[] IS NULL
             OR (
               a.metadata ? 'base_site_id'
               AND a.metadata->>'base_site_id'=ANY($4::text[])
             )
           )
         ORDER BY a.created_at DESC
         LIMIT 120`,
        [...paramsBase],
      ),
    ]);

    const scheduleRows=schedules.rows as Array<{effective_from:string;effective_until:string|null}>;
    const nowLocal=await client.query<{today:string}>(
      "SELECT ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date)::text today",
      [person.timezone],
    );
    const today=nowLocal.rows[0]?.today||new Date().toISOString().slice(0,10);
    const currentSchedule=scheduleRows.find(item=>item.effective_from<=today&&(!item.effective_until||item.effective_until>=today))||null;
    const upcomingSchedule=scheduleRows
      .filter(item=>item.effective_from>today)
      .sort((a,b)=>a.effective_from.localeCompare(b.effective_from))[0]||null;

    return NextResponse.json({
      period:days===null?"all":String(days),
      today,
      person:{
        id:person.id,
        fullName:person.full_name,
        email:person.email,
        role:person.role,
        organizationName:person.organization_name,
        timezone:person.timezone,
      },
      scope:{limited:scope!==null,siteIds:scope||[]},
      summary:summary.rows[0]||{
        shifts:0,field_hours:"0",standard_check_ins:0,contingency_check_ins:0,
        open_now:false,completed_activities:0,contingencies:0,travels:0,
      },
      currentSchedule,
      upcomingSchedule,
      biometric:biometricProfile.rows[0]||{status:"missing"},
      biometricEvents:biometricEvents.rows,
      shifts:shifts.rows,
      segments:segments.rows,
      contingencies:contingencies.rows,
      scheduleAudit:scheduleAudit.rows,
    });
  }finally{
    client.release();
  }
}
