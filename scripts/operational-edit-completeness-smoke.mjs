import fs from "node:fs";

const workOrders=fs.readFileSync("app/dashboard/work-orders/page.tsx","utf8");
const maintenance=fs.readFileSync("app/dashboard/maintenance/page.tsx","utf8");
const ownerActions=fs.readFileSync("components/OwnerRecordActions.tsx","utf8");
const ownerApi=fs.readFileSync("app/api/platform-owner/records/route.ts","utf8");

for(const marker of [
  'name:"asset_id",label:"Activo / Equipo"',
  'name:"description",label:"Descripción"',
  'name:"type",label:"Tipo de OT"',
  'name:"work_type",label:"Tipo de trabajo"',
  'name:"cause",label:"Causa"',
  'name:"due_at",label:"Fecha requerida"',
  'name:"assigned_to",label:"Técnico / persona"',
  'name:"crew_id",label:"Cuadrilla"',
  'name:"service_supplier_id",label:"Proveedor de servicios"',
  'function ownerFieldsForOrder',
]){
  if(!workOrders.includes(marker))throw new Error("Complete OT editor missing "+marker);
}

for(const marker of [
  'name:"asset_id",label:"Activo / Equipo"',
  'name:"description",label:"Descripción"',
  'name:"routine_type",label:"Tipo de rutina"',
  'name:"priority",label:"Prioridad"',
  'name:"specialty",label:"Especialidad"',
  'name:"estimated_minutes",label:"Duración estimada (min)"',
  'name:"assigned_to",label:"Técnico / persona"',
  'name:"crew_id",label:"Cuadrilla"',
  'name:"service_supplier_id",label:"Proveedor de servicios"',
  'function ownerFieldsForPlan',
]){
  if(!maintenance.includes(marker))throw new Error("Complete routine editor missing "+marker);
}

for(const marker of [
  "exclusiveGroup?:string",
  "data-exclusive-group={field.exclusiveGroup}",
  'select.value=""',
  'field.wide?"form-span-2"',
]){
  if(!ownerActions.includes(marker))throw new Error("Operational edit UI contract missing "+marker);
}

for(const marker of [
  '| { type: "uuid"; nullable?: boolean }',
  'asset_id: { type: "uuid"',
  'assigned_to: { type: "uuid", nullable: true }',
  'crew_id: { type: "uuid", nullable: true }',
  'service_supplier_id: { type: "uuid", nullable: true }',
  'Selecciona un único responsable: persona, cuadrilla o proveedor.',
  "El activo seleccionado no pertenece a la empresa del registro.",
  "UPDATE work_orders w SET site_id=a.site_id FROM assets a",
]){
  if(!ownerApi.includes(marker))throw new Error("Operational edit server validation missing "+marker);
}

console.log("Operational OT/Routine edit completeness checks passed.");
