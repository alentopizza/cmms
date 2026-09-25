import fs from "node:fs";
import pg from "pg";

const required=[
  "app/api/attendance/users/[id]/audit/route.ts",
  "components/UserAttendanceAuditCenter.tsx",
  "components/UserAttendanceScheduleAdmin.tsx",
  "app/dashboard/attendance/page.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing attendance Phase 3 file: "+file);

const route=fs.readFileSync("app/api/attendance/users/[id]/audit/route.ts","utf8");
for(const marker of [
  "attendanceOrganizationId",
  "attendance.manage",
  "targetVisibleInScope",
  "AUDIT_ROLES",
  "$4::uuid[] IS NULL",
  "$4::text[] IS NULL",
  "attendance_shifts",
  "biometric_enrollment_events",
  "biometric_enrollment_requests",
  "attendance_biometric_policy_versions",
  "attendance_contingency_requests",
  "user_attendance_schedules",
  "audit_log",
]){
  if(!route.includes(marker))throw new Error("Attendance Phase 3 audit route missing "+marker);
}
for(const sensitive of ["check_in_face_similarity","check_out_face_similarity","check_in_liveness","check_out_liveness","encrypted_preview","request.encrypted_embedding"]){
  if(route.includes(sensitive))throw new Error("Attendance audit route should not expose biometric score "+sensitive);
}

const center=fs.readFileSync("components/UserAttendanceAuditCenter.tsx","utf8");
for(const marker of [
  "Administración y auditoría de asistencia",
  "<SegmentedControl",
  "<Tabs",
  "<MetricGrid",
  "<Timeline",
  "<UserAttendanceScheduleAdmin",
  "Marcaciones",
  "Biometría",
  "Auditoría de enrolamiento",
  "Contingencias",
  "Trazabilidad",
]){
  if(!center.includes(marker))throw new Error("Attendance Phase 3 audit center missing "+marker);
}
const attendance=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
if(!attendance.includes("<UserAttendanceAuditCenter"))throw new Error("Attendance page does not mount Phase 3 audit center");
if(!attendance.includes("organization_member_sites"))throw new Error("Attendance people selector is not Site scoped");
const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
if(!users.includes("<UserAttendanceAuditCenter"))throw new Error("User profile does not mount Phase 3 audit center");
if(!users.includes("#attendance-audit"))throw new Error("User profile does not deep-link to Phase 3 audit center");
const scheduleRoute=fs.readFileSync("app/api/attendance/schedules/route.ts","utf8");
if(!scheduleRoute.includes("base_site_id:target.rows[0].base_site_id"))throw new Error("Schedule deletion audit does not preserve base Site scope");
const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [".attendance-audit-center",".attendance-audit-overview-grid",".attendance-audit-record-grid",".attendance-audit-biometric"]){
  if(!css.includes(marker))throw new Error("Attendance Phase 3 styles missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 8 CSS must remain token-only");

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const client=new Client({connectionString:databaseUrl});
await client.connect();

try{
  await client.query("BEGIN");
  const org=await client.query(
    "INSERT INTO organizations(name,slug) VALUES('CI Attendance Audit','ci-attendance-audit') RETURNING id"
  );
  const organizationId=org.rows[0].id;
  const siteA=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Audit A','CI-AA','A','Bogotá','CO') RETURNING id",
    [organizationId],
  );
  const siteB=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Audit B','CI-AB','B','Bogotá','CO') RETURNING id",
    [organizationId],
  );
  const a=siteA.rows[0].id,b=siteB.rows[0].id;
  const user=await client.query(
    "INSERT INTO users(email,full_name) VALUES('ci-attendance-audit@desweb.test','Persona Audit CI') RETURNING id"
  );
  const userId=user.rows[0].id;
  await client.query(
    "INSERT INTO organization_members(organization_id,user_id,role,access_all_sites) VALUES($1,$2,'technician',true)",
    [organizationId,userId],
  );

  const shiftA=await client.query(
    "INSERT INTO attendance_shifts(organization_id,user_id,site_id,status,check_in_verification_mode,check_in_at,check_out_at) VALUES($1,$2,$3,'closed','standard',now()-interval '3 hours',now()-interval '2 hours') RETURNING id",
    [organizationId,userId,a],
  );
  await client.query(
    "INSERT INTO attendance_shifts(organization_id,user_id,site_id,status,check_in_verification_mode,check_in_at,check_out_at) VALUES($1,$2,$3,'closed','standard',now()-interval '6 hours',now()-interval '5 hours')",
    [organizationId,userId,b],
  );

  await client.query(
    "INSERT INTO attendance_contingency_requests(organization_id,user_id,site_id,action,reason_code,details,status) VALUES($1,$2,$3,'check_in','device_issue','Incidente CI en sitio A','rejected')",
    [organizationId,userId,a],
  );
  await client.query(
    "INSERT INTO attendance_contingency_requests(organization_id,user_id,site_id,action,reason_code,details,status) VALUES($1,$2,$3,'check_in','device_issue','Incidente CI en sitio B','rejected')",
    [organizationId,userId,b],
  );

  await client.query(
    "INSERT INTO biometric_enrollment_events(organization_id,user_id,site_id,event_type,enrollment_method,metadata) VALUES($1,$2,$3,'enrolled','supervised_camera','{}'::jsonb)",
    [organizationId,userId,a],
  );
  await client.query(
    "INSERT INTO biometric_enrollment_events(organization_id,user_id,site_id,event_type,enrollment_method,metadata) VALUES($1,$2,$3,'reenrolled','supervised_camera','{}'::jsonb)",
    [organizationId,userId,b],
  );

  const schedule=JSON.stringify([
    {day:1,enabled:true,openTime:"08:00",closeTime:"17:00"},
    {day:2,enabled:true,openTime:"08:00",closeTime:"17:00"},
    {day:3,enabled:true,openTime:"08:00",closeTime:"17:00"},
    {day:4,enabled:true,openTime:"08:00",closeTime:"17:00"},
    {day:5,enabled:true,openTime:"08:00",closeTime:"17:00"},
    {day:6,enabled:false,openTime:"08:00",closeTime:"17:00"},
    {day:7,enabled:false,openTime:"08:00",closeTime:"17:00"},
  ]);
  const scheduleA=await client.query(
    "INSERT INTO user_attendance_schedules(organization_id,user_id,base_site_id,schedule_source,business_schedule,timezone,effective_from,effective_until) VALUES($1,$2,$3,'custom',$4::jsonb,'America/Bogota',current_date-20,current_date-11) RETURNING id",
    [organizationId,userId,a,schedule],
  );
  await client.query(
    "INSERT INTO user_attendance_schedules(organization_id,user_id,base_site_id,schedule_source,business_schedule,timezone,effective_from,effective_until) VALUES($1,$2,$3,'custom',$4::jsonb,'America/Bogota',current_date-10,current_date-1)",
    [organizationId,userId,b,schedule],
  );

  await client.query(
    "INSERT INTO audit_log(organization_id,action,entity_type,entity_id,metadata) VALUES($1,'attendance_schedule_created','user_attendance_schedule',$2,$3::jsonb)",
    [organizationId,scheduleA.rows[0].id,JSON.stringify({user_id:userId,base_site_id:a,effective_from:"2026-01-01"})],
  );
  await client.query(
    "INSERT INTO audit_log(organization_id,action,entity_type,entity_id,metadata) VALUES($1,'attendance_schedule_created','user_attendance_schedule','ci-hidden',$2::jsonb)",
    [organizationId,JSON.stringify({user_id:userId,base_site_id:b,effective_from:"2026-01-02"})],
  );

  const scope=[a];
  const visibleShifts=await client.query(
    "SELECT count(*)::int n FROM attendance_shifts WHERE organization_id=$1 AND user_id=$2 AND ($3::uuid[] IS NULL OR site_id=ANY($3::uuid[]))",
    [organizationId,userId,scope],
  );
  const visibleContingencies=await client.query(
    "SELECT count(*)::int n FROM attendance_contingency_requests WHERE organization_id=$1 AND user_id=$2 AND ($3::uuid[] IS NULL OR site_id=ANY($3::uuid[]))",
    [organizationId,userId,scope],
  );
  const visibleBiometric=await client.query(
    "SELECT count(*)::int n FROM biometric_enrollment_events WHERE organization_id=$1 AND user_id=$2 AND ($3::uuid[] IS NULL OR site_id IS NULL OR site_id=ANY($3::uuid[]))",
    [organizationId,userId,scope],
  );
  const visibleScheduleAudit=await client.query(
    "SELECT count(*)::int n FROM audit_log WHERE organization_id=$1 AND entity_type='user_attendance_schedule' AND metadata->>'user_id'=$2 AND ($3::text[] IS NULL OR metadata->>'base_site_id'=ANY($3::text[]))",
    [organizationId,userId,scope],
  );
  if(visibleShifts.rows[0].n!==1)throw new Error("Site-scoped attendance shifts leaked records");
  if(visibleContingencies.rows[0].n!==1)throw new Error("Site-scoped contingencies leaked records");
  if(visibleBiometric.rows[0].n!==1)throw new Error("Site-scoped biometric events leaked records");
  if(visibleScheduleAudit.rows[0].n!==1)throw new Error("Site-scoped schedule audit leaked records");

  const shiftCheck=await client.query("SELECT id FROM attendance_shifts WHERE id=$1",[shiftA.rows[0].id]);
  if(!shiftCheck.rowCount)throw new Error("Attendance audit fixture was not persisted inside test transaction");

  console.log("Attendance Phase 3 audit checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
