"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import SupervisedBiometricEnrollment from "@/components/SupervisedBiometricEnrollment";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";

export type BiometricAdminPerson={
  id:string;
  full_name:string;
  email:string;
  role:string;
  has_avatar:boolean;
  biometric_status:"verified"|"legacy"|"revoked"|"missing";
  request_id:string|null;
  request_status:"pending"|"approved"|"rejected"|"cancelled"|"expired"|null;
  request_site_name:string|null;
  request_requested_at:string|null;
  request_review_note:string|null;
};

type Site={
  id:string;
  name:string;
  city:string|null;
  latitude:number|null;
  longitude:number|null;
  geofenceRadius:number;
};

function effectiveStatus(person:BiometricAdminPerson){
  if(person.biometric_status==="verified")return "verified";
  if(person.request_status==="pending")return "pending";
  if(person.request_status==="rejected")return "rejected";
  if(person.request_status==="expired")return "expired";
  if(person.biometric_status==="revoked")return "revoked";
  if(person.biometric_status==="legacy")return "legacy";
  return "missing";
}

function statusLabel(status:string){
  const labels:Record<string,string>={
    verified:"Verificada",
    pending:"Pendiente aprobación",
    rejected:"Rechazada",
    expired:"Expirada",
    revoked:"Revocada",
    legacy:"Reenrolamiento",
    missing:"Sin enrolar",
  };
  return labels[status]||status;
}

function statusVariant(status:string):"success"|"warning"|"danger"|"neutral"|"info"{
  if(status==="verified")return "success";
  if(status==="pending")return "warning";
  if(status==="rejected"||status==="revoked")return "danger";
  if(status==="legacy"||status==="expired")return "info";
  return "neutral";
}

export default function BiometricEnrollmentAdmin({
  organizationId,
  people,
  sites,
  livenessThreshold,
  initialUserId="",
}:{
  organizationId:string;
  people:BiometricAdminPerson[];
  sites:Site[];
  livenessThreshold:number;
  initialUserId?:string;
}){
  const router=useRouter();
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [busyId,setBusyId]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [showAssisted,setShowAssisted]=useState(false);

  const counts=useMemo(()=>{
    const values={verified:0,pending:0,attention:0,total:people.length};
    for(const person of people){
      const status=effectiveStatus(person);
      if(status==="verified")values.verified+=1;
      else if(status==="pending")values.pending+=1;
      else values.attention+=1;
    }
    return values;
  },[people]);

  const pending=useMemo(()=>people.filter(person=>effectiveStatus(person)==="pending"),[people]);

  const filtered=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase("es");
    return people.filter(person=>{
      const status=effectiveStatus(person);
      if(filter!=="all"&&filter!==status)return false;
      if(!needle)return true;
      return [person.full_name,person.email,person.role,statusLabel(status),person.request_site_name||""]
        .some(value=>value.toLocaleLowerCase("es").includes(needle));
    });
  },[people,search,filter]);

  async function decide(person:BiometricAdminPerson,decision:"approve"|"reject"){
    if(!person.request_id)return;
    if(decision==="reject"&&!notes[person.request_id]?.trim()){
      setError("Escribe un motivo antes de rechazar la solicitud.");
      return;
    }
    setBusyId(person.request_id);setError("");setMessage("");
    try{
      const response=await fetch("/api/attendance/enrollment-requests/"+encodeURIComponent(person.request_id),{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          organizationId,
          decision,
          note:notes[person.request_id]||"",
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible revisar la solicitud biométrica.");
      setMessage(payload.message||"Solicitud actualizada.");
      router.refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible revisar la solicitud biométrica.");
    }finally{
      setBusyId("");
    }
  }

  return <div className="biometric-admin-center">
    <div className="biometric-admin-head">
      <div>
        <span className="eyebrow">Cobertura biométrica</span>
        <h3>Identidades verificadas y solicitudes pendientes</h3>
        <p>La aprobación humana ocurre una sola vez. Después de verificar la identidad, las marcaciones diarias funcionan automáticamente con rostro en vivo y geocerca.</p>
      </div>
      <Button variant="secondary" iconLeft="user" onClick={()=>setShowAssisted(value=>!value)}>
        {showAssisted?"Ocultar enrolamiento asistido":"Enrolamiento asistido excepcional"}
      </Button>
    </div>

    <MetricGrid className="biometric-admin-kpis">
      <KpiCard label="Personal controlado" value={String(counts.total)} hint="visible en tu alcance" icon="user"/>
      <KpiCard label="Biometría verificada" value={String(counts.verified)} hint="marcación automática habilitada" icon="check" tone="success"/>
      <KpiCard label="Pendiente aprobación" value={String(counts.pending)} hint="requiere una decisión humana" icon="clock" tone={counts.pending?"warning":"default"}/>
      <KpiCard label="Requiere atención" value={String(counts.attention)} hint="sin enrolar, revocada o reintento" icon="warning" tone={counts.attention?"warning":"default"}/>
    </MetricGrid>

    {counts.pending>0&&<Alert variant="warning" title={counts.pending+" solicitud(es) esperando aprobación"}>Trabaja esta cola por excepción. No necesitas revisar a quienes ya aparecen como Biometría verificada.</Alert>}
    {message&&<Alert variant="success" title="Biometría actualizada">{message}</Alert>}
    {error&&<Alert variant="danger" title="No fue posible completar la revisión">{error}</Alert>}

    <section className="biometric-approval-queue">
      <div className="section-heading compact">
        <div><span className="eyebrow">Aprobación única</span><h3>Solicitudes pendientes</h3></div>
        <Badge variant={pending.length?"warning":"success"} icon={pending.length?"clock":"check"}>{pending.length} pendiente(s)</Badge>
      </div>

      {pending.length?<div className="biometric-approval-list">
        {pending.map(person=><article className="biometric-approval-card" key={person.request_id||person.id}>
          <div className="biometric-approval-identity">
            <div className="biometric-approval-images">
              <figure>
                {person.has_avatar?<img src={"/api/users/"+person.id+"/avatar"} alt={"Foto de perfil de "+person.full_name}/>:<span>{person.full_name.slice(0,2).toUpperCase()}</span>}
                <figcaption>Foto de perfil</figcaption>
              </figure>
              <figure>
                {person.request_id
                  ?<img src={"/api/attendance/enrollment-requests/"+person.request_id+"/preview?organization_id="+encodeURIComponent(organizationId)} alt={"Vista temporal del enrolamiento de "+person.full_name}/>
                  :<span>—</span>}
                <figcaption>Captura temporal en vivo</figcaption>
              </figure>
            </div>
            <div>
              <strong>{person.full_name}</strong>
              <small>{person.email} · {person.role}</small>
              <Badge variant="warning" icon="clock">Pendiente aprobación</Badge>
              <p>{person.request_site_name||"Sede no disponible"} · {person.request_requested_at?new Date(person.request_requested_at).toLocaleString("es-CO"):"Sin fecha"}</p>
            </div>
          </div>

          <div className="biometric-approval-review">
            <Alert variant="info" title="Qué estás aprobando">Confirma que la captura temporal corresponde a la persona del perfil. El sistema ya validó geocerca, política aceptada, prueba de vida y anti-suplantación antes de crear esta solicitud.</Alert>
            <div className="field">
              <label htmlFor={"bio-note-"+person.request_id}>Nota de revisión</label>
              <textarea
                id={"bio-note-"+person.request_id}
                rows={3}
                maxLength={1000}
                value={notes[person.request_id||""]||""}
                onChange={event=>setNotes(previous=>({...previous,[person.request_id||""]:event.target.value}))}
                placeholder="Opcional al aprobar; obligatoria al rechazar."
              />
            </div>
            <div className="form-actions">
              <Button
                variant="danger"
                disabled={busyId===person.request_id}
                onClick={()=>void decide(person,"reject")}
              >Rechazar</Button>
              <Button
                loading={busyId===person.request_id}
                onClick={()=>void decide(person,"approve")}
                iconLeft="check"
              >Aprobar identidad</Button>
            </div>
          </div>
        </article>)}
      </div>:<EmptyState icon="file" title="Sin solicitudes pendientes" description="Cuando un empleado complete el enrolamiento desde su celular aparecerá aquí para una única validación de identidad."/>}
    </section>

    <section className="biometric-roster">
      <div className="section-heading compact">
        <div><span className="eyebrow">Cobertura del personal</span><h3>Quién ya lo tiene y quién falta</h3></div>
      </div>
      <div className="biometric-roster-filters">
        <div className="field"><label htmlFor="biometric-roster-search">Buscar</label><input id="biometric-roster-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nombre, correo, rol o sede"/></div>
        <div className="field"><label htmlFor="biometric-roster-filter">Estado</label><select id="biometric-roster-filter" value={filter} onChange={event=>setFilter(event.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="verified">Verificada</option>
          <option value="pending">Pendiente aprobación</option>
          <option value="missing">Sin enrolar</option>
          <option value="legacy">Reenrolamiento</option>
          <option value="rejected">Rechazada</option>
          <option value="expired">Expirada</option>
          <option value="revoked">Revocada</option>
        </select></div>
      </div>

      <div className="biometric-roster-list">
        {filtered.slice(0,300).map(person=>{
          const status=effectiveStatus(person);
          return <article key={person.id}>
            <div className="biometric-roster-avatar">{person.has_avatar?<img src={"/api/users/"+person.id+"/avatar"} alt=""/>:<span>{person.full_name.slice(0,2).toUpperCase()}</span>}</div>
            <div><strong>{person.full_name}</strong><small>{person.email} · {person.role}</small>{person.request_review_note&&status==="rejected"&&<small>Motivo: {person.request_review_note}</small>}</div>
            <Badge variant={statusVariant(status)} icon={status==="verified"?"check":status==="pending"?"clock":"attendance"}>{statusLabel(status)}</Badge>
          </article>;
        })}
      </div>
      {filtered.length>300&&<Alert variant="info" title="Vista limitada para rendimiento">Hay {filtered.length} coincidencias. Usa la búsqueda o el filtro de estado para acotar la lista; se muestran las primeras 300.</Alert>}
    </section>

    {showAssisted&&<section className="biometric-assisted-fallback">
      <Alert variant="info" title="Flujo excepcional">Este enrolamiento asistido conserva el mecanismo anterior para recuperación, soporte o casos donde el empleado no pueda completar el proceso desde su propio dispositivo. No es el flujo operativo masivo.</Alert>
      <SupervisedBiometricEnrollment
        people={people.map(person=>({
          id:person.id,
          full_name:person.full_name,
          email:person.email,
          role:person.role,
          has_avatar:person.has_avatar,
          biometric_status:person.biometric_status,
        }))}
        sites={sites}
        livenessThreshold={livenessThreshold}
        organizationId={organizationId}
        initialUserId={initialUserId}
      />
    </section>}
  </div>;
}
