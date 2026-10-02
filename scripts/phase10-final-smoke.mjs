import fs from "node:fs";

const required=[
  "app/dashboard/reports/page.tsx",
  "app/dashboard/settings/page.tsx",
  "app/dashboard/personalization/page.tsx",
  "app/dashboard/brand/page.tsx",
  "components/ThemePreferences.tsx",
  "app/phase10-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Phase 10 file: "+file);

const reports=fs.readFileSync("app/dashboard/reports/page.tsx","utf8");
for(const marker of ["phase10-reports","<DashboardControls","<ModuleExportMenu","entity=\"assets\"","entity=\"inventory\"","entity=\"kardex\"","/dashboard/attendance","/dashboard/requisitions"]){
  if(!reports.includes(marker))throw new Error("Reports center contract missing "+marker);
}
if(/\b(INSERT|UPDATE|DELETE)\b/i.test(reports))throw new Error("Reports center must not introduce a second write/data authority");

const settings=fs.readFileSync("app/dashboard/settings/page.tsx","utf8");
for(const marker of ["phase10-settings","<Alert","<Badge","<ProgressBar","<UiIcon","<Button","/dashboard/brand","/api/customization","<ThemePreferences"]){
  if(!settings.includes(marker))throw new Error("Settings Phase 10 migration missing "+marker);
}
const brandPage=fs.readFileSync("app/dashboard/brand/page.tsx","utf8");
if(!brandPage.includes("BrandPersonalization")||!brandPage.includes("Personalización de marca"))throw new Error("Dedicated Organization brand experience missing");
if(settings.includes('className="notice '))throw new Error("Settings still renders legacy notice feedback");

const personalization=fs.readFileSync("app/dashboard/personalization/page.tsx","utf8");
for(const marker of ["phase10-personalization","<Alert","<Badge","<Button","<UiIcon","/api/customization"]){
  if(!personalization.includes(marker))throw new Error("Personalization Phase 10 migration missing "+marker);
}
if(personalization.includes('className="notice '))throw new Error("Personalization still renders legacy notice feedback");

const theme=fs.readFileSync("components/ThemePreferences.tsx","utf8");
for(const marker of ['icon: "sun"','icon: "moon"','icon: "system"',"aria-pressed","<UiIcon","<Badge"]){
  if(!theme.includes(marker))throw new Error("ThemePreferences V2 contract missing "+marker);
}

const nav=fs.readFileSync("app/dashboard/layout.tsx","utf8");
if(!nav.includes('{ id: "reports", icon: "report", label: "Reportes", href: "/dashboard/reports" }'))throw new Error("Reports stable navigation item missing");
const chrome=fs.readFileSync("components/DashboardChrome.tsx","utf8");
if(!chrome.includes('pathname.startsWith("/dashboard/reports")')||!chrome.includes('icon: "report"'))throw new Error("Reports contextual header missing");
const icons=fs.readFileSync("components/UiIcon.tsx","utf8");
for(const icon of ['"report"','"sun"','"moon"','"system"'])if(!icons.includes(icon))throw new Error("UiIcon missing "+icon);

const css=fs.readFileSync("app/phase10-modules.css","utf8");
for(const selector of [
  ".phase10-reports",
  ".phase10-settings",
  ".phase10-personalization",
  ".phase10-report-card{",
  "overflow:visible",
  ".phase10-report-card:has(.profile-export-menu[open])",
  "z-index:60",
  ".phase10-report-card .profile-export-options",
  "z-index:70",
  ":focus-visible",
  "@media(max-width:700px)",
  "@media(prefers-reduced-motion:reduce)",
]){
  if(!css.includes(selector))throw new Error("Phase 10 CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 10 CSS must use Design Tokens only");

const root=fs.readFileSync("app/layout.tsx","utf8");
const p9=root.indexOf('import "./phase9-modules.css";');
const p10=root.indexOf('import "./phase10-modules.css";');
const shell=root.indexOf('import "./shell-v2.css";');
if(p9<0||p10<0||shell<0||p10<p9||shell<p10)throw new Error("Phase 10 CSS load order is invalid");

const manual=fs.readFileSync("lib/user-manual.ts","utf8");
if(!manual.includes('id:"reports"')||!manual.includes('href:"/dashboard/reports"'))throw new Error("User manual does not document Reports");

const forbidden=/[⌂⌗◇▤◎✦文◐◒☀⌕♕☎]/;
for(const file of ["app/dashboard/settings/page.tsx","app/dashboard/personalization/page.tsx","app/dashboard/reports/page.tsx","components/ThemePreferences.tsx"]){
  const src=fs.readFileSync(file,"utf8");
  if(forbidden.test(src))throw new Error(file+" still contains legacy decorative glyphs");
}

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/phase10-final-smoke.mjs"))throw new Error("CI does not run Phase 10 smoke");
if(!workflow.includes("node scripts/design-system-final-audit.mjs"))throw new Error("CI does not run final Design System audit");

console.log("DESWEB Design System V2 Phase 10 final-surface checks passed.");
