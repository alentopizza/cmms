"use client";

import { useEffect, useState, type ReactNode } from "react";
import UiIcon from "@/components/UiIcon";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Drawer } from "@/components/ui-kit/Overlay";

type LeadStatus="new"|"contacted"|"qualified"|"closed"|"discarded";
type DetailTab="general"|"followup";

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"L";
}

export default function LeadPreviewAction({
  name,company,email,phone,country,interest,message,status,statusLabel,createdAt,updatedAt,sourceLabel,manageActions,followupControls,reopenKey,
}:{
  name:string;company:string;email:string;phone:string|null;country:string;interest:string;message:string|null;
  status:LeadStatus;statusLabel:string;createdAt:string;updatedAt:string;sourceLabel:string;
  manageActions?:ReactNode;followupControls?:ReactNode;reopenKey?:string;
}){
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<DetailTab>("general");

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
        <section className="lead-detail-card">
          <header><div><UiIcon name="check" size={16}/><h3>Seguimiento comercial</h3></div></header>
          <div className="lead-detail-current-status"><span>Estado actual</span><span className={"lead-status lead-status-"+status}>{statusLabel}</span></div>
          {followupControls&&<div className="lead-detail-followup-controls">{followupControls}</div>}
        </section>
        <section className="lead-detail-card">
          <header><div><UiIcon name="clock" size={16}/><h3>Trazabilidad disponible</h3></div></header>
          <div className="lead-detail-timeline">
            <div><span className="lead-detail-timeline-icon"><UiIcon name="plus" size={14}/></span><div><strong>Lead registrado</strong><small>{createdAt}</small></div></div>
            <div><span className="lead-detail-timeline-icon"><UiIcon name="activity" size={14}/></span><div><strong>Última actualización registrada</strong><small>{updatedAt}</small></div></div>
          </div>
          <p className="lead-detail-note">El sistema no conserva todavía un historial de eventos separado para este Lead; se muestran únicamente las marcas de tiempo disponibles en el registro.</p>
        </section>
      </div>}
      </div>
    </Drawer>
  </>;
}