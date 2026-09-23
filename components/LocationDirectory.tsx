"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SubLocationCreateModal } from "@/components/ContextCreateModals";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import BusinessHoursFields from "@/components/BusinessHoursFields";
import FileDropzone from "@/components/FileDropzone";

export type LocationDirectorySite={
  id:string; organization_id:string; organization_name:string; name:string; code:string|null;
  address:string|null; city:string|null; country:string; active:boolean; location_count:number; asset_count:number;
  latitude:number|null; longitude:number|null; geofence_radius_m:number;
  has_image:boolean; organization_has_logo:boolean; contact_name:string|null; contact_phone:string|null; contact_email:string|null;
  business_days:number[]; business_open_time:string; business_close_time:string;
};
export type LocationDirectorySub={
  id:string; organization_id:string; site_id:string; parent_id:string|null; name:string; code:string|null; type:string;
  description:string|null; active:boolean; asset_count:number; child_count:number; has_image:boolean;
};
export type LocationDirectoryService={
  id:string; site_id:string; number:string; title:string; status:string; type:string; priority:string; requested_at:string; location_name:string|null;
};

function initials(value:string){ return value.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase(); }
function countryName(code:string){
  const names:Record<string,string>={CO:"Colombia",PE:"Perú",EC:"Ecuador",MX:"México",CL:"Chile",AR:"Argentina",US:"Estados Unidos",PA:"Panamá",CR:"Costa Rica"};
  return names[code.toUpperCase()]||code;
}
function waLink(phone:string){ const digits=phone.replace(/\D/g,""); return digits ? "https://wa.me/"+digits : ""; }
function statusLabel(status:string){
  const map:Record<string,string>={open:"Abierta",assigned:"Asignada",in_progress:"En progreso",paused:"Pausada",completed:"Finalizada",cancelled:"Cancelada"};
  return map[status]||status;
}

export default function LocationDirectory({sites,sublocations,services}:{sites:LocationDirectorySite[];sublocations:LocationDirectorySub[];services:LocationDirectoryService[];}){
  const [selectedSiteId,setSelectedSiteId]=useState<string|null>(null);
  const [editingSite,setEditingSite]=useState(false);
  const [selectedSubId,setSelectedSubId]=useState<string|null>(null);
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

  async function copy(value:string,label:string){
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(()=>setCopied(""),1500);
  }
  function openSite(id:string){
    setSelectedSiteId(id); setEditingSite(false); setSelectedSubId(null);
    setSubSearch(""); setSubStatus("all"); setServiceSearch(""); setServiceStatus("all");
  }

  return <>
    <div className="site-visual-grid site-visual-grid-compact">
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
          <Link
            href="/dashboard/locations"
            className="site-resource-action"
            title="Sububicaciones"
            data-tooltip="Sububicaciones"
            aria-label={"Sububicaciones: "+site.location_count+". Abrir módulo."}
          >
            <span className="site-resource-icon" aria-hidden="true">⌁</span>
            <strong>{site.location_count}</strong>
          </Link>
          <Link
            href="/dashboard/assets"
            className="site-resource-action"
            title="Activos"
            data-tooltip="Activos"
            aria-label={"Activos: "+site.asset_count+". Abrir módulo."}
          >
            <span className="site-resource-icon" aria-hidden="true">◇</span>
            <strong>{site.asset_count}</strong>
          </Link>
        </nav>
      </article>)}
    </div>

    {selected&&<div className="modal-backdrop location-detail-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedSiteId(null);}}>
      <section className="location-detail-modal" role="dialog" aria-modal="true" aria-label={"Información de "+selected.name}>
        <header className="location-detail-brandbar"><strong>{selected.organization_name}</strong><button type="button" aria-label="Cerrar" onClick={()=>setSelectedSiteId(null)}>×</button></header>

        <div className="location-detail-section-title"><h2>Información de ubicación</h2><button className="location-square-action" type="button" onClick={()=>setEditingSite(value=>!value)} aria-label="Editar ubicación">✎</button></div>

        {!editingSite?<div className="location-detail-info">
          <div className="location-detail-identity">
            <div className="location-detail-site-photo">{selected.has_image?<img src={"/api/sites/"+selected.id+"/image"} alt="" />:<span>⌂</span>}</div>
            <div><span className="eyebrow">{selected.organization_name}</span><h3>{selected.name}</h3><p>Código: {selected.code||"Sin código"}</p></div>
          </div>
          <div className="location-detail-contact">
            <h3>Contacto</h3>
            <button type="button" onClick={()=>copy(selected.contact_name||"","Nombre")}><span>Nombre</span><strong>{selected.contact_name||"Sin registrar"}</strong></button>
            <button type="button" onClick={()=>copy(selected.contact_phone||"","Teléfono")}><span>Teléfono</span><strong>{selected.contact_phone||"Sin registrar"}</strong></button>
            <button type="button" onClick={()=>copy(selected.contact_email||"","Correo")}><span>Correo</span><strong>{selected.contact_email||"Sin registrar"}</strong></button>
            <div className="location-business-hours"><span>Horario</span><strong>{selected.business_open_time.slice(0,5)} – {selected.business_close_time.slice(0,5)}</strong></div>
            {selected.contact_phone&&<a className="location-whatsapp-button" href={waLink(selected.contact_phone)} target="_blank" rel="noreferrer">WhatsApp ↗</a>}
            {copied&&<small className="location-copy-toast">{copied} copiado</small>}
          </div>
        </div>:<form className="location-detail-edit-form" method="post" encType="multipart/form-data" action={"/api/sites/"+selected.id}>
          <input type="hidden" name="organization_id" value={selected.organization_id}/><input type="hidden" name="return_to" value="/dashboard/locations"/>
          <div className="form-grid">
            <div className="field"><label>Nombre *</label><input name="name" defaultValue={selected.name} required/></div>
            <div className="field"><label>Código interno</label><input name="code" defaultValue={selected.code||""}/><small>Opcional. Identifica la sede en OT, reportes e integraciones.</small></div>
            <div className="field"><label>Ciudad *</label><input name="city" defaultValue={selected.city||""} required/></div>
            <div className="field"><label>País *</label><input name="country" defaultValue={selected.country} required/></div>
            <div className="field"><label>Contacto</label><input name="contact_name" defaultValue={selected.contact_name||""}/></div>
            <div className="field"><label>WhatsApp / teléfono</label><input name="contact_phone" defaultValue={selected.contact_phone||""}/></div>
            <div className="field form-span-2"><label>Correo</label><input type="email" name="contact_email" defaultValue={selected.contact_email||""}/></div>
            <BusinessHoursFields
              days={selected.business_days}
              openTime={selected.business_open_time}
              closeTime={selected.business_close_time}
              title="Horario de atención de la sede"
              description="Reacción usa este horario para el filtro Abiertos ahora."
            />
            <div className="form-span-2"><FileDropzone name="image" label="Actualizar foto de sede" description="Selecciona una nueva imagen solo si quieres reemplazar la actual." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={selected.has_image ? "Foto de sede actual" : null} /></div>
          </div>
          <GeofenceMapPicker
            initialAddress={selected.address}
            initialLatitude={selected.latitude}
            initialLongitude={selected.longitude}
            initialRadius={selected.geofence_radius_m}
            cityHint={selected.city}
            countryHint={selected.country}
            markerImageUrl={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null}
            markerLabel={selected.organization_name}
          />
          <div className="form-actions"><button className="button secondary" type="button" onClick={()=>setEditingSite(false)}>Cancelar</button><button className="button" type="submit">Guardar cambios</button></div>
        </form>}

        <div className="location-facts-row">
          <div><span>◉</span><p><strong>{countryName(selected.country)}</strong><small>País</small></p></div>
          <div><span>⌁</span><p><strong>{selected.city||"Sin registrar"}</strong><small>Ciudad</small></p></div>
          <div className="wide"><span>⌖</span><p><strong>{selected.address||"Dirección sin registrar"}</strong><small>Dirección</small></p><button type="button" onClick={()=>copy(selected.address||"","Dirección")}>Copiar</button></div>
        </div>
        <div className="location-geofence-view">
          <div className="location-detail-section-title compact">
            <h2>{editingSite?"Resumen de geocerca":"Mapa y geocerca biométrica"}</h2>
            <span className={selected.latitude!==null&&selected.longitude!==null?"status-badge status-active":"status-badge"}>{selected.latitude!==null&&selected.longitude!==null?"Configurada":"Pendiente"}</span>
          </div>
          {editingSite
            ? <div className="location-geofence-summary">
                <div><span>Dirección</span><strong>{selected.address||"Sin validar"}</strong></div>
                <div><span>Latitud</span><strong>{selected.latitude!==null?Number(selected.latitude).toFixed(6):"—"}</strong></div>
                <div><span>Longitud</span><strong>{selected.longitude!==null?Number(selected.longitude).toFixed(6):"—"}</strong></div>
                <div><span>Radio</span><strong>{selected.geofence_radius_m||250} m</strong></div>
                <p>El mapa editable de arriba concentra los cambios. Al guardar, este resumen se actualiza con la nueva geocerca.</p>
              </div>
            : <GeofenceMapPicker
                initialAddress={selected.address}
                initialLatitude={selected.latitude}
                initialLongitude={selected.longitude}
                initialRadius={selected.geofence_radius_m}
                cityHint={selected.city}
                countryHint={selected.country}
                readOnly
                addressRequired={false}
                coordinateRequired={false}
                markerImageUrl={selected.organization_has_logo?"/api/organizations/"+selected.organization_id+"/assets/logo":null}
                markerLabel={selected.organization_name}
              />}
        </div>

        <div className="location-detail-section-title">
          <h2>Sububicaciones</h2>
          <SubLocationCreateModal
            sites={[{id:selected.id,organization_id:selected.organization_id,name:selected.name,organization_name:selected.organization_name}]}
            locations={siteSubs.map(item=>({id:item.id,organization_id:item.organization_id,site_id:item.site_id,name:item.name,label:item.name}))}
            fixedSiteId={selected.id} fixedSiteName={selected.name} returnTo="/dashboard/locations" triggerLabel="+" secondary
          />
        </div>
        <div className="location-detail-body">
          <div className="location-list-toolbar"><strong>Cantidad: {visibleSubs.length}</strong><div><input value={subSearch} onChange={event=>setSubSearch(event.target.value)} placeholder="Buscar sububicación"/><select value={subStatus} onChange={event=>setSubStatus(event.target.value)}><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></div></div>
          {visibleSubs.length?<div className="sublocation-visual-grid">{visibleSubs.map(item=><article className="sublocation-visual-card" key={item.id}>
            <button type="button" onClick={()=>setSelectedSubId(item.id)}>
              <div className={"sublocation-visual-photo"+(item.has_image?"":" fallback")}>{item.has_image&&<img src={"/api/locations/"+item.id+"/image"} alt="" />}</div>
              <div className="sublocation-mini-logo">{selected.organization_has_logo?<img src={"/api/organizations/"+selected.organization_id+"/assets/logo"} alt="" />:<span>{initials(selected.organization_name)}</span>}</div>
              <strong>{item.name}</strong><small>{item.type} · {item.asset_count} activos</small>
            </button>
          </article>)}</div>:<div className="location-detail-empty">Aún no hay sububicaciones. Usa <strong>+</strong> para crear la primera.</div>}
        </div>

        {selectedSub&&<div className="sublocation-inline-detail">
          <div className="sublocation-inline-head"><div><span className="eyebrow">{selectedSub.type}</span><h3>{selectedSub.name}</h3><p>{selectedSub.code||"Sin código"} · {selectedSub.description||"Sin descripción"}</p></div><button type="button" onClick={()=>setSelectedSubId(null)}>×</button></div>
          <form method="post" encType="multipart/form-data" action={"/api/locations/"+selectedSub.id} className="form-grid">
            <input type="hidden" name="site_id" value={selected.id}/><input type="hidden" name="intent" value="update"/><input type="hidden" name="return_to" value="/dashboard/locations"/>
            <div className="field"><label>Nombre</label><input name="name" defaultValue={selectedSub.name} required/></div>
            <div className="field"><label>Código</label><input name="code" defaultValue={selectedSub.code||""}/></div>
            <div className="field"><label>Tipo</label><select name="type" defaultValue={selectedSub.type}><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
            <div className="field"><label>Descripción</label><input name="description" defaultValue={selectedSub.description||""}/></div>
            <div className="field form-span-2"><label>Actualizar foto</label><FileDropzone name="image" label="Foto de la sede" description="Imagen de referencia de esta ubicación." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" /></div>
            <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar sububicación</button></div>
          </form>
        </div>}

        <div className="location-detail-section-title"><h2>Servicios de mantenimiento</h2></div>
        <div className="location-detail-body">
          <div className="location-list-toolbar"><strong>{visibleServices.length} registros</strong><div><input value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Buscar servicio"/><select value={serviceStatus} onChange={event=>setServiceStatus(event.target.value)}><option value="all">Todos</option><option value="open">Abiertos</option><option value="assigned">Asignados</option><option value="in_progress">En progreso</option><option value="completed">Finalizados</option></select></div></div>
          {visibleServices.length?<div className="location-service-list">{visibleServices.map(item=><a key={item.id} href={"/dashboard/work-orders/"+item.id} className="location-service-card"><span className={"status-dot status-"+item.status}/><div><small>{new Date(item.requested_at).toLocaleDateString("es-CO")} · OT #{item.number}</small><strong>{item.title}</strong><span>{item.location_name||selected.name}</span></div><b>{statusLabel(item.status)}</b></a>)}</div>:<div className="location-detail-empty">No hay servicios de mantenimiento para esta sede.</div>}
        </div>
      </section>
    </div>}
  </>;
}
