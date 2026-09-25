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
  "<MetricGrid",
  "Cuadrillas registradas",
  "Activas",
  "Inactivas",
  "<CrewDirectory",
  "activeActivityCount",
  "completedActivityCount",
]){
  if(!page.includes(marker))throw new Error("Crew page redesign contract missing "+marker);
}
for(const forbidden of ["crew-showcase-grid","<CrewCard","Zona Sur","Mantenimiento Norte","En pausa","disciplina"]){
  if(page.includes(forbidden))throw new Error("Crew page contains legacy/fictitious design marker "+forbidden);
}

const directory=fs.readFileSync("components/CrewDirectory.tsx","utf8");
for(const marker of [
  "Buscar cuadrilla, líder, sede o descripción...",
  "Todas las sedes",
  "Todos los estados",
  "Vista cuadrícula",
  "Vista listado",
  "<CrewCard",
  "<StaticDataTable",
  "Contactar por WhatsApp",
  "Llamar",
  "Enviar correo",
  "Más acciones",
  "No encontramos cuadrillas",
  "No hay cuadrillas registradas",
]){
  if(!directory.includes(marker))throw new Error("Crew directory contract missing "+marker);
}
if(directory.includes("Todas las disciplinas")||directory.includes("En pausa")){
  throw new Error("Crew directory must not invent discipline or paused status without source data");
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
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "@media(max-width:1180px)",
  "@media(max-width:620px)",
  ".crew-directory-controls-v2",
  ".crew-directory-view-toggle-v2",
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
