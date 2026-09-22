import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, ROLE_LABELS, type OrganizationRole } from "@/lib/permissions";
import { query } from "@/lib/db";
import AttendanceCapture from "@/components/AttendanceCapture";
import SupervisedBiometricEnrollment from "@/components/SupervisedBiometricEnrollment";
import { DEFAULT_ATTENDANCE_POLICY, attendanceRoleEnabled } from "@/lib/attendance-policy";

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
};

// ── Page orchestration: policy, sites, enrollment and reports ────────────────

export default async function AttendancePage({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  const canSelf=can(session,"attendance.self");
  const canManage=can(session,"attendance.manage");
  const canReports=can(session,"attendance.reports");
  if(!canSelf && !canManage && !canReports) redirect("/dashboard");

  const feedback=await searchParams;
  const organizationId=session.organizationId;

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

  const reports=canReports
    ? session.platformRole!=="user"
      ? await query<ReportRow>(
          `SELECT u.id user_id,u.full_name,om.role,
                  COALESCE(sh.shifts,0)::int shifts,
                  COALESCE(sh.field_hours,0)::text field_hours,
                  COALESCE(ev.completed_in_shift,0)::int completed_in_shift,
                  COALESCE(ev.completed_outside_shift,0)::int completed_outside_shift,
                  ev.avg_activity_minutes::text avg_activity_minutes,
                  sh.last_check_in::text last_check_in,
                  COALESCE(sh.open_now,false) open_now
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           LEFT JOIN LATERAL (
             SELECT count(*)::int shifts,
                    round(COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(s.check_out_at,now())-s.check_in_at))),0)/3600.0::numeric,2) field_hours,
                    max(s.check_in_at) last_check_in,
                    bool_or(s.status='open') open_now
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
           WHERE om.role IN ('technician','external','provider','manager','admin')
           ORDER BY u.full_name`,
        )
      : organizationId
        ? await query<ReportRow>(
            `SELECT u.id user_id,u.full_name,om.role,
                    COALESCE(sh.shifts,0)::int shifts,
                    COALESCE(sh.field_hours,0)::text field_hours,
                    COALESCE(ev.completed_in_shift,0)::int completed_in_shift,
                    COALESCE(ev.completed_outside_shift,0)::int completed_outside_shift,
                    ev.avg_activity_minutes::text avg_activity_minutes,
                    sh.last_check_in::text last_check_in,
                    COALESCE(sh.open_now,false) open_now
             FROM organization_members om
             JOIN users u ON u.id=om.user_id
             LEFT JOIN LATERAL (
               SELECT count(*)::int shifts,
                      round(COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(s.check_out_at,now())-s.check_in_at))),0)/3600.0::numeric,2) field_hours,
                      max(s.check_in_at) last_check_in,
                      bool_or(s.status='open') open_now
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
        : {rows:[]} as {rows:ReportRow[]}
    : {rows:[]} as {rows:ReportRow[]};

  const activeNow=reports.rows.filter(row=>row.open_now).length;
  const totalHours=reports.rows.reduce((sum,row)=>sum+Number(row.field_hours||0),0);
  const completedInShift=reports.rows.reduce((sum,row)=>sum+row.completed_in_shift,0);

  return <>
    <header className="page-header">
      <div><span className="eyebrow">Operación en campo</span><h1 className="page-title">Presencia y actividades</h1><p className="muted">Valida presencia física en sitio con GPS y rostro en vivo. La jornada puede iniciar aunque todavía no existan actividades asignadas.</p></div>
      <div className="brand-pill"><span /> {activeNow} en campo</div>
    </header>

    {feedback.saved==="policy" && <div className="notice success section">Política de asistencia actualizada.</div>}
    {feedback.error==="roles" && <div className="notice error section">Selecciona al menos un rol para aplicar el control de asistencia.</div>}

    {canSelf && organizationId && <>
      {!policy.enabled || !attendanceRoleEnabled(session, policy.enabled_roles) ? <section className="card section empty-state"><strong>El control de asistencia no está habilitado para tu rol.</strong><span>Un administrador puede activarlo desde la política de asistencia.</span></section> :
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
      </section>}
    </>}

    {canManage && organizationId && <SupervisedBiometricEnrollment
      people={enrollmentPeople.rows}
      sites={sites.rows.map(site=>({id:site.id,name:site.name,city:site.city}))}
      livenessThreshold={policy.liveness_threshold}
    />}

    {canManage && organizationId && <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Política de empresa</span><h2>Control de asistencia</h2><p className="muted">Define a qué roles aplica y qué verificaciones deben superar. La configuración no toma decisiones laborales automáticas.</p></div><span className={"setup-flow-state "+(policy.enabled?"ready":"blocked")}>{policy.enabled?"Activo":"Inactivo"}</span></div>
      <form method="post" action="/api/attendance/policy" className="form-grid">
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
      <div className="attendance-site-grid">{sites.rows.map(site=><article className="card attendance-site-card" key={site.id}><div><strong>{site.name}</strong><span>{site.city||"Sin ciudad"}</span></div><span className={"setup-flow-state "+(site.latitude!==null&&site.longitude!==null?"ready":"blocked")}>{site.latitude!==null&&site.longitude!==null ? site.geofence_radius_m+" m":"Sin geocerca"}</span><Link className="text-button" href={"/dashboard/locations/"+site.id}>Configurar →</Link></article>)}</div>
    </section>}

    {canReports && <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Últimos 30 días</span><h2>Estadísticas de operación en campo</h2><p className="muted">Datos descriptivos para análisis humano: no son un ranking ni una calificación automática de desempeño.</p></div></div>
      <div className="attendance-summary-grid">
        <article className="card compact-metric"><span>Personal con jornada abierta</span><strong>{activeNow}</strong><small>en este momento</small></article>
        <article className="card compact-metric"><span>Horas registradas</span><strong>{totalHours.toFixed(1)}</strong><small>últimos 30 días</small></article>
        <article className="card compact-metric"><span>Actividades finalizadas en jornada</span><strong>{completedInShift}</strong><small>cruce horario descriptivo</small></article>
      </div>
      {reports.rows.length ? <div className="attendance-report-table-wrap"><table className="table attendance-report-table"><thead><tr><th>Persona</th><th>Rol</th><th>Jornadas</th><th>Horas campo</th><th>Act. en jornada</th><th>Act. fuera de jornada</th><th>Duración media act.</th><th>Estado</th></tr></thead><tbody>{reports.rows.map(row=><tr key={row.user_id}><td><strong>{row.full_name}</strong>{row.last_check_in&&<small className="table-subline">Última entrada: {new Date(row.last_check_in).toLocaleString("es-CO")}</small>}</td><td>{ROLE_LABELS[row.role]}</td><td>{row.shifts}</td><td>{Number(row.field_hours).toFixed(1)} h</td><td>{row.completed_in_shift}</td><td>{row.completed_outside_shift}</td><td>{row.avg_activity_minutes ? row.avg_activity_minutes+" min":"—"}</td><td><span className={"status-badge "+(row.open_now?"status-active":"status-inactive")}><i />{row.open_now?"En campo":"Sin jornada"}</span></td></tr>)}</tbody></table></div> : <div className="card empty-state"><strong>Aún no hay datos de asistencia.</strong><span>Los registros aparecerán cuando el personal habilitado empiece a marcar entrada y salida.</span></div>}
    </section>}
  </>;
}
