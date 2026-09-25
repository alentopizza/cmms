import fs from "node:fs";

const required=[
  "app/phase6-modules.css",
  "components/ui-kit/StaticTable.tsx",
  "app/dashboard/page.tsx",
  "components/DashboardControls.tsx",
  "components/DashboardDateRangePicker.tsx",
  "app/dashboard/companies/CompanyDirectory.tsx",
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

const companies=fs.readFileSync("app/dashboard/companies/CompanyDirectory.tsx","utf8");
for(const marker of ["phase6-company-directory","<CompanyCard","<StatTiles","status={<Badge"]){
  if(!companies.includes(marker))throw new Error("Companies Phase 6 migration missing "+marker);
}
if(companies.includes("function ResourceIcon"))throw new Error("Companies still defines a private resource icon system");
if(companies.includes("function CompanyMetric"))throw new Error("Companies still defines private metric cards");

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
for(const selector of [".phase6-dashboard",".phase6-company-directory",".phase6-location-directory",":focus-visible","@media(max-width:700px)","@media(prefers-reduced-motion:reduce)"]){
  if(!css.includes(selector))throw new Error("Phase 6 CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 6 CSS must use Design Tokens only");

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
