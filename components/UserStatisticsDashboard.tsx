"use client";

import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { ProgressBar } from "@/components/ui-kit/TimelineProgress";

export type UserStatisticsDay={date:string;hours:number};
export type UserStatisticsActivity={
  id:string;
  work_order_id:string;
  order_number:string;
  order_title:string;
  description:string;
  status:string;
  due_date:string|null;
  site_name:string|null;
};

export type UserStatisticsDashboardData={
  id:string;
  name:string;
  role:string;
  company:string;
  photoUrl:string|null;
  active:boolean;
  biometricLabel:string;
  trackingLive:boolean;
  openShift:boolean;
  openShiftStartedAt:string|null;
  assignedWorkOrders:number;
  pendingActivities:number;
  completedActivities30d:number;
  completedActivities7d:number;
  attendanceHours30d:number;
  attendanceTodayHours:number;
  attendanceDaily7d:UserStatisticsDay[];
  activityCompletionRate30d:number;
  overdueActivities:number;
  upcomingActivities:UserStatisticsActivity[];
};

function clamp(value:number,min=0,max=100){return Math.min(max,Math.max(min,value));}
function dayLabel(value:string){
  const date=new Date(value+"T12:00:00");
  const label=new Intl.DateTimeFormat("es-CO",{weekday:"short"}).format(date).replace(".","");
  return label.slice(0,2).toUpperCase();
}
function dateLabel(value:string|null){
  if(!value)return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short"}).format(new Date(value+"T12:00:00"));
}
function statusTone(status:string):BadgeVariant{
  if(status==="completed")return "success";
  if(status==="in_progress")return "info";
  if(status==="pending")return "warning";
  if(status==="cancelled")return "neutral";
  return "brand";
}
function statusLabel(status:string){
  if(status==="in_progress")return "En ejecución";
  if(status==="pending")return "Pendiente";
  if(status==="completed")return "Completada";
  if(status==="cancelled")return "Cancelada";
  return status;
}

export default function UserStatisticsDashboard({data}:{data:UserStatisticsDashboardData}){
  const weeklyHours=data.attendanceDaily7d.reduce((sum,item)=>sum+Number(item.hours||0),0);
  const todayProgress=clamp((Number(data.attendanceTodayHours||0)/8)*100);
  const completedProgress=clamp(Number(data.activityCompletionRate30d||0));
  const pendingProgress=clamp(100-completedProgress);
  const latest=data.upcomingActivities.slice(0,5);

  return <section className="user-ops-dashboard">
    <div className="user-ops-welcome">
      <div>
        <span className="eyebrow">Rendimiento operativo</span>
        <h2>Resumen de {data.name.split(/\s+/)[0]}</h2>
        <p>Asistencia, actividades, carga operativa y próximos compromisos con información real del CMMS.</p>
      </div>
      <MetricGrid className="user-ops-kpis">
        <KpiCard label="OT activas" value={String(data.assignedWorkOrders)} hint="asignadas" icon="work-order"/>
        <KpiCard label="Pendientes" value={String(data.pendingActivities)} hint="actividades" icon="activity" tone={data.pendingActivities?"warning":"success"}/>
        <KpiCard label="Completadas" value={String(data.completedActivities30d)} hint="últimos 30 días" icon="check" tone="success"/>
        <KpiCard label="Horas campo" value={Number(data.attendanceHours30d||0).toFixed(1)} hint="últimos 30 días" icon="clock"/>
      </MetricGrid>
    </div>

    <div className="user-ops-layout">
      <article className="user-ops-card user-ops-profile">
        <div className="user-ops-photo">
          {data.photoUrl?<img src={data.photoUrl} alt="" />:<span><UiIcon name="user" size={42}/></span>}
          <Badge variant={data.active?"success":"neutral"}>{data.active?"Activo":"Inactivo"}</Badge>
        </div>
        <div className="user-ops-profile-copy">
          <h3>{data.name}</h3>
          <span>{data.role}</span>
          <small>{data.company}</small>
        </div>
        <div className="user-ops-profile-status">
          <div><span>Biometría</span><strong>{data.biometricLabel}</strong></div>
          <div><span>Reacción</span><strong>{data.trackingLive?"En línea":"Sin conexión"}</strong></div>
          <div><span>Turno</span><strong>{data.openShift?"Abierto":"Cerrado"}</strong></div>
        </div>
      </article>

      <article className="user-ops-card user-ops-progress">
        <div className="user-ops-card-head">
          <div><span className="eyebrow">Asistencia</span><h3>Progreso semanal</h3></div>
          <strong>{weeklyHours.toFixed(1)}h</strong>
        </div>
        <p>Horas registradas durante los últimos siete días.</p>
        <div className="user-ops-bars">
          {data.attendanceDaily7d.map(item=>{
            const height=clamp((Number(item.hours||0)/8)*100,5,100);
            return <div className="user-ops-bar-day" key={item.date}>
              <div className="user-ops-bar-track" title={Number(item.hours||0).toFixed(1)+" h"}>
                <span style={{height:height+"%"}}/>
              </div>
              <b>{Number(item.hours||0).toFixed(1)}</b>
              <small>{dayLabel(item.date)}</small>
            </div>;
          })}
        </div>
      </article>

      <article className="user-ops-card user-ops-time">
        <div className="user-ops-card-head">
          <div><span className="eyebrow">Hoy</span><h3>Tiempo de campo</h3></div>
          <UiIcon name="clock" size={18}/>
        </div>
        <div className="user-ops-time-summary"><strong>{Number(data.attendanceTodayHours||0).toFixed(1)}h</strong><span>registradas hoy</span></div>
        <ProgressBar value={todayProgress} max={100} compact tone={todayProgress>=75?"success":"brand"} caption="Referencia visual sobre una jornada de 8 h"/>
        <div className="user-ops-time-meta">
          <Badge variant={data.openShift?"success":"neutral"} icon="attendance">{data.openShift?"Turno en curso":"Sin turno abierto"}</Badge>
          <small>{data.openShiftStartedAt?"Entrada "+new Date(data.openShiftStartedAt).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}):"Biometría "+data.biometricLabel.toLowerCase()}</small>
        </div>
      </article>

      <article className="user-ops-card user-ops-compliance">
        <div className="user-ops-card-head">
          <div><span className="eyebrow">Ejecución</span><h3>Cumplimiento</h3></div>
          <strong>{completedProgress}%</strong>
        </div>
        <ProgressBar value={completedProgress} max={100} compact tone={completedProgress>=80?"success":completedProgress>=50?"warning":"danger"} caption={pendingProgress+"% pendiente"}/>
        <div className="user-ops-compliance-legend">
          <span><i className="done"/>Completadas 30 días<b>{data.completedActivities30d}</b></span>
          <span><i className="pending"/>Pendientes actuales<b>{data.pendingActivities}</b></span>
          <span><i className="overdue"/>Vencidas<b>{data.overdueActivities}</b></span>
          <span><i className="week"/>Completadas 7 días<b>{data.completedActivities7d}</b></span>
        </div>
      </article>

      <article className="user-ops-card user-ops-agenda">
        <div className="user-ops-card-head">
          <div><span className="eyebrow">Agenda</span><h3>Próximos compromisos</h3></div>
          <span className="user-ops-count">{data.upcomingActivities.length}</span>
        </div>
        {data.upcomingActivities.length?<div className="user-ops-agenda-list">
          {data.upcomingActivities.map(activity=><Link href={"/dashboard/work-orders/"+activity.work_order_id} key={activity.id} className="user-ops-agenda-row">
            <span className="user-ops-agenda-date"><strong>{dateLabel(activity.due_date)}</strong><small>OT #{activity.order_number}</small></span>
            <span className="user-ops-agenda-copy"><strong>{activity.description}</strong><small>{activity.order_title}{activity.site_name?" · "+activity.site_name:""}</small></span>
            <Badge variant={statusTone(activity.status)}>{statusLabel(activity.status)}</Badge>
          </Link>)}
        </div>:<EmptyState icon="file" title="Sin compromisos pendientes" description="No hay actividades abiertas asignadas a este usuario."/>}
      </article>

      <article className="user-ops-card user-ops-task-card">
        <div className="user-ops-card-head">
          <div><span className="eyebrow">Seguimiento</span><h3>Actividades pendientes</h3></div>
          <strong>{data.pendingActivities}</strong>
        </div>
        {latest.length?<div className="user-ops-task-list">
          {latest.map((activity,index)=><Link href={"/dashboard/work-orders/"+activity.work_order_id} key={activity.id}>
            <span className="user-ops-task-icon"><UiIcon name={activity.status==="in_progress"?"activity":"work-order"} size={15}/></span>
            <span><strong>{activity.description}</strong><small>OT #{activity.order_number} · {dateLabel(activity.due_date)}</small></span>
            <em>{String(index+1).padStart(2,"0")}</em>
          </Link>)}
        </div>:<EmptyState icon="file" title="Trabajo al día" description="No tiene actividades pendientes."/>}
      </article>
    </div>
  </section>;
}
