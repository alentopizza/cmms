import { NextResponse } from "next/server";
import { canAccessSite,getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { pool,query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { readImageUpload,imageUploadMessage } from "@/lib/image-upload";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=new Set(["operational","maintenance","down","retired"]);
const CRITICALITIES=new Set(["low","medium","high","critical"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"assets.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const current=await query<{organization_id:string}>("SELECT organization_id FROM assets WHERE id=$1",[id]);
  if(!current.rowCount)return new NextResponse("Activo no encontrado",{status:404});
  const organizationId=current.rows[0].organization_id;
  if(!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const locationId=String(form.get("location_id")||"");
  const supplierId=String(form.get("supplier_id")||"");
  const assetType=String(form.get("asset_type")||"").trim();
  const categoryName=String(form.get("category")||"").trim();
  const code=String(form.get("code")||"").trim().toUpperCase();
  const name=String(form.get("name")||"").trim();
  const description=String(form.get("description")||"").trim();
  const manufacturer=String(form.get("manufacturer")||"").trim();
  const model=String(form.get("model")||"").trim();
  const serial=String(form.get("serial_number")||"").trim();
  const status=String(form.get("status")||"operational");
  const criticality=String(form.get("criticality")||"medium");
  const purchaseDate=String(form.get("purchase_date")||"").trim();
  const installationDate=String(form.get("installation_date")||"").trim();
  const warrantyExpires=String(form.get("warranty_expires")||"").trim();
  const purchaseCostRaw=String(form.get("purchase_cost")||"").trim();
  const purchaseCost=purchaseCostRaw?Number(purchaseCostRaw):null;
  const locationDetail=String(form.get("location_detail")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const target=(suffix:string)=>NextResponse.redirect(publicUrl("/dashboard/assets/"+id+suffix,request.url),303);

  if(!siteId||!locationId||!supplierId||!code||!name||!STATUSES.has(status)||!CRITICALITIES.has(criticality)){
    return target("?error=required");
  }
  if([purchaseDate,installationDate,warrantyExpires].some(value=>value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))){
    return target("?error=required");
  }
  if(purchaseCost!==null&&(!Number.isFinite(purchaseCost)||purchaseCost<0))return target("?error=required");
  if(session.platformRole==="user"&&!canAccessSite(session,siteId))return new NextResponse("Forbidden",{status:403});

  const [site,location,supplier]=await Promise.all([
    query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,organizationId]),
    query("SELECT 1 FROM locations WHERE id=$1 AND organization_id=$2 AND site_id=$3 AND active=true",[locationId,organizationId,siteId]),
    query("SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true",[supplierId,organizationId]),
  ]);
  if(!site.rowCount||!location.rowCount||!supplier.rowCount)return target("?error=relation");

  let image=null;
  try{image=await readImageUpload(form,"image");}
  catch(error){return target("?error="+encodeURIComponent(imageUploadMessage(error)||"image"));}

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
      `UPDATE assets SET
        site_id=$1,location_id=$2,supplier_id=$3,category_id=$4,asset_type=$5,code=$6,name=$7,description=$8,
        manufacturer=$9,model=$10,serial_number=$11,status=$12,criticality=$13,purchase_date=$14,
        installation_date=$15,warranty_expires=$16,purchase_cost=$17,location_detail=$18,notes=$19,
        image_data=COALESCE($20,image_data),
        image_mime_type=CASE WHEN $20 IS NULL THEN image_mime_type ELSE $21 END,
        image_file_name=CASE WHEN $20 IS NULL THEN image_file_name ELSE $22 END,
        updated_at=now()
       WHERE id=$23 AND organization_id=$24`,
      [
        siteId,locationId,supplierId,categoryId,assetType||null,code,name,description||null,manufacturer||null,model||null,serial||null,
        status,criticality,purchaseDate||null,installationDate||null,warrantyExpires||null,purchaseCost,
        locationDetail||null,notes||null,image?.data||null,image?.mime||null,image?"asset-image":null,id,organizationId,
      ],
    );
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    if((error as {code?:string}).code==="23505")return target("?error=code");
    throw error;
  }finally{client.release();}

  return target("?updated=1");
}
