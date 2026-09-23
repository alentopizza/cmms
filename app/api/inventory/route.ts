import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { canCreateInventoryItem } from "@/lib/resource-limits";

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write")) return new NextResponse("Forbidden",{status:403});
  if(!session.organizationId) return new NextResponse("Selecciona una empresa",{status:400});

  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const locationId=String(form.get("location_id")||"");
  const supplierId=String(form.get("supplier_id")||"");
  const sku=String(form.get("sku")||"").trim().toUpperCase();
  const name=String(form.get("name")||"").trim();
  const unit=String(form.get("unit")||"unit").trim()||"unit";
  const quantity=Math.max(0,Number(form.get("quantity")||0));
  const minQuantity=Math.max(0,Number(form.get("min_quantity")||0));
  const unitCost=Math.max(0,Number(form.get("unit_cost")||0));
  const storageLocation=String(form.get("storage_location")||"").trim();
  const organizationId=session.organizationId;
  const target=(suffix:string)=>publicUrl("/dashboard/inventory"+suffix,request.url);

  if(!siteId||!locationId||!supplierId||!sku||!name) return NextResponse.redirect(target("?error=required"),303);
  if(!canAccessSite(session,siteId)) return new NextResponse("Forbidden",{status:403});

  const gate=gateFor(await getSetupState(organizationId),"inventory");
  if(!gate.ready) return NextResponse.redirect(target("?error=sequence"),303);
  if(!(await canCreateInventoryItem(organizationId))) return NextResponse.redirect(target("?error=limit"),303);

  const [site,location,supplier]=await Promise.all([
    query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,organizationId]),
    query("SELECT 1 FROM locations WHERE id=$1 AND organization_id=$2 AND site_id=$3 AND active=true",[locationId,organizationId,siteId]),
    query("SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('materials','both')",[supplierId,organizationId]),
  ]);
  if(!site.rowCount||!location.rowCount||!supplier.rowCount) return NextResponse.redirect(target("?error=relation"),303);

  try{
    await query(
      `INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,sku,name,unit,quantity,min_quantity,unit_cost,storage_location)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [organizationId,siteId,locationId,supplierId,sku,name,unit,quantity,minQuantity,unitCost,storageLocation||null],
    );
  }catch(error){
    if((error as {code?:string}).code==="23505") return NextResponse.redirect(target("?error=sku"),303);
    throw error;
  }

  return NextResponse.redirect(target("?created=1"),303);
}
