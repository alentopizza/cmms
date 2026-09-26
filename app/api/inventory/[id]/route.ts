import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { stableCode } from "@/lib/import-workbook";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";
import { canAccessInventoryItem } from "@/lib/inventory-scope";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const existing=await query<{organization_id:string;site_id:string|null}>("SELECT organization_id,site_id FROM inventory_items WHERE id=$1",[id]);
  if(!existing.rowCount)return new NextResponse("Artículo no encontrado",{status:404});
  if(!canAccessInventoryItem(session,existing.rows[0].organization_id,existing.rows[0].site_id))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const intent=String(form.get("intent")||"update");
  const returnTo=String(form.get("return_to")||"");
  const base=safeDashboardReturn(returnTo,"/dashboard/inventory");
  const target=(suffix:string)=>publicUrl(appendFeedback(base,suffix),request.url);

  if(intent==="deactivate"){
    await query("UPDATE inventory_items SET active=false,updated_at=now() WHERE id=$1",[id]);
    return NextResponse.redirect(target("?updated=1"),303);
  }
  if(intent==="reactivate"){
    await query("UPDATE inventory_items SET active=true,updated_at=now() WHERE id=$1",[id]);
    return NextResponse.redirect(target("?updated=1"),303);
  }

  const name=String(form.get("name")||"").trim();
  const description=String(form.get("description")||"").trim();
  const presentation=String(form.get("presentation")||"").trim();
  const categoryName=String(form.get("category")||"").trim();
  const unit=String(form.get("unit")||"unidad").trim()||"unidad";
  const minQuantity=Math.max(0,Number(form.get("min_quantity")||0));
  const maxQuantity=Math.max(0,Number(form.get("max_quantity")||0));
  const unitCost=Math.max(0,Number(form.get("unit_cost")||0));
  let image=null;
  try{image=await readImageUpload(form,"image");}
  catch(error){return NextResponse.redirect(target("?error="+encodeURIComponent(imageUploadMessage(error)||"image")),303);}
  if(!name||![minQuantity,maxQuantity,unitCost].every(Number.isFinite))return NextResponse.redirect(target("?error=required"),303);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    let categoryId:string|null=null;
    if(categoryName){
      const category=await client.query<{id:string}>(
        "INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,$2,$3) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [existing.rows[0].organization_id,stableCode("CAT",categoryName),categoryName],
      );
      categoryId=category.rows[0].id;
    }
    await client.query(
      `UPDATE inventory_items SET
         name=$1,description=$2,presentation=$3,category_id=$4,unit=$5,min_quantity=$6,max_quantity=$7,unit_cost=$8,
         image_data=COALESCE($9,image_data),
         image_mime_type=CASE WHEN $9 IS NULL THEN image_mime_type ELSE $10 END,
         image_file_name=CASE WHEN $9 IS NULL THEN image_file_name ELSE $11 END,
         updated_at=now()
       WHERE id=$12`,
      [name,description||null,presentation||null,categoryId,unit,minQuantity,maxQuantity,unitCost,image?.data||null,image?.mime||null,image?"inventory-image":null,id],
    );
    await client.query(
      "UPDATE inventory_stock_levels SET min_quantity=$1,max_quantity=$2,updated_at=now() WHERE item_id=$3",
      [minQuantity,maxQuantity,id],
    );
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{client.release();}
  return NextResponse.redirect(target("?updated=1"),303);
}
