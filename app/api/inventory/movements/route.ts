import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { canAccessInventoryItem, canAccessInventoryWarehouse } from "@/lib/inventory-scope";
import { insertManualInventoryMovement, readManualMovementIdempotencyKey, type ManualInventoryMovementType } from "@/lib/inventory-manual-movement";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function movement(value:string):{type:ManualInventoryMovementType;sign:1|-1}|null{
  if(value==="receipt")return {type:"receipt",sign:1};
  if(value==="issue")return {type:"issue",sign:1};
  if(value==="return")return {type:"return",sign:1};
  if(value==="adjustment_positive")return {type:"adjustment",sign:1};
  if(value==="adjustment_negative")return {type:"adjustment",sign:-1};
  if(value==="transfer")return {type:"transfer",sign:1};
  return null;
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  const form=await request.formData();
  const idempotencyKey=readManualMovementIdempotencyKey(request,form);
  if(!idempotencyKey)return new NextResponse("Idempotency-Key UUID required",{status:400});
  const itemId=String(form.get("item_id")||"");
  if(!UUID.test(itemId))return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=required",request.url),303);
  const item=await query<{organization_id:string;site_id:string|null;warehouse_id:string|null}>(
    "SELECT organization_id,site_id,warehouse_id FROM inventory_items WHERE id=$1 AND active=true",[itemId],
  );
  if(!item.rowCount)return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=required",request.url),303);
  const row=item.rows[0];
  if(!canAccessInventoryItem(session,row.organization_id,row.site_id))return new NextResponse("Forbidden",{status:403});
  const contextSuffix="&organization="+encodeURIComponent(row.organization_id);

  const action=movement(String(form.get("movement_type")||""));
  const quantity=Number(form.get("quantity")||0);
  const costRaw=String(form.get("unit_cost")||"").trim();
  const unitCost=costRaw?Number(costRaw):null;
  const warehouseId=String(form.get("warehouse_id")||row.warehouse_id||"");
  const destinationId=String(form.get("destination_warehouse_id")||"");
  const document=String(form.get("document_number")||"").trim();
  const movementAt=String(form.get("movement_at")||"").trim();
  const lot=String(form.get("lot_number")||"").trim();
  const expires=String(form.get("expires_at")||"").trim();
  const costCenter=String(form.get("cost_center")||"").trim();
  const notes=String(form.get("notes")||"").trim();

  if(!action||!Number.isFinite(quantity)||quantity<=0||!warehouseId)return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=movement"+contextSuffix,request.url),303);
  if(unitCost!==null&&(!Number.isFinite(unitCost)||unitCost<0))return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=movement",request.url),303);
  if(expires&&!/^\d{4}-\d{2}-\d{2}$/.test(expires))return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=movement",request.url),303);
  if(action.type==="transfer"&&(!destinationId||destinationId===warehouseId))return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=movement",request.url),303);

  const warehouseIds=[warehouseId,...(destinationId?[destinationId]:[])];
  const warehouses=await query<{id:string;organization_id:string;site_id:string|null}>(
    "SELECT id,organization_id,site_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[])",
    [row.organization_id,warehouseIds],
  );
  if(warehouses.rowCount!==warehouseIds.length||warehouses.rows.some(warehouse=>!canAccessInventoryWarehouse(session,warehouse.organization_id,warehouse.site_id))){
    return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=relation"+contextSuffix,request.url),303);
  }

  try{
    const result=await insertManualInventoryMovement({
      organizationId:row.organization_id,
      itemId,
      type:action.type,
      quantity:quantity*action.sign,
      unitCost,
      warehouseId,
      destinationWarehouseId:destinationId||null,
      documentNumber:document||null,
      movementAt:movementAt||null,
      createdBy:session.userId||null,
      lotNumber:lot||null,
      expiresAt:expires||null,
      costCenter:costCenter||null,
      notes:notes||null,
      idempotencyKey,
    });
    if(result.status==="conflict")return new NextResponse("Idempotency key already used with a different movement payload",{status:409});
  }catch{
    return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?error=stock"+contextSuffix,request.url),303);
  }
  return NextResponse.redirect(publicUrl("/dashboard/inventory/kardex?created=1"+contextSuffix,request.url),303);
}
