import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool,query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCKED=new Set(["rejected","fulfilled","closed","cancelled"]);

type Req={organization_id:string;supplier_id:string;status:string};
type ReqItem={
  id:string;inventory_item_id:string|null;sku:string;description:string;quantity_requested:string;quantity_received:string;
  unit_cost_estimated:string;item_active:boolean|null;item_site_id:string|null;
};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write")||!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const result=await query<Req>(
    "SELECT organization_id,supplier_id,status FROM supplier_requisitions WHERE id=$1",
    [id],
  );
  if(!result.rowCount)return new NextResponse("Requisición no encontrada",{status:404});
  const req=result.rows[0];
  if(session.platformRole==="user"&&session.organizationId!==req.organization_id)return new NextResponse("Forbidden",{status:403});
  if(BLOCKED.has(req.status))return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_locked",request.url),303);

  const form=await request.formData();
  const documentNumber=String(form.get("document_number")||"").trim();
  const movementAt=String(form.get("movement_at")||"").trim();
  const costCenter=String(form.get("cost_center")||"").trim();
  const receiptNotes=String(form.get("receipt_notes")||"").trim();

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const items=await client.query<ReqItem>(
      `SELECT ri.id,ri.inventory_item_id,ri.sku,ri.description,ri.quantity_requested::text,ri.quantity_received::text,
              ri.unit_cost_estimated::text,i.active item_active,i.site_id item_site_id
       FROM supplier_requisition_items ri
       LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id AND i.organization_id=ri.organization_id
       WHERE ri.requisition_id=$1
       ORDER BY ri.created_at
       FOR UPDATE OF ri`,
      [id],
    );

    const pendingRows:{item:ReqItem;qty:number;warehouseId:string;unitCost:number;lot:string;expires:string}[]=[];
    for(const item of items.rows){
      const raw=String(form.get("receive_qty_"+item.id)||"").trim();
      if(!raw)continue;
      const qty=Number(raw);
      if(!Number.isFinite(qty)||qty<=0){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_qty",request.url),303);
      }
      const requested=Number(item.quantity_requested);
      const received=Number(item.quantity_received);
      const remaining=Math.max(0,requested-received);
      if(qty>remaining+0.000001){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_over",request.url),303);
      }
      if(!item.inventory_item_id||item.item_active===false||item.item_active===null){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_item",request.url),303);
      }
      if(session.platformRole==="user"&&!session.accessAllSites&&item.item_site_id&&!session.siteIds.includes(item.item_site_id)){
        await client.query("ROLLBACK");
        return new NextResponse("Forbidden",{status:403});
      }

      const warehouseId=String(form.get("warehouse_"+item.id)||"").trim();
      if(!UUID.test(warehouseId)){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_warehouse",request.url),303);
      }
      const costRaw=String(form.get("receive_cost_"+item.id)||"").trim();
      const unitCost=costRaw?Number(costRaw):Number(item.unit_cost_estimated||0);
      if(!Number.isFinite(unitCost)||unitCost<0){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_cost",request.url),303);
      }
      const lot=String(form.get("lot_"+item.id)||"").trim();
      const expires=String(form.get("expires_"+item.id)||"").trim();
      if(expires&&!/^\d{4}-\d{2}-\d{2}$/.test(expires)){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_date",request.url),303);
      }
      pendingRows.push({item,qty,warehouseId,unitCost,lot,expires});
    }

    if(!pendingRows.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_empty",request.url),303);
    }

    const warehouseIds=[...new Set(pendingRows.map(row=>row.warehouseId))];
    const warehouses=session.platformRole==="user"&&!session.accessAllSites
      ?await client.query<{id:string}>(
        "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) AND (site_id IS NULL OR site_id=ANY($3::uuid[]))",
        [req.organization_id,warehouseIds,session.siteIds],
      )
      :await client.query<{id:string}>(
        "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[])",
        [req.organization_id,warehouseIds],
      );
    if(warehouses.rowCount!==warehouseIds.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive_warehouse",request.url),303);
    }

    for(const row of pendingRows){
      await client.query(
        `INSERT INTO inventory_transactions(
          organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,movement_at,created_by,
          lot_number,expires_at,cost_center,notes,requisition_id,requisition_item_id
        ) VALUES($1,$2,'receipt',$3,$4,$5,$6,COALESCE($7::timestamptz,now()),$8,$9,$10,$11,$12,$13,$14)`,
        [
          req.organization_id,row.item.inventory_item_id,row.qty,row.unitCost,row.warehouseId,documentNumber||null,
          movementAt||null,session.userId||null,row.lot||null,row.expires||null,costCenter||null,receiptNotes||null,id,row.item.id,
        ],
      );
      await client.query(
        `UPDATE supplier_requisition_items
         SET quantity_received=quantity_received+$1
         WHERE id=$2 AND requisition_id=$3`,
        [row.qty,row.item.id,id],
      );
    }

    const completion=await client.query<{pending:string}>(
      `SELECT count(*)::text pending
       FROM supplier_requisition_items
       WHERE requisition_id=$1 AND quantity_received+0.000001 < quantity_requested`,
      [id],
    );
    const complete=Number(completion.rows[0]?.pending||0)===0;
    await client.query(
      `UPDATE supplier_requisitions SET
         status=$1,
         fulfilled_at=CASE WHEN $1='fulfilled' THEN COALESCE(fulfilled_at,now()) ELSE fulfilled_at END,
         updated_at=now()
       WHERE id=$2`,
      [complete?"fulfilled":"partial",id],
    );

    await client.query("COMMIT");
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?received="+pendingRows.length,request.url),303);
  }catch(error){
    await client.query("ROLLBACK");
    console.error("requisition receipt failed",error);
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=receive",request.url),303);
  }finally{
    client.release();
  }
}
