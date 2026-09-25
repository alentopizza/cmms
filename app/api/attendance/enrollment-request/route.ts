import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { encryptBiometricBlob, encryptEmbedding, finiteCoordinate, haversineMeters, validateEmbedding } from "@/lib/biometric";
import { attendanceRoleEnabled, DEFAULT_ATTENDANCE_POLICY } from "@/lib/attendance-policy";
import { pool } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHALLENGE_CODES=new Set(["blink","turn_left","turn_right","head_up","head_down"]);
const MAX_PREVIEW_BYTES=350_000;

type Policy={
  enabled:boolean;
  enabled_roles:string[];
  require_face:boolean;
  max_location_accuracy_m:number;
  liveness_threshold:number;
};

function previewPayload(value:unknown){
  if(typeof value!=="string")return null;
  const match=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if(!match)return null;
  const bytes=Buffer.from(match[2],"base64");
  if(!bytes.length||bytes.length>MAX_PREVIEW_BYTES)return null;
  return {mime:match[1],bytes};
}

function activeChallenge(value:unknown){
  if(!Array.isArray(value)||value.length!==2)return null;
  const seen=new Set<string>();
  const normalized=value.map(item=>{
    if(!item||typeof item!=="object")return null;
    const code=String((item as{code?:unknown}).code||"");
    const completedAt=String((item as{completedAt?:unknown}).completedAt||"");
    if(!CHALLENGE_CODES.has(code)||seen.has(code))return null;
    seen.add(code);
    const timestamp=new Date(completedAt).getTime();
    if(!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp)>5*60_000)return null;
    return {code,completedAt};
  });
  if(normalized.some(item=>!item))return null;
  if(!seen.has("blink"))return null;
  return normalized;
}

async function expirePending(client:import("pg").PoolClient,organizationId:string,userId:string){
  const expired=await client.query<{id:string;site_id:string}>(
    `UPDATE biometric_enrollment_requests
     SET status='expired',encrypted_embedding=NULL,encrypted_preview=NULL,preview_mime=NULL,updated_at=now()
     WHERE organization_id=$1 AND user_id=$2 AND status='pending'
       AND preview_expires_at IS NOT NULL AND preview_expires_at<=now()
     RETURNING id,site_id`,
    [organizationId,userId],
  );
  for(const item of expired.rows){
    await client.query(
      `INSERT INTO biometric_enrollment_events(
         organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
       ) VALUES($1,$2,NULL,$3,'expired','self_camera_approved',$4::jsonb)`,
      [organizationId,userId,item.site_id,JSON.stringify({request_id:item.id,reason:"preview_expired"})],
    );
  }
}

// ── Self-service enrollment state ───────────────────────────────────────────
// This endpoint never approves identity. It only exposes the current policy and
// the authenticated user's own request/profile state.
export async function GET(){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await expirePending(client,session.organizationId,session.userId);

    const [policy,notice,profile,request]=await Promise.all([
      client.query<Policy>(
        `SELECT enabled,enabled_roles,require_face,max_location_accuracy_m,liveness_threshold
         FROM organization_attendance_policies WHERE organization_id=$1`,
        [session.organizationId],
      ),
      client.query<{id:string;version:number;title:string;body:string;published_at:string}>(
        `SELECT id,version,title,body,published_at::text
         FROM attendance_biometric_policy_versions
         WHERE organization_id=$1 AND active=true
         ORDER BY version DESC LIMIT 1`,
        [session.organizationId],
      ),
      client.query<{status:string}>(
        `SELECT CASE
           WHEN revoked_at IS NOT NULL THEN 'revoked'
           WHEN encrypted_embedding IS NOT NULL AND identity_verified_at IS NOT NULL
             AND enrollment_method IN ('supervised_camera','self_camera_approved') THEN 'verified'
           WHEN user_id IS NOT NULL THEN 'legacy'
           ELSE 'missing'
         END status
         FROM user_biometric_profiles
         WHERE organization_id=$1 AND user_id=$2`,
        [session.organizationId,session.userId],
      ),
      client.query<{id:string;status:string;site_id:string;site_name:string;requested_at:string;reviewed_at:string|null;review_note:string|null}>(
        `SELECT request.id::text,request.status,request.site_id::text,site.name site_name,
                request.requested_at::text,request.reviewed_at::text,request.review_note
         FROM biometric_enrollment_requests request
         JOIN sites site ON site.id=request.site_id
         WHERE request.organization_id=$1 AND request.user_id=$2
         ORDER BY request.requested_at DESC LIMIT 1`,
        [session.organizationId,session.userId],
      ),
    ]);

    await client.query("COMMIT");
    const effective=policy.rows[0]||DEFAULT_ATTENDANCE_POLICY;
    return NextResponse.json({
      policy:{
        enabled:effective.enabled,
        roleEnabled:attendanceRoleEnabled(session,effective.enabled_roles),
        requireFace:effective.require_face,
        maxLocationAccuracy:effective.max_location_accuracy_m,
        livenessThreshold:effective.liveness_threshold,
      },
      notice:notice.rows[0]||null,
      profileStatus:profile.rows[0]?.status||"missing",
      request:request.rows[0]||null,
    },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}

// ── Self-service enrollment request ─────────────────────────────────────────
// Browser gesture evidence is advisory. The server independently validates the
// active Attendance policy, membership, Site scope, geofence, embedding shape,
// anti-spoof/liveness scores and the exact active consent-policy version.
export async function POST(request:Request){
  const session=await getSession();
  if(!session?.userId||!session.organizationId)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.self"))return new NextResponse("Forbidden",{status:403});

  const body=await request.json().catch(()=>null) as {
    siteId?:unknown;policyVersionId?:unknown;consent?:unknown;embedding?:unknown;preview?:unknown;
    live?:unknown;real?:unknown;latitude?:unknown;longitude?:unknown;accuracy?:unknown;challengeEvidence?:unknown;
  }|null;

  const siteId=typeof body?.siteId==="string"?body.siteId:"";
  const policyVersionId=typeof body?.policyVersionId==="string"?body.policyVersionId:"";
  const embedding=validateEmbedding(body?.embedding);
  const preview=previewPayload(body?.preview);
  const challenge=activeChallenge(body?.challengeEvidence);
  const live=Number(body?.live);
  const real=Number(body?.real);
  const latitude=finiteCoordinate(body?.latitude,-90,90);
  const longitude=finiteCoordinate(body?.longitude,-180,180);
  const accuracy=Number(body?.accuracy);

  if(!UUID.test(siteId)||!UUID.test(policyVersionId)||body?.consent!==true||!embedding||!preview||!challenge){
    return NextResponse.json({message:"Completa la política, ubicación y prueba de vida antes de enviar el enrolamiento."},{status:422});
  }
  if(!canAccessSite(session,siteId))return new NextResponse("Forbidden",{status:403});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await expirePending(client,session.organizationId,session.userId);

    const policyResult=await client.query<Policy>(
      `SELECT enabled,enabled_roles,require_face,max_location_accuracy_m,liveness_threshold
       FROM organization_attendance_policies WHERE organization_id=$1 FOR UPDATE`,
      [session.organizationId],
    );
    const policy=policyResult.rows[0]||DEFAULT_ATTENDANCE_POLICY;
    if(!policy.enabled||!attendanceRoleEnabled(session,policy.enabled_roles)||!policy.require_face){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El enrolamiento facial no está habilitado para tu rol."},{status:409});
    }
    if(!Number.isFinite(live)||!Number.isFinite(real)||live<policy.liveness_threshold||real<policy.liveness_threshold){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La prueba de presencia real no alcanzó el nivel requerido."},{status:422});
    }

    const alreadyVerified=await client.query(
      `SELECT 1 FROM user_biometric_profiles
       WHERE organization_id=$1 AND user_id=$2 AND revoked_at IS NULL
         AND encrypted_embedding IS NOT NULL AND identity_verified_at IS NOT NULL
         AND enrollment_method IN ('supervised_camera','self_camera_approved')`,
      [session.organizationId,session.userId],
    );
    if(alreadyVerified.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Tu identidad biométrica ya está verificada. Solicita reenrolamiento solo si un administrador revoca la plantilla actual."},{status:409});
    }

    const pending=await client.query<{id:string}>(
      `SELECT id FROM biometric_enrollment_requests
       WHERE organization_id=$1 AND user_id=$2 AND status='pending' FOR UPDATE`,
      [session.organizationId,session.userId],
    );
    if(pending.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"Ya tienes una solicitud biométrica pendiente de aprobación.",requestId:pending.rows[0].id},{status:409});
    }

    const notice=await client.query<{id:string;version:number}>(
      `SELECT id,version FROM attendance_biometric_policy_versions
       WHERE id=$1 AND organization_id=$2 AND active=true`,
      [policyVersionId,session.organizationId],
    );
    if(!notice.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La política biométrica cambió. Léela nuevamente antes de continuar."},{status:409});
    }

    const siteResult=await client.query<{latitude:number|null;longitude:number|null;geofence_radius_m:number;name:string}>(
      `SELECT latitude,longitude,geofence_radius_m,name
       FROM sites WHERE id=$1 AND organization_id=$2 AND active=true`,
      [siteId,session.organizationId],
    );
    const site=siteResult.rows[0];
    if(!site||site.latitude===null||site.longitude===null||latitude===null||longitude===null||!Number.isFinite(accuracy)||accuracy<0){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"La sede requiere una geocerca y una ubicación GPS válida para enrolarte."},{status:422});
    }
    const maxEnrollmentAccuracy=Math.min(policy.max_location_accuracy_m,120);
    if(accuracy>maxEnrollmentAccuracy){
      await client.query("ROLLBACK");
      return NextResponse.json({message:`La precisión GPS es de ${Math.round(accuracy)} m. Se requieren ${maxEnrollmentAccuracy} m o menos.`},{status:422});
    }
    const distance=haversineMeters(latitude,longitude,site.latitude,site.longitude);
    if(distance>site.geofence_radius_m){
      await client.query("ROLLBACK");
      return NextResponse.json({message:`Estás a ${Math.round(distance)} m de ${site.name}; el enrolamiento debe realizarse dentro de la geocerca.`},{status:422});
    }

    const inserted=await client.query<{id:string;requested_at:string}>(
      `INSERT INTO biometric_enrollment_requests(
         organization_id,user_id,site_id,policy_version_id,status,
         encrypted_embedding,encrypted_preview,preview_mime,preview_expires_at,
         consented_at,latitude,longitude,accuracy_m,distance_m,liveness_method,challenge_evidence
       ) VALUES($1,$2,$3,$4,'pending',$5,$6,$7,now()+interval '72 hours',now(),$8,$9,$10,$11,'active_challenge_v1',$12::jsonb)
       RETURNING id::text,requested_at::text`,
      [
        session.organizationId,session.userId,siteId,policyVersionId,
        encryptEmbedding(embedding),encryptBiometricBlob(preview.bytes),preview.mime,
        latitude,longitude,accuracy,distance,JSON.stringify({steps:challenge}),
      ],
    );

    await client.query(
      `INSERT INTO biometric_enrollment_events(
         organization_id,user_id,actor_user_id,site_id,event_type,enrollment_method,metadata
       ) VALUES($1,$2,$2,$3,'requested','self_camera_approved',$4::jsonb)`,
      [session.organizationId,session.userId,siteId,JSON.stringify({
        request_id:inserted.rows[0].id,
        policy_version_id:policyVersionId,
        policy_version:notice.rows[0].version,
        consent:true,
        liveness_method:"active_challenge_v1",
        challenge:challenge.map(item=>item?.code),
        enrollment_location:{accuracy_m:accuracy,distance_m:distance},
      })],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      requestId:inserted.rows[0].id,
      status:"pending",
      requestedAt:inserted.rows[0].requested_at,
      message:"Solicitud enviada. Tu identidad requiere una única aprobación administrativa antes del primer marcaje.",
    });
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}
