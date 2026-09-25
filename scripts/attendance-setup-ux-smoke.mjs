import fs from "node:fs";

const required=[
  "app/dashboard/attendance/page.tsx",
  "components/AttendanceSetupWorkspace.tsx",
  "components/ui-kit/Navigation.tsx",
  "app/ui-kit-core.css",
  "app/phase8-modules.css",
  "app/api/attendance/policy/route.ts",
  "components/SupervisedBiometricEnrollment.tsx",
  "components/AttendanceContingency.tsx",
  "components/UserAttendanceAuditCenter.tsx",
  "components/AttendanceOperationalReport.tsx",
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
  "<SupervisedBiometricEnrollment",
  "<AttendanceCapture",
  "<AttendanceContingencyReview",
  "<UserAttendanceAuditCenter",
  "<AttendanceOperationalReport",
  'view:"operation"',
  'step:"1"',
  'step:"5"',
  'return_step',
  "attendance-redesign-head",
  "attendance-setup-summary-grid",
]){
  if(!page.includes(marker))throw new Error("Attendance setup page contract missing "+marker);
}

if(page.includes("attendance-admin-context")){
  throw new Error("Legacy long-scroll attendance admin context should not remain in the redesigned page");
}
if((page.match(/<SupervisedBiometricEnrollment/g)||[]).length!==1){
  throw new Error("Attendance setup must reuse exactly one supervised biometric enrollment component");
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
for(const marker of ["return_step",'target.searchParams.set("view", "setup")',"attendanceOrganizationId"]){
  if(!policy.includes(marker))throw new Error("Attendance policy setup-navigation integration missing "+marker);
}

const enrollment=fs.readFileSync("components/SupervisedBiometricEnrollment.tsx","utf8");
for(const marker of ["Activar cámara y enrolar","Verificar presencia en la sede","identityChecked","consent"]){
  if(!enrollment.includes(marker))throw new Error("Existing biometric enrollment flow changed unexpectedly: "+marker);
}

console.log("Attendance five-step setup UX checks passed.");
