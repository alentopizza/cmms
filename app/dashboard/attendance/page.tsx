import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOperator, ROLE_LABELS, type OrganizationRole } from "@/lib/permissions";
import { organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import AttendanceCapture from "@/components/AttendanceCapture";
import AttendanceMovement, { type AttendanceMovementSegment } from "@/components/AttendanceMovement";
import BiometricEnrollmentAdmin from "@/components/BiometricEnrollmentAdmin";
import SelfBiometricEnrollment from "@/components/SelfBiometricEnrollment";
import UserAttendanceAuditCenter from "@/components/UserAttendanceAuditCenter";
import AttendanceOperationalReport from "@/components/AttendanceOperationalReport";
import { AttendanceContingencyReview, AttendanceContingencySelf, type ContingencyRequestView, type ContingencyReviewItem } from "@/components/AttendanceContingency";
import { DEFAULT_ATTENDANCE_POLICY, DEFAULT_BIOMETRIC_NOTICE_BODY, DEFAULT_BIOMETRIC_NOTICE_TITLE, attendanceRoleEnabled } from "@/lib/attendance-policy";
import ModuleHeader from "@/components/ModuleHeader";
import AttendanceEditGuard from "@/components/AttendanceEditGuard";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { ModuleNavigation } from "@/components/ui-kit/Navigation";
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
  code:string|null;
  address:string|null;
  city:string|null;
  country:string;
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
  request_id:string|null;
  request_status:"pending"|"approved"|"rejected"|"cancelled"|"expired"|null;
  request_site_name:string|null;
  request_requested_at:string|null;
  request_review_note:string|null;
  attendance_override:boolean|null;
};

type BiometricPolicyVersion={
  id:string;
  version:number;
  title:string;
  body:string;
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

export default async function AttendancePage({searchParams}:{searchParams:Promise<{saved?:string;error?:string;organization_id?:string;user_id?:string;view?:string;step?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  const globalOperator=isPlatformOperator(session);
  const canSelf=Boolean(session.userId&&session.organizationId&&can(session,"attendance.self"));
  const canManage=can(session,"attendance.manage");
  const canReports=can(session,"attendance.reports");
  if(!canSelf && !canManage && !canReports) redirect("/dashboard");

  const feedback=await searchParams;
  const organizationScope=organizationScopeFor(session);
  const organizations=globalOperator
    ? await query<OrganizationOption>(
        "SELECT id,name FROM organizations WHERE active=true AND ($1::boolean OR id=ANY($2::uuid[])) ORDER BY name",
        [organizationScope.unrestricted,organizationScope.organizationIds],
      )
    : {rows:[]} as {rows:OrganizationOption[]};
  const requestedOrganizationId=attendanceOrganizationId(session,feedback.organization_id);
  const organizationId=globalOperator
    ? organizations.rows.some(item=>item.id===requestedOrganizationId)?requestedOrganizationId:null
    : requestedOrganizationId;
  const selectedOrganization=organizationId
    ? organizations.rows.find(item=>item.id===organizationId)||null
    : null;

  const [policyResult,biometricNotice,sites,enrolled,openShift,selfSchedule,selfControl]=await Promise.all([
    organizationId
      ? query<Policy>(
          `SELECT enabled,enabled_roles,require_face,require_geolocation,max_location_accuracy_m,
                  face_similarity_threshold,liveness_threshold
           FROM organization_attendance_policies WHERE organization_id=$1`,
          [organizationId],
        )
      : Promise.resolve({rows:[]} as {rows:Policy[]}),

    organizationId
      ? query<BiometricPolicyVersion>(
          `SELECT id,version,title,body
           FROM attendance_biometric_policy_versions
           WHERE organization_id=$1 AND active=true
           ORDER BY version DESC LIMIT 1`,
          [organizationId],
        )
      : Promise.resolve({rows:[]} as {rows:BiometricPolicyVersion[]}),

    organizationId
      ? session.accessAllSites
        ? query<Site>(
            `SELECT id,name,code,address,city,country,latitude,longitude,geofence_radius_m
             FROM sites WHERE organization_id=$1 AND active=true ORDER BY name`,
            [organizationId],
          )
        : query<Site>(
            `SELECT id,name,code,address,city,country,latitude,longitude,geofence_radius_m
             FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name`,
            [organizationId,session.siteIds],
          )
      : Promise.resolve({rows:[]} as {rows:Site[]}),

    canSelf && session.userId && organizationId
      ? query(
          `SELECT 1
           FROM user_biometric_profiles
           WHERE user_id=$1 AND organization_id=$2
             AND revoked_at IS NULL
             AND encrypted_embedding IS NOT NULL
             AND enrollment_method IN ('supervised_camera','self_camera_approved')
             AND identity_verified_at IS NOT NULL`,
          [session.userId,organizationId],
        )
      : Promise.resolve({rowCount:0}),

    canSelf && session.userId && organizationId
      ? query<SelfOpenShift>(
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
      : Promise.resolve({rows:[]} as {rows:SelfOpenShift[]}),

    canSelf && session.userId && organizationId
      ? query<SelfSchedule>(
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
      : Promise.resolve({rows:[]} as {rows:SelfSchedule[]}),
    canSelf && session.userId && organizationId
      ? query<{enabled:boolean}>(
          `SELECT enabled FROM user_attendance_control_overrides
           WHERE organization_id=$1 AND user_id=$2`,
          [organizationId,session.userId],
        )
      : Promise.resolve({rows:[]} as {rows:{enabled:boolean}[]}),
  ]);

  const policy:Policy=policyResult.rows[0] || DEFAULT_ATTENDANCE_POLICY;
  const currentBiometricNotice=biometricNotice.rows[0]||{
    id:"",
    version:0,
    title:DEFAULT_BIOMETRIC_NOTICE_TITLE,
    body:DEFAULT_BIOMETRIC_NOTICE_BODY,
  };

  const [selfMovementSegment,selfDestinationTasks]=await Promise.all([
    canSelf && openShift.rows[0]
    ? query<AttendanceMovementSegment>(
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
    : {rows:[]} as {rows:AttendanceMovementSegment[]},
    canSelf && session.userId && organizationId && openShift.rows[0]
    ? query<SelfDestinationTask>(
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
    : {rows:[]} as {rows:SelfDestinationTask[]},
  ]);

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
               WHEN bp.enrollment_method IN ('supervised_camera','self_camera_approved') AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
               WHEN bp.user_id IS NOT NULL THEN 'legacy'
               ELSE 'missing'
             END biometric_status,
             request.id::text request_id,
             CASE WHEN request.status='pending' AND request.preview_expires_at<=now() THEN 'expired' ELSE request.status END request_status,
             request_site.name request_site_name,
             request.requested_at::text request_requested_at,request.review_note request_review_note,
             control.enabled attendance_override
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=om.organization_id
           LEFT JOIN user_attendance_control_overrides control ON control.organization_id=om.organization_id AND control.user_id=om.user_id
           LEFT JOIN LATERAL (
             SELECT enrollment.id,enrollment.status,enrollment.site_id,enrollment.requested_at,enrollment.review_note,enrollment.preview_expires_at
             FROM biometric_enrollment_requests enrollment
             WHERE enrollment.organization_id=om.organization_id AND enrollment.user_id=om.user_id
             ORDER BY enrollment.requested_at DESC
             LIMIT 1
           ) request ON true
           LEFT JOIN sites request_site ON request_site.id=request.site_id
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
               WHEN bp.enrollment_method IN ('supervised_camera','self_camera_approved') AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
               WHEN bp.user_id IS NOT NULL THEN 'legacy'
               ELSE 'missing'
             END biometric_status,
             request.id::text request_id,
             CASE WHEN request.status='pending' AND request.preview_expires_at<=now() THEN 'expired' ELSE request.status END request_status,
             request_site.name request_site_name,
             request.requested_at::text request_requested_at,request.review_note request_review_note,
             control.enabled attendance_override
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=om.organization_id
           LEFT JOIN user_attendance_control_overrides control ON control.organization_id=om.organization_id AND control.user_id=om.user_id
           LEFT JOIN LATERAL (
             SELECT enrollment.id,enrollment.status,enrollment.site_id,enrollment.requested_at,enrollment.review_note,enrollment.preview_expires_at
             FROM biometric_enrollment_requests enrollment
             WHERE enrollment.organization_id=om.organization_id AND enrollment.user_id=om.user_id
               AND enrollment.site_id=ANY($2::uuid[])
             ORDER BY enrollment.requested_at DESC
             LIMIT 1
           ) request ON true
           LEFT JOIN sites request_site ON request_site.id=request.site_id
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

  const organizationName=selectedOrganization?.name||session.organizationName||"Empresa";
  const activeView=canManage&&feedback.view==="operation"?"operation":"setup";
  const geofencedSites=sites.rows.filter(site=>site.latitude!==null&&site.longitude!==null&&site.geofence_radius_m>0).length;
  const controlledPeople=enrollmentPeople.rows.filter(person=>
    person.attendance_override===null?policy.enabled_roles.includes(person.role):person.attendance_override
  );
  const selfAttendanceEnabled=policy.enabled&&(selfControl.rows[0]?.enabled??attendanceRoleEnabled(session,policy.enabled_roles));
  const verifiedControlled=controlledPeople.filter(person=>person.biometric_status==="verified").length;
  const pendingControlled=controlledPeople.filter(person=>person.biometric_status!=="verified"&&person.request_status==="pending").length;
  const policySaved=Boolean(policyResult.rows[0]);

  function attendanceHref({view="setup",userId}:{view?:"setup"|"operation";userId?:string}={}){
    const params=new URLSearchParams();
    if(globalOperator&&organizationId)params.set("organization_id",organizationId);
    const targetUserId=userId||feedback.user_id;
    if(targetUserId)params.set("user_id",targetUserId);
    params.set("view",view);
    const query=params.toString();
    return "/dashboard/attendance"+(query?"?"+query:"");
  }

  return <div className="phase8-attendance attendance-redesign">
    <ModuleHeader
      eyebrow="Operación en campo"
      title="Asistencia"
      description="Administración de la operación en campo"
      count={canReports?enrollmentPeople.rows.length:1}
      countLabel={canReports?"personas":"sesión"}
      searchPlaceholder="Buscar persona o rol en el reporte de asistencia"
      filters={canReports?[{value:"all",label:"Todos"},{value:"active",label:"En campo"},{value:"inactive",label:"Sin jornada"}]:[{value:"all",label:"Todos"}]}
      facets={canReports?[{key:"role",label:"Rol",allLabel:"Todos los roles"}]:[]}
      contextControl={globalOperator?<form method="get" action="/dashboard/attendance" className="attendance-company-header-control">
        <input type="hidden" name="view" value={activeView}/>
        <select
          id="attendance-organization"
          name="organization_id"
          defaultValue={organizationId||""}
          required
          aria-label="Empresa de asistencia"
        >
          <option value="">Selecciona empresa</option>
          {organizations.rows.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button
          className="attendance-company-switch"
          type="submit"
          aria-label={organizationId?"Cambiar empresa":"Seleccionar empresa"}
          data-tooltip={organizationId?"Cambiar empresa":"Seleccionar empresa"}
        ><UiIcon name="reorder" size={16}/></button>
      </form>:undefined}
    />

    {canManage&&organizationId&&<ModuleNavigation
      activeHref={attendanceHref({view:activeView})}
      exact
      label="Secciones de Asistencia"
      items={[
        {label:"Configuración",href:attendanceHref({view:"setup"})},
        {label:"Operación y reportes",href:attendanceHref({view:"operation"})},
      ]}
    />}

    {feedback.saved==="policy"&&<Alert variant="success" title="Política actualizada">Política de asistencia actualizada.</Alert>}
    {feedback.saved==="site"&&<Alert variant="success" title="Geocerca actualizada">La configuración de la sede se guardó y permaneces dentro del módulo Asistencia.</Alert>}
    {feedback.error==="roles"&&<Alert variant="danger" title="Revisa la política">Selecciona al menos un rol para aplicar el control de asistencia.</Alert>}
    {feedback.error==="biometric_notice"&&<Alert variant="danger" title="Revisa la política biométrica">El título y el texto de consentimiento deben tener contenido suficiente antes de publicarse.</Alert>}

    {globalOperator&&!organizationId&&<EmptyState icon="info" title="Selecciona una empresa para administrar Asistencia" description="El contexto de empresa evita mezclar políticas, personas, sedes y biometría entre clientes. Selecciona una empresa arriba para continuar."/>}

    {canManage&&organizationId&&activeView==="setup"&&<div className="attendance-config-page">
      <section className="attendance-config-overview">
        <div>
          <span className="eyebrow">Configuración de asistencia</span>
          <h2>Reglas, sedes y cobertura biométrica</h2>
          <p>Administra desde esta pantalla lo que pertenece a Asistencia. La cobertura de enrolamiento es operativa y no bloquea la configuración.</p>
        </div>
        <div className="attendance-config-statuses">
          <Badge variant={policy.enabled?"success":"neutral"} icon="attendance">{policy.enabled?"Control activo":"Control inactivo"}</Badge>
          <Badge variant={policySaved?"success":"warning"} icon={policySaved?"check":"warning"}>{policySaved?"Política guardada":"Política por revisar"}</Badge>
        </div>
      </section>

      <section className="attendance-config-card">
        <header>
          <div><span className="attendance-config-icon"><UiIcon name="attendance" size={18}/></span><div><h3>Política y roles</h3><p>Define las reglas que controlan marcación, biometría, GPS y roles sujetos a asistencia.</p></div></div>
          <AttendanceEditGuard
            title="Política de asistencia"
            description="Modificar estas reglas puede cambiar inmediatamente cómo se validan las marcaciones y qué usuarios quedan sujetos al control."
          >
            <form method="post" action="/api/attendance/policy" className="form-grid attendance-policy-form">
              <input type="hidden" name="organization_id" value={organizationId||""}/>
              <div className="field"><label>Estado</label><select name="enabled" defaultValue={String(policy.enabled)}><option value="true">Activado</option><option value="false">Desactivado</option></select></div>
              <div className="field"><label>Biometría facial</label><select name="require_face" defaultValue={String(policy.require_face)}><option value="true">Obligatoria</option><option value="false">No requerida</option></select></div>
              <div className="field"><label>Geolocalización</label><select name="require_geolocation" defaultValue={String(policy.require_geolocation)}><option value="true">Obligatoria</option><option value="false">No requerida</option></select></div>
              <div className="field"><label>Precisión GPS máxima (m)</label><input name="max_location_accuracy_m" type="number" min="10" max="1000" defaultValue={policy.max_location_accuracy_m}/></div>
              <div className="field"><label>Coincidencia facial mínima</label><input name="face_similarity_threshold" type="number" step="0.01" min="0.30" max="0.95" defaultValue={policy.face_similarity_threshold}/></div>
              <div className="field"><label>Presencia real mínima</label><input name="liveness_threshold" type="number" step="0.01" min="0.30" max="0.99" defaultValue={policy.liveness_threshold}/></div>
              <div className="field form-span-2"><label>Roles controlados</label><div className="attendance-role-grid">{(["technician","external","provider","manager","admin"] as OrganizationRole[]).map(role=><label key={role}><input type="checkbox" name="enabled_roles" value={role} defaultChecked={policy.enabled_roles.includes(role)}/><span>{ROLE_LABELS[role]}</span></label>)}</div></div>
              <div className="field form-span-2"><label>Política biométrica · título</label><input name="biometric_notice_title" maxLength={180} defaultValue={currentBiometricNotice.title}/><small>Versión vigente: {currentBiometricNotice.version||"se publicará al guardar"}</small></div>
              <div className="field form-span-2"><label>Política biométrica · texto</label><textarea name="biometric_notice_body" rows={8} minLength={80} maxLength={12000} defaultValue={currentBiometricNotice.body}/><small>Cambiar el contenido publica una nueva versión; los consentimientos anteriores conservan la versión aceptada.</small></div>
              <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar política</button></div>
            </form>
          </AttendanceEditGuard>
        </header>
        <div className="attendance-config-summary-grid">
          <div><span>Empresa</span><strong>{organizationName}</strong></div>
          <div><span>Biometría</span><strong>{policy.require_face?"Obligatoria":"No requerida"}</strong></div>
          <div><span>Geolocalización</span><strong>{policy.require_geolocation?"Obligatoria":"No requerida"}</strong></div>
          <div><span>Roles controlados</span><strong>{policy.enabled_roles.length}</strong></div>
        </div>
        <div className="attendance-setup-role-grid">
          {(["technician","external","provider","manager","admin"] as OrganizationRole[]).map(role=><div key={role} className={policy.enabled_roles.includes(role)?"is-enabled":""}>
            <span aria-hidden="true">{policy.enabled_roles.includes(role)?<UiIcon name="check" size={13}/>:null}</span>
            <strong>{ROLE_LABELS[role]}</strong>
          </div>)}
        </div>
      </section>

      <section className="attendance-config-card">
        <header>
          <div><span className="attendance-config-icon"><UiIcon name="location" size={18}/></span><div><h3>Sedes y geocercas</h3><p>Edita aquí las coordenadas y el radio usados por Asistencia, sin salir del módulo.</p></div></div>
          <Badge variant={!policy.require_geolocation||geofencedSites===sites.rows.length?"success":"warning"}>{geofencedSites}/{sites.rows.length} con geocerca</Badge>
        </header>
        {sites.rows.length===0
          ?<EmptyState icon="info" title="No hay sedes visibles" description="Asistencia necesita al menos una sede activa dentro de tu alcance."/>
          :<div className="attendance-site-grid attendance-site-grid-editable">
            {sites.rows.map(site=><article className="card attendance-site-card" key={site.id}>
              <div><strong>{site.name}</strong><span>{site.city||"Sin ciudad"}</span></div>
              <Badge variant={site.latitude!==null&&site.longitude!==null?"success":"warning"} icon={site.latitude!==null&&site.longitude!==null?"check":"warning"}>
                {site.latitude!==null&&site.longitude!==null?site.geofence_radius_m+" m":"Sin geocerca"}
              </Badge>
              <AttendanceEditGuard
                title={"Geocerca · "+site.name}
                triggerLabel="Editar geocerca"
                description="Cambiar coordenadas o radio modifica dónde se aceptan las marcaciones con geolocalización para esta sede."
              >
                <form method="post" action={"/api/sites/"+site.id} className="form-grid attendance-geofence-form">
                  <input type="hidden" name="organization_id" value={organizationId}/>
                  <input type="hidden" name="return_to" value={attendanceHref({view:"setup"})}/>
                  <input type="hidden" name="name" value={site.name}/>
                  <input type="hidden" name="code" value={site.code||""}/>
                  <input type="hidden" name="address" value={site.address||""}/>
                  <input type="hidden" name="city" value={site.city||""}/>
                  <input type="hidden" name="country" value={site.country}/>
                  <div className="field"><label>Latitud</label><input name="latitude" type="number" step="any" min="-90" max="90" required defaultValue={site.latitude??""}/></div>
                  <div className="field"><label>Longitud</label><input name="longitude" type="number" step="any" min="-180" max="180" required defaultValue={site.longitude??""}/></div>
                  <div className="field form-span-2"><label>Radio de geocerca (m)</label><input name="geofence_radius_m" type="number" min="20" max="5000" required defaultValue={site.geofence_radius_m}/></div>
                  <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar geocerca</button></div>
                </form>
              </AttendanceEditGuard>
            </article>)}
          </div>}
        {policy.require_geolocation&&sites.rows.length>0&&geofencedSites<sites.rows.length&&<Alert variant="warning" title="Geocercas pendientes">La política exige ubicación. Completa coordenadas y radio en las sedes pendientes desde esta misma sección.</Alert>}
      </section>

      <section className="attendance-config-card attendance-config-biometric">
        <header>
          <div><span className="attendance-config-icon"><UiIcon name="user" size={18}/></span><div><h3>Cobertura biométrica</h3><p>El enrolamiento continúa durante la operación; no es un requisito para “completar” una configuración inicial.</p></div></div>
          <div className="attendance-config-statuses">
            <Badge variant={policy.require_face?"info":"neutral"}>{policy.require_face?verifiedControlled+"/"+controlledPeople.length+" verificados":"Biometría no requerida"}</Badge>
            {pendingControlled>0&&<Badge variant="warning">{pendingControlled} pendiente(s)</Badge>}
          </div>
        </header>
        {policy.require_face
          ?<BiometricEnrollmentAdmin
            organizationId={organizationId||""}
            people={controlledPeople}
            sites={sites.rows.map(site=>({
              id:site.id,name:site.name,city:site.city,latitude:site.latitude,longitude:site.longitude,geofenceRadius:site.geofence_radius_m,
            }))}
            livenessThreshold={policy.liveness_threshold}
            initialUserId={feedback.user_id||""}
          />
          :<Alert variant="info" title="Biometría no requerida">La política actual no exige enrolamiento facial. Puedes activarlo desde Política y roles si la operación lo necesita.</Alert>}
      </section>
    </div>}



    {(!canManage||activeView==="operation")&&<>
      {canManage&&organizationId&&<section className="attendance-operation-head">
        <div><span className="eyebrow">Operación diaria</span><h2>Presencia, supervisión y reportes</h2><p>La configuración queda separada de las tareas operativas para reducir scroll y mantener el foco.</p></div>
        <Badge variant={policy.enabled?"success":"neutral"} icon="attendance">{policy.enabled?"Control activo":"Control inactivo"}</Badge>
      </section>}

      {canSelf&&organizationId&&<>
        {!selfAttendanceEnabled
          ?<EmptyState icon="file" title="El control de asistencia no está habilitado para tu usuario" description="Un administrador puede habilitar tu rol en la política general o crear una condición individual para tu usuario."/>
          :<>
            <section className="section attendance-scheduled-workday">
              <div className="attendance-scheduled-workday-icon"><UiIcon name="clock" size={20}/></div>
              <div>
                <span className="eyebrow">Jornada programada</span>
                <strong>{selfScheduleRow
                  ?selfScheduledDay?.enabled
                    ?selfScheduledDay.openTime+" – "+selfScheduledDay.closeTime
                    :"Hoy no está programado como día laborable"
                  :"Sin jornada individual configurada"}</strong>
                <small>{selfScheduleRow
                  ?selfScheduleRow.base_site_name+" · "+attendanceScheduleWeeklyHours(selfScheduleRow.business_schedule).toFixed(1)+" h/semana · "+selfScheduleRow.timezone
                  :"El marcaje sigue disponible según la política de asistencia; un administrador puede asignar tu jornada individual."}</small>
              </div>
              <Badge variant={selfScheduleRow&&selfScheduledDay?.enabled?"success":"neutral"}>{selfScheduleRow&&selfScheduledDay?.enabled?"Programado":"Informativo"}</Badge>
            </section>

            <section className="section">
              {policy.require_face&&!enrolled.rowCount
                ?<SelfBiometricEnrollment
                  sites={sites.rows.map(site=>({
                    id:site.id,name:site.name,city:site.city,latitude:site.latitude,longitude:site.longitude,
                    geofenceRadius:site.geofence_radius_m,geofenceConfigured:site.latitude!==null&&site.longitude!==null,
                  }))}
                  preferredSiteId={selfScheduleRow?.base_site_id||null}
                />
                :<AttendanceCapture
                  sites={sites.rows.map(site=>({
                    id:site.id,name:site.name,city:site.city,latitude:site.latitude,longitude:site.longitude,
                    geofenceRadius:site.geofence_radius_m,geofenceConfigured:site.latitude!==null&&site.longitude!==null,
                  }))}
                  enrolled={Boolean(enrolled.rowCount)}
                  openShift={openShift.rows[0]||null}
                  requireFace={policy.require_face}
                  requireGeolocation={policy.require_geolocation}
                  maxLocationAccuracy={policy.max_location_accuracy_m}
                  livenessThreshold={policy.liveness_threshold}
                  preferredSiteId={selfScheduleRow?.base_site_id||null}
                  inTransit={Boolean(selfOpenShift?.in_transit)}
                />}
            </section>

            {selfOpenShift&&selfMovement&&<AttendanceMovement
              currentSegment={selfMovement}
              sites={sites.rows.map(site=>({
                id:site.id,name:site.name,city:site.city,latitude:site.latitude,longitude:site.longitude,
                geofenceRadius:site.geofence_radius_m,geofenceConfigured:site.latitude!==null&&site.longitude!==null,
              }))}
              tasks={selfDestinationTasks.rows}
              requireGeolocation={policy.require_geolocation}
              maxLocationAccuracy={policy.max_location_accuracy_m}
            />}

            {Boolean(enrolled.rowCount)&&!selfOpenShift?.in_transit&&<AttendanceContingencySelf
              sites={sites.rows.map(site=>({
                id:site.id,name:site.name,city:site.city,latitude:site.latitude,longitude:site.longitude,
                geofenceRadius:site.geofence_radius_m,
              }))}
              openShift={selfOpenShift?{site_id:selfOpenShift.site_id,site_name:selfOpenShift.site_name}:null}
              initialRequest={selfContingency.rows[0]||null}
            />}
          </>}
      </>}

      {canManage&&organizationId&&<UserAttendanceAuditCenter
        organizationId={organizationId}
        people={enrollmentPeople.rows.map(person=>({id:person.id,full_name:person.full_name,role:ROLE_LABELS[person.role]}))}
        initialUserId={feedback.user_id||""}
      />}

      {canManage&&organizationId&&<AttendanceContingencyReview requests={contingencyReview.rows} organizationId={organizationId}/>}

      {canReports&&organizationId&&<AttendanceOperationalReport organizationId={organizationId}/>}
    </>}
  </div>;
}
