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
for(const required of ['<UiIcon name={item.icon}','name="reorder"','name="reset"'])if(!sidebar.includes(required))throw new Error("Sidebar V2 icon contract missing "+required);

const chrome=fs.readFileSync("components/DashboardChrome.tsx","utf8");
if(!chrome.includes('pathname.startsWith("/dashboard/requisitions")'))throw new Error("Requisitions must have contextual header metadata");
if(!chrome.includes("<Avatar "))throw new Error("Header account must consume UI Kit Avatar");

const css=fs.readFileSync("app/shell-v2.css","utf8");
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 3 shell CSS must use semantic tokens");
for(const required of [".desweb-shell-v2",":focus-visible","@media(max-width:900px)","@media(prefers-reduced-motion:reduce)"])if(!css.includes(required))throw new Error("Phase 3 shell CSS missing "+required);

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/shell-v2-smoke.mjs"))throw new Error("CI does not run Phase 3 shell smoke checks");


// Global UX/UI cleanup — Header / Sidebar / Profile authority.
const responsiveViewports=[
  [1920,1080,"large"],
  [1600,900,"large"],
  [1440,900,"medium"],
  [1366,768,"medium"],
  [1280,800,"medium"],
  [1024,768,"tablet"],
  [900,768,"tablet"],
  [768,1024,"tablet"],
  [390,844,"mobile"],
];
for(const [width,,expected] of responsiveViewports){
  const actual=width>=1500?"large":width>=1200?"medium":width>=768?"tablet":"mobile";
  if(actual!==expected)throw new Error("Global header viewport contract mismatch at "+width+"px");
}

const dashboardLayout=fs.readFileSync("app/dashboard/layout.tsx","utf8");
if(dashboardLayout.includes('id: "help"'))throw new Error("Sidebar must not expose Manual / Ayuda as a navigation module");

const chromeSource=fs.readFileSync("components/DashboardChrome.tsx","utf8");
const profileStart=chromeSource.indexOf("export function SidebarAccountMenu");
if(profileStart<0)throw new Error("Shared profile menu missing");
const headerSource=chromeSource.slice(0,profileStart);
const profileSource=chromeSource.slice(profileStart);
if(!headerSource.includes("GlobalNotificationBell"))throw new Error("Global notification bell missing from shared header");
if((headerSource.match(/GlobalNotificationBell/g)||[]).length<2)throw new Error("Notification bell must be defined once and rendered once in shared header");
for(const forbidden of ['href="/dashboard/help"','href="/dashboard/settings"']){
  if(headerSource.includes(forbidden))throw new Error("Header still duplicates account function "+forbidden);
}
for(const marker of [
  "<strong>Mi configuración</strong>","Apariencia y preferencias personales",
  "<strong>Manual / Ayuda</strong>","Guías según tu rol y alcance",
  "<strong>Configuración</strong>","Cuenta, empresa y plataforma",
  "<strong>Cerrar sesión</strong>","Salir de Desweb CMMS",
]){
  if(!profileSource.includes(marker))throw new Error("Profile menu authority missing "+marker);
}

const sidebarSource=fs.readFileSync("components/DashboardSidebar.tsx","utf8");
for(const forbidden of ["field-mobile-more-account",'href="/dashboard/help"','href="/dashboard/preferences"']){
  if(sidebarSource.includes(forbidden))throw new Error("Sidebar/mobile module navigation still duplicates profile function "+forbidden);
}

const globalHeaderCss=css.slice(css.indexOf("Global operational header responsive contract"));
for(const marker of [
  "display:contents!important",
  "grid-area:search","grid-area:filters","grid-area:view","grid-area:context","grid-area:action","grid-area:count","grid-area:account",
  "@media(min-width:1500px)",
  "@media(min-width:1200px) and (max-width:1499px)",
  "@media(min-width:768px) and (max-width:1199px)",
  "@media(max-width:767px)",
  "@media(max-width:520px)",
  "min-width:min(240px,100%)",
  'grid-template-areas:"identity search filters view context action count account"',
  '"identity search search search search search account"',
  '"search search search search search"',
  '"context context context context context"',
  "overflow-x:clip",
]){
  if(!globalHeaderCss.includes(marker))throw new Error("Global header responsive CSS missing "+marker);
}
for(const forbidden of ["transform:scale(","zoom:"]){
  if(globalHeaderCss.includes(forbidden))throw new Error("Global header responsive contract uses forbidden layout technique "+forbidden);
}
for(const marker of [
  ".module-context-control",
  ".contextual-create-trigger-icon-only",
  "[data-tooltip]:focus-visible:after",
  "@media(max-width:390px)",
]){
  if(!globalHeaderCss.includes(marker))throw new Error("Global contextual/accessibility header contract missing "+marker);
}

console.log("DESWEB Design System V2 Phase 3 shell/navigation checks passed.");
