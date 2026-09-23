"use client";

import { useEffect, useRef, useState } from "react";

type TrackerState="checking"|"active"|"reconnecting"|"denied"|"unsupported"|"error";

const GEO_OPTIONS:PositionOptions={
  enableHighAccuracy:true,
  maximumAge:5000,
  timeout:15000,
};

function metersBetween(a:{lat:number;lng:number},b:{lat:number;lng:number}){
  const R=6371000;
  const dLat=(b.lat-a.lat)*Math.PI/180;
  const dLon=(b.lng-a.lng)*Math.PI/180;
  const lat1=a.lat*Math.PI/180;
  const lat2=b.lat*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.sin(dLon/2)**2*Math.cos(lat1)*Math.cos(lat2);
  return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
}

export default function TechnicianLocationTracker({userName}:{userName:string}){
  const [state,setState]=useState<TrackerState>("checking");
  const [message,setMessage]=useState("Verificando el estado de la ubicación…");
  const [attempt,setAttempt]=useState(0);
  const watchId=useRef<number|null>(null);
  const lastSentAt=useRef(0);
  const lastPoint=useRef<{lat:number;lng:number}|null>(null);
  const connected=useRef(false);

  useEffect(()=>{
    if(!navigator.geolocation){
      setState("unsupported");
      setMessage("Este dispositivo no ofrece geolocalización compatible.");
      return;
    }

    let cancelled=false;
    let retryTimer:ReturnType<typeof setTimeout>|null=null;
    let permissionStatus:PermissionStatus|null=null;

    function clearWatch(){
      if(watchId.current!==null){
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current=null;
      }
    }

    async function send(action:"connect"|"sample",position:GeolocationPosition){
      const payload:any={
        action,
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy:position.coords.accuracy,
        heading:typeof position.coords.heading==="number"&&Number.isFinite(position.coords.heading)?position.coords.heading:null,
        speed:typeof position.coords.speed==="number"&&Number.isFinite(position.coords.speed)?position.coords.speed:null,
      };
      const response=await fetch("/api/reaction/track",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload),
      });
      if(!response.ok) throw new Error("TRACKING_UPDATE_FAILED");
    }

    async function onPosition(position:GeolocationPosition){
      if(cancelled)return;
      const now=Date.now();
      const point={lat:position.coords.latitude,lng:position.coords.longitude};
      const moved=lastPoint.current?metersBetween(lastPoint.current,point):Infinity;
      const elapsed=now-lastSentAt.current;

      try{
        if(!connected.current){
          await send("connect",position);
          connected.current=true;
          lastSentAt.current=now;
          lastPoint.current=point;
        }else if(elapsed>=10000||moved>=15){
          await send("sample",position);
          lastSentAt.current=now;
          lastPoint.current=point;
        }
        if(cancelled)return;
        setState("active");
        setMessage("Ubicación activa. Tu posición se comparte mientras permanezcas conectado.");
      }catch{
        if(cancelled)return;
        setState("reconnecting");
        setMessage("GPS disponible; reconectando el envío de ubicación…");
      }
    }

    function scheduleRetry(){
      if(retryTimer||cancelled||document.visibilityState!=="visible")return;
      retryTimer=setTimeout(()=>{
        retryTimer=null;
        if(!cancelled) startWatch(false);
      },5000);
    }

    function onGeoError(error:GeolocationPositionError){
      if(cancelled)return;
      clearWatch();
      if(error.code===error.PERMISSION_DENIED){
        connected.current=false;
        setState("denied");
        setMessage("La ubicación es obligatoria para operar como técnico. Habilítala en el navegador.");
        return;
      }
      setState("reconnecting");
      setMessage(error.code===error.TIMEOUT
        ?"El GPS tardó demasiado en responder. Intentando nuevamente…"
        :"No fue posible obtener una posición GPS. Intentando nuevamente…");
      scheduleRetry();
    }

    function startWatch(showChecking=true){
      if(cancelled||watchId.current!==null)return;
      if(showChecking&&!connected.current){
        setState("checking");
        setMessage("Verificando el estado de la ubicación…");
      }
      watchId.current=navigator.geolocation.watchPosition(
        position=>void onPosition(position),
        onGeoError,
        GEO_OPTIONS,
      );
    }

    function requestFreshPosition(){
      navigator.geolocation.getCurrentPosition(
        position=>void onPosition(position),
        onGeoError,
        GEO_OPTIONS,
      );
    }

    async function initialize(){
      if("permissions" in navigator){
        try{
          permissionStatus=await navigator.permissions.query({name:"geolocation" as PermissionName});
          if(cancelled)return;
          if(permissionStatus.state==="denied"){
            setState("denied");
            setMessage("La ubicación está bloqueada para este sitio. Habilítala en el navegador.");
            return;
          }
          permissionStatus.onchange=()=>{
            if(cancelled)return;
            if(permissionStatus?.state==="denied"){
              clearWatch();
              connected.current=false;
              setState("denied");
              setMessage("La ubicación está bloqueada para este sitio. Habilítala en el navegador.");
            }else{
              startWatch(true);
              requestFreshPosition();
            }
          };
        }catch{
          // Some browsers do not expose geolocation through Permissions API.
        }
      }
      startWatch(true);
    }

    const onVisibility=()=>{
      if(document.visibilityState==="visible"){
        if(watchId.current===null)startWatch(false);
        requestFreshPosition();
      }
    };
    document.addEventListener("visibilitychange",onVisibility);

    void initialize();

    return()=>{
      cancelled=true;
      document.removeEventListener("visibilitychange",onVisibility);
      if(permissionStatus)permissionStatus.onchange=null;
      if(retryTimer)clearTimeout(retryTimer);
      clearWatch();
      // Do not close the Reaction session here. React cleanup also runs on refresh,
      // navigation and browser suspension. Explicit logout is the authoritative close.
    };
  },[attempt]);

  if(state==="active"){
    return <div className="technician-tracking-indicator" title="Seguimiento operativo activo"><span/><small>Ubicación activa</small></div>;
  }

  if(state==="checking"||state==="reconnecting"){
    return <div className="technician-tracking-indicator is-checking" title={message}><span/><small>{state==="checking"?"Verificando GPS":"Reconectando GPS"}</small></div>;
  }

  return <div className="reaction-location-gate" role="dialog" aria-modal="true" aria-label="Ubicación obligatoria">
    <div className="reaction-location-gate-card">
      <span className="reaction-location-gate-icon">⌖</span>
      <h2>Ubicación obligatoria</h2>
      <p>{userName}, {message}</p>
      <small>El aviso solo aparece cuando no hay acceso usable a la ubicación. Una recarga o cambiar temporalmente de aplicación no cierra tu sesión de Reacción.</small>
      <button className="button" type="button" onClick={()=>setAttempt(value=>value+1)}>Volver a intentar</button>
      <form method="post" action="/api/auth/logout"><button className="button secondary" type="submit">Cerrar sesión</button></form>
    </div>
  </div>;
}
