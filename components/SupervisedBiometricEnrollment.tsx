"use client";

import { useEffect, useRef, useState } from "react";
import { captureLiveFace, loadBiometricEngine } from "@/lib/client-biometric";
import UiIcon from "@/components/UiIcon";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";

type Person = {
  id:string;
  full_name:string;
  email:string;
  role:string;
  has_avatar:boolean;
  biometric_status:"verified"|"legacy"|"revoked"|"missing";
};

type Site = {
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofenceRadius:number;
};

function haversineMeters(lat1:number,lon1:number,lat2:number,lon2:number) {
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
    navigator.geolocation.getCurrentPosition(resolve,reject,{
      enableHighAccuracy:true,
      timeout:15000,
      maximumAge:0,
    });
  });
}

// ── Supervised identity verification workflow ───────────────────────────────

export default function SupervisedBiometricEnrollment({
  people,
  sites,
  livenessThreshold,
}:{
  people:Person[];
  sites:Site[];
  livenessThreshold:number;
}) {
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const humanRef=useRef<any>(null);

  const [userId,setUserId]=useState("");
  const [siteId,setSiteId]=useState("");
  const [consent,setConsent]=useState(false);
  const [identityChecked,setIdentityChecked]=useState(false);
  const [cameraReady,setCameraReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [locationVerified,setLocationVerified]=useState(false);
  const [locationEvidence,setLocationEvidence]=useState<{latitude:number;longitude:number;accuracy:number;distance:number}|null>(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [statusByUser,setStatusByUser]=useState<Record<string,Person["biometric_status"]>>(
    Object.fromEntries(people.map(person=>[person.id,person.biometric_status])),
  );

  const selected=people.find(person=>person.id===userId)||null;
  const selectedSite=sites.find(site=>site.id===siteId)||null;
  const selectedStatus=selected ? (statusByUser[selected.id] || selected.biometric_status) : "missing";

  useEffect(()=>()=>stopCamera(),[]);

  function stopCamera(){
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
    setCameraReady(false);
  }

  async function ensureCamera(){
    if(streamRef.current&&videoRef.current)return;
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

  async function verifyEnrollmentLocation(){
    if(!selectedSite){setError("Selecciona la sede donde se realizará el enrolamiento.");return;}
    if(selectedSite.latitude===null||selectedSite.longitude===null){
      setError("La sede seleccionada no tiene geocerca configurada.");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const position=await currentPosition();
      const accuracy=position.coords.accuracy;
      const distance=haversineMeters(
        position.coords.latitude,
        position.coords.longitude,
        selectedSite.latitude,
        selectedSite.longitude,
      );
      if(accuracy>120)throw new Error(`La precisión GPS es de ${Math.round(accuracy)} m. Acércate a una zona con mejor señal y vuelve a intentar.`);
      if(distance>selectedSite.geofenceRadius){
        throw new Error(`El dispositivo está a ${Math.round(distance)} m de ${selectedSite.name}; el radio permitido es ${selectedSite.geofenceRadius} m.`);
      }
      setLocationEvidence({
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy,
        distance,
      });
      setLocationVerified(true);
      setMessage(`Ubicación verificada en ${selectedSite.name}. Ya puedes iniciar la captura facial.`);
    }catch(cause){
      setLocationVerified(false);
      setLocationEvidence(null);
      setError(cause instanceof Error?cause.message:"No fue posible validar la ubicación del enrolamiento.");
    }finally{
      setBusy(false);
    }
  }

  async function enroll(){
    if(!selected){setError("Selecciona la persona que está físicamente presente.");return;}
    if(!siteId){setError("Selecciona la sede donde se realiza el enrolamiento.");return;}
    if(!locationVerified||!locationEvidence){setError("Primero valida por GPS que estás físicamente en la sede de enrolamiento.");return;}
    if(!identityChecked){setError("Confirma que verificaste visualmente la identidad de la persona.");return;}
    if(!consent){setError("La persona debe autorizar el uso de la plantilla facial.");return;}

    setBusy(true);setError("");setMessage("");
    try{
      await ensureCamera();
      if(!humanRef.current)humanRef.current=await loadBiometricEngine();
      const face=await captureLiveFace({
        human:humanRef.current,
        video:videoRef.current as HTMLVideoElement,
        livenessThreshold,
        samples:3,
      });

      const response=await fetch("/api/attendance/enrollment-supervised",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          userId:selected.id,
          siteId,
          embedding:face.embedding,
          live:face.live,
          real:face.real,
          latitude:locationEvidence.latitude,
          longitude:locationEvidence.longitude,
          accuracy:locationEvidence.accuracy,
          consent:true,
          identityChecked:true,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible completar el enrolamiento.");

      setStatusByUser(previous=>({...previous,[selected.id]:"verified"}));
      setMessage(`Biometría verificada para ${selected.full_name}. El usuario ya puede validar presencia en campo.`);
      setConsent(false);
      setIdentityChecked(false);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible completar el enrolamiento.");
    }finally{
      stopCamera();
      setBusy(false);
    }
  }

  async function revoke(){
    if(!selected){setError("Selecciona la persona.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/attendance/enrollment-supervised",{
        method:"DELETE",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({organizationId,userId:selected.id,reason:"Revocación administrativa desde Asistencia"}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible revocar la biometría.");
      setStatusByUser(previous=>({...previous,[selected.id]:"revoked"}));
      setMessage(`Biometría revocada para ${selected.full_name}.`);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible revocar la biometría.");
    }finally{
      setBusy(false);
    }
  }

  return <section className="card section biometric-supervisor-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Identidad biométrica</span>
        <h2>Enrolamiento supervisado</h2>
        <p className="muted">El responsable verifica a la persona físicamente presente, confirma su identidad y registra el rostro en vivo. No se admite autoenrolamiento.</p>
      </div>
    </div>

    <div className="biometric-supervisor-grid">
      <div className="biometric-supervisor-form">
        <div className="field">
          <label>Persona *</label>
          <select value={userId} onChange={event=>{setUserId(event.target.value);setMessage("");setError("");}} required>
            <option value="">Selecciona usuario</option>
            {people.map(person=><option key={person.id} value={person.id} disabled={!person.has_avatar}>{person.full_name} · {person.role}{!person.has_avatar?" · Sin foto de perfil":""}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Sede de enrolamiento *</label>
          <select value={siteId} onChange={event=>{setSiteId(event.target.value);setLocationVerified(false);setLocationEvidence(null);setMessage("");setError("");}} required>
            <option value="">Selecciona sede</option>
            {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}</option>)}
          </select>
        </div>

        <div className="biometric-enrollment-location-check">
          <Button variant="secondary" disabled={busy||!selectedSite} onClick={verifyEnrollmentLocation} iconLeft={locationVerified?"check":"location"}>
            {locationVerified?"Ubicación verificada":"Verificar presencia en la sede"}
          </Button>
          {locationVerified&&locationEvidence&&<small>GPS ±{Math.round(locationEvidence.accuracy)} m · distancia {Math.round(locationEvidence.distance)} m</small>}
        </div>

        {selected&&<div className="biometric-person-card">
          <div className="biometric-person-avatar">
            {selected.has_avatar?<img src={`/api/users/${selected.id}/avatar`} alt={`Foto de ${selected.full_name}`} />:<span>{selected.full_name.slice(0,2).toUpperCase()}</span>}
          </div>
          <div>
            <strong>{selected.full_name}</strong>
            <small>{selected.email}</small>
            <Badge variant={selectedStatus==="verified"?"success":selectedStatus==="revoked"?"danger":selectedStatus==="legacy"?"warning":"neutral"} icon="attendance">
              {selectedStatus==="verified"?"Biometría verificada":selectedStatus==="legacy"?"Requiere reenrolamiento":selectedStatus==="revoked"?"Revocada":"Sin biometría"}
            </Badge>
          </div>
        </div>}

        <label className="attendance-consent">
          <input type="checkbox" checked={identityChecked} onChange={event=>setIdentityChecked(event.target.checked)} />
          <span><strong>Verifiqué visualmente que la persona presente corresponde al usuario seleccionado.</strong><small>La foto de perfil es apoyo visual para el supervisor, no es la plantilla biométrica.</small></span>
        </label>

        <label className="attendance-consent">
          <input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} />
          <span><strong>La persona autoriza el tratamiento de su plantilla facial para control de presencia.</strong><small>La plantilla se almacena cifrada; la fotografía de la cámara no se conserva.</small></span>
        </label>

        <div className="form-actions">
          <Button variant="secondary" disabled={busy||!selected} onClick={revoke} iconLeft="power">Revocar biometría</Button>
          <Button disabled={busy||!selected||!locationVerified} loading={busy} onClick={enroll} iconLeft="user">Activar cámara y enrolar</Button>
        </div>

        {message&&<Alert variant="success" title="Biometría actualizada">{message}</Alert>}
        {error&&<Alert variant="danger" title="No fue posible completar el enrolamiento">{error}</Alert>}
      </div>

      <div className="attendance-camera-card biometric-supervisor-camera">
        <div className="attendance-camera-stage">
          <video ref={videoRef} playsInline muted className={cameraReady?"ready":""}/>
          <div className="attendance-face-guide" aria-hidden="true"/>
          {!cameraReady&&<div className="attendance-camera-placeholder"><span><UiIcon name="user" size={24}/></span><strong>Persona físicamente presente</strong><small>La cámara se activa únicamente al iniciar el enrolamiento supervisado.</small></div>}
        </div>
      </div>
    </div>
  </section>;
}
