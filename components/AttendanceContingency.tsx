"use client";

import { useEffect, useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";

// ── Shared contingency contracts ─────────────────────────────────────────────

export type ContingencyRequestView = {
  id:string;
  site_id:string;
  site_name:string;
  action:"check_in"|"check_out";
  reason_code:string;
  details:string;
  status:"pending"|"approved"|"rejected"|"used"|"expired"|"cancelled";
  requested_at:string;
  approved_until:string|null;
  review_note:string|null;
};

export type ContingencyReviewItem = ContingencyRequestView & {
  user_id:string;
  full_name:string;
  role:string;
  requester_accuracy_m:number|null;
  requester_latitude:number|null;
  requester_longitude:number|null;
};

type Site={id:string;name:string;city:string|null};

const REASONS=[
  {value:"camera_failure",label:"La cámara o verificación facial falla"},
  {value:"gps_unavailable",label:"GPS / ubicación no disponible"},
  {value:"gps_accuracy",label:"Precisión GPS insuficiente"},
  {value:"geofence_mismatch",label:"Estoy en sitio pero aparezco fuera del rango"},
  {value:"connectivity",label:"Problema de conectividad"},
  {value:"device_issue",label:"Problema del dispositivo"},
  {value:"other",label:"Otro incidente operativo"},
] as const;

function reasonLabel(code:string){
  return REASONS.find(item=>item.value===code)?.label||code;
}

function actionLabel(action:"check_in"|"check_out"){
  return action==="check_in"?"Inicio de actividades":"Finalización de actividades";
}

// ── Field-user request / approved-use workflow ──────────────────────────────

export function AttendanceContingencySelf({
  sites,
  openShift,
  initialRequest,
}:{
  sites:Site[];
  openShift:{site_id:string;site_name:string}|null;
  initialRequest:ContingencyRequestView|null;
}){
  const [active,setActive]=useState(initialRequest);
  const [effectiveOpenShift,setEffectiveOpenShift]=useState(openShift);
  const [siteId,setSiteId]=useState(openShift?.site_id||sites[0]?.id||"");
  const [reason,setReason]=useState("camera_failure");
  const [details,setDetails]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const action:"check_in"|"check_out"=effectiveOpenShift?"check_out":"check_in";

  useEffect(()=>{
    function onShiftChanged(event:Event){
      const detail=(event as CustomEvent<{action:"check_in"|"check_out";shift:{site_id:string;site_name:string}|null}>).detail;
      if(!detail)return;
      setEffectiveOpenShift(detail.shift);
      if(detail.shift)setSiteId(detail.shift.site_id);
    }
    window.addEventListener("attendance:shift-changed",onShiftChanged);
    return()=>window.removeEventListener("attendance:shift-changed",onShiftChanged);
  },[]);

  useEffect(()=>{
    if(!active||active.status!=="pending")return;
    const timer=window.setInterval(async()=>{
      try{
        const response=await fetch("/api/attendance/contingency",{headers:{Accept:"application/json"}});
        if(!response.ok)return;
        const data=await response.json();
        setActive(data.request||null);
      }catch{
        // Polling is convenience only; manual refresh remains available.
      }
    },12000);
    return()=>window.clearInterval(timer);
  },[active?.id,active?.status]);

  async function optionalLocation(){
    if(!navigator.geolocation)return null;
    return new Promise<{latitude:number;longitude:number;accuracy:number}|null>(resolve=>{
      navigator.geolocation.getCurrentPosition(
        position=>resolve({
          latitude:position.coords.latitude,
          longitude:position.coords.longitude,
          accuracy:position.coords.accuracy,
        }),
        ()=>resolve(null),
        {enableHighAccuracy:true,timeout:5000,maximumAge:0},
      );
    });
  }

  async function submit(){
    if(!siteId){setError("Selecciona la sede relacionada con el incidente.");return;}
    if(details.trim().length<8){setError("Describe brevemente qué ocurrió.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const location=await optionalLocation();
      const response=await fetch("/api/attendance/contingency",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          siteId,
          action,
          reasonCode:reason,
          details:details.trim(),
          latitude:location?.latitude,
          longitude:location?.longitude,
          accuracy:location?.accuracy,
          diagnostic:{
            online:navigator.onLine,
            geolocationAvailable:Boolean(navigator.geolocation),
            capturedAt:new Date().toISOString(),
          },
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible crear la solicitud.");
      setActive({
        id:data.request.id,
        site_id:siteId,
        site_name:sites.find(site=>site.id===siteId)?.name||"Sede",
        action,
        reason_code:reason,
        details:details.trim(),
        status:"pending",
        requested_at:data.request.requested_at,
        approved_until:null,
        review_note:null,
      });
      setDetails("");
      setMessage("Solicitud enviada. Un supervisor debe revisarla antes de que puedas usar la contingencia.");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible crear la solicitud.");
    }finally{
      setBusy(false);
    }
  }

  async function useApproved(){
    if(!active||active.status!=="approved")return;
    setBusy(true);setError("");setMessage("");
    try{
      const location=await optionalLocation();
      const response=await fetch("/api/attendance/contingency/use",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          requestId:active.id,
          latitude:location?.latitude,
          longitude:location?.longitude,
          accuracy:location?.accuracy,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible usar la autorización.");
      setMessage(active.action==="check_in"
        ?"Presencia iniciada por contingencia aprobada. El registro quedó identificado como excepcional."
        :"Salida registrada por contingencia aprobada.");
      setActive(null);
      window.setTimeout(()=>window.location.reload(),650);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible usar la contingencia.");
    }finally{
      setBusy(false);
    }
  }

  const expires=useMemo(()=>active?.approved_until?new Date(active.approved_until):null,[active?.approved_until]);

  return <section className="card section attendance-contingency-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Ruta excepcional</span>
        <h2>Contingencia de validación</h2>
        <p className="muted">Úsala solo cuando una falla técnica impida el registro normal. No reemplaza el enrolamiento biométrico y requiere aprobación del supervisor.</p>
      </div>
    </div>

    {active ? <div className={"contingency-active-state "+active.status}>
      <div className="contingency-active-icon" aria-hidden="true"><UiIcon name={active.status==="approved"?"check":"clock"} size={18}/></div>
      <div>
        <span>{actionLabel(active.action)}</span>
        <strong>{active.status==="approved"?"Autorización aprobada":"Esperando revisión"}</strong>
        <small>{active.site_name} · {reasonLabel(active.reason_code)}</small>
        {active.status==="approved"&&expires&&<small>Vence: {expires.toLocaleString("es-CO")}</small>}
        {active.review_note&&<small>Nota del supervisor: {active.review_note}</small>}
      </div>
      {active.status==="approved"&&<Button loading={busy} onClick={useApproved} iconLeft="attendance">{active.action==="check_in"?"Iniciar por contingencia":"Finalizar por contingencia"}</Button>}
    </div> : <div className="contingency-request-form">
      <div className="field">
        <label>Evento afectado</label>
        <input value={actionLabel(action)} readOnly/>
      </div>
      <div className="field">
        <label>Sede *</label>
        <select value={siteId} onChange={event=>setSiteId(event.target.value)} disabled={Boolean(effectiveOpenShift)}>
          <option value="">Selecciona sede</option>
          {sites.map(site=><option key={site.id} value={site.id}>{site.name}{site.city?" · "+site.city:""}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Motivo *</label>
        <select value={reason} onChange={event=>setReason(event.target.value)}>
          {REASONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="field form-span-2">
        <label>¿Qué ocurrió? *</label>
        <textarea value={details} onChange={event=>setDetails(event.target.value)} maxLength={1000} placeholder="Describe el problema y cualquier contexto útil para que el supervisor pueda validarlo."/>
      </div>
      <div className="contingency-warning form-span-2"><span aria-hidden="true"><UiIcon name="warning" size={16}/></span><p><strong>Una contingencia queda auditada.</strong><small>El supervisor verá usuario, sede, motivo, hora y la información técnica disponible. La autorización vence y solo sirve para un registro.</small></p></div>
      <Button className="form-span-2" loading={busy} onClick={submit} iconLeft="warning">Solicitar contingencia</Button>
    </div>}

    {message&&<Alert variant="success" title="Contingencia actualizada">{message}</Alert>}
    {error&&<Alert variant="danger" title="No fue posible completar la contingencia">{error}</Alert>}
  </section>;
}

// ── Supervisor review queue ─────────────────────────────────────────────────

export function AttendanceContingencyReview({requests,organizationId}:{requests:ContingencyReviewItem[];organizationId:string}){
  const [items,setItems]=useState(requests);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [busyId,setBusyId]=useState("");
  const [reviewError,setReviewError]=useState("");

  async function decide(id:string,decision:"approve"|"reject"){
    setBusyId(id);
    setReviewError("");
    try{
      const response=await fetch(`/api/attendance/contingency/${id}`,{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          organizationId,
          decision,
          note:notes[id]||"",
          minutes:30,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible revisar la solicitud.");
      setItems(current=>current.filter(item=>item.id!==id));
    }catch(cause){
      setReviewError(cause instanceof Error?cause.message:"No fue posible revisar la solicitud.");
    }finally{
      setBusyId("");
    }
  }

  return <section className="card section attendance-contingency-review">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Supervisión</span>
        <h2>Contingencias pendientes</h2>
        <p className="muted">La aprobación crea una autorización de 30 minutos y un solo uso. Revisa que el incidente sea coherente antes de aprobar.</p>
      </div>
      <Badge variant={items.length?"warning":"success"}>{items.length} pendientes</Badge>
    </div>
    {reviewError&&<Alert variant="danger" title="No fue posible revisar la contingencia">{reviewError}</Alert>}

    {items.length===0 ? <EmptyState icon="file" title="No hay contingencias pendientes" description="Las nuevas solicitudes aparecerán aquí para su revisión."/> :
      <div className="contingency-review-list">
        {items.map(item=><article key={item.id} className="contingency-review-item">
          <div className="contingency-review-head">
            <div>
              <span>{item.role}</span>
              <strong>{item.full_name}</strong>
              <small>{item.site_name} · {actionLabel(item.action)}</small>
            </div>
            <time>{new Date(item.requested_at).toLocaleString("es-CO")}</time>
          </div>
          <div className="contingency-review-reason">
            <strong>{reasonLabel(item.reason_code)}</strong>
            <p>{item.details}</p>
          </div>
          <div className="contingency-review-diagnostic">
            <span>GPS reportado</span>
            <strong>{item.requester_accuracy_m!==null?`±${Math.round(item.requester_accuracy_m)} m`:"No disponible"}</strong>
          </div>
          <div className="field">
            <label>Nota de revisión</label>
            <input value={notes[item.id]||""} onChange={event=>setNotes(current=>({...current,[item.id]:event.target.value}))} placeholder="Opcional: motivo o instrucción para el usuario"/>
          </div>
          <div className="form-actions">
            <Button variant="secondary" disabled={busyId===item.id} onClick={()=>decide(item.id,"reject")} iconLeft="x">Rechazar</Button>
            <Button disabled={busyId===item.id} loading={busyId===item.id} onClick={()=>decide(item.id,"approve")} iconLeft="check">Aprobar 30 min</Button>
          </div>
        </article>)}
      </div>}
  </section>;
}
