import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { publicUrl } from "@/lib/urls";

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"crews.manage")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  let organizationId=String(form.get("organization_id")||"");
  if(session.platformRole!=="superadmin") organizationId=session.organizationId || "";
  const siteId=String(form.get("site_id")||"");
  const name=String(form.get("name")||"").trim();
  const leaderUserId=String(form.get("leader_user_id")||"");
  const description=String(form.get("description")||"").trim();
  const memberIds=[...new Set(form.getAll("member_ids").map(v=>String(v)).filter(Boolean))];
  const target=(suffix:string)=>publicUrl(\`/dashboard/crews\${suffix}\`,request.url);

  if(!organizationId||!siteId||!name||!leaderUserId||memberIds.length<1) {
    return NextResponse.redirect(target("?error=members"),303);
  }

  if(!memberIds.includes(leaderUserId)) memberIds.push(leaderUserId);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const site=await client.query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,organizationId]);
    if(!site.rowCount || !canAccessSite(session,siteId)) {
      await client.query("ROLLBACK");
      return new NextResponse("Sede no autorizada",{status:403});
    }

    const gate=gateFor(await getSetupState(organizationId,client),"crew");
    if(!gate.ready){
      await client.query("ROLLBACK");
      return NextResponse.redirect(target("?error=sequence"),303);
    }

    const members=await client.query<{id:string}>(
      \`SELECT u.id::text id
       FROM organization_members om
       JOIN users u ON u.id=om.user_id
       WHERE om.organization_id=$1
         AND u.active=true
         AND om.role IN ('technician','external')
         AND u.id = ANY($2::uuid[])\`,
      [organizationId,memberIds],
    );

    if(members.rowCount!==memberIds.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(target("?error=members"),303);
    }

    const crew=await client.query<{id:string}>(
      \`INSERT INTO crews(organization_id,site_id,name,description,leader_user_id)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id\`,
      [organizationId,siteId,name,description||null,leaderUserId],
    );

    for(const userId of memberIds){
      await client.query(
        "INSERT INTO crew_members(crew_id,organization_id,user_id) VALUES($1,$2,$3)",
        [crew.rows[0].id,organizationId,userId],
      );
    }

    await client.query("COMMIT");
    return NextResponse.redirect(target("?created=1"),303);
  }catch(error){
    await client.query("ROLLBACK");
    if((error as {code?:string}).code==="23505") {
      return NextResponse.redirect(target("?error=duplicate"),303);
    }
    throw error;
  }finally{
    client.release();
  }
}
