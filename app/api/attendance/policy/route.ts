import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { attendanceOrganizationId } from "@/lib/attendance-context";
import { DEFAULT_BIOMETRIC_NOTICE_BODY, DEFAULT_BIOMETRIC_NOTICE_TITLE } from "@/lib/attendance-policy";

const ROLE_SET = new Set(["admin","manager","technician","provider","external"]);

export async function POST(request: Request) {
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const organizationId=attendanceOrganizationId(session,form.get("organization_id"));
  if(!organizationId)return NextResponse.json({message:"Selecciona una empresa para administrar la asistencia."},{status:422});

  const enabled=form.get("enabled")==="true";
  const requireFace=form.get("require_face")==="true";
  const requireGeolocation=form.get("require_geolocation")==="true";
  const maxAccuracy=Math.max(10,Math.min(1000,Number(form.get("max_location_accuracy_m")||120)));
  const faceThreshold=Math.max(0.3,Math.min(0.95,Number(form.get("face_similarity_threshold")||0.55)));
  const livenessThreshold=Math.max(0.3,Math.min(0.99,Number(form.get("liveness_threshold")||0.60)));
  const roles=form.getAll("enabled_roles").map(String).filter(role=>ROLE_SET.has(role));
  const noticeTitle=String(form.get("biometric_notice_title")||DEFAULT_BIOMETRIC_NOTICE_TITLE).trim().slice(0,180);
  const noticeBody=String(form.get("biometric_notice_body")||DEFAULT_BIOMETRIC_NOTICE_BODY).trim().slice(0,12000);
  const returnStep=["1","2","3","4","5"].includes(String(form.get("return_step")||""))?String(form.get("return_step")):"";

  const targetParams=new URLSearchParams({
    organization_id:organizationId,
    view:"setup",
  });
  if(returnStep)targetParams.set("step",returnStep);
  const redirectToAttendance=(extra?:Record<string,string>)=>{
    const params=new URLSearchParams(targetParams);
    for(const [key,value] of Object.entries(extra||{}))params.set(key,value);
    return new NextResponse(null,{
      status:303,
      headers:{Location:"/dashboard/attendance?"+params.toString()},
    });
  };

  if(!roles.length){
    return redirectToAttendance({error:"roles"});
  }
  if(noticeTitle.length<8||noticeBody.length<80){
    return redirectToAttendance({error:"biometric_notice"});
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const organization=await client.query("SELECT 1 FROM organizations WHERE id=$1 AND active=true FOR UPDATE",[organizationId]);
    if(!organization.rowCount){
      await client.query("ROLLBACK");
      return new NextResponse("Not found",{status:404});
    }

    await client.query(
      `INSERT INTO organization_attendance_policies(
         organization_id,enabled,enabled_roles,require_face,require_geolocation,max_location_accuracy_m,
         face_similarity_threshold,liveness_threshold,updated_by,updated_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT(organization_id)
       DO UPDATE SET enabled=EXCLUDED.enabled,
                     enabled_roles=EXCLUDED.enabled_roles,
                     require_face=EXCLUDED.require_face,
                     require_geolocation=EXCLUDED.require_geolocation,
                     max_location_accuracy_m=EXCLUDED.max_location_accuracy_m,
                     face_similarity_threshold=EXCLUDED.face_similarity_threshold,
                     liveness_threshold=EXCLUDED.liveness_threshold,
                     updated_by=EXCLUDED.updated_by,
                     updated_at=now()`,
      [organizationId,enabled,roles,requireFace,requireGeolocation,maxAccuracy,faceThreshold,livenessThreshold,session.userId],
    );

    const current=await client.query<{id:string;version:number;title:string;body:string}>(
      `SELECT id,version,title,body FROM attendance_biometric_policy_versions
       WHERE organization_id=$1 AND active=true
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [organizationId],
    );
    const currentNotice=current.rows[0];
    if(!currentNotice||currentNotice.title!==noticeTitle||currentNotice.body!==noticeBody){
      if(currentNotice)await client.query("UPDATE attendance_biometric_policy_versions SET active=false WHERE id=$1",[currentNotice.id]);
      const nextVersion=currentNotice?currentNotice.version+1:1;
      await client.query(
        `INSERT INTO attendance_biometric_policy_versions(
           organization_id,version,title,body,active,published_by
         ) VALUES($1,$2,$3,$4,true,$5)`,
        [organizationId,nextVersion,noticeTitle,noticeBody,session.userId],
      );
      await client.query(
        `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
         VALUES($1,$2,'attendance_biometric_policy_published','attendance_biometric_policy',$1,$3::jsonb)`,
        [organizationId,session.userId,JSON.stringify({version:nextVersion,actor_platform_role:session.platformRole,actor_email:session.email})],
      );
    }

    await client.query("COMMIT");
    return redirectToAttendance({saved:"policy"});
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}
