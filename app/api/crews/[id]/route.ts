import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { pool } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectToCrews(params:Record<string,string>){
  const query=new URLSearchParams(params).toString();
  return new NextResponse(null,{status:303,headers:{Location:"/dashboard/crews"+(query?"?"+query:"")}});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"crews.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Cuadrilla inválida",{status:400});

  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const name=String(form.get("name")||"").trim();
  const description=String(form.get("description")||"").trim();
  const active=form.get("active")==="on";
  const leaderUserId=String(form.get("leader_user_id")||"");
  const memberIds=[...new Set(form.getAll("member_ids").map(value=>String(value)).filter(Boolean))];

  if(!siteId||!name||!leaderUserId)return redirectToCrews({error:"edit-fields"});
  if(!memberIds.includes(leaderUserId))memberIds.push(leaderUserId);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const current=await client.query<{organization_id:string}>(
      "SELECT organization_id::text FROM crews WHERE id=$1 FOR UPDATE",
      [id],
    );
    if(!current.rowCount){
      await client.query("ROLLBACK");
      return new NextResponse("Cuadrilla no encontrada",{status:404});
    }
    const organizationId=current.rows[0].organization_id;
    if(!canAccessOrganization(session,organizationId)){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    const site=await client.query(
      "SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",
      [siteId,organizationId],
    );
    if(!site.rowCount||!canAccessSite(session,siteId)){
      await client.query("ROLLBACK");
      return redirectToCrews({error:"site-access"});
    }

    const members=await client.query<{id:string}>(
      `SELECT u.id::text id
       FROM organization_members om
       JOIN users u ON u.id=om.user_id
       WHERE om.organization_id=$1
         AND u.active=true
         AND om.role IN ('manager','technician','external')
         AND (
           COALESCE(om.access_all_sites,true)=true
           OR EXISTS(
             SELECT 1 FROM organization_member_sites oms
             WHERE oms.organization_id=om.organization_id
               AND oms.user_id=om.user_id
               AND oms.site_id=$3
           )
         )
         AND u.id=ANY($2::uuid[])`,
      [organizationId,memberIds,siteId],
    );
    if(members.rowCount!==memberIds.length){
      await client.query("ROLLBACK");
      return redirectToCrews({error:"site-access"});
    }
    if(!memberIds.includes(leaderUserId)){
      await client.query("ROLLBACK");
      return redirectToCrews({error:"leader"});
    }

    await client.query(
      `UPDATE crews
       SET site_id=$1,name=$2,description=$3,leader_user_id=$4,active=$5,updated_at=now()
       WHERE id=$6`,
      [siteId,name,description||null,leaderUserId,active,id],
    );

    await client.query("DELETE FROM crew_members WHERE crew_id=$1",[id]);
    for(const userId of memberIds){
      await client.query(
        "INSERT INTO crew_members(crew_id,organization_id,user_id) VALUES($1,$2,$3)",
        [id,organizationId,userId],
      );
    }

    await client.query("COMMIT");
    return redirectToCrews({updated:"1"});
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    if((error as {code?:string}).code==="23505")return redirectToCrews({error:"duplicate"});
    throw error;
  }finally{
    client.release();
  }
}
