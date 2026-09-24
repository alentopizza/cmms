import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS=new Set(["damaged","wrong_item","quality","excess","other"]);
const RESOLUTIONS=new Set(["replacement","credit_note","other"]);

type Req={organization_id:string;supplier_id:string;number:string};
type Receipt={
  id:string;requisition_item_id:string;item_id:string;warehouse_id:string|null;quantity:string;unit_cost:string|null;
  lot_number:string|null;expires_at:string|null;cost_center:string|null;
  item_site_id:string|null;sku:string;description:string;
};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write")||!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const form=await request.formData();
  const reasonCode=String(form.get("reason_code")||"").trim();
  const expectedResolution=String(form.get("expected_resolution")||"").trim();
  const reasonDetail=String(form.get("reason_detail")||"").trim();
  const documentNumber=String(form.get("document_number")||"").trim();
  const returnedAt=String(form.get("returned_at")||"").trim();

  if(!REASONS.has(reasonCode)||!RESOLUTIONS.has(expectedResolution)||(reasonCode==="other"&&!reasonDetail)){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=return_reason",request.url),303);
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    // ── Supplier-return authorization and concurrency boundary ───────────────
    // Lock the requisition and source receipt rows so concurrent return attempts
    // cannot both consume the same returnable quantity.
    const reqResult=await client.query<Req>(
      "SELECT organization_id,supplier_id,number::text FROM supplier_requisitions WHERE id=$1 FOR UPDATE",
      [id],
    );
    if(!reqResult.rowCount){
      await client.query("ROLLBACK");
      return new NextResponse("Requisición no encontrada",{status:404});
    }
    const req=reqResult.rows[0];
    if(session.platformRole==="user"&&session.organizationId!==req.organization_id){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    const receipts=await client.query<Receipt>(
      `SELECT t.id,t.requisition_item_id,t.item_id,t.warehouse_id,t.quantity::text,t.unit_cost::text,
              t.lot_number,t.expires_at::text,t.cost_center,i.site_id item_site_id,ri.sku,ri.description
       FROM inventory_transactions t
       JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id AND ri.requisition_id=$1
       JOIN inventory_items i ON i.id=t.item_id AND i.organization_id=t.organization_id
       WHERE t.requisition_id=$1 AND t.type='receipt'
       ORDER BY t.movement_at,t.created_at
       FOR UPDATE OF t`,
      [id],
    );

    const returnedRows=receipts.rowCount
      ?await client.query<{receipt_transaction_id:string;quantity:string}>(
        `SELECT receipt_transaction_id,COALESCE(sum(quantity),0)::text quantity
         FROM supplier_return_items
         WHERE receipt_transaction_id=ANY($1::uuid[])
         GROUP BY receipt_transaction_id`,
        [receipts.rows.map(row=>row.id)],
      )
      :{rows:[] as {receipt_transaction_id:string;quantity:string}[]};
    const returnedByReceipt=new Map(returnedRows.rows.map(row=>[row.receipt_transaction_id,Number(row.quantity||0)]));

    const pending:{
      receipt:Receipt;qty:number;warehouseId:string;unitCost:number;
    }[]=[];

    for(const receipt of receipts.rows){
      const raw=String(form.get("return_qty_"+receipt.id)||"").trim();
      if(!raw)continue;
      const qty=Number(raw);
      if(!Number.isFinite(qty)||qty<=0){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=return_qty",request.url),303);
      }

      const alreadyReturned=returnedByReceipt.get(receipt.id)||0;
      const returnable=Math.max(0,Number(receipt.quantity)-alreadyReturned);
      if(qty>returnable+0.000001){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=return_over",request.url),303);
      }
      if(session.platformRole==="user"&&!session.accessAllSites&&receipt.item_site_id&&!session.siteIds.includes(receipt.item_site_id)){
        await client.query("ROLLBACK");
        return new NextResponse("Forbidden",{status:403});
      }

      const warehouseId=String(form.get("return_warehouse_"+receipt.id)||receipt.warehouse_id||"").trim();
      if(!UUID.test(warehouseId)){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=return_warehouse",request.url),303);
      }
      pending.push({
        receipt,qty,warehouseId,
        unitCost:Number(receipt.unit_cost||0),
      });
    }

    if(!pending.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=return_empty",request.url),303);
    }

    const warehouseIds=[...new Set(pending.map(row=>row.warehouseId))];
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
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=return_warehouse",request.url),303);
    }

    const header=await client.query<{id:string;number:string}>(
      `INSERT INTO supplier_returns(
         organization_id,supplier_id,requisition_id,reason_code,expected_resolution,reason_detail,
         document_number,returned_at,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()),$9)
       RETURNING id,number::text`,
      [
        req.organization_id,req.supplier_id,id,reasonCode,expectedResolution,reasonDetail||null,
        documentNumber||null,returnedAt||null,session.userId||null,
      ],
    );
    const returnId=header.rows[0].id;
    const returnNumber=header.rows[0].number;

    for(const row of pending){
      const item=await client.query<{id:string}>(
        `INSERT INTO supplier_return_items(
           return_id,organization_id,requisition_item_id,receipt_transaction_id,inventory_item_id,warehouse_id,quantity,unit_cost
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          returnId,req.organization_id,row.receipt.requisition_item_id,row.receipt.id,row.receipt.item_id,
          row.warehouseId,row.qty,row.unitCost,
        ],
      );
      const returnItemId=item.rows[0].id;

      await client.query(
        `INSERT INTO inventory_transactions(
           organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,movement_at,created_by,
           lot_number,expires_at,cost_center,notes,requisition_id,requisition_item_id,
           supplier_return_id,supplier_return_item_id,source_transaction_id
         ) VALUES(
           $1,$2,'supplier_return',$3,$4,$5,$6,COALESCE($7::timestamptz,now()),$8,
           $9,$10,$11,$12,$13,$14,$15,$16,$17
         )`,
        [
          req.organization_id,row.receipt.item_id,row.qty,row.unitCost,row.warehouseId,documentNumber||null,
          returnedAt||null,session.userId||null,row.receipt.lot_number,row.receipt.expires_at,row.receipt.cost_center,
          reasonDetail||reasonCode,id,row.receipt.requisition_item_id,returnId,returnItemId,row.receipt.id,
        ],
      );
    }

    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,'supplier_return.posted','supplier_return',$3,$4::jsonb)`,
      [
        req.organization_id,session.userId||null,returnId,
        JSON.stringify({
          return_number:returnNumber,
          requisition_id:id,
          requisition_number:req.number,
          supplier_id:req.supplier_id,
          reason_code:reasonCode,
          expected_resolution:expectedResolution,
          line_count:pending.length,
          total_quantity:pending.reduce((sum,row)=>sum+row.qty,0),
          document_number:documentNumber||null,
        }),
      ],
    );

    await client.query("COMMIT");
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?returned="+pending.length,request.url),303);
  }catch(error){
    await client.query("ROLLBACK");
    console.error("supplier return failed",error);
    const code=String(error).includes("Insufficient inventory stock")?"return_stock":"return";
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error="+code,request.url),303);
  }finally{
    client.release();
  }
}
