import fs from "node:fs";

const required=[
  "app/phase6-modules.css",
  "components/ui-kit/StaticTable.tsx",
  "app/dashboard/page.tsx",
  "components/DashboardControls.tsx",
  "components/DashboardDateRangePicker.tsx",
  "app/dashboard/companies/CompanyDirectory.tsx",
  "components/CompanyDocumentWorkspace.tsx",
  "components/CompanyDocumentCreateModal.tsx",
  "components/LocationDirectory.tsx",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Phase 6 file: "+file);

const dashboard=fs.readFileSync("app/dashboard/page.tsx","utf8");
for(const marker of [
  "phase6-dashboard",
  "@/components/ui-kit/Card",
  "@/components/ui-kit/Badge",
  "@/components/ui-kit/TimelineProgress",
  "@/components/ui-kit/StaticTable",
  "<StaticDataTable",
  "<ProgressBar",
]){
  if(!dashboard.includes(marker))throw new Error("Dashboard Phase 6 contract missing "+marker);
}
if(dashboard.includes('className="dashboard-table"'))throw new Error("Dashboard still renders legacy dashboard-table markup");

const controls=fs.readFileSync("components/DashboardControls.tsx","utf8");
for(const marker of ["@/components/ui-kit/FormControls","@/components/ui-kit/Button","<Select","<Button"]){
  if(!controls.includes(marker))throw new Error("Dashboard controls are not migrated to UI Core: "+marker);
}
if(controls.includes("⌄"))throw new Error("Dashboard controls still contain Unicode chevron glyphs");

const range=fs.readFileSync("components/DashboardDateRangePicker.tsx","utf8");
for(const glyph of ["▣","⌄","‹","›"])if(range.includes(glyph))throw new Error("Date range picker still contains legacy glyph "+glyph);
if(!range.includes("<UiIcon")||!range.includes("<Button"))throw new Error("Date range picker must consume UI Core/icon primitives");

const companiesPage=fs.readFileSync("app/dashboard/companies/page.tsx","utf8");
for(const marker of ["CompanyRelatedSite","CompanyRelatedLocation","CompanyRelatedTechnician","CompanyRelatedDocument","organization_documents","organization_member_sites"]){
  if(!companiesPage.includes(marker))throw new Error("Companies server data source missing "+marker);
}
const companies=fs.readFileSync("app/dashboard/companies/CompanyDirectory.tsx","utf8");
for(const marker of ["phase6-company-directory","<CompanyCard","<StatTiles","status={<Badge","<LocationCreateModal","<CompanyDocumentWorkspace","<CompanyDocumentCreateModal","<ContextUserCreateModal","company-related-location-grid","company-technician-card-grid"]){
  if(!companies.includes(marker))throw new Error("Companies Phase 6 related-management migration missing "+marker);
}
if(companies.includes("company-document-gateway"))throw new Error("Company Documents tab still renders the obsolete gateway instead of the document manager");
if(companies.includes("company-staff-gateway"))throw new Error("Company Technicians tab still renders the obsolete gateway instead of technician cards");
if(companies.includes('id:"life"'))throw new Error("Company quick profile still renders the redundant life tab");
for(const marker of ['tab=locations','tab=documents','tab=technicians','initialRole="technician"','lockRole']){
  if(!companies.includes(marker))throw new Error("Contextual company workflow missing "+marker);
}
if(companies.includes("function ResourceIcon"))throw new Error("Companies still defines a private resource icon system");
if(companies.includes("function CompanyMetric"))throw new Error("Companies still defines private metric cards");

const documentWorkspace=fs.readFileSync("components/CompanyDocumentWorkspace.tsx","utf8");
for(const marker of ["company-document-workspace-v2","company-document-preview-panel","company-document-list-panel","company-document-table","Ver documento","Descargar documento","Más acciones","Cargando previsualización","<Modal","<Drawer"]){
  if(!documentWorkspace.includes(marker))throw new Error("Company document manager missing "+marker);
}
if(documentWorkspace.includes("Compartir documento"))throw new Error("Company document manager must not expose the removed Share action");
if(!documentWorkspace.includes('selectedId')||!documentWorkspace.includes('visible[0]'))throw new Error("Company document manager must auto-select the first visible document");
if(!documentWorkspace.includes('onError={()=>{setPreviewLoading(false);setPreviewError(true);}}'))throw new Error("Company document preview must expose a PDF preview error state");
const documentCreate=fs.readFileSync("components/CompanyDocumentCreateModal.tsx","utf8");
if(!documentCreate.includes("/api/organizations/")||!documentCreate.includes('name="return_to"'))throw new Error("Company document create action must reuse the existing endpoint and contextual return path");
for(const route of ["app/api/organizations/[id]/documents/route.ts","app/api/organizations/[id]/documents/[documentId]/route.ts"]){
  const source=fs.readFileSync(route,"utf8");
  if(!source.includes("safeDashboardReturn")||!source.includes("return_to"))throw new Error(route+" must preserve the contextual Company return path");
}

const locations=fs.readFileSync("components/LocationDirectory.tsx","utf8");
for(const marker of ["phase6-location-directory","<LocationCard","<SubLocationCard","<Search","<Select","<StatTiles","status={<Badge"]){
  if(!locations.includes(marker))throw new Error("Locations Phase 6 migration missing "+marker);
}
if(locations.includes("function MetricCard"))throw new Error("Locations still defines private metric cards");

const business=fs.readFileSync("components/business-ui/BusinessCards.tsx","utf8");
for(const marker of ["export function CompanyCard","export function SubLocationCard"]){
  if(!business.includes(marker))throw new Error("Business UI extension missing "+marker);
}

const prerequisite=fs.readFileSync("components/CreationPrerequisiteState.tsx","utf8");
if(!prerequisite.includes("<UiIcon"))throw new Error("Creation prerequisite state must render canonical SVG iconography");

const staticTable=fs.readFileSync("components/ui-kit/StaticTable.tsx","utf8");
if(staticTable.includes('"use client"'))throw new Error("StaticDataTable must remain server-compatible");
if(!staticTable.includes('className="ds-data-table"'))throw new Error("StaticDataTable must reuse Shared Data UI table grammar");

const css=fs.readFileSync("app/phase6-modules.css","utf8");
for(const selector of [".phase6-dashboard",".phase6-company-directory",".phase6-location-directory",".company-related-location-grid",".company-technician-card-grid",":focus-visible","@media(max-width:700px)","@media(prefers-reduced-motion:reduce)"]){
  if(!css.includes(selector))throw new Error("Phase 6 CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 6 CSS must use Design Tokens only");
const documentCss=fs.readFileSync("app/document-workspace.css","utf8");
for(const selector of [".company-document-workspace-v2",".company-document-preview-panel",".company-document-list-panel",".entity-profile-tab-action","@media(max-width:900px)","@media(prefers-reduced-motion:reduce)"]){
  if(!documentCss.includes(selector))throw new Error("Document workspace CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(documentCss))throw new Error("Document workspace CSS must use Design Tokens only");

const layout=fs.readFileSync("app/layout.tsx","utf8");
const businessIndex=layout.indexOf('import "./business-ui.css";');
const phase6Index=layout.indexOf('import "./phase6-modules.css";');
const shellIndex=layout.indexOf('import "./shell-v2.css";');
if(businessIndex<0||phase6Index<0||shellIndex<0||phase6Index<businessIndex||shellIndex<phase6Index){
  throw new Error("Phase 6 CSS must load after Business UI and before shell-v2");
}

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/phase6-modules-smoke.mjs"))throw new Error("CI does not run Phase 6 module checks");

console.log("DESWEB Design System V2 Phase 6 Dashboard/Companies/Locations checks passed.");
