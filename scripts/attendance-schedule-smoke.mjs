import fs from "node:fs";
import pg from "pg";

const required=[
  "db/migrations/038_user_attendance_schedules.sql",
  "lib/attendance-schedules.ts",
  "app/api/attendance/schedules/route.ts",
  "components/UserAttendanceScheduleAdmin.tsx",
  "components/UserAttendanceAuditCenter.tsx",
  "components/AttendanceCapture.tsx",
  "app/dashboard/attendance/page.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing attendance Phase 2 file: "+file);

const migration=fs.readFileSync("db/migrations/038_user_attendance_schedules.sql","utf8");
for(const marker of ["user_attendance_schedules","effective_from","effective_until","base_site_id","business_schedule","schedule_source","user_attendance_schedules_membership_fk"]){
  if(!migration.includes(marker))throw new Error("Attendance schedule migration missing "+marker);
}

const route=fs.readFileSync("app/api/attendance/schedules/route.ts","utf8");
for(const marker of ["attendanceOrganizationId","rangesOverlap","FOR UPDATE","pg_advisory_xact_lock","attendance_schedule_created","attendance_schedule_updated","attendance_schedule_deleted","canAccessSite"]){
  if(!route.includes(marker))throw new Error("Attendance schedule API guard missing "+marker);
}
if(!route.includes("Una nueva vigencia no puede iniciar en una fecha pasada"))throw new Error("Attendance schedule history immutability guard missing");

const component=fs.readFileSync("components/UserAttendanceScheduleAdmin.tsx","utf8");
for(const marker of ["<BusinessHoursFields","Copiar empresa","Copiar sede base","Personalizar","Nueva vigencia","<ConfirmDialog","El horario no bloquea la asistencia"]){
  if(!component.includes(marker))throw new Error("Attendance schedule UI missing "+marker);
}
const attendance=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of ["<UserAttendanceAuditCenter","attendance-scheduled-workday","preferredSiteId","user_attendance_schedules"]){
  if(!attendance.includes(marker))throw new Error("Attendance Phase 2 orchestration missing "+marker);
}
const auditCenter=fs.readFileSync("components/UserAttendanceAuditCenter.tsx","utf8");
if(!auditCenter.includes("<UserAttendanceScheduleAdmin"))throw new Error("Attendance audit center no longer reuses Phase 2 schedule administration");
const users=fs.readFileSync("app/dashboard/users/UserManagement.tsx","utf8");
if(!users.includes("<UserAttendanceAuditCenter"))throw new Error("User profile does not expose attendance schedule administration through the audit center");
const capture=fs.readFileSync("components/AttendanceCapture.tsx","utf8");
if(!capture.includes("preferredSiteId"))throw new Error("Attendance capture does not prefer scheduled base Site");
const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [".attendance-schedule-admin",".attendance-scheduled-workday",".attendance-schedule-template","@media(max-width:700px)"]){
  if(!css.includes(marker))throw new Error("Attendance Phase 2 styles missing "+marker);
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
    "INSERT INTO organizations(name,slug) VALUES('CI Attendance Schedule','ci-attendance-schedule') RETURNING id"
  );
  const organizationId=org.rows[0].id;
  const site=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Principal','CI-AS','CI','Bogotá','CO') RETURNING id",
    [organizationId],
  );
  const siteId=site.rows[0].id;
  const user=await client.query(
    "INSERT INTO users(email,full_name) VALUES('ci-attendance-schedule@desweb.test','Persona CI') RETURNING id"
  );
  const userId=user.rows[0].id;
  await client.query(
    "INSERT INTO organization_members(organization_id,user_id,role,access_all_sites) VALUES($1,$2,'technician',true)",
    [organizationId,userId],
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
  const inserted=await client.query(
    "INSERT INTO user_attendance_schedules(organization_id,user_id,base_site_id,schedule_source,business_schedule,timezone,effective_from) VALUES($1,$2,$3,'custom',$4::jsonb,'America/Bogota',current_date) RETURNING id",
    [organizationId,userId,siteId,schedule],
  );
  if(!inserted.rowCount)throw new Error("Could not persist attendance schedule");

  let invalidRangeRejected=false;
  await client.query("SAVEPOINT attendance_schedule_range");
  try{
    await client.query(
      "INSERT INTO user_attendance_schedules(organization_id,user_id,base_site_id,schedule_source,business_schedule,timezone,effective_from,effective_until) VALUES($1,$2,$3,'custom',$4::jsonb,'America/Bogota',current_date,current_date-1)",
      [organizationId,userId,siteId,schedule],
    );
  }catch{
    invalidRangeRejected=true;
    await client.query("ROLLBACK TO SAVEPOINT attendance_schedule_range");
  }
  if(!invalidRangeRejected)throw new Error("Attendance schedule invalid date range was not rejected");

  const outsider=await client.query(
    "INSERT INTO users(email,full_name) VALUES('ci-attendance-outsider@desweb.test','Sin membresía') RETURNING id"
  );
  let membershipRejected=false;
  await client.query("SAVEPOINT attendance_schedule_membership");
  try{
    await client.query(
      "INSERT INTO user_attendance_schedules(organization_id,user_id,base_site_id,schedule_source,business_schedule,timezone,effective_from) VALUES($1,$2,$3,'custom',$4::jsonb,'America/Bogota',current_date)",
      [organizationId,outsider.rows[0].id,siteId,schedule],
    );
  }catch{
    membershipRejected=true;
    await client.query("ROLLBACK TO SAVEPOINT attendance_schedule_membership");
  }
  if(!membershipRejected)throw new Error("Attendance schedule accepted a user outside organization membership");

  console.log("Attendance Phase 2 schedule checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
