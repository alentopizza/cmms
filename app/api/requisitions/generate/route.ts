import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write"))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const ids=[...new Set(form.getAll("item_id").map(value=>String(value)).filter(value=>UUID.test(value)))].slice(0,100);
  const neededBy=String(form.get("needed_by")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const returnTo=String(form.get("return_to")||"/dashboard/requisitions");
  const safeReturn=returnTo.startsWith("/dashboard/")?returnTo:"/dashboard/requisitions";

  if(!ids.length)return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=items",request.url),303);
  if(neededBy&&!/^\d{4}-\d{2}-\d{2}$/.test(neededBy))return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=date",request.url),303);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const items=await client.query<{
      id:string;organization_id:string;site_id:string|null;location_id:string|null;supplier_id:string;supplier_name:string;
      sku:string;name:string;unit:string;unit_cost:string;
    }>(
      `SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,s.name supplier_name,
              i.sku,i.name,i.unit,i.unit_cost::text
       FROM inventory_items i
       JOIN suppliers s ON s.id=i.supplier_id AND s.organization_id=i.organization_id
       WHERE i.id=ANY($1::uuid[]) AND i.active=true AND s.active=true AND s.supplier_type IN ('materials','both')`,
      [ids],
    );

    if(items.rowCount!==ids.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=relation",request.url),303);
    }

    for(const item of items.rows){
      if(session.platformRole==="user"){
        if(session.organizationId!==item.organization_id || (item.site_id&&!canAccessSite(session,item.site_id))){
          await client.query("ROLLBACK");
          return new NextResponse("Forbidden",{status:403});
        }
      }
    }

    const groups=new Map<string,typeof items.rows>();
    for(const item of items.rows){
      const key=item.organization_id+":"+item.supplier_id;
      const group=groups.get(key)||[];
      group.push(item);
      groups.set(key,group);
    }

    const createdIds:string[]=[];
    for(const group of groups.values()){
      const first=group[0];
      const req=await client.query<{id:string}>(
        `INSERT INTO supplier_requisitions(organization_id,supplier_id,requested_by,needed_by,notes)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,
        [first.organization_id,first.supplier_id,session.userId||null,neededBy||null,notes||null],
      );
      const requisitionId=req.rows[0].id;
      createdIds.push(requisitionId);

      for(const item of group){
        const quantity=Math.max(0,Number(form.get("qty_"+item.id)||0));
        if(!Number.isFinite(quantity)||quantity<=0){
          await client.query("ROLLBACK");
          return NextResponse.redirect(publicUrl(safeReturn+(safeReturn.includes("?")?"&":"?")+"error=quantity",request.url),303);
        }
        await client.query(
          `INSERT INTO supplier_requisition_items(
             requisition_id,organization_id,inventory_item_id,site_id,location_id,sku,description,unit,
             quantity_requested,unit_cost_estimated
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [requisitionId,item.organization_id,item.id,item.site_id,item.location_id,item.sku,item.name,item.unit,quantity,Number(item.unit_cost||0)],
        );
      }
    }

    await client.query("COMMIT");
    const join=safeReturn.includes("?")?"&":"?";
    return NextResponse.redirect(publicUrl(safeReturn+join+"created="+createdIds.length,request.url),303);
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
