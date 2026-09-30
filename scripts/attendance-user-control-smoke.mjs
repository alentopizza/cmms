import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const permissions=read("lib/permissions.ts");
expect(permissions,'admin: ["companies.manage"',"tenant admin role");
expect(permissions,'"attendance.manage"',"tenant admin attendance management");

const migration=read("db/migrations/999b_attendance_user_control_overrides.sql");
for(const needle of ["user_attendance_control_overrides","PRIMARY KEY (organization_id,user_id)","organization_members(organization_id,user_id)"])expect(migration,needle,"user attendance override migration");

const policy=read("app/api/attendance/policy/route.ts");
expect(policy,'ROLE_SET = new Set(["admin","manager","technician","provider","external"])',"general attendance roles");
expect(policy,'can(session,"attendance.manage")',"policy permission");

const page=read("app/dashboard/attendance/page.tsx");
for(const needle of ["Configurar roles","Configurar por usuario","attendance_override","selfAttendanceEnabled"])expect(page,needle,"attendance two-level UX");

const audit=read("components/UserAttendanceAuditCenter.tsx");
for(const needle of ['id:"control"',"Heredar configuración del rol","Forzar habilitado para este usuario","Excluir a este usuario del control"])expect(audit,needle,"individual attendance control UI");

const control=read("app/api/attendance/users/[id]/control/route.ts");
for(const needle of ["attendance.manage","attendanceOrganizationId","user_attendance_control_overrides","attendance_user_control_changed","Cierra la jornada abierta"])expect(control,needle,"individual attendance control API");

for(const path of [
  "app/api/attendance/clock/route.ts",
  "app/api/attendance/enrollment-request/route.ts",
  "app/api/attendance/movement/route.ts",
  "app/api/attendance/contingency/route.ts",
]){
  const source=read(path);
  expect(source,"user_attendance_control_overrides","effective per-user attendance control "+path);
}

console.log("Attendance role + per-user control smoke: OK");
