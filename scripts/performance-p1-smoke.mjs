import fs from "node:fs";

const required=[
  "lib/auth.ts",
  "lib/customization.ts",
  "lib/organization-branding.ts",
  "app/dashboard/layout.tsx",
  "app/dashboard/loading.tsx",
  "app/dashboard/attendance/page.tsx",
  "components/business-ui/BusinessCards.tsx",
  "components/ui-kit/CollectionIdentity.tsx",
  "components/ReactionMap.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "app/dashboard/companies/CompanyDirectory.tsx",
  "components/SupplierDirectory.tsx",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing performance contract file: "+file);

const auth=fs.readFileSync("lib/auth.ts","utf8");
for(const marker of ['import { cache } from "react"',"async function resolveSession","export const getSession = cache(resolveSession)"]){
  if(!auth.includes(marker))throw new Error("Session request memoization missing "+marker);
}

const customization=fs.readFileSync("lib/customization.ts","utf8");
if(!customization.includes("getCustomizationSummary = cache(resolveCustomizationSummary)"))throw new Error("Customization reads must be request-memoized");
const branding=fs.readFileSync("lib/organization-branding.ts","utf8");
if(!branding.includes("getOrganizationBranding = cache(resolveOrganizationBranding)"))throw new Error("Branding reads must be request-memoized");

const layout=fs.readFileSync("app/dashboard/layout.tsx","utf8");
for(const marker of [
  "[customization, organizationBranding, preferenceResult, identityResult] = await Promise.all",
  "getCustomizationSummary()",
  "getOrganizationBranding(session.organizationId)",
]){
  if(!layout.includes(marker))throw new Error("Dashboard shell parallel-read contract missing "+marker);
}

const attendance=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of [
  "[policyResult,biometricNotice,sites,enrolled,openShift,selfSchedule]=await Promise.all",
  "[selfMovementSegment,selfDestinationTasks]=await Promise.all",
]){
  if(!attendance.includes(marker))throw new Error("Attendance parallel-read contract missing "+marker);
}

const cards=fs.readFileSync("components/business-ui/BusinessCards.tsx","utf8");
if((cards.match(/loading="lazy"/g)||[]).length<7)throw new Error("Business cards must lazy-load offscreen imagery");
if(!cards.includes('decoding="async"'))throw new Error("Business card imagery must decode asynchronously");
const identity=fs.readFileSync("components/ui-kit/CollectionIdentity.tsx","utf8");
for(const marker of ['loading="lazy"','decoding="async"','width={44}','height={44}']){
  if(!identity.includes(marker))throw new Error("List identity image performance contract missing "+marker);
}

const reaction=fs.readFileSync("components/ReactionMap.tsx","utf8");
for(const marker of [
  'document.visibilityState==="hidden"',
  "refreshing",
  'document.addEventListener("visibilitychange",onVisibilityChange)',
  'document.removeEventListener("visibilitychange",onVisibilityChange)',
]){
  if(!reaction.includes(marker))throw new Error("Reaction polling performance guard missing "+marker);
}

const loading=fs.readFileSync("app/dashboard/loading.tsx","utf8");
if(!loading.includes("<LoadingPage")||!loading.includes('label="Cargando módulo"'))throw new Error("Dashboard route loading boundary missing");

const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
for(const marker of [
  'dynamic(()=>import("@/components/UserStatisticsDashboard")',
  'dynamic(()=>import("@/components/UserAttendanceAuditCenter")',
]){
  if(!users.includes(marker))throw new Error("Users detail lazy bundle contract missing "+marker);
}
const companies=fs.readFileSync("app/dashboard/companies/CompanyDirectory.tsx","utf8");
for(const marker of [
  'dynamic(()=>import("@/components/GeofenceMapPicker")',
  'dynamic(()=>import("@/components/CompanyDocumentWorkspace")',
  'dynamic(()=>import("@/components/CompanyDocumentCreateModal")',
]){
  if(!companies.includes(marker))throw new Error("Company detail lazy bundle contract missing "+marker);
}
const suppliers=fs.readFileSync("components/SupplierDirectory.tsx","utf8");
for(const marker of [
  'dynamic(()=>import("@/components/RequisitionBuilder")',
  'dynamic(()=>import("@/components/BulkImportModal")',
]){
  if(!suppliers.includes(marker))throw new Error("Supplier detail lazy bundle contract missing "+marker);
}

console.log("Performance P1 regression checks passed.");
