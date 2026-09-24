"use client";

import UiIcon from "@/components/UiIcon";

export default function ModuleExportMenu({entity}:{entity:"inventory"|"assets"}){
  const base="/api/module-export?entity="+entity+"&format=";
  return <details className="profile-export-menu module-export-menu">
    <summary className="button secondary profile-export-trigger"><UiIcon name="download" size={16}/><span>Exportar</span><UiIcon name="chevron-right" size={12}/></summary>
    <div className="profile-export-options">
      <a href={base+"xlsx"}><span className="export-format xlsx">XLS</span><span><strong>Excel</strong><small>Base estructurada para análisis o respaldo</small></span></a>
      <a href={base+"csv"}><span className="export-format xlsx">CSV</span><span><strong>CSV</strong><small>Intercambio de datos plano</small></span></a>
      <a href={base+"pdf"}><span className="export-format pdf">PDF</span><span><strong>PDF</strong><small>Resumen tabular para compartir</small></span></a>
    </div>
  </details>;
}
