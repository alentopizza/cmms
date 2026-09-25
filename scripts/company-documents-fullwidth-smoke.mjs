import fs from "node:fs";

const required=[
  "app/dashboard/companies/CompanyDirectory.tsx",
  "components/EntityProfileWorkspace.tsx",
  "components/CompanyDocumentWorkspace.tsx",
  "app/business-ui.css",
  "app/phase6-modules.css",
  "app/document-workspace.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Company Documents layout file: "+file);

const companies=fs.readFileSync("app/dashboard/companies/CompanyDirectory.tsx","utf8");
if(!companies.includes('fullWidthTabIds={["documents"]}')){
  throw new Error("Company profile must mark only Documents as the full-width tab");
}
if((companies.match(/fullWidthTabIds=/g)||[]).length!==1){
  throw new Error("Company profile should have one explicit full-width tab configuration");
}
for(const marker of [
  'id:"general",label:"Información general"',
  'id:"statistics",label:"Estadísticas"',
  'id:"locations",label:"Ubicaciones"',
  'id:"documents",label:"Documentos"',
  'id:"technicians",label:"Técnicos"',
  "<CompanyDocumentWorkspace",
]){
  if(!companies.includes(marker))throw new Error("Company tab/navigation contract missing "+marker);
}

const profile=fs.readFileSync("components/EntityProfileWorkspace.tsx","utf8");
for(const marker of [
  "fullWidthTabIds = []",
  "fullWidthTabIds.includes(active.id)",
  "entity-profile-wide-tab",
  "data-active-tab={active?.id||undefined}",
  '<aside className="entity-profile-identity-card">',
  '<section className="entity-profile-content-card">',
]){
  if(!profile.includes(marker))throw new Error("Entity profile full-width contract missing "+marker);
}

const workspace=fs.readFileSync("components/CompanyDocumentWorkspace.tsx","utf8");
for(const marker of [
  "company-document-workspace-v2",
  "company-document-preview-panel",
  "company-document-list-panel",
  "selectedId",
  "selectDocument(id:string)",
  "company-document-table",
  "company-document-filterbar",
  "Cargando previsualización",
  "Descargar documento",
  "Imprimir documento",
  "Compartir documento",
]){
  if(!workspace.includes(marker))throw new Error("Existing document workspace behavior missing "+marker);
}

const businessCss=fs.readFileSync("app/business-ui.css","utf8");
for(const marker of [
  ".ds-business-profile.entity-profile-wide-tab .entity-profile-grid",
  ".ds-business-profile.entity-profile-wide-tab .entity-profile-identity-card{display:none}",
  ".ds-business-profile.entity-profile-wide-tab .entity-profile-content-card",
]){
  if(!businessCss.includes(marker))throw new Error("Business profile wide-tab CSS missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(businessCss))throw new Error("Business UI CSS must remain token-only");

const phase6Css=fs.readFileSync("app/phase6-modules.css","utf8");
for(const marker of [
  '.entity-profile-wide-tab[data-active-tab="documents"] .entity-profile-tabbar',
  '.entity-profile-wide-tab[data-active-tab="documents"] .entity-profile-tabs',
  '.entity-profile-wide-tab[data-active-tab="documents"] .entity-profile-tab-body',
  'grid-template-columns:minmax(420px,1fr) minmax(520px,1fr)',
  "@media(max-width:1180px)",
  "@media(max-width:900px)",
]){
  if(!phase6Css.includes(marker))throw new Error("Company Documents full-width CSS missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(phase6Css))throw new Error("Phase 6 CSS must remain token-only");

const documentCss=fs.readFileSync("app/document-workspace.css","utf8");
for(const marker of [
  ".company-document-workspace-v2",
  "@media(max-width:900px)",
  ".company-document-list-panel{order:1",
  ".company-document-preview-panel{order:2",
]){
  if(!documentCss.includes(marker))throw new Error("Existing responsive document workspace contract missing "+marker);
}

console.log("Company Documents full-width layout checks passed.");
