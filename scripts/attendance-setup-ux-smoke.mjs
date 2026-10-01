import fs from "node:fs";

const required=[
  "app/dashboard/attendance/page.tsx",
  "components/AttendanceEditGuard.tsx",
  "components/BiometricEnrollmentAdmin.tsx",
  "components/SelfBiometricEnrollment.tsx",
  "components/UserAttendanceAuditCenter.tsx",
  "components/AttendanceOperationalReport.tsx",
  "app/api/attendance/policy/route.ts",
  "app/api/sites/[id]/route.ts",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Attendance direct configuration missing "+file);

const page=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of [
  'label:"Configuración"',
  'label:"Operación y reportes"',
  "attendance-config-page",
  "Política y roles",
  "Sedes y geocercas",
  "Cobertura biométrica",
  "<AttendanceEditGuard",
  'action="/api/attendance/policy"',
  'action={"/api/sites/"+site.id}',
  'name="return_to"',
  "<BiometricEnrollmentAdmin",
  "El enrolamiento continúa durante la operación",
]){
  if(!page.includes(marker))throw new Error("Attendance direct configuration contract missing "+marker);
}
for(const forbidden of [
  "<AttendanceSetupWorkspace",
  "setupSteps",
  "setupStepContent",
  "Resumen y confirmación",
  "Progreso de configuración",
  'href={"/dashboard/locations/"+site.id}',
]){
  if(page.includes(forbidden))throw new Error("Redundant attendance setup flow must not remain: "+forbidden);
}

const guard=fs.readFileSync("components/AttendanceEditGuard.tsx","utf8");
for(const marker of [
  "Continuar a edición",
  "Confirmar cambios",
  "Guardar cambios",
  "checkValidity",
  "reportValidity",
]){
  if(!guard.includes(marker))throw new Error("Attendance guarded edit flow missing "+marker);
}

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [
  ".attendance-config-page",
  ".attendance-config-card",
  ".attendance-config-summary-grid",
  ".attendance-site-grid-editable",
  "@media(max-width:650px)",
]){
  if(!css.includes(marker))throw new Error("Attendance direct configuration responsive CSS missing "+marker);
}

const policy=fs.readFileSync("app/api/attendance/policy/route.ts","utf8");
if(!policy.includes("attendanceOrganizationId"))throw new Error("Attendance policy organization scope changed unexpectedly");

const siteApi=fs.readFileSync("app/api/sites/[id]/route.ts","utf8");
for(const marker of ["geofence_radius_m","canAccessOrganization","canAccessSite","return_to"]){
  if(!siteApi.includes(marker))throw new Error("Attendance inline site editing must reuse existing site validation: "+marker);
}

console.log("Attendance direct configuration UX checks passed.");
