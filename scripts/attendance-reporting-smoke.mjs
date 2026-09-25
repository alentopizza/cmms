import fs from "node:fs";
import pg from "pg";

const required=[
  "lib/attendance-report.ts",
  "app/api/attendance/report/route.ts",
  "components/AttendanceOperationalReport.tsx",
  "app/dashboard/attendance/page.tsx",
  "app/dashboard/reports/page.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Attendance Phase 5 file: "+file);

const model=fs.readFileSync("lib/attendance-report.ts","utf8");
for(const marker of [
  "MAX_REPORT_DAYS=366",
  "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "user_attendance_schedules",
  "attendance_shift_segments",
  "technician_location_samples",
  "activity_execution_events",
  "attendance_contingency_requests",
  "scheduledDaysWithoutAttendance",
  "daysWithUnplannedAttendance",
  "varianceMinutes",
  "NOT (scoped.from_site_id=ANY",
  "NOT (scoped.to_site_id=ANY",
]){
  if(!model.includes(marker))throw new Error("Attendance Phase 5 read model missing "+marker);
}

const route=fs.readFileSync("app/api/attendance/report/route.ts","utf8");
for(const marker of [
  'can(session,"attendance.reports")',
  "attendanceOrganizationId",
  "buildAttendanceOperationalReport",
  'format==="csv"',
  'format==="xlsx"',
  'format==="pdf"',
  "REPORTE OPERATIVO DE ASISTENCIA",
  "organization_branding",
  "show_desweb_branding",
]){
  if(!route.includes(marker))throw new Error("Attendance Phase 5 report route missing "+marker);
}
for(const sensitive of ["check_in_face_similarity","check_out_face_similarity","check_in_liveness","check_out_liveness","encrypted_embedding"]){
  if(route.includes(sensitive)||model.includes(sensitive))throw new Error("Attendance Phase 5 report should not expose biometric internals: "+sensitive);
}

const ui=fs.readFileSync("components/AttendanceOperationalReport.tsx","utf8");
for(const marker of [
  "Jornada programada vs. presencia real",
  "Sede relacionada",
  "Resumen por persona",
  "Detalle diario",
  "Horas programadas",
  "Tiempo en sede",
  "Desplazamiento",
  "Contingencias usadas",
  "No constituye ranking",
  'format:"xlsx"',
  'format:"csv"',
  'format:"pdf"',
]){
  if(!ui.includes(marker))throw new Error("Attendance Phase 5 UI missing "+marker);
}

const attendance=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
if(!attendance.includes("<AttendanceOperationalReport"))throw new Error("Attendance page does not mount Phase 5 report");
if(attendance.includes("const reports=canReports"))throw new Error("Legacy duplicate attendance report query remains active");

const reports=fs.readFileSync("app/dashboard/reports/page.tsx","utf8");
if(!reports.includes("/dashboard/attendance#attendance-report"))throw new Error("Report Center does not link to Attendance Phase 5");

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [".attendance-operational-report",".attendance-report-filters",".attendance-report-kpis",".attendance-report-context-grid"]){
  if(!css.includes(marker))throw new Error("Attendance Phase 5 styles missing "+marker);
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
    "INSERT INTO organizations(name,slug,timezone) VALUES('CI Attendance Report','ci-attendance-report','America/Bogota') RETURNING id"
  );
  const organizationId=org.rows[0].id;

  const siteA=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Reporte A','CI-RP-A','A','Bogotá','CO') RETURNING id",
    [organizationId],
  );
  const siteB=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Reporte B','CI-RP-B','B','Bogotá','CO') RETURNING id",
    [organizationId],
  );
  const siteC=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country) VALUES($1,'Reporte C','CI-RP-C','C','Bogotá','CO') RETURNING id",
    [organizationId],
  );
  const a=siteA.rows[0].id,b=siteB.rows[0].id,c=siteC.rows[0].id;

  const user=await client.query(
    "INSERT INTO users(email,full_name) VALUES('ci-attendance-report@desweb.test','Persona Reporte CI') RETURNING id"
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
  await client.query(
    "INSERT INTO user_attendance_schedules(organization_id,user_id,base_site_id,schedule_source,business_schedule,timezone,effective_from) VALUES($1,$2,$3,'custom',$4::jsonb,'America/Bogota',current_date-30)",
    [organizationId,userId,a,schedule],
  );

  const visibleShift=await client.query(
    "INSERT INTO attendance_shifts(organization_id,user_id,site_id,check_out_site_id,status,check_in_at,check_out_at) VALUES($1,$2,$3,$4,'closed',now()-interval '4 hours',now()-interval '1 hour') RETURNING id",
    [organizationId,userId,a,b],
  );
  const visibleShiftId=visibleShift.rows[0].id;
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,started_at,ended_at) VALUES($1,$2,$3,1,'site',$4,now()-interval '4 hours',now()-interval '3 hours')",
    [organizationId,visibleShiftId,userId,a],
  );
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,from_site_id,to_site_id,started_at,ended_at) VALUES($1,$2,$3,2,'travel',$4,$5,now()-interval '3 hours',now()-interval '2 hours')",
    [organizationId,visibleShiftId,userId,a,b],
  );
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,started_at,ended_at) VALUES($1,$2,$3,3,'site',$4,now()-interval '2 hours',now()-interval '1 hour')",
    [organizationId,visibleShiftId,userId,b],
  );

  const hiddenShift=await client.query(
    "INSERT INTO attendance_shifts(organization_id,user_id,site_id,check_out_site_id,status,check_in_at,check_out_at) VALUES($1,$2,$3,$4,'closed',now()-interval '28 hours',now()-interval '25 hours') RETURNING id",
    [organizationId,userId,a,c],
  );
  const hiddenShiftId=hiddenShift.rows[0].id;
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,started_at,ended_at) VALUES($1,$2,$3,1,'site',$4,now()-interval '28 hours',now()-interval '27 hours')",
    [organizationId,hiddenShiftId,userId,a],
  );
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,from_site_id,to_site_id,started_at,ended_at) VALUES($1,$2,$3,2,'travel',$4,$5,now()-interval '27 hours',now()-interval '26 hours')",
    [organizationId,hiddenShiftId,userId,a,c],
  );
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,started_at,ended_at) VALUES($1,$2,$3,3,'site',$4,now()-interval '26 hours',now()-interval '25 hours')",
    [organizationId,hiddenShiftId,userId,c],
  );

  const scope=[a,b];
  const scopedShifts=await client.query(
    `SELECT shift.id
     FROM attendance_shifts shift
     WHERE shift.organization_id=$1 AND shift.user_id=$2
       AND shift.site_id=ANY($3::uuid[])
       AND (shift.check_out_site_id IS NULL OR shift.check_out_site_id=ANY($3::uuid[]))
       AND NOT EXISTS(
         SELECT 1 FROM attendance_shift_segments segment
         WHERE segment.attendance_shift_id=shift.id
           AND (
             (segment.segment_type='site' AND NOT (segment.site_id=ANY($3::uuid[])))
             OR
             (segment.segment_type='travel' AND (
               NOT (segment.from_site_id=ANY($3::uuid[]))
               OR NOT (segment.to_site_id=ANY($3::uuid[]))
             ))
           )
       )`,
    [organizationId,userId,scope],
  );
  if(scopedShifts.rows.length!==1||scopedShifts.rows[0].id!==visibleShiftId){
    throw new Error("Phase 5 Site scope leaked or hid the wrong multi-Site shift");
  }

  const segmentMinutes=await client.query(
    `SELECT segment_type,
            round(sum(EXTRACT(EPOCH FROM (ended_at-started_at))/60.0)::numeric,0)::int minutes
     FROM attendance_shift_segments
     WHERE attendance_shift_id=$1
     GROUP BY segment_type`,
    [visibleShiftId],
  );
  const onsite=segmentMinutes.rows.find(row=>row.segment_type==="site")?.minutes;
  const travel=segmentMinutes.rows.find(row=>row.segment_type==="travel")?.minutes;
  if(onsite!==120||travel!==60)throw new Error("Phase 5 segment duration evidence is inconsistent");

  const scheduleCheck=await client.query(
    "SELECT count(*)::int n FROM user_attendance_schedules WHERE organization_id=$1 AND user_id=$2 AND effective_from<=current_date AND (effective_until IS NULL OR effective_until>=current_date)",
    [organizationId,userId],
  );
  if(scheduleCheck.rows[0].n!==1)throw new Error("Phase 5 schedule fixture is not effective");

  console.log("Attendance Phase 5 reporting checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
