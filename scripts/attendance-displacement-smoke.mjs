import fs from "node:fs";
import pg from "pg";

const required=[
  "db/migrations/039_attendance_shift_segments.sql",
  "app/api/attendance/movement/route.ts",
  "components/AttendanceMovement.tsx",
  "app/api/attendance/clock/route.ts",
  "app/api/attendance/contingency/route.ts",
  "app/api/attendance/contingency/use/route.ts",
  "app/api/work-orders/[id]/activities/route.ts",
  "app/api/attendance/users/[id]/audit/route.ts",
  "components/UserAttendanceAuditCenter.tsx",
  "app/api/reaction/snapshot/route.ts",
  "components/ReactionMap.tsx",
  "app/dashboard/attendance/page.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Attendance Phase 4 file: "+file);

const migration=fs.readFileSync("db/migrations/039_attendance_shift_segments.sql","utf8");
for(const marker of [
  "check_out_site_id",
  "attendance_shift_segments",
  "segment_type IN ('site','travel')",
  "attendance_shift_segments_one_open_uq",
  "destination_task_id",
  "tracking_session_id",
  "Historical shifts were previously constrained to one Site",
]){
  if(!migration.includes(marker))throw new Error("Phase 4 migration missing "+marker);
}

const movement=fs.readFileSync("app/api/attendance/movement/route.ts","utf8");
for(const marker of [
  'can(session,"attendance.self")',
  "attendanceRoleEnabled",
  "canAccessSite",
  "assignedDestinationTask",
  "start_travel",
  "arrive",
  "attendance_travel_started",
  "attendance_travel_arrived",
  "last_seen_at>now()-interval '30 minutes'",
  "status='cancelled'",
  "cancelled_checkout_contingency_ids",
]){
  if(!movement.includes(marker))throw new Error("Phase 4 movement authority missing "+marker);
}

const clock=fs.readFileSync("app/api/attendance/clock/route.ts","utf8");
for(const marker of ["attendance_shift_segments","check_out_site_id","Registra la llegada","segment.site_id!==siteId"]){
  if(!clock.includes(marker))throw new Error("Clock route is not multi-Site aware: "+marker);
}

const contingency=fs.readFileSync("app/api/attendance/contingency/route.ts","utf8");
const contingencyUse=fs.readFileSync("app/api/attendance/contingency/use/route.ts","utf8");
for(const source of [contingency,contingencyUse]){
  if(!source.includes("attendance_shift_segments"))throw new Error("Attendance contingency is not current-Site aware");
  if(!source.includes("segment_type"))throw new Error("Attendance contingency does not block checkout while traveling");
}

const activityRoute=fs.readFileSync("app/api/work-orders/[id]/activities/route.ts","utf8");
for(const marker of ["JOIN attendance_shift_segments","segment.segment_type='site'","segment.site_id=$3"]){
  if(!activityRoute.includes(marker))throw new Error("Activity execution is not linked to the current attendance Site: "+marker);
}

const fieldUi=fs.readFileSync("components/AttendanceMovement.tsx","utf8");
for(const marker of ["Cambiar de sede dentro de la misma jornada","Iniciar desplazamiento","Registrar llegada","Trayecto Reacción","destinationTaskId"]){
  if(!fieldUi.includes(marker))throw new Error("Phase 4 field UI missing "+marker);
}
const attendancePage=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of ["<AttendanceMovement","selfMovementSegment","selfDestinationTasks","inTransit"]){
  if(!attendancePage.includes(marker))throw new Error("Attendance page missing Phase 4 orchestration "+marker);
}

const auditRoute=fs.readFileSync("app/api/attendance/users/[id]/audit/route.ts","utf8");
for(const marker of ["attendance_shift_segments","reaction_sample_count","check_out_site_name","travels"]){
  if(!auditRoute.includes(marker))throw new Error("Attendance dossier missing travel evidence "+marker);
}
const auditUi=fs.readFileSync("components/UserAttendanceAuditCenter.tsx","utf8");
for(const marker of ["Desplazamientos","Ruta Reacción","travel_count","reaction_sample_count"]){
  if(!auditUi.includes(marker))throw new Error("Attendance dossier UI missing travel evidence "+marker);
}

const reactionApi=fs.readFileSync("app/api/reaction/snapshot/route.ts","utf8");
const reactionUi=fs.readFileSync("components/ReactionMap.tsx","utf8");
for(const marker of ["travel_destination_site_id","travel_destination_site_name","attendance_shift_segments"]){
  if(!reactionApi.includes(marker))throw new Error("Reaction snapshot missing active travel context "+marker);
}
if(!reactionUi.includes("travelDestinationSiteName"))throw new Error("Reaction map does not show active destination");

const capture=fs.readFileSync("components/AttendanceCapture.tsx","utf8");
if(!capture.includes("inTransit"))throw new Error("Attendance checkout UI does not block while traveling");

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [".attendance-movement-card",".attendance-movement-evidence",".attendance-audit-travel"]){
  if(!css.includes(marker))throw new Error("Phase 4 CSS missing "+marker);
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
    "INSERT INTO organizations(name,slug) VALUES('CI Attendance Travel','ci-attendance-travel') RETURNING id"
  );
  const organizationId=org.rows[0].id;
  const siteA=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country,latitude,longitude,geofence_radius_m) VALUES($1,'Origen','CI-TR-A','A','Bogotá','CO',4.71,-74.07,250) RETURNING id",
    [organizationId],
  );
  const siteB=await client.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country,latitude,longitude,geofence_radius_m) VALUES($1,'Destino','CI-TR-B','B','Bogotá','CO',4.72,-74.08,250) RETURNING id",
    [organizationId],
  );
  const a=siteA.rows[0].id,b=siteB.rows[0].id;
  const user=await client.query(
    "INSERT INTO users(email,full_name) VALUES('ci-attendance-travel@desweb.test','Técnico Travel CI') RETURNING id"
  );
  const userId=user.rows[0].id;
  await client.query(
    "INSERT INTO organization_members(organization_id,user_id,role,access_all_sites) VALUES($1,$2,'technician',true)",
    [organizationId,userId],
  );

  const shift=await client.query(
    "INSERT INTO attendance_shifts(organization_id,user_id,site_id,status,check_in_at) VALUES($1,$2,$3,'open',now()-interval '2 hours') RETURNING id",
    [organizationId,userId,a],
  );
  const shiftId=shift.rows[0].id;

  const siteSegment=await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,started_at) VALUES($1,$2,$3,1,'site',$4,now()-interval '2 hours') RETURNING id",
    [organizationId,shiftId,userId,a],
  );
  await client.query(
    "UPDATE attendance_shift_segments SET ended_at=now()-interval '1 hour' WHERE id=$1",
    [siteSegment.rows[0].id],
  );

  const tracking=await client.query(
    "INSERT INTO technician_tracking_sessions(organization_id,user_id,status,last_seen_at,last_latitude,last_longitude,last_accuracy_m) VALUES($1,$2,'active',now(),4.715,-74.075,15) RETURNING id",
    [organizationId,userId],
  );
  const travel=await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,from_site_id,to_site_id,tracking_session_id,started_at) VALUES($1,$2,$3,2,'travel',$4,$5,$6,now()-interval '1 hour') RETURNING id",
    [organizationId,shiftId,userId,a,b,tracking.rows[0].id],
  );

  let secondOpenRejected=false;
  await client.query("SAVEPOINT phase4_open");
  try{
    await client.query(
      "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id) VALUES($1,$2,$3,3,'site',$4)",
      [organizationId,shiftId,userId,a],
    );
  }catch{
    secondOpenRejected=true;
    await client.query("ROLLBACK TO SAVEPOINT phase4_open");
  }
  if(!secondOpenRejected)throw new Error("Phase 4 allowed two open segments in one shift");

  let invalidTravelRejected=false;
  await client.query("SAVEPOINT phase4_shape");
  try{
    await client.query(
      "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,from_site_id,to_site_id,started_at,ended_at) VALUES($1,$2,$3,99,'travel',$4,$4,now()-interval '2 hours',now()-interval '90 minutes')",
      [organizationId,shiftId,userId,a],
    );
  }catch{
    invalidTravelRejected=true;
    await client.query("ROLLBACK TO SAVEPOINT phase4_shape");
  }
  if(!invalidTravelRejected)throw new Error("Phase 4 accepted travel with the same origin and destination");

  await client.query(
    "INSERT INTO technician_location_samples(organization_id,user_id,attendance_shift_id,tracking_session_id,latitude,longitude,accuracy_m,source,recorded_at) VALUES($1,$2,$3,$4,4.716,-74.076,12,'connected_app',now()-interval '40 minutes')",
    [organizationId,userId,shiftId,tracking.rows[0].id],
  );

  await client.query(
    "UPDATE attendance_shift_segments SET ended_at=now()-interval '30 minutes',end_accuracy_m=14,end_distance_m=8 WHERE id=$1",
    [travel.rows[0].id],
  );
  await client.query(
    "INSERT INTO attendance_shift_segments(organization_id,attendance_shift_id,user_id,sequence,segment_type,site_id,started_at,start_accuracy_m,start_distance_m) VALUES($1,$2,$3,3,'site',$4,now()-interval '30 minutes',14,8)",
    [organizationId,shiftId,userId,b],
  );
  await client.query(
    "UPDATE attendance_shift_segments SET ended_at=now() WHERE attendance_shift_id=$1 AND sequence=3",
    [shiftId],
  );
  await client.query(
    "UPDATE attendance_shifts SET status='closed',check_out_at=now(),check_out_site_id=$1 WHERE id=$2",
    [b,shiftId],
  );

  const journey=await client.query(
    "SELECT segment_type,site_id,from_site_id,to_site_id,sequence FROM attendance_shift_segments WHERE attendance_shift_id=$1 ORDER BY sequence",
    [shiftId],
  );
  if(journey.rows.length!==3)throw new Error("Phase 4 jornada did not preserve three ordered segments");
  if(journey.rows[0].segment_type!=="site"||journey.rows[0].site_id!==a)throw new Error("Phase 4 lost origin Site segment");
  if(journey.rows[1].segment_type!=="travel"||journey.rows[1].from_site_id!==a||journey.rows[1].to_site_id!==b)throw new Error("Phase 4 lost travel origin/destination");
  if(journey.rows[2].segment_type!=="site"||journey.rows[2].site_id!==b)throw new Error("Phase 4 lost destination Site segment");

  const closed=await client.query(
    "SELECT site_id,check_out_site_id FROM attendance_shifts WHERE id=$1",
    [shiftId],
  );
  if(closed.rows[0].site_id!==a||closed.rows[0].check_out_site_id!==b){
    throw new Error("Phase 4 did not preserve distinct shift origin and final Site");
  }

  const routeEvidence=await client.query(
    "SELECT count(*)::int n FROM technician_location_samples WHERE attendance_shift_id=$1 AND source='connected_app'",
    [shiftId],
  );
  if(routeEvidence.rows[0].n!==1)throw new Error("Phase 4 lost Reaction route evidence correlation");

  console.log("Attendance Phase 4 displacement checks passed.");
  await client.query("ROLLBACK");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await client.end();
}
