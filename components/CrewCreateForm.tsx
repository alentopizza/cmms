"use client";

import { useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";

export type CrewFormSite={
  id:string;
  organization_id:string;
  name:string;
  organization_name:string;
};

export type CrewFormWorker={
  id:string;
  organization_id:string;
  full_name:string;
  role:string;
  supplier_name:string|null;
  phone:string|null;
  email:string;
  has_avatar:boolean;
  access_all_sites:boolean;
  site_ids:string[];
};

function roleLabel(role:string){
  if(role==="manager")return "Supervisor";
  if(role==="technician")return "Técnico";
  if(role==="external")return "Colaborador externo";
  return role;
}
function initials(name:string){
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"U";
}

export default function CrewCreateForm({
  organizations,
  sites,
  workers,
  fixedOrganizationId,
  action="/api/crews",
  submitLabel="Crear cuadrilla",
  initialValues,
}:{
  organizations:Array<{id:string;name:string}>;
  sites:CrewFormSite[];
  workers:CrewFormWorker[];
  fixedOrganizationId?:string;
  action?:string;
  submitLabel?:string;
  initialValues?:{
    organizationId:string;
    siteId:string;
    name:string;
    description:string;
    leaderUserId:string;
    memberIds:string[];
    active?:boolean;
  };
}){
  const [organizationId,setOrganizationId]=useState(initialValues?.organizationId||fixedOrganizationId||"");
  const [siteId,setSiteId]=useState(initialValues?.siteId||"");
  const [leaderId,setLeaderId]=useState(initialValues?.leaderUserId||"");
  const [memberIds,setMemberIds]=useState<string[]>(()=>[...new Set(initialValues?.memberIds||[])]);

  const visibleSites=useMemo(
    ()=>sites.filter(site=>!organizationId||site.organization_id===organizationId),
    [sites,organizationId],
  );
  const eligibleWorkers=useMemo(
    ()=>workers.filter(worker=>{
      if(!organizationId||worker.organization_id!==organizationId)return false;
      if(!siteId)return true;
      return worker.access_all_sites||worker.site_ids.includes(siteId);
    }),
    [workers,organizationId,siteId],
  );
  const leader=eligibleWorkers.find(worker=>worker.id===leaderId)||null;

  function changeOrganization(next:string){
    setOrganizationId(next);
    setSiteId("");
    setLeaderId("");
    setMemberIds([]);
  }
  function changeSite(next:string){
    setSiteId(next);
    setLeaderId("");
    setMemberIds([]);
  }
  function toggleMember(id:string){
    if(id===leaderId)return;
    setMemberIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  }
  function chooseLeader(id:string){
    setLeaderId(id);
    setMemberIds(current=>current.includes(id)?current:[...current,id]);
  }

  return <form className="form-grid unified-popup-form crew-create-form" method="post" action={action}>
    {fixedOrganizationId
      ?<input type="hidden" name="organization_id" value={fixedOrganizationId}/>
      :<div className="field">
        <label>Empresa *</label>
        <select name="organization_id" required value={organizationId} onChange={event=>changeOrganization(event.target.value)}>
          <option value="">Selecciona una empresa</option>
          {organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </div>}

    <div className="field">
      <label>Sede *</label>
      <select name="site_id" required value={siteId} onChange={event=>changeSite(event.target.value)} disabled={!organizationId}>
        <option value="">Selecciona una sede</option>
        {visibleSites.map(site=><option key={site.id} value={site.id}>{site.organization_name} · {site.name}</option>)}
      </select>
    </div>

    <div className="field form-span-2">
      <label>Nombre de la cuadrilla *</label>
      <input name="name" required defaultValue={initialValues?.name||""} placeholder="Ej. Cuadrilla refrigeración norte"/>
    </div>

    <div className="field form-span-2">
      <label>Líder *</label>
      <small className="crew-form-help">El líder puede ser Técnico, Supervisor o Colaborador externo. Al elegirlo se incluye automáticamente como integrante.</small>
      <input type="hidden" name="leader_user_id" value={leaderId}/>
      {!siteId?<div className="site-access-empty">Selecciona primero una sede para mostrar el personal con acceso a ella.</div>
        :eligibleWorkers.length?<div className="crew-leader-picker">
          {eligibleWorkers.map(worker=><button
            type="button"
            key={worker.id}
            className={"crew-leader-option "+(leaderId===worker.id?"active":"")}
            onClick={()=>chooseLeader(worker.id)}
            aria-pressed={leaderId===worker.id}
          >
            <span className="crew-person-avatar">{worker.has_avatar?<img src={"/api/users/"+worker.id+"/avatar"} alt=""/>:<b>{initials(worker.full_name)}</b>}</span>
            <span><strong>{worker.full_name}</strong><small>{roleLabel(worker.role)}{worker.supplier_name?" · "+worker.supplier_name:""}</small></span>
            <i>{leaderId===worker.id?<UiIcon name="check" size={13}/>:null}</i>
          </button>)}
        </div>:<div className="site-access-empty">No hay Técnicos, Supervisores o Colaboradores externos activos con acceso a esta sede.</div>}
    </div>

    {leader&&<div className="crew-selected-leader form-span-2">
      <span className="crew-person-avatar">{leader.has_avatar?<img src={"/api/users/"+leader.id+"/avatar"} alt=""/>:<b>{initials(leader.full_name)}</b>}</span>
      <div><small>Líder seleccionado</small><strong>{leader.full_name}</strong><span>{roleLabel(leader.role)}</span></div>
      {leader.phone&&<a href={"https://wa.me/"+leader.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><UiIcon name="whatsapp" size={16}/></a>}
    </div>}

    <div className="field form-span-2">
      <label>Integrantes *</label>
      <small className="crew-form-help">Puedes combinar Técnicos, Supervisores y Colaboradores externos de la misma empresa y con acceso a la sede.</small>
      <div className="crew-member-options crew-member-options-visual">
        {eligibleWorkers.map(worker=>{
          const checked=memberIds.includes(worker.id);
          return <label key={worker.id} className={checked?"active":""}>
            <input type="checkbox" name="member_ids" value={worker.id} checked={checked} disabled={worker.id===leaderId} onChange={()=>toggleMember(worker.id)}/>
            <span className="crew-person-avatar">{worker.has_avatar?<img src={"/api/users/"+worker.id+"/avatar"} alt=""/>:<b>{initials(worker.full_name)}</b>}</span>
            <span><strong>{worker.full_name}</strong><small>{roleLabel(worker.role)}{worker.id===leaderId?" · Líder":""}</small></span>
          </label>;
        })}
      </div>
    </div>

    <div className="field form-span-2">
      <label>Descripción</label>
      <textarea name="description" rows={3} defaultValue={initialValues?.description||""} placeholder="Ej. Equipo de atención de refrigeración para turno diurno."/>
    </div>

    {initialValues&&<div className="field form-span-2">
      <label className="owner-record-checkbox"><input name="active" type="checkbox" defaultChecked={initialValues.active!==false}/><span>Cuadrilla activa</span></label>
      <small className="crew-form-help">Una cuadrilla inactiva conserva su historial, integrantes y actividades anteriores, pero queda fuera de la operación activa.</small>
    </div>}

    <div className="form-span-2 form-actions">
      <button className="button" type="submit" disabled={!siteId||!leaderId||memberIds.length<1}>{submitLabel}</button>
    </div>
  </form>;
}
