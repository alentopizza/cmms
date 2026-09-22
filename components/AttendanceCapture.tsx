"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";

declare global {
  interface Window {
    Human?: any;
  }
}

type Site = {
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofenceRadius:number;
  geofenceConfigured:boolean;
};

type Props = {
  sites: Site[];
  enrolled: boolean;
  openShift: { id:string; site_id:string; site_name:string; check_in_at:string } | null;
  requireFace: boolean;
  requireGeolocation: boolean;
  maxLocationAccuracy: number;
  livenessThreshold: number;
};

type Capture = {
  embedding:number[];
  live:number;
  real:number;
};

type GpsFix = {
  latitude:number;
  longitude:number;
  accuracy:number;
  checkedAt:number;
};

type Phase = "idle"|"gps"|"face"|"saving";

function average(vectors:number[][]) {
  const length=vectors[0]?.length || 0;
  const result=new Array<number>(length).fill(0);
  for(const vector of vectors){
    for(let i=0;i<length;i+=1) result[i]+=vector[i]/vectors.length;
  }
  const norm=Math.sqrt(result.reduce((sum,value)=>sum+value*value,0)) || 1;
  return result.map(value=>value/norm);
}

function haversineMeters(lat1:number,lon1:number,lat2:number,lon2:number) {
  const r=6371000;
  const toRad=(value:number)=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(a));
}

function rawPosition() {
  return new Promise<GeolocationPosition>((resolve,reject)=>{
    if(!navigator.geolocation){
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

// ── Field presence state machine: GPS → live face → shift persistence ───────

export default function AttendanceCapture({
  sites,
  enrolled:initialEnrolled,
  openShift:initialOpenShift,
  requireFace,
  requireGeolocation,
  maxLocationAccuracy,
  livenessThreshold,
}:Props) {
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const humanRef=useRef<any>(null);
  const [cameraReady,setCameraReady]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [phase,setPhase]=useState<Phase>("idle");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [enrolled,setEnrolled]=useState(initialEnrolled);
  const [openShift,setOpenShift]=useState(initialOpenShift);
  const [siteId,setSiteId]=useState(initialOpenShift?.site_id || sites[0]?.id || "");
  const [gps,setGps]=useState<GpsFix|null>(null);
  const [geoPermission,setGeoPermission]=useState<"unknown"|"prompt"|"granted"|"denied">("unknown");

  const selectedSite=useMemo(()=>sites.find(site=>site.id===siteId)||null,[sites,siteId]);
  const configuredSites=useMemo(()=>sites.filter(site=>site.geofenceConfigured&&site.latitude!==null&&site.longitude!==null),[sites]);
  const distance=useMemo(()=>{
    if(!gps||!selectedSite||selectedSite.latitude===null||selectedSite.longitude===null)return null;
    return haversineMeters(gps.latitude,gps.longitude,selectedSite.latitude,selectedSite.longitude);
  },[gps,selectedSite]);
  const accuracyOk=!requireGeolocation || Boolean(gps&&gps.accuracy<=maxLocationAccuracy);
  const insideRange=!requireGeolocation || Boolean(distance!==null&&selectedSite&&distance<=selectedSite.geofenceRadius);
  const locationReady=!requireGeolocation || Boolean(gps&&selectedSite?.geofenceConfigured&&accuracyOk&&insideRange);

  useEffect(()=>{
    let cancelled=false;
    if(navigator.permissions?.query){
      navigator.permissions.query({name:"geolocation"}).then(status=>{
        if(cancelled)return;
        setGeoPermission(status.state as "prompt"|"granted"|"denied");
        status.onchange=()=>setGeoPermission(status.state as "prompt"|"granted"|"denied");
      }).catch(()=>undefined);
    }
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>()=>stopCamera(),[]);

  function stopCamera(){
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
    setCameraReady(false);
  }

  async function ensureCamera() {
    if(streamRef.current && videoRef.current)return;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("La cámara no está disponible en este navegador.");
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
    if(humanRef.current)return humanRef.current;
    setMessage("Cargando verificación facial…");
    if(!window.Human){
      await new Promise<void>((resolve,reject)=>{
        const existing=document.querySelector<HTMLScriptElement>('script[data-biometric-human="true"]');
        if(existing){
          if(window.Human){resolve();return;}
          existing.addEventListener("load",()=>resolve(),{once:true});
          existing.addEventListener("error",()=>reject(new Error("No fue posible cargar el motor biométrico.")),{once:true});
          return;
        }
        const script=document.createElement("script");
        script.src="/biometric-human.js";
        script.async=true;
        script.dataset.biometricHuman="true";
        script.onload=()=>resolve();
        script.onerror=()=>reject(new Error("No fue posible cargar el motor biométrico."));
        document.head.appendChild(script);
      });
    }
    const namespace=window.Human;
    const HumanCtor=namespace?.Human||namespace?.default||namespace;
    if(typeof HumanCtor!=="function")throw new Error("El motor biométrico no está disponible.");
    const human=new HumanCtor({
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

  async function captureFace(samples=2):Promise<Capture>{
    await ensureCamera();
    const human=await ensureHuman();
    if(!videoRef.current)throw new Error("No se pudo iniciar la cámara.");

    const embeddings:number[][]=[];
    let minLive=1;
    let minReal=1;
    for(let attempt=0;attempt<samples;attempt+=1){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,550));
      const result=await human.detect(videoRef.current);
      if(result.face.length!==1)throw new Error(result.face.length>1?"Debe aparecer una sola persona frente a la cámara.":"No se detectó un rostro. Mira de frente a la cámara.");
      const face=result.face[0];
      if(!face.embedding?.length)throw new Error("No fue posible generar la plantilla facial.");
      const live=Number(face.live);
      const real=Number(face.real);
      if(!Number.isFinite(live)||!Number.isFinite(real))throw new Error("No fue posible comprobar presencia real.");
      if(live<livenessThreshold||real<livenessThreshold)throw new Error("La prueba de presencia no fue suficiente. Evita fotos o pantallas y mejora la iluminación.");
      embeddings.push(face.embedding.map(Number));
      minLive=Math.min(minLive,live);
      minReal=Math.min(minReal,real);
    }
    return{embedding:average(embeddings),live:minLive,real:minReal};
  }

  function chooseNearestSite(fix:GpsFix,preferredId:string){
    const ranked=configuredSites.map(site=>({
      site,
      distance:haversineMeters(fix.latitude,fix.longitude,Number(site.latitude),Number(site.longitude)),
    })).sort((a,b)=>a.distance-b.distance);
    const preferred=ranked.find(item=>item.site.id===preferredId);
    const nearest=ranked[0]||null;
    if(openShift){
      return ranked.find(item=>item.site.id===openShift.site_id)||preferred||nearest;
    }
    if(preferred&&preferred.distance<=preferred.site.geofenceRadius)return preferred;
    if(nearest&&nearest.distance<=nearest.site.geofenceRadius)return nearest;
    return preferred||nearest;
  }

  async function acquireLocation(preferredId=siteId){
    setPhase("gps");
    setError("");
    const result=await rawPosition();
    const fix:GpsFix={
      latitude:result.coords.latitude,
      longitude:result.coords.longitude,
      accuracy:result.coords.accuracy,
      checkedAt:Date.now(),
    };
    setGps(fix);
    setGeoPermission("granted");

    const assessment=chooseNearestSite(fix,preferredId);
    if(assessment&&!openShift)setSiteId(assessment.site.id);
    return{fix,assessment};
  }

  async function verifyLocation(){
    if(!requireGeolocation){
      setMessage("Esta empresa no exige geolocalización para la jornada.");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const{fix,assessment}=await acquireLocation();
      if(!assessment)throw new Error("No hay una sede con geocerca configurada dentro de tu alcance.");
      if(fix.accuracy>maxLocationAccuracy){
        throw new Error(`La precisión GPS actual es de ${Math.round(fix.accuracy)} m. Se requieren ${maxLocationAccuracy} m o menos.`);
      }
      if(assessment.distance>assessment.site.geofenceRadius){
        throw new Error(`Estás a ${Math.round(assessment.distance)} m de ${assessment.site.name}. El radio permitido es ${assessment.site.geofenceRadius} m.`);
      }
      setMessage(`Ubicación validada en ${assessment.site.name}. Ya puedes continuar con la verificación facial.`);
    }catch(cause){
      const geoCode=typeof cause==="object"&&cause!==null&&"code" in cause?Number((cause as{code?:unknown}).code):null;
      if(geoCode===1){
        setGeoPermission("denied");
        setError("La ubicación está bloqueada. Activa el permiso de ubicación precisa del navegador para iniciar actividades.");
      }else if(geoCode===2||geoCode===3){
        setError("No fue posible obtener una ubicación precisa. Activa el GPS y vuelve a intentarlo.");
      }else{
        setError(cause instanceof Error?cause.message:"No fue posible validar tu ubicación.");
      }
    }finally{
      setPhase("idle");setBusy(false);
    }
  }

  async function clock(action:"check_in"|"check_out"){
    if(!siteId&&!requireGeolocation){setError("Selecciona una sede.");return;}
    if(requireFace&&!enrolled){setError("Completa primero tu enrolamiento facial presencial.");return;}

    setBusy(true);setError("");setMessage("");
    let targetSiteId=siteId;
    let fix:GpsFix|null=null;
    try{
      if(requireGeolocation){
        const location=await acquireLocation(siteId);
        if(!location.assessment)throw new Error("No hay una sede con geocerca configurada dentro de tu alcance.");
        targetSiteId=location.assessment.site.id;
        fix=location.fix;
        if(fix.accuracy>maxLocationAccuracy){
          throw new Error(`La precisión GPS actual es de ${Math.round(fix.accuracy)} m. Se requieren ${maxLocationAccuracy} m o menos.`);
        }
        if(location.assessment.distance>location.assessment.site.geofenceRadius){
          throw new Error(`Estás fuera de rango: ${Math.round(location.assessment.distance)} m del punto registrado; se permiten ${location.assessment.site.geofenceRadius} m.`);
        }
      }

      const targetSite=sites.find(site=>site.id===targetSiteId);
      if(!targetSite)throw new Error("Selecciona una sede válida.");
      if(requireGeolocation&&!targetSite.geofenceConfigured)throw new Error("Esta sede aún no tiene geocerca configurada.");

      setPhase("face");
      const face=requireFace?await captureFace(2):{embedding:[],live:1,real:1};

      setPhase("saving");
      const response=await fetch("/api/attendance/clock",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action,
          siteId:targetSiteId,
          embedding:face.embedding,
          live:face.live,
          real:face.real,
          latitude:fix?.latitude,
          longitude:fix?.longitude,
          accuracy:fix?.accuracy,
        }),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"No fue posible registrar la presencia.");

      if(action==="check_in"){
        setSiteId(targetSiteId);
        setOpenShift({id:data.shiftId,site_id:targetSiteId,site_name:data.site,check_in_at:data.at});
        setMessage("Actividades iniciadas. Tu presencia en sitio quedó validada; puedes permanecer disponible aunque aún no tengas tareas asignadas.");
      }else{
        setOpenShift(null);
        setMessage("Actividades finalizadas y salida validada correctamente.");
      }
    }catch(cause){
      const geoCode=typeof cause==="object"&&cause!==null&&"code" in cause?Number((cause as{code?:unknown}).code):null;
      if(geoCode===1){
        setGeoPermission("denied");
        setError("La ubicación está bloqueada. Activa el permiso de ubicación precisa para continuar.");
      }else if(geoCode===2||geoCode===3){
        setError("No fue posible obtener tu ubicación. Activa el GPS y autoriza la ubicación precisa.");
      }else{
        setError(cause instanceof Error?cause.message:"No fue posible validar tu presencia.");
      }
    }finally{
      stopCamera();
      setPhase("idle");setBusy(false);
    }
  }

  const activityLabel=busy
    ? phase==="gps"?"Validando ubicación…"
      : phase==="face"?"Verificando rostro en vivo…"
      : phase==="saving"?"Confirmando presencia…"
      :"Validando…"
    : openShift?"Finalizar actividades":"Iniciar actividades";

  return <div className="attendance-presence-workspace">
    <section className={"attendance-presence-status "+(openShift?"active":"")}>
      <div className="attendance-presence-status-icon" aria-hidden="true">{openShift?"✓":"⌖"}</div>
      <div>
        <span className="eyebrow">Estado de presencia</span>
        <h2>{openShift?"En sitio y disponible":"Listo para iniciar en sitio"}</h2>
        <p>{openShift
          ? `Presencia validada en ${openShift.site_name}. La jornada no depende de tener actividades asignadas.`
          : "Puedes iniciar tu presencia biométrica aunque todavía no tengas órdenes o actividades asignadas."}</p>
      </div>
      <span className={"attendance-presence-pill "+(openShift?"active":"")}>{openShift?"Jornada abierta":"Sin jornada"}</span>
    </section>

    <div className="attendance-presence-grid">
      <section className="attendance-location-card">
        <header>
          <div><span className="eyebrow">Ubicación</span><h3>{selectedSite?.name||"Selecciona una sede"}</h3><p>{selectedSite?.city||"La geocerca se valida con el GPS del celular."}</p></div>
          {distance!==null&&<span className={"attendance-range-badge "+(insideRange&&accuracyOk?"inside":"outside")}>{insideRange&&accuracyOk?"Dentro del rango":Math.round(distance)+" m"}</span>}
        </header>

        {selectedSite?.geofenceConfigured&&selectedSite.latitude!==null&&selectedSite.longitude!==null
          ? <GeofenceMapPicker
              initialAddress={selectedSite.name}
              initialLatitude={selectedSite.latitude}
              initialLongitude={selectedSite.longitude}
              initialRadius={selectedSite.geofenceRadius}
              currentLatitude={gps?.latitude}
              currentLongitude={gps?.longitude}
              currentAccuracy={gps?.accuracy}
              readOnly
              addressRequired={false}
              coordinateRequired={false}
              className="attendance-presence-map"
            />
          : <div className="attendance-map-empty"><span>⌖</span><strong>Sede sin geocerca</strong><small>Un administrador debe configurar el punto y radio antes de usar asistencia geolocalizada.</small></div>}

        <div className="attendance-location-states">
          <div className={geoPermission==="denied"?"blocked":gps?"ready":""}><span>GPS</span><strong>{gps?`±${Math.round(gps.accuracy)} m`:geoPermission==="denied"?"Bloqueado":"Pendiente"}</strong></div>
          <div className={selectedSite?.geofenceConfigured?"ready":"blocked"}><span>Geocerca</span><strong>{selectedSite?.geofenceConfigured?`${selectedSite.geofenceRadius} m`:"Sin configurar"}</strong></div>
          <div className={locationReady?"ready":""}><span>Rango</span><strong>{distance===null?"Sin verificar":insideRange&&accuracyOk?"Correcto":"Fuera de rango"}</strong></div>
        </div>
      </section>

      <section className="attendance-action-card attendance-presence-action">
        {!enrolled&&requireFace ? <>
          <span className="eyebrow">Biometría pendiente</span>
          <h2>Requiere enrolamiento supervisado</h2>
          <p>Tu identidad facial todavía no está verificada. Un Administrador o Manager debe enrolarte presencialmente desde este módulo antes de que puedas iniciar actividades.</p>
          <div className="attendance-no-assignment-note">
            <span aria-hidden="true">i</span>
            <p><strong>La foto de perfil no sustituye este paso.</strong><small>El supervisor confirma tu identidad y la cámara genera una plantilla facial cifrada con prueba de vida.</small></p>
          </div>
          <button className="button secondary attendance-start-button" type="button" disabled>Enrolamiento requerido</button>
        </> : <>
          <span className="eyebrow">Inicio de jornada</span>
          <h2>{openShift?"Presencia activa":"Verifica tu presencia"}</h2>

          {openShift
            ? <div className="attendance-open-shift"><span>Inicio validado</span><strong>{new Date(openShift.check_in_at).toLocaleString("es-CO")}</strong><small>{openShift.site_name} · disponible para recibir actividades</small></div>
            : <div className="attendance-no-assignment-note"><span aria-hidden="true">i</span><p><strong>No necesitas una actividad asignada para iniciar.</strong><small>El registro confirma que estás presencialmente en la sede. Las actividades que recibas después quedarán relacionadas con esta jornada.</small></p></div>}

          <div className="field">
            <label>Sede *</label>
            <select value={siteId} onChange={event=>{setSiteId(event.target.value);setGps(null);}} disabled={Boolean(openShift)}>
              <option value="">Selecciona sede</option>
              {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}{requireGeolocation&&!site.geofenceConfigured?" · Sin geocerca":""}</option>)}
            </select>
          </div>

          <div className="attendance-validation-steps">
            <div className={gps&&accuracyOk&&insideRange?"done":phase==="gps"?"current":""}><span>1</span><p><strong>Ubicación</strong><small>{gps?insideRange&&accuracyOk?"Dentro de geocerca":"Requiere revisión":"GPS preciso"}</small></p></div>
            <div className={enrolled?"done":phase==="face"?"current":""}><span>2</span><p><strong>Rostro</strong><small>{enrolled?"Biometría enrolada":"Cámara presencial"}</small></p></div>
            <div className={openShift?"done":phase==="saving"?"current":""}><span>3</span><p><strong>Presencia</strong><small>{openShift?"En sitio":"Abrir jornada"}</small></p></div>
          </div>

          {requireGeolocation&&!openShift&&<button className="button secondary attendance-location-check" type="button" disabled={busy} onClick={verifyLocation}>⌖ Verificar ubicación</button>}
          <button className={"button attendance-clock-button attendance-start-button "+(openShift?"attendance-stop-button":"")} type="button" disabled={busy||(!siteId&&configuredSites.length===0)} onClick={()=>clock(openShift?"check_out":"check_in")}>{activityLabel}</button>

          {requireFace&&enrolled&&!openShift&&<small className="attendance-biometric-note">Tu biometría fue verificada por un supervisor. La revocación o reenrolamiento también requiere supervisión.</small>}
        </>}

        {message&&<div className="notice success">{message}</div>}
        {error&&<div className="notice error">{error}</div>}
      </section>
    </div>

    <section className={"attendance-camera-card attendance-presence-camera "+(cameraReady||phase==="face"?"visible":"")}>
      <div className="attendance-camera-stage">
        <video ref={videoRef} playsInline muted className={cameraReady?"ready":""} />
        <div className="attendance-face-guide" aria-hidden="true" />
        {!cameraReady&&<div className="attendance-camera-placeholder"><span>◎</span><strong>Verificación facial presencial</strong><small>La cámara se activa únicamente durante enrolamiento, inicio o finalización de actividades.</small></div>}
      </div>
      <div className="attendance-camera-state">
        <span className={cameraReady?"ready":""}><i /> Cámara</span>
        <span className={modelReady?"ready":""}><i /> Motor facial</span>
        <span className={enrolled?"ready":""}><i /> Enrolamiento</span>
        <span className={locationReady?"ready":""}><i /> Geocerca</span>
      </div>
    </section>
  </div>;
}
