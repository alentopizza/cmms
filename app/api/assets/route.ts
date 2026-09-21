import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { canCreateAsset } from "@/lib/resource-limits";

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"assets.write")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const locationId=String(form.get("location_id")||"");
  const supplierId=String(form.get("supplier_id")||"");
  const code=String(form.get("code")||"").trim();
  const name=String(form.get("name")||"").trim();
  const criticality=String(form.get("criticality")||"medium");
  const manufacturer=String(form.get("manufacturer")||"").trim();
  const model=String(form.get("model")||"").trim();

  const target=(suffix:string)=>publicUrl("/dashboard/assets"+suffix,request.url);

  const site=session.platformRole==="superadmin"
    ? await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND active=true",[siteId])
    : await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,session.organizationId]);

  if(!site.rowCount||!code||!name||!locationId||!supplierId) return NextResponse.redirect(target("?error=required"),303);
  if(!canAccessSite(session,siteId)) return new NextResponse("Forbidden",{status:403});
  const organizationId=site.rows[0].organization_id;

  const gate=gateFor(await getSetupState(organizationId),"asset");
  if(!gate.ready) return NextResponse.redirect(target("?error=sequence"),303);
  if(!(await canCreateAsset(organizationId))) return NextResponse.redirect(target("?error=limit"),303);

  const [location,supplier]=await Promise.all([
    query("SELECT 1 FROM locations WHERE id=$1 AND organization_id=$2 AND site_id=$3 AND active=true",[locationId,organizationId,siteId]),
    query("SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true",[supplierId,organizationId]),
  ]);
  if(!location.rowCount||!supplier.rowCount) return NextResponse.redirect(target("?error=relation"),303);

  await query(
    `INSERT INTO assets(organization_id,site_id,location_id,supplier_id,code,name,criticality,manufacturer,model)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [organizationId,siteId,locationId,supplierId,code,name,criticality,manufacturer||null,model||null],
  );
  return NextResponse.redirect(target("?created=1"),303);
}
