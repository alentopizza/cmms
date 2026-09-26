import { NextResponse } from "next/server";
import { canAccessSite,getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { stableCode } from "@/lib/import-workbook";
import { publicUrl } from "@/lib/urls";
import { canAccessInventoryWarehouse } from "@/lib/inventory-scope";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const current=await query<{organization_id:string;site_id:string|null}>("SELECT organization_id,site_id FROM inventory_warehouses WHERE id=$1",[id]);
  if(!current.rowCount)return new NextResponse("Almacén no encontrado",{status:404});
  if(!canAccessInventoryWarehouse(session,current.rows[0].organization_id,current.rows[0].site_id))return new NextResponse("Forbidden",{status:403});
  const form=await request.formData();
  const intent=String(form.get("intent")||"update");
  if(intent==="toggle"){
    const active=String(form.get("active")||"")==="true";
    await query("UPDATE inventory_warehouses SET active=$1,updated_at=now() WHERE id=$2",[active,id]);
    return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?updated=1",request.url),303);
  }
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
  if(!canAccessSite(session,siteId))return new NextResponse("Forbidden",{status:403});
  const [site,location]=await Promise.all([
    query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,current.rows[0].organization_id]),
    locationId?query("SELECT 1 FROM locations WHERE id=$1 AND organization_id=$2 AND site_id=$3 AND active=true",[locationId,current.rows[0].organization_id,siteId]):Promise.resolve({rowCount:1}),
  ]);
  if(!site.rowCount||!location.rowCount)return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?error=relation",request.url),303);
  try{
    await query(
      `UPDATE inventory_warehouses SET site_id=$1,location_id=$2,code=$3,name=$4,type=$5,responsible=$6,capacity=$7,location_detail=$8,notes=$9,updated_at=now()
       WHERE id=$10`,
      [siteId,locationId||null,codeInput||stableCode("ALM",name),name,type,responsible||null,capacity,locationDetail||null,notes||null,id],
    );
  }catch(error){
    if((error as {code?:string}).code==="23505")return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?error=duplicate",request.url),303);
    throw error;
  }
  return NextResponse.redirect(publicUrl("/dashboard/inventory/warehouses?updated=1",request.url),303);
}
