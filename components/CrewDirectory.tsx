"use client";

import { useState } from "react";
import UiIcon from "@/components/UiIcon";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import { CrewCard } from "@/components/business-ui";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell } from "@/components/ui-kit/CollectionIdentity";
import { Modal } from "@/components/ui-kit/Overlay";
import CrewCreateForm, { type CrewFormSite, type CrewFormWorker } from "@/components/CrewCreateForm";

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

function crewMenu(crew:CrewDirectoryItem,owner:boolean,onEdit:()=>void){
  return <details className="crew-card-more">
    <summary aria-label="Más acciones" title="Más acciones" data-tooltip="Más acciones"><UiIcon name="more" size={17}/></summary>
    <div className="crew-card-more-popover">
      <button type="button" className="text-button" onClick={onEdit}><UiIcon name="edit" size={14}/> Editar cuadrilla</button>
      {owner&&<OwnerRecordActions table="crews" id={crew.id} label={crew.name} fields={[]}/>}
    </div>
  </details>;
}

export default function CrewDirectory({
  crews,
  owner,
  sites,
  workers,
}:{
  crews:CrewDirectoryItem[];
  owner:boolean;
  sites:CrewFormSite[];
  workers:CrewFormWorker[];
}){
  const [editCrewId,setEditCrewId]=useState<string|null>(null);
  const editCrew=crews.find(crew=>crew.id===editCrewId)||null;

  const empty=<EmptyState
    icon="file"
    title={crews.length?"No encontramos cuadrillas":"No hay cuadrillas registradas"}
    description={crews.length?"Prueba modificando los filtros o el término de búsqueda.":"Crea la primera cuadrilla cuando exista personal autorizado para conformarla."}
  />;

  return <section className="crew-directory-v2">
    <CollectionView
      storageKey="crews"
      label="Vista de cuadrillas"
      grid={crews.length?<div className="crew-directory-grid-v2" data-collection-grid>{crews.map(crew=><CrewCard
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
          menuActions={crewMenu(crew,owner,()=>setEditCrewId(crew.id))}
          recordProps={{
            "data-module-record":true,
            "data-status":crew.active?"active":"inactive",
            "data-search":[crew.name,crew.organizationName,crew.siteName,crew.leaderName,crew.description,...crew.members.map(member=>member.name)].filter(Boolean).join(" "),
            "data-filter-organization":crew.organizationId,
            "data-filter-organization-label":crew.organizationName,
            "data-filter-site":crew.siteId||"",
            "data-filter-site-label":crew.siteName||"",
          }}
        />)}</div>:empty}
      list={<StaticDataTable
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
        rows={crews.map(crew=>({
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
            crew:<EntityIdentityCell imageSrc={crew.leaderUserId&&crew.leaderHasAvatar?"/api/users/"+crew.leaderUserId+"/avatar":null} imageAlt={crew.leaderHasAvatar&&crew.leaderName?"Foto de "+crew.leaderName:""} fallback={initials(crew.leaderName||crew.name)} icon="crew" variant="avatar" title={crew.name} subtitle={crew.organizationName} meta={crew.siteName||null}/>,
            status:<Badge variant={crew.active?"success":"danger"}>{crew.active?"Activa":"Inactiva"}</Badge>,
            site:crew.siteName||"—",
            leader:<span className="crew-list-leader-v2"><span><strong>{crew.leaderName||"Sin asignar"}</strong><small>{crew.leaderRole}</small></span></span>,
            members:crew.memberCount,
            activities:crew.activeActivityCount,
            completed:crew.completedActivityCount,
            actions:<span className="crew-list-actions-v2">{contactActions(crew)}{crewMenu(crew,owner,()=>setEditCrewId(crew.id))}</span>,
          },
        }))}
        empty={empty}
      />}
    />

    <Modal
      open={Boolean(editCrew)}
      onClose={()=>setEditCrewId(null)}
      title={editCrew?"Editar "+editCrew.name:"Editar cuadrilla"}
      eyebrow="Gestión de cuadrilla"
      description="Actualiza nombre, descripción, sede, líder e integrantes. El líder siempre debe pertenecer a la cuadrilla."
      size="lg"
      className="unified-create-modal crew-edit-modal"
      bodyClassName="unified-create-modal-body"
    >
      {editCrew&&<CrewCreateForm
        organizations={[]}
        sites={sites}
        workers={workers}
        fixedOrganizationId={editCrew.organizationId}
        action={"/api/crews/"+editCrew.id}
        submitLabel="Guardar cambios"
        initialValues={{
          organizationId:editCrew.organizationId,
          siteId:editCrew.siteId||"",
          name:editCrew.name,
          description:editCrew.description||"",
          leaderUserId:editCrew.leaderUserId||"",
          memberIds:editCrew.members.map(member=>member.id),
          active:editCrew.active,
        }}
      />}
    </Modal>
  </section>;
}
