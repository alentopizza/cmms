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

export type LocationDirectorySite={
  id:string; organization_id:string; organization_name:string; name:string; code:string|null;
  address:string|null; city:string|null; country:string; active:boolean; location_count:number; asset_count:number; technician_count:number;
  latitude:number|null; longitude:number|null; geofence_radius_m:number;
  has_image:boolean; organization_has_logo:boolean; contact_name:string|null; contact_phone:string|null; contact_email:string|null;
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
function MetricCard({label,value,hint}:{label:string;value:React.ReactNode;hint?:string}){
  return <div className="entity-stat-card"><small>{label}</small><strong>{value}</strong>{hint&&<span>{hint}</span>}</div>;
}

export default function LocationDirectory({sites,sublocations,services}:{sites:LocationDirectorySite[];sublocations:LocationDirectorySub[];services:LocationDirectoryService[];}){
  const [selectedSiteId,setSelectedSiteId]=useState<string|null>(null);
  const [editingSite,setEditingSite]=useState(false);
  const [selectedSubId,setSelectedSubId]=useState<string|null>(null);
  const [editingSub,setEditingSub]=useState(false);
  const [subSearch,setSubSearch]=useState("");
  const [subStatus,setSubStatus]=useState("all");
  const [serviceSearch,setServiceSearch]=useState("");
  const [serviceStatus,setServiceStatus]=useState("all");
  const [copied,setCopied]=useState("");

  const selected=sites.find(site=>site.id===selectedSiteId)||null;
  const siteSubs=useMemo(()=>sublocations.filter(item=>item.site_id===selectedSiteId),[sublocations,selectedSiteId]);
  const visibleSubs=useMemo(()=>siteSubs.filter(item=>{
    const search=subSearch.trim().toLocaleLowerCase("es");
    const matchesSearch=!search||[item.name,item.code,item.type,item.description].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search);
    const matchesStatus=subStatus==="all"||(subStatus==="active"?item.active:!item.active);
    return matchesSearch&&matchesStatus;
  }),[siteSubs,subSearch,subStatus]);
  const siteServices=useMemo(()=>services.filter(item=>item.site_id===selectedSiteId),[services,selectedSiteId]);
  const visibleServices=useMemo(()=>siteServices.filter(item=>{
    const search=serviceSearch.trim().toLocaleLowerCase("es");
    const matchesSearch=!search||[item.number,item.title,item.type,item.priority,item.location_name].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search);
    const matchesStatus=serviceStatus==="all"||item.status===serviceStatus;
    return matchesSearch&&matchesStatus;
  }),[siteServices,serviceSearch,serviceStatus]);
  const selectedSub=siteSubs.find(item=>item.id===selectedSubId)||null;
  const selectedSubServices=selectedSub?siteServices.filter(item=>item.location_id===selectedSub.id):[];

  async function copy(value:string,label:string){
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(()=>setCopied(""),1500);
  }
  function openSite(id:string){
    setSelectedSiteId(id);setEditingSite(false);setSelectedSubId(null);setEditingSub(false);
    setSubSearch("");setSubStatus("all");setServiceSearch("");setServiceStatus("all");
  }

  function serviceList(items:LocationDirectoryService[],empty:string){
    return <div className="location-service-list">
      {items.length?items.map(item=><a key={item.id} href={"/dashboard/work-orders/"+item.id} className="location-service-card">
        <span className={"status-dot status-"+item.status}/>
        <div><small>{new Date(item.requested_at).toLocaleDateString("es-CO")} · OT #{item.number}</small><strong>{item.title}</strong><span>{item.location_name||"Sin sububicación"}</span></div>
        <b>{statusLabel(item.status)}</b>
      </a>):<div className="location-detail-empty">{empty}</div>}
    </div>;
  }

  return <>
    {!selected&&<div className="site-visual-grid site-visual-grid-compact">
      {sites.map(site=><article
        className="site-visual-card site-compact-card" key={site.id} data-module-record data-status={site.active?"active":"inactive"}
        data-search={[site.name,site.organization_name,site.code,site.city,site.country,site.address].filter(Boolean).join(" ")}
      >
        <button className="site-visual-card-button site-card-main-action" type="button" onClick={()=>openSite(site.id)}>
          <div className={"site-visual-cover"+(site.has_image?"":" fallback")}>{site.has_image&&<img src={"/api/sites/"+site.id+"/image"} alt="" />}</div>
          <div className="site-company-logo">{site.organization_has_logo?<img src={"/api/organizations/"+site.organization_id+"/assets/logo"} alt={"Logo de "+site.organization_name} />:<span>{initials(site.organization_name)}</span>}</div>
          <div className="site-visual-content site-visual-content-compact">
            <h3>{site.name}</h3>
            <p><span>{site.organization_name}</span><span>{site.city||"Ciudad sin registrar"} · {countryName(site.country)}</span><span>{site.address||"Dirección sin registrar"}</span></p>
          </div>
        </button>
        <nav className="site-resource-actions" aria-label={"Recursos de "+site.name}>
          <button type="button" className="site-resource-action" title="Sububicaciones" data-tooltip="Sububicaciones" aria-label={"Sububicaciones: "+site.location_count} onClick={()=>openSite(site.id)}>
            <span className="site-resource-icon" aria-hidden="true">⌁</span><strong>{site.location_count}</strong>
          </button>
          <Link href="/dashboard/assets" className="site-resource-action" title="Activos" data-tooltip="Activos" aria-label={"Activos: "+site.asset_count+". Abrir módulo."}>
            <span className="site-resource-icon" aria-hidden="true">◇</span><strong>{site.asset_count}</strong>
          </Link>
        </nav>
      </article>)}
    </div>}

    {selected&&!selectedSub&&<section className="section entity-page-detail">
        <EntityProfileWorkspace
          eyebrow="Estructura física"
          headingLabel="Ubicación"
          headingIcon="⌖"
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
          status={<span className={"status-badge "+(selected.active?"status-active":"status-inactive")}><i />{selected.active?"Activa":"Inactiva"}</span>}
          stats={[
            {label:"Sububicaciones",value:selected.location_count,icon:"⌁"},
            {label:"Activos",value:selected.asset_count,icon:"◇"},
            {label:"OT activas",value:siteServices.filter(item=>!["completed","cancelled"].includes(item.status)).length,icon:"✓"},
            {label:"Técnicos",value:selected.technician_count,icon:"◎"},
          ]}
          toolbarActions={<>
            <button className="button secondary" type="button" onClick={()=>setEditingSite(value=>!value)}>✎ {editingSite?"Cancelar edición":"Editar"}</button>
            {selected.latitude!==null&&selected.longitude!==null&&<a className="button secondary" href={"https://www.google.com/maps?q="+selected.latitude+","+selected.longitude} target="_blank" rel="noreferrer">⌖ Ver mapa</a>}
            <SubLocationCreateModal
              sites={[{id:selected.id,organization_id:selected.organization_id,name:selected.name,organization_name:selected.organization_name}]}
              locations={siteSubs.map(item=>({id:item.id,organization_id:item.organization_id,site_id:item.site_id,name:item.name,label:item.name}))}
              fixedSiteId={selected.id} fixedSiteName={selected.name} returnTo="/dashboard/locations" triggerLabel="Crear sububicación" secondary
            />
            <Link className="button secondary" href={"/dashboard/users?create=1&organization_id="+selected.organization_id+"&site_id="+selected.id+"&role=technician"}>◎ Agregar técnico</Link>
            <ProfileExportMenu entity="site" id={selected.id}/>
          </>}
          quickActions={<>
            {selected.latitude!==null&&selected.longitude!==null&&<a href={"https://www.google.com/maps?q="+selected.latitude+","+selected.longitude} target="_blank" rel="noreferrer">⌖ Ver mapa</a>}
            <button type="button" onClick={()=>setEditingSite(true)}>✎ Editar</button>
            <Link href={"/dashboard/users?create=1&organization_id="+selected.organization_id+"&site_id="+selected.id+"&role=technician"}>◎ Agregar técnico</Link>
            {selected.contact_phone&&<a href={waLink(selected.contact_phone)} target="_blank" rel="noreferrer">◉ WhatsApp</a>}
          </>}
          tabs={[
            {id:"general",label:"Información general",content:editingSite?<form className="location-detail-edit-form entity-section-stack" method="post" encType="multipart/form-data" action={"/api/sites/"+selected.id}>
              <input type="hidden" name="organization_id" value={selected.organization_id}/><input type="hidden" name="return_to" value="/dashboard/locations"/>
              <div className="form-grid">
                <div className="field"><label>Nombre *</label><input name="name" defaultValue={selected.name} required/></div>
                <div className="field"><label>Código interno</label><input name="code" defaultValue={selected.code||""}/><small>Opcional. Identifica la sede en OT, reportes e integraciones.</small></div>
                <div className="field"><label>Ciudad *</label><input name="city" defaultValue={selected.city||""} required/></div>
                <div className="field"><label>País *</label><input id="location-country" name="country" defaultValue={selected.country} required/></div>
                <div className="field"><label>Contacto</label><input name="contact_name" defaultValue={selected.contact_name||""}/></div>
                <PhoneField name="contact_phone" label="WhatsApp / teléfono" countryCode={selected.country} countryInputId="location-country" defaultValue={selected.contact_phone} />
                <div className="field form-span-2"><label>Correo</label><input type="email" name="contact_email" defaultValue={selected.contact_email||""}/></div>
                <BusinessHoursFields days={selected.business_days} openTime={selected.business_open_time} closeTime={selected.business_close_time} schedule={selected.business_schedule} title="Horario de atención de la sede" description="Reacción usa este horario para el filtro Abiertos ahora."/>
                <div className="form-span-2"><FileDropzone name="image" label="Actualizar foto de sede" description="Selecciona una nueva imagen solo si quieres reemplazar la actual." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={selected.has_image?"Foto de sede actual":null}/></div>
              </div>
              <GeofenceMapPicker initialAddress={selected.address} initialLatitude={selected.latitude} initialLongitude={selected.longitude} initialRadius={selected.geofence_radius_m} cityHint={selected.city} countryHint={selected.country} markerImageUrl={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null} markerLabel={selected.organization_name}/>
              <div className="form-actions"><button className="button secondary" type="button" onClick={()=>setEditingSite(false)}>Cancelar</button><button className="button" type="submit">Guardar cambios</button></div>
            </form>:<div className="entity-section-stack">
              <div className="entity-two-column">
                <div className="entity-panel"><h3>Datos de la ubicación</h3><div className="entity-info-grid">
                  <InfoField label="Nombre de la ubicación" value={selected.name}/><InfoField label="Código / identificador" value={selected.code||"Sin código"}/>
                  <InfoField label="Empresa" value={selected.organization_name}/><InfoField label="Tipo de ubicación" value="Sede principal"/>
                  <InfoField label="Dirección" value={selected.address||"Sin registrar"}/><InfoField label="Ciudad" value={selected.city||"Sin registrar"}/>
                  <InfoField label="País" value={countryName(selected.country)}/><InfoField label="Horario de operación" value={scheduleLabel(selected)}/>
                  <InfoField label="Responsable / contacto" value={selected.contact_name||"Sin registrar"}/><InfoField label="Estado" value={selected.active?"Activa":"Inactiva"}/>
                </div></div>
                <div className="entity-panel"><h3>Ubicación en el mapa</h3><GeofenceMapPicker initialAddress={selected.address} initialLatitude={selected.latitude} initialLongitude={selected.longitude} initialRadius={selected.geofence_radius_m} cityHint={selected.city} countryHint={selected.country} readOnly addressRequired={false} coordinateRequired={false} markerImageUrl={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null} markerLabel={selected.organization_name}/></div>
              </div>
              <div className="entity-panel-grid">
                <div className="entity-panel"><h3>Contacto</h3><div className="entity-info-grid">
                  <InfoField label="Teléfono principal" value={selected.contact_phone?<span><a href={telLink(selected.contact_phone)}>{selected.contact_phone}</a> · <a href={waLink(selected.contact_phone)} target="_blank" rel="noreferrer">WhatsApp</a></span>:"Sin registrar"}/>
                  <InfoField label="Correo electrónico" value={selected.contact_email||"Sin registrar"}/>
                  <InfoField label="Contacto local" value={selected.contact_name||"Sin registrar"}/>
                  <InfoField label="Copiar dirección" value={<button className="text-button" type="button" onClick={()=>copy(selected.address||"","Dirección")}>{copied==="Dirección"?"Copiada":"Copiar"}</button>}/>
                </div></div>
                <div className="entity-panel"><h3>Geocerca</h3><div className="entity-info-grid">
                  <InfoField label="Radio" value={selected.geofence_radius_m+" m"}/>
                  <InfoField label="Coordenadas" value={selected.latitude!==null&&selected.longitude!==null?Number(selected.latitude).toFixed(6)+", "+Number(selected.longitude).toFixed(6):"Pendientes"}/>
                  <InfoField label="Estado" value={selected.latitude!==null&&selected.longitude!==null?"Configurada":"Pendiente"}/>
                  <InfoField label="Uso" value="Asistencia y contexto operativo"/>
                </div></div>
              </div>
            </div>},
            {id:"statistics",label:"Estadísticas",content:<div className="entity-section-stack">
              <div className="entity-stat-grid">
                <MetricCard label="Sububicaciones" value={selected.location_count} hint="espacios activos"/>
                <MetricCard label="Activos" value={selected.asset_count} hint="no retirados"/>
                <MetricCard label="OT activas" value={siteServices.filter(item=>!["completed","cancelled"].includes(item.status)).length} hint="abiertas o en ejecución"/>
                <MetricCard label="Técnicos" value={selected.technician_count} hint="con alcance en la sede"/>
              </div>
              <div className="entity-panel"><h3>Estado de mantenimiento</h3><div className="entity-info-grid">
                <InfoField label="Abiertas" value={siteServices.filter(item=>item.status==="open").length}/>
                <InfoField label="Asignadas" value={siteServices.filter(item=>item.status==="assigned").length}/>
                <InfoField label="En progreso" value={siteServices.filter(item=>item.status==="in_progress").length}/>
                <InfoField label="Finalizadas visibles" value={siteServices.filter(item=>item.status==="completed").length}/>
              </div></div>
            </div>},
            {id:"sublocations",label:"Sububicaciones",content:<div>
              <div className="location-list-toolbar"><strong>Cantidad: {visibleSubs.length}</strong><div><input value={subSearch} onChange={event=>setSubSearch(event.target.value)} placeholder="Buscar sububicación"/><select value={subStatus} onChange={event=>setSubStatus(event.target.value)}><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></div></div>
              {visibleSubs.length?<div className="sublocation-visual-grid">{visibleSubs.map(item=><article className="sublocation-visual-card" key={item.id}><button type="button" onClick={()=>{setSelectedSubId(item.id);setEditingSub(false);}}>
                <div className={"sublocation-visual-photo"+(item.has_image?"":" fallback")}>{item.has_image&&<img src={"/api/locations/"+item.id+"/image"} alt="" />}</div>
                <div className="sublocation-mini-logo">{selected.organization_has_logo?<img src={"/api/organizations/"+selected.organization_id+"/assets/logo"} alt="" />:<span>{initials(selected.organization_name)}</span>}</div>
                <strong>{item.name}</strong><small>{typeLabel(item.type)} · {item.asset_count} activos</small>
              </button></article>)}</div>:<div className="location-detail-empty">Aún no hay sububicaciones. Usa la acción de crear para registrar la primera.</div>}
            </div>},
            {id:"services",label:"Servicios",content:<div><div className="location-list-toolbar"><strong>{visibleServices.length} registros</strong><div><input value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Buscar servicio"/><select value={serviceStatus} onChange={event=>setServiceStatus(event.target.value)}><option value="all">Todos</option><option value="open">Abiertos</option><option value="assigned">Asignados</option><option value="in_progress">En progreso</option><option value="completed">Finalizados</option></select></div></div>{serviceList(visibleServices,"No hay servicios de mantenimiento para esta sede.")}</div>},
            {id:"life",label:"Hoja de vida",content:<div className="entity-section-stack">
              <div className="entity-panel"><h3>Hoja de vida de la ubicación</h3><p className="entity-panel-copy">Consolida identidad, contacto, geocerca e indicadores operativos de la sede. El formato se genera con el alcance autorizado actual.</p></div>
              <div className="entity-stat-grid"><MetricCard label="PDF" value="Ejecutivo" hint="impresión y archivo"/><MetricCard label="Excel" value="Datos" hint="resumen estructurado"/><MetricCard label="Word" value="Editable" hint="documento compatible"/></div>
              <ProfileExportMenu entity="site" id={selected.id} label="Exportar hoja de vida"/>
            </div>},
          ]}
        />
    </section>}

    {selected&&selectedSub&&<section className="section entity-page-detail">
        <EntityProfileWorkspace
          eyebrow="Estructura física"
          headingLabel="Sububicación"
          headingIcon="⌁"
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
          status={<span className={"status-badge "+(selectedSub.active?"status-active":"status-inactive")}><i />{selectedSub.active?"Activa":"Inactiva"}</span>}
          stats={[
            {label:"Sububicaciones",value:selectedSub.child_count,icon:"⌁"},
            {label:"Activos",value:selectedSub.asset_count,icon:"◇"},
            {label:"OT activas",value:selectedSubServices.filter(item=>!["completed","cancelled"].includes(item.status)).length,icon:"✓"},
            {label:"Estado",value:selectedSub.active?"Activa":"Inactiva",icon:"◉"},
          ]}
          toolbarActions={<>
            <button className="button secondary" type="button" onClick={()=>setEditingSub(value=>!value)}>✎ {editingSub?"Cancelar edición":"Editar"}</button>
            <SubLocationCreateModal
              sites={[{id:selected.id,organization_id:selected.organization_id,name:selected.name,organization_name:selected.organization_name}]}
              locations={siteSubs.map(item=>({id:item.id,organization_id:item.organization_id,site_id:item.site_id,name:item.name,label:item.name}))}
              fixedSiteId={selected.id} fixedSiteName={selected.name} fixedParentId={selectedSub.id} returnTo="/dashboard/locations" triggerLabel="Crear dentro" secondary
            />
            <Link className="button secondary" href="/dashboard/assets">◇ Ver activos</Link>
            <ProfileExportMenu entity="location" id={selectedSub.id}/>
          </>}
          quickActions={<>
            <button type="button" onClick={()=>setEditingSub(true)}>✎ Editar</button>
            <Link href="/dashboard/assets">◇ Activos</Link>
            <Link href="/dashboard/work-orders">✓ Órdenes</Link>
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
            {id:"statistics",label:"Estadísticas",content:<div className="entity-stat-grid">
              <MetricCard label="Sububicaciones internas" value={selectedSub.child_count}/><MetricCard label="Activos" value={selectedSub.asset_count}/>
              <MetricCard label="OT activas" value={selectedSubServices.filter(item=>!["completed","cancelled"].includes(item.status)).length}/><MetricCard label="OT finalizadas visibles" value={selectedSubServices.filter(item=>item.status==="completed").length}/>
            </div>},
            {id:"services",label:"Servicios",content:serviceList(selectedSubServices,"No hay servicios asociados directamente a esta sububicación.")},
            {id:"life",label:"Hoja de vida",content:<div className="entity-section-stack"><div className="entity-panel"><h3>Hoja de vida de sububicación</h3><p className="entity-panel-copy">Consolida identificación, jerarquía, descripción, activos y órdenes asociadas directamente al espacio.</p></div><ProfileExportMenu entity="location" id={selectedSub.id} label="Exportar hoja de vida"/></div>},
          ]}
        />
    </section>}
  </>;
}
