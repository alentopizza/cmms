"use client";

import { useEffect, useRef, useState } from "react";

type SitePoint={
  id:string;organizationId:string;organizationName:string;name:string;
  lat:number;lng:number;radius:number;logoUrl:string|null;
};
type TechnicianPoint={
  trackingSessionId:string;userId:string;fullName:string;organizationId:string;organizationName:string;
  lat:number;lng:number;accuracy:number|null;lastSeenAt:string;avatarUrl:string|null;
  route:Array<{lat:number;lng:number;at:string}>;
};
type Snapshot={sites:SitePoint[];technicians:TechnicianPoint[];generatedAt:string};

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

function markerContent(kind:"site"|"technician",imageUrl:string|null,label:string){
  const root=document.createElement("div");
  root.className=`reaction-marker reaction-marker-${kind}`;
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

export default function ReactionMap(){
  const hostRef=useRef<HTMLDivElement>(null);
  const mapRef=useRef<any>(null);
  const overlaysRef=useRef<any[]>([]);
  const firstFit=useRef(true);
  const [snapshot,setSnapshot]=useState<Snapshot>({sites:[],technicians:[],generatedAt:""});
  const [status,setStatus]=useState("Cargando mapa operativo…");

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
        setSnapshot(data);
        draw(data);
        setStatus(data.technicians.length
          ? `${data.technicians.length} técnico${data.technicians.length===1?"":"s"} conectado${data.technicians.length===1?"":"s"}`
          : "Sin técnicos conectados");
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

    function draw(data:Snapshot){
      const google=window.google;
      const map=mapRef.current;
      if(!google||!map)return;
      clearOverlays();

      const bounds=new google.maps.LatLngBounds();

      for(const site of data.sites){
        const marker=new google.maps.marker.AdvancedMarkerElement({
          map,
          position:{lat:site.lat,lng:site.lng},
          title:`${site.organizationName} · ${site.name}`,
          content:markerContent("site",site.logoUrl,site.organizationName),
        });
        overlaysRef.current.push(marker);
        bounds.extend({lat:site.lat,lng:site.lng});
      }

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
        });
        overlaysRef.current.push(marker);
        bounds.extend({lat:tech.lat,lng:tech.lng});
      }

      if(firstFit.current&&!bounds.isEmpty()){
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

  return <div className="reaction-map-stage">
    <div className="reaction-map-status">
      <span className={snapshot.technicians.length?"live":""}/>
      <strong>{status}</strong>
      {snapshot.generatedAt&&<small>Actualizado {new Date(snapshot.generatedAt).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small>}
    </div>
    <div ref={hostRef} className="reaction-google-map" aria-label="Mapa operativo de Reacción" />
  </div>;
}
