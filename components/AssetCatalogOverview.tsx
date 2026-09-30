import Link from "next/link";
import { Badge } from "@/components/ui-kit/Badge";
import { Card } from "@/components/ui-kit/Card";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { StatTiles } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import type { AssetView } from "@/components/AssetSubnav";

export type AssetTypeSummary={name:string;asset_count:number};
export type AssetCategorySummary={id:string;name:string;parent_name:string|null;asset_count:number};
export type AssetMaintenanceSummary={id:string;name:string;asset_name:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean};
export type AssetHistorySummary={id:string;number:string;title:string;asset_name:string;status:string;priority:string;requested_at:string};
export type AssetDocumentSummary={id:string;asset_name:string;file_name:string;mime_type:string|null;size_bytes:string|null;created_at:string};
export type AssetCatalogSummary={
  total_count:number;operational_count:number;maintenance_count:number;down_count:number;retired_count:number;
  critical_count:number;high_critical_count:number;with_category_count:number;with_manufacturer_count:number;with_model_count:number;
};
export type AssetBrandSummary={name:string;asset_count:number};
export type AssetModelSummary={label:string};

function statusLabel(value:string){
  return ({operational:"Operativo",maintenance:"En mantenimiento",down:"Fuera de servicio",retired:"Retirado"} as Record<string,string>)[value]||value;
}
function badgeTone(status:string){
  if(status==="operational"||status==="completed")return "success" as const;
  if(status==="maintenance"||status==="assigned"||status==="in_progress"||status==="paused")return "warning" as const;
  if(status==="down"||status==="cancelled")return "danger" as const;
  return "neutral" as const;
}
function frequencyLabel(value:number,unit:string){
  const names:Record<string,string>={day:"día",week:"semana",month:"mes",year:"año",meter:"unidad de medidor"};
  return "Cada "+value+" "+(names[unit]||unit)+(value===1?"":"s");
}

export default function AssetCatalogOverview({
  view,summary,types,brands,models,categories,maintenance,history,documents,
}:{
  view:Exclude<AssetView,"list">;
  summary:AssetCatalogSummary;
  types:AssetTypeSummary[];
  brands:AssetBrandSummary[];
  models:AssetModelSummary[];
  categories:AssetCategorySummary[];
  maintenance:AssetMaintenanceSummary[];
  history:AssetHistorySummary[];
  documents:AssetDocumentSummary[];
}){
  const statuses=[
    {status:"operational",count:summary.operational_count},
    {status:"maintenance",count:summary.maintenance_count},
    {status:"down",count:summary.down_count},
    {status:"retired",count:summary.retired_count},
  ];

  if(view==="types")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Clasificación</span><h2>Tipos de activo</h2><p className="muted">Clasificación principal registrada en la ficha técnica del activo.</p></div>}>
      {types.length?<StaticDataTable
        caption="Tipos de activos"
        columns={[{key:"type",label:"Tipo"},{key:"assets",label:"Activos",align:"end"}]}
        rows={types.map(item=>({id:item.name,cells:{type:item.name,assets:item.asset_count}}))}
      />:<EmptyState icon="asset" title="Sin tipos registrados" description="Asigna el tipo desde el formulario de creación o edición del activo."/>}
    </Card>
  </section>;

  if(view==="categories")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Catálogo técnico</span><h2>Categorías</h2><p className="muted">Clasificación operativa y técnica utilizada por los activos.</p></div>}>
      <StaticDataTable
        caption="Categorías de activos"
        columns={[{key:"name",label:"Categoría"},{key:"type",label:"Categoría padre"},{key:"assets",label:"Activos",align:"end"}]}
        rows={categories.map(item=>({id:item.id,cells:{name:item.name,type:item.parent_name||"Sin categoría padre",assets:item.asset_count}}))}
        empty={<EmptyState icon="asset" title="No hay categorías de activos" description="Crea categorías desde los formularios compatibles o desde Configuración → Catálogos."/>}
      />
    </Card>
  </section>;

  if(view==="brands")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Fabricantes</span><h2>Marcas</h2><p className="muted">Marcas actualmente utilizadas por los activos visibles en tu alcance.</p></div>}>
      {brands.length?<div className="phase7-chip-grid">{brands.map(brand=><span key={brand.name} className="phase7-chip">{brand.name}<strong>{brand.asset_count}</strong></span>)}</div>:<EmptyState icon="asset" title="Sin marcas registradas" description="Registra el fabricante en la ficha del activo."/>}
    </Card>
  </section>;

  if(view==="models")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Referencias</span><h2>Modelos</h2><p className="muted">Modelos consolidados desde las fichas técnicas de los activos.</p></div>}>
      {models.length?<div className="phase7-chip-grid">{models.map(model=><span key={model.label} className="phase7-chip">{model.label}</span>)}</div>:<EmptyState icon="asset" title="Sin modelos registrados" description="Los modelos aparecen cuando se asignan en la ficha técnica."/>}
    </Card>
  </section>;

  if(view==="states")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Disponibilidad</span><h2>Estados operativos</h2><p className="muted">Distribución actual del ciclo de vida operativo.</p></div>}>
      <div className="phase7-state-grid">{statuses.map(item=><div key={item.status}><Badge variant={badgeTone(item.status)}>{statusLabel(item.status)}</Badge><strong>{item.count}</strong><span>{summary.total_count?Math.round(item.count/summary.total_count*100):0}%</span></div>)}</div>
    </Card>
  </section>;

  if(view==="maintenance")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Mantenimiento</span><h2>Rutinas asociadas</h2><p className="muted">Programación preventiva asociada a los activos.</p></div>}>
      <StaticDataTable
        caption="Rutinas de mantenimiento"
        columns={[{key:"asset",label:"Activo"},{key:"plan",label:"Rutina"},{key:"frequency",label:"Frecuencia"},{key:"next",label:"Próxima ejecución"},{key:"state",label:"Estado"}]}
        rows={maintenance.map(item=>({id:item.id,cells:{
          asset:item.asset_name,plan:item.name,frequency:frequencyLabel(item.frequency_value,item.frequency_unit),
          next:item.next_due_at?new Date(item.next_due_at).toLocaleDateString("es-CO"):"Sin programar",
          state:<Badge variant={item.active?"success":"neutral"}>{item.active?"Activa":"Inactiva"}</Badge>,
        }}))}
        empty={<EmptyState icon="asset" title="No hay rutinas asociadas" description="Crea una rutina desde la ficha del activo para iniciar la planificación preventiva."/>}
      />
    </Card>
  </section>;

  if(view==="history")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Trazabilidad</span><h2>Historial</h2><p className="muted">Órdenes de trabajo relacionadas con los activos.</p></div>}>
      <StaticDataTable
        caption="Historial reciente de activos"
        columns={[{key:"order",label:"OT"},{key:"asset",label:"Activo"},{key:"title",label:"Trabajo"},{key:"priority",label:"Prioridad"},{key:"status",label:"Estado"},{key:"date",label:"Fecha"}]}
        rows={history.map(item=>({id:item.id,cells:{
          order:<Link href={"/dashboard/work-orders/"+item.id}>#{item.number}</Link>,
          asset:item.asset_name,title:item.title,priority:item.priority,
          status:<Badge variant={badgeTone(item.status)}>{item.status.replaceAll("_"," ")}</Badge>,
          date:new Date(item.requested_at).toLocaleDateString("es-CO"),
        }}))}
        empty={<EmptyState icon="file" title="Sin historial operativo" description="Las órdenes de trabajo asociadas a activos aparecerán aquí."/>}
      />
    </Card>
  </section>;

  if(view==="documents")return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Expediente</span><h2>Documentos</h2><p className="muted">Archivos vinculados directamente a activos.</p></div>}>
      <StaticDataTable
        caption="Documentos vinculados a activos"
        columns={[{key:"asset",label:"Activo"},{key:"file",label:"Archivo"},{key:"type",label:"Tipo"},{key:"size",label:"Tamaño"},{key:"date",label:"Registrado"}]}
        rows={documents.map(item=>({id:item.id,cells:{
          asset:item.asset_name,file:item.file_name,type:item.mime_type||"Archivo",
          size:item.size_bytes?Math.max(1,Math.round(Number(item.size_bytes)/1024))+" KB":"—",
          date:new Date(item.created_at).toLocaleDateString("es-CO"),
        }}))}
        empty={<EmptyState icon="file" title="Sin documentos vinculados" description="Los adjuntos técnicos asociados directamente a activos aparecerán aquí."/>}
      />
    </Card>
  </section>;

  return <section className="section asset-view-panel">
    <Card header={<div><span className="eyebrow">Configuración</span><h2>Calidad del catálogo</h2><p className="muted">Indicadores de completitud del maestro de activos.</p></div>}>
      <StatTiles items={[
        {label:"Con categoría",value:String(summary.with_category_count),hint:"activos clasificados"},
        {label:"Con fabricante",value:String(summary.with_manufacturer_count),hint:"marca registrada"},
        {label:"Con modelo",value:String(summary.with_model_count),hint:"referencia registrada"},
        {label:"Criticidad alta/crítica",value:String(summary.high_critical_count),hint:"requieren mayor control",tone:"warning"},
      ]}/>
      <div className="asset-settings-actions">
        <Link className="button secondary" href="/dashboard/settings/catalogs?catalog=asset_types">Administrar tipos</Link>
        <Link className="button secondary" href="/dashboard/settings/catalogs?catalog=asset_categories">Administrar categorías</Link>
        <Link className="button secondary" href="/dashboard/settings/catalogs?catalog=asset_brands">Administrar marcas</Link>
        <Link className="button secondary" href="/dashboard/settings/catalogs?catalog=asset_models">Administrar modelos</Link>
      </div>
    </Card>
  </section>;
}
