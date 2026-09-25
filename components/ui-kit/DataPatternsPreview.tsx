"use client";

import { useMemo, useState } from "react";
import { Search, FilterPanel, FilterGroup, ViewModeToggle, type ViewMode } from "@/components/ui-kit/DataControls";
import { DataTable, Pagination, type DataTableColumn } from "@/components/ui-kit/DataTable";
import { Select } from "@/components/ui-kit/FormControls";
import { KpiCard, MetricGrid, StatTiles } from "@/components/ui-kit/Metrics";
import { LineChart } from "@/components/ui-kit/Charts";
import { CircularProgress, ProgressBar, StepProgress, Timeline } from "@/components/ui-kit/TimelineProgress";

type DemoRow={id:string;asset:string;site:string;status:string;priority:string};
const demoRows:DemoRow[]=[
  {id:"1",asset:"Bomba P-101",site:"Planta Norte",status:"Operativo",priority:"Media"},
  {id:"2",asset:"Compresor C-04",site:"Planta Norte",status:"En revisión",priority:"Alta"},
  {id:"3",asset:"Tablero T-22",site:"Centro Logístico",status:"Operativo",priority:"Baja"},
  {id:"4",asset:"UPS U-07",site:"Centro Logístico",status:"Fuera de servicio",priority:"Urgente"},
];

export function DataPatternsPreview(){
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [page,setPage]=useState(1);
  const [bulkMessage,setBulkMessage]=useState("");
  const [viewMode,setViewMode]=useState<ViewMode>("grid");
  const filtered=useMemo(()=>demoRows.filter(row=>
    (status==="all"||row.status===status)&&
    (!query||[row.asset,row.site,row.status,row.priority].join(" ").toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))
  ),[query,status]);

  const columns:DataTableColumn<DemoRow>[]=[
    {id:"asset",header:"Activo",cell:row=><strong>{row.asset}</strong>,sortValue:row=>row.asset},
    {id:"site",header:"Sede",cell:row=>row.site,sortValue:row=>row.site},
    {id:"priority",header:"Prioridad",cell:row=>row.priority,sortValue:row=>row.priority},
    {id:"status",header:"Estado",cell:row=>row.status,sortValue:row=>row.status},
  ];

  return <div className="ds-data-preview">
    <section className="ds-preview-section" id="data-controls">
      <div className="ds-preview-heading"><span>Shared Data UI</span><h2>Search y filtros</h2><p>Los filtros afinan datasets ya autorizados; nunca reemplazan scope o RBAC server-side.</p></div>
      <div className="ds-data-toolbar-demo">
        <Search value={query} onValueChange={setQuery} placeholder="Buscar activo o sede…" ariaLabel="Buscar activos"/>
        <FilterPanel activeCount={status==="all"?0:1} onClear={()=>setStatus("all")}>
          <FilterGroup label="Estado">
            <Select
              aria-label="Estado"
              placeholder=""
              value={status}
              onChange={event=>setStatus(event.target.value)}
              options={[{value:"all",label:"Todos"},{value:"Operativo",label:"Operativo"},{value:"En revisión",label:"En revisión"},{value:"Fuera de servicio",label:"Fuera de servicio"}]}
            />
          </FilterGroup>
        </FilterPanel>
        <ViewModeToggle value={viewMode} onChange={setViewMode} label="Vista de demostración"/>
        <span className="ds-demo-muted">{filtered.length} de {demoRows.length} registros · {viewMode==="grid"?"Cuadrícula":"Listado"}</span>
      </div>
    </section>

    <section className="ds-preview-section" id="tables">
      <div className="ds-preview-heading"><span>Shared Data UI</span><h2>DataTable, acciones y paginación</h2><p>Sorting, selección y acciones masivas/contextuales comparten un solo contrato.</p></div>
      {bulkMessage&&<div className="ds-phase-note">{bulkMessage}</div>}
      <DataTable
        rows={filtered}
        columns={columns}
        caption="Activos de demostración"
        selectable
        getRowLabel={row=>row.asset}
        bulkActions={[
          {label:"Exportar selección",icon:"download",onSelect:rows=>setBulkMessage(rows.length+" registros preparados para exportación.")},
          {label:"Archivar",icon:"file",variant:"secondary",onSelect:rows=>setBulkMessage(rows.length+" registros seleccionados para archivar.")},
        ]}
        rowActions={row=>[
          {label:"Ver detalle",icon:"eye",onSelect:()=>setBulkMessage("Vista de "+row.asset)},
          {label:"Editar",icon:"edit",onSelect:()=>setBulkMessage("Edición de "+row.asset)},
          {label:"Eliminar",icon:"trash",danger:true,onSelect:()=>setBulkMessage("Acción destructiva de "+row.asset)},
        ]}
      />
      <Pagination page={page} pageCount={7} onPageChange={setPage}/>
    </section>

    <section className="ds-preview-section" id="metrics">
      <div className="ds-preview-heading"><span>Shared Data UI</span><h2>KPI y métricas</h2><p>Comparación, tendencia y tono funcional están separados de la lógica que calcula el indicador.</p></div>
      <MetricGrid>
        <KpiCard label="OT completadas" value="128" hint="Cierres del periodo" icon="check" tone="success" current={128} previous={112} direction="higher-better"/>
        <KpiCard label="OT vencidas" value="9" hint="Requieren seguimiento" icon="warning" tone="warning" current={9} previous={14} direction="lower-better"/>
        <KpiCard label="Costo" value="$ 18,4 M" hint="Mantenimiento del periodo" icon="activity" current={18.4} previous={17.1} direction="lower-better"/>
        <KpiCard label="Disponibilidad" value="97%" hint="Activos críticos" icon="asset" tone="info" current={97} previous={95} direction="higher-better"/>
      </MetricGrid>
      <StatTiles items={[
        {label:"Preventivas",value:"82%",hint:"Cumplimiento",tone:"success"},
        {label:"Correctivas",value:"34",hint:"Registradas"},
        {label:"Urgentes",value:"5",hint:"Abiertas",tone:"danger"},
      ]}/>
    </section>

    <section className="ds-preview-section" id="charts">
      <div className="ds-preview-heading"><span>Shared Data UI</span><h2>Chart palette</h2><p>Las series usan exclusivamente la secuencia semántica --chart-1…--chart-10.</p></div>
      <LineChart labels={["Abr","May","Jun","Jul","Ago","Sep"]} series={[
        {name:"Completadas",values:[18,24,20,31,35,42]},
        {name:"Pendientes",values:[12,10,14,9,8,6]},
      ]}/>
    </section>

    <section className="ds-preview-section" id="progress">
      <div className="ds-preview-heading"><span>Shared Data UI</span><h2>Progress y Timeline</h2><p>Progreso cuantitativo, pasos de proceso e historial comparten estados accesibles.</p></div>
      <div className="ds-demo-grid">
        <div className="ds-demo-block">
          <strong>Progress</strong>
          <ProgressBar value={72} label="Importación validada" caption="72 de 100 registros"/>
          <ProgressBar value={48} label="Cumplimiento preventivo" tone="warning"/>
          <div className="ds-demo-row"><CircularProgress value={86} label="SLA" tone="success"/></div>
          <StepProgress steps={[
            {id:"1",label:"Solicitud",status:"complete"},
            {id:"2",label:"Aprobación",status:"complete"},
            {id:"3",label:"Recepción",status:"current"},
            {id:"4",label:"Conciliación",status:"upcoming"},
          ]}/>
        </div>
        <div className="ds-demo-block">
          <strong>Timeline</strong>
          <Timeline items={[
            {id:"1",title:"Requisición aprobada",meta:"08:42",icon:"check",tone:"success",description:"Aprobación registrada por el flujo autorizado."},
            {id:"2",title:"Recepción parcial",meta:"10:15",icon:"download",tone:"info",description:"Se recibieron 8 de 12 unidades."},
            {id:"3",title:"Pendiente de factura",meta:"Actual",icon:"clock",tone:"warning",description:"La evidencia comercial aún no ha sido conciliada."},
          ]}/>
        </div>
      </div>
    </section>
  </div>;
}
