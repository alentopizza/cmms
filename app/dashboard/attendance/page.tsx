import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOperator, ROLE_LABELS, type OrganizationRole } from "@/lib/permissions";
import { query } from "@/lib/db";
import AttendanceCapture from "@/components/AttendanceCapture";
import SupervisedBiometricEnrollment from "@/components/SupervisedBiometricEnrollment";
import { AttendanceContingencyReview, AttendanceContingencySelf, type ContingencyRequestView, type ContingencyReviewItem } from "@/components/AttendanceContingency";
import { DEFAULT_ATTENDANCE_POLICY, attendanceRoleEnabled } from "@/lib/attendance-policy";
import ModuleHeader from "@/components/ModuleHeader";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { attendanceOrganizationId } from "@/lib/attendance-context";

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

type ReportRow={
  user_id:string;
  full_name:string;
  role:OrganizationRole;
  shifts:number;
  field_hours:string;
  completed_in_shift:number;
  completed_outside_shift:number;
  avg_activity_minutes:string|null;
  last_check_in:string|null;
  open_now:boolean;
  contingency_events:number;
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

  const openShift=canSelf && session.userId
    ? await query<{id:string;site_id:string;site_name:string;check_in_at:string}>(
        `SELECT a.id,a.site_id,s.name site_name,a.check_in_at::text
         FROM attendance_shifts a JOIN sites s ON s.id=a.site_id
         WHERE a.user_id=$1 AND a.status='open' LIMIT 1`,
        [session.userId],
      )
    : {rows:[]} as {rows:Array<{id:string;site_id:string;site_name:string;check_in_at:string}>};

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
    : {rows:[]} as {rows:EnrollmentPerson[]};

  const reports=canReports && organizationId
    ? session.platformRole!=="user"
      ? await query<ReportRow>(
          `SELECT u.id user_id,u.full_name,om.role,
                  COALESCE(sh.shifts,0)::int shifts,
                  COALESCE(sh.field_hours,0)::text field_hours,
                  COALESCE(ev.completed_in_shift,0)::int completed_in_shift,
                  COALESCE(ev.completed_outside_shift,0)::int completed_outside_shift,
                  ev.avg_activity_minutes::text avg_activity_minutes,
                  sh.last_check_in::text last_check_in,
                  COALESCE(sh.open_now,false) open_now,
                  COALESCE(sh.contingency_events,0)::int contingency_events
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           LEFT JOIN LATERAL (
             SELECT count(*)::int shifts,
                    round(COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(s.check_out_at,now())-s.check_in_at))),0)/3600.0::numeric,2) field_hours,
                    max(s.check_in_at) last_check_in,
                    bool_or(s.status='open') open_now,
                    count(*) FILTER (
                      WHERE s.check_in_verification_mode='contingency'
                         OR s.check_out_verification_mode='contingency'
                    )::int contingency_events
             FROM attendance_shifts s
             WHERE s.user_id=u.id AND s.organization_id=om.organization_id
               AND s.check_in_at>=now()-interval '30 days'
           ) sh ON true
           LEFT JOIN LATERAL (
             SELECT count(*) FILTER (WHERE x.within_shift)::int completed_in_shift,
                    count(*) FILTER (WHERE NOT x.within_shift)::int completed_outside_shift,
                    round(avg(x.duration_minutes)::numeric,1) avg_activity_minutes
             FROM (
               SELECT DISTINCT ON (e.task_id)
                      e.task_id,e.within_shift,
                      CASE WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL
                           THEN EXTRACT(EPOCH FROM (t.completed_at-t.started_at))/60.0 END duration_minutes
               FROM activity_execution_events e
               JOIN work_order_tasks t ON t.id=e.task_id
               WHERE e.user_id=u.id AND e.organization_id=om.organization_id
                 AND e.event_type='completed'
                 AND e.occurred_at>=now()-interval '30 days'
               ORDER BY e.task_id,e.occurred_at DESC
             ) x
           ) ev ON true
           WHERE om.organization_id=$1 AND om.role IN ('technician','external','provider','manager','admin')
           ORDER BY u.full_name`,
          [organizationId],
        )
      : await query<ReportRow>(
            `SELECT u.id user_id,u.full_name,om.role,
                    COALESCE(sh.shifts,0)::int shifts,
                    COALESCE(sh.field_hours,0)::text field_hours,
                    COALESCE(ev.completed_in_shift,0)::int completed_in_shift,
                    COALESCE(ev.completed_outside_shift,0)::int completed_outside_shift,
                    ev.avg_activity_minutes::text avg_activity_minutes,
                    sh.last_check_in::text last_check_in,
                    COALESCE(sh.open_now,false) open_now,
                    COALESCE(sh.contingency_events,0)::int contingency_events
             FROM organization_members om
             JOIN users u ON u.id=om.user_id
             LEFT JOIN LATERAL (
               SELECT count(*)::int shifts,
                      round(COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(s.check_out_at,now())-s.check_in_at))),0)/3600.0::numeric,2) field_hours,
                      max(s.check_in_at) last_check_in,
                      bool_or(s.status='open') open_now,
                      count(*) FILTER (
                        WHERE s.check_in_verification_mode='contingency'
                           OR s.check_out_verification_mode='contingency'
                      )::int contingency_events
               FROM attendance_shifts s
               WHERE s.user_id=u.id AND s.organization_id=$1
                 AND s.check_in_at>=now()-interval '30 days'
             ) sh ON true
             LEFT JOIN LATERAL (
               SELECT count(*) FILTER (WHERE x.within_shift)::int completed_in_shift,
                      count(*) FILTER (WHERE NOT x.within_shift)::int completed_outside_shift,
                      round(avg(x.duration_minutes)::numeric,1) avg_activity_minutes
               FROM (
                 SELECT DISTINCT ON (e.task_id)
                        e.task_id,e.within_shift,
                        CASE WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL
                             THEN EXTRACT(EPOCH FROM (t.completed_at-t.started_at))/60.0 END duration_minutes
                 FROM activity_execution_events e
                 JOIN work_order_tasks t ON t.id=e.task_id
                 WHERE e.user_id=u.id AND e.organization_id=$1
                   AND e.event_type='completed'
                   AND e.occurred_at>=now()-interval '30 days'
                 ORDER BY e.task_id,e.occurred_at DESC
               ) x
             ) ev ON true
             WHERE om.organization_id=$1 AND om.role IN ('technician','external','provider','manager','admin')
             ORDER BY u.full_name`,
            [organizationId],
          )
    : {rows:[]} as {rows:ReportRow[]};

  const activeNow=reports.rows.filter(row=>row.open_now).length;
  const totalHours=reports.rows.reduce((sum,row)=>sum+Number(row.field_hours||0),0);
  const completedInShift=reports.rows.reduce((sum,row)=>sum+row.completed_in_shift,0);

  return <div className="phase8-attendance">
    <ModuleHeader
      eyebrow="Operación en campo"
      title="Presencia y actividades"
      description="Valida presencia física en sitio con GPS y rostro en vivo. La jornada puede iniciar aunque todavía no existan actividades asignadas."
      count={canReports?reports.rows.length:1}
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
      <Badge variant={activeNow>0?"success":"neutral"} icon="attendance">{activeNow} en campo</Badge>
    </section>

    {feedback.saved==="policy" && <div className="section"><Alert variant="success" title="Política actualizada">Política de asistencia actualizada.</Alert></div>}
    {feedback.error==="roles" && <div className="section"><Alert variant="danger" title="Revisa la política">Selecciona al menos un rol para aplicar el control de asistencia.</Alert></div>}

    {globalOperator&&!organizationId&&<section className="section"><EmptyState icon="company" title="Selecciona una empresa para administrar Asistencia" description="El contexto de empresa evita mezclar políticas, personas, sedes y biometría entre clientes. Selecciona una empresa arriba para continuar."/></section>}

    {canSelf && organizationId && <>
      {!policy.enabled || !attendanceRoleEnabled(session, policy.enabled_roles)
        ? <section className="section"><EmptyState icon="file" title="El control de asistencia no está habilitado para tu rol" description="Un administrador puede activarlo desde la política de asistencia."/></section>
        : <>
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
              />
            </section>
            {Boolean(enrolled.rowCount) && <AttendanceContingencySelf
              sites={sites.rows.map(site=>({
        id:site.id,
        name:site.name,
        city:site.city,
        latitude:site.latitude,
        longitude:site.longitude,
        geofenceRadius:site.geofence_radius_m,
      }))}
              openShift={openShift.rows[0]?{site_id:openShift.rows[0].site_id,site_name:openShift.rows[0].site_name}:null}
              initialRequest={selfContingency.rows[0]||null}
            />}
          </>
      }
    </>}

    {canManage && organizationId && <AttendanceContingencyReview requests={contingencyReview.rows} />}

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

    {canReports && organizationId && <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Últimos 30 días</span><h2>Estadísticas de operación en campo</h2><p className="muted">Datos descriptivos para análisis humano: no son un ranking ni una calificación automática de desempeño.</p></div></div>
      <MetricGrid className="attendance-summary-grid phase8-attendance-kpis">
        <KpiCard label="Personal con jornada abierta" value={String(activeNow)} hint="en este momento" icon="attendance" tone={activeNow>0?"success":"default"}/>
        <KpiCard label="Horas registradas" value={totalHours.toFixed(1)} hint="últimos 30 días" icon="clock"/>
        <KpiCard label="Actividades finalizadas en jornada" value={String(completedInShift)} hint="cruce horario descriptivo" icon="check" tone="success"/>
      </MetricGrid>
      <StaticDataTable
        className="attendance-report-table"
        caption="Estadísticas descriptivas de asistencia de los últimos 30 días"
        columns={[
          {key:"person",label:"Persona"},{key:"role",label:"Rol"},{key:"shifts",label:"Jornadas",align:"end"},
          {key:"hours",label:"Horas campo",align:"end"},{key:"inside",label:"Act. en jornada",align:"end"},
          {key:"outside",label:"Act. fuera de jornada",align:"end"},{key:"average",label:"Duración media act."},
          {key:"contingencies",label:"Contingencias",align:"end"},{key:"state",label:"Estado"},
        ]}
        rows={reports.rows.map(row=>({id:row.user_id,recordProps:{
          "data-module-record":true,
          "data-status":row.open_now?"active":"inactive",
          "data-search":[row.full_name,ROLE_LABELS[row.role]].join(" "),
          "data-filter-role":row.role,
          "data-filter-role-label":ROLE_LABELS[row.role],
        },cells:{
          person:<span><strong>{row.full_name}</strong>{row.last_check_in&&<small className="table-subline">Última entrada: {new Date(row.last_check_in).toLocaleString("es-CO")}</small>}</span>,
          role:ROLE_LABELS[row.role],shifts:row.shifts,hours:Number(row.field_hours).toFixed(1)+" h",
          inside:row.completed_in_shift,outside:row.completed_outside_shift,
          average:row.avg_activity_minutes?row.avg_activity_minutes+" min":"—",contingencies:row.contingency_events,
          state:<Badge variant={row.open_now?"success":"neutral"}>{row.open_now?"En campo":"Sin jornada"}</Badge>,
        }}))}
        empty={<EmptyState icon="file" title="Aún no hay datos de asistencia" description="Los registros aparecerán cuando el personal habilitado empiece a marcar entrada y salida."/>}
      />
    </section>}
  </div>;
}
