"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Button } from "@/components/ui-kit/Button";
import { Search } from "@/components/ui-kit/DataControls";
import { Select } from "@/components/ui-kit/FormControls";
import { Badge } from "@/components/ui-kit/Badge";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { Drawer } from "@/components/ui-kit/Overlay";
import { ActivityStatusBadge, PriorityBadge } from "@/components/maintenance-ui/OperationStatus";

type BusinessHours={days:number[];openTime:string;closeTime:string;schedule:Array<{day:number;enabled:boolean;openTime:string;closeTime:string}>};
type CompanyPoint={
  id:string;name:string;legalName:string|null;taxId:string|null;phone:string|null;adminEmail:string|null;
  website:string|null;primaryContactName:string|null;primaryContactPhone:string|null;primaryContactEmail:string|null;
  lat:number;lng:number;timezone:string;businessHours:BusinessHours;openNow:boolean;logoUrl:string|null;
};
type SitePoint={
  id:string;organizationId:string;organizationName:string;name:string;code:string|null;
  address:string|null;city:string|null;country:string;contactName:string|null;contactPhone:string|null;contactEmail:string|null;
  lat:number;lng:number;radius:number;businessHours:BusinessHours;openNow:boolean;logoUrl:string|null;
};
type TechnicianPoint={
  trackingSessionId:string;userId:string;fullName:string;email:string;phone:string|null;country:string;role:string;
  organizationId:string;organizationName:string;crewIds:string[];
  lat:number;lng:number;accuracy:number|null;lastSeenAt:string;telemetryState:"live"|"paused";avatarUrl:string|null;
  travelDestinationSiteId:string|null;travelDestinationSiteName:string|null;travelStartedAt:string|null;
  route:Array<{lat:number;lng:number;at:string}>;
};
type ActivityAlert={
  id:string;workOrderId:string;workOrderNumber:string;workOrderTitle:string;workOrderType:string;workOrderStatus:string;
  description:string;notes:string|null;status:string;priority:string;organizationId:string;organizationName:string;
  siteId:string;siteName:string;assetName:string|null;
  assignedToUserId:string|null;assignedUserName:string|null;crewId:string|null;crewName:string|null;
  serviceSupplierId:string|null;supplierName:string|null;responsible:string;
  operationalAt:string;operationalDate:string;dueAt:string|null;dateState:"overdue"|"today"|"future";
};
type Snapshot={
  companies:CompanyPoint[];
  sites:SitePoint[];
  technicians:TechnicianPoint[];
  activities:ActivityAlert[];
  generatedAt:string;
};
type HoursFilter="all"|"open"|"closed";
type DateFilter="today_overdue"|"today"|"overdue"|"tomorrow"|"week"|"custom";
type DetailSelection=
  | {kind:"company";id:string}
  | {kind:"site";id:string}
  | {kind:"technician";id:string}
  | {kind:"activity";id:string}
  | null;
type SearchResult={
  kind:"company"|"site"|"technician";
  id:string;
  title:string;
  subtitle:string;
  organizationId:string;
  siteId?:string;
};

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

function markerContent(kind:"company"|"site"|"technician",imageUrl:string|null,label:string,openNow?:boolean,telemetryState?:"live"|"paused"){
  const root=document.createElement("div");
  root.className=`reaction-marker reaction-marker-${kind}`;
  if((kind==="company"||kind==="site")&&typeof openNow==="boolean"){
    root.classList.add(openNow?"is-open":"is-closed");
  }
  if(kind==="technician"&&telemetryState){
    root.classList.add(telemetryState==="live"?"is-live":"is-paused");
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
  const active=hours.schedule?.filter(item=>item.enabled)||[];
  if(!active.length)return "Sin atención";
  const ranges=[...new Set(active.map(item=>`${item.openTime}–${item.closeTime}`))];
  return ranges.length===1?ranges[0]:"Horario variable";
}

function localDateKey(date:Date){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

function tomorrowKey(){
  const date=new Date();
  date.setDate(date.getDate()+1);
  return localDateKey(date);
}

function endOfWeekKey(){
  const date=new Date();
  const day=date.getDay()||7;
  date.setDate(date.getDate()+(7-day));
  return localDateKey(date);
}

function priorityLabel(value:string){
  return value==="urgent"?"Urgente":value==="high"?"Alta":value==="medium"?"Media":"Baja";
}


function normalizeSearch(value:string){
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim();
}

function includesSearch(query:string,values:Array<string|null|undefined>){
  if(!query)return true;
  return normalizeSearch(values.filter(Boolean).join(" ")).includes(query);
}

function formatDate(value:string){
  if(!value)return "Sin fecha";
  return new Date(value+"T12:00:00").toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"});
}

export default function ReactionMap(){
  const hostRef=useRef<HTMLDivElement>(null);
  const mapRef=useRef<any>(null);
  const overlaysRef=useRef<any[]>([]);
  const firstFit=useRef(true);
  const drawRef=useRef<(data:Snapshot,fit:boolean)=>void>(()=>{});
  const snapshotRef=useRef<Snapshot>({companies:[],sites:[],technicians:[],activities:[],generatedAt:""});
  const filterRef=useRef({
    hours:"all" as HoursFilter,
    companyId:"",siteId:"",technicianId:"",search:"",
  });
  const [snapshot,setSnapshot]=useState<Snapshot>({companies:[],sites:[],technicians:[],activities:[],generatedAt:""});
  const [status,setStatus]=useState("Cargando mapa operativo…");
  const [hoursFilter,setHoursFilter]=useState<HoursFilter>("all");
  const [companyId,setCompanyId]=useState("");
  const [siteId,setSiteId]=useState("");
  const [technicianId,setTechnicianId]=useState("");
  const [dateFilter,setDateFilter]=useState<DateFilter>("today_overdue");
  const [customDate,setCustomDate]=useState(localDateKey(new Date()));
  const [search,setSearch]=useState("");
  const [detail,setDetail]=useState<DetailSelection>(null);

  useEffect(()=>{
    filterRef.current={
      hours:hoursFilter,
      companyId,
      siteId,
      technicianId,
      search:normalizeSearch(search),
    };
    drawRef.current(snapshotRef.current,false);
  },[hoursFilter,companyId,siteId,technicianId,search]);

  useEffect(()=>{
    if(siteId){
      const site=snapshot.sites.find(item=>item.id===siteId);
      if(site&&site.organizationId!==companyId)setCompanyId(site.organizationId);
    }
  },[siteId,snapshot.sites,companyId]);

  useEffect(()=>{
    if(companyId&&siteId){
      const site=snapshot.sites.find(item=>item.id===siteId);
      if(site&&site.organizationId!==companyId)setSiteId("");
    }
    if(companyId&&technicianId){
      const technician=snapshot.technicians.find(item=>item.userId===technicianId);
      if(technician&&technician.organizationId!==companyId)setTechnicianId("");
    }
  },[companyId,siteId,technicianId,snapshot.sites,snapshot.technicians]);

  useEffect(()=>{
    if(!detail)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setDetail(null);};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[detail]);

  useEffect(()=>{
    let cancelled=false;
    let timer:ReturnType<typeof setInterval>|null=null;
    let refreshing=false;

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
      if(cancelled||document.visibilityState==="hidden"||refreshing)return;
      refreshing=true;
      try{
        const response=await fetch("/api/reaction/snapshot",{cache:"no-store"});
        if(!response.ok)throw new Error("No fue posible actualizar posiciones.");
        const data=await response.json() as Snapshot;
        if(cancelled)return;
        snapshotRef.current=data;
        setSnapshot(data);
        draw(data,firstFit.current);
        const live=data.technicians.filter(tech=>tech.telemetryState==="live").length;
        const paused=data.technicians.length-live;
        setStatus(`${data.companies.length} empresa${data.companies.length===1?"":"s"} · ${data.sites.length} sede${data.sites.length===1?"":"s"} · ${live} técnico${live===1?"":"s"} en vivo${paused?` · ${paused} GPS pausado${paused===1?"":"s"}`:""}`);
      }catch(cause){
        if(!cancelled)setStatus(cause instanceof Error?cause.message:"No fue posible actualizar posiciones.");
      }finally{
        refreshing=false;
      }
    }

    function onVisibilityChange(){
      if(document.visibilityState==="visible")void refresh();
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
      const companyMatches=(organizationId:string)=>!filters.companyId||organizationId===filters.companyId;
      const siteMatches=(id:string,organizationId:string)=>companyMatches(organizationId)&&(!filters.siteId||id===filters.siteId);

      for(const company of data.companies.filter(item=>
          hoursMatch(item.openNow,filters.hours)
          &&(!filters.companyId||item.id===filters.companyId)
          &&!filters.siteId
          &&includesSearch(filters.search,[item.name,item.legalName,item.taxId,item.phone,item.adminEmail,item.website,item.primaryContactName,item.primaryContactPhone,item.primaryContactEmail])
        )){
          const marker=new google.maps.marker.AdvancedMarkerElement({
            map,
            position:{lat:company.lat,lng:company.lng},
            title:`${company.name} · ${company.openNow?"Abierta":"Cerrada"} · ${scheduleLabel(company.businessHours)}`,
            content:markerContent("company",company.logoUrl,company.name,company.openNow),
            zIndex:30,
          });
          marker.addListener("click",()=>setDetail({kind:"company",id:company.id}));
          overlaysRef.current.push(marker);
          bounds.extend({lat:company.lat,lng:company.lng});
      }

      for(const site of data.sites.filter(item=>
          hoursMatch(item.openNow,filters.hours)
          &&siteMatches(item.id,item.organizationId)
          &&includesSearch(filters.search,[item.name,item.code,item.organizationName,item.address,item.city,item.country,item.contactName,item.contactPhone,item.contactEmail])
        )){
          const marker=new google.maps.marker.AdvancedMarkerElement({
            map,
            position:{lat:site.lat,lng:site.lng},
            title:`${site.organizationName} · ${site.name} · ${site.openNow?"Abierta":"Cerrada"} · ${scheduleLabel(site.businessHours)}`,
            content:markerContent("site",site.logoUrl,site.organizationName,site.openNow),
            zIndex:20,
          });
          marker.addListener("click",()=>setDetail({kind:"site",id:site.id}));
          overlaysRef.current.push(marker);
          bounds.extend({lat:site.lat,lng:site.lng});
      }

      for(const tech of data.technicians.filter(item=>
        companyMatches(item.organizationId)
        &&(!filters.technicianId||item.userId===filters.technicianId)
        &&includesSearch(filters.search,[item.fullName,item.email,item.phone,item.organizationName,item.role])
      )){
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
            title:`${tech.fullName} · ${tech.organizationName} · ${tech.telemetryState==="live"?"GPS en vivo":"GPS pausado · última ubicación conocida"}${tech.travelDestinationSiteName?" · En ruta a "+tech.travelDestinationSiteName:""}`,
            content:markerContent("technician",tech.avatarUrl,tech.fullName,undefined,tech.telemetryState),
            zIndex:40,
          });
          marker.addListener("click",()=>setDetail({kind:"technician",id:tech.userId}));
          overlaysRef.current.push(marker);
          bounds.extend({lat:tech.lat,lng:tech.lng});
      }

      if(fit&&!bounds.isEmpty()){
        map.fitBounds(bounds,70);
        firstFit.current=false;
      }
    }

    drawRef.current=draw;
    document.addEventListener("visibilitychange",onVisibilityChange);
    void boot();
    return()=>{
      cancelled=true;
      document.removeEventListener("visibilitychange",onVisibilityChange);
      if(timer)clearInterval(timer);
      for(const overlay of overlaysRef.current){
        if("map" in overlay)overlay.map=null;
        if(typeof overlay.setMap==="function")overlay.setMap(null);
      }
      overlaysRef.current=[];
    };
  },[]);

  const filteredSites=useMemo(
    ()=>snapshot.sites.filter(site=>!companyId||site.organizationId===companyId),
    [snapshot.sites,companyId],
  );

  const filteredTechnicians=useMemo(
    ()=>snapshot.technicians.filter(tech=>!companyId||tech.organizationId===companyId),
    [snapshot.technicians,companyId],
  );

  const filteredActivities=useMemo(()=>{
    const today=localDateKey(new Date());
    const tomorrow=tomorrowKey();
    const weekEnd=endOfWeekKey();

    return snapshot.activities.filter(activity=>{
      if(companyId&&activity.organizationId!==companyId)return false;
      if(siteId&&activity.siteId!==siteId)return false;
      if(technicianId){
        const tech=snapshot.technicians.find(item=>item.userId===technicianId);
        if(!tech)return false;
        const assignedDirectly=activity.assignedToUserId===technicianId;
        const assignedByCrew=Boolean(activity.crewId&&tech.crewIds.includes(activity.crewId));
        if(!assignedDirectly&&!assignedByCrew)return false;
      }

      if(dateFilter==="today_overdue") return activity.operationalDate<=today;
      if(dateFilter==="today") return activity.operationalDate===today;
      if(dateFilter==="overdue") return activity.operationalDate<today;
      if(dateFilter==="tomorrow") return activity.operationalDate===tomorrow;
      if(dateFilter==="week") return activity.operationalDate>=today&&activity.operationalDate<=weekEnd;
      return activity.operationalDate===customDate;
    });
  },[snapshot.activities,snapshot.technicians,companyId,siteId,technicianId,dateFilter,customDate]);

  const searchResults=useMemo<SearchResult[]>(()=>{
    const query=normalizeSearch(search);
    if(!query)return [];

    const companies=snapshot.companies
      .filter(company=>includesSearch(query,[company.name,company.legalName,company.taxId,company.phone,company.adminEmail,company.website,company.primaryContactName,company.primaryContactPhone,company.primaryContactEmail]))
      .map(company=>({
        kind:"company" as const,id:company.id,title:company.name,
        subtitle:[company.legalName,company.taxId,company.phone].filter(Boolean).join(" · ")||"Empresa",
        organizationId:company.id,
      }));

    const sites=snapshot.sites
      .filter(site=>includesSearch(query,[site.name,site.code,site.organizationName,site.address,site.city,site.country,site.contactName,site.contactPhone,site.contactEmail]))
      .map(site=>({
        kind:"site" as const,id:site.id,title:site.name,
        subtitle:`${site.organizationName} · ${[site.city,site.address].filter(Boolean).join(" · ")}`,
        organizationId:site.organizationId,siteId:site.id,
      }));

    const technicians=snapshot.technicians
      .filter(tech=>includesSearch(query,[tech.fullName,tech.email,tech.phone,tech.organizationName,tech.role,tech.travelDestinationSiteName]))
      .map(tech=>({
        kind:"technician" as const,id:tech.userId,title:tech.fullName,
        subtitle:`${tech.organizationName} · ${tech.email}`,
        organizationId:tech.organizationId,
      }));

    return [...companies,...sites,...technicians].slice(0,12);
  },[search,snapshot]);

  const visibleCounts=useMemo(()=>{
    const query=normalizeSearch(search);
    const matches=(openNow:boolean)=>hoursFilter==="all"||(hoursFilter==="open"?openNow:!openNow);
    return {
      companies:snapshot.companies.filter(item=>
        matches(item.openNow)&&(!companyId||item.id===companyId)&&!siteId
        &&includesSearch(query,[item.name,item.legalName,item.taxId,item.phone,item.adminEmail,item.website,item.primaryContactName,item.primaryContactPhone,item.primaryContactEmail])
      ).length,
      sites:snapshot.sites.filter(item=>
        matches(item.openNow)&&(!companyId||item.organizationId===companyId)&&(!siteId||item.id===siteId)
        &&includesSearch(query,[item.name,item.code,item.organizationName,item.address,item.city,item.country,item.contactName,item.contactPhone,item.contactEmail])
      ).length,
      technicians:snapshot.technicians.filter(item=>
        (!companyId||item.organizationId===companyId)
        &&(!technicianId||item.userId===technicianId)
        &&includesSearch(query,[item.fullName,item.email,item.phone,item.organizationName,item.role,item.travelDestinationSiteName])
      ).length,
    };
  },[snapshot,hoursFilter,companyId,siteId,technicianId,search]);

  const hasActiveFilters=Boolean(
    search.trim()
    || companyId
    || siteId
    || technicianId
    || hoursFilter!=="all"
    || dateFilter!=="today_overdue"
  );

  const selectedCompany=snapshot.companies.find(company=>company.id===companyId);
  const selectedSite=snapshot.sites.find(site=>site.id===siteId);
  const selectedTechnician=snapshot.technicians.find(tech=>tech.userId===technicianId);
  const scopeLabel=selectedTechnician
    ? `${selectedTechnician.organizationName} · ${selectedTechnician.fullName}`
    : selectedSite
      ? `${selectedSite.organizationName} · ${selectedSite.name}`
      : selectedCompany?.name||"Todas las empresas y sedes";

  function resetFilters(){
    setSearch("");
    setCompanyId("");
    setSiteId("");
    setTechnicianId("");
    setHoursFilter("all");
    setDateFilter("today_overdue");
    setCustomDate(localDateKey(new Date()));
  }

  function chooseSearchResult(result:SearchResult){
    setSearch("");
    if(result.kind==="company"){
      setCompanyId(result.organizationId);
      setSiteId("");
      setTechnicianId("");
      setDetail({kind:"company",id:result.id});
    }else if(result.kind==="site"){
      setCompanyId(result.organizationId);
      setSiteId(result.siteId||"");
      setTechnicianId("");
      setDetail({kind:"site",id:result.id});
    }else{
      setCompanyId(result.organizationId);
      setSiteId("");
      setTechnicianId(result.id);
      setDetail({kind:"technician",id:result.id});
    }
  }

  function pendingForCompany(id:string){
    return snapshot.activities.filter(activity=>activity.organizationId===id);
  }
  function pendingForSite(id:string){
    return snapshot.activities.filter(activity=>activity.siteId===id);
  }
  function pendingForTechnician(tech:TechnicianPoint){
    return snapshot.activities.filter(activity=>
      activity.assignedToUserId===tech.userId
      || Boolean(activity.crewId&&tech.crewIds.includes(activity.crewId))
    );
  }

  const detailCompany=detail?.kind==="company"?snapshot.companies.find(item=>item.id===detail.id):undefined;
  const detailSite=detail?.kind==="site"?snapshot.sites.find(item=>item.id===detail.id):undefined;
  const detailTechnician=detail?.kind==="technician"?snapshot.technicians.find(item=>item.userId===detail.id):undefined;
  const detailActivity=detail?.kind==="activity"?snapshot.activities.find(item=>item.id===detail.id):undefined;

  return <>
    <div className="reaction-map-layout">
      <div className="reaction-map-stage">
      <div ref={hostRef} className="reaction-google-map" aria-label="Mapa operativo de Reacción" />
      <div className="reaction-filter-bar" aria-label="Filtros del mapa de Reacción">
        <div className="reaction-global-search">
          <Search value={search} onValueChange={setSearch} placeholder="Buscar técnico, empresa, sede, correo, teléfono, dirección…" ariaLabel="Buscar en Reacción"/>
          {search&&<div className="reaction-search-results">
            {searchResults.map(result=><button key={result.kind+result.id} type="button" onClick={()=>chooseSearchResult(result)}>
              <span>{result.kind==="company"?"Empresa":result.kind==="site"?"Sede":"Técnico"}</span>
              <strong>{result.title}</strong>
              <small>{result.subtitle}</small>
            </button>)}
            {!searchResults.length&&<div className="reaction-search-empty">Sin coincidencias</div>}
          </div>}
        </div>

        <Select label="Empresa" value={companyId} onChange={event=>{setCompanyId(event.target.value);setSiteId("");setTechnicianId("");}} placeholder="" options={[{value:"",label:"Todas"},...snapshot.companies.map(company=>({value:company.id,label:company.name}))]}/>
        <Select label="Sede" value={siteId} onChange={event=>setSiteId(event.target.value)} placeholder="" options={[{value:"",label:"Todas"},...filteredSites.map(site=>({value:site.id,label:site.name}))]}/>
        <Select label="Técnico" value={technicianId} onChange={event=>setTechnicianId(event.target.value)} placeholder="" options={[{value:"",label:"Todos"},...filteredTechnicians.map(tech=>({value:tech.userId,label:tech.fullName}))]}/>
        <Select label="Horario" value={hoursFilter} onChange={event=>setHoursFilter(event.target.value as HoursFilter)} placeholder="" options={[{value:"all",label:"Todos"},{value:"open",label:"Abiertos"},{value:"closed",label:"Cerrados"}]}/>
        <Button className={`reaction-filter-reset ${hasActiveFilters?"has-filters":""}`} variant="ghost" size="sm" onClick={resetFilters} disabled={!hasActiveFilters} iconLeft="reset">Borrar filtros</Button>
      </div>

      <div className="reaction-map-status">
        <span className={snapshot.technicians.length?"live":""}/>
        <strong>{status}</strong>
        <small>Mostrando {visibleCounts.technicians} técnicos · {visibleCounts.companies} empresas · {visibleCounts.sites} sedes</small>
        {snapshot.generatedAt&&<small>Actualizado {new Date(snapshot.generatedAt).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small>}
      </div>
    </div>

    <aside className="reaction-side-panel" aria-label="Actividades pendientes de Reacción">
      <header className="reaction-alert-panel-head">
        <div>
          <span className="eyebrow">Alertas operativas</span>
          <strong>Actividades pendientes</strong>
          <small>{scopeLabel}</small>
        </div>
        <Badge variant={filteredActivities.length?"warning":"success"}>{filteredActivities.length}</Badge>
      </header>

      <div className="reaction-alert-filters">
        <Select label="Fecha" value={dateFilter} onChange={event=>setDateFilter(event.target.value as DateFilter)} placeholder="" options={[
          {value:"today_overdue",label:"Hoy y retrasadas"},{value:"today",label:"Solo hoy"},{value:"overdue",label:"Solo retrasadas"},
          {value:"tomorrow",label:"Mañana"},{value:"week",label:"Esta semana"},{value:"custom",label:"Fecha específica"},
        ]}/>
        {dateFilter==="custom"&&<label>
          <span>Día</span>
          <input type="date" value={customDate} onChange={event=>setCustomDate(event.target.value)} />
        </label>}
      </div>

      {(companyId||siteId||technicianId)&&<div className="reaction-scope-alert">
        <span>Filtro activo</span>
        <strong>{scopeLabel}</strong>
        <Button type="button" variant="ghost" size="sm" onClick={()=>{setCompanyId("");setSiteId("");setTechnicianId("");}}>Ver todo</Button>
      </div>}

      <div className="reaction-alert-list">
        {filteredActivities.map(activity=><button
          key={activity.id}
          type="button"
          className={`reaction-alert-card state-${activity.dateState} priority-${activity.priority}`}
          onClick={()=>setDetail({kind:"activity",id:activity.id})}
        >
          <div className="reaction-alert-card-top">
            <Badge variant={activity.dateState==="overdue"?"danger":activity.dateState==="today"?"warning":"info"}>{activity.dateState==="overdue"?"Retrasada":activity.dateState==="today"?"Hoy":"Programada"}</Badge>
            <PriorityBadge priority={activity.priority}/>
          </div>
          <strong>{activity.description}</strong>
          <small>OT #{activity.workOrderNumber} · {activity.workOrderTitle}</small>
          <div className="reaction-alert-location">
            <span>{activity.organizationName}</span>
            <span>{activity.siteName}</span>
          </div>
          <div className="reaction-alert-meta">
            <span>{activity.responsible}</span>
            <span>{formatDate(activity.operationalDate)}</span>
            <ActivityStatusBadge status={activity.status}/>
          </div>
        </button>)}

        {!filteredActivities.length&&<EmptyState icon="file" title="Sin alertas para este filtro" description="No hay actividades pendientes que coincidan con empresa, sede y fecha seleccionadas."/>}
      </div>
    </aside>
    </div>

    <Drawer
      open={Boolean(detail)}
      onClose={()=>setDetail(null)}
      title={detailCompany?.name||detailSite?.name||detailTechnician?.fullName||detailActivity?.description||"Detalle operativo"}
      description="Reacción · detalle operativo"
    >

        {detailCompany&&<EntityDetail
          imageUrl={detailCompany.logoUrl}
          title={detailCompany.name}
          badge={detailCompany.openNow?"Abierta":"Cerrada"}
          badgeTone={detailCompany.openNow?"success":"danger"}
          phone={detailCompany.phone||detailCompany.primaryContactPhone}
          facts={[
            ["Razón social",detailCompany.legalName||"Sin registrar"],
            ["NIT / ID fiscal",detailCompany.taxId||"Sin registrar"],
            ["Teléfono",detailCompany.phone||detailCompany.primaryContactPhone||"Sin registrar"],
            ["Correo",detailCompany.adminEmail||detailCompany.primaryContactEmail||"Sin registrar"],
            ["Contacto",detailCompany.primaryContactName||"Sin registrar"],
            ["Horario",scheduleLabel(detailCompany.businessHours)],
            ["Zona horaria",detailCompany.timezone],
          ]}
          activities={pendingForCompany(detailCompany.id)}
          onActivity={id=>setDetail({kind:"activity",id})}
        />}

        {detailSite&&<EntityDetail
          imageUrl={detailSite.logoUrl}
          title={detailSite.name}
          subtitle={detailSite.organizationName}
          badge={detailSite.openNow?"Abierta":"Cerrada"}
          badgeTone={detailSite.openNow?"success":"danger"}
          phone={detailSite.contactPhone}
          facts={[
            ["Código",detailSite.code||"Sin registrar"],
            ["Dirección",detailSite.address||"Sin registrar"],
            ["Ciudad",detailSite.city||"Sin registrar"],
            ["Contacto",detailSite.contactName||"Sin registrar"],
            ["Teléfono",detailSite.contactPhone||"Sin registrar"],
            ["Correo",detailSite.contactEmail||"Sin registrar"],
            ["Horario",scheduleLabel(detailSite.businessHours)],
            ["Geocerca",`${detailSite.radius} m`],
          ]}
          activities={pendingForSite(detailSite.id)}
          onActivity={id=>setDetail({kind:"activity",id})}
        />}

        {detailTechnician&&<EntityDetail
          imageUrl={detailTechnician.avatarUrl}
          title={detailTechnician.fullName}
          subtitle={detailTechnician.organizationName}
          badge={detailTechnician.telemetryState==="live"?"GPS en vivo":"GPS pausado"}
          badgeTone={detailTechnician.telemetryState==="live"?"success":"warning"}
          imageMode="portrait"
          phone={detailTechnician.phone}
          facts={[
            ["Correo",detailTechnician.email],
            ["Teléfono",detailTechnician.phone||"Sin registrar"],
            ["Precisión GPS",detailTechnician.accuracy===null?"Sin dato":`${Math.round(detailTechnician.accuracy)} m`],
            ["Último GPS",new Date(detailTechnician.lastSeenAt).toLocaleString("es-CO")],
            ["Ruta reciente",`${detailTechnician.route.length} puntos`],
            ["Desplazamiento",detailTechnician.travelDestinationSiteName?"En ruta a "+detailTechnician.travelDestinationSiteName:"Sin desplazamiento activo"],
            ["Inicio trayecto",detailTechnician.travelStartedAt?new Date(detailTechnician.travelStartedAt).toLocaleString("es-CO"):"—"],
          ]}
          activities={pendingForTechnician(detailTechnician)}
          onActivity={id=>setDetail({kind:"activity",id})}
        />}

        {detailActivity&&<ActivityDetail
          activity={detailActivity}
          technicians={snapshot.technicians}
          onEntity={(kind,id)=>setDetail({kind,id} as DetailSelection)}
        />}
    </Drawer>
  </>;
}

function EntityDetail({
  imageUrl,title,subtitle,badge,badgeTone,facts,activities,onActivity,imageMode="logo",phone,
}:{
  imageUrl:string|null;title:string;subtitle?:string;badge:string;badgeTone:"success"|"danger"|"warning";
  facts:Array<[string,string]>;activities:ActivityAlert[];onActivity:(id:string)=>void;imageMode?:"logo"|"portrait";
  phone?:string|null;
}){
  return <div className="reaction-detail-body">
    <div className="reaction-entity-summary">
      <div className={`reaction-entity-image ${imageMode==="portrait"?"portrait":""}`}>
        {imageUrl?<img src={imageUrl} alt=""/>:<span>{initials(title)}</span>}
      </div>
      <div>
        <strong>{title}</strong>
        {subtitle&&<small>{subtitle}</small>}
        <Badge variant={badgeTone}>{badge}</Badge>
      </div>
    </div>

    <div className="reaction-detail-facts">
      {facts.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>

    {phone&&<div className="reaction-contact-actions">
      <a href={"https://wa.me/"+phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Abrir conversación en WhatsApp" data-tooltip="WhatsApp"><UiIcon name="whatsapp" size={16}/><span>WhatsApp</span></a>
      <a href={"tel:"+phone} title="Iniciar llamada telefónica" data-tooltip="Llamar"><UiIcon name="phone" size={16}/><span>Llamar</span></a>
    </div>}

    <PendingActivitiesSection activities={activities} onActivity={onActivity}/>
  </div>;
}

function PendingActivitiesSection({activities,onActivity}:{activities:ActivityAlert[];onActivity:(id:string)=>void}){
  return <section className="reaction-detail-pending">
    <div className="reaction-detail-section-title">
      <div><span className="eyebrow">Pendientes</span><strong>Todas las actividades pendientes</strong></div>
      <Badge variant={activities.length?"warning":"success"}>{activities.length}</Badge>
    </div>
    <div className="reaction-detail-activity-list">
      {activities.map(activity=><button key={activity.id} type="button" onClick={()=>onActivity(activity.id)}>
        <Badge variant={activity.dateState==="overdue"?"danger":activity.dateState==="today"?"warning":"info"}>{activity.dateState==="overdue"?"Retrasada":activity.dateState==="today"?"Hoy":"Programada"}</Badge>
        <strong>{activity.description}</strong>
        <small>OT #{activity.workOrderNumber} · {activity.siteName}</small>
        <div><span>{activity.responsible}</span><span>{formatDate(activity.operationalDate)}</span><span>{priorityLabel(activity.priority)}</span></div>
      </button>)}
      {!activities.length&&<EmptyState icon="file" title="Sin actividades pendientes" description="No hay actividades pendientes relacionadas."/>}
    </div>
  </section>;
}

function ActivityDetail({
  activity,technicians,onEntity,
}:{
  activity:ActivityAlert;technicians:TechnicianPoint[];
  onEntity:(kind:"company"|"site"|"technician",id:string)=>void;
}){
  const directTechnician=activity.assignedToUserId
    ? technicians.find(tech=>tech.userId===activity.assignedToUserId)
    : undefined;
  const crewTechnicians=activity.crewId
    ? technicians.filter(tech=>tech.crewIds.includes(activity.crewId!))
    : [];
  const relatedTechnicians=directTechnician?[directTechnician]:crewTechnicians;

  return <div className="reaction-detail-body">
    <div className="reaction-activity-detail-hero">
      <div>
        <Badge variant={activity.dateState==="overdue"?"danger":activity.dateState==="today"?"warning":"info"}>
          {activity.dateState==="overdue"?"Retrasada":activity.dateState==="today"?"Hoy":"Programada"}
        </Badge>
        <h3>{activity.description}</h3>
        <p>OT #{activity.workOrderNumber} · {activity.workOrderTitle}</p>
      </div>
      <PriorityBadge priority={activity.priority}/>
    </div>

    <div className="reaction-detail-facts">
      <button type="button" onClick={()=>onEntity("company",activity.organizationId)}><span>Empresa</span><strong>{activity.organizationName}</strong></button>
      <button type="button" onClick={()=>onEntity("site",activity.siteId)}><span>Sede</span><strong>{activity.siteName}</strong></button>
      <div><span>Activo</span><strong>{activity.assetName||"Sin activo"}</strong></div>
      <div><span>Fecha compromiso</span><strong>{formatDate(activity.operationalDate)}</strong></div>
      <div><span>Estado</span><ActivityStatusBadge status={activity.status}/></div>
      <div><span>Tipo OT</span><strong>{activity.workOrderType}</strong></div>
      <div><span>Responsable</span><strong>{activity.responsible}</strong></div>
      <div><span>Asignación</span><strong>{activity.assignedUserName?"Técnico":activity.crewName?"Cuadrilla":activity.supplierName?"Proveedor":"Sin asignar"}</strong></div>
    </div>

    {activity.notes&&<div className="reaction-detail-notes"><span>Notas</span><p>{activity.notes}</p></div>}

    <section className="reaction-detail-pending">
      <div className="reaction-detail-section-title">
        <div><span className="eyebrow">Personal relacionado</span><strong>Técnicos conectados asignados</strong></div>
        <Badge variant={relatedTechnicians.length?"info":"neutral"}>{relatedTechnicians.length}</Badge>
      </div>
      <div className="reaction-related-technicians">
        {relatedTechnicians.map(tech=><button key={tech.userId} type="button" onClick={()=>onEntity("technician",tech.userId)}>
          <div className="reaction-mini-avatar">{tech.avatarUrl?<img src={tech.avatarUrl} alt=""/>:<span>{initials(tech.fullName)}</span>}</div>
          <div><strong>{tech.fullName}</strong><small>{tech.telemetryState==="live"?"GPS en vivo":"GPS pausado"} · {tech.organizationName}</small></div>
        </button>)}
        {!relatedTechnicians.length&&<EmptyState icon="file" title="Sin técnicos conectados" description={
          activity.crewName
            ? `La actividad está asignada a la cuadrilla ${activity.crewName}, pero no hay integrantes conectados en Reacción.`
            : activity.supplierName
              ? `Asignada al proveedor ${activity.supplierName}.`
              : "No hay técnico conectado relacionado con esta actividad."
        }/>}
      </div>
    </section>

    <div className="reaction-detail-actions">
      <Link className="button" href={`/dashboard/work-orders/${activity.workOrderId}`}>Abrir OT completa</Link>
    </div>
  </div>;
}
