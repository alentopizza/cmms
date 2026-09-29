import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
  const explicitOrganization=String(form.get("organization_id")||"").trim();
  const organizationId=session.platformRole==="user"?session.organizationId:explicitOrganization;
  if(!organizationId||!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});
  const name=String(form.get("name")||"").trim();
  const codeInput=String(form.get("code")||"").trim().toUpperCase();
  if(!name)return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?error=required",request.url),303);
  try{
    await query(
      "INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,$2,$3)",
      [organizationId,codeInput||stableCode("CAT",name),name],
    );
  }catch(error){
    if((error as {code?:string}).code==="23505")return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?error=duplicate",request.url),303);
    throw error;
  }
  return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?created=1",request.url),303);
}
