import { NextResponse } from "next/server";
import { canAccessSite,getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { stableCode } from "@/lib/import-workbook";
import { publicUrl } from "@/lib/urls";

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const locationId=String(form.get("location_id")||"");
  const name=String(form.get("name")||"").trim();
  const codeInput=String(form.get("code")||"").trim().toUpperCase();
  const type=String(form.get("type")||"storage").trim()||"storage";
  const responsible=String(form.get("responsible")||"").trim();
  const capacityRaw=String(form.get("capacity")||"").trim();
  const capacity=capacityRaw?Number(capacityRaw):null;
  const locationDetail=String(form.get("location_detail")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  if(!siteId||!name||(capacity!==null&&(!Number.isFinite(capacity)||capacity<0)))return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?error=required",request.url),303);
  const site=await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND active=true",[siteId]);
  if(!site.rowCount)return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?error=relation",request.url),303);
  const organizationId=site.rows[0].organization_id;
  if(!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});
  if(session.platformRole==="user"&&!canAccessSite(session,siteId))return new NextResponse("Forbidden",{status:403});
  const location=locationId
    ?await query("SELECT 1 FROM locations WHERE id=$1 AND organization_id=$2 AND site_id=$3 AND active=true",[locationId,organizationId,siteId])
    :{rowCount:1};
  if(!location.rowCount)return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?error=relation",request.url),303);
  try{
    await query(
      `INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name,type,responsible,capacity,location_detail,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [organizationId,siteId,locationId||null,codeInput||stableCode("ALM",name),name,type,responsible||null,capacity,locationDetail||null,notes||null],
    );
  }catch(error){
    if((error as {code?:string}).code==="23505")return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?error=duplicate",request.url),303);
    throw error;
  }
  return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?created=1",request.url),303);
}
