import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function movement(value:string){
  if(value==="receipt")return {type:"receipt",sign:1};
  if(value==="issue")return {type:"issue",sign:1};
  if(value==="return")return {type:"return",sign:1};
  if(value==="adjustment_positive")return {type:"adjustment",sign:1};
  if(value==="adjustment_negative")return {type:"adjustment",sign:-1};
  if(value==="transfer")return {type:"transfer",sign:1};
  return null;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const item=await query<{organization_id:string;site_id:string;warehouse_id:string|null}>("SELECT organization_id,site_id,warehouse_id FROM inventory_items WHERE id=$1 AND active=true",[id]);
  if(!item.rowCount)return new NextResponse("Artículo no encontrado",{status:404});
  const row=item.rows[0];
  if(session.platformRole==="user"&&(session.organizationId!==row.organization_id||!canAccessSite(session,row.site_id)))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const action=movement(String(form.get("movement_type")||""));
  const quantity=Number(form.get("quantity")||0);
  const costRaw=String(form.get("unit_cost")||"").trim();
  const unitCost=costRaw?Number(costRaw):null;
  const warehouseId=String(form.get("warehouse_id")||row.warehouse_id||"");
  const destinationId=String(form.get("destination_warehouse_id")||"");
  const document=String(form.get("document_number")||"").trim();
  const movementAt=String(form.get("movement_at")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const returnTo=String(form.get("return_to")||"");
  const base=safeDashboardReturn(returnTo,"/dashboard/inventory");
  const target=(suffix:string)=>publicUrl(appendFeedback(base,suffix),request.url);
  if(!action||!Number.isFinite(quantity)||quantity<=0||!warehouseId)return NextResponse.redirect(target("?error=movement"),303);
  if(action.type==="transfer"&&(!destinationId||destinationId===warehouseId))return NextResponse.redirect(target("?error=movement"),303);
  const warehouses=await query<{id:string}>(
    "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[])",
    [row.organization_id,[warehouseId,...(destinationId?[destinationId]:[])]],
  );
  if(warehouses.rowCount!==(destinationId?2:1))return NextResponse.redirect(target("?error=relation"),303);
  try{
    await query(
      `INSERT INTO inventory_transactions(
         organization_id,item_id,type,quantity,unit_cost,warehouse_id,destination_warehouse_id,document_number,movement_at,created_by,notes
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz,now()),$10,$11)`,
      [row.organization_id,id,action.type,quantity*action.sign,unitCost,warehouseId,destinationId||null,document||null,movementAt||null,session.userId||null,notes||null],
    );
  }catch(error){
    return NextResponse.redirect(target("?error=stock"),303);
  }
  return NextResponse.redirect(target("?movement=1"),303);
}
