import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { getCreationGateForScope } from "@/lib/setup-sequence";

const UNITS=new Set(["day","week","month","year"]);

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"maintenance.write")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const assetId=String(form.get("asset_id")||"");
  const name=String(form.get("name")||"").trim();
  const description=String(form.get("description")||"").trim();
  const routineType=String(form.get("routine_type")||"").trim();
  const priority=String(form.get("priority")||"medium").trim();
  const specialty=String(form.get("specialty")||"").trim();
  const frequencyValue=Number.parseInt(String(form.get("frequency_value")||"1"),10);
  const frequencyUnit=String(form.get("frequency_unit")||"month");
  const nextDueAt=String(form.get("next_due_at")||"").trim();
  const estimatedRaw=String(form.get("estimated_minutes")||"").trim();
  const estimatedMinutes=estimatedRaw ? Number.parseInt(estimatedRaw,10) : null;
  const assignedTo=String(form.get("assigned_to")||"");
  const crewId=String(form.get("crew_id")||"");
  const supplierId=String(form.get("service_supplier_id")||"");
  const returnTo=String(form.get("return_to")||"");
  const target=(suffix:string)=>publicUrl(appendFeedback(safeDashboardReturn(returnTo,"/dashboard/maintenance"),suffix),request.url);

  if(!assetId||!name||!Number.isFinite(frequencyValue)||frequencyValue<1||!UNITS.has(frequencyUnit)) {
    return NextResponse.redirect(target("?error=required"),303);
  }
  if(estimatedMinutes!==null && (!Number.isFinite(estimatedMinutes)||estimatedMinutes<0)) {
    return NextResponse.redirect(target("?error=required"),303);
  }

  const asset=session.platformRole!=="user"
    ? await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1 AND status<>'retired'",[assetId])
    : await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1 AND organization_id=$2 AND status<>'retired'",[assetId,session.organizationId]);

  if(!asset.rowCount) return NextResponse.redirect(target("?error=asset"),303);
  if(!canAccessOrganization(session,asset.rows[0].organization_id)) return new NextResponse("Forbidden",{status:403});
  if(session.platformRole==="user"&&!canAccessSite(session,asset.rows[0].site_id)) return new NextResponse("Forbidden",{status:403});

  const gate=await getCreationGateForScope("routine",asset.rows[0].organization_id,false);
  if(!gate.ready) return NextResponse.redirect(target("?error=sequence"),303);

  const selected=[assignedTo,crewId,supplierId].filter(Boolean);
  if(selected.length>1) return NextResponse.redirect(target("?error=executor"),303);

  if(assignedTo){
    const worker=await query(
      `SELECT 1
       FROM organization_members om
       JOIN users u ON u.id=om.user_id
       WHERE om.organization_id=$1 AND u.id=$2 AND u.active=true
         AND om.role IN ('technician','external')
         AND (
           COALESCE(om.access_all_sites,true)=true
           OR EXISTS(
             SELECT 1 FROM organization_member_sites oms
             WHERE oms.organization_id=om.organization_id
               AND oms.user_id=om.user_id
               AND oms.site_id=$3
           )
         )`,
      [asset.rows[0].organization_id,assignedTo,asset.rows[0].site_id],
    );
    if(!worker.rowCount) return NextResponse.redirect(target("?error=executor"),303);
  }
  if(crewId){
    const crew=await query(
      "SELECT 1 FROM crews WHERE id=$1 AND organization_id=$2 AND active=true AND (site_id IS NULL OR site_id=$3)",
      [crewId,asset.rows[0].organization_id,asset.rows[0].site_id],
    );
    if(!crew.rowCount) return NextResponse.redirect(target("?error=executor"),303);
  }
  if(supplierId){
    const supplier=await query(
      "SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",
      [supplierId,asset.rows[0].organization_id],
    );
    if(!supplier.rowCount) return NextResponse.redirect(target("?error=executor"),303);
  }

  await query(
    `INSERT INTO maintenance_plans(
       organization_id,asset_id,name,description,routine_type,priority,specialty,trigger_type,
       frequency_value,frequency_unit,next_due_at,estimated_minutes,assigned_to,crew_id,service_supplier_id
     )
     VALUES($1,$2,$3,$4,$5,$6,$7,'calendar',$8,$9,$10,$11,$12,$13,$14)`,
    [
      asset.rows[0].organization_id,assetId,name,description||null,routineType||null,priority||null,specialty||null,
      frequencyValue,frequencyUnit,nextDueAt||null,estimatedMinutes,assignedTo||null,crewId||null,supplierId||null,
    ],
  );

  return NextResponse.redirect(target("?created=routine"),303);
}
