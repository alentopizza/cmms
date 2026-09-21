"use client";

import { useEffect, useRef, useState } from "react";

type Site = {
  id:string;
  name:string;
  city:string|null;
  geofenceConfigured:boolean;
};

type Props = {
  sites: Site[];
  enrolled: boolean;
  openShift: { id:string; site_id:string; site_name:string; check_in_at:string } | null;
  requireFace: boolean;
  requireGeolocation: boolean;
  livenessThreshold: number;
};

type Capture = {
  embedding:number[];
  live:number;
  real:number;
};

function average(vectors:number[][]) {
  const length=vectors[0]?.length || 0;
  const result=new Array<number>(length).fill(0);
  for(const vector of vectors){
    for(let i=0;i<length;i+=1) result[i]+=vector[i]/vectors.length;
  }
  const norm=Math.sqrt(result.reduce((sum,value)=>sum+value*value,0)) || 1;
  return result.map(value=>value/norm);
}

function position() {
  return new Promise<GeolocationPosition>((resolve,reject)=>{
    if(!navigator.geolocation) {
      reject(new Error("Este dispositivo no dispone de geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve,reject,{
      enableHighAccuracy:true,
      timeout:15000,
      maximumAge:0,
    });
  });
}

export default function AttendanceCapture({
  sites,
  enrolled:initialEnrolled,
  openShift:initialOpenShift,
  requireFace,
  requireGeolocation,
  livenessThreshold,
}:Props) {
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const humanRef=useRef<any>(null);
  const [cameraReady,setCameraReady]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [consent,setConsent]=useState(false);
  const [enrolled,setEnrolled]=useState(initialEnrolled);
  const [openShift,setOpenShift]=useState(initialOpenShift);
  const [siteId,setSiteId]=useState(initialOpenShift?.site_id || sites[0]?.id || "");

  useEffect(()=>()=> {
    streamRef.current?.getTracks().forEach(track=>track.stop());
  },[]);

  async function ensureCamera() {
    if(streamRef.current && videoRef.current) return;
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("La cámara no está disponible en este navegador.");
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:"user",width:{ideal:720},height:{ideal:720}},
      audio:false,
    });
    streamRef.current=stream;
    if(videoRef.current){
      videoRef.current.srcObject=stream;
      await videoRef.current.play();
      setCameraReady(true);
    }
  }

  async function ensureHuman() {
    if(humanRef.current) return humanRef.current;
    setMessage("Cargando verificación facial…");
    const module=await import("@vladmandic/human/dist/human.esm.js");
    const Human=module.default;
    const human=new Human({
      backend:"webgl",
      modelBasePath:"/biometric-models/",
      face:{
        enabled:true,
        detector:{enabled:true,maxDetected:1,minConfidence:0.65},
        mesh:{enabled:true},
        description:{enabled:true},
        antispoof:{enabled:true},
        liveness:{enabled:true},
        emotion:{enabled:false},
        iris:{enabled:false},
      },
      body:{enabled:false},
      hand:{enabled:false},
      object:{enabled:false},
      segmentation:{enabled:false},
      gesture:{enabled:false},
      cacheSensitivity:0,
    });
    await human.load();
    humanRef.current=human;
    setModelReady(true);
    return human;
  }

  async function captureFace(samples=2):Promise<Capture> {
    await ensureCamera();
    const human=await ensureHuman();
    if(!videoRef.current) throw new Error("No se pudo iniciar la cámara.");

    const embeddings:number[][]=[];
    let minLive=1;
    let minReal=1;

    for(let attempt=0;attempt<samples;attempt+=1){
      if(attempt) await new Promise(resolve=>setTimeout(resolve,550));
      const result=await human.detect(videoRef.current);
      if(result.face.length!==1) throw new Error(result.face.length>1 ? "Debe aparecer una sola persona frente a la cámara." : "No se detectó un rostro. Mira de frente a la cámara.");
      const face=result.face[0];
      if(!face.embedding?.length) throw new Error("No fue posible generar la plantilla facial.");
      const live=Number(face.live);
      const real=Number(face.real);
      if(!Number.isFinite(live)||!Number.isFinite(real)) throw new Error("No fue posible comprobar presencia real.");
      if(live<livenessThreshold || real<livenessThreshold) throw new Error("La prueba de presencia no fue suficiente. Evita fotos o pantallas y mejora la iluminación.");
      embeddings.push(face.embedding.map(Number));
      minLive=Math.min(minLive,live);
      minReal=Math.min(minReal,real);
    }

    return {embedding:average(embeddings),live:minLive,real:minReal};
  }

  async function enroll() {
    if(!consent){
      setError("Debes aceptar el consentimiento antes de registrar la biometría.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try{
      const face=await captureFace(3);
      const response=await fetch("/api/attendance/enroll",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({embedding:face.embedding,consent:true}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.message || "No fue posible registrar la biometría.");
      setEnrolled(true);
      setMessage("Biometría registrada. No se almacenó una fotografía; se guardó una plantilla facial cifrada.");
    }catch(cause){
      setError(cause instanceof Error ? cause.message : "No fue posible registrar la biometría.");
    }finally{
      setBusy(false);
    }
  }

  async function revokeBiometric() {
    if(openShift){
      setError("Registra la salida antes de revocar tu biometría.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try{
      const response=await fetch("/api/attendance/enroll",{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.message || "No fue posible revocar la biometría.");
      setEnrolled(false);
      setConsent(false);
      setMessage("Plantilla biométrica eliminada. Puedes registrarla nuevamente cuando lo necesites.");
    }catch(cause){
      setError(cause instanceof Error ? cause.message : "No fue posible revocar la biometría.");
    }finally{
      setBusy(false);
    }
  }

  async function clock(action:"check_in"|"check_out") {
    if(!siteId) { setError("Selecciona una sede."); return; }
    setBusy(true); setError(""); setMessage("");
    try{
      const selected=sites.find(site=>site.id===siteId);
      if(requireGeolocation && selected && !selected.geofenceConfigured) throw new Error("Esta sede aún no tiene geocerca configurada.");

      const [face,gps]=await Promise.all([
        requireFace ? captureFace(2) : Promise.resolve<Capture>({embedding:[],live:1,real:1}),
        requireGeolocation ? position() : Promise.resolve(null),
      ]);

      const response=await fetch("/api/attendance/clock",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action,siteId,
          embedding:face.embedding,live:face.live,real:face.real,
          latitude:gps?.coords.latitude,
          longitude:gps?.coords.longitude,
          accuracy:gps?.coords.accuracy,
        }),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.message || "No fue posible registrar la asistencia.");

      if(action==="check_in"){
        setOpenShift({id:data.shiftId,site_id:siteId,site_name:data.site,check_in_at:data.at});
        setMessage("Entrada registrada correctamente.");
      }else{
        setOpenShift(null);
        setMessage("Salida registrada correctamente.");
      }
    }catch(cause){
      const geoCode = typeof cause === "object" && cause !== null && "code" in cause ? Number((cause as {code?:unknown}).code) : null;
      if(geoCode === 1 || geoCode === 2 || geoCode === 3){
        setError("No fue posible obtener tu ubicación. Autoriza la ubicación precisa del navegador e intenta nuevamente.");
      }else{
        setError(cause instanceof Error ? cause.message : "No fue posible registrar la asistencia.");
      }
    }finally{
      setBusy(false);
    }
  }

  return <div className="attendance-capture">
    <div className="attendance-camera-card">
      <div className="attendance-camera-stage">
        <video ref={videoRef} playsInline muted className={cameraReady ? "ready" : ""} />
        <div className="attendance-face-guide" aria-hidden="true" />
        {!cameraReady && <div className="attendance-camera-placeholder"><span>◎</span><strong>Cámara facial</strong><small>La cámara se activa solo al registrar biometría o asistencia.</small></div>}
      </div>
      <div className="attendance-camera-state">
        <span className={cameraReady ? "ready" : ""}><i /> Cámara</span>
        <span className={modelReady ? "ready" : ""}><i /> Verificación facial</span>
        <span className={requireGeolocation ? "ready" : ""}><i /> GPS requerido</span>
      </div>
    </div>

    <div className="attendance-action-card">
      {!enrolled && requireFace ? <>
        <span className="eyebrow">Primera configuración</span>
        <h2>Registrar biometría facial</h2>
        <p>Se capturan varias lecturas del rostro para generar una plantilla numérica. La aplicación no guarda la fotografía utilizada para el registro.</p>
        <label className="attendance-consent">
          <input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} />
          <span><strong>Autorizo el uso de mi plantilla facial para validar mis registros de asistencia.</strong><small>Puedes solicitar revocación de la plantilla desde este módulo.</small></span>
        </label>
        <button className="button" type="button" disabled={busy} onClick={enroll}>{busy?"Validando…":"Registrar mi biometría"}</button>
      </> : <>
        <span className="eyebrow">Jornada de campo</span>
        <h2>{openShift ? "Jornada en curso" : "Registrar entrada"}</h2>
        {openShift ? <div className="attendance-open-shift"><span>Entrada</span><strong>{new Date(openShift.check_in_at).toLocaleString("es-CO")}</strong><small>{openShift.site_name}</small></div> : <p>Selecciona la sede donde iniciarás labores. La ubicación y el rostro se validarán en el momento del registro.</p>}
        <div className="field">
          <label>Sede *</label>
          <select value={siteId} onChange={event=>setSiteId(event.target.value)} disabled={Boolean(openShift)}>
            <option value="">Selecciona sede</option>
            {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}{requireGeolocation&&!site.geofenceConfigured?" · Sin geocerca":""}</option>)}
          </select>
        </div>
        <button className="button attendance-clock-button" type="button" disabled={busy || !siteId} onClick={()=>clock(openShift?"check_out":"check_in")}>
          {busy?"Validando identidad y ubicación…":openShift?"Registrar salida":"Registrar entrada"}
        </button>
        {requireFace && enrolled && !openShift && <button className="text-button attendance-revoke" type="button" disabled={busy} onClick={revokeBiometric}>Eliminar mi plantilla biométrica</button>}
      </>}

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
    </div>
  </div>;
}
