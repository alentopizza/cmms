"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import { captureLiveFace, loadBiometricEngine, type FaceCapture } from "@/lib/client-biometric";
import UiIcon from "@/components/UiIcon";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";

type Site = {
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofenceRadius:number;
  geofenceConfigured:boolean;
};

type OpenShift={
  id:string;
  site_id:string;
  site_name:string;
  current_site_id:string;
  current_site_name:string;
  check_in_at:string;
};

type OpenDisplacement={
  id:string;
  from_site_id:string;
  to_site_id:string;
  from_site_name:string;
  to_site_name:string;
  departed_at:string;
  status:"in_transit";
};

type Props = {
  sites: Site[];
  enrolled: boolean;
  openShift: OpenShift | null;
  openDisplacement: OpenDisplacement | null;
  requireFace: boolean;
  requireGeolocation: boolean;
  maxLocationAccuracy: number;
  livenessThreshold: number;
};

type GpsFix = {
  latitude:number;
  longitude:number;
  accuracy:number;
  checkedAt:number;
};

type Phase = "idle"|"gps"|"face"|"saving"|"movement";

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
// Displacements are explicit shift events. They update the operational current
// site only after GPS-confirmed arrival; the original check-in site is preserved.

export default function AttendanceCapture({
  sites,
  enrolled:initialEnrolled,
  openShift:initialOpenShift,
  openDisplacement:initialOpenDisplacement,
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
  const enrolled=initialEnrolled;
  const [openShift,setOpenShift]=useState<OpenShift|null>(initialOpenShift);
  const [openDisplacement,setOpenDisplacement]=useState<OpenDisplacement|null>(initialOpenDisplacement);
  const [siteId,setSiteId]=useState(initialOpenShift?.current_site_id || initialOpenShift?.site_id || sites[0]?.id || "");
  const [destinationSiteId,setDestinationSiteId]=useState("");
  const [gps,setGps]=useState<GpsFix|null>(null);
  const [geoPermission,setGeoPermission]=useState<"unknown"|"prompt"|"granted"|"denied">("unknown");

  const selectedSite=useMemo(()=>sites.find(site=>site.id===siteId)||null,[sites,siteId]);
  const configuredSites=useMemo(()=>sites.filter(site=>site.geofenceConfigured&&site.latitude!==null&&site.longitude!==null),[sites]);
  const displacementDestinations=useMemo(
    ()=>sites.filter(site=>site.id!==(openShift?.current_site_id||openShift?.site_id)),
    [sites,openShift],
  );
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
    const human=await loadBiometricEngine();
    humanRef.current=human;
    setModelReady(true);
    return human;
  }

  async function captureFace(samples=2):Promise<FaceCapture>{
    await ensureCamera();
    const human=await ensureHuman();
    if(!videoRef.current)throw new Error("No se pudo iniciar la cámara.");
    return captureLiveFace({
      human,
      video:videoRef.current,
      livenessThreshold,
      samples,
    });
  }

  function chooseSite(fix:GpsFix,preferredId:string,forcePreferred=false){
    const ranked=configuredSites.map(site=>({
      site,
      distance:haversineMeters(fix.latitude,fix.longitude,Number(site.latitude),Number(site.longitude)),
    })).sort((a,b)=>a.distance-b.distance);
    const preferred=ranked.find(item=>item.site.id===preferredId)||null;
    const nearest=ranked[0]||null;
    if(forcePreferred)return preferred;
    if(preferred&&preferred.distance<=preferred.site.geofenceRadius)return preferred;
    if(nearest&&nearest.distance<=nearest.site.geofenceRadius)return nearest;
    return preferred||nearest;
  }

  async function acquireLocation(preferredId=siteId,forcePreferred=false){
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

    const assessment=chooseSite(fix,preferredId,forcePreferred);
    if(assessment&&!openShift&&!forcePreferred)setSiteId(assessment.site.id);
    return{fix,assessment};
  }

  async function verifiedFix(targetSiteId:string,forcePreferred=true){
    if(!requireGeolocation)return {fix:null,assessment:null};
    const location=await acquireLocation(targetSiteId,forcePreferred);
    if(!location.assessment)throw new Error("La sede seleccionada no tiene una geocerca utilizable dentro de tu alcance.");
    if(location.fix.accuracy>maxLocationAccuracy){
      throw new Error(`La precisión GPS actual es de ${Math.round(location.fix.accuracy)} m. Se requieren ${maxLocationAccuracy} m o menos.`);
    }
    if(location.assessment.distance>location.assessment.site.geofenceRadius){
      throw new Error(`Estás a ${Math.round(location.assessment.distance)} m de ${location.assessment.site.name}. El radio permitido es ${location.assessment.site.geofenceRadius} m.`);
    }
    return location;
  }

  async function verifyLocation(){
    if(!requireGeolocation){
      setMessage("Esta empresa no exige geolocalización para la jornada.");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const{fix,assessment}=await acquireLocation(siteId,false);
      if(!assessment)throw new Error("No hay una sede con geocerca configurada dentro de tu alcance.");
      if(fix.accuracy>maxLocationAccuracy){
        throw new Error(`La precisión GPS actual es de ${Math.round(fix.accuracy)} m. Se requieren ${maxLocationAccuracy} m o menos.`);
      }
      if(assessment.distance>assessment.site.geofenceRadius){
        throw new Error(`Estás a ${Math.round(assessment.distance)} m de ${assessment.site.name}. El radio permitido es ${assessment.site.geofenceRadius} m.`);
      }
      setMessage(`Ubicación validada en ${assessment.site.name}. Ya puedes continuar con la verificación facial.`);
    }catch(cause){
      handleLocationError(cause);
    }finally{
      setPhase("idle");setBusy(false);
    }
  }

  function handleLocationError(cause:unknown){
    const geoCode=typeof cause==="object"&&cause!==null&&"code" in cause?Number((cause as{code?:unknown}).code):null;
    if(geoCode===1){
      setGeoPermission("denied");
      setError("La ubicación está bloqueada. Activa el permiso de ubicación precisa del navegador para continuar.");
    }else if(geoCode===2||geoCode===3){
      setError("No fue posible obtener una ubicación precisa. Activa el GPS y vuelve a intentarlo.");
    }else{
      setError(cause instanceof Error?cause.message:"No fue posible validar tu ubicación.");
    }
  }

  async function clock(action:"check_in"|"check_out"){
    const currentSiteId=openShift?.current_site_id||openShift?.site_id||siteId;
    const requestedSiteId=action==="check_out"?currentSiteId:siteId;
    if(!requestedSiteId){setError("Selecciona una sede.");return;}
    if(requireFace&&!enrolled){setError("Completa primero tu enrolamiento facial presencial.");return;}
    if(action==="check_out"&&openDisplacement){setError("Registra primero la llegada del desplazamiento en curso.");return;}

    setBusy(true);setError("");setMessage("");
    let targetSiteId=requestedSiteId;
    let fix:GpsFix|null=null;
    try{
      if(requireGeolocation){
        const location=await verifiedFix(requestedSiteId,action==="check_out");
        if(!location.assessment||!location.fix)throw new Error("No fue posible validar la sede.");
        targetSiteId=location.assessment.site.id;
        fix=location.fix;
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
        const nextShift:OpenShift={
          id:data.shiftId,site_id:targetSiteId,site_name:data.site,
          current_site_id:data.currentSiteId||targetSiteId,current_site_name:data.currentSite||data.site,check_in_at:data.at,
        };
        setOpenShift(nextShift);
        window.dispatchEvent(new CustomEvent("attendance:shift-changed",{detail:{action:"check_in",shift:nextShift}}));
        setMessage("Jornada iniciada. Tu presencia en sitio quedó validada y los desplazamientos posteriores podrán registrarse entre sedes.");
      }else{
        setOpenShift(null);
        setOpenDisplacement(null);
        setDestinationSiteId("");
        window.dispatchEvent(new CustomEvent("attendance:shift-changed",{detail:{action:"check_out",shift:null}}));
        setMessage("Jornada finalizada y salida validada correctamente.");
      }
    }catch(cause){
      handleLocationError(cause);
    }finally{
      stopCamera();
      setPhase("idle");setBusy(false);
    }
  }

  async function movement(action:"start"|"arrive"){
    if(!openShift){setError("Debes iniciar una jornada antes de registrar un desplazamiento.");return;}
    const targetSiteId=action==="start"?destinationSiteId:openDisplacement?.to_site_id||"";
    const originSiteId=openShift.current_site_id||openShift.site_id;
    if(action==="start"&&!targetSiteId){setError("Selecciona la sede de destino.");return;}

    setBusy(true);setPhase("movement");setError("");setMessage("");
    try{
      const verificationSiteId=action==="start"?originSiteId:targetSiteId;
      const location=requireGeolocation?await verifiedFix(verificationSiteId,true):{fix:null,assessment:null};
      const response=await fetch("/api/attendance/displacements",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action,
          destinationSiteId:action==="start"?targetSiteId:undefined,
          latitude:location.fix?.latitude,
          longitude:location.fix?.longitude,
          accuracy:location.fix?.accuracy,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible registrar el desplazamiento.");

      if(action==="start"){
        setOpenDisplacement(data.displacement);
        setMessage(`Desplazamiento iniciado hacia ${data.displacement.to_site_name}. Registra la llegada cuando estés dentro de la geocerca de destino.`);
      }else{
        const currentId=data.currentSite.id;
        setOpenShift(previous=>previous?{...previous,current_site_id:currentId,current_site_name:data.currentSite.name}:previous);
        setSiteId(currentId);
        setOpenDisplacement(null);
        setDestinationSiteId("");
        setGps(null);
        setMessage(`Llegada registrada en ${data.currentSite.name}. Esta sede es ahora tu ubicación operativa y puedes finalizar aquí la jornada.`);
      }
    }catch(cause){
      handleLocationError(cause);
    }finally{
      setPhase("idle");setBusy(false);
    }
  }

  const activityLabel=busy
    ? phase==="gps"?"Validando ubicación…"
      : phase==="face"?"Verificando rostro en vivo…"
      : phase==="saving"?"Confirmando presencia…"
      : phase==="movement"?"Registrando desplazamiento…"
      :"Validando…"
    : openShift?"Marcar salida / Finalizar jornada":"Iniciar actividades";

  return <div className="attendance-presence-workspace">
    <section className={"attendance-presence-status "+(openShift?"active":"")}>
      <div className="attendance-presence-status-icon" aria-hidden="true"><UiIcon name={openShift?"check":"attendance"} size={22}/></div>
      <div>
        <span className="eyebrow">Estado de presencia</span>
        <h2>{openShift?(openDisplacement?"En desplazamiento":"En sitio y disponible"):"Listo para iniciar en sitio"}</h2>
        <p>{openShift
          ? openDisplacement
            ? `Trayecto activo: ${openDisplacement.from_site_name} → ${openDisplacement.to_site_name}.`
            : `Ubicación operativa actual: ${openShift.current_site_name}. La jornada inició en ${openShift.site_name}.`
          : "Puedes iniciar tu presencia biométrica aunque todavía no tengas órdenes o actividades asignadas."}</p>
      </div>
      <Badge variant={openDisplacement?"info":openShift?"success":"neutral"} icon="attendance">{openDisplacement?"En tránsito":openShift?"Jornada abierta":"Sin jornada"}</Badge>
    </section>

    <div className="attendance-presence-grid">
      <section className="attendance-location-card">
        <header>
          <div><span className="eyebrow">Ubicación</span><h3>{selectedSite?.name||"Selecciona una sede"}</h3><p>{selectedSite?.city||"La geocerca se valida con el GPS del celular."}</p></div>
          {distance!==null&&<Badge variant={insideRange&&accuracyOk?"success":"warning"} icon="location">{insideRange&&accuracyOk?"Dentro del rango":Math.round(distance)+" m"}</Badge>}
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
          : <div className="attendance-map-empty"><span><UiIcon name="location" size={22}/></span><strong>Sede sin geocerca</strong><small>Un administrador debe configurar el punto y radio antes de usar asistencia geolocalizada.</small></div>}

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
          <p>Tu identidad facial todavía no está verificada. Un Administrador o Manager debe enrolarte presencialmente desde este módulo o desde tu ficha de Usuario.</p>
          <div className="attendance-no-assignment-note">
            <span aria-hidden="true"><UiIcon name="info" size={16}/></span>
            <p><strong>La foto de perfil no sustituye este paso.</strong><small>El supervisor confirma tu identidad y la cámara genera una plantilla facial cifrada con prueba de vida.</small></p>
          </div>
          <Button className="attendance-start-button" variant="secondary" disabled iconLeft="attendance">Enrolamiento requerido</Button>
        </> : <>
          <span className="eyebrow">{openShift?"Cierre de jornada":"Inicio de jornada"}</span>
          <h2>{openShift?"Jornada abierta · finaliza desde tu ubicación operativa actual":"Verifica tu presencia"}</h2>

          {openShift
            ? <div className="attendance-open-shift"><span>Inicio validado</span><strong>{new Date(openShift.check_in_at).toLocaleString("es-CO")}</strong><small>{openShift.site_name} · actual: {openShift.current_site_name}</small></div>
            : <div className="attendance-no-assignment-note"><span aria-hidden="true"><UiIcon name="info" size={16}/></span><p><strong>No necesitas una actividad asignada para iniciar.</strong><small>El registro confirma que estás presencialmente en la sede. Las actividades que recibas después quedarán relacionadas con esta jornada.</small></p></div>}

          <div className="field">
            <label>{openShift?"Sede operativa actual":"Sede *"}</label>
            <select value={siteId} onChange={event=>{setSiteId(event.target.value);setGps(null);}} disabled={Boolean(openShift)}>
              <option value="">Selecciona sede</option>
              {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}{requireGeolocation&&!site.geofenceConfigured?" · Sin geocerca":""}</option>)}
            </select>
          </div>

          <div className="attendance-validation-steps">
            <div className={gps&&accuracyOk&&insideRange?"done":phase==="gps"?"current":""}><span>1</span><p><strong>Ubicación</strong><small>{gps?insideRange&&accuracyOk?"Dentro de geocerca":"Requiere revisión":"GPS preciso"}</small></p></div>
            <div className={enrolled?"done":phase==="face"?"current":""}><span>2</span><p><strong>Rostro</strong><small>{enrolled?"Biometría enrolada":"Cámara presencial"}</small></p></div>
            <div className={openShift?"done":phase==="saving"?"current":""}><span>3</span><p><strong>Presencia</strong><small>{openShift?"En jornada":"Abrir jornada"}</small></p></div>
          </div>

          {requireGeolocation&&!openShift&&<Button className="attendance-location-check" variant="secondary" disabled={busy} onClick={verifyLocation} iconLeft="location">Verificar ubicación</Button>}
          <Button className={"attendance-clock-button attendance-start-button "+(openShift?"attendance-stop-button":"")} variant={openShift?"danger":"primary"} loading={busy} disabled={!busy&&((!siteId&&configuredSites.length===0)||Boolean(openDisplacement))} onClick={()=>clock(openShift?"check_out":"check_in")} iconLeft="attendance">{activityLabel}</Button>

          {requireFace&&enrolled&&!openShift&&<small className="attendance-biometric-note">Tu biometría fue verificada por un supervisor. La revocación o reenrolamiento también requiere supervisión.</small>}
        </>}
        {message&&<Alert variant="success" title="Validación completada">{message}</Alert>}
        {error&&<Alert variant="danger" title="No fue posible completar la operación">{error}</Alert>}
      </section>
    </div>

    {openShift&&<section className="attendance-displacement-card">
      <div className="section-heading">
        <div><span className="eyebrow">Desplazamientos</span><h3>Cambio de ubicación durante la jornada</h3><p className="muted">Registra la salida de una sede y confirma la llegada a la siguiente. El inicio original de la jornada no se modifica.</p></div>
        <Badge variant={openDisplacement?"info":"neutral"} icon="map">{openDisplacement?"En tránsito":"Sin trayecto activo"}</Badge>
      </div>
      {openDisplacement
        ? <div className="attendance-displacement-active">
            <div><span>Origen</span><strong>{openDisplacement.from_site_name}</strong></div>
            <span className="attendance-displacement-arrow" aria-hidden="true"><UiIcon name="map" size={20}/></span>
            <div><span>Destino</span><strong>{openDisplacement.to_site_name}</strong></div>
            <small>Salida: {new Date(openDisplacement.departed_at).toLocaleString("es-CO")}</small>
            <Button iconLeft="location" loading={busy} onClick={()=>movement("arrive")}>Registrar llegada</Button>
          </div>
        : <div className="attendance-displacement-start">
            <div className="field"><label>Destino *</label><select value={destinationSiteId} onChange={event=>setDestinationSiteId(event.target.value)}><option value="">Selecciona sede de destino</option>{displacementDestinations.map(site=><option value={site.id} key={site.id}>{site.name}{site.city?" · "+site.city:""}</option>)}</select></div>
            <div className="attendance-displacement-origin"><span>Origen actual</span><strong>{openShift.current_site_name}</strong><small>Se validará GPS antes de iniciar el trayecto.</small></div>
            <Button variant="secondary" iconLeft="map" loading={busy} disabled={!destinationSiteId} onClick={()=>movement("start")}>Iniciar desplazamiento</Button>
          </div>}
    </section>}

    <section className={"attendance-camera-card attendance-presence-camera "+(cameraReady||phase==="face"?"visible":"")}>
      <div className="attendance-camera-stage">
        <video ref={videoRef} playsInline muted className={cameraReady?"ready":""} />
        <div className="attendance-face-guide" aria-hidden="true" />
        {!cameraReady&&<div className="attendance-camera-placeholder"><span><UiIcon name="user" size={24}/></span><strong>Verificación facial presencial</strong><small>La cámara se activa únicamente durante enrolamiento, inicio o finalización de actividades.</small></div>}
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
