import Link from "next/link";
import { Badge } from "@/components/ui-kit/Badge";
import { Card } from "@/components/ui-kit/Card";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { StatTiles } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";

export type AssetCategorySummary={
  id:string;name:string;parent_name:string|null;asset_count:number;
};
export type AssetMaintenanceSummary={
  id:string;name:string;asset_name:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean;
};
export type AssetHistorySummary={
  id:string;number:string;title:string;asset_name:string;status:string;priority:string;requested_at:string;
};
export type AssetDocumentSummary={
  id:string;asset_name:string;file_name:string;mime_type:string|null;size_bytes:string|null;created_at:string;
};

type AssetLike={
  manufacturer:string|null;model:string|null;status:string;criticality:string;category:string|null;
};

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
  assets,categories,maintenance,history,documents,
}:{
  assets:AssetLike[];
  categories:AssetCategorySummary[];
  maintenance:AssetMaintenanceSummary[];
  history:AssetHistorySummary[];
  documents:AssetDocumentSummary[];
}){
  const roots=categories.filter(item=>!item.parent_name);
  const brands=Array.from(new Set(assets.map(item=>item.manufacturer?.trim()).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,"es"));
  const models=Array.from(new Set(assets.map(item=>[item.manufacturer?.trim(),item.model?.trim()].filter(Boolean).join(" · ")).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es"));
  const statuses=["operational","maintenance","down","retired"].map(status=>({status,count:assets.filter(item=>item.status===status).length}));
  const critical=assets.filter(item=>item.criticality==="critical").length;

  return <div className="phase7-asset-catalog">
    <section className="section phase7-anchor" id="asset-types">
      <Card header={<div><span className="eyebrow">Clasificación</span><h2>Tipos de activo</h2></div>}>
        <p className="phase7-section-copy">DESWEB usa la jerarquía existente de categorías: las categorías raíz actúan como tipo principal y sus descendientes como categorías específicas.</p>
        <StatTiles items={[
          {label:"Tipos raíz",value:String(roots.length),hint:"categorías sin padre"},
          {label:"Categorías",value:String(categories.length),hint:"clasificaciones registradas"},
          {label:"Activos críticos",value:String(critical),hint:"criticidad crítica",tone:critical?"danger":"success"},
        ]}/>
      </Card>
    </section>

    <section className="section phase7-anchor" id="asset-categories">
      <Card header={<div><span className="eyebrow">Catálogo técnico</span><h2>Categorías</h2></div>}>
        <StaticDataTable
          caption="Categorías de activos"
          columns={[{key:"name",label:"Categoría"},{key:"type",label:"Tipo / padre"},{key:"assets",label:"Activos",align:"end"}]}
          rows={categories.map(item=>({id:item.id,cells:{name:item.name,type:item.parent_name||"Tipo principal",assets:item.asset_count}}))}
          empty={<EmptyState icon="asset" title="No hay categorías de activos" description="Las categorías se crean desde los flujos técnicos existentes o mediante la carga validada."/>}
        />
      </Card>
    </section>

    <section className="section phase7-anchor phase7-dual" id="asset-brands">
      <Card header={<div><span className="eyebrow">Fabricantes</span><h2>Marcas</h2></div>}>
        {brands.length?<div className="phase7-chip-grid">{brands.map(brand=><span key={brand} className="phase7-chip">{brand}<strong>{assets.filter(item=>item.manufacturer?.trim()===brand).length}</strong></span>)}</div>:<EmptyState icon="asset" title="Sin marcas registradas" description="Registra el fabricante en la ficha del activo para construir este catálogo automáticamente."/>}
      </Card>
      <Card header={<div><span className="eyebrow">Referencias</span><h2>Modelos</h2></div>} id="asset-models">
        {models.length?<div className="phase7-chip-grid">{models.map(model=><span key={model} className="phase7-chip">{model}</span>)}</div>:<EmptyState icon="asset" title="Sin modelos registrados" description="Los modelos se consolidan desde las fichas técnicas de los activos."/>}
      </Card>
    </section>

    <section className="section phase7-anchor" id="asset-states">
      <Card header={<div><span className="eyebrow">Disponibilidad</span><h2>Estados operativos</h2></div>}>
        <div className="phase7-state-grid">{statuses.map(item=><div key={item.status}><Badge variant={badgeTone(item.status)}>{statusLabel(item.status)}</Badge><strong>{item.count}</strong><span>{assets.length?Math.round(item.count/assets.length*100):0}%</span></div>)}</div>
      </Card>
    </section>

    <section className="section phase7-anchor" id="asset-maintenance">
      <Card header={<div><span className="eyebrow">Mantenimiento</span><h2>Rutinas asociadas</h2></div>}>
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
    </section>

    <section className="section phase7-anchor" id="asset-history">
      <Card header={<div><span className="eyebrow">Trazabilidad</span><h2>Historial de órdenes</h2></div>}>
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
    </section>

    <section className="section phase7-anchor" id="asset-documents">
      <Card header={<div><span className="eyebrow">Expediente</span><h2>Documentos</h2></div>}>
        <StaticDataTable
          caption="Documentos vinculados a activos"
          columns={[{key:"asset",label:"Activo"},{key:"file",label:"Archivo"},{key:"type",label:"Tipo"},{key:"size",label:"Tamaño"},{key:"date",label:"Registrado"}]}
          rows={documents.map(item=>({id:item.id,cells:{
            asset:item.asset_name,file:item.file_name,type:item.mime_type||"Archivo",
            size:item.size_bytes?Math.max(1,Math.round(Number(item.size_bytes)/1024))+" KB":"—",
            date:new Date(item.created_at).toLocaleDateString("es-CO"),
          }}))}
          empty={<EmptyState icon="file" title="Sin documentos vinculados" description="Los adjuntos técnicos asociados directamente a activos se consolidarán en este expediente."/>}
        />
      </Card>
    </section>

    <section className="section phase7-anchor" id="asset-settings">
      <Card header={<div><span className="eyebrow">Configuración</span><h2>Calidad del catálogo</h2></div>}>
        <StatTiles items={[
          {label:"Con categoría",value:String(assets.filter(item=>Boolean(item.category)).length),hint:"activos clasificados"},
          {label:"Con fabricante",value:String(assets.filter(item=>Boolean(item.manufacturer)).length),hint:"marca registrada"},
          {label:"Con modelo",value:String(assets.filter(item=>Boolean(item.model)).length),hint:"referencia registrada"},
          {label:"Criticidad alta/crítica",value:String(assets.filter(item=>["high","critical"].includes(item.criticality)).length),hint:"requieren mayor control",tone:"warning"},
        ]}/>
        <p className="phase7-section-copy">Estos indicadores usan la información maestra actual. No crean nuevas taxonomías ni cambian la estructura de base de datos.</p>
      </Card>
    </section>
  </div>;
}
