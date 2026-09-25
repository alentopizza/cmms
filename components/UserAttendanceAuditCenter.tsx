"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UserAttendanceScheduleAdmin from "@/components/UserAttendanceScheduleAdmin";
import UiIcon from "@/components/UiIcon";
import { Alert, EmptyState, Spinner } from "@/components/ui-kit/Feedback";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";
import { MetricGrid, KpiCard } from "@/components/ui-kit/Metrics";
import { SegmentedControl, Tabs } from "@/components/ui-kit/Navigation";
import { Timeline, type TimelineItem } from "@/components/ui-kit/TimelineProgress";
import { attendanceScheduleWeeklyHours } from "@/lib/attendance-schedules";
import type { BusinessDaySchedule } from "@/lib/business-hours";

type Person={id:string;full_name:string;role:string};

type AuditSchedule={
  id:string;
  base_site_id:string;
  base_site_name:string;
  schedule_source:"organization"|"site"|"custom";
  source_site_name:string|null;
  business_schedule:BusinessDaySchedule[];
  timezone:string;
  effective_from:string;
  effective_until:string|null;
  notes:string|null;
  created_at:string;
  updated_at:string;
};

type AuditShift={
  id:string;
  site_id:string;
  site_name:string;
  status:"open"|"closed";
  check_in_at:string;
  check_out_at:string|null;
  check_in_verification_mode:"standard"|"contingency";
  check_out_verification_mode:"standard"|"contingency"|null;
  check_in_accuracy_m:number|null;
  check_out_accuracy_m:number|null;
  check_in_distance_m:number|null;
  check_out_distance_m:number|null;
  check_in_contingency_id:string|null;
  check_out_contingency_id:string|null;
  duration_minutes:string;
  completed_activities:number;
};

type BiometricProfile={
  status:"verified"|"legacy"|"revoked"|"missing";
  enrollment_method?:string|null;
  consented_at?:string|null;
  enrolled_at?:string|null;
  identity_verified_at?:string|null;
  last_verified_at?:string|null;
  revoked_at?:string|null;
  revoked_reason?:string|null;
  enrollment_site_name?:string|null;
  enrolled_by_name?:string|null;
  revoked_by_name?:string|null;
};

type BiometricEvent={
  id:string;
  event_type:"enrolled"|"reenrolled"|"revoked";
  enrollment_method:string|null;
  occurred_at:string;
  site_name:string|null;
  actor_name:string;
  actor_platform_role:string|null;
  reason:string|null;
};

type Contingency={
  id:string;
  site_id:string;
  site_name:string;
  action:"check_in"|"check_out";
  reason_code:string;
  details:string;
  status:string;
  requested_at:string;
  reviewed_at:string|null;
  review_note:string|null;
  approved_until:string|null;
  used_at:string|null;
  reviewed_by_name:string|null;
  requester_accuracy_m:number|null;
};

type ScheduleAudit={
  id:string;
  action:string;
  entity_id:string|null;
  created_at:string;
  actor_name:string;
  actor_platform_role:string|null;
  base_site_id:string|null;
  effective_from:string|null;
  effective_until:string|null;
};

type AuditData={
  period:"30"|"90"|"365"|"all";
  today:string;
  person:{id:string;fullName:string;email:string;role:string;organizationName:string;timezone:string};
  scope:{limited:boolean;siteIds:string[]};
  summary:{
    shifts:number;
    field_hours:string;
    standard_check_ins:number;
    contingency_check_ins:number;
    open_now:boolean;
    completed_activities:number;
    contingencies:number;
  };
  currentSchedule:AuditSchedule|null;
  upcomingSchedule:AuditSchedule|null;
  biometric:BiometricProfile;
  biometricEvents:BiometricEvent[];
  shifts:AuditShift[];
  contingencies:Contingency[];
  scheduleAudit:ScheduleAudit[];
};

const PERIOD_OPTIONS=[
  {value:"30",label:"30 días"},
  {value:"90",label:"90 días"},
  {value:"365",label:"12 meses"},
  {value:"all",label:"Todo"},
];

const REASON_LABELS:Record<string,string>={
  camera_failure:"Falla de cámara",
  gps_unavailable:"GPS no disponible",
  gps_accuracy:"Precisión GPS insuficiente",
  geofence_mismatch:"Fuera de geocerca",
  connectivity:"Conectividad",
  device_issue:"Dispositivo",
  other:"Otro",
};

function fmt(value:string|null|undefined){
  if(!value)return "—";
  const date=new Date(value);
  return Number.isFinite(date.getTime())
    ?date.toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"})
    :value;
}

function dateOnly(value:string|null|undefined){
  if(!value)return "—";
  const date=new Date(value+"T12:00:00");
  return Number.isFinite(date.getTime())?date.toLocaleDateString("es-CO",{dateStyle:"medium"}):value;
}

function durationLabel(minutesValue:string|number|null|undefined){
  const minutes=Number(minutesValue||0);
  if(!Number.isFinite(minutes))return "—";
  const hours=Math.floor(minutes/60);
  const rest=Math.round(minutes%60);
  return hours?hours+" h "+rest+" min":rest+" min";
}

function biometricLabel(status:BiometricProfile["status"]){
  if(status==="verified")return "Biometría verificada";
  if(status==="legacy")return "Reenrolamiento requerido";
  if(status==="revoked")return "Biometría revocada";
  return "Sin biometría";
}

function biometricVariant(status:BiometricProfile["status"]):BadgeVariant{
  if(status==="verified")return "success";
  if(status==="legacy")return "warning";
  if(status==="revoked")return "danger";
  return "neutral";
}

function contingencyVariant(status:string):BadgeVariant{
  if(status==="used"||status==="approved")return "success";
  if(status==="pending")return "warning";
  if(status==="rejected"||status==="expired"||status==="cancelled")return "danger";
  return "neutral";
}

function contingencyLabel(status:string){
  const labels:Record<string,string>={
    pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada",used:"Utilizada",expired:"Vencida",cancelled:"Cancelada",
  };
  return labels[status]||status;
}

function modeLabel(mode:string|null){
  return mode==="contingency"?"Contingencia":"Validación estándar";
}

function scheduleSource(item:AuditSchedule){
  if(item.schedule_source==="organization")return "Plantilla de empresa";
  if(item.schedule_source==="site")return item.source_site_name?"Plantilla de "+item.source_site_name:"Plantilla de sede";
  return "Personalizado";
}

function scheduleSummary(item:AuditSchedule){
  const active=item.business_schedule.filter(day=>day.enabled).length;
  return active+" día"+(active===1?"":"s")+" · "+attendanceScheduleWeeklyHours(item.business_schedule).toFixed(1)+" h/semana";
}

function auditActionLabel(action:string){
  if(action==="attendance_schedule_created")return "Jornada programada";
  if(action==="attendance_schedule_updated")return "Jornada futura modificada";
  if(action==="attendance_schedule_deleted")return "Vigencia futura eliminada";
  return action;
}

function auditActionTone(action:string):"brand"|"success"|"warning"|"danger"|"info"|"neutral"{
  if(action==="attendance_schedule_created")return "success";
  if(action==="attendance_schedule_updated")return "info";
  if(action==="attendance_schedule_deleted")return "danger";
  return "neutral";
}

export default function UserAttendanceAuditCenter({
  organizationId,
  people,
  initialUserId="",
  lockedUserId,
}:{
  organizationId:string;
  people:Person[];
  initialUserId?:string;
  lockedUserId?:string;
}){
  const initial=lockedUserId||initialUserId||people[0]?.id||"";
  const [userId,setUserId]=useState(initial);
  const [period,setPeriod]=useState("90");
  const [data,setData]=useState<AuditData|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [activeTab,setActiveTab]=useState("summary");

  useEffect(()=>{
    const next=lockedUserId||initialUserId||people[0]?.id||"";
    setUserId(next);
  },[lockedUserId,initialUserId,people[0]?.id]);

  useEffect(()=>{
    if(!userId){setData(null);return;}
    let cancelled=false;
    setLoading(true);setError("");
    fetch("/api/attendance/users/"+encodeURIComponent(userId)+"/audit?organization_id="+encodeURIComponent(organizationId)+"&period="+period,{
      headers:{Accept:"application/json"},
    }).then(async response=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible cargar el expediente de asistencia.");
      if(!cancelled)setData(payload);
    }).catch(cause=>{
      if(!cancelled){setData(null);setError(cause instanceof Error?cause.message:"No fue posible cargar el expediente de asistencia.");}
    }).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[organizationId,userId,period]);

  const selectedPerson=useMemo(()=>people.find(person=>person.id===userId)||null,[people,userId]);
  const attendanceHref=userId?"/dashboard/attendance?organization_id="+encodeURIComponent(organizationId)+"&user_id="+encodeURIComponent(userId):"/dashboard/attendance";

  const combinedTimeline=useMemo<TimelineItem[]>(()=>{
    if(!data)return [];
    const items:Array<{at:string;item:TimelineItem}>=[];

    for(const shift of data.shifts){
      items.push({
        at:shift.check_in_at,
        item:{
          id:"shift-in-"+shift.id,
          title:"Entrada · "+shift.site_name,
          description:modeLabel(shift.check_in_verification_mode)+" · "+(shift.completed_activities||0)+" actividad(es) finalizada(s) en la jornada",
          meta:fmt(shift.check_in_at),
          icon:"attendance",
          tone:shift.check_in_verification_mode==="contingency"?"warning":"success",
        },
      });
      if(shift.check_out_at){
        items.push({
          at:shift.check_out_at,
          item:{
            id:"shift-out-"+shift.id,
            title:"Salida · "+shift.site_name,
            description:modeLabel(shift.check_out_verification_mode)+" · duración "+durationLabel(shift.duration_minutes),
            meta:fmt(shift.check_out_at),
            icon:"clock",
            tone:shift.check_out_verification_mode==="contingency"?"warning":"info",
          },
        });
      }
    }

    for(const event of data.biometricEvents){
      const label=event.event_type==="enrolled"?"Biometría enrolada":event.event_type==="reenrolled"?"Biometría reenrolada":"Biometría revocada";
      items.push({
        at:event.occurred_at,
        item:{
          id:"bio-"+event.id,
          title:label,
          description:[event.site_name,event.actor_name,event.reason].filter(Boolean).join(" · "),
          meta:fmt(event.occurred_at),
          icon:"user",
          tone:event.event_type==="revoked"?"danger":"brand",
        },
      });
    }

    for(const item of data.contingencies){
      items.push({
        at:item.requested_at,
        item:{
          id:"cont-"+item.id,
          title:"Contingencia "+(item.action==="check_in"?"de entrada":"de salida")+" · "+contingencyLabel(item.status),
          description:item.site_name+" · "+(REASON_LABELS[item.reason_code]||item.reason_code),
          meta:fmt(item.requested_at),
          icon:"warning",
          tone:item.status==="used"||item.status==="approved"?"success":item.status==="pending"?"warning":"danger",
        },
      });
    }

    for(const item of data.scheduleAudit){
      items.push({
        at:item.created_at,
        item:{
          id:"schedule-audit-"+item.id,
          title:auditActionLabel(item.action),
          description:[item.actor_name,item.effective_from?"desde "+dateOnly(item.effective_from):null].filter(Boolean).join(" · "),
          meta:fmt(item.created_at),
          icon:"clock",
          tone:auditActionTone(item.action),
        },
      });
    }

    return items
      .sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime())
      .slice(0,100)
      .map(entry=>entry.item);
  },[data]);

  const summaryContent=data?<div className="attendance-audit-summary">
    <MetricGrid className="attendance-audit-kpis">
      <KpiCard label="Jornadas" value={String(data.summary.shifts)} hint={period==="all"?"histórico visible":"periodo seleccionado"} icon="attendance" tone={data.summary.open_now?"success":"default"}/>
      <KpiCard label="Horas registradas" value={Number(data.summary.field_hours||0).toFixed(1)} hint="presencia real" icon="clock"/>
      <KpiCard label="Actividades finalizadas" value={String(data.summary.completed_activities)} hint="evidencia operativa" icon="activity"/>
      <KpiCard label="Contingencias" value={String(data.summary.contingencies)} hint="excepciones registradas" icon="warning" tone={data.summary.contingencies>0?"warning":"default"}/>
    </MetricGrid>

    <div className="attendance-audit-overview-grid">
      <article className="attendance-audit-overview-card">
        <div className="attendance-audit-card-head">
          <span className="attendance-audit-card-icon"><UiIcon name="clock" size={18}/></span>
          <div><span>Jornada programada</span><strong>{data.currentSchedule?data.currentSchedule.base_site_name:"Sin vigencia activa"}</strong></div>
        </div>
        {data.currentSchedule
          ?<><p>{scheduleSummary(data.currentSchedule)} · {scheduleSource(data.currentSchedule)}</p><small>{dateOnly(data.currentSchedule.effective_from)}{data.currentSchedule.effective_until?" → "+dateOnly(data.currentSchedule.effective_until):" · vigente hasta nuevo cambio"}</small></>
          :<p>No existe una jornada individual activa para la fecha actual.</p>}
        {data.upcomingSchedule&&<small className="attendance-audit-next">Próximo cambio: {dateOnly(data.upcomingSchedule.effective_from)} · {data.upcomingSchedule.base_site_name}</small>}
        <Button size="sm" variant="secondary" iconLeft="edit" onClick={()=>setActiveTab("schedule")}>Administrar jornada</Button>
      </article>

      <article className="attendance-audit-overview-card">
        <div className="attendance-audit-card-head">
          <span className="attendance-audit-card-icon"><UiIcon name="user" size={18}/></span>
          <div><span>Identidad biométrica</span><strong>{biometricLabel(data.biometric.status)}</strong></div>
          <Badge variant={biometricVariant(data.biometric.status)}>{data.biometric.status==="verified"?"Verificada":data.biometric.status==="legacy"?"Reenrolar":data.biometric.status==="revoked"?"Revocada":"Pendiente"}</Badge>
        </div>
        <p>{data.biometric.last_verified_at?"Última verificación: "+fmt(data.biometric.last_verified_at):"Sin verificación facial reciente registrada."}</p>
        <small>{data.biometric.enrollment_site_name?"Enrolamiento: "+data.biometric.enrollment_site_name:"El sitio de enrolamiento puede no estar disponible en tu alcance actual."}</small>
        <Link className="button secondary" href={attendanceHref+"#biometric"}><UiIcon name="attendance" size={14}/>Administrar biometría</Link>
      </article>

      <article className="attendance-audit-overview-card">
        <div className="attendance-audit-card-head">
          <span className="attendance-audit-card-icon"><UiIcon name="attendance" size={18}/></span>
          <div><span>Presencia actual</span><strong>{data.summary.open_now?"Jornada abierta":"Sin jornada abierta"}</strong></div>
          <Badge variant={data.summary.open_now?"success":"neutral"}>{data.summary.open_now?"En campo":"Sin turno"}</Badge>
        </div>
        <p>{data.summary.standard_check_ins} entrada(s) estándar · {data.summary.contingency_check_ins} por contingencia.</p>
        <Button size="sm" variant="secondary" iconLeft="file" onClick={()=>setActiveTab("shifts")}>Ver marcaciones</Button>
      </article>
    </div>

    <div className="attendance-audit-recent">
      <div className="section-heading compact"><div><span className="eyebrow">Actividad reciente</span><h3>Últimos eventos de asistencia</h3></div><Button size="sm" variant="ghost" onClick={()=>setActiveTab("timeline")}>Ver trazabilidad</Button></div>
      {combinedTimeline.length?<Timeline items={combinedTimeline.slice(0,8)} label="Eventos recientes de asistencia"/>:<EmptyState icon="file" title="Sin eventos en el periodo" description="Amplía el periodo para consultar evidencia histórica de esta persona."/>}
    </div>
  </div>:null;

  const scheduleContent=data?<UserAttendanceScheduleAdmin
    key={"schedule-"+userId}
    organizationId={organizationId}
    people={selectedPerson?[selectedPerson]:[]}
    initialUserId={userId}
    lockedUserId={userId}
  />:null;

  const shiftsContent=data?<div className="attendance-audit-list">
    {data.shifts.length?data.shifts.map(shift=><article className="attendance-audit-record" key={shift.id}>
      <div className="attendance-audit-record-head">
        <div><strong>{shift.site_name}</strong><span>{fmt(shift.check_in_at)}{shift.check_out_at?" → "+fmt(shift.check_out_at):" · jornada abierta"}</span></div>
        <Badge variant={shift.status==="open"?"success":"neutral"}>{shift.status==="open"?"Abierta":"Cerrada"}</Badge>
      </div>
      <div className="attendance-audit-record-grid">
        <div><span>Duración</span><strong>{durationLabel(shift.duration_minutes)}</strong></div>
        <div><span>Entrada</span><strong>{modeLabel(shift.check_in_verification_mode)}</strong><small>GPS ±{shift.check_in_accuracy_m===null?"—":Math.round(shift.check_in_accuracy_m)+" m"} · distancia {shift.check_in_distance_m===null?"—":Math.round(shift.check_in_distance_m)+" m"}</small></div>
        <div><span>Salida</span><strong>{shift.check_out_at?modeLabel(shift.check_out_verification_mode):"Pendiente"}</strong><small>{shift.check_out_at?"GPS ±"+(shift.check_out_accuracy_m===null?"—":Math.round(shift.check_out_accuracy_m)+" m")+" · distancia "+(shift.check_out_distance_m===null?"—":Math.round(shift.check_out_distance_m)+" m"):"La jornada aún está abierta."}</small></div>
        <div><span>Actividades</span><strong>{shift.completed_activities}</strong><small>finalizadas vinculadas a esta jornada</small></div>
      </div>
      {(shift.check_in_verification_mode==="contingency"||shift.check_out_verification_mode==="contingency")&&<Alert variant="warning" title="Jornada con excepción">Al menos una marcación se realizó mediante una contingencia previamente autorizada y auditable.</Alert>}
    </article>):<EmptyState icon="file" title="Sin marcaciones" description="No hay entradas o salidas visibles para esta persona dentro del periodo seleccionado."/>}
  </div>:null;

  const biometricContent=data?<div className="attendance-audit-biometric">
    <article className="attendance-audit-biometric-state">
      <div><span className="eyebrow">Estado actual</span><h3>{biometricLabel(data.biometric.status)}</h3><p>La foto de perfil no es la plantilla biométrica. El estado se deriva del enrolamiento facial supervisado y su revocación.</p></div>
      <Badge variant={biometricVariant(data.biometric.status)} icon="attendance">{data.biometric.status==="verified"?"Activa":data.biometric.status==="legacy"?"Legada":data.biometric.status==="revoked"?"Revocada":"Sin enrolar"}</Badge>
      <dl>
        <div><dt>Enrolado</dt><dd>{fmt(data.biometric.enrolled_at)}</dd></div>
        <div><dt>Identidad verificada</dt><dd>{fmt(data.biometric.identity_verified_at)}</dd></div>
        <div><dt>Última verificación</dt><dd>{fmt(data.biometric.last_verified_at)}</dd></div>
        <div><dt>Sede enrolamiento</dt><dd>{data.biometric.enrollment_site_name||"—"}</dd></div>
        <div><dt>Supervisor</dt><dd>{data.biometric.enrolled_by_name||"—"}</dd></div>
        {data.biometric.revoked_at&&<div><dt>Revocada</dt><dd>{fmt(data.biometric.revoked_at)}{data.biometric.revoked_by_name?" · "+data.biometric.revoked_by_name:""}{data.biometric.revoked_reason?" · "+data.biometric.revoked_reason:""}</dd></div>}
      </dl>
      <Link className="button" href={attendanceHref+"#biometric"}><UiIcon name="user" size={14}/>{data.biometric.status==="verified"?"Administrar / reenrolar":"Abrir enrolamiento supervisado"}</Link>
    </article>
    <div className="attendance-audit-recent">
      <div className="section-heading compact"><div><span className="eyebrow">Cadena de identidad</span><h3>Eventos biométricos</h3></div></div>
      {data.biometricEvents.length?<Timeline items={data.biometricEvents.map(event=>({
        id:event.id,
        title:event.event_type==="enrolled"?"Enrolamiento supervisado":event.event_type==="reenrolled"?"Reenrolamiento supervisado":"Revocación biométrica",
        description:[event.site_name,event.actor_name,event.reason].filter(Boolean).join(" · "),
        meta:fmt(event.occurred_at),
        icon:"user",
        tone:event.event_type==="revoked"?"danger":"brand",
      }))} label="Historial biométrico"/>:<EmptyState icon="file" title="Sin eventos biométricos" description="No hay eventos biométricos visibles en el periodo seleccionado."/>}
    </div>
  </div>:null;

  const contingencyContent=data?<div className="attendance-audit-list">
    {data.contingencies.length?data.contingencies.map(item=><article className="attendance-audit-record" key={item.id}>
      <div className="attendance-audit-record-head">
        <div><strong>{item.action==="check_in"?"Contingencia de entrada":"Contingencia de salida"} · {item.site_name}</strong><span>Solicitada {fmt(item.requested_at)}</span></div>
        <Badge variant={contingencyVariant(item.status)} icon="warning">{contingencyLabel(item.status)}</Badge>
      </div>
      <div className="attendance-audit-record-grid">
        <div><span>Motivo</span><strong>{REASON_LABELS[item.reason_code]||item.reason_code}</strong></div>
        <div><span>Revisión</span><strong>{item.reviewed_by_name||"Sin revisar"}</strong><small>{fmt(item.reviewed_at)}</small></div>
        <div><span>Vigencia aprobación</span><strong>{fmt(item.approved_until)}</strong></div>
        <div><span>Uso</span><strong>{fmt(item.used_at)}</strong></div>
      </div>
      <p>{item.details}</p>
      {item.review_note&&<small className="attendance-audit-note">Nota de revisión: {item.review_note}</small>}
    </article>):<EmptyState icon="file" title="Sin contingencias" description="No hay excepciones de validación registradas en el periodo seleccionado."/>}
  </div>:null;

  const timelineContent=data?(combinedTimeline.length
    ?<div className="attendance-audit-timeline"><Timeline items={combinedTimeline} label="Trazabilidad consolidada de asistencia"/></div>
    :<EmptyState icon="file" title="Sin trazabilidad en el periodo" description="No existen eventos visibles para el periodo y alcance seleccionados."/>):null;

  return <section id="attendance-audit" className="attendance-audit-center">
    <div className="attendance-audit-head">
      <div>
        <span className="eyebrow">Fase 3 · expediente individual</span>
        <h2>Administración y auditoría de asistencia</h2>
        <p>Consulta en una sola vista jornada programada, biometría, marcaciones reales, contingencias e historial administrativo.</p>
      </div>
      <SegmentedControl items={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Periodo del expediente"/>
    </div>

    {!lockedUserId&&<div className="field attendance-audit-person">
      <label>Persona</label>
      <select value={userId} onChange={event=>{setUserId(event.target.value);setActiveTab("summary");}}>
        <option value="">Selecciona una persona</option>
        {people.map(person=><option key={person.id} value={person.id}>{person.full_name} · {person.role}</option>)}
      </select>
    </div>}

    {loading&&<div className="attendance-audit-loading"><Spinner label="Cargando expediente de asistencia"/></div>}
    {error&&<Alert variant="danger" title="No fue posible cargar el expediente">{error}</Alert>}
    {data?.scope.limited&&<Alert variant="info" title="Vista limitada por sedes">Este expediente muestra únicamente eventos de las sedes incluidas en tu alcance actual. Los registros de otras sedes no se exponen desde esta sesión.</Alert>}

    {!loading&&!userId&&<EmptyState icon="info" title="Selecciona una persona" description="Elige a quién deseas administrar o auditar dentro del contexto de empresa actual."/>}

    {!loading&&data&&<Tabs
      activeId={activeTab}
      onChange={setActiveTab}
      label={"Expediente de asistencia de "+data.person.fullName}
      items={[
        {id:"summary",label:"Resumen",content:summaryContent},
        {id:"schedule",label:"Jornada",content:scheduleContent},
        {id:"shifts",label:"Marcaciones",content:shiftsContent},
        {id:"biometric",label:"Biometría",content:biometricContent},
        {id:"contingencies",label:"Contingencias",content:contingencyContent},
        {id:"timeline",label:"Trazabilidad",content:timelineContent},
      ]}
    />}
  </section>;
}
