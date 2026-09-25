"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SubLocationCreateModal } from "@/components/ContextCreateModals";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import BusinessHoursFields from "@/components/BusinessHoursFields";
import FileDropzone from "@/components/FileDropzone";
import PhoneField from "@/components/PhoneField";
import EntityProfileWorkspace from "@/components/EntityProfileWorkspace";
import ProfileExportMenu from "@/components/ProfileExportMenu";
import UiIcon from "@/components/UiIcon";
import { CountryCityFields } from "@/components/InternationalFields";
import { LocationCard, SubLocationCard } from "@/components/business-ui";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { CollectionView, Search } from "@/components/ui-kit/DataControls";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Select } from "@/components/ui-kit/FormControls";
import { StatTiles } from "@/components/ui-kit/Metrics";

export type LocationDirectorySite={
  id:string; organization_id:string; organization_name:string; name:string; code:string|null;
  address:string|null; city:string|null; country:string; active:boolean; location_count:number; asset_count:number; technician_count:number;
  latitude:number|null; longitude:number|null; geofence_radius_m:number;
  has_image:boolean; organization_has_logo:boolean; locality:string|null; contact_name:string|null; contact_title:string|null; contact_phone:string|null; contact_email:string|null; notes:string|null;
  business_days:number[]; business_open_time:string; business_close_time:string;
  business_schedule: import("@/lib/business-hours").BusinessDaySchedule[];
};
export type LocationDirectorySub={
  id:string; organization_id:string; site_id:string; parent_id:string|null; name:string; code:string|null; type:string;
  description:string|null; active:boolean; asset_count:number; child_count:number; has_image:boolean;
};
export type LocationDirectoryService={
  id:string; site_id:string; location_id:string|null; number:string; title:string; status:string; type:string; priority:string; requested_at:string; location_name:string|null;
};
export type LocationDirectoryTechnician={
  site_id:string; location_id:string|null; user_id:string; full_name:string; phone:string|null; email:string; has_avatar:boolean;
  assignment_count:number; active_assignment_count:number; next_due_date:string|null;
};

function initials(value:string){ return value.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase(); }
function countryName(code:string){
  const names:Record<string,string>={CO:"Colombia",PE:"Perú",EC:"Ecuador",MX:"México",CL:"Chile",AR:"Argentina",US:"Estados Unidos",PA:"Panamá",CR:"Costa Rica"};
  return names[code.toUpperCase()]||code;
}
function waLink(phone:string){ const digits=phone.replace(/\D/g,""); return digits ? "https://wa.me/"+digits : ""; }
function telLink(phone:string){ const normalized=phone.replace(/[^+\d]/g,""); return normalized ? "tel:"+normalized : ""; }
function statusLabel(status:string){
  const map:Record<string,string>={open:"Abierta",assigned:"Asignada",in_progress:"En progreso",paused:"Pausada",completed:"Finalizada",cancelled:"Cancelada"};
  return map[status]||status;
}
function typeLabel(type:string){
  const map:Record<string,string>={area:"Área",floor:"Piso",room:"Habitación",department:"Departamento",zone:"Zona"};
  return map[type]||type;
}
function scheduleLabel(site:LocationDirectorySite){
  const rows=(site.business_schedule||[]).filter(row=>row.enabled);
  if(!rows.length)return "Sin horario activo";
  const ranges=Array.from(new Set(rows.map(row=>row.openTime.slice(0,5)+"–"+row.closeTime.slice(0,5))));
  if(ranges.length===1)return ranges[0]+" · "+rows.length+" días/semana";
  return "Horario variable · "+rows.length+" días/semana";
}
function InfoField({label,value}:{label:string;value:React.ReactNode}){
  return <div className="entity-info-field"><span>{label}</span><strong>{value}</strong></div>;
}
function serviceTone(status:string):BadgeVariant{
  if(status==="completed")return "success";
  if(status==="cancelled")return "neutral";
  if(status==="paused")return "warning";
  if(status==="assigned"||status==="in_progress")return "info";
  return "brand";
}

export default function LocationDirectory({sites,sublocations,services,technicians}:{sites:LocationDirectorySite[];sublocations:LocationDirectorySub[];services:LocationDirectoryService[];technicians:LocationDirectoryTechnician[];}){
  const [selectedSiteId,setSelectedSiteId]=useState<string|null>(null);
  const [editingSite,setEditingSite]=useState(false);
  const [selectedSubId,setSelectedSubId]=useState<string|null>(null);
  const [editingSub,setEditingSub]=useState(false);
  const [subSearch,setSubSearch]=useState("");
  const [subStatus,setSubStatus]=useState("all");
  const [subType,setSubType]=useState("all");
  const [serviceSearch,setServiceSearch]=useState("");
  const [serviceStatus,setServiceStatus]=useState("all");
  const [copied,setCopied]=useState("");

  const selected=sites.find(site=>site.id===selectedSiteId)||null;
  const siteSubs=useMemo(()=>sublocations.filter(item=>item.site_id===selectedSiteId),[sublocations,selectedSiteId]);
  const visibleSubs=useMemo(()=>siteSubs.filter(item=>{
    const search=subSearch.trim().toLocaleLowerCase("es");
    const matchesSearch=!search||[item.name,item.code,item.type,item.description].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search);
    const matchesStatus=subStatus==="all"||(subStatus==="active"?item.active:!item.active);
    const matchesType=subType==="all"||item.type===subType;
    return matchesSearch&&matchesStatus&&matchesType;
  }),[siteSubs,subSearch,subStatus,subType]);
  const subTypeOptions=useMemo(()=>Array.from(new Set(siteSubs.map(item=>item.type))).sort((a,b)=>typeLabel(a).localeCompare(typeLabel(b),"es")),[siteSubs]);
  const siteServices=useMemo(()=>services.filter(item=>item.site_id===selectedSiteId),[services,selectedSiteId]);
  const visibleServices=useMemo(()=>siteServices.filter(item=>{
    const search=serviceSearch.trim().toLocaleLowerCase("es");
    const matchesSearch=!search||[item.number,item.title,item.type,item.priority,item.location_name].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search);
    const matchesStatus=serviceStatus==="all"||item.status===serviceStatus;
    return matchesSearch&&matchesStatus;
  }),[siteServices,serviceSearch,serviceStatus]);
  const selectedSub=siteSubs.find(item=>item.id===selectedSubId)||null;
  const selectedSubServices=selectedSub?siteServices.filter(item=>item.location_id===selectedSub.id):[];
  const siteTechnicians=useMemo(()=>technicians.filter(item=>item.site_id===selectedSiteId),[technicians,selectedSiteId]);
  const selectedSubTechnicians=selectedSub?siteTechnicians.filter(item=>item.location_id===selectedSub.id):[];

  async function copy(value:string,label:string){
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(()=>setCopied(""),1500);
  }
  function openSite(id:string){
    setSelectedSiteId(id);setEditingSite(false);setSelectedSubId(null);setEditingSub(false);
    setSubSearch("");setSubStatus("all");setSubType("all");setServiceSearch("");setServiceStatus("all");
  }

  function technicianList(items:LocationDirectoryTechnician[],scope:string){
    return <div className="entity-section-stack">
      <div className="entity-panel technician-assignment-note">
        <h3><span className="entity-section-icon"><UiIcon name="user"/></span>Técnicos asignados por actividades</h3>
        <p className="entity-panel-copy">Esta vista es de solo lectura. Los técnicos aparecen automáticamente cuando una actividad de una OT de {scope} queda asignada a una persona o a una cuadrilla que la incluye.</p>
      </div>
      {items.length?<div className="location-technician-grid">{items.map(item=><article className="location-technician-card" key={item.user_id+"-"+(item.location_id||item.site_id)}>
        <div className="location-technician-avatar">{item.has_avatar?<img src={"/api/users/"+item.user_id+"/avatar"} alt="" loading="lazy" decoding="async" />:<span>{initials(item.full_name)}</span>}</div>
        <div className="location-technician-copy"><strong>{item.full_name}</strong><span>{item.active_assignment_count} actividades activas · {item.assignment_count} históricas</span><small>{item.next_due_date?"Próximo compromiso: "+new Date(item.next_due_date+"T12:00:00").toLocaleDateString("es-CO"):"Sin compromiso activo"}</small></div>
        <div className="location-technician-actions">{item.phone&&<><a href={telLink(item.phone)} title="Llamar" aria-label={"Llamar a "+item.full_name}><UiIcon name="phone"/></a><a href={waLink(item.phone)} target="_blank" rel="noreferrer" title="WhatsApp" aria-label={"WhatsApp de "+item.full_name}><UiIcon name="whatsapp"/></a></>}<a href={"mailto:"+item.email} title="Correo" aria-label={"Correo de "+item.full_name}>@</a></div>
      </article>)}</div>:<div className="location-detail-empty technician-assignment-empty"><UiIcon name="user" size={28}/><strong>Aún no hay técnicos asignados.</strong><span>Cuando se creen actividades y se asigne un técnico o una cuadrilla, aparecerán aquí automáticamente.</span></div>}
    </div>;
  }

  function serviceList(items:LocationDirectoryService[],empty:string){
    return <div className="location-service-list">
      {items.length?items.map(item=><Link key={item.id} href={"/dashboard/work-orders/"+item.id} className="location-service-card">
        <div><small>{new Date(item.requested_at).toLocaleDateString("es-CO")} · OT #{item.number}</small><strong>{item.title}</strong><span>{item.location_name||"Sin sububicación"}</span></div>
        <Badge variant={serviceTone(item.status)}>{statusLabel(item.status)}</Badge>
      </Link>):<div className="location-detail-empty">{empty}</div>}
    </div>;
  }

  return <div className="phase6-location-directory">
    {!selected&&<CollectionView storageKey="locations" label="Vista de ubicaciones" grid={<div className="site-visual-grid site-visual-grid-compact" data-collection-grid>
      {sites.map(site=><LocationCard
        key={site.id}
        name={site.name}
        organization={site.organization_name}
        location={(site.city||"Ciudad sin registrar")+" · "+countryName(site.country)}
        address={site.address||"Dirección sin registrar"}
        active={site.active}
        coverSrc={site.has_image?"/api/sites/"+site.id+"/image":null}
        logoSrc={site.organization_has_logo?"/api/organizations/"+site.organization_id+"/assets/logo":null}
        fallback={initials(site.organization_name)}
        onOpen={()=>openSite(site.id)}
        recordProps={{
          "data-module-record":true,"data-status":site.active?"active":"inactive",
          "data-search":[site.name,site.organization_name,site.code,site.city,site.country,site.address].filter(Boolean).join(" "),
          "data-filter-organization":site.organization_id,"data-filter-organization-label":site.organization_name,
          "data-filter-country":site.country,"data-filter-country-label":countryName(site.country),
          "data-filter-city":site.city||"","data-filter-city-label":site.city||"",
        }}
        resources={<nav className="site-resource-actions" aria-label={"Recursos de "+site.name}>
          <button type="button" className="site-resource-action" title="Sububicaciones" data-tooltip="Sububicaciones" aria-label={"Sububicaciones: "+site.location_count} onClick={()=>openSite(site.id)}>
            <span className="site-resource-icon" aria-hidden="true"><UiIcon name="sublocation" size={17}/></span><strong>{site.location_count}</strong>
          </button>
          <Link href="/dashboard/assets" className="site-resource-action" title="Activos" data-tooltip="Activos" aria-label={"Activos: "+site.asset_count+". Abrir módulo."}>
            <span className="site-resource-icon" aria-hidden="true"><UiIcon name="asset" size={17}/></span><strong>{site.asset_count}</strong>
          </Link>
        </nav>}
      />)}
    </div>} list={<StaticDataTable
      className="location-directory-list"
      caption="Listado de ubicaciones"
      columns={[
        {key:"location",label:"Ubicación"},
        {key:"company",label:"Empresa"},
        {key:"city",label:"Ciudad / País"},
        {key:"sublocations",label:"Sububicaciones",align:"end"},
        {key:"assets",label:"Activos",align:"end"},
        {key:"status",label:"Estado"},
        {key:"actions",label:"Acciones",align:"end"},
      ]}
      rows={sites.map(site=>({
        id:site.id,
        recordProps:{
          "data-module-record":true,
          "data-status":site.active?"active":"inactive",
          "data-search":[site.name,site.organization_name,site.code,site.city,site.country,site.address].filter(Boolean).join(" "),
          "data-filter-organization":site.organization_id,
          "data-filter-organization-label":site.organization_name,
          "data-filter-country":site.country,
          "data-filter-country-label":countryName(site.country),
          "data-filter-city":site.city||"",
          "data-filter-city-label":site.city||"",
        },
        cells:{
          location:<span><strong>{site.name}</strong>{site.code&&<small> · {site.code}</small>}</span>,
          company:site.organization_name,
          city:(site.city||"Sin ciudad")+" · "+countryName(site.country),
          sublocations:site.location_count,
          assets:site.asset_count,
          status:<Badge variant={site.active?"success":"neutral"}>{site.active?"Activa":"Inactiva"}</Badge>,
          actions:<ListQuickActions><button type="button" className="ds-list-action primary" onClick={()=>openSite(site.id)} title="Ver ubicación" data-tooltip="Ver ubicación" aria-label={"Ver ubicación "+site.name}><UiIcon name="eye" size={16}/></button></ListQuickActions>,
        },
      }))}
    />}/>} 

    {selected&&!selectedSub&&<section className="section entity-page-detail">
        <EntityProfileWorkspace
          eyebrow="Estructura física"
          headingLabel="Ubicación"
          headingIcon="location"
          breadcrumbs={[
            {label:"Inicio",href:"/dashboard"},
            {label:"Ubicaciones",onClick:()=>setSelectedSiteId(null)},
            {label:selected.name},
          ]}
          title={selected.name}
          subtitle={selected.organization_name}
          meta={[(selected.city||"Ciudad sin registrar")+" · "+countryName(selected.country),selected.address||"Dirección sin registrar"]}
          coverSrc={selected.has_image?"/api/sites/"+selected.id+"/image":null}
          imageSrc={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null}
          imageAlt={"Logo de "+selected.organization_name}
          fallback={initials(selected.organization_name)}
          status={<Badge variant={selected.active?"success":"neutral"}>{selected.active?"Activa":"Inactiva"}</Badge>}
          stats={[
            {label:"Sububicaciones",value:selected.location_count,icon:"sublocation"},
            {label:"Activos",value:selected.asset_count,icon:"asset"},
            {label:"OT activas",value:siteServices.filter(item=>!["completed","cancelled"].includes(item.status)).length,icon:"work-order"},
            {label:"Técnicos",value:siteTechnicians.length,icon:"user"},
          ]}
          toolbarActions={<>
            <button className="button secondary entity-action-button" type="button" onClick={()=>setEditingSite(value=>!value)}><UiIcon name="edit"/><span>{editingSite?"Cancelar edición":"Editar"}</span></button>
            {selected.latitude!==null&&selected.longitude!==null&&<a className="button secondary entity-action-button entity-action-map" href={"https://www.google.com/maps?q="+selected.latitude+","+selected.longitude} target="_blank" rel="noreferrer"><UiIcon name="map"/><span>Ver mapa</span></a>}
            <SubLocationCreateModal
              sites={[{id:selected.id,organization_id:selected.organization_id,name:selected.name,organization_name:selected.organization_name}]}
              locations={siteSubs.map(item=>({id:item.id,organization_id:item.organization_id,site_id:item.site_id,name:item.name,label:item.name}))}
              fixedSiteId={selected.id} fixedSiteName={selected.name} returnTo="/dashboard/locations" triggerLabel="Crear sububicación" secondary
            />
            <Link className="button secondary entity-action-button entity-action-wide" href={"/dashboard/users?create=1&organization_id="+selected.organization_id+"&site_id="+selected.id+"&role=technician"}><UiIcon name="user-plus"/><span>Agregar técnico</span></Link>
            <ProfileExportMenu entity="site" id={selected.id}/>
          </>}
          quickActions={<>
            {selected.latitude!==null&&selected.longitude!==null&&<a href={"https://www.google.com/maps?q="+selected.latitude+","+selected.longitude} target="_blank" rel="noreferrer"><UiIcon name="map"/> Ver mapa</a>}
            <button type="button" onClick={()=>setEditingSite(true)}><UiIcon name="edit"/> Editar</button>
            <Link href={"/dashboard/users?create=1&organization_id="+selected.organization_id+"&site_id="+selected.id+"&role=technician"}><UiIcon name="user-plus"/> Agregar técnico</Link>
            {selected.contact_phone&&<a href={waLink(selected.contact_phone)} target="_blank" rel="noreferrer"><UiIcon name="whatsapp"/> WhatsApp</a>}
          </>}
          tabs={[
            {id:"general",label:"Información general",content:editingSite?<form className="location-detail-edit-form entity-section-stack" method="post" encType="multipart/form-data" action={"/api/sites/"+selected.id}>
              <input type="hidden" name="organization_id" value={selected.organization_id}/><input type="hidden" name="return_to" value="/dashboard/locations"/>
              <div className="form-grid">
                <div className="field"><label>Nombre *</label><input name="name" defaultValue={selected.name} required/></div>
                <div className="field"><label>Código interno</label><input name="code" defaultValue={selected.code||""}/><small>Opcional. Identifica la sede en OT, reportes e integraciones.</small></div>
                <CountryCityFields countryId="location-country" countryName="country" cityId="location-city" cityName="city" defaultCountry={selected.country||"CO"} defaultCity={selected.city||""} required />
                <div className="field"><label>Zona / Localidad</label><input name="locality" defaultValue={selected.locality||""}/></div>
                <div className="field"><label>Responsable / contacto</label><input name="contact_name" defaultValue={selected.contact_name||""}/></div>
                <div className="field"><label>Cargo del responsable</label><input name="contact_title" defaultValue={selected.contact_title||""}/></div>
                <PhoneField name="contact_phone" label="WhatsApp / teléfono" countryCode={selected.country} countryInputId="location-country" defaultValue={selected.contact_phone} />
                <div className="field form-span-2"><label>Correo</label><input type="email" name="contact_email" defaultValue={selected.contact_email||""}/></div>
                <div className="field form-span-2"><label>Notas adicionales</label><textarea name="notes" rows={3} defaultValue={selected.notes||""}/></div>
                <BusinessHoursFields days={selected.business_days} openTime={selected.business_open_time} closeTime={selected.business_close_time} schedule={selected.business_schedule} title="Horario de atención de la sede" description="Reacción usa este horario para el filtro Abiertos ahora."/>
                <div className="form-span-2"><FileDropzone name="image" label="Actualizar foto de sede" description="Selecciona una nueva imagen solo si quieres reemplazar la actual." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={selected.has_image?"Foto de sede actual":null}/></div>
              </div>
              <GeofenceMapPicker initialAddress={selected.address} initialLatitude={selected.latitude} initialLongitude={selected.longitude} initialRadius={selected.geofence_radius_m} cityHint={selected.city} countryHint={selected.country} markerImageUrl={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null} markerLabel={selected.organization_name}/>
              <div className="form-actions"><button className="button secondary" type="button" onClick={()=>setEditingSite(false)}>Cancelar</button><button className="button" type="submit">Guardar cambios</button></div>
            </form>:<div className="entity-section-stack">
              <div className="entity-approved-columns">
                <div className="entity-approved-column">
                  <div className="entity-panel entity-approved-data-panel"><h3><span className="entity-section-icon"><UiIcon name="company"/></span>Datos de la ubicación</h3><div className="entity-info-grid">
                    <InfoField label="Nombre de la ubicación" value={selected.name}/><InfoField label="Código / Identificador" value={selected.code||"Sin código"}/>
                    <InfoField label="Empresa" value={selected.organization_name}/><InfoField label="Tipo de ubicación" value="Sede"/>
                    <InfoField label="Dirección" value={selected.address||"Sin registrar"}/><InfoField label="Zona / Localidad" value={selected.locality||"Sin registrar"}/>
                    <InfoField label="Ciudad" value={selected.city||"Sin registrar"}/><InfoField label="Horario de operación" value={scheduleLabel(selected)}/>
                    <InfoField label="País" value={countryName(selected.country)}/>
                    <InfoField label="Responsable" value={selected.contact_name?<span className="entity-person-value"><i>{initials(selected.contact_name)}</i><b><span>{selected.contact_name}</span><small>{selected.contact_title||"Responsable de sede"}</small></b></span>:"Sin registrar"}/>
                  </div></div>
                  <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="phone"/></span>Contacto</h3><div className="entity-info-grid">
                    <InfoField label="Teléfono principal" value={selected.contact_phone?<span className="entity-inline-contact"><a href={telLink(selected.contact_phone)}><UiIcon name="phone" size={14}/>{selected.contact_phone}</a><a href={waLink(selected.contact_phone)} target="_blank" rel="noreferrer"><UiIcon name="whatsapp" size={14}/>WhatsApp</a></span>:"Sin registrar"}/>
                    <InfoField label="Correo electrónico" value={selected.contact_email?<a href={"mailto:"+selected.contact_email}>{selected.contact_email}</a>:"Sin registrar"}/>
                    <InfoField label="Contacto local" value={selected.contact_name||"Sin registrar"}/>
                    <InfoField label="Dirección" value={<button className="text-button" type="button" onClick={()=>copy(selected.address||"","Dirección")}>{copied==="Dirección"?"Dirección copiada":"Copiar dirección"}</button>}/>
                  </div></div>
                  <div className="entity-panel entity-approved-notes"><h3><span className="entity-section-icon"><UiIcon name="file"/></span>Notas adicionales</h3><p>{selected.notes||"Sin notas adicionales registradas para esta ubicación."}</p></div>
                </div>
                <div className="entity-approved-column entity-approved-map-column">
                  <div className="entity-panel entity-approved-map-panel"><h3><span className="entity-section-icon"><UiIcon name="location"/></span>Ubicación en el mapa</h3><GeofenceMapPicker initialAddress={selected.address} initialLatitude={selected.latitude} initialLongitude={selected.longitude} initialRadius={selected.geofence_radius_m} cityHint={selected.city} countryHint={selected.country} readOnly addressRequired={false} coordinateRequired={false} markerImageUrl={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null} markerLabel={selected.organization_name+" · "+selected.name} className="entity-profile-geofence"/></div>
                  <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="location"/></span>Geocerca</h3><div className="entity-info-grid">
                    <InfoField label="Radio de geocerca" value={selected.geofence_radius_m+" metros"}/>
                    <InfoField label="Coordenadas (lat, lng)" value={selected.latitude!==null&&selected.longitude!==null?Number(selected.latitude).toFixed(4)+", "+Number(selected.longitude).toFixed(4):"Pendientes"}/>
                    <InfoField label="Estado" value={<span className={"entity-geofence-state "+(selected.latitude!==null&&selected.longitude!==null?"active":"pending")}><i/>{selected.latitude!==null&&selected.longitude!==null?"Activa":"Pendiente"}</span>}/>
                    <InfoField label="Uso" value="Asistencia y contexto operativo"/>
                  </div></div>
                </div>
              </div>
            </div>},
            {id:"statistics",label:"Estadísticas",content:<div className="entity-section-stack">
              <StatTiles className="entity-stat-grid" items={[
                {label:"Sububicaciones",value:String(selected.location_count),hint:"espacios activos"},
                {label:"Activos",value:String(selected.asset_count),hint:"no retirados"},
                {label:"OT activas",value:String(siteServices.filter(item=>!["completed","cancelled"].includes(item.status)).length),hint:"abiertas o en ejecución",tone:"warning"},
                {label:"Técnicos asignados",value:String(siteTechnicians.length),hint:"derivados de actividades"},
              ]}/>
              <div className="entity-panel"><h3>Estado de mantenimiento</h3><div className="entity-info-grid">
                <InfoField label="Abiertas" value={siteServices.filter(item=>item.status==="open").length}/>
                <InfoField label="Asignadas" value={siteServices.filter(item=>item.status==="assigned").length}/>
                <InfoField label="En progreso" value={siteServices.filter(item=>item.status==="in_progress").length}/>
                <InfoField label="Finalizadas visibles" value={siteServices.filter(item=>item.status==="completed").length}/>
              </div></div>
            </div>},
            {id:"sublocations",label:"Sububicaciones",content:<div>
              <div className="location-list-toolbar"><strong>Cantidad: {visibleSubs.length}</strong><div>
                <Search value={subSearch} onValueChange={setSubSearch} placeholder="Buscar sububicación" ariaLabel="Buscar sububicación" compact/>
                <Select value={subStatus} onChange={event=>setSubStatus(event.target.value)} placeholder="" aria-label="Estado de sububicación" options={[
                  {value:"all",label:"Todas"},{value:"active",label:"Activas"},{value:"inactive",label:"Inactivas"},
                ]}/>
                {subTypeOptions.length>1&&<Select value={subType} onChange={event=>setSubType(event.target.value)} placeholder="" aria-label="Tipo de sububicación" options={[
                  {value:"all",label:"Todos los tipos"},...subTypeOptions.map(type=>({value:type,label:typeLabel(type)})),
                ]}/>}
              </div></div>
              {visibleSubs.length?<div className="sublocation-visual-grid">{visibleSubs.map(item=><SubLocationCard
                key={item.id}
                name={item.name}
                type={typeLabel(item.type)}
                assetCount={item.asset_count}
                imageSrc={item.has_image?"/api/locations/"+item.id+"/image":null}
                organizationLogoSrc={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null}
                fallback={initials(selected.organization_name)}
                onOpen={()=>{setSelectedSubId(item.id);setEditingSub(false);}}
              />)}</div>:<div className="location-detail-empty">Aún no hay sububicaciones. Usa la acción de crear para registrar la primera.</div>}
            </div>},
            {id:"services",label:"Servicios",content:<div><div className="location-list-toolbar"><strong>{visibleServices.length} registros</strong><div>
              <Search value={serviceSearch} onValueChange={setServiceSearch} placeholder="Buscar servicio" ariaLabel="Buscar servicio" compact/>
              <Select value={serviceStatus} onChange={event=>setServiceStatus(event.target.value)} placeholder="" aria-label="Estado del servicio" options={[
                {value:"all",label:"Todos"},{value:"open",label:"Abiertos"},{value:"assigned",label:"Asignados"},{value:"in_progress",label:"En progreso"},{value:"completed",label:"Finalizados"},
              ]}/>
            </div></div>{serviceList(visibleServices,"No hay servicios de mantenimiento para esta sede.")}</div>},
            {id:"technicians",label:"Técnicos",content:technicianList(siteTechnicians,"esta ubicación")},
            {id:"life",label:"Hoja de vida",content:<div className="entity-section-stack">
              <div className="entity-panel"><h3>Hoja de vida de la ubicación</h3><p className="entity-panel-copy">Consolida identidad, contacto, geocerca e indicadores operativos de la sede. El formato se genera con el alcance autorizado actual.</p></div>
              <StatTiles className="entity-stat-grid" items={[
                {label:"PDF",value:"Ejecutivo",hint:"impresión y archivo"},
                {label:"Excel",value:"Datos",hint:"resumen estructurado"},
                {label:"Word",value:"Editable",hint:"documento compatible"},
              ]}/>
              <ProfileExportMenu entity="site" id={selected.id} label="Exportar hoja de vida"/>
            </div>},
          ]}
        />
    </section>}

    {selected&&selectedSub&&<section className="section entity-page-detail">
        <EntityProfileWorkspace
          eyebrow="Estructura física"
          headingLabel="Sububicación"
          headingIcon="sublocation"
          breadcrumbs={[
            {label:"Inicio",href:"/dashboard"},
            {label:"Ubicaciones",onClick:()=>{setSelectedSiteId(null);setSelectedSubId(null);}},
            {label:selected.name,onClick:()=>setSelectedSubId(null)},
            {label:selectedSub.name},
          ]}
          title={selectedSub.name}
          subtitle={selected.name+" · "+selected.organization_name}
          meta={[typeLabel(selectedSub.type),selectedSub.code||"Sin código"]}
          coverSrc={selectedSub.has_image?"/api/locations/"+selectedSub.id+"/image":null}
          imageSrc={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null}
          fallback={initials(selected.organization_name)}
          status={<Badge variant={selectedSub.active?"success":"neutral"}>{selectedSub.active?"Activa":"Inactiva"}</Badge>}
          stats={[
            {label:"Sububicaciones",value:selectedSub.child_count,icon:"sublocation"},
            {label:"Activos",value:selectedSub.asset_count,icon:"asset"},
            {label:"OT activas",value:selectedSubServices.filter(item=>!["completed","cancelled"].includes(item.status)).length,icon:"work-order"},
            {label:"Técnicos",value:selectedSubTechnicians.length,icon:"user"},
          ]}
          toolbarActions={<>
            <button className="button secondary entity-action-button" type="button" onClick={()=>setEditingSub(value=>!value)}><UiIcon name="edit"/><span>{editingSub?"Cancelar edición":"Editar"}</span></button>
            <SubLocationCreateModal
              sites={[{id:selected.id,organization_id:selected.organization_id,name:selected.name,organization_name:selected.organization_name}]}
              locations={siteSubs.map(item=>({id:item.id,organization_id:item.organization_id,site_id:item.site_id,name:item.name,label:item.name}))}
              fixedSiteId={selected.id} fixedSiteName={selected.name} fixedParentId={selectedSub.id} returnTo="/dashboard/locations" triggerLabel="Crear dentro" secondary
            />
            <Link className="button secondary entity-action-button" href="/dashboard/assets"><UiIcon name="asset"/><span>Ver activos</span></Link>
            <ProfileExportMenu entity="location" id={selectedSub.id}/>
          </>}
          quickActions={<>
            <button type="button" onClick={()=>setEditingSub(true)}><UiIcon name="edit"/> Editar</button>
            <Link href="/dashboard/assets"><UiIcon name="asset"/> Activos</Link>
            <Link href="/dashboard/work-orders"><UiIcon name="work-order"/> Órdenes</Link>
            <ProfileExportMenu entity="location" id={selectedSub.id} label="Hoja de vida"/>
          </>}
          tabs={[
            {id:"general",label:"Información general",content:editingSub?<form method="post" encType="multipart/form-data" action={"/api/locations/"+selectedSub.id} className="form-grid">
              <input type="hidden" name="site_id" value={selected.id}/><input type="hidden" name="intent" value="update"/><input type="hidden" name="return_to" value="/dashboard/locations"/>
              <div className="field"><label>Nombre</label><input name="name" defaultValue={selectedSub.name} required/></div>
              <div className="field"><label>Código</label><input name="code" defaultValue={selectedSub.code||""}/></div>
              <div className="field"><label>Tipo</label><select name="type" defaultValue={selectedSub.type}><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
              <div className="field"><label>Descripción</label><input name="description" defaultValue={selectedSub.description||""}/></div>
              <div className="field form-span-2"><FileDropzone name="image" label="Actualizar foto" description="Imagen de referencia de esta sububicación." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={selectedSub.has_image?"Foto actual":null}/></div>
              <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setEditingSub(false)}>Cancelar</button><button className="button" type="submit">Guardar sububicación</button></div>
            </form>:<div className="entity-section-stack"><div className="entity-panel"><h3>Datos de la sububicación</h3><div className="entity-info-grid">
              <InfoField label="Nombre" value={selectedSub.name}/><InfoField label="Código" value={selectedSub.code||"Sin código"}/>
              <InfoField label="Tipo" value={typeLabel(selectedSub.type)}/><InfoField label="Sede principal" value={selected.name}/>
              <InfoField label="Empresa" value={selected.organization_name}/><InfoField label="Estado" value={selectedSub.active?"Activa":"Inactiva"}/>
              <div className="form-span-2"><InfoField label="Descripción" value={selectedSub.description||"Sin descripción"}/></div>
            </div></div></div>},
            {id:"statistics",label:"Estadísticas",content:<StatTiles className="entity-stat-grid" items={[
              {label:"Sububicaciones internas",value:String(selectedSub.child_count)},
              {label:"Activos",value:String(selectedSub.asset_count)},
              {label:"OT activas",value:String(selectedSubServices.filter(item=>!["completed","cancelled"].includes(item.status)).length),tone:"warning"},
              {label:"OT finalizadas visibles",value:String(selectedSubServices.filter(item=>item.status==="completed").length),tone:"success"},
            ]}/>},
            {id:"services",label:"Servicios",content:serviceList(selectedSubServices,"No hay servicios asociados directamente a esta sububicación.")},
            {id:"technicians",label:"Técnicos",content:technicianList(selectedSubTechnicians,"esta sububicación")},
            {id:"life",label:"Hoja de vida",content:<div className="entity-section-stack"><div className="entity-panel"><h3>Hoja de vida de sububicación</h3><p className="entity-panel-copy">Consolida identificación, jerarquía, descripción, activos y órdenes asociadas directamente al espacio.</p></div><ProfileExportMenu entity="location" id={selectedSub.id} label="Exportar hoja de vida"/></div>},
          ]}
        />
    </section>}
  </div>;
}
