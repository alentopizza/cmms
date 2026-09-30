import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { attendanceOrganizationId } from "@/lib/attendance-context";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_ROLES=new Set(["admin","manager","technician","provider","external"]);

type Target={role:string;access_all_sites:boolean;site_ids:string[]};

async function loadTarget(client:import("pg").PoolClient,organizationId:string,userId:string){
  return client.query<Target>(
    `SELECT om.role,COALESCE(om.access_all_sites,true) access_all_sites,
            COALESCE((
              SELECT array_agg(oms.site_id::text ORDER BY oms.site_id::text)
              FROM organization_member_sites oms
              WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
            ),ARRAY[]::text[]) site_ids
     FROM organization_members om
     JOIN users u ON u.id=om.user_id
     WHERE om.organization_id=$1 AND om.user_id=$2 AND u.active=true`,
    [organizationId,userId],
  );
}

function visibleToManager(session:Awaited<ReturnType<typeof getSession>>,target:Target){
  if(!session)return false;
  if(session.platformRole!=="user"||session.accessAllSites)return true;
  if(target.access_all_sites)return session.siteIds.length>0;
  const allowed=new Set(session.siteIds);
  return target.site_ids.some(siteId=>allowed.has(siteId));
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const {id:userId}=await params;
  if(!UUID.test(userId))return NextResponse.json({message:"Usuario inválido."},{status:422});
  const body=await request.json().catch(()=>null) as {organizationId?:unknown;mode?:unknown;reason?:unknown}|null;
  const organizationId=attendanceOrganizationId(session,body?.organizationId);
  if(!organizationId)return NextResponse.json({message:"Selecciona una empresa válida."},{status:422});

  const mode=body?.mode==="enabled"||body?.mode==="disabled"||body?.mode==="inherit"?body.mode:null;
  if(!mode)return NextResponse.json({message:"Selecciona una condición de asistencia válida."},{status:422});
  const reason=typeof body?.reason==="string"?body.reason.trim().slice(0,500):"";

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const targetResult=await loadTarget(client,organizationId,userId);
    if(!targetResult.rowCount){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El usuario no pertenece a esta empresa."},{status:404});
    }
    const target=targetResult.rows[0];
    if(!CONTROL_ROLES.has(target.role)){
      await client.query("ROLLBACK");
      return NextResponse.json({message:"El rol de este usuario no utiliza control de asistencia."},{status:422});
    }
    if(!visibleToManager(session,target)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    if(mode==="inherit"){
      await client.query(
        "DELETE FROM user_attendance_control_overrides WHERE organization_id=$1 AND user_id=$2",
        [organizationId,userId],
      );
    }else{
      await client.query(
        `INSERT INTO user_attendance_control_overrides(
           organization_id,user_id,enabled,reason,updated_by,updated_at
         ) VALUES($1,$2,$3,$4,$5,now())
         ON CONFLICT(organization_id,user_id)
         DO UPDATE SET enabled=EXCLUDED.enabled,reason=EXCLUDED.reason,
                       updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [organizationId,userId,mode==="enabled",reason||null,session.userId],
      );
    }

    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,'attendance_user_control_changed','user_attendance_control',$3,$4::jsonb)`,
      [organizationId,session.userId,userId,JSON.stringify({
        user_id:userId,
        mode,
        reason:reason||null,
        actor_platform_role:session.platformRole,
        actor_email:session.email,
      })],
    );
    await client.query("COMMIT");
    return NextResponse.json({mode,enabledOverride:mode==="inherit"?null:mode==="enabled"});
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}
