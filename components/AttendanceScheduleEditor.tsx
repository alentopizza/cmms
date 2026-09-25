"use client";

import { useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";

export type AttendanceScheduleDay={
  day:number;
  enabled:boolean;
  startTime:string;
  endTime:string;
  breakMinutes:number;
};

export type AttendanceScheduleView={
  id:string;
  organization_id:string;
  user_id:string;
  name:string;
  weekly_schedule:AttendanceScheduleDay[];
  grace_before_minutes:number;
  grace_after_minutes:number;
  active:boolean;
  updated_at:string;
};

type Person={id:string;full_name:string;role:string};

const DAYS=[
  {day:1,label:"Lunes"},{day:2,label:"Martes"},{day:3,label:"Miércoles"},
  {day:4,label:"Jueves"},{day:5,label:"Viernes"},{day:6,label:"Sábado"},{day:7,label:"Domingo"},
];

function defaultWeek():AttendanceScheduleDay[]{
  return DAYS.map(item=>({day:item.day,enabled:item.day<=5,startTime:"08:00",endTime:"17:00",breakMinutes:60}));
}

function normalizeWeek(value:AttendanceScheduleDay[]|undefined){
  if(!Array.isArray(value)||value.length!==7)return defaultWeek();
  return DAYS.map(({day})=>{
    const current=value.find(item=>Number(item.day)===day);
    return current
      ?{day,enabled:Boolean(current.enabled),startTime:current.startTime||"08:00",endTime:current.endTime||"17:00",breakMinutes:Number(current.breakMinutes||0)}
      :{day,enabled:false,startTime:"08:00",endTime:"17:00",breakMinutes:0};
  });
}

// ── Shared administrative editor for an individual's planned workweek ──────
export default function AttendanceScheduleEditor({
  organizationId,
  people,
  schedules,
  initialUserId,
  title="Jornadas y horarios",
  description="Asigna el horario semanal de referencia. La jornada real continúa registrándose con entrada, desplazamientos y salida.",
}:{
  organizationId:string;
  people:Person[];
  schedules:AttendanceScheduleView[];
  initialUserId?:string;
  title?:string;
  description?:string;
}){
  const [scheduleByUser,setScheduleByUser]=useState<Record<string,AttendanceScheduleView>>(
    Object.fromEntries(schedules.map(item=>[item.user_id,item])),
  );
  const firstUser=initialUserId||people[0]?.id||"";
  const [userId,setUserId]=useState(firstUser);
  const current=scheduleByUser[userId];
  const [name,setName]=useState(current?.name||"Jornada principal");
  const [week,setWeek]=useState<AttendanceScheduleDay[]>(normalizeWeek(current?.weekly_schedule));
  const [graceBefore,setGraceBefore]=useState(current?.grace_before_minutes??15);
  const [graceAfter,setGraceAfter]=useState(current?.grace_after_minutes??15);
  const [active,setActive]=useState(current?.active??true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const selected=useMemo(()=>people.find(person=>person.id===userId)||null,[people,userId]);

  function loadUser(nextUserId:string){
    const next=scheduleByUser[nextUserId];
    setUserId(nextUserId);
    setName(next?.name||"Jornada principal");
    setWeek(normalizeWeek(next?.weekly_schedule));
    setGraceBefore(next?.grace_before_minutes??15);
    setGraceAfter(next?.grace_after_minutes??15);
    setActive(next?.active??true);
    setMessage("");
    setError("");
  }

  function updateDay(day:number,patch:Partial<AttendanceScheduleDay>){
    setWeek(previous=>previous.map(item=>item.day===day?{...item,...patch}:item));
  }

  async function save(){
    if(!selected){setError("Selecciona una persona.");return;}
    const enabled=week.filter(item=>item.enabled);
    if(active&&!enabled.length){setError("Activa al menos un día o desactiva temporalmente la jornada.");return;}
    for(const day of enabled){
      if(day.startTime===day.endTime){
        setError(`${DAYS.find(item=>item.day===day.day)?.label}: la hora de inicio y fin no pueden ser iguales.`);
        return;
      }
    }

    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/attendance/schedules",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          organizationId,userId:selected.id,name,weeklySchedule:week,
          graceBeforeMinutes:Number(graceBefore),graceAfterMinutes:Number(graceAfter),active,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible guardar la jornada.");
      const saved:AttendanceScheduleView={
        ...data.schedule,
        organization_id:organizationId,
        user_id:selected.id,
        weekly_schedule:data.schedule.weekly_schedule||week,
      };
      setScheduleByUser(previous=>({...previous,[selected.id]:saved}));
      setMessage(`Jornada actualizada para ${selected.full_name}.`);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible guardar la jornada.");
    }finally{
      setBusy(false);
    }
  }

  if(!people.length){
    return <section className="entity-panel attendance-schedule-editor">
      <div className="section-heading"><div><span className="eyebrow">Planificación</span><h3>{title}</h3><p className="muted">No hay personal habilitado para asignar jornadas.</p></div></div>
    </section>;
  }

  return <section className="entity-panel attendance-schedule-editor">
    <div className="section-heading">
      <div><span className="eyebrow">Planificación</span><h3>{title}</h3><p className="muted">{description}</p></div>
      <Badge variant={active?"success":"neutral"} icon="clock">{current?"Configurada":"Sin asignar"}</Badge>
    </div>

    <div className="attendance-schedule-toolbar">
      <div className="field">
        <label>Persona *</label>
        <select value={userId} onChange={event=>loadUser(event.target.value)}>
          {people.map(person=><option value={person.id} key={person.id}>{person.full_name} · {person.role}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Nombre de la jornada</label>
        <input value={name} maxLength={120} onChange={event=>setName(event.target.value)} placeholder="Ej. Jornada técnica principal"/>
      </div>
      <div className="field">
        <label>Estado</label>
        <select value={String(active)} onChange={event=>setActive(event.target.value==="true")}>
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
      </div>
    </div>

    <div className="attendance-week-grid" role="group" aria-label="Horario semanal">
      {DAYS.map(meta=>{
        const day=week.find(item=>item.day===meta.day)!;
        return <article className={"attendance-day-row "+(day.enabled?"enabled":"")} key={meta.day}>
          <label className="attendance-day-toggle">
            <input type="checkbox" checked={day.enabled} onChange={event=>updateDay(meta.day,{enabled:event.target.checked})}/>
            <span><UiIcon name={day.enabled?"check":"clock"} size={14}/></span>
            <strong>{meta.label}</strong>
          </label>
          <div className="field"><label>Inicio</label><input type="time" disabled={!day.enabled} value={day.startTime} onChange={event=>updateDay(meta.day,{startTime:event.target.value})}/></div>
          <div className="field"><label>Fin</label><input type="time" disabled={!day.enabled} value={day.endTime} onChange={event=>updateDay(meta.day,{endTime:event.target.value})}/></div>
          <div className="field"><label>Descanso (min)</label><input type="number" min="0" max="360" disabled={!day.enabled} value={day.breakMinutes} onChange={event=>updateDay(meta.day,{breakMinutes:Number(event.target.value)})}/></div>
        </article>;
      })}
    </div>

    <div className="attendance-schedule-grace">
      <div className="field"><label>Tolerancia antes (min)</label><input type="number" min="0" max="240" value={graceBefore} onChange={event=>setGraceBefore(Number(event.target.value))}/></div>
      <div className="field"><label>Tolerancia después (min)</label><input type="number" min="0" max="240" value={graceAfter} onChange={event=>setGraceAfter(Number(event.target.value))}/></div>
      <p><UiIcon name="info" size={15}/><span>Estas tolerancias quedan registradas como referencia de planificación. No convierten la asistencia en una decisión automática sobre el trabajador.</span></p>
    </div>

    {message&&<Alert variant="success" title="Jornada guardada">{message}</Alert>}
    {error&&<Alert variant="danger" title="Revisa la jornada">{error}</Alert>}
    <div className="form-actions"><Button iconLeft="check" loading={busy} onClick={save}>Guardar jornada</Button></div>
  </section>;
}
