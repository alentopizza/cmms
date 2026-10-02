import fs from "node:fs";

const ownerActions=fs.readFileSync("components/OwnerRecordActions.tsx","utf8");
const ownerDelete=fs.readFileSync("components/OwnerDeleteButton.tsx","utf8");
const phase9=fs.readFileSync("app/phase9-modules.css","utf8");
const globals=fs.readFileSync("app/globals.css","utf8");
const requisitions=fs.readFileSync("app/dashboard/requisitions/page.tsx","utf8");

if(ownerActions.includes('title="Editar" data-tooltip="Editar"')){
  throw new Error("Compact edit action still exposes duplicate native + design tooltips");
}
if(ownerDelete.includes("title={tooltip}")){
  throw new Error("Owner delete action still exposes the native title tooltip");
}
if(!ownerDelete.includes("data-tooltip={tooltip}")){
  throw new Error("Owner delete action lost the Design System tooltip");
}
if(phase9.includes('[title="Eliminar"]::after')||globals.includes('[title="Eliminar"]::after')){
  throw new Error("Visual delete labels must not depend on native title attributes");
}
if(!phase9.includes('[data-tooltip="Eliminar"]::after')){
  throw new Error("Phase 9 delete action label no longer follows the Design System tooltip source");
}
for(const marker of [
  'className="module-header-action-group"',
  'className="ds-button ds-button-primary ds-button-md module-add-button"',
  '<span>Crear desde inventario</span>',
]){
  if(!requisitions.includes(marker))throw new Error("Requisitions shared header action contract missing "+marker);
}

console.log("Header/tooltip regression checks passed.");
