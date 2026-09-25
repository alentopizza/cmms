"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import BusinessHoursFields from "@/components/BusinessHoursFields";
import ConfirmDialog from "@/components/ConfirmDialog";
import UiIcon from "@/components/UiIcon";
import { Alert, EmptyState, Spinner } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";
import {
  attendanceScheduleWeeklyHours,
  scheduleStatus,
  type AttendanceScheduleRecord,
  type AttendanceScheduleSource,
} from "@/lib/attendance-schedules";
import type { BusinessDaySchedule } from "@/lib/business-hours";

type Person={id:string;full_name:string;role:string};
type ScheduleSite={id:string;name:string;schedule:BusinessDaySchedule[]};
type ContextData={
  user:{id:string;fullName:string;role:string};
  organization:{id:string;name:string;timezone:string;schedule:BusinessDaySchedule[]};
  sites:ScheduleSite[];
  today:string;
  schedules:AttendanceScheduleRecord[];
  hiddenScheduleCount:number;
};

function addDays(date:string,days:number){
  const value=new Date(date+"T12:00:00Z");
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

function sourceLabel(item:AttendanceScheduleRecord){
  if(item.schedule_source==="organization")return "Copia de empresa";
  if(item.schedule_source==="site")return item.source_site_name?"Copia de "+item.source_site_name:"Copia de sede";
  return "Personalizado";
}

function statusBadge(item:AttendanceScheduleRecord,today:string){
  const status=scheduleStatus(item.effective_from,item.effective_until,today);
  if(status==="current")return <Badge variant="success" icon="attendance">Vigente</Badge>;
  if(status==="upcoming")return <Badge variant="info" icon="clock">Próxima</Badge>;
  return <Badge variant="neutral" icon="file">Histórica</Badge>;
}

function scheduleSummary(schedule:BusinessDaySchedule[]){
  const active=schedule.filter(item=>item.enabled);
  return active.length+" día"+(active.length===1?"":"s")+" · "+attendanceScheduleWeeklyHours(schedule).toFixed(1)+" h/semana";
}

export default function UserAttendanceScheduleAdmin({
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
  const [data,setData]=useState<ContextData|null>(null);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [formOpen,setFormOpen]=useState(false);
  const [baseSiteId,setBaseSiteId]=useState("");
  const [sourceType,setSourceType]=useState<AttendanceScheduleSource>("custom");
  const [sourceSiteId,setSourceSiteId]=useState("");
  const [effectiveFrom,setEffectiveFrom]=useState("");
  const [effectiveUntil,setEffectiveUntil]=useState("");
  const [notes,setNotes]=useState("");
  const [editorSchedule,setEditorSchedule]=useState<BusinessDaySchedule[]>([]);
  const [editorVersion,setEditorVersion]=useState(0);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const formRef=useRef<HTMLFormElement>(null);

  useEffect(()=>{
    const next=lockedUserId||initialUserId||people[0]?.id||"";
    setUserId(next);
  },[lockedUserId,initialUserId,people[0]?.id]);

  useEffect(()=>{
    if(!userId){setData(null);return;}
    let cancelled=false;
    setLoading(true);setError("");setMessage("");
    fetch("/api/attendance/schedules?organization_id="+encodeURIComponent(organizationId)+"&user_id="+encodeURIComponent(userId),{
      headers:{Accept:"application/json"},
    }).then(async response=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible cargar la jornada individual.");
      if(!cancelled)setData(payload);
    }).catch(cause=>{
      if(!cancelled){setData(null);setError(cause instanceof Error?cause.message:"No fue posible cargar la jornada individual.");}
    }).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[organizationId,userId]);

  const current=useMemo(()=>{
    if(!data)return null;
    return data.schedules.find(item=>scheduleStatus(item.effective_from,item.effective_until,data.today)==="current")||null;
  },[data]);
  const upcoming=useMemo(()=>data?.schedules.filter(item=>scheduleStatus(item.effective_from,item.effective_until,data.today)==="upcoming")||[],[data]);

  function resetEditor(schedule?:AttendanceScheduleRecord){
    if(!data)return;
    if(schedule){
      setEditingId(schedule.id);
      setBaseSiteId(schedule.base_site_id);
      setSourceType(schedule.schedule_source);
      setSourceSiteId(schedule.source_site_id||"");
      setEffectiveFrom(schedule.effective_from);
      setEffectiveUntil(schedule.effective_until||"");
      setNotes(schedule.notes||"");
      setEditorSchedule(schedule.business_schedule);
    }else{
      setEditingId(null);
      const site=data.sites[0];
      setBaseSiteId(current?.base_site_id||site?.id||"");
      setSourceType(current?"custom":"organization");
      setSourceSiteId("");
      setEffectiveFrom(current?addDays(data.today,1):data.today);
      setEffectiveUntil("");
      setNotes("");
      setEditorSchedule(current?.business_schedule||data.organization.schedule);
    }
    setEditorVersion(value=>value+1);
    setFormOpen(true);
    setMessage("");setError("");
  }

  function copyOrganization(){
    if(!data)return;
    setEditorSchedule(data.organization.schedule);
    setSourceType("organization");
    setSourceSiteId("");
    setEditorVersion(value=>value+1);
  }

  function copyBaseSite(){
    const site=data?.sites.find(item=>item.id===baseSiteId);
    if(!site){setError("Selecciona primero una sede base.");return;}
    setEditorSchedule(site.schedule);
    setSourceType("site");
    setSourceSiteId(site.id);
    setEditorVersion(value=>value+1);
    setError("");
  }

  function markCustom(){
    setSourceType("custom");
    setSourceSiteId("");
  }

  async function reload(successMessage?:string){
    if(!userId)return;
    const response=await fetch("/api/attendance/schedules?organization_id="+encodeURIComponent(organizationId)+"&user_id="+encodeURIComponent(userId),{
      headers:{Accept:"application/json"},
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.message||"No fue posible actualizar la jornada.");
    setData(payload);
    if(successMessage)setMessage(successMessage);
  }

  async function save(event:FormEvent){
    event.preventDefault();
    if(!data||!formRef.current)return;
    const formData=new FormData(formRef.current);
    let schedule:unknown;
    try{schedule=JSON.parse(String(formData.get("work_schedule_json")||"[]"));}
    catch{setError("El horario semanal no tiene un formato válido.");return;}
    if(!baseSiteId||!effectiveFrom){setError("Selecciona sede base y fecha de inicio.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/attendance/schedules",{
        method:editingId?"PATCH":"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          organizationId,
          userId,
          scheduleId:editingId,
          baseSiteId,
          sourceType,
          sourceSiteId:sourceType==="site"?sourceSiteId:null,
          effectiveFrom,
          effectiveUntil:effectiveUntil||null,
          notes,
          schedule,
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible guardar la jornada individual.");
      setFormOpen(false);setEditingId(null);
      await reload(payload.message||"Jornada individual actualizada.");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible guardar la jornada individual.");
    }finally{
      setBusy(false);
    }
  }

  async function remove(){
    if(!deleteId)return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/attendance/schedules",{
        method:"DELETE",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({organizationId,userId,scheduleId:deleteId}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible eliminar la vigencia.");
      setDeleteId(null);
      await reload(payload.message||"Vigencia futura eliminada.");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible eliminar la vigencia.");
    }finally{
      setBusy(false);
    }
  }

  return <section id="schedule" className="card section attendance-schedule-admin">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Fase 2 · jornada individual</span>
        <h2>Horario programado por persona</h2>
        <p className="muted">Define sede base, vigencia y horas por día. El horario programado describe la jornada esperada; no bloquea un marcaje real fuera de horario.</p>
      </div>
      {!formOpen&&userId&&<Button iconLeft="plus" onClick={()=>resetEditor()}>Nueva vigencia</Button>}
    </div>

    {!lockedUserId&&<div className="field attendance-schedule-person">
      <label>Persona</label>
      <select value={userId} onChange={event=>{setUserId(event.target.value);setFormOpen(false);}}>
        <option value="">Selecciona una persona</option>
        {people.map(person=><option key={person.id} value={person.id}>{person.full_name} · {person.role}</option>)}
      </select>
    </div>}

    {loading&&<div className="attendance-schedule-loading"><Spinner label="Cargando jornada individual"/></div>}
    {message&&<Alert variant="success" title="Jornada actualizada">{message}</Alert>}
    {error&&<Alert variant="danger" title="Revisa la jornada">{error}</Alert>}

    {!loading&&userId&&data&&<>
      <div className="attendance-schedule-context">
        <div>
          <span>Empresa</span>
          <strong>{data.organization.name}</strong>
          <small>{data.organization.timezone}</small>
        </div>
        <div>
          <span>Jornada vigente</span>
          <strong>{current?current.base_site_name:"Sin vigencia activa"}</strong>
          <small>{current?scheduleSummary(current.business_schedule):"Configura la primera jornada individual"}</small>
        </div>
        <div>
          <span>Próximos cambios</span>
          <strong>{upcoming.length}</strong>
          <small>{upcoming.length?"vigencia(s) programada(s)":"Sin cambios futuros"}</small>
        </div>
      </div>

      {current&&<article className="attendance-schedule-current">
        <div className="attendance-schedule-current-icon"><UiIcon name="attendance" size={22}/></div>
        <div>
          <div className="attendance-schedule-title-row"><strong>{current.base_site_name}</strong>{statusBadge(current,data.today)}</div>
          <span>{sourceLabel(current)} · {current.effective_from}{current.effective_until?" → "+current.effective_until:" · sin fecha de fin"}</span>
          <small>{scheduleSummary(current.business_schedule)}</small>
        </div>
        <Button variant="secondary" iconLeft="plus" onClick={()=>resetEditor()}>Nueva vigencia</Button>
      </article>}

      {!current&&!formOpen&&<EmptyState
        icon="info"
        title="Esta persona aún no tiene jornada individual"
        description="Puedes copiar el horario de la empresa o de una sede y después ajustarlo sin modificar la fuente original."
        action={<Button iconLeft="plus" onClick={()=>resetEditor()}>Configurar jornada</Button>}
      />}

      {formOpen&&<form ref={formRef} className="attendance-schedule-form" onSubmit={save}>
        <div className="attendance-schedule-form-head">
          <div><span className="eyebrow">{editingId?"Vigencia futura":"Nueva vigencia"}</span><h3>{editingId?"Editar horario programado":"Programar jornada individual"}</h3></div>
          <Button variant="ghost" iconLeft="x" onClick={()=>{setFormOpen(false);setEditingId(null);}}>Cancelar</Button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Sede base *</label>
            <select value={baseSiteId} onChange={event=>{setBaseSiteId(event.target.value);if(sourceType==="site"){setSourceType("custom");setSourceSiteId("");}}} required>
              <option value="">Selecciona sede</option>
              {data.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Zona horaria</label>
            <input value={data.organization.timezone} readOnly/>
          </div>
          <div className="field">
            <label>Vigente desde *</label>
            <input type="date" min={data.today} value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)} required/>
          </div>
          <div className="field">
            <label>Vigente hasta</label>
            <input type="date" min={effectiveFrom||data.today} value={effectiveUntil} onChange={event=>setEffectiveUntil(event.target.value)}/>
          </div>
        </div>

        <div className="attendance-schedule-template">
          <div><span className="eyebrow">Plantilla de horario</span><strong>Copiar sin vincular</strong><small>La copia queda congelada en esta vigencia. Cambiar Empresa/Sede después no reescribe este historial.</small></div>
          <div>
            <Button variant={sourceType==="organization"?"primary":"secondary"} iconLeft="company" onClick={copyOrganization}>Copiar empresa</Button>
            <Button variant={sourceType==="site"?"primary":"secondary"} iconLeft="location" disabled={!baseSiteId} onClick={copyBaseSite}>Copiar sede base</Button>
            <Button variant={sourceType==="custom"?"primary":"secondary"} iconLeft="edit" onClick={markCustom}>Personalizar</Button>
          </div>
        </div>

        <BusinessHoursFields
          key={editorVersion}
          prefix="work_"
          schedule={editorSchedule}
          title="Horario semanal de la persona"
          description="Activa los días laborables y define la hora esperada de inicio y fin para cada día."
        />

        <div className="field form-span-2">
          <label>Notas administrativas</label>
          <textarea value={notes} onChange={event=>setNotes(event.target.value)} maxLength={1000} placeholder="Ej.: jornada temporal por proyecto, cambio de turno, cobertura especial."/>
        </div>
        <div className="form-span-2 attendance-schedule-form-note">
          <UiIcon name="info" size={17}/>
          <p><strong>El horario no bloquea la asistencia.</strong><span>Una entrada anticipada, salida tardía o atención de emergencia seguirá registrándose como hecho real y podrá compararse con lo programado en reportes posteriores.</span></p>
        </div>
        <div className="form-span-2 form-actions">
          <Button variant="secondary" disabled={busy} onClick={()=>{setFormOpen(false);setEditingId(null);}}>Cancelar</Button>
          <Button type="submit" loading={busy} iconLeft="check">{editingId?"Guardar cambios futuros":"Guardar vigencia"}</Button>
        </div>
      </form>}

      {data.schedules.length>0&&<div className="attendance-schedule-history">
        <div className="section-heading compact"><div><span className="eyebrow">Trazabilidad</span><h3>Vigencias de jornada</h3></div><Badge variant="neutral">{data.schedules.length} registros</Badge></div>
        <div className="attendance-schedule-list">
          {data.schedules.map(item=>{
            const status=scheduleStatus(item.effective_from,item.effective_until,data.today);
            return <article key={item.id} className={"attendance-schedule-row "+status}>
              <div>
                <div className="attendance-schedule-title-row"><strong>{item.base_site_name}</strong>{statusBadge(item,data.today)}</div>
                <span>{item.effective_from}{item.effective_until?" → "+item.effective_until:" → vigente hasta nuevo cambio"}</span>
                <small>{sourceLabel(item)} · {scheduleSummary(item.business_schedule)}{item.notes?" · "+item.notes:""}</small>
              </div>
              <div className="attendance-schedule-row-actions">
                {status==="upcoming"&&<Button size="sm" variant="secondary" iconLeft="edit" onClick={()=>resetEditor(item)}>Editar</Button>}
                {status==="upcoming"&&<Button size="sm" variant="danger" iconLeft="trash" onClick={()=>setDeleteId(item.id)}>Eliminar</Button>}
              </div>
            </article>;
          })}
        </div>
        {data.hiddenScheduleCount>0&&<Alert variant="info" title="Historial limitado por sedes">Hay vigencias históricas en sedes fuera de tu alcance actual. No se muestran ni pueden modificarse desde esta sesión.</Alert>}
      </div>}
    </>}

    {!loading&&!userId&&<EmptyState icon="info" title="Selecciona una persona" description="Elige a quién deseas asignar o revisar la jornada individual."/>}

    <ConfirmDialog
      open={Boolean(deleteId)}
      title="Eliminar vigencia futura"
      message="Esta acción solo elimina una programación que todavía no ha iniciado. El historial vigente o pasado nunca se borra desde este flujo."
      confirmLabel="Eliminar vigencia"
      cancelLabel="Conservar"
      variant="danger"
      onConfirm={remove}
      onCancel={()=>setDeleteId(null)}
    />
  </section>;
}
