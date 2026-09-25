import fs from "node:fs";

const required=[
  "db/migrations/038_attendance_schedules_displacements.sql",
  "lib/attendance-scope.ts",
  "app/api/attendance/schedules/route.ts",
  "app/api/attendance/displacements/route.ts",
  "app/api/attendance/clock/route.ts",
  "components/AttendanceScheduleEditor.tsx",
  "components/AttendanceCapture.tsx",
  "components/SupervisedBiometricEnrollment.tsx",
  "app/dashboard/attendance/page.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing attendance scheduling/displacement file: "+file);

const migration=fs.readFileSync("db/migrations/038_attendance_schedules_displacements.sql","utf8");
for(const marker of [
  "CREATE TABLE IF NOT EXISTS user_attendance_schedules",
  "ADD COLUMN IF NOT EXISTS current_site_id",
  "ADD COLUMN IF NOT EXISTS check_out_site_id",
  "ADD COLUMN IF NOT EXISTS schedule_snapshot",
  "CREATE TABLE IF NOT EXISTS attendance_displacements",
  "attendance_displacement_one_open_per_shift",
]){
  if(!migration.includes(marker))throw new Error("Attendance migration missing "+marker);
}

const scheduleApi=fs.readFileSync("app/api/attendance/schedules/route.ts","utf8");
for(const marker of [
  'can(session,"attendance.manage")',
  "resolveAttendanceOrganization",
  "user_attendance_schedules",
  "attendance.schedule.updated",
  "weekly_schedule",
]){
  if(!scheduleApi.includes(marker))throw new Error("Schedule API missing "+marker);
}

const movementApi=fs.readFileSync("app/api/attendance/displacements/route.ts","utf8");
for(const marker of [
  'can(session,"attendance.self")',
  "attendance_displacements",
  "status='in_transit'",
  "current_site_id",
  "canAccessAttendanceSite",
]){
  if(!movementApi.includes(marker))throw new Error("Displacement API missing "+marker);
}

const clock=fs.readFileSync("app/api/attendance/clock/route.ts","utf8");
for(const marker of [
  "COALESCE(current_site_id,site_id)",
  "attendance_schedule_id",
  "schedule_snapshot",
  "check_out_site_id",
  "attendance_displacements",
]){
  if(!clock.includes(marker))throw new Error("Attendance clock missing "+marker);
}
if(clock.includes("La salida debe registrarse en la misma sede donde inició la jornada.")){
  throw new Error("Attendance clock still enforces same-site checkout");
}

const capture=fs.readFileSync("components/AttendanceCapture.tsx","utf8");
for(const marker of [
  "openDisplacement",
  "Iniciar desplazamiento",
  "Registrar llegada",
  "/api/attendance/displacements",
  "current_site_name",
]){
  if(!capture.includes(marker))throw new Error("AttendanceCapture movement flow missing "+marker);
}

const attendancePage=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of [
  "attendance-organization-scope",
  "<AttendanceScheduleEditor",
  "organizationId={organizationId}",
  "openDisplacement={openDisplacement.rows[0]||null}",
]){
  if(!attendancePage.includes(marker))throw new Error("Attendance admin workspace missing "+marker);
}

const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
for(const marker of [
  "user-attendance-management",
  "<AttendanceScheduleEditor",
  "<SupervisedBiometricEnrollment",
  "selectedAttendanceSites",
]){
  if(!users.includes(marker))throw new Error("User attendance tab missing "+marker);
}

const enrollmentApi=fs.readFileSync("app/api/attendance/enrollment-supervised/route.ts","utf8");
for(const marker of ["resolveAttendanceOrganization","canAccessAttendanceSite","organizationId?:unknown"]){
  if(!enrollmentApi.includes(marker))throw new Error("Biometric enrollment organization scope missing "+marker);
}

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [".attendance-schedule-editor",".attendance-displacement-card",".attendance-organization-scope"]){
  if(!css.includes(marker))throw new Error("Attendance scheduling CSS missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 8 CSS must remain token-only");

console.log("Attendance schedules, supervised enrollment and displacement checks passed.");
