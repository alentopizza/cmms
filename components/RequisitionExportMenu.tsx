"use client";

import UiIcon from "@/components/UiIcon";

export default function RequisitionExportMenu({id}:{id:string}){
  const base="/api/requisitions/"+encodeURIComponent(id)+"/export?format=";
  return <details className="profile-export-menu">
    <summary className="button profile-export-trigger">
      <UiIcon name="download" size={17}/>
      <span>Exportar</span>
      <UiIcon name="chevron-right" size={13} className="profile-export-chevron"/>
    </summary>
    <div className="profile-export-options">
      <a href={base+"pdf"}><span className="export-format pdf">PDF</span><span><strong>Requisición PDF</strong><small>Documento para enviar o imprimir</small></span></a>
      <a href={base+"xlsx"}><span className="export-format xlsx">XLS</span><span><strong>Requisición Excel</strong><small>Detalle estructurado de ítems y cantidades</small></span></a>
      <a href={base+"word"}><span className="export-format word">DOC</span><span><strong>Requisición Word</strong><small>Documento editable compatible con Word</small></span></a>
    </div>
  </details>;
}
