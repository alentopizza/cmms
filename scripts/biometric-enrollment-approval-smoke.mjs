import fs from "node:fs";
import pg from "pg";

const required=[
  "db/migrations/040_biometric_self_enrollment_approval.sql",
  "app/api/attendance/enrollment-request/route.ts",
  "app/api/attendance/enrollment-requests/[id]/route.ts",
  "app/api/attendance/enrollment-requests/[id]/preview/route.ts",
  "components/SelfBiometricEnrollment.tsx",
  "components/BiometricEnrollmentAdmin.tsx",
  "lib/client-biometric.ts",
  "lib/biometric.ts",
  "app/api/attendance/clock/route.ts",
  "app/api/attendance/users/[id]/audit/route.ts",
  "components/UserAttendanceAuditCenter.tsx",
  "app/dashboard/attendance/page.tsx",
  "app/phase8-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing biometric approval file: "+file);

const migration=fs.readFileSync("db/migrations/040_biometric_self_enrollment_approval.sql","utf8");
for(const marker of [
  "attendance_biometric_policy_versions",
  "biometric_enrollment_requests",
  "self_camera_approved",
  "biometric_enrollment_one_pending_per_user_idx",
  "encrypted_preview",
  "preview_expires_at",
  "'requested','approved','rejected','expired'",
]){
  if(!migration.includes(marker))throw new Error("Biometric migration missing "+marker);
}

const selfRoute=fs.readFileSync("app/api/attendance/enrollment-request/route.ts","utf8");
for(const marker of [
  'can(session,"attendance.self")',
  "attendance_biometric_policy_versions",
  "canAccessSite(session,siteId)",
  "haversineMeters",
  "policy.liveness_threshold",
  "active_challenge_v1",
  "previewPayload",
  "encryptBiometricBlob",
  "encryptEmbedding",
  "now()+interval '72 hours'",
  "consent:true",
  "biometric_enrollment_events",
]){
  if(!selfRoute.includes(marker))throw new Error("Self enrollment route missing "+marker);
}

const decision=fs.readFileSync("app/api/attendance/enrollment-requests/[id]/route.ts","utf8");
for(const marker of [
  'can(session,"attendance.manage")',
  "canAccessSite(session,enrollment.site_id)",
  "'self_camera_approved'",
  "identity_verified_at=now()",
  "encrypted_embedding=NULL,encrypted_preview=NULL",
  "'approved'",
  "'rejected'",
]){
  if(!decision.includes(marker))throw new Error("Enrollment decision route missing "+marker);
}

const preview=fs.readFileSync("app/api/attendance/enrollment-requests/[id]/preview/route.ts","utf8");
for(const marker of ["decryptBiometricBlob","status!==\"pending\"","Cache-Control","no-store","preview_expires_at"]){
  if(!preview.includes(marker))throw new Error("Enrollment preview route missing "+marker);
}

const client=fs.readFileSync("lib/client-biometric.ts","utf8");
for(const marker of [
  "gesture:{enabled:true}",
  "createActiveLivenessChallenge",
  "runActiveLivenessChallenge",
  '"blink"',
  '"turn_left"',
  '"turn_right"',
  "captureEnrollmentPreview",
]){
  if(!client.includes(marker))throw new Error("Active liveness client missing "+marker);
}

const selfUi=fs.readFileSync("components/SelfBiometricEnrollment.tsx","utf8");
for(const marker of [
  "Leer política",
  "He leído y entiendo la política",
  "Verificar sede",
  "Prueba de vida activa",
  "Activar cámara y enviar",
  "Pendiente de aprobación única",
  "/api/attendance/enrollment-request",
]){
  if(!selfUi.includes(marker))throw new Error("Self enrollment UI missing "+marker);
}

const admin=fs.readFileSync("components/BiometricEnrollmentAdmin.tsx","utf8");
for(const marker of [
  "Cobertura biométrica",
  "Biometría verificada",
  "Pendiente aprobación",
  "Requiere atención",
  "Aprobar identidad",
  "Rechazar",
  "Quién ya lo tiene y quién falta",
  "Enrolamiento asistido excepcional",
]){
  if(!admin.includes(marker))throw new Error("Biometric admin center missing "+marker);
}

const page=fs.readFileSync("app/dashboard/attendance/page.tsx","utf8");
for(const marker of [
  "<SelfBiometricEnrollment",
  "<BiometricEnrollmentAdmin",
  "attendance_biometric_policy_versions",
  'enrollment_method IN (\'supervised_camera\',\'self_camera_approved\')',
  "biometric_notice_title",
  "biometric_notice_body",
  "pendingControlled",
]){
  if(!page.includes(marker))throw new Error("Attendance biometric orchestration missing "+marker);
}
if(page.includes("<SupervisedBiometricEnrollment")){
  throw new Error("Attendance page should not mount the assisted fallback as the primary enrollment flow");
}

const clock=fs.readFileSync("app/api/attendance/clock/route.ts","utf8");
if(!clock.includes("enrollment_method IN ('supervised_camera','self_camera_approved')")){
  throw new Error("Daily attendance does not accept approved self enrollment");
}

const audit=fs.readFileSync("app/api/attendance/users/[id]/audit/route.ts","utf8");
for(const marker of ["biometricRequests","attendance_biometric_policy_versions","policy_version","liveness_method"]){
  if(!audit.includes(marker))throw new Error("Attendance audit missing enrollment request evidence "+marker);
}
for(const sensitive of ["encrypted_preview","request.encrypted_embedding","bp.encrypted_embedding"]){
  if(audit.includes(sensitive))throw new Error("Attendance audit must not expose sensitive biometric payload "+sensitive);
}

const css=fs.readFileSync("app/phase8-modules.css","utf8");
for(const marker of [
  ".self-biometric-enrollment",
  ".self-biometric-steps",
  ".biometric-admin-center",
  ".biometric-approval-card",
  ".biometric-roster-list",
  "@media(max-width:700px)",
]){
  if(!css.includes(marker))throw new Error("Biometric responsive styles missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 8 CSS must remain token-only");

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const db=new Client({connectionString:databaseUrl});
await db.connect();

try{
  await db.query("BEGIN");

  const org=await db.query("INSERT INTO organizations(name,slug) VALUES('CI Biometric Approval','ci-biometric-approval') RETURNING id");
  const organizationId=org.rows[0].id;
  const site=await db.query(
    "INSERT INTO sites(organization_id,name,code,address,city,country,latitude,longitude,geofence_radius_m) VALUES($1,'Biometric Site','CI-BIO','A','Bogotá','CO',4.65,-74.05,180) RETURNING id",
    [organizationId],
  );
  const siteId=site.rows[0].id;
  const adminUser=await db.query("INSERT INTO users(email,full_name) VALUES('ci-bio-admin@desweb.test','CI Biometric Admin') RETURNING id");
  const worker=await db.query("INSERT INTO users(email,full_name) VALUES('ci-bio-worker@desweb.test','CI Biometric Worker') RETURNING id");
  const adminId=adminUser.rows[0].id,userId=worker.rows[0].id;
  await db.query(
    "INSERT INTO organization_members(organization_id,user_id,role,access_all_sites) VALUES($1,$2,'manager',true),($1,$3,'technician',true)",
    [organizationId,adminId,userId],
  );
  await db.query(
    "INSERT INTO organization_attendance_policies(organization_id,enabled,enabled_roles,require_face,require_geolocation) VALUES($1,true,ARRAY['technician']::text[],true,true)",
    [organizationId],
  );
  const policy=await db.query(
    "INSERT INTO attendance_biometric_policy_versions(organization_id,version,title,body,active,published_by) VALUES($1,1,'CI biometric consent policy','This is a CI biometric consent policy used to validate versioned consent and future audit evidence for the attendance enrollment workflow.',true,$2) RETURNING id",
    [organizationId,adminId],
  );
  const policyId=policy.rows[0].id;

  const request=await db.query(
    `INSERT INTO biometric_enrollment_requests(
       organization_id,user_id,site_id,policy_version_id,status,encrypted_embedding,encrypted_preview,preview_mime,
       preview_expires_at,latitude,longitude,accuracy_m,distance_m,liveness_method,challenge_evidence
     ) VALUES($1,$2,$3,$4,'pending',$5,$6,'image/jpeg',now()+interval '72 hours',4.65,-74.05,12,3,'active_challenge_v1',$7::jsonb)
     RETURNING id`,
    [organizationId,userId,siteId,policyId,Buffer.from("template"),Buffer.from("preview"),JSON.stringify({steps:[{code:"blink"},{code:"turn_left"}]})],
  );
  const requestId=request.rows[0].id;

  let duplicateBlocked=false;
  try{
    await db.query(
      `INSERT INTO biometric_enrollment_requests(
         organization_id,user_id,site_id,policy_version_id,status,latitude,longitude,accuracy_m,distance_m
       ) VALUES($1,$2,$3,$4,'pending',4.65,-74.05,10,2)`,
      [organizationId,userId,siteId,policyId],
    );
  }catch{
    duplicateBlocked=true;
    await db.query("ROLLBACK TO SAVEPOINT duplicate_pending").catch(()=>undefined);
  }
  // PostgreSQL aborts the transaction on constraint failure, so verify the
  // partial unique index structurally instead of relying on the failed insert.
  const pendingIndex=await db.query(
    "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='biometric_enrollment_one_pending_per_user_idx'"
  );
  if(!pendingIndex.rowCount||!pendingIndex.rows[0].indexdef.includes("status = 'pending'")){
    throw new Error("Pending biometric request unique index is missing");
  }

  // Restart fixture transaction if the duplicate probe aborted it.
  if(duplicateBlocked){
    await db.query("ROLLBACK");
    await db.query("BEGIN");
  }else{
    throw new Error("Duplicate pending biometric request was not blocked");
  }

  // Validate method/event constraints independently after restarting.
  const org2=await db.query("INSERT INTO organizations(name,slug) VALUES('CI Bio Approval 2','ci-biometric-approval-2') RETURNING id");
  const org2Id=org2.rows[0].id;
  const site2=await db.query("INSERT INTO sites(organization_id,name,address,city,country) VALUES($1,'Bio 2','A','Bogotá','CO') RETURNING id",[org2Id]);
  const user2=await db.query("INSERT INTO users(email,full_name) VALUES('ci-bio-worker2@desweb.test','CI Bio Worker 2') RETURNING id");
  const user2Id=user2.rows[0].id;
  await db.query("INSERT INTO organization_members(organization_id,user_id,role,access_all_sites) VALUES($1,$2,'technician',true)",[org2Id,user2Id]);
  await db.query(
    `INSERT INTO user_biometric_profiles(
       user_id,organization_id,encrypted_embedding,consented_at,enrollment_method,identity_verified_at,enrollment_site_id
     ) VALUES($1,$2,$3,now(),'self_camera_approved',now(),$4)`,
    [user2Id,org2Id,Buffer.from("encrypted"),site2.rows[0].id],
  );
  await db.query(
    "INSERT INTO biometric_enrollment_events(organization_id,user_id,site_id,event_type,enrollment_method,metadata) VALUES($1,$2,$3,'approved','self_camera_approved','{}'::jsonb)",
    [org2Id,user2Id,site2.rows[0].id],
  );
  const accepted=await db.query(
    "SELECT enrollment_method,identity_verified_at IS NOT NULL verified FROM user_biometric_profiles WHERE user_id=$1",
    [user2Id],
  );
  if(accepted.rows[0]?.enrollment_method!=="self_camera_approved"||accepted.rows[0]?.verified!==true){
    throw new Error("Approved self enrollment profile was not accepted by schema");
  }

  const profileColumns=await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='user_biometric_profiles' AND column_name ILIKE '%preview%'"
  );
  if(profileColumns.rowCount)throw new Error("Permanent biometric profile must not contain enrollment preview columns");

  console.log("Biometric self-enrollment approval checks passed.");
  await db.query("ROLLBACK");
}catch(error){
  try{await db.query("ROLLBACK");}catch{}
  throw error;
}finally{
  await db.end();
}
