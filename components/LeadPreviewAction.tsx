"use client";

import { useEffect, useState, type ReactNode } from "react";
import UiIcon from "@/components/UiIcon";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Drawer } from "@/components/ui-kit/Overlay";

type LeadStatus="new"|"contacted"|"qualified"|"closed"|"discarded";
type DetailTab="general"|"followup";
type LeadActivity={
  id:string;
  activity_type:"note"|"status";
  note:string|null;
  from_status:string|null;
  to_status:string|null;
  created_at:string;
  created_by_name:string|null;
  created_by_email:string|null;
  attachments:Array<{
    id:string;
    activity_id:string;
    file_name:string;
    file_mime_type:string;
    file_size_bytes:string;
    created_at:string;
  }>;
};

const STATUS_LABELS:Record<string,string>={
  new:"Nuevo",contacted:"Contactado",qualified:"Calificado",closed:"Cerrado",discarded:"Descartado",
};

function activityDate(value:string){
  return new Intl.DateTimeFormat("es-CO",{
    day:"2-digit",month:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit",
  }).format(new Date(value));
}

function fileSize(value:string){
  const bytes=Number(value)||0;
  if(bytes<1024)return bytes+" B";
  if(bytes<1024*1024)return Math.max(1,Math.round(bytes/1024))+" KB";
  return (bytes/1024/1024).toFixed(1)+" MB";
}

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"L";
}

export default function LeadPreviewAction({
  leadId,name,company,email,phone,country,interest,message,status,statusLabel,createdAt,updatedAt,sourceLabel,manageActions,followupControls,reopenKey,
}:{
  leadId:string;name:string;company:string;email:string;phone:string|null;country:string;interest:string;message:string|null;
  status:LeadStatus;statusLabel:string;createdAt:string;updatedAt:string;sourceLabel:string;
  manageActions?:ReactNode;followupControls?:ReactNode;reopenKey?:string;
}){
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<DetailTab>("general");
  const [activities,setActivities]=useState<LeadActivity[]>([]);
  const [activitiesLoading,setActivitiesLoading]=useState(false);
  const [activitySaving,setActivitySaving]=useState(false);
  const [activityError,setActivityError]=useState("");
  const [activityMessage,setActivityMessage]=useState("");

  async function loadActivities(){
    setActivitiesLoading(true);setActivityError("");
    try{
      const response=await fetch("/api/leads/"+encodeURIComponent(leadId)+"/activities",{headers:{Accept:"application/json"},cache:"no-store"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible cargar la trazabilidad.");
      setActivities(Array.isArray(payload.activities)?payload.activities:[]);
    }catch(cause){
      setActivityError(cause instanceof Error?cause.message:"No fue posible cargar la trazabilidad.");
    }finally{
      setActivitiesLoading(false);
    }
  }

  async function submitNote(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    setActivitySaving(true);setActivityError("");setActivityMessage("");
    try{
      const response=await fetch("/api/leads/"+encodeURIComponent(leadId)+"/activities",{method:"POST",body:data});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible agregar la nota.");
      form.reset();
      setActivityMessage(payload.message||"Nota agregada al seguimiento.");
      await loadActivities();
    }catch(cause){
      setActivityError(cause instanceof Error?cause.message:"No fue posible agregar la nota.");
    }finally{
      setActivitySaving(false);
    }
  }

  useEffect(()=>{
    if(open&&tab==="followup")void loadActivities();
  },[open,tab,leadId]);

  useEffect(()=>{
    if(!reopenKey)return;
    try{
      if(window.sessionStorage.getItem("cmms:record-detail-reopen")===reopenKey){
        window.sessionStorage.removeItem("cmms:record-detail-reopen");
        setOpen(true);
      }
    }catch{}
  },[reopenKey]);

  return <>
    <button className="ds-list-action lead-action-button" type="button" onClick={()=>setOpen(true)} title="Ver Lead" data-tooltip="Ver Lead" aria-label={"Ver "+name}><UiIcon name="eye" size={15}/></button>
    <Drawer open={open} onClose={()=>setOpen(false)} title="Detalle del Lead" description="Información comercial registrada en el sistema." side="right" className="lead-detail-drawer" headerClassName="lead-detail-drawer-header" bodyClassName="lead-detail-drawer-body" headerActions={manageActions}>
      <section className="lead-detail-hero" aria-label={"Resumen de "+name}>
        <Avatar initials={initials(name)} size="xl"/>
        <div className="lead-detail-hero-copy">
          <div className="lead-detail-name-row"><strong>{name}</strong><span className={"lead-status lead-status-"+status}>{statusLabel}</span></div>
          <span><UiIcon name="location" size={13}/>{country}</span>
          <span><UiIcon name="clock" size={13}/>Creado {createdAt}</span>
        </div>
      </section>

      <div className="lead-detail-tabs" role="tablist" aria-label="Detalle del Lead">
        <button type="button" role="tab" aria-selected={tab==="general"} className={tab==="general"?"active":""} onClick={()=>setTab("general")}><UiIcon name="user" size={15}/>Información general</button>
        <button type="button" role="tab" aria-selected={tab==="followup"} className={tab==="followup"?"active":""} onClick={()=>setTab("followup")}><UiIcon name="activity" size={15}/>Seguimiento</button>
      </div>

      <div className="lead-detail-scroll">
      {tab==="general"?<div className="lead-detail-layout">
        <div className="lead-detail-column">
          <section className="lead-detail-card">
            <header><div><UiIcon name="user" size={16}/><h3>Información de contacto</h3></div></header>
            <div className="lead-detail-field-list">
              <div><span className="lead-detail-field-icon"><UiIcon name="user" size={16}/></span><div><small>Nombre completo</small><strong>{name}</strong></div></div>
              <div><span className="lead-detail-field-icon"><UiIcon name="company" size={16}/></span><div><small>Empresa</small><strong>{company}</strong></div></div>
              <div><span className="lead-detail-field-icon"><UiIcon name="mail" size={16}/></span><div><small>Correo corporativo</small><a href={"mailto:"+email}>{email}</a></div></div>
              <div><span className="lead-detail-field-icon"><UiIcon name="phone" size={16}/></span><div><small>Teléfono</small><strong>{phone||"No registrado"}</strong></div></div>
            </div>
          </section>
          <section className="lead-detail-card">
            <header><div><UiIcon name="info" size={16}/><h3>Detalles del Lead</h3></div></header>
            <div className="lead-detail-field-list">
              <div><span className="lead-detail-field-icon"><UiIcon name="location" size={16}/></span><div><small>País</small><strong>{country}</strong></div></div>
              <div><span className="lead-detail-field-icon"><UiIcon name="lead" size={16}/></span><div><small>Interés</small><strong>{interest}</strong></div></div>
            </div>
            {message&&<div className="lead-detail-message"><span><UiIcon name="file" size={16}/>Información sobre la operación / necesidad</span><p>{message}</p></div>}
          </section>
        </div>

        <div className="lead-detail-column">
          <section className="lead-detail-card">
            <header><div><UiIcon name="activity" size={16}/><h3>Registro</h3></div></header>
            <div className="lead-detail-meta-list">
              <div><span>Origen</span><strong>{sourceLabel}</strong></div>
              <div><span>Fecha de registro</span><strong>{createdAt}</strong></div>
              <div><span>Última actualización</span><strong>{updatedAt}</strong></div>
            </div>
          </section>
          <section className="lead-detail-card">
            <header><div><UiIcon name="check" size={16}/><h3>Estado y seguimiento</h3></div></header>
            <div className="lead-detail-current-status"><span>Estado actual</span><span className={"lead-status lead-status-"+status}>{statusLabel}</span></div>
            {followupControls&&<div className="lead-detail-followup-controls">{followupControls}</div>}
          </section>
        </div>
      </div>:<div className="lead-detail-layout lead-detail-followup-layout">
        <div className="lead-detail-column">
          <section className="lead-detail-card">
            <header><div><UiIcon name="check" size={16}/><h3>Seguimiento comercial</h3></div></header>
            <div className="lead-detail-current-status"><span>Estado actual</span><span className={"lead-status lead-status-"+status}>{statusLabel}</span></div>
            {followupControls&&<div className="lead-detail-followup-controls">{followupControls}</div>}
          </section>

          <section className="lead-detail-card lead-followup-note-card">
            <header><div><UiIcon name="plus" size={16}/><h3>Agregar nota</h3></div></header>
            <form className="lead-followup-note-form" onSubmit={submitNote}>
              <div className="field">
                <label>Nota de seguimiento *</label>
                <textarea name="note" rows={4} maxLength={5000} required placeholder="Ej. Se realizó llamada con el cliente. Solicita propuesta para 3 sedes y reunión técnica el viernes."/>
              </div>
              <div className="field">
                <label>Adjuntos</label>
                <input name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx"/>
                <small>Hasta 5 archivos por nota · máximo 10 MB cada uno.</small>
              </div>
              {activityMessage&&<div className="notice success">{activityMessage}</div>}
              {activityError&&<div className="notice error">{activityError}</div>}
              <div className="form-actions"><button className="button" type="submit" disabled={activitySaving}>{activitySaving?"Guardando…":"Agregar a trazabilidad"}</button></div>
            </form>
          </section>
        </div>

        <section className="lead-detail-card lead-trace-card">
          <header><div><UiIcon name="clock" size={16}/><h3>Trazabilidad</h3></div><span className="lead-trace-count">{activities.length} evento{activities.length===1?"":"s"}</span></header>
          {activitiesLoading?<div className="lead-trace-loading">Cargando trazabilidad…</div>:<div className="lead-detail-timeline lead-detail-timeline-rich">
            {activities.map(activity=><article className="lead-trace-event" key={activity.id}>
              <span className="lead-detail-timeline-icon"><UiIcon name={activity.activity_type==="note"?"file":"activity"} size={14}/></span>
              <div className="lead-trace-event-body">
                <div className="lead-trace-event-head">
                  <strong>{activity.activity_type==="note"?"Nota de seguimiento":"Cambio de estado"}</strong>
                  <time dateTime={activity.created_at}>{activityDate(activity.created_at)}</time>
                </div>
                <small className="lead-trace-author">{activity.created_by_name||activity.created_by_email||"Usuario del sistema"}</small>
                {activity.activity_type==="note"&&activity.note&&<p>{activity.note}</p>}
                {activity.activity_type==="status"&&<p>Estado: <strong>{STATUS_LABELS[activity.from_status||""]||activity.from_status||"—"}</strong> → <strong>{STATUS_LABELS[activity.to_status||""]||activity.to_status||"—"}</strong></p>}
                {activity.attachments.length>0&&<div className="lead-trace-files">{activity.attachments.map(file=><a key={file.id} href={"/api/leads/"+encodeURIComponent(leadId)+"/activities/attachments/"+encodeURIComponent(file.id)}><UiIcon name="file" size={13}/><span>{file.file_name}</span><small>{fileSize(file.file_size_bytes)}</small></a>)}</div>}
              </div>
            </article>)}
            <article className="lead-trace-event lead-trace-event-origin">
              <span className="lead-detail-timeline-icon"><UiIcon name="plus" size={14}/></span>
              <div className="lead-trace-event-body">
                <div className="lead-trace-event-head"><strong>Lead registrado</strong><time>{createdAt}</time></div>
                <small>Registro inicial del prospecto en el sistema.</small>
              </div>
            </article>
          </div>}
        </section>
      </div>}
      </div>
    </Drawer>
  </>;
}