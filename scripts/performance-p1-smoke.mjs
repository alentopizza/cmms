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
  "app/dashboard/users/page.tsx",
  "components/EntityProfileWorkspace.tsx",
  "app/api/users/[id]/documents/route.ts",
  "app/api/users/[id]/emergency-contact/route.ts",
  "app/dashboard/companies/CompanyDirectory.tsx",
  "components/SupplierDirectory.tsx",
  "components/LocationDirectory.tsx",
  "app/dashboard/work-orders/page.tsx",
  "app/dashboard/maintenance/page.tsx",
  "app/api/reaction/snapshot/route.ts",
  "app/api/organizations/[id]/assets/[asset]/route.ts",
  "app/api/customization/assets/[asset]/route.ts",
  "lib/db.ts",
  "db/migrations/041_performance_work_order_hot_paths.sql",
  "db/migrations/042_performance_user_hot_paths.sql",
  "scripts/performance-build-report.mjs",
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

const usersPage=fs.readFileSync("app/dashboard/users/page.tsx","utf8");
for(const marker of [
  "LEFT JOIN LATERAL (",
  "array_agg(oms.site_id::text ORDER BY site.name) site_ids",
  "array_agg(site.name ORDER BY site.name) site_names",
  "site_scope ON true",
]){
  if(!usersPage.includes(marker))throw new Error("Users site aggregation performance contract missing "+marker);
}
if((usersPage.match(/SELECT array_agg\(oms\.site_id::text ORDER BY site\.name\)/g)||[]).length>0)throw new Error("Users must not scan site membership twice per row");

const userServerPage=fs.readFileSync("app/dashboard/users/page.tsx","utf8");
for(const forbidden of ["LIMIT 1600","ManagedUserDocument","ManagedEmergencyContact","documents={documents.rows}","emergencyContacts={emergencyContacts.rows}"]){
  if(userServerPage.includes(forbidden))throw new Error("Users initial render must not preload detail data: "+forbidden);
}

const profileWorkspace=fs.readFileSync("components/EntityProfileWorkspace.tsx","utf8");
for(const marker of ["onTabChange?: (tabId:string)=>void","onTabChange?.(tab.id)"]){
  if(!profileWorkspace.includes(marker))throw new Error("Profile tab-demand hook missing "+marker);
}

const userDocumentsRoute=fs.readFileSync("app/api/users/[id]/documents/route.ts","utf8");
for(const marker of ["export async function GET","users.manage","WHERE organization_id=$1 AND user_id=$2","NextResponse.json({documents:result.rows})"]){
  if(!userDocumentsRoute.includes(marker))throw new Error("Lazy user documents endpoint contract missing "+marker);
}
const userEmergencyRoute=fs.readFileSync("app/api/users/[id]/emergency-contact/route.ts","utf8");
for(const marker of ["export async function GET","users.manage","FROM user_emergency_contacts","NextResponse.json({contact:result.rows[0]||null})"]){
  if(!userEmergencyRoute.includes(marker))throw new Error("Lazy emergency contact endpoint contract missing "+marker);
}

const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
for(const marker of [
  'dynamic(()=>import("@/components/UserStatisticsDashboard")',
  'dynamic(()=>import("@/components/UserAttendanceAuditCenter")',
  'preferredTab!=="statistics"',
  '["documents","emergency"].includes(preferredTab)',
  'onTabChange={setPreferredTab}',
  'fetch("/api/users/"+selectedUserId+"/"+endpoint',
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

const locations=fs.readFileSync("components/LocationDirectory.tsx","utf8");
for(const marker of [
  'dynamic(()=>import("@/components/GeofenceMapPicker")',
  'import("@/components/ContextCreateModals").then(module=>module.SubLocationCreateModal)',
]){
  if(!locations.includes(marker))throw new Error("Location detail lazy bundle contract missing "+marker);
}

const workOrders=fs.readFileSync("app/dashboard/work-orders/page.tsx","utf8");
for(const marker of [
  'const creationGatePromise=getCreationGateForScope("work_order"',
  "const summaryPromise",
  "const facetsPromise",
  "const assetsPromise",
  "const [creationGate,summaryResult,facetsResult,assets]=await Promise.all",
  "const orders=await query<OrderRow>",
]){
  if(!workOrders.includes(marker))throw new Error("Work Orders server-read contract missing "+marker);
}

const maintenance=fs.readFileSync("app/dashboard/maintenance/page.tsx","utf8");
for(const marker of [
  'const creationGatePromise=getCreationGateForScope("routine"',
  "const summaryPromise",
  "const facetsPromise",
  "const assetsPromise",
  "const [creationGate,summaryResult,facetsResult,assets]=await Promise.all",
  "const plans=await query<PlanRow>",
]){
  if(!maintenance.includes(marker))throw new Error("Maintenance server-read contract missing "+marker);
}

const reactionSnapshot=fs.readFileSync("app/api/reaction/snapshot/route.ts","utf8");
for(const marker of [
  "const companiesPromise=query<CompanyRow>",
  "const sitesPromise=query<SiteRow>",
  "const techniciansPromise=query<TechRow>",
  "const activitiesPromise=query<ActivityRow>",
  "const [companies,sites,technicians,activities]=await Promise.all",
]){
  if(!reactionSnapshot.includes(marker))throw new Error("Reaction snapshot parallel-read contract missing "+marker);
}

const orgAsset=fs.readFileSync("app/api/organizations/[id]/assets/[asset]/route.ts","utf8");
if(!orgAsset.includes('"Cache-Control": "private, max-age=300"')||orgAsset.includes('"Cache-Control": "no-store"'))throw new Error("Organization imagery must use short private browser cache");
const customizationAsset=fs.readFileSync("app/api/customization/assets/[asset]/route.ts","utf8");
if(!customizationAsset.includes('"Cache-Control": "public, max-age=300"'))throw new Error("Customization imagery must use short public browser cache");

const db=fs.readFileSync("lib/db.ts","utf8");
for(const marker of ["DB_POOL_MAX","DB_SLOW_QUERY_MS",'console.warn("[db:slow]"']){
  if(!db.includes(marker))throw new Error("Database performance telemetry contract missing "+marker);
}

const migration=fs.readFileSync("db/migrations/041_performance_work_order_hot_paths.sql","utf8");
for(const marker of [
  "work_orders_org_requested_at_idx",
  "work_orders_requested_by_recent_idx",
  "work_orders_assigned_to_recent_idx",
  "work_order_tasks_work_order_idx",
]){
  if(!migration.includes(marker))throw new Error("Audited work-order index missing "+marker);
}

const userMigration=fs.readFileSync("db/migrations/042_performance_user_hot_paths.sql","utf8");
for(const marker of [
  "meter_readings_recorded_by_idx",
  "work_order_comments_user_idx",
  "audit_log_user_idx",
]){
  if(!userMigration.includes(marker))throw new Error("Audited user activity index missing "+marker);
}

const buildReport=fs.readFileSync("scripts/performance-build-report.mjs","utf8");
for(const marker of [".next/static","public/biometric-models","Performance build report"]){
  if(!buildReport.includes(marker))throw new Error("Build measurement report missing "+marker);
}

console.log("Performance P1 regression checks passed.");
