"use client";

import UiIcon from "@/components/UiIcon";

export type ProfileExportEntity = "organization" | "site" | "location" | "user" | "supplier";

export default function ProfileExportMenu({
  entity,
  id,
  label = "Exportar",
  documentLabel = "Hoja de vida",
}: {
  entity: ProfileExportEntity;
  id: string;
  label?: string;
  documentLabel?: string;
}) {
  const base = `/api/profile-export?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(id)}&format=`;

  return <details className="profile-export-menu">
    <summary className="button profile-export-trigger">
      <UiIcon name="download" size={17}/>
      <span>{label}</span>
      <UiIcon name="chevron-right" size={13} className="profile-export-chevron"/>
    </summary>
    <div className="profile-export-options">
      <a href={base + "pdf"}><span className="export-format pdf">PDF</span><span><strong>{documentLabel} PDF</strong><small>Formato ejecutivo para imprimir o compartir</small></span></a>
      <a href={base + "xlsx"}><span className="export-format xlsx">XLS</span><span><strong>{documentLabel} Excel</strong><small>Resumen y datos estructurados</small></span></a>
      <a href={base + "word"}><span className="export-format word">DOC</span><span><strong>{documentLabel} Word</strong><small>Documento editable compatible con Word</small></span></a>
    </div>
  </details>;
}
