"use client";

import { useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";

type Site={
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofenceRadius:number;
  geofenceConfigured:boolean;
};

type DestinationTask={
  id:string;
  site_id:string;
  site_name:string;
  label:string;
  status:string;
};

export type AttendanceMovementSegment={
  id:string;
  segment_type:"site"|"travel";
  site_id:string|null;
  site_name:string|null;
  from_site_id:string|null;
  from_site_name:string|null;
  to_site_id:string|null;
  to_site_name:string|null;
  destination_task_id:string|null;
  destination_task_label:string|null;
  tracking_session_id:string|null;
  started_at:string;
};

type GpsFix={latitude:number;longitude:number;accuracy:number};

function rawPosition(){
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

export default function AttendanceMovement({
  currentSegment,
  sites,
  tasks,
  requireGeolocation,
  maxLocationAccuracy,
}:{
  currentSegment:AttendanceMovementSegment;
  sites:Site[];
  tasks:DestinationTask[];
  requireGeolocation:boolean;
  maxLocationAccuracy:number;
}){
  const [destinationId,setDestinationId]=useState("");
  const [taskId,setTaskId]=useState("");
  const [notes,setNotes]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const inTransit=currentSegment.segment_type==="travel";
  const currentSiteId=inTransit?currentSegment.from_site_id:currentSegment.site_id;
  const destinations=useMemo(
    ()=>sites.filter(site=>site.id!==currentSiteId),
    [sites,currentSiteId],
  );
  const destinationTasks=useMemo(
    ()=>tasks.filter(task=>task.site_id===destinationId),
    [tasks,destinationId],
  );

  async function locationEvidence():Promise<GpsFix|null>{
    if(!requireGeolocation)return null;
    const position=await rawPosition();
    if(position.coords.accuracy>maxLocationAccuracy){
      throw new Error(`La precisión GPS actual es de ${Math.round(position.coords.accuracy)} m. Se requieren ${maxLocationAccuracy} m o menos.`);
    }
    return{
      latitude:position.coords.latitude,
      longitude:position.coords.longitude,
      accuracy:position.coords.accuracy,
    };
  }

  async function submit(action:"start_travel"|"arrive"){
    if(action==="start_travel"&&!destinationId){
      setError("Selecciona la sede a la que te vas a desplazar.");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const fix=await locationEvidence();
      const response=await fetch("/api/attendance/movement",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action,
          toSiteId:action==="start_travel"?destinationId:undefined,
          destinationTaskId:action==="start_travel"&&taskId?taskId:undefined,
          notes:action==="start_travel"?notes.trim():undefined,
          latitude:fix?.latitude,
          longitude:fix?.longitude,
          accuracy:fix?.accuracy,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"No fue posible registrar el desplazamiento.");
      setMessage(action==="start_travel"
        ?`Desplazamiento iniciado hacia ${data.toSite?.name||"la sede de destino"}.`
        :`Llegada registrada en ${data.site?.name||"la sede de destino"}.`);
      window.setTimeout(()=>window.location.reload(),650);
    }catch(cause){
      const geoCode=typeof cause==="object"&&cause!==null&&"code" in cause?Number((cause as{code?:unknown}).code):null;
      if(geoCode===1)setError("La ubicación está bloqueada. Autoriza la ubicación precisa para registrar el desplazamiento.");
      else if(geoCode===2||geoCode===3)setError("No fue posible obtener una ubicación precisa. Activa el GPS y vuelve a intentarlo.");
      else setError(cause instanceof Error?cause.message:"No fue posible registrar el desplazamiento.");
    }finally{
      setBusy(false);
    }
  }

  if(inTransit){
    return <section className="card section attendance-movement-card in-transit">
      <div className="attendance-movement-status">
        <span className="attendance-movement-icon" aria-hidden="true"><UiIcon name="reaction" size={20}/></span>
        <div>
          <span className="eyebrow">Desplazamiento en curso</span>
          <h2>{currentSegment.from_site_name||"Origen"} → {currentSegment.to_site_name||"Destino"}</h2>
          <p>Iniciado {new Date(currentSegment.started_at).toLocaleString("es-CO")}. La jornada sigue abierta mientras te desplazas.</p>
        </div>
        <Badge variant="warning" icon="reaction">En tránsito</Badge>
      </div>

      <div className="attendance-movement-evidence">
        <div><span>Destino</span><strong>{currentSegment.to_site_name||"Sede"}</strong></div>
        <div><span>Actividad destino</span><strong>{currentSegment.destination_task_label||"Sin actividad vinculada"}</strong></div>
        <div><span>Trayecto Reacción</span><strong>{currentSegment.tracking_session_id?"Correlacionado":"Sin sesión activa al salir"}</strong></div>
      </div>

      <div className="attendance-movement-note">
        <UiIcon name="info" size={16}/>
        <p><strong>Registra la llegada antes de continuar.</strong><span>La llegada valida la geocerca de destino cuando la empresa exige GPS y habilita esa sede como ubicación actual de la jornada.</span></p>
      </div>

      <Button loading={busy} iconLeft="location" onClick={()=>submit("arrive")}>Registrar llegada a {currentSegment.to_site_name||"destino"}</Button>
      {message&&<Alert variant="success" title="Desplazamiento actualizado">{message}</Alert>}
      {error&&<Alert variant="danger" title="No fue posible registrar la llegada">{error}</Alert>}
    </section>;
  }

  return <section className="card section attendance-movement-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Desplazamientos</span>
        <h2>Cambiar de sede dentro de la misma jornada</h2>
        <p className="muted">Sal de {currentSegment.site_name||"la sede actual"} hacia otra sede autorizada sin cerrar tu jornada. Al llegar deberás registrar la llegada.</p>
      </div>
      <Badge variant="success" icon="location">{currentSegment.site_name||"En sede"}</Badge>
    </div>

    <div className="attendance-movement-form">
      <div className="field">
        <label>Sede de destino *</label>
        <select value={destinationId} onChange={event=>{setDestinationId(event.target.value);setTaskId("");}}>
          <option value="">Selecciona destino</option>
          {destinations.map(site=><option key={site.id} value={site.id} disabled={requireGeolocation&&!site.geofenceConfigured}>{site.name}{site.city?" · "+site.city:""}{requireGeolocation&&!site.geofenceConfigured?" · Sin geocerca":""}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Actividad en destino</label>
        <select value={taskId} onChange={event=>setTaskId(event.target.value)} disabled={!destinationId}>
          <option value="">Sin actividad vinculada</option>
          {destinationTasks.map(task=><option key={task.id} value={task.id}>{task.label}</option>)}
        </select>
      </div>
      <div className="field form-span-2">
        <label>Nota de desplazamiento</label>
        <textarea value={notes} onChange={event=>setNotes(event.target.value)} maxLength={500} placeholder="Opcional: motivo, atención programada, contingencia o contexto del traslado."/>
      </div>
      <div className="attendance-movement-note form-span-2">
        <UiIcon name="reaction" size={16}/>
        <p><strong>Asistencia registra salida y llegada; Reacción conserva el trayecto cuando está conectado.</strong><span>No se cierra la jornada ni se crea otra asistencia. El destino pasa a ser tu sede actual después de validar la llegada.</span></p>
      </div>
      <div className="form-span-2 form-actions">
        <Button loading={busy} disabled={!destinationId} iconLeft="reaction" onClick={()=>submit("start_travel")}>Iniciar desplazamiento</Button>
      </div>
    </div>
    {message&&<Alert variant="success" title="Desplazamiento actualizado">{message}</Alert>}
    {error&&<Alert variant="danger" title="No fue posible iniciar el desplazamiento">{error}</Alert>}
  </section>;
}
