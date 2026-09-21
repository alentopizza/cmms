import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
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
  const frequencyValue=Number.parseInt(String(form.get("frequency_value")||"1"),10);
  const frequencyUnit=String(form.get("frequency_unit")||"month");
  const nextDueAt=String(form.get("next_due_at")||"").trim();
  const estimatedRaw=String(form.get("estimated_minutes")||"").trim();
  const estimatedMinutes=estimatedRaw ? Number.parseInt(estimatedRaw,10) : null;
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
  if(!canAccessSite(session,asset.rows[0].site_id)) return new NextResponse("Forbidden",{status:403});

  const gate=await getCreationGateForScope("routine",asset.rows[0].organization_id,false);
  if(!gate.ready) return NextResponse.redirect(target("?error=sequence"),303);

  await query(
    `INSERT INTO maintenance_plans(organization_id,asset_id,name,description,trigger_type,frequency_value,frequency_unit,next_due_at,estimated_minutes)
     VALUES($1,$2,$3,$4,'calendar',$5,$6,$7,$8)`,
    [asset.rows[0].organization_id,assetId,name,description||null,frequencyValue,frequencyUnit,nextDueAt||null,estimatedMinutes],
  );

  return NextResponse.redirect(target("?created=routine"),303);
}
