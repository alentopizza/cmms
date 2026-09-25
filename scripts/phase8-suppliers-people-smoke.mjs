import fs from "node:fs";

const required=[
  "app/dashboard/suppliers/page.tsx",
  "components/SupplierDirectory.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "app/dashboard/crews/page.tsx",
  "components/CrewCreateForm.tsx",
  "app/dashboard/attendance/page.tsx",
  "components/AttendanceCapture.tsx",
  "components/AttendanceContingency.tsx",
  "components/SupervisedBiometricEnrollment.tsx",
  "components/UserStatisticsDashboard.tsx",
  "lib/attendance-context.ts",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Phase 8 file: "+file);

const supplierPage=fs.readFileSync("app/dashboard/suppliers/page.tsx","utf8");
for(const marker of ["phase8-suppliers","<Alert","iconName=\"supplier\"","icon=\"supplier\""]){
  if(!supplierPage.includes(marker))throw new Error("Suppliers Phase 8 contract missing "+marker);
}
const supplierDir=fs.readFileSync("components/SupplierDirectory.tsx","utf8");
for(const marker of ["phase8-supplier-directory","<SupplierCard","<Badge","<StatTiles","<EmptyState","ds-data-table","supplier-card-primary-action-v3","supplier-card-quick-action-v3","data-tooltip=\"Editar proveedor\"","data-tooltip=\"Crear requisición\"","data-tooltip=\"Contactar por WhatsApp\"","data-tooltip=\"Eliminar proveedor\""]){
  if(!supplierDir.includes(marker))throw new Error("SupplierDirectory Phase 8 migration missing "+marker);
}
for(const marker of ['icon:"activity"','icon:"inventory"','icon:"requisition"','email={s.email||null}','location={[s.city,countryName(s.country_code)].filter(Boolean).join(" · ")||null}']){
  if(!supplierDir.includes(marker))throw new Error("Supplier directory real-data card contract missing "+marker);
}
if(supplierDir.includes('"Ubicación sin registrar"')||supplierDir.includes('"Especialidad sin registrar"')||supplierDir.includes('"Sin contacto"')||supplierDir.includes('"Sin teléfono"')){
  throw new Error("Supplier directory must omit unavailable card fields instead of inventing placeholders");
}
if(supplierDir.includes('status={<span className={"status-badge'))throw new Error("Supplier profile still uses legacy status badge");

const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
for(const marker of ["phase8-users","<UserCard","<Badge","<Alert","<EmptyState","<StatTiles","<Button","attendanceAdminHref","Enrolar biometría inicial","Configurar asistencia"]){
  if(!users.includes(marker))throw new Error("Users Phase 8 migration missing "+marker);
}
for(const glyph of [">×<",">◎<"])if(users.includes(glyph))throw new Error("Users still contain legacy glyph "+glyph);

const cards=fs.readFileSync("components/business-ui/BusinessCards.tsx","utf8");
for(const marker of ["supplier-directory-card-v3","supplier-card-topbar-v3","supplier-card-identity-v3","supplier-card-metrics-v3","supplier-card-actions-v3"]){
  if(!cards.includes(marker))throw new Error("SupplierCard V3 composition missing "+marker);
}
if(!cards.includes('export function CrewCard'))throw new Error("Business UI missing CrewCard");
const preview=fs.readFileSync("components/business-ui/BusinessCardsPreview.tsx","utf8");
if(!preview.includes("<CrewCard"))throw new Error("/ui-kit Business UI preview does not expose CrewCard");
if(!cards.includes('"crew"'))throw new Error("Business UI missing crew domain");
const crews=fs.readFileSync("app/dashboard/crews/page.tsx","utf8");
for(const marker of ["phase8-crews","<CrewCard","<Alert","<EmptyState","iconName=\"crew\"","icon=\"crew\""]){
  if(!crews.includes(marker))throw new Error("Crews Phase 8 migration missing "+marker);
}
if(crews.includes("♕")||crews.includes('className={"status-badge'))throw new Error("Crews still use legacy leader/status glyphs");

const attendance=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of ["phase8-attendance","<ModuleHeader","<Badge","<Alert","<KpiCard","<StaticDataTable","recordProps","attendance-admin-context","organization_id","initialUserId"]){
  if(!attendance.includes(marker))throw new Error("Attendance Phase 8 orchestration missing "+marker);
}
if(attendance.includes('className="table attendance-report-table"'))throw new Error("Attendance report still uses legacy table grammar");


const attendanceContext=fs.readFileSync("lib/attendance-context.ts","utf8");
for(const marker of ["session.platformRole===\"user\"","UUID.test(candidate)"]){
  if(!attendanceContext.includes(marker))throw new Error("Attendance organization context guard missing "+marker);
}
const attendancePolicy=fs.readFileSync("app/api/attendance/policy/route.ts","utf8");
for(const marker of ["attendanceOrganizationId","organization_id","SELECT 1 FROM organizations WHERE id=$1 AND active=true"]){
  if(!attendancePolicy.includes(marker))throw new Error("Attendance policy platform context missing "+marker);
}
const supervisedRoute=fs.readFileSync("app/api/attendance/enrollment-supervised/route.ts","utf8");
for(const marker of ["attendanceOrganizationId","organizationId","actor_platform_role","actor_email"]){
  if(!supervisedRoute.includes(marker))throw new Error("Supervised biometric platform context missing "+marker);
}
if(supervisedRoute.includes("if(!session?.userId||!session.organizationId)"))throw new Error("Supervised enrollment still blocks authorized platform attendance managers");

const capture=fs.readFileSync("components/AttendanceCapture.tsx","utf8");
for(const marker of ["<UiIcon","<Badge","<Alert","<Button"]){
  if(!capture.includes(marker))throw new Error("AttendanceCapture missing V2 primitive "+marker);
}
for(const glyph of ["⌖","◎"])if(capture.includes(glyph))throw new Error("AttendanceCapture still contains legacy glyph "+glyph);

const contingency=fs.readFileSync("components/AttendanceContingency.tsx","utf8");
for(const marker of ["<UiIcon","<Badge","<Alert","<EmptyState","<Button"]){
  if(!contingency.includes(marker))throw new Error("AttendanceContingency missing V2 primitive "+marker);
}
if(contingency.includes("window.alert"))throw new Error("AttendanceContingency still uses native alert feedback");
if(!contingency.includes("organizationId"))throw new Error("Attendance contingency review does not carry company context");
const contingencyReviewRoute=fs.readFileSync("app/api/attendance/contingency/[id]/route.ts","utf8");
for(const marker of ["attendanceOrganizationId","organizationId","attendance_contingency_request","actor_platform_role","actor_email"]){
  if(!contingencyReviewRoute.includes(marker))throw new Error("Attendance contingency review context/audit missing "+marker);
}
if(contingencyReviewRoute.includes("if(!session?.userId||!session.organizationId)"))throw new Error("Contingency review still blocks authorized platform attendance managers");
const biometric=fs.readFileSync("components/SupervisedBiometricEnrollment.tsx","utf8");
for(const marker of ["<UiIcon","<Badge","<Alert","<Button","organizationId","initialUserId","id=\"biometric\""]){
  if(!biometric.includes(marker))throw new Error("SupervisedBiometricEnrollment missing V2/admin primitive "+marker);
}
for(const glyph of ["⌖","◎"])if(biometric.includes(glyph))throw new Error("Biometric enrollment still contains legacy glyph "+glyph);

const userStats=fs.readFileSync("components/UserStatisticsDashboard.tsx","utf8");
for(const marker of ["<MetricGrid","<KpiCard","<ProgressBar","<Badge","<EmptyState"]){
  if(!userStats.includes(marker))throw new Error("UserStatisticsDashboard missing V2 primitive "+marker);
}

const staticTable=fs.readFileSync("components/ui-kit/StaticTable.tsx","utf8");
if(!staticTable.includes("recordProps?:Record"))throw new Error("StaticDataTable does not support server-side record filter metadata");
if(!staticTable.includes("{...row.recordProps}"))throw new Error("StaticDataTable does not render row metadata");

const prereq=fs.readFileSync("components/CreationPrerequisiteState.tsx","utf8");
for(const marker of ["supplier:\"supplier\"","crew:\"crew\"","attendance:\"attendance\"","user:\"user\""]){
  if(!prereq.includes(marker))throw new Error("Creation prerequisite icon map missing "+marker);
}

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const selector of [".phase8-suppliers",".phase8-users",".phase8-crews",".phase8-attendance",".phase8-supplier-directory .supplier-profile-grid",".attendance-admin-context",".user-attendance-admin-panel",":focus-visible","@media(max-width:700px)","@media(prefers-reduced-motion:reduce)"]){
  if(!css.includes(selector))throw new Error("Phase 8 CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 8 CSS must use Design Tokens only");

const layout=fs.readFileSync("app/layout.tsx","utf8");
const p7=layout.indexOf('import "./phase7-modules.css";');
const p8=layout.indexOf('import "./phase8-modules.css";');
const shell=layout.indexOf('import "./shell-v2.css";');
if(p7<0||p8<0||shell<0||p8<p7||shell<p8)throw new Error("Phase 8 CSS load order is invalid");

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/phase8-suppliers-people-smoke.mjs"))throw new Error("CI does not run Phase 8 checks");

console.log("DESWEB Design System V2 Phase 8 Suppliers/People checks passed.");
