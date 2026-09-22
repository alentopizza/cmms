"use client";

import { useEffect, useRef, useState } from "react";
import { captureLiveFace, loadBiometricEngine } from "@/lib/client-biometric";

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
};

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
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const selected=people.find(person=>person.id===userId)||null;

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

  async function enroll(){
    if(!selected){setError("Selecciona la persona que está físicamente presente.");return;}
    if(!siteId){setError("Selecciona la sede donde se realiza el enrolamiento.");return;}
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
          consent:true,
          identityChecked:true,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible completar el enrolamiento.");

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
        body:JSON.stringify({userId:selected.id,reason:"Revocación administrativa desde Asistencia"}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible revocar la biometría.");
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
            {people.map(person=><option key={person.id} value={person.id}>{person.full_name} · {person.role}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Sede de enrolamiento *</label>
          <select value={siteId} onChange={event=>setSiteId(event.target.value)} required>
            <option value="">Selecciona sede</option>
            {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}</option>)}
          </select>
        </div>

        {selected&&<div className="biometric-person-card">
          <div className="biometric-person-avatar">
            {selected.has_avatar?<img src={`/api/users/${selected.id}/avatar`} alt={`Foto de ${selected.full_name}`} />:<span>{selected.full_name.slice(0,2).toUpperCase()}</span>}
          </div>
          <div>
            <strong>{selected.full_name}</strong>
            <small>{selected.email}</small>
            <span className={"status-badge "+(selected.biometric_status==="verified"?"status-active":"")}>
              {selected.biometric_status==="verified"?"Biometría verificada":selected.biometric_status==="legacy"?"Requiere reenrolamiento":selected.biometric_status==="revoked"?"Revocada":"Sin biometría"}
            </span>
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
          <button className="button secondary" type="button" disabled={busy||!selected} onClick={revoke}>Revocar biometría</button>
          <button className="button" type="button" disabled={busy||!selected} onClick={enroll}>{busy?"Procesando…":"Activar cámara y enrolar"}</button>
        </div>

        {message&&<div className="notice success">{message}</div>}
        {error&&<div className="notice error">{error}</div>}
      </div>

      <div className="attendance-camera-card biometric-supervisor-camera">
        <div className="attendance-camera-stage">
          <video ref={videoRef} playsInline muted className={cameraReady?"ready":""}/>
          <div className="attendance-face-guide" aria-hidden="true"/>
          {!cameraReady&&<div className="attendance-camera-placeholder"><span>◎</span><strong>Persona físicamente presente</strong><small>La cámara se activa únicamente al iniciar el enrolamiento supervisado.</small></div>}
        </div>
      </div>
    </div>
  </section>;
}
