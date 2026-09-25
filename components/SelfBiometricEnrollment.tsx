"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Alert, Spinner } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";
import { Modal } from "@/components/ui-kit/Overlay";
import {
  captureEnrollmentPreview,
  captureLiveFace,
  createActiveLivenessChallenge,
  loadBiometricEngine,
  runActiveLivenessChallenge,
  type ActiveLivenessChallengeCode,
} from "@/lib/client-biometric";

type Site={
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofenceRadius:number;
  geofenceConfigured:boolean;
};

type EnrollmentState={
  policy:{
    enabled:boolean;
    roleEnabled:boolean;
    requireFace:boolean;
    maxLocationAccuracy:number;
    livenessThreshold:number;
  };
  notice:{id:string;version:number;title:string;body:string;published_at:string}|null;
  profileStatus:"verified"|"legacy"|"revoked"|"missing";
  request:{
    id:string;
    status:"pending"|"approved"|"rejected"|"cancelled"|"expired";
    site_id:string;
    site_name:string;
    requested_at:string;
    reviewed_at:string|null;
    review_note:string|null;
  }|null;
};

type GpsEvidence={latitude:number;longitude:number;accuracy:number;distance:number};

function haversineMeters(lat1:number,lon1:number,lat2:number,lon2:number){
  const r=6371000;
  const toRad=(value:number)=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(a));
}

function currentPosition(){
  return new Promise<GeolocationPosition>((resolve,reject)=>{
    if(!navigator.geolocation){
      reject(new Error("Este dispositivo no permite validar la ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}

export default function SelfBiometricEnrollment({
  sites,
  preferredSiteId=null,
}:{
  sites:Site[];
  preferredSiteId?:string|null;
}){
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const humanRef=useRef<any>(null);
  const [state,setState]=useState<EnrollmentState|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [policyOpen,setPolicyOpen]=useState(false);
  const [policyRead,setPolicyRead]=useState(false);
  const [consent,setConsent]=useState(false);
  const [deviceConsent,setDeviceConsent]=useState(false);
  const [siteId,setSiteId]=useState(preferredSiteId&&sites.some(site=>site.id===preferredSiteId)?preferredSiteId:(sites[0]?.id||""));
  const [location,setLocation]=useState<GpsEvidence|null>(null);
  const [cameraReady,setCameraReady]=useState(false);
  const [challenge,setChallenge]=useState<ActiveLivenessChallengeCode[]>([]);
  const [challengeLabel,setChallengeLabel]=useState("");
  const [challengeCompleted,setChallengeCompleted]=useState(0);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const selectedSite=useMemo(()=>sites.find(site=>site.id===siteId)||null,[sites,siteId]);

  useEffect(()=>{
    let cancelled=false;
    fetch("/api/attendance/enrollment-request",{headers:{Accept:"application/json"},cache:"no-store"})
      .then(async response=>{
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload.message||"No fue posible consultar el estado biométrico.");
        if(!cancelled)setState(payload);
      })
      .catch(cause=>{if(!cancelled)setError(cause instanceof Error?cause.message:"No fue posible consultar el estado biométrico.");})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;stopCamera();};
  },[]);

  function stopCamera(){
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
    setCameraReady(false);
  }

  async function ensureCamera(){
    if(streamRef.current&&videoRef.current)return;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("La cámara frontal no está disponible en este navegador.");
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

  async function verifyLocation(){
    if(!selectedSite){setError("Selecciona la sede donde estás físicamente.");return;}
    if(!selectedSite.geofenceConfigured||selectedSite.latitude===null||selectedSite.longitude===null){
      setError("La sede seleccionada no tiene geocerca configurada.");
      return;
    }
    if(!policyRead||!consent||!deviceConsent){
      setError("Primero lee la política y completa las autorizaciones.");
      return;
    }

    setBusy(true);setError("");setMessage("");
    try{
      const position=await currentPosition();
      const accuracy=position.coords.accuracy;
      const distance=haversineMeters(
        position.coords.latitude,position.coords.longitude,
        selectedSite.latitude,selectedSite.longitude,
      );
      const maxAccuracy=Math.min(state?.policy.maxLocationAccuracy||120,120);
      if(accuracy>maxAccuracy)throw new Error(`La precisión GPS es de ${Math.round(accuracy)} m. Se requieren ${maxAccuracy} m o menos.`);
      if(distance>selectedSite.geofenceRadius){
        throw new Error(`Estás a ${Math.round(distance)} m de ${selectedSite.name}; el radio permitido es ${selectedSite.geofenceRadius} m.`);
      }
      setLocation({
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy,
        distance,
      });
      setMessage("Ubicación verificada. Ahora puedes activar la cámara y completar la prueba de vida.");
    }catch(cause){
      setLocation(null);
      setError(cause instanceof Error?cause.message:"No fue posible validar tu ubicación.");
    }finally{
      setBusy(false);
    }
  }

  async function submitEnrollment(){
    if(!state?.notice){setError("No existe una política biométrica vigente para aceptar.");return;}
    if(!location){setError("Primero verifica que estás dentro de la sede.");return;}
    if(!policyRead||!consent||!deviceConsent){setError("Completa las autorizaciones antes de activar la cámara.");return;}

    setBusy(true);setError("");setMessage("");
    const activeChallenge=createActiveLivenessChallenge();
    setChallenge(activeChallenge);
    setChallengeCompleted(0);
    try{
      await ensureCamera();
      if(!humanRef.current)humanRef.current=await loadBiometricEngine();
      const evidence=await runActiveLivenessChallenge({
        human:humanRef.current,
        video:videoRef.current as HTMLVideoElement,
        challenge:activeChallenge,
        onStep:({index,label,status})=>{
          setChallengeLabel(label);
          if(status==="done")setChallengeCompleted(index+1);
        },
      });
      setChallengeLabel("Mira de frente a la cámara");
      const face=await captureLiveFace({
        human:humanRef.current,
        video:videoRef.current as HTMLVideoElement,
        livenessThreshold:state.policy.livenessThreshold,
        samples:3,
      });
      const preview=captureEnrollmentPreview(videoRef.current as HTMLVideoElement);

      const response=await fetch("/api/attendance/enrollment-request",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          siteId,
          policyVersionId:state.notice.id,
          consent:true,
          embedding:face.embedding,
          preview,
          live:face.live,
          real:face.real,
          latitude:location.latitude,
          longitude:location.longitude,
          accuracy:location.accuracy,
          challengeEvidence:evidence,
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible enviar la solicitud biométrica.");

      setState(previous=>previous?{
        ...previous,
        request:{
          id:payload.requestId,
          status:"pending",
          site_id:siteId,
          site_name:selectedSite?.name||"Sede",
          requested_at:payload.requestedAt,
          reviewed_at:null,
          review_note:null,
        },
      }:previous);
      setMessage(payload.message||"Solicitud enviada para aprobación.");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible completar el enrolamiento.");
    }finally{
      stopCamera();
      setBusy(false);
    }
  }

  if(loading)return <div className="self-biometric-loading"><Spinner label="Consultando enrolamiento biométrico"/></div>;

  if(state?.profileStatus==="verified"){
    return <section className="self-biometric-state verified">
      <span className="self-biometric-state-icon"><UiIcon name="check" size={22}/></span>
      <div><span className="eyebrow">Identidad biométrica</span><h2>Biometría aprobada</h2><p>Tu identidad ya fue aprobada. Las próximas entradas y salidas se validan automáticamente con rostro en vivo, prueba anti-suplantación y geocerca según la política vigente.</p></div>
      <Badge variant="success" icon="attendance">Verificada</Badge>
    </section>;
  }

  if(state?.request?.status==="pending"){
    return <section className="self-biometric-state pending">
      <span className="self-biometric-state-icon"><UiIcon name="clock" size={22}/></span>
      <div>
        <span className="eyebrow">Enrolamiento enviado</span>
        <h2>Pendiente de aprobación única</h2>
        <p>La solicitud fue enviada desde {state.request.site_name}. Un Administrador o Manager debe confirmar tu identidad una sola vez. Después las marcaciones serán automáticas.</p>
        <small>Solicitud: {new Date(state.request.requested_at).toLocaleString("es-CO")}</small>
      </div>
      <Badge variant="warning" icon="clock">Pendiente</Badge>
    </section>;
  }

  return <section className="self-biometric-enrollment">
    <div className="self-biometric-intro">
      <span className="self-biometric-intro-icon"><UiIcon name="user" size={22}/></span>
      <div>
        <span className="eyebrow">Primera activación biométrica</span>
        <h2>Enrola tu rostro desde el celular</h2>
        <p>Este proceso se realiza una sola vez. Después de la aprobación administrativa podrás iniciar y finalizar jornadas sin aprobación humana diaria.</p>
      </div>
      <Badge variant={state?.request?.status==="rejected"?"danger":"neutral"}>
        {state?.request?.status==="rejected"?"Reintento requerido":"Sin enrolar"}
      </Badge>
    </div>

    {state?.request?.status==="rejected"&&<Alert variant="warning" title="La solicitud anterior fue rechazada">{state.request.review_note||"Repite el enrolamiento y verifica que tu rostro, ubicación y datos correspondan correctamente."}</Alert>}
    {state?.request?.status==="expired"&&<Alert variant="warning" title="La evidencia temporal expiró">Por seguridad debes repetir la captura y enviar una nueva solicitud.</Alert>}
    {!state?.notice&&<Alert variant="danger" title="Política biométrica pendiente">Un administrador debe publicar la política biométrica de la empresa antes de que puedas enrolarte.</Alert>}

    <div className="self-biometric-steps">
      <article className={policyRead?"done":""}>
        <span>1</span>
        <div><strong>Lee la política</strong><small>Versión {state?.notice?.version||"—"}</small></div>
        <Button size="sm" variant="secondary" disabled={!state?.notice} onClick={()=>setPolicyOpen(true)}>Leer política</Button>
      </article>

      <article className={policyRead&&consent&&deviceConsent?"done":""}>
        <span>2</span>
        <div className="self-biometric-consents">
          <strong>Autoriza el enrolamiento</strong>
          <label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={!policyRead}/><span>Autorizo expresamente el tratamiento de mi plantilla facial conforme a la política leída.</span></label>
          <label><input type="checkbox" checked={deviceConsent} onChange={event=>setDeviceConsent(event.target.checked)} disabled={!policyRead}/><span>Autorizo el uso de cámara y ubicación precisa durante este enrolamiento.</span></label>
        </div>
      </article>

      <article className={location?"done":""}>
        <span>3</span>
        <div className="self-biometric-location">
          <strong>Verifica que estás en la sede</strong>
          <select value={siteId} onChange={event=>{setSiteId(event.target.value);setLocation(null);}}>
            <option value="">Selecciona sede</option>
            {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}{!site.geofenceConfigured?" · Sin geocerca":""}</option>)}
          </select>
          {location&&<small>GPS ±{Math.round(location.accuracy)} m · distancia {Math.round(location.distance)} m</small>}
        </div>
        <Button size="sm" variant="secondary" loading={busy&&!cameraReady} disabled={busy||!policyRead||!consent||!deviceConsent} onClick={verifyLocation} iconLeft="location">
          {location?"Ubicación verificada":"Verificar sede"}
        </Button>
      </article>

      <article className={challengeCompleted===2?"done":""}>
        <span>4</span>
        <div><strong>Prueba de vida activa</strong><small>{challengeLabel||"La cámara te pedirá dos gestos aleatorios para reducir intentos con foto o pantalla."}</small></div>
        <Button size="sm" loading={busy} disabled={busy||!location||!state?.notice} onClick={submitEnrollment} iconLeft="user">Activar cámara y enviar</Button>
      </article>
    </div>

    <div className={"attendance-camera-card self-biometric-camera "+(cameraReady?"visible":"")}>
      <div className="attendance-camera-stage">
        <video ref={videoRef} playsInline muted className={cameraReady?"ready":""}/>
        <div className="attendance-face-guide" aria-hidden="true"/>
        {!cameraReady&&<div className="attendance-camera-placeholder"><span><UiIcon name="user" size={24}/></span><strong>Cámara frontal</strong><small>Solo se activa después de aceptar la política y verificar la sede.</small></div>}
      </div>
      {cameraReady&&challenge.length>0&&<div className="self-biometric-challenge">
        <strong>{challengeLabel}</strong>
        <span>{challengeCompleted}/{challenge.length} retos completados</span>
      </div>}
    </div>

    {message&&<Alert variant="success" title="Proceso biométrico">{message}</Alert>}
    {error&&<Alert variant="danger" title="No fue posible completar el enrolamiento">{error}</Alert>}

    <Modal
      open={policyOpen}
      onClose={()=>setPolicyOpen(false)}
      title={state?.notice?.title||"Política biométrica"}
      eyebrow={state?.notice?"Versión "+state.notice.version:undefined}
      description="Lee el contenido completo antes de autorizar el tratamiento biométrico."
      size="lg"
      footer={<Button onClick={()=>{setPolicyRead(true);setPolicyOpen(false);}}>He leído y entiendo la política</Button>}
    >
      <div className="self-biometric-policy-text">{state?.notice?.body||"No hay una política vigente disponible."}</div>
    </Modal>
  </section>;
}
