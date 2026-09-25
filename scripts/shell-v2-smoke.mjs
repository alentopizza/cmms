import fs from "node:fs";

for(const file of ["app/shell-v2.css","components/DashboardSidebar.tsx","components/DashboardChrome.tsx","components/DashboardNavigation.tsx","components/UiIcon.tsx"]){
  if(!fs.existsSync(file))throw new Error("Missing Phase 3 shell file: "+file);
}
const layout=fs.readFileSync("app/layout.tsx","utf8");
const coreIndex=layout.indexOf('import "./ui-kit-core.css";');
const shellIndex=layout.indexOf('import "./shell-v2.css";');
if(coreIndex<0||shellIndex<0||shellIndex<coreIndex)throw new Error("shell-v2.css must load after UI Core");

const dashboard=fs.readFileSync("app/dashboard/layout.tsx","utf8");
if(!dashboard.includes("desweb-shell-v2"))throw new Error("Dashboard shell is not opted into Phase 3 V2");
for(const legacy of ['icon: "▦"','icon: "◫"','icon: "⌂"','icon: "▤"'])if(dashboard.includes(legacy))throw new Error("Legacy Unicode navigation icon remains: "+legacy);

const sidebar=fs.readFileSync("components/DashboardSidebar.tsx","utf8");
for(const required of ['<UiIcon name={item.icon}','name="reorder"','name="reset"','name="logout"'])if(!sidebar.includes(required))throw new Error("Sidebar V2 icon contract missing "+required);

const chrome=fs.readFileSync("components/DashboardChrome.tsx","utf8");
if(!chrome.includes('pathname.startsWith("/dashboard/requisitions")'))throw new Error("Requisitions must have contextual header metadata");
if(!chrome.includes("<Avatar "))throw new Error("Header account must consume UI Kit Avatar");

const css=fs.readFileSync("app/shell-v2.css","utf8");
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 3 shell CSS must use semantic tokens");
for(const required of [".desweb-shell-v2",":focus-visible","@media(max-width:900px)","@media(prefers-reduced-motion:reduce)"])if(!css.includes(required))throw new Error("Phase 3 shell CSS missing "+required);

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/shell-v2-smoke.mjs"))throw new Error("CI does not run Phase 3 shell smoke checks");
console.log("DESWEB Design System V2 Phase 3 shell/navigation checks passed.");
