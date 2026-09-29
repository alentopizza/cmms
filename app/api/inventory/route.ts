import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { canCreateInventoryItem } from "@/lib/resource-limits";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { stableCode } from "@/lib/import-workbook";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";
import { canAccessInventoryWarehouse } from "@/lib/inventory-scope";

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const siteId=String(form.get("site_id")||"");
  const locationId=String(form.get("location_id")||"");
  const supplierId=String(form.get("supplier_id")||"");
  const categoryName=String(form.get("category")||"").trim();
  const warehouseIdInput=String(form.get("warehouse_id")||"");
  const warehouseName=String(form.get("warehouse_name")||form.get("storage_location")||"Almacén principal").trim()||"Almacén principal";
  const sku=String(form.get("sku")||"").trim().toUpperCase();
  const name=String(form.get("name")||"").trim();
  const description=String(form.get("description")||"").trim();
  const presentation=String(form.get("presentation")||"").trim();
  const unit=String(form.get("unit")||"unidad").trim()||"unidad";
  const quantity=Math.max(0,Number(form.get("quantity")||0));
  const minQuantity=Math.max(0,Number(form.get("min_quantity")||0));
  const maxQuantity=Math.max(0,Number(form.get("max_quantity")||0));
  const unitCost=Math.max(0,Number(form.get("unit_cost")||0));
  const returnTo=String(form.get("return_to")||"");
  const base=safeDashboardReturn(returnTo,"/dashboard/inventory");
  const target=(suffix:string)=>publicUrl(appendFeedback(base,suffix),request.url);
  const supplierContextReturn=base.startsWith("/dashboard/suppliers");
  const errorTarget=(code:string)=>target((supplierContextReturn?"?inventory_error=":"?error=")+encodeURIComponent(code));
  const createdTarget=()=>target(supplierContextReturn?"?inventory_created=1":"?created=1");

  if(!siteId||!locationId||!supplierId||!sku||!name) return NextResponse.redirect(errorTarget("required"),303);

  // Supplier is part of the Inventory master record and therefore owns the
  // Organization context for this create operation. This is especially
  // important for Platform Owner/Superadmin flows opened directly from a
  // Supplier profile, where the session intentionally has no selected tenant.
  const supplierScope=await query<{organization_id:string}>(
    "SELECT organization_id FROM suppliers WHERE id=$1 AND active=true AND supplier_type IN ('materials','both')",
    [supplierId],
  );
  if(!supplierScope.rowCount) return NextResponse.redirect(errorTarget("relation"),303);

  const organizationId=supplierScope.rows[0].organization_id;
  if(!canAccessOrganization(session,organizationId)){
    return new NextResponse("Forbidden",{status:403});
  }
  let image=null;
  try{ image=await readImageUpload(form,"image"); }
  catch(error){ return NextResponse.redirect(errorTarget(imageUploadMessage(error)||"image"),303); }

  if(session.platformRole==="user"&&!canAccessSite(session,siteId)) return new NextResponse("Forbidden",{status:403});
  if(!Number.isFinite(quantity)||!Number.isFinite(minQuantity)||!Number.isFinite(maxQuantity)||!Number.isFinite(unitCost)){
    return NextResponse.redirect(errorTarget("required"),303);
  }

  const gate=gateFor(await getSetupState(organizationId),"inventory");
  if(!gate.ready) return NextResponse.redirect(errorTarget("sequence"),303);
  if(!(await canCreateInventoryItem(organizationId))) return NextResponse.redirect(errorTarget("limit"),303);

  const [site,location]=await Promise.all([
    query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true",[siteId,organizationId]),
    query("SELECT 1 FROM locations WHERE id=$1 AND organization_id=$2 AND site_id=$3 AND active=true",[locationId,organizationId,siteId]),
  ]);
  if(!site.rowCount||!location.rowCount) return NextResponse.redirect(errorTarget("relation"),303);
  if(warehouseIdInput){
    const warehouseScope=await query<{organization_id:string;site_id:string|null;location_id:string|null}>(
      "SELECT organization_id,site_id,location_id FROM inventory_warehouses WHERE id=$1 AND organization_id=$2 AND active=true",
      [warehouseIdInput,organizationId],
    );
    const warehouse=warehouseScope.rows[0];
    if(!warehouse
      ||!canAccessInventoryWarehouse(session,warehouse.organization_id,warehouse.site_id)
      ||warehouse.site_id!==siteId
      ||(warehouse.location_id!==null&&warehouse.location_id!==locationId)){
      return NextResponse.redirect(errorTarget("relation"),303);
    }
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    let categoryId:string|null=null;
    if(categoryName){
      const category=await client.query<{id:string}>(
        "INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,$2,$3) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [organizationId,stableCode("CAT",categoryName),categoryName],
      );
      categoryId=category.rows[0].id;
    }

    let warehouseId=warehouseIdInput;
    if(warehouseId){
      const warehouse=await client.query(
        "SELECT 1 FROM inventory_warehouses WHERE id=$1 AND organization_id=$2 AND active=true AND site_id=$3 AND (location_id IS NULL OR location_id=$4)",
        [warehouseId,organizationId,siteId,locationId],
      );
      if(!warehouse.rowCount){
        await client.query("ROLLBACK");
        return NextResponse.redirect(errorTarget("relation"),303);
      }
    }
    if(!warehouseId){
      const existing=await client.query<{id:string}>(
        "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND site_id=$2 AND location_id=$3 AND lower(name)=lower($4) AND active=true LIMIT 1",
        [organizationId,siteId,locationId,warehouseName],
      );
      if(existing.rowCount)warehouseId=existing.rows[0].id;
      else{
        const created=await client.query<{id:string}>(
          "INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [organizationId,siteId,locationId,stableCode("ALM",siteId+"-"+locationId+"-"+warehouseName),warehouseName],
        );
        warehouseId=created.rows[0].id;
      }
    }

    const item=await client.query<{id:string}>(
      `INSERT INTO inventory_items(
         organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,sku,name,description,presentation,
         unit,quantity,min_quantity,max_quantity,unit_cost,storage_location,image_data,image_mime_type,image_file_name
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [organizationId,siteId,locationId,supplierId,categoryId,warehouseId,sku,name,description||null,presentation||null,unit,minQuantity,maxQuantity,unitCost,warehouseName,image?.data||null,image?.mime||null,image?"inventory-image":null],
    );
    await client.query(
      `INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity)
       VALUES($1,$2,$3,0,$4,$5)
       ON CONFLICT(item_id,warehouse_id) DO UPDATE SET min_quantity=EXCLUDED.min_quantity,max_quantity=EXCLUDED.max_quantity,updated_at=now()`,
      [organizationId,item.rows[0].id,warehouseId,minQuantity,maxQuantity],
    );
    if(quantity>0){
      await client.query(
        `INSERT INTO inventory_transactions(
           organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,movement_at,created_by,notes
         ) VALUES($1,$2,'receipt',$3,$4,$5,'ALTA-INICIAL',now(),$6,'Existencia inicial registrada al crear el artículo')`,
        [organizationId,item.rows[0].id,quantity,unitCost,warehouseId,session.userId||null],
      );
    }
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    if((error as {code?:string}).code==="23505") return NextResponse.redirect(errorTarget("sku"),303);
    throw error;
  }finally{client.release();}

  return NextResponse.redirect(createdTarget(),303);
}
