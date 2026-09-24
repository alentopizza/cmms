import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=new Set(["draft","sent","approved","rejected","partial","fulfilled","closed","cancelled"]);
const LOCKED_ITEM_STATUSES=new Set(["fulfilled","closed","cancelled"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const existing=await query<{organization_id:string;status:string}>("SELECT organization_id,status FROM supplier_requisitions WHERE id=$1",[id]);
  if(!existing.rowCount)return new NextResponse("Requisición no encontrada",{status:404});
  if(session.platformRole==="user"&&session.organizationId!==existing.rows[0].organization_id)return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const status=String(form.get("status")||existing.rows[0].status);
  const notes=String(form.get("notes")||"").trim();
  const neededBy=String(form.get("needed_by")||"").trim();
  if(!STATUSES.has(status)||(neededBy&&!/^\d{4}-\d{2}-\d{2}$/.test(neededBy))){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=required",request.url),303);
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const itemRows=await client.query<{id:string;quantity_received:string}>(
      "SELECT id,quantity_received::text FROM supplier_requisition_items WHERE requisition_id=$1 ORDER BY created_at",
      [id],
    );
    const canEditItems=!LOCKED_ITEM_STATUSES.has(existing.rows[0].status);
    const removeIds=new Set(form.getAll("remove_item").map(value=>String(value)).filter(value=>UUID.test(value)));

    if(canEditItems){
      for(const item of itemRows.rows){
        if(removeIds.has(item.id)){
          if(Number(item.quantity_received)>0){
            await client.query("ROLLBACK");
            return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=received",request.url),303);
          }
          await client.query("DELETE FROM supplier_requisition_items WHERE id=$1 AND requisition_id=$2",[item.id,id]);
          continue;
        }

        const qtyRaw=form.get("qty_"+item.id);
        const costRaw=form.get("cost_"+item.id);
        if(qtyRaw===null&&costRaw===null)continue;
        const qty=Number(qtyRaw);
        const cost=Number(costRaw);
        if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(cost)||cost<0||qty<Number(item.quantity_received)){
          await client.query("ROLLBACK");
          return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=items",request.url),303);
        }
        await client.query(
          "UPDATE supplier_requisition_items SET quantity_requested=$1,unit_cost_estimated=$2 WHERE id=$3 AND requisition_id=$4",
          [qty,cost,item.id,id],
        );
      }
    }

    const remaining=await client.query<{count:string}>("SELECT count(*)::text count FROM supplier_requisition_items WHERE requisition_id=$1",[id]);
    if(Number(remaining.rows[0]?.count||0)===0){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=empty",request.url),303);
    }

    await client.query(
      `UPDATE supplier_requisitions SET
         status=$1,notes=$2,needed_by=$3,
         sent_at=CASE WHEN $1='sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
         approved_at=CASE WHEN $1='approved' AND approved_at IS NULL THEN now() ELSE approved_at END,
         fulfilled_at=CASE WHEN $1='fulfilled' AND fulfilled_at IS NULL THEN now() ELSE fulfilled_at END,
         updated_at=now()
       WHERE id=$4`,
      [status,notes||null,neededBy||null,id],
    );
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }

  return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?updated=1",request.url),303);
}
