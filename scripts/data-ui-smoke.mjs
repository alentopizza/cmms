import fs from "node:fs";

const requiredFiles=[
  "components/ui-kit/DataControls.tsx",
  "components/ui-kit/DataTable.tsx",
  "components/ui-kit/Metrics.tsx",
  "components/ui-kit/Charts.tsx",
  "components/ui-kit/TimelineProgress.tsx",
  "components/ui-kit/DataPatternsPreview.tsx",
  "app/data-ui.css",
];
for(const file of requiredFiles){
  if(!fs.existsSync(file))throw new Error("Missing Phase 4 Shared Data UI file: "+file);
}

const barrel=fs.readFileSync("components/ui-kit/index.ts","utf8");
for(const symbol of [
  "Search","FilterPanel","FilterGroup","DataTable","Pagination","RowActions",
  "KpiCard","MetricGrid","StatTiles","LineChart","ProgressBar","CircularProgress","Timeline","StepProgress","DataPatternsPreview",
]){
  if(!barrel.includes(symbol))throw new Error("Shared Data UI barrel does not export "+symbol);
}

for(const file of requiredFiles.filter(file=>file.endsWith(".tsx"))){
  const source=fs.readFileSync(file,"utf8");
  const hex=source.match(/#[0-9a-fA-F]{3,8}\b/g);
  if(hex?.length)throw new Error(file+" contains hardcoded hexadecimal colors: "+hex.join(", "));
}

const css=fs.readFileSync("app/data-ui.css","utf8");
for(const selector of [".ds-search",".ds-filter-trigger",".ds-data-table",".ds-pagination",".ds-kpi-card",".ds-line-chart",".ds-timeline",".ds-progress-track"]){
  if(!css.includes(selector))throw new Error("Shared Data UI CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Shared Data UI CSS must use Design Tokens instead of hardcoded hex colors");
for(let index=1;index<=10;index++){
  if(!css.includes("var(--chart-"+index+")"))throw new Error("Chart palette token --chart-"+index+" is not wired into Shared Data UI");
}
if(!css.includes(":focus-visible"))throw new Error("Shared Data UI focus-visible styles are required");
if(!css.includes("@media(prefers-reduced-motion:reduce)"))throw new Error("Shared Data UI reduced-motion support is required");

const dataTable=fs.readFileSync("components/ui-kit/DataTable.tsx","utf8");
for(const contract of ["aria-sort","selectable","bulkActions","RowActions","Pagination"]){
  if(!dataTable.includes(contract))throw new Error("DataTable contract missing "+contract);
}

const controls=fs.readFileSync("components/ui-kit/DataControls.tsx","utf8");
for(const contract of ['event.key==="Escape"',"aria-haspopup=\"dialog\"","Limpiar búsqueda"]){
  if(!controls.includes(contract))throw new Error("Search/Filter accessibility contract missing "+contract);
}

const moduleHeader=fs.readFileSync("components/ModuleHeader.tsx","utf8");
if(!moduleHeader.includes("@/components/ui-kit/DataControls")||!moduleHeader.includes("@/components/ui-kit/FormControls")){
  throw new Error("ModuleHeader must delegate Search/Filter UI to Shared Data UI");
}
if(!moduleHeader.includes('querySelectorAll<HTMLElement>("[data-module-record]")')){
  throw new Error("ModuleHeader must preserve authorized DOM-record filtering compatibility");
}

const analytics=fs.readFileSync("components/DashboardAnalytics.tsx","utf8");
if(!analytics.includes("@/components/ui-kit/Metrics")||!analytics.includes("@/components/ui-kit/Charts")){
  throw new Error("DashboardAnalytics must delegate KPI/chart rendering to Shared Data UI");
}

const page=fs.readFileSync("app/ui-kit/page.tsx","utf8");
for(const anchor of ["#data-controls","#tables","#metrics","#charts","#progress","DataPatternsPreview"]){
  if(!page.includes(anchor))throw new Error("/ui-kit missing Phase 4 catalog section "+anchor);
}

const layout=fs.readFileSync("app/layout.tsx","utf8");
const coreIndex=layout.indexOf('import "./ui-kit-core.css";');
const dataIndex=layout.indexOf('import "./data-ui.css";');
const shellIndex=layout.indexOf('import "./shell-v2.css";');
if(coreIndex<0||dataIndex<0||shellIndex<0||dataIndex<coreIndex||shellIndex<dataIndex){
  throw new Error("Shared Data UI CSS must load after UI Core and before shell-v2");
}

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/data-ui-smoke.mjs"))throw new Error("CI does not run Phase 4 Shared Data UI smoke checks");

console.log("DESWEB Design System V2 Phase 4 Shared Data UI checks passed.");
