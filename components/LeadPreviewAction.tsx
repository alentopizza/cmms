"use client";

import { useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Modal } from "@/components/ui-kit/Overlay";

type LeadStatus="new"|"contacted"|"qualified"|"closed"|"discarded";

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"L";
}

export default function LeadPreviewAction({name,company,email,phone,country,interest,message,status,statusLabel,createdAt}:{
  name:string;company:string;email:string;phone:string|null;country:string;interest:string;message:string|null;status:LeadStatus;statusLabel:string;createdAt:string;
}){
  const [open,setOpen]=useState(false);
  return <>
    <button className="ds-list-action lead-action-button" type="button" onClick={()=>setOpen(true)} title="Ver Lead" data-tooltip="Ver Lead" aria-label={"Ver "+name}><UiIcon name="eye" size={15}/></button>
    <Modal open={open} onClose={()=>setOpen(false)} title={name} description="Información registrada en el Lead." eyebrow="Lead comercial" size="lg" className="lead-preview-modal">
      <div className="lead-preview">
        <div className="lead-preview-identity">
          <Avatar initials={initials(name)} size="xl"/>
          <div><div className="lead-preview-name-row"><strong>{name}</strong><span className={"lead-status lead-status-"+status}>{statusLabel}</span></div><span><UiIcon name="location" size={13}/>{country}</span></div>
        </div>
        <div className="lead-preview-grid">
          <div><span><UiIcon name="company" size={15}/>Empresa</span><strong>{company}</strong></div>
          <div><span><UiIcon name="lead" size={15}/>Interés</span><strong>{interest}</strong></div>
          <div><span><UiIcon name="mail" size={15}/>Correo</span><a href={"mailto:"+email}>{email}</a></div>
          <div><span><UiIcon name="phone" size={15}/>Teléfono</span><strong>{phone||"No registrado"}</strong></div>
          <div><span><UiIcon name="calendar" size={15}/>Fecha de registro</span><strong>{createdAt}</strong></div>
        </div>
        {message&&<div className="lead-preview-message"><span><UiIcon name="file" size={15}/>Información sobre la operación / necesidad</span><p>{message}</p></div>}
      </div>
    </Modal>
  </>;
}
