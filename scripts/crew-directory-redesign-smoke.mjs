import fs from "node:fs";

const required=[
  "app/dashboard/crews/page.tsx",
  "components/CrewDirectory.tsx",
  "components/business-ui/BusinessCards.tsx",
  "components/business-ui/BusinessCardsPreview.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing crew redesign file: "+file);

const page=fs.readFileSync("app/dashboard/crews/page.tsx","utf8");
for(const marker of [
  "<ModuleHeader",
  "Ejecución operativa",
  "Equipos de trabajo en campo, asigna actividades, gestiona integrantes y monitorea su operación.",
  'triggerLabel="Nueva cuadrilla"',
  "iconOnly",
  'iconName="plus"',
  "crew-compact-stats",
  "Cuadrillas registradas",
  "Activas",
  "Inactivas",
  "<CrewDirectory",
  "activeActivityCount",
  "completedActivityCount",
]){
  if(!page.includes(marker))throw new Error("Crew page redesign contract missing "+marker);
}
for(const forbidden of ["crew-showcase-grid","<CrewCard","crew-directory-page-head-v2","<MetricGrid","<KpiCard","Zona Sur","Mantenimiento Norte","En pausa","disciplina"]){
  if(page.includes(forbidden))throw new Error("Crew page contains legacy/fictitious design marker "+forbidden);
}

const directory=fs.readFileSync("components/CrewDirectory.tsx","utf8");
for(const marker of [
  "<CollectionView",
  'storageKey="crews"',
  'label="Vista de cuadrillas"',
  "<CrewCard",
  "<StaticDataTable",
  "Contactar por WhatsApp",
  "Llamar",
  "Enviar correo",
  "Más acciones",
  "Editar cuadrilla",
  'action={"/api/crews/"+editCrew.id}',
  'submitLabel="Guardar cambios"',
  "No encontramos cuadrillas",
  "No hay cuadrillas registradas",
]){
  if(!directory.includes(marker))throw new Error("Crew directory contract missing "+marker);
}
for(const removed of ["crew-directory-controls-v2","crew-directory-result-meta-v2",'toolbarTargetId="crew-view-mode-tools"']){
  if(directory.includes(removed))throw new Error("Crew directory must not render duplicated lower controls: "+removed);
}
if(directory.includes("Todas las disciplinas")||directory.includes("En pausa")){
  throw new Error("Crew directory must not invent discipline or paused status without source data");
}

const form=fs.readFileSync("components/CrewCreateForm.tsx","utf8");
for(const marker of [
  'action="/api/crews"',
  'submitLabel="Crear cuadrilla"',
  "initialValues",
  'name="leader_user_id"',
  'name="member_ids"',
  'name="description"',
  'name="active"',
]){
  if(!form.includes(marker))throw new Error("Reusable crew form missing "+marker);
}

const updateApi=fs.readFileSync("app/api/crews/[id]/route.ts","utf8");
for(const marker of [
  'can(session,"crews.manage")',
  "canAccessOrganization",
  "canAccessSite",
  "leader_user_id",
  "DELETE FROM crew_members",
  "INSERT INTO crew_members",
  "active=$5",
]){
  if(!updateApi.includes(marker))throw new Error("Crew full edit API missing "+marker);
}

const cards=fs.readFileSync("components/business-ui/BusinessCards.tsx","utf8");
for(const marker of [
  "crew-directory-card-v2",
  "crew-directory-head-v2",
  "crew-directory-leader-v2",
  "crew-directory-description-v2",
  "crew-directory-metrics-v2",
  "crew-directory-members-v2",
  "crew-directory-actions-v2",
]){
  if(!cards.includes(marker))throw new Error("CrewCard V2 compact composition missing "+marker);
}
for(const legacy of ["crew-leader-hero","crew-leader-photo","crew-leader-shade"]){
  const crewStart=cards.indexOf("export function CrewCard");
  const userStart=cards.indexOf("export function UserCard",crewStart);
  if(cards.slice(crewStart,userStart).includes(legacy))throw new Error("CrewCard still contains large-photo legacy "+legacy);
}

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [
  ".crew-directory-grid-v2",
  ".crew-compact-stats",
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "@media(max-width:1180px)",
  "@media(max-width:620px)",
  ".crew-directory-list-v2",
]){
  if(!css.includes(marker))throw new Error("Crew responsive styles missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 8 CSS must remain token-only");

const preview=fs.readFileSync("components/business-ui/BusinessCardsPreview.tsx","utf8");
if(!preview.includes("<CrewCard")||!preview.includes('description="Equipo operativo con líder e integrantes diferenciados."')){
  throw new Error("UI Kit preview does not expose redesigned CrewCard");
}

console.log("Approved crew directory redesign checks passed.");


const createModal=fs.readFileSync("components/CreateRecordModal.tsx","utf8");
for(const marker of ["iconOnly","module-add-button-icon-only","data-tooltip={triggerLabel}"]){
  if(!createModal.includes(marker))throw new Error("Compact create action missing "+marker);
}

const chrome=fs.readFileSync("components/DashboardChrome.tsx","utf8");
for(const marker of [
  "GlobalNotificationBell",
  'aria-label="Notificaciones"',
  'title="Notificaciones"',
  "Marcar todas como leídas",
  "Ver todas las notificaciones",
]){
  if(!chrome.includes(marker))throw new Error("Global notification UX missing "+marker);
}

const layout=fs.readFileSync("app/dashboard/layout.tsx","utf8");
for(const marker of [
  "FROM audit_log",
  "WHERE user_id=$1",
  "notifications={notifications}",
]){
  if(!layout.includes(marker))throw new Error("Global notifications must use real scoped system data: "+marker);
}
