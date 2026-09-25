"use client";

import { useEffect, useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Button } from "@/components/ui-kit/Button";
import { Alert, EmptyState, Spinner } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { Tabs } from "@/components/ui-kit/Navigation";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import type { AttendanceOperationalReport, AttendanceReportDailyRow } from "@/lib/attendance-report";

const ROLE_LABELS:Record<string,string>={
  admin:"Administrador",
  manager:"Manager / Supervisor",
  technician:"Técnico",
  provider:"Proveedor de servicios",
  external:"Colaborador externo",
};

function hours(minutes:number|null|undefined){
  if(minutes===null||minutes===undefined)return "—";
  return (minutes/60).toFixed(1)+" h";
}

function variance(minutes:number|null){
  if(minutes===null)return "Sin comparación";
  const prefix=minutes>0?"+":"";
  return prefix+(minutes/60).toFixed(1)+" h";
}

function dateLabel(value:string){
  const date=new Date(value+"T12:00:00Z");
  return Number.isFinite(date.getTime())
    ?date.toLocaleDateString("es-CO",{dateStyle:"medium",timeZone:"UTC"})
    :value;
}

function scheduleLabel(row:AttendanceReportDailyRow){
  if(row.scheduleState==="none")return "Sin jornada individual";
  if(row.scheduleState==="day_off")return "Día no programado";
  return [row.plannedSiteName,row.scheduledStart&&row.scheduledEnd?row.scheduledStart+"–"+row.scheduledEnd:null].filter(Boolean).join(" · ");
}

function routeLabel(row:AttendanceReportDailyRow){
  const origin=row.originSites.join(" / ");
  const final=row.finalSites.join(" / ");
  if(!origin&&!final)return "Sin marcación";
  if(origin&&final&&origin!==final)return origin+" → "+final;
  return origin||final;
}

function exportHref(report:AttendanceOperationalReport,format:"xlsx"|"csv"|"pdf"){
  const params=new URLSearchParams({
    organization_id:report.filters.organizationId,
    from:report.filters.from,
    to:report.filters.to,
    format,
  });
  if(report.filters.userId)params.set("user_id",report.filters.userId);
  if(report.filters.siteId)params.set("site_id",report.filters.siteId);
  return "/api/attendance/report?"+params.toString();
}

function AttendanceReportExportMenu({report}:{report:AttendanceOperationalReport}){
  return <details className="profile-export-menu module-export-menu attendance-report-export">
    <summary className="ds-button ds-button-secondary ds-button-md profile-export-trigger">
      <UiIcon name="download" size={16}/><span>Exportar</span><UiIcon name="chevron-right" size={12}/>
    </summary>
    <div className="profile-export-options">
      <a href={exportHref(report,"xlsx")}><span className="export-format xlsx">XLS</span><span><strong>Excel</strong><small>Resumen por persona y detalle diario completo</small></span></a>
      <a href={exportHref(report,"csv")}><span className="export-format xlsx">CSV</span><span><strong>CSV</strong><small>Detalle tabular para Power Query o análisis</small></span></a>
      <a href={exportHref(report,"pdf")}><span className="export-format pdf">PDF</span><span><strong>PDF</strong><small>Informe ejecutivo con identidad visual autorizada</small></span></a>
    </div>
  </details>;
}

// ── Client report controls ──────────────────────────────────────────────────
// Filter values only request a narrower view. The report API independently
// resolves Organization, person and Site authorization before returning data.
export default function AttendanceOperationalReport({organizationId}:{organizationId:string}){
  const [report,setReport]=useState<AttendanceOperationalReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [userId,setUserId]=useState("");
  const [siteId,setSiteId]=useState("");
  const [activeTab,setActiveTab]=useState("people");

  async function load(input?:{from?:string;to?:string;userId?:string;siteId?:string}){
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams({organization_id:organizationId});
      if(input?.from)params.set("from",input.from);
      if(input?.to)params.set("to",input.to);
      if(input?.userId)params.set("user_id",input.userId);
      if(input?.siteId)params.set("site_id",input.siteId);
      const response=await fetch("/api/attendance/report?"+params.toString(),{
        cache:"no-store",
        headers:{Accept:"application/json"},
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"No fue posible cargar el reporte de asistencia.");
      const next=payload as AttendanceOperationalReport;
      setReport(next);
      setFrom(next.filters.from);
      setTo(next.filters.to);
      setUserId(next.filters.userId||"");
      setSiteId(next.filters.siteId||"");
    }catch(cause){
      setReport(null);
      setError(cause instanceof Error?cause.message:"No fue posible cargar el reporte de asistencia.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    void load();
    // Organization changes remount the authoritative reporting context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[organizationId]);

  const visibleDaily=useMemo(()=>report?.daily.slice(0,500)||[],[report]);

  const peopleContent=report?<StaticDataTable
    className="attendance-report-table attendance-report-people-table"
    caption="Resumen descriptivo de asistencia por persona"
    columns={[
      {key:"person",label:"Persona"},
      {key:"scheduled",label:"Programado",align:"end"},
      {key:"actual",label:"Real",align:"end"},
      {key:"variance",label:"Diferencia",align:"end"},
      {key:"onsite",label:"En sede",align:"end"},
      {key:"travel",label:"Traslado",align:"end"},
      {key:"shifts",label:"Jornadas",align:"end"},
      {key:"multi",label:"Multi-sede",align:"end"},
      {key:"activities",label:"Actividades",align:"end"},
      {key:"contingencies",label:"Contingencias",align:"end"},
    ]}
    rows={report.people.map(person=>({
      id:person.userId,
      cells:{
        person:<span className="attendance-report-person-cell"><strong>{person.fullName}</strong><small>{ROLE_LABELS[person.role]||person.role} · {person.scheduledDays} día(s) programado(s) · {person.daysWithAttendance} con asistencia</small></span>,
        scheduled:hours(person.scheduledMinutes),
        actual:<span><strong>{hours(person.actualMinutes)}</strong>{person.unplannedMinutes>0&&<small className="table-subline">{hours(person.unplannedMinutes)} no programadas</small>}</span>,
        variance:<span><strong>{variance(person.varianceMinutes)}</strong><small className="table-subline">solo días programados</small></span>,
        onsite:hours(person.onSiteMinutes),
        travel:<span><strong>{hours(person.travelMinutes)}</strong><small className="table-subline">{person.travelCount} tramo(s)</small></span>,
        shifts:person.shifts,
        multi:person.multiSiteShifts,
        activities:<span><strong>{person.completedInShift}</strong>{person.completedOutsideShift>0&&<small className="table-subline">{person.completedOutsideShift} fuera de jornada</small>}</span>,
        contingencies:<span><strong>{person.contingencyUsed}</strong>{person.contingencyRequests>person.contingencyUsed&&<small className="table-subline">{person.contingencyRequests} solicitud(es)</small>}</span>,
      },
    }))}
    empty={<EmptyState icon="file" title="Sin evidencia para el periodo" description="No hay jornadas programadas, marcaciones, actividades ni contingencias visibles con los filtros seleccionados."/>}
  />:null;

  const dailyContent=report?<div className="attendance-report-daily">
    {report.daily.length>500&&<Alert variant="info" title="Vista diaria resumida">La pantalla muestra las primeras 500 filas de {report.daily.length}. Excel y CSV conservan el detalle completo con los mismos filtros.</Alert>}
    <StaticDataTable
      className="attendance-report-table attendance-report-daily-table"
      caption="Detalle diario programado vs. real"
      columns={[
        {key:"date",label:"Fecha"},
        {key:"person",label:"Persona"},
        {key:"schedule",label:"Programación"},
        {key:"actual",label:"Real",align:"end"},
        {key:"variance",label:"Diferencia",align:"end"},
        {key:"route",label:"Origen → final"},
        {key:"onsite",label:"En sede",align:"end"},
        {key:"travel",label:"Traslado",align:"end"},
        {key:"activities",label:"Actividades",align:"end"},
        {key:"evidence",label:"Evidencia"},
      ]}
      rows={visibleDaily.map(row=>({
        id:row.id,
        cells:{
          date:<span><strong>{dateLabel(row.date)}</strong>{row.openNow&&<small className="table-subline">Jornada abierta</small>}</span>,
          person:<span><strong>{row.fullName}</strong><small className="table-subline">{ROLE_LABELS[row.role]||row.role}</small></span>,
          schedule:<span><strong>{scheduleLabel(row)}</strong><small className="table-subline">{row.scheduledMinutes===null?"Sin comparación":hours(row.scheduledMinutes)}</small></span>,
          actual:<span><strong>{hours(row.actualMinutes)}</strong><small className="table-subline">{row.shiftCount} jornada(s)</small></span>,
          variance:<span><strong>{variance(row.varianceMinutes)}</strong>{row.scheduleState!=="scheduled"&&row.actualMinutes>0&&<small className="table-subline">asistencia no programada</small>}</span>,
          route:<span><strong>{routeLabel(row)}</strong>{row.visitedSites.length>1&&<small className="table-subline">{row.visitedSites.length} sedes visibles</small>}</span>,
          onsite:hours(row.onSiteMinutes),
          travel:<span><strong>{hours(row.travelMinutes)}</strong><small className="table-subline">{row.travelCount} tramo(s)</small></span>,
          activities:<span><strong>{row.completedInShift}</strong>{row.completedOutsideShift>0&&<small className="table-subline">{row.completedOutsideShift} fuera</small>}</span>,
          evidence:<span className="attendance-report-evidence-cell">
            {row.contingencyUsed>0&&<Badge variant="warning" icon="warning">{row.contingencyUsed} contingencia</Badge>}
            {row.reactionSamples>0&&<Badge variant="info" icon="reaction">{row.reactionSamples} GPS Reacción</Badge>}
            {row.multiSiteShiftCount>0&&<Badge variant="brand" icon="location">{row.multiSiteShiftCount} multi-sede</Badge>}
            {!row.contingencyUsed&&!row.reactionSamples&&!row.multiSiteShiftCount&&<span className="muted">Sin evidencia adicional</span>}
          </span>,
        },
      }))}
      empty={<EmptyState icon="file" title="Sin detalle diario" description="No existen filas diarias visibles para el periodo y filtros seleccionados."/>}
    />
  </div>:null;

  return <section id="attendance-report" className="attendance-operational-report">
    <div className="attendance-report-head">
      <div>
        <span className="eyebrow">Reporte operativo</span>
        <h2>Jornada programada vs. presencia real</h2>
        <p>Compara planificación y evidencia real, separa permanencia en sede y desplazamientos, y conserva actividades, contingencias y trazabilidad Reacción como datos descriptivos.</p>
      </div>
      {report&&<AttendanceReportExportMenu report={report}/>}
    </div>

    <div className="attendance-report-filters" aria-label="Filtros del reporte de asistencia">
      <div className="field">
        <label htmlFor="attendance-report-from">Desde</label>
        <input id="attendance-report-from" type="date" value={from} onChange={event=>setFrom(event.target.value)}/>
      </div>
      <div className="field">
        <label htmlFor="attendance-report-to">Hasta</label>
        <input id="attendance-report-to" type="date" value={to} onChange={event=>setTo(event.target.value)}/>
      </div>
      <div className="field">
        <label htmlFor="attendance-report-user">Persona</label>
        <select id="attendance-report-user" value={userId} onChange={event=>setUserId(event.target.value)}>
          <option value="">Todas las autorizadas</option>
          {report?.options.people.map(person=><option key={person.id} value={person.id}>{person.name} · {ROLE_LABELS[person.role]||person.role}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="attendance-report-site">Sede relacionada</label>
        <select id="attendance-report-site" value={siteId} onChange={event=>setSiteId(event.target.value)}>
          <option value="">Todas las autorizadas</option>
          {report?.options.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      </div>
      <div className="attendance-report-filter-actions">
        <Button loading={loading} iconLeft="filter" onClick={()=>void load({from,to,userId,siteId})}>Aplicar filtros</Button>
        <Button variant="secondary" iconLeft="reset" disabled={loading} onClick={()=>void load()}>Últimos 30 días</Button>
      </div>
    </div>

    {error&&<Alert variant="danger" title="No fue posible generar el reporte">{error}</Alert>}
    {loading&&!report&&<div className="attendance-report-loading"><Spinner label="Construyendo reporte de asistencia"/></div>}

    {report&&<>
      {report.scope.limited&&<Alert variant="info" title="Reporte limitado por sedes">Solo se incluyen jornadas cuya evidencia completa puede mostrarse dentro de tus sedes autorizadas. Un trayecto que cruza una sede fuera de tu alcance no se expone parcialmente.</Alert>}

      <MetricGrid className="attendance-report-kpis">
        <KpiCard label="Personas" value={String(report.summary.people)} hint={report.filters.userId?"persona filtrada":"con evidencia visible"} icon="user"/>
        <KpiCard label="Horas programadas" value={hours(report.summary.scheduledMinutes)} hint={report.summary.scheduledDays+" día(s) programado(s)"} icon="clock"/>
        <KpiCard label="Horas reales" value={hours(report.summary.actualMinutes)} hint={report.summary.shifts+" jornada(s)"} icon="attendance"/>
        <KpiCard label="Diferencia" value={variance(report.summary.varianceMinutes)} hint="solo sobre días programados" icon="report"/>
        <KpiCard label="Tiempo en sede" value={hours(report.summary.onSiteMinutes)} hint="segmentos de permanencia" icon="location"/>
        <KpiCard label="Desplazamiento" value={hours(report.summary.travelMinutes)} hint={report.summary.travelCount+" tramo(s)"} icon="reaction"/>
        <KpiCard label="Actividades en jornada" value={String(report.summary.completedInShift)} hint={report.summary.completedOutsideShift+" fuera de jornada"} icon="activity"/>
        <KpiCard label="Contingencias usadas" value={String(report.summary.contingencyUsed)} hint={report.summary.contingencyRequests+" solicitud(es)"} icon="warning" tone={report.summary.contingencyUsed>0?"warning":"default"}/>
      </MetricGrid>

      <div className="attendance-report-context-grid">
        <article>
          <span>Días programados sin marcación</span>
          <strong>{report.summary.scheduledDaysWithoutAttendance}</strong>
          <small>Dato descriptivo; puede requerir revisión de vacaciones, permisos, cambios de turno u otras causas no modeladas aquí.</small>
        </article>
        <article>
          <span>Días con asistencia no programada</span>
          <strong>{report.summary.daysWithUnplannedAttendance}</strong>
          <small>{hours(report.summary.unplannedMinutes)} registradas fuera de un día con jornada individual activa.</small>
        </article>
        <article>
          <span>Jornadas multi-sede</span>
          <strong>{report.summary.multiSiteShifts}</strong>
          <small>{report.summary.reactionSamples} muestra(s) de Reacción correlacionadas con desplazamientos visibles.</small>
        </article>
      </div>

      <Alert variant="info" title="Lectura descriptiva">No constituye ranking ni calificación automática. La diferencia entre horas programadas y reales necesita contexto humano: el reporte no conoce por sí solo vacaciones, incapacidades, permisos, pausas contractuales u otras causas externas a la evidencia registrada en el CMMS.</Alert>

      <Tabs
        activeId={activeTab}
        onChange={setActiveTab}
        label="Vistas del reporte de asistencia"
        items={[
          {id:"people",label:"Resumen por persona",content:peopleContent},
          {id:"daily",label:"Detalle diario",content:dailyContent},
        ]}
      />
    </>}
  </section>;
}
