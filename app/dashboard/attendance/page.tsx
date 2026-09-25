import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOperator, ROLE_LABELS, type OrganizationRole } from "@/lib/permissions";
import { query } from "@/lib/db";
import AttendanceCapture from "@/components/AttendanceCapture";
import AttendanceMovement, { type AttendanceMovementSegment } from "@/components/AttendanceMovement";
import SupervisedBiometricEnrollment from "@/components/SupervisedBiometricEnrollment";
import UserAttendanceAuditCenter from "@/components/UserAttendanceAuditCenter";
import AttendanceOperationalReport from "@/components/AttendanceOperationalReport";
import { AttendanceContingencyReview, AttendanceContingencySelf, type ContingencyRequestView, type ContingencyReviewItem } from "@/components/AttendanceContingency";
import { DEFAULT_ATTENDANCE_POLICY, attendanceRoleEnabled } from "@/lib/attendance-policy";
import ModuleHeader from "@/components/ModuleHeader";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { attendanceOrganizationId } from "@/lib/attendance-context";
import { attendanceScheduleWeeklyHours, scheduleDayForDate } from "@/lib/attendance-schedules";
import type { BusinessDaySchedule } from "@/lib/business-hours";

type OrganizationOption={id:string;name:string};

type Policy={
  enabled:boolean;
  enabled_roles:string[];
  require_face:boolean;
  require_geolocation:boolean;
  max_location_accuracy_m:number;
  face_similarity_threshold:number;
  liveness_threshold:number;
};

type Site={
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofence_radius_m:number;
};

type EnrollmentPerson={
  id:string;
  full_name:string;
  email:string;
  role:OrganizationRole;
  has_avatar:boolean;
  biometric_status:"verified"|"legacy"|"revoked"|"missing";
};

type SelfSchedule={
  id:string;
  base_site_id:string;
  base_site_name:string;
  business_schedule:BusinessDaySchedule[];
  timezone:string;
  effective_from:string;
  effective_until:string|null;
  local_date:string;
};

type SelfOpenShift={
  id:string;
  site_id:string;
  site_name:string;
  origin_site_id:string;
  origin_site_name:string;
  check_in_at:string;
  in_transit:boolean;
};

type SelfDestinationTask={
  id:string;
  site_id:string;
  site_name:string;
  label:string;
  status:string;
};

// ── Page orchestration: policy, sites, enrollment and reports ────────────────

export default async function AttendancePage({searchParams}:{searchParams:Promise<{saved?:string;error?:string;organization_id?:string;user_id?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  const globalOperator=isPlatformOperator(session);
  const canSelf=Boolean(session.userId&&session.organizationId&&can(session,"attendance.self"));
  const canManage=can(session,"attendance.manage");
  const canReports=can(session,"attendance.reports");
  if(!canSelf && !canManage && !canReports) redirect("/dashboard");

  const feedback=await searchParams;
  const organizations=globalOperator
    ? await query<OrganizationOption>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
    : {rows:[]} as {rows:OrganizationOption[]};
  const requestedOrganizationId=attendanceOrganizationId(session,feedback.organization_id);
  const organizationId=globalOperator
    ? organizations.rows.some(item=>item.id===requestedOrganizationId)?requestedOrganizationId:null
    : requestedOrganizationId;
  const selectedOrganization=organizationId
    ? organizations.rows.find(item=>item.id===organizationId)||null
    : null;

  const policyResult=organizationId
    ? await query<Policy>(
        `SELECT enabled,enabled_roles,require_face,require_geolocation,max_location_accuracy_m,
                face_similarity_threshold,liveness_threshold
         FROM organization_attendance_policies WHERE organization_id=$1`,
        [organizationId],
      )
    : {rows:[]} as {rows:Policy[]};

  const policy:Policy=policyResult.rows[0] || DEFAULT_ATTENDANCE_POLICY;

  const sites=organizationId
    ? session.accessAllSites
      ? await query<Site>(
          `SELECT id,name,city,latitude,longitude,geofence_radius_m
           FROM sites WHERE organization_id=$1 AND active=true ORDER BY name`,
          [organizationId],
        )
      : await query<Site>(
          `SELECT id,name,city,latitude,longitude,geofence_radius_m
           FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name`,
          [organizationId,session.siteIds],
        )
    : {rows:[]} as {rows:Site[]};

  const enrolled=canSelf && session.userId && organizationId
    ? await query(
        `SELECT 1
         FROM user_biometric_profiles
         WHERE user_id=$1 AND organization_id=$2
           AND revoked_at IS NULL
           AND encrypted_embedding IS NOT NULL
           AND enrollment_method='supervised_camera'
           AND identity_verified_at IS NOT NULL`,
        [session.userId,organizationId],
      )
    : {rowCount:0};

  const openShift=canSelf && session.userId && organizationId
    ? await query<SelfOpenShift>(
        `SELECT a.id,
                COALESCE(segment.site_id,segment.from_site_id,a.site_id)::text site_id,
                COALESCE(current_site.name,from_site.name,origin.name) site_name,
                a.site_id::text origin_site_id,origin.name origin_site_name,
                a.check_in_at::text,
                COALESCE(segment.segment_type='travel',false) in_transit
         FROM attendance_shifts a
         JOIN sites origin ON origin.id=a.site_id
         LEFT JOIN attendance_shift_segments segment
           ON segment.attendance_shift_id=a.id AND segment.ended_at IS NULL
         LEFT JOIN sites current_site ON current_site.id=segment.site_id
         LEFT JOIN sites from_site ON from_site.id=segment.from_site_id
         WHERE a.organization_id=$2 AND a.user_id=$1 AND a.status='open'
         LIMIT 1`,
        [session.userId,organizationId],
      )
    : {rows:[]} as {rows:SelfOpenShift[]};

  const selfSchedule=canSelf && session.userId && organizationId
    ? await query<SelfSchedule>(
        `SELECT uas.id,uas.base_site_id,s.name base_site_name,uas.business_schedule,uas.timezone,
                uas.effective_from::text,uas.effective_until::text,
                ((CURRENT_TIMESTAMP AT TIME ZONE uas.timezone)::date)::text local_date
         FROM user_attendance_schedules uas
         JOIN sites s ON s.id=uas.base_site_id
         WHERE uas.organization_id=$1 AND uas.user_id=$2
           AND uas.effective_from <= (CURRENT_TIMESTAMP AT TIME ZONE uas.timezone)::date
           AND (uas.effective_until IS NULL OR uas.effective_until >= (CURRENT_TIMESTAMP AT TIME ZONE uas.timezone)::date)
         ORDER BY uas.effective_from DESC
         LIMIT 1`,
        [organizationId,session.userId],
      )
    : {rows:[]} as {rows:SelfSchedule[]};

  const selfMovementSegment=canSelf && openShift.rows[0]
    ? await query<AttendanceMovementSegment>(
        `SELECT segment.id::text,segment.segment_type,
                segment.site_id::text,current_site.name site_name,
                segment.from_site_id::text,from_site.name from_site_name,
                segment.to_site_id::text,to_site.name to_site_name,
                segment.destination_task_id::text,
                CASE WHEN task.id IS NOT NULL
                     THEN 'OT #'||work_order.number::text||' · '||task.description
                     ELSE NULL END destination_task_label,
                segment.tracking_session_id::text,
                segment.started_at::text
         FROM attendance_shift_segments segment
         LEFT JOIN sites current_site ON current_site.id=segment.site_id
         LEFT JOIN sites from_site ON from_site.id=segment.from_site_id
         LEFT JOIN sites to_site ON to_site.id=segment.to_site_id
         LEFT JOIN work_order_tasks task ON task.id=segment.destination_task_id
         LEFT JOIN work_orders work_order ON work_order.id=task.work_order_id
         WHERE segment.attendance_shift_id=$1 AND segment.ended_at IS NULL
         LIMIT 1`,
        [openShift.rows[0].id],
      )
    : {rows:[]} as {rows:AttendanceMovementSegment[]};

  const selfDestinationTasks=canSelf && session.userId && organizationId && openShift.rows[0]
    ? await query<SelfDestinationTask>(
        `SELECT task.id::text,work_order.site_id::text,site.name site_name,
                'OT #'||work_order.number::text||' · '||task.description label,task.status
         FROM work_order_tasks task
         JOIN work_orders work_order ON work_order.id=task.work_order_id
         JOIN sites site ON site.id=work_order.site_id
         WHERE task.organization_id=$1
           AND task.status IN ('pending','in_progress')
           AND COALESCE(task.completed,false)=false
           AND work_order.status NOT IN ('completed','cancelled')
           AND ($3::boolean OR work_order.site_id=ANY($4::uuid[]))
           AND (
             task.assigned_to=$2
             OR EXISTS(
               SELECT 1 FROM crew_members member
               WHERE member.organization_id=$1 AND member.crew_id=task.crew_id AND member.user_id=$2
             )
             OR ($5::uuid IS NOT NULL AND task.service_supplier_id=$5::uuid)
           )
         ORDER BY site.name,work_order.number,task.sort_order`,
        [organizationId,session.userId,session.accessAllSites,session.siteIds,session.externalSupplierId],
      )
    : {rows:[]} as {rows:SelfDestinationTask[]};

  const selfContingency=canSelf && session.userId && organizationId
    ? await query<ContingencyRequestView>(
        `SELECT r.id,r.site_id,s.name site_name,r.action,r.reason_code,r.details,r.status,
                r.requested_at::text,r.approved_until::text,r.review_note
         FROM attendance_contingency_requests r
         JOIN sites s ON s.id=r.site_id
         WHERE r.user_id=$1 AND r.organization_id=$2
           AND r.status IN ('pending','approved')
           AND (r.status<>'approved' OR r.approved_until>now())
         ORDER BY r.requested_at DESC
         LIMIT 1`,
        [session.userId,organizationId],
      )
    : {rows:[]} as {rows:ContingencyRequestView[]};

  const contingencyReview=canManage && organizationId
    ? session.accessAllSites
      ? await query<ContingencyReviewItem>(
          `SELECT r.id,r.user_id,u.full_name,om.role,r.site_id,s.name site_name,
                  r.action,r.reason_code,r.details,r.status,r.requested_at::text,
                  r.approved_until::text,r.review_note,
                  r.requester_accuracy_m,r.requester_latitude,r.requester_longitude
           FROM attendance_contingency_requests r
           JOIN users u ON u.id=r.user_id
           JOIN organization_members om ON om.user_id=r.user_id AND om.organization_id=r.organization_id
           JOIN sites s ON s.id=r.site_id
           WHERE r.organization_id=$1 AND r.status='pending'
           ORDER BY r.requested_at`,
          [organizationId],
        )
      : await query<ContingencyReviewItem>(
          `SELECT r.id,r.user_id,u.full_name,om.role,r.site_id,s.name site_name,
                  r.action,r.reason_code,r.details,r.status,r.requested_at::text,
                  r.approved_until::text,r.review_note,
                  r.requester_accuracy_m,r.requester_latitude,r.requester_longitude
           FROM attendance_contingency_requests r
           JOIN users u ON u.id=r.user_id
           JOIN organization_members om ON om.user_id=r.user_id AND om.organization_id=r.organization_id
           JOIN sites s ON s.id=r.site_id
           WHERE r.organization_id=$1 AND r.status='pending' AND r.site_id=ANY($2::uuid[])
           ORDER BY r.requested_at`,
          [organizationId,session.siteIds],
        )
    : {rows:[]} as {rows:ContingencyReviewItem[]};

  const enrollmentPeople=canManage && organizationId
    ? session.platformRole!=="user"||session.accessAllSites
      ? await query<EnrollmentPerson>(
          `SELECT
             u.id,u.full_name,u.email,om.role,(u.avatar_data IS NOT NULL) has_avatar,
             CASE
               WHEN bp.revoked_at IS NOT NULL THEN 'revoked'
               WHEN bp.enrollment_method='supervised_camera' AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
               WHEN bp.user_id IS NOT NULL THEN 'legacy'
               ELSE 'missing'
             END biometric_status
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=om.organization_id
           WHERE om.organization_id=$1
             AND u.active=true
             AND om.role IN ('admin','manager','technician','provider','external')
           ORDER BY u.full_name`,
          [organizationId],
        )
      : await query<EnrollmentPerson>(
          `SELECT
             u.id,u.full_name,u.email,om.role,(u.avatar_data IS NOT NULL) has_avatar,
             CASE
               WHEN bp.revoked_at IS NOT NULL THEN 'revoked'
               WHEN bp.enrollment_method='supervised_camera' AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
               WHEN bp.user_id IS NOT NULL THEN 'legacy'
               ELSE 'missing'
             END biometric_status
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=om.organization_id
           WHERE om.organization_id=$1
             AND u.active=true
             AND om.role IN ('admin','manager','technician','provider','external')
             AND (
               COALESCE(om.access_all_sites,true)=true
               OR EXISTS(
                 SELECT 1 FROM organization_member_sites oms
                 WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
                   AND oms.site_id=ANY($2::uuid[])
               )
             )
           ORDER BY u.full_name`,
          [organizationId,session.siteIds],
        )
    : {rows:[]} as {rows:EnrollmentPerson[]};

  const selfScheduleRow=selfSchedule.rows[0]||null;
  const selfScheduledDay=selfScheduleRow
    ? scheduleDayForDate(selfScheduleRow.business_schedule,selfScheduleRow.local_date)
    : null;
  const selfOpenShift=openShift.rows[0]||null;
  const selfMovement=selfMovementSegment.rows[0]||null;

  return <div className="phase8-attendance">
    <ModuleHeader
      eyebrow="Operación en campo"
      title="Presencia y actividades"
      description="Valida presencia física en sitio con GPS y rostro en vivo. La jornada puede iniciar aunque todavía no existan actividades asignadas."
      count={canReports?enrollmentPeople.rows.length:1}
      countLabel={canReports?"personas":"sesión"}
      searchPlaceholder="Buscar persona o rol en el reporte de asistencia"
      filters={canReports?[{value:"all",label:"Todos"},{value:"active",label:"En campo"},{value:"inactive",label:"Sin jornada"}]:[{value:"all",label:"Todos"}]}
      facets={canReports?[{key:"role",label:"Rol",allLabel:"Todos los roles"}]:[]}
    />
    {globalOperator&&<section className="section attendance-admin-context">
      <div className="attendance-admin-context-copy">
        <span className="eyebrow">Contexto administrativo</span>
        <h2>{selectedOrganization?selectedOrganization.name:"Selecciona una empresa"}</h2>
        <p>{selectedOrganization
          ?"Políticas, enrolamiento biométrico, geocercas, contingencias y reportes quedan limitados a esta empresa."
          :"El Propietario y Superadministrador deben elegir la empresa antes de modificar la asistencia."}</p>
      </div>
      <form method="get" action="/dashboard/attendance" className="attendance-admin-context-form">
        <div className="field">
          <label htmlFor="attendance-organization">Empresa *</label>
          <select id="attendance-organization" name="organization_id" defaultValue={organizationId||""} required>
            <option value="">Selecciona empresa</option>
            {organizations.rows.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        {feedback.user_id&&<input type="hidden" name="user_id" value={feedback.user_id}/>} 
        <button className="button" type="submit">Administrar empresa</button>
      </form>
    </section>}
    <section className="section phase8-attendance-summary-head">
      <div><span className="eyebrow">Operación en campo</span><h1>Presencia y actividades</h1><p>{selectedOrganization?`Administrando ${selectedOrganization.name}. `:""}Biometría facial supervisada, GPS y geocercas con trazabilidad auditable.</p></div>
      <Badge variant={policy.enabled?"success":"neutral"} icon="attendance">{policy.enabled?"Control activo":"Control inactivo"}</Badge>
    </section>

    {feedback.saved==="policy" && <div className="section"><Alert variant="success" title="Política actualizada">Política de asistencia actualizada.</Alert></div>}
    {feedback.error==="roles" && <div className="section"><Alert variant="danger" title="Revisa la política">Selecciona al menos un rol para aplicar el control de asistencia.</Alert></div>}

    {globalOperator&&!organizationId&&<section className="section"><EmptyState icon="info" title="Selecciona una empresa para administrar Asistencia" description="El contexto de empresa evita mezclar políticas, personas, sedes y biometría entre clientes. Selecciona una empresa arriba para continuar."/></section>}

    {canSelf && organizationId && <>
      {!policy.enabled || !attendanceRoleEnabled(session, policy.enabled_roles)
        ? <section className="section"><EmptyState icon="file" title="El control de asistencia no está habilitado para tu rol" description="Un administrador puede activarlo desde la política de asistencia."/></section>
        : <>
            <section className="section attendance-scheduled-workday">
              <div className="attendance-scheduled-workday-icon"><UiIcon name="clock" size={20}/></div>
              <div>
                <span className="eyebrow">Jornada programada</span>
                <strong>{selfScheduleRow
                  ? selfScheduledDay?.enabled
                    ? selfScheduledDay.openTime+" – "+selfScheduledDay.closeTime
                    : "Hoy no está programado como día laborable"
                  : "Sin jornada individual configurada"}</strong>
                <small>{selfScheduleRow
                  ? selfScheduleRow.base_site_name+" · "+attendanceScheduleWeeklyHours(selfScheduleRow.business_schedule).toFixed(1)+" h/semana · "+selfScheduleRow.timezone
                  : "El marcaje sigue disponible según la política de asistencia; un administrador puede asignar tu jornada individual."}</small>
              </div>
              <Badge variant={selfScheduleRow&&selfScheduledDay?.enabled?"success":"neutral"}>{selfScheduleRow&&selfScheduledDay?.enabled?"Programado":"Informativo"}</Badge>
            </section>
            <section className="section">
              <AttendanceCapture
                sites={sites.rows.map(site=>({
                  id:site.id,
                  name:site.name,
                  city:site.city,
                  latitude:site.latitude,
                  longitude:site.longitude,
                  geofenceRadius:site.geofence_radius_m,
                  geofenceConfigured:site.latitude!==null&&site.longitude!==null,
                }))}
                enrolled={Boolean(enrolled.rowCount)}
                openShift={openShift.rows[0]||null}
                requireFace={policy.require_face}
                requireGeolocation={policy.require_geolocation}
                maxLocationAccuracy={policy.max_location_accuracy_m}
                livenessThreshold={policy.liveness_threshold}
                preferredSiteId={selfScheduleRow?.base_site_id||null}
                inTransit={Boolean(selfOpenShift?.in_transit)}
              />
            </section>
            {selfOpenShift&&selfMovement&&<AttendanceMovement
              currentSegment={selfMovement}
              sites={sites.rows.map(site=>({
                id:site.id,
                name:site.name,
                city:site.city,
                latitude:site.latitude,
                longitude:site.longitude,
                geofenceRadius:site.geofence_radius_m,
                geofenceConfigured:site.latitude!==null&&site.longitude!==null,
              }))}
              tasks={selfDestinationTasks.rows}
              requireGeolocation={policy.require_geolocation}
              maxLocationAccuracy={policy.max_location_accuracy_m}
            />}
            {Boolean(enrolled.rowCount) && !selfOpenShift?.in_transit && <AttendanceContingencySelf
              sites={sites.rows.map(site=>({
                id:site.id,
                name:site.name,
                city:site.city,
                latitude:site.latitude,
                longitude:site.longitude,
                geofenceRadius:site.geofence_radius_m,
              }))}
              openShift={selfOpenShift?{site_id:selfOpenShift.site_id,site_name:selfOpenShift.site_name}:null}
              initialRequest={selfContingency.rows[0]||null}
            />}
          </>
      }
    </>}

    {canManage && organizationId && <UserAttendanceAuditCenter
      organizationId={organizationId}
      people={enrollmentPeople.rows.map(person=>({id:person.id,full_name:person.full_name,role:ROLE_LABELS[person.role]}))}
      initialUserId={feedback.user_id||""}
    />}

    {canManage && organizationId && <AttendanceContingencyReview requests={contingencyReview.rows} organizationId={organizationId} />}

    {canManage && organizationId && <SupervisedBiometricEnrollment
      people={enrollmentPeople.rows}
      sites={sites.rows.map(site=>({
        id:site.id,
        name:site.name,
        city:site.city,
        latitude:site.latitude,
        longitude:site.longitude,
        geofenceRadius:site.geofence_radius_m,
      }))}
      livenessThreshold={policy.liveness_threshold}
      organizationId={organizationId}
      initialUserId={feedback.user_id||""}
    />}

    {canManage && organizationId && <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Política de empresa</span><h2>Control de asistencia</h2><p className="muted">Define a qué roles aplica y qué verificaciones deben superar. La configuración no toma decisiones laborales automáticas.</p></div><Badge variant={policy.enabled?"success":"neutral"}>{policy.enabled?"Activo":"Inactivo"}</Badge></div>
      <form method="post" action="/api/attendance/policy" className="form-grid">
        <input type="hidden" name="organization_id" value={organizationId}/>
        <div className="field"><label>Estado</label><select name="enabled" defaultValue={String(policy.enabled)}><option value="true">Activado</option><option value="false">Desactivado</option></select></div>
        <div className="field"><label>Biometría facial</label><select name="require_face" defaultValue={String(policy.require_face)}><option value="true">Obligatoria</option><option value="false">No requerida</option></select></div>
        <div className="field"><label>Geolocalización</label><select name="require_geolocation" defaultValue={String(policy.require_geolocation)}><option value="true">Obligatoria</option><option value="false">No requerida</option></select></div>
        <div className="field"><label>Precisión GPS máxima (m)</label><input name="max_location_accuracy_m" type="number" min="10" max="1000" defaultValue={policy.max_location_accuracy_m}/></div>
        <div className="field"><label>Coincidencia facial mínima</label><input name="face_similarity_threshold" type="number" step="0.01" min="0.30" max="0.95" defaultValue={policy.face_similarity_threshold}/></div>
        <div className="field"><label>Presencia real mínima</label><input name="liveness_threshold" type="number" step="0.01" min="0.30" max="0.99" defaultValue={policy.liveness_threshold}/></div>
        <div className="field form-span-2"><label>Roles controlados</label><div className="attendance-role-grid">{(["technician","external","provider","manager","admin"] as OrganizationRole[]).map(role=><label key={role}><input type="checkbox" name="enabled_roles" value={role} defaultChecked={policy.enabled_roles.includes(role)}/><span>{ROLE_LABELS[role]}</span></label>)}</div></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar política</button></div>
      </form>
    </section>}

    {canManage && organizationId && <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Geocercas</span><h2>Sedes habilitadas</h2><p className="muted">Cada sede debe tener coordenadas y radio antes de exigir geolocalización.</p></div></div>
      <div className="attendance-site-grid">{sites.rows.map(site=><article className="card attendance-site-card" key={site.id}><div><strong>{site.name}</strong><span>{site.city||"Sin ciudad"}</span></div><Badge variant={site.latitude!==null&&site.longitude!==null?"success":"warning"}>{site.latitude!==null&&site.longitude!==null ? site.geofence_radius_m+" m":"Sin geocerca"}</Badge><Link className="text-button" href={"/dashboard/locations/"+site.id}>Configurar →</Link></article>)}</div>
    </section>}

    {canReports && organizationId && <AttendanceOperationalReport organizationId={organizationId}/>}
  </div>;
}
