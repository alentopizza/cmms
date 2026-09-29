import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { stableCode } from "@/lib/import-workbook";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const current=await query<{organization_id:string}>("SELECT organization_id FROM inventory_categories WHERE id=$1",[id]);
  if(!current.rowCount)return new NextResponse("Categoría no encontrada",{status:404});
  if(!canAccessOrganization(session,current.rows[0].organization_id))return new NextResponse("Forbidden",{status:403});
  const form=await request.formData();
  const intent=String(form.get("intent")||"update");
  if(intent==="toggle"){
    const active=String(form.get("active")||"")==="true";
    await query("UPDATE inventory_categories SET active=$1 WHERE id=$2",[active,id]);
    return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?updated=1",request.url),303);
  }
  const name=String(form.get("name")||"").trim();
  const codeInput=String(form.get("code")||"").trim().toUpperCase();
  if(!name)return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?error=required",request.url),303);
  try{
    await query("UPDATE inventory_categories SET name=$1,code=$2 WHERE id=$3",[name,codeInput||stableCode("CAT",name),id]);
  }catch(error){
    if((error as {code?:string}).code==="23505")return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?error=duplicate",request.url),303);
    throw error;
  }
  return NextResponse.redirect(publicUrl("/dashboard/inventory/categories?updated=1",request.url),303);
}
