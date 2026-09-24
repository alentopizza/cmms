import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { canCreateAsset } from "@/lib/resource-limits";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

const STATUSES=new Set(["operational","maintenance","down","retired"]);
const CRITICALITIES=new Set(["low","medium","high","critical"]);

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"assets.write")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const locationId=String(form.get("location_id")||"");
  const supplierId=String(form.get("supplier_id")||"");
  const categoryName=String(form.get("category")||"").trim();
  const code=String(form.get("code")||"").trim().toUpperCase();
  const name=String(form.get("name")||"").trim();
  const description=String(form.get("description")||"").trim();
  const status=String(form.get("status")||"operational");
  const criticality=String(form.get("criticality")||"medium");
  const manufacturer=String(form.get("manufacturer")||"").trim();
  const model=String(form.get("model")||"").trim();
  const serial=String(form.get("serial_number")||"").trim();
  const purchaseDate=String(form.get("purchase_date")||"").trim();
  const installationDate=String(form.get("installation_date")||"").trim();
  const warrantyExpires=String(form.get("warranty_expires")||"").trim();
  const purchaseCostRaw=String(form.get("purchase_cost")||"").trim();
  const purchaseCost=purchaseCostRaw?Number(purchaseCostRaw):null;
  const locationDetail=String(form.get("location_detail")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const returnTo=String(form.get("return_to")||"");

  const target=(suffix:string)=>publicUrl(appendFeedback(safeDashboardReturn(returnTo,"/dashboard/assets"),suffix),request.url);
  let image=null;
  try{image=await readImageUpload(form,"image");}
  catch(error){return NextResponse.redirect(target("?error="+encodeURIComponent(imageUploadMessage(error)||"image")),303);}

  if(!siteId||!locationId||!supplierId||!code||!name||!STATUSES.has(status)||!CRITICALITIES.has(criticality)){
    return NextResponse.redirect(target("?error=required"),303);
  }
  if([purchaseDate,installationDate,warrantyExpires].some(value=>value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))){
    return NextResponse.redirect(target("?error=required"),303);
  }
  if(purchaseCost!==null&&(!Number.isFinite(purchaseCost)||purchaseCost<0)){
    return NextResponse.redirect(target("?error=required"),303);
  }

  const site=session.platformRole!=="user"
    ? await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND active=true",[siteId])
    : await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,session.organizationId]);

  if(!site.rowCount) return NextResponse.redirect(target("?error=required"),303);
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

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    let categoryId:string|null=null;
    if(categoryName){
      const category=await client.query<{id:string}>(
        "INSERT INTO asset_categories(organization_id,name) VALUES($1,$2) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [organizationId,categoryName],
      );
      categoryId=category.rows[0].id;
    }

    await client.query(
      `INSERT INTO assets(
         organization_id,site_id,location_id,supplier_id,category_id,code,name,description,status,criticality,
         manufacturer,model,serial_number,purchase_date,installation_date,warranty_expires,purchase_cost,location_detail,notes,
         image_data,image_mime_type,image_file_name
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        organizationId,siteId,locationId,supplierId,categoryId,code,name,description||null,status,criticality,
        manufacturer||null,model||null,serial||null,purchaseDate||null,installationDate||null,warrantyExpires||null,
        purchaseCost,locationDetail||null,notes||null,image?.data||null,image?.mime||null,image?"asset-image":null,
      ],
    );
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    if((error as {code?:string}).code==="23505")return NextResponse.redirect(target("?error=code"),303);
    throw error;
  }finally{client.release();}

  return NextResponse.redirect(target("?created=asset"),303);
}
