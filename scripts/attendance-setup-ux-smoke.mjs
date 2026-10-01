import fs from "node:fs";

const required=[
  "app/dashboard/attendance/page.tsx",
  "components/AttendanceSetupWorkspace.tsx",
  "components/ui-kit/Navigation.tsx",
  "app/ui-kit-core.css",
  "app/phase8-modules.css",
  "app/api/attendance/policy/route.ts",
  "components/SupervisedBiometricEnrollment.tsx",
  "components/SelfBiometricEnrollment.tsx",
  "components/BiometricEnrollmentAdmin.tsx",
  "components/AttendanceContingency.tsx",
  "components/UserAttendanceAuditCenter.tsx",
  "components/AttendanceOperationalReport.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "app/dashboard/reports/page.tsx",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Attendance setup UX missing "+file);

const page=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of [
  'label:"Configuración",description:"Datos generales"',
  'label:"Sedes",description:"Geocercas"',
  'label:"Enrolamiento",description:"Biometría"',
  'label:"Política",description:"Reglas y roles"',
  'label:"Resumen",description:"Confirmación"',
  "<AttendanceSetupWorkspace",
  "<BiometricEnrollmentAdmin",
  "<SelfBiometricEnrollment",
  "<AttendanceCapture",
  "<AttendanceContingencyReview",
  "<UserAttendanceAuditCenter",
  "<AttendanceOperationalReport",
  'view:"operation"',
  'step:"1"',
  'step:"5"',
  'return_step',
  "attendance-company-header-control",
  "attendance-setup-summary-grid",
]){
  if(!page.includes(marker))throw new Error("Attendance setup page contract missing "+marker);
}

if(page.includes("attendance-admin-context")){
  throw new Error("Legacy long-scroll attendance admin context should not remain in the redesigned page");
}
if(page.includes('className="attendance-redesign-head"')){
  throw new Error("Attendance must not render a duplicated secondary header");
}
for(const marker of [
  'action={globalOperator?<form',
  'className="attendance-company-header-control"',
  'aria-label="Empresa de asistencia"',
  'className="attendance-company-switch"',
  'data-tooltip="Cambiar empresa"',
]){
  if(!page.includes(marker))throw new Error("Compact attendance company header control missing "+marker);
}
const shellCss=fs.readFileSync("app/shell-v2.css","utf8");
for(const marker of [
  ".attendance-company-header-control",
  ".attendance-company-switch",
  "@media(max-width:767px)",
]){
  if(!shellCss.includes(marker))throw new Error("Attendance header responsive styling missing "+marker);
}
if(page.includes("<SupervisedBiometricEnrollment")){
  throw new Error("Attendance page must not mount supervised enrollment as the primary setup flow");
}
const biometricAdmin=fs.readFileSync("components/BiometricEnrollmentAdmin.tsx","utf8");
if((biometricAdmin.match(/<SupervisedBiometricEnrollment/g)||[]).length!==1){
  throw new Error("Biometric admin center must preserve one assisted-enrollment fallback");
}
for(const marker of ["Cobertura biométrica","Pendiente aprobación","Aprobar identidad","Quién ya lo tiene y quién falta"]){
  if(!biometricAdmin.includes(marker))throw new Error("Biometric admin coverage center missing "+marker);
}
const selfEnrollment=fs.readFileSync("components/SelfBiometricEnrollment.tsx","utf8");
for(const marker of ["Leer política","Verificar sede","Prueba de vida activa","Pendiente de aprobación única"]){
  if(!selfEnrollment.includes(marker))throw new Error("Self biometric enrollment missing "+marker);
}
if((page.match(/<AttendanceOperationalReport/g)||[]).length!==1){
  throw new Error("Attendance setup must keep one operational report implementation");
}
if((page.match(/action="\/api\/attendance\/policy"/g)||[]).length!==1){
  throw new Error("Attendance setup must keep one canonical policy form");
}

const workspace=fs.readFileSync("components/AttendanceSetupWorkspace.tsx","utf8");
for(const marker of ["<Stepper","<CircularProgress","<StepProgress","Anterior","nextLabel","attendance-setup-progress"]){
  if(!workspace.includes(marker))throw new Error("Attendance setup workspace missing "+marker);
}

const navigation=fs.readFileSync("components/ui-kit/Navigation.tsx","utf8");
for(const marker of ["export type StepperItem","export function Stepper","aria-current={active?\"step\":undefined}","ds-stepper-marker"]){
  if(!navigation.includes(marker))throw new Error("Reusable Stepper contract missing "+marker);
}

const coreCss=fs.readFileSync("app/ui-kit-core.css","utf8");
for(const marker of [".ds-stepper",".ds-stepper-item.is-active",".ds-stepper-item.is-completed","overflow-x:auto"]){
  if(!coreCss.includes(marker))throw new Error("Reusable Stepper CSS missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(coreCss))throw new Error("UI Kit core must remain token-only");

const moduleCss=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [
  ".attendance-setup-layout",
  ".attendance-setup-main",
  ".attendance-setup-progress",
  ".attendance-setup-role-grid",
  ".attendance-setup-summary-grid",
  "@media(max-width:650px)",
]){
  if(!moduleCss.includes(marker))throw new Error("Attendance setup responsive styles missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(moduleCss))throw new Error("Phase 8 module CSS must remain token-only");

const policy=fs.readFileSync("app/api/attendance/policy/route.ts","utf8");
for(const marker of ["return_step",'target.searchParams.set("view","setup")',"attendanceOrganizationId"]){
  if(!policy.includes(marker))throw new Error("Attendance policy setup-navigation integration missing "+marker);
}

const enrollment=fs.readFileSync("components/SupervisedBiometricEnrollment.tsx","utf8");
for(const marker of ["Enrolamiento asistido excepcional","Activar cámara y enrolar","Verificar presencia en la sede","identityChecked","consent"]){
  if(!enrollment.includes(marker))throw new Error("Assisted biometric recovery flow changed unexpectedly: "+marker);
}

const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
for(const marker of ['params.set("view","setup")','params.set("step","3")',"view=operation#attendance-audit"]){
  if(!users.includes(marker))throw new Error("User → Attendance deep link missing "+marker);
}

const reports=fs.readFileSync("app/dashboard/reports/page.tsx","utf8");
if(!reports.includes("/dashboard/attendance?view=operation#attendance-report")){
  throw new Error("Reports → Attendance operational report deep link is not targeting the operation view");
}

console.log("Attendance five-step setup UX checks passed.");
