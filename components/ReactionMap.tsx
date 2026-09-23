"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BusinessHours={days:number[];openTime:string;closeTime:string};
type CompanyPoint={
  id:string;name:string;lat:number;lng:number;timezone:string;businessHours:BusinessHours;openNow:boolean;logoUrl:string|null;
};
type SitePoint={
  id:string;organizationId:string;organizationName:string;name:string;
  lat:number;lng:number;radius:number;businessHours:BusinessHours;openNow:boolean;logoUrl:string|null;
};
type TechnicianPoint={
  trackingSessionId:string;userId:string;fullName:string;organizationId:string;organizationName:string;
  lat:number;lng:number;accuracy:number|null;lastSeenAt:string;avatarUrl:string|null;
  route:Array<{lat:number;lng:number;at:string}>;
};
type Snapshot={companies:CompanyPoint[];sites:SitePoint[];technicians:TechnicianPoint[];generatedAt:string};
type HoursFilter="all"|"open"|"closed";

declare global{
  interface Window{
    google?:any;
    __deswebReactionMapsReady?:()=>void;
  }
}

let mapsPromise:Promise<any>|null=null;

function loadMaps(apiKey:string){
  if(window.google?.maps?.Map&&window.google?.maps?.marker?.AdvancedMarkerElement) return Promise.resolve(window.google);
  if(mapsPromise)return mapsPromise;

  mapsPromise=new Promise((resolve,reject)=>{
    const finish=()=>{
      if(window.google?.maps?.Map&&window.google?.maps?.marker?.AdvancedMarkerElement) resolve(window.google);
      else reject(new Error("Google Maps no cargó las librerías de Reacción."));
    };
    window.__deswebReactionMapsReady=finish;

    const existing=document.querySelector<HTMLScriptElement>('script[data-desweb-google-maps="true"]');
    if(existing){
      const timer=window.setInterval(()=>{
        if(window.google?.maps?.Map&&window.google?.maps?.marker?.AdvancedMarkerElement){
          window.clearInterval(timer);
          finish();
        }
      },100);
      window.setTimeout(()=>{window.clearInterval(timer);},10000);
      return;
    }

    const script=document.createElement("script");
    const params=new URLSearchParams({
      key:apiKey,v:"weekly",loading:"async",libraries:"marker",
      callback:"__deswebReactionMapsReady",
    });
    script.src=`https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async=true;
    script.defer=true;
    script.dataset.deswebGoogleMaps="true";
    script.onerror=()=>reject(new Error("No fue posible cargar Google Maps."));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase();
}

function markerContent(kind:"company"|"site"|"technician",imageUrl:string|null,label:string,openNow?:boolean){
  const root=document.createElement("div");
  root.className=`reaction-marker reaction-marker-${kind}`;
  if((kind==="company"||kind==="site")&&typeof openNow==="boolean"){
    root.classList.add(openNow?"is-open":"is-closed");
  }
  const bubble=document.createElement("div");
  bubble.className="reaction-marker-bubble";
  if(imageUrl){
    const image=document.createElement("img");
    image.src=imageUrl;
    image.alt="";
    bubble.appendChild(image);
  }else{
    const fallback=document.createElement("span");
    fallback.textContent=initials(label);
    bubble.appendChild(fallback);
  }
  root.appendChild(bubble);
  const tail=document.createElement("i");
  root.appendChild(tail);
  return root;
}

function scheduleLabel(hours:BusinessHours){
  return `${hours.openTime}–${hours.closeTime}`;
}

export default function ReactionMap(){
  const hostRef=useRef<HTMLDivElement>(null);
  const mapRef=useRef<any>(null);
  const overlaysRef=useRef<any[]>([]);
  const firstFit=useRef(true);
  const snapshotRef=useRef<Snapshot>({companies:[],sites:[],technicians:[],generatedAt:""});
  const filterRef=useRef({companies:true,sites:true,technicians:true,hours:"all" as HoursFilter});
  const [snapshot,setSnapshot]=useState<Snapshot>({companies:[],sites:[],technicians:[],generatedAt:""});
  const [status,setStatus]=useState("Cargando mapa operativo…");
  const [showCompanies,setShowCompanies]=useState(true);
  const [showSites,setShowSites]=useState(true);
  const [showTechnicians,setShowTechnicians]=useState(true);
  const [hoursFilter,setHoursFilter]=useState<HoursFilter>("all");

  useEffect(()=>{
    filterRef.current={companies:showCompanies,sites:showSites,technicians:showTechnicians,hours:hoursFilter};
    draw(snapshotRef.current,false);
  },[showCompanies,showSites,showTechnicians,hoursFilter]);

  useEffect(()=>{
    let cancelled=false;
    let timer:ReturnType<typeof setInterval>|null=null;

    async function boot(){
      try{
        const configResponse=await fetch("/api/maps-config",{cache:"no-store"});
        const config=await configResponse.json();
        if(!config?.apiKey)throw new Error("Google Maps no está configurado.");
        const google=await loadMaps(config.apiKey);
        if(cancelled||!hostRef.current)return;

        mapRef.current=new google.maps.Map(hostRef.current,{
          center:{lat:4.711,lng:-74.0721},
          zoom:11,
          mapId:config.mapId||"DEMO_MAP_ID",
          mapTypeControl:false,
          streetViewControl:false,
          fullscreenControl:true,
          clickableIcons:false,
          gestureHandling:"greedy",
        });

        await refresh();
        timer=setInterval(()=>void refresh(),5000);
      }catch(cause){
        setStatus(cause instanceof Error?cause.message:"No fue posible iniciar Reacción.");
      }
    }

    async function refresh(){
      try{
        const response=await fetch("/api/reaction/snapshot",{cache:"no-store"});
        if(!response.ok)throw new Error("No fue posible actualizar posiciones.");
        const data=await response.json() as Snapshot;
        if(cancelled)return;
        snapshotRef.current=data;
        setSnapshot(data);
        draw(data,firstFit.current);
        setStatus(`${data.companies.length} empresa${data.companies.length===1?"":"s"} · ${data.sites.length} sede${data.sites.length===1?"":"s"} · ${data.technicians.length} técnico${data.technicians.length===1?"":"s"} conectado${data.technicians.length===1?"":"s"}`);
      }catch(cause){
        setStatus(cause instanceof Error?cause.message:"No fue posible actualizar posiciones.");
      }
    }

    function clearOverlays(){
      for(const overlay of overlaysRef.current){
        if("map" in overlay)overlay.map=null;
        if(typeof overlay.setMap==="function")overlay.setMap(null);
      }
      overlaysRef.current=[];
    }

    function hoursMatch(openNow:boolean,filter:HoursFilter){
      return filter==="all"||(filter==="open"?openNow:!openNow);
    }

    function draw(data:Snapshot,fit:boolean){
      const google=window.google;
      const map=mapRef.current;
      if(!google||!map)return;
      clearOverlays();

      const bounds=new google.maps.LatLngBounds();
      const filters=filterRef.current;

      if(filters.companies){
        for(const company of data.companies.filter(item=>hoursMatch(item.openNow,filters.hours))){
          const marker=new google.maps.marker.AdvancedMarkerElement({
            map,
            position:{lat:company.lat,lng:company.lng},
            title:`${company.name} · ${company.openNow?"Abierta":"Cerrada"} · ${scheduleLabel(company.businessHours)}`,
            content:markerContent("company",company.logoUrl,company.name,company.openNow),
            zIndex:30,
          });
          overlaysRef.current.push(marker);
          bounds.extend({lat:company.lat,lng:company.lng});
        }
      }

      if(filters.sites){
        for(const site of data.sites.filter(item=>hoursMatch(item.openNow,filters.hours))){
          const marker=new google.maps.marker.AdvancedMarkerElement({
            map,
            position:{lat:site.lat,lng:site.lng},
            title:`${site.organizationName} · ${site.name} · ${site.openNow?"Abierta":"Cerrada"} · ${scheduleLabel(site.businessHours)}`,
            content:markerContent("site",site.logoUrl,site.organizationName,site.openNow),
            zIndex:20,
          });
          overlaysRef.current.push(marker);
          bounds.extend({lat:site.lat,lng:site.lng});
        }
      }

      if(filters.technicians){
        for(const tech of data.technicians){
          if(tech.route.length>1){
            const route=new google.maps.Polyline({
              map,
              path:tech.route.map(point=>({lat:point.lat,lng:point.lng})),
              geodesic:true,
              strokeOpacity:.8,
              strokeWeight:4,
            });
            overlaysRef.current.push(route);
          }

          const marker=new google.maps.marker.AdvancedMarkerElement({
            map,
            position:{lat:tech.lat,lng:tech.lng},
            title:`${tech.fullName} · ${tech.organizationName}`,
            content:markerContent("technician",tech.avatarUrl,tech.fullName),
            zIndex:40,
          });
          overlaysRef.current.push(marker);
          bounds.extend({lat:tech.lat,lng:tech.lng});
        }
      }

      if(fit&&!bounds.isEmpty()){
        map.fitBounds(bounds,70);
        firstFit.current=false;
      }
    }

    void boot();
    return()=>{
      cancelled=true;
      if(timer)clearInterval(timer);
      for(const overlay of overlaysRef.current){
        if("map" in overlay)overlay.map=null;
        if(typeof overlay.setMap==="function")overlay.setMap(null);
      }
      overlaysRef.current=[];
    };
  },[]);

  const visibleCounts=useMemo(()=>{
    const matches=(openNow:boolean)=>hoursFilter==="all"||(hoursFilter==="open"?openNow:!openNow);
    return {
      companies:showCompanies?snapshot.companies.filter(item=>matches(item.openNow)).length:0,
      sites:showSites?snapshot.sites.filter(item=>matches(item.openNow)).length:0,
      technicians:showTechnicians?snapshot.technicians.length:0,
    };
  },[snapshot,showCompanies,showSites,showTechnicians,hoursFilter]);

  return <div className="reaction-map-stage">
    <div className="reaction-map-toolbar" aria-label="Filtros del mapa de Reacción">
      <div className="reaction-layer-filters">
        <label className={showTechnicians?"active":""}><input type="checkbox" checked={showTechnicians} onChange={event=>setShowTechnicians(event.target.checked)}/><span>Técnicos</span><b>{snapshot.technicians.length}</b></label>
        <label className={showCompanies?"active":""}><input type="checkbox" checked={showCompanies} onChange={event=>setShowCompanies(event.target.checked)}/><span>Empresas</span><b>{snapshot.companies.length}</b></label>
        <label className={showSites?"active":""}><input type="checkbox" checked={showSites} onChange={event=>setShowSites(event.target.checked)}/><span>Sedes</span><b>{snapshot.sites.length}</b></label>
      </div>
      <label className="reaction-hours-filter">
        <span>Horario</span>
        <select value={hoursFilter} onChange={event=>setHoursFilter(event.target.value as HoursFilter)}>
          <option value="all">Todos</option>
          <option value="open">Abiertos ahora</option>
          <option value="closed">Cerrados ahora</option>
        </select>
      </label>
    </div>

    <div className="reaction-map-status">
      <span className={snapshot.technicians.length?"live":""}/>
      <strong>{status}</strong>
      <small>Mostrando {visibleCounts.technicians} técnicos · {visibleCounts.companies} empresas · {visibleCounts.sites} sedes</small>
      {snapshot.generatedAt&&<small>Actualizado {new Date(snapshot.generatedAt).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small>}
    </div>
    <div ref={hostRef} className="reaction-google-map" aria-label="Mapa operativo de Reacción" />
  </div>;
}
