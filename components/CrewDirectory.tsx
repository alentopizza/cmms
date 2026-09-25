"use client";

import { useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import { CrewCard } from "@/components/business-ui";
import { Search, ViewModeToggle } from "@/components/ui-kit/DataControls";
import { Select } from "@/components/ui-kit/FormControls";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";

export type CrewDirectoryMember={
  id:string;
  name:string;
  role:string;
  phone:string|null;
  email:string;
  hasAvatar:boolean;
};

export type CrewDirectoryItem={
  id:string;
  organizationId:string;
  organizationName:string;
  siteId:string|null;
  siteName:string|null;
  name:string;
  description:string|null;
  leaderUserId:string|null;
  leaderName:string|null;
  leaderPhone:string|null;
  leaderEmail:string|null;
  leaderRole:string;
  leaderHasAvatar:boolean;
  memberCount:number;
  activeActivityCount:number;
  completedActivityCount:number;
  active:boolean;
  members:CrewDirectoryMember[];
};

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"C";
}

function phoneDigits(value:string){
  return value.replace(/\D/g,"");
}

function contactActions(crew:CrewDirectoryItem){
  return <>
    {crew.leaderPhone&&<a
      href={"https://wa.me/"+phoneDigits(crew.leaderPhone)}
      target="_blank"
      rel="noreferrer"
      className="crew-quick-action whatsapp"
      aria-label={"Contactar por WhatsApp a "+(crew.leaderName||"líder")}
      title="Contactar por WhatsApp"
      data-tooltip="Contactar por WhatsApp"
    ><UiIcon name="whatsapp" size={16}/></a>}
    {crew.leaderPhone&&<a
      href={"tel:"+crew.leaderPhone.replace(/[^+\d]/g,"")}
      className="crew-quick-action"
      aria-label={"Llamar a "+(crew.leaderName||"líder")}
      title="Llamar"
      data-tooltip="Llamar"
    ><UiIcon name="phone" size={16}/></a>}
    {crew.leaderEmail&&<a
      href={"mailto:"+crew.leaderEmail}
      className="crew-quick-action"
      aria-label={"Enviar correo a "+(crew.leaderName||"líder")}
      title="Enviar correo"
      data-tooltip="Enviar correo"
    ><UiIcon name="mail" size={16}/></a>}
  </>;
}

function ownerMenu(crew:CrewDirectoryItem,owner:boolean){
  if(!owner)return null;
  return <details className="crew-card-more">
    <summary aria-label="Más acciones" title="Más acciones" data-tooltip="Más acciones"><UiIcon name="more" size={17}/></summary>
    <div className="crew-card-more-popover">
      <OwnerRecordActions table="crews" id={crew.id} label={crew.name} fields={[
        {name:"name",label:"Nombre",value:crew.name},
        {name:"description",label:"Descripción",value:crew.description||"",type:"textarea"},
        {name:"active",label:"Estado",value:crew.active,type:"checkbox"},
      ]}/>
    </div>
  </details>;
}

export default function CrewDirectory({
  crews,
  owner,
}:{
  crews:CrewDirectoryItem[];
  owner:boolean;
}){
  const [search,setSearch]=useState("");
  const [siteId,setSiteId]=useState("all");
  const [status,setStatus]=useState("all");
  const [view,setView]=useState<"grid"|"list">("grid");

  const sites=useMemo(()=>{
    const map=new Map<string,string>();
    for(const crew of crews)if(crew.siteId&&crew.siteName)map.set(crew.siteId,crew.siteName);
    return [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1],"es"));
  },[crews]);

  const filtered=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase("es");
    return crews.filter(crew=>{
      if(siteId!=="all"&&crew.siteId!==siteId)return false;
      if(status==="active"&&!crew.active)return false;
      if(status==="inactive"&&crew.active)return false;
      if(!needle)return true;
      const members=crew.members.map(member=>member.name+" "+member.role).join(" ");
      return [
        crew.name,crew.organizationName,crew.siteName||"",crew.description||"",
        crew.leaderName||"",crew.leaderRole,members,
      ].join(" ").toLocaleLowerCase("es").includes(needle);
    });
  },[crews,search,siteId,status]);

  const hasFilters=Boolean(search.trim()||siteId!=="all"||status!=="all");

  const empty=<EmptyState
    icon="file"
    title={crews.length?"No encontramos cuadrillas":"No hay cuadrillas registradas"}
    description={crews.length?"Prueba modificando los filtros o el término de búsqueda.":"Crea la primera cuadrilla cuando exista personal autorizado para conformarla."}
  />;

  return <section className="crew-directory-v2">
    <div className="crew-directory-controls-v2">
      <Search
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar cuadrilla, líder, sede o descripción..."
        ariaLabel="Buscar cuadrillas"
      />
      <Select
        value={siteId}
        onChange={event=>setSiteId(event.target.value)}
        placeholder=""
        aria-label="Filtrar cuadrillas por sede"
        options={[{value:"all",label:"Todas las sedes"},...sites.map(([value,label])=>({value,label}))]}
      />
      <Select
        value={status}
        onChange={event=>setStatus(event.target.value)}
        placeholder=""
        aria-label="Filtrar cuadrillas por estado"
        options={[
          {value:"all",label:"Todos los estados"},
          {value:"active",label:"Activas"},
          {value:"inactive",label:"Inactivas"},
        ]}
      />
      <ViewModeToggle value={view} onChange={setView} label="Vista de cuadrillas"/>
    </div>

    <div className="crew-directory-result-meta-v2">
      <span>{filtered.length} de {crews.length} cuadrilla(s)</span>
      {hasFilters&&<button type="button" onClick={()=>{setSearch("");setSiteId("all");setStatus("all");}}><UiIcon name="reset" size={13}/>Limpiar filtros</button>}
    </div>

    {view==="grid"
      ? filtered.length?<div className="crew-directory-grid-v2">{filtered.map(crew=><CrewCard
          key={crew.id}
          name={crew.name}
          organization={crew.organizationName}
          site={crew.siteName}
          active={crew.active}
          leaderName={crew.leaderName||"Líder sin asignar"}
          leaderRole={crew.leaderRole}
          leaderPhotoSrc={crew.leaderUserId&&crew.leaderHasAvatar?"/api/users/"+crew.leaderUserId+"/avatar":null}
          fallback={initials(crew.leaderName||crew.name)}
          description={crew.description}
          metrics={[
            {label:"Integrantes",value:crew.memberCount,icon:"user"},
            {label:"Actividades",value:crew.activeActivityCount,icon:"activity"},
            {label:"Completadas",value:crew.completedActivityCount,icon:"check"},
          ]}
          members={crew.members.map(member=>({
            id:member.id,
            name:member.name,
            role:member.role,
            photoSrc:member.hasAvatar?"/api/users/"+member.id+"/avatar":null,
            fallback:initials(member.name),
          }))}
          leaderActions={contactActions(crew)}
          menuActions={ownerMenu(crew,owner)}
          recordProps={{
            "data-module-record":true,
            "data-status":crew.active?"active":"inactive",
            "data-search":[crew.name,crew.organizationName,crew.siteName,crew.leaderName,crew.description,...crew.members.map(member=>member.name)].filter(Boolean).join(" "),
            "data-filter-organization":crew.organizationId,
            "data-filter-organization-label":crew.organizationName,
            "data-filter-site":crew.siteId||"",
            "data-filter-site-label":crew.siteName||"",
          }}
        />)}</div>:empty
      :<StaticDataTable
        className="crew-directory-list-v2"
        caption="Listado de cuadrillas"
        columns={[
          {key:"crew",label:"Cuadrilla"},
          {key:"status",label:"Estado"},
          {key:"site",label:"Sede"},
          {key:"leader",label:"Líder"},
          {key:"members",label:"Integrantes",align:"end"},
          {key:"activities",label:"Actividades",align:"end"},
          {key:"completed",label:"Completadas",align:"end"},
          {key:"actions",label:"Acciones",align:"end"},
        ]}
        rows={filtered.map(crew=>({
          id:crew.id,
          recordProps:{
            "data-module-record":true,
            "data-status":crew.active?"active":"inactive",
            "data-search":[crew.name,crew.organizationName,crew.siteName,crew.leaderName,crew.description,...crew.members.map(member=>member.name)].filter(Boolean).join(" "),
            "data-filter-organization":crew.organizationId,
            "data-filter-organization-label":crew.organizationName,
            "data-filter-site":crew.siteId||"",
            "data-filter-site-label":crew.siteName||"",
          },
          cells:{
            crew:<span className="crew-list-primary-v2"><span className="crew-directory-icon-v2"><UiIcon name="crew" size={17}/></span><span><strong>{crew.name}</strong><small>{crew.organizationName}</small></span></span>,
            status:<Badge variant={crew.active?"success":"danger"}>{crew.active?"Activa":"Inactiva"}</Badge>,
            site:crew.siteName||"—",
            leader:<span className="crew-list-leader-v2"><span className="crew-directory-member-avatar-v2">{crew.leaderUserId&&crew.leaderHasAvatar?<img src={"/api/users/"+crew.leaderUserId+"/avatar"} alt=""/>:<b>{initials(crew.leaderName||crew.name)}</b>}</span><span><strong>{crew.leaderName||"Sin asignar"}</strong><small>{crew.leaderRole}</small></span></span>,
            members:crew.memberCount,
            activities:crew.activeActivityCount,
            completed:crew.completedActivityCount,
            actions:<span className="crew-list-actions-v2">{contactActions(crew)}{ownerMenu(crew,owner)}</span>,
          },
        }))}
        empty={empty}
      />}
  </section>;
}
