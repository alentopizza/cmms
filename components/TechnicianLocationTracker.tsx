"use client";

import { useEffect, useRef, useState } from "react";

type TrackerState="requesting"|"active"|"denied"|"unsupported"|"error";

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
  const [state,setState]=useState<TrackerState>("requesting");
  const [message,setMessage]=useState("Para operar como técnico debes permitir la ubicación.");
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

    async function send(action:"connect"|"sample"|"disconnect",position?:GeolocationPosition){
      const payload:any={action};
      if(position){
        payload.latitude=position.coords.latitude;
        payload.longitude=position.coords.longitude;
        payload.accuracy=position.coords.accuracy;
        payload.heading=typeof position.coords.heading==="number"&&Number.isFinite(position.coords.heading)?position.coords.heading:null;
        payload.speed=typeof position.coords.speed==="number"&&Number.isFinite(position.coords.speed)?position.coords.speed:null;
      }
      await fetch("/api/reaction/track",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload),
        keepalive:action==="disconnect",
      });
    }

    function start(){
      setState("requesting");
      setMessage("Activa la ubicación para conectarte al seguimiento operativo.");
      watchId.current=navigator.geolocation.watchPosition(async position=>{
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
          }else if(elapsed>=10000 || moved>=15){
            await send("sample",position);
            lastSentAt.current=now;
            lastPoint.current=point;
          }
          setState("active");
          setMessage("Ubicación activa. Tu posición se comparte mientras permanezcas conectado.");
        }catch{
          setState("error");
          setMessage("No fue posible actualizar tu ubicación. Revisa tu conexión.");
        }
      },error=>{
        if(cancelled)return;
        if(error.code===error.PERMISSION_DENIED){
          setState("denied");
          setMessage("La ubicación es obligatoria para operar como técnico. Habilítala en el navegador.");
        }else{
          setState("error");
          setMessage("No fue posible obtener una ubicación GPS válida.");
        }
      },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
    }

    start();

    const onVisibility=()=>{
      if(document.visibilityState==="visible"&&watchId.current===null)start();
    };
    document.addEventListener("visibilitychange",onVisibility);

    return()=>{
      cancelled=true;
      document.removeEventListener("visibilitychange",onVisibility);
      if(watchId.current!==null)navigator.geolocation.clearWatch(watchId.current);
      if(connected.current){
        void send("disconnect").catch(()=>undefined);
      }
    };
  },[]);

  if(state==="active") return <div className="technician-tracking-indicator" title="Seguimiento operativo activo"><span/><small>Ubicación activa</small></div>;

  return <div className="reaction-location-gate" role="dialog" aria-modal="true" aria-label="Ubicación obligatoria">
    <div className="reaction-location-gate-card">
      <span className="reaction-location-gate-icon">⌖</span>
      <h2>Ubicación obligatoria</h2>
      <p>{userName}, {message}</p>
      <small>El seguimiento comienza al conectarte y se detiene al cerrar sesión. En navegador móvil puede pausarse si el sistema suspende la página en segundo plano.</small>
      <button className="button" type="button" onClick={()=>window.location.reload()}>Volver a intentar</button>
      <form method="post" action="/api/auth/logout"><button className="button secondary" type="submit">Cerrar sesión</button></form>
    </div>
  </div>;
}
