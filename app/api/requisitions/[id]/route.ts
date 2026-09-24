import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=new Set(["draft","sent","approved","rejected","partial","fulfilled","closed","cancelled"]);
const LOCKED_ITEM_STATUSES=new Set(["fulfilled","closed","cancelled"]);

type Existing={
  organization_id:string;
  status:string;
  needed_by:string|null;
  approval_required:boolean;
  approval_state:"not_required"|"pending"|"approved"|"rejected";
};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const existing=await query<Existing>(
    `SELECT organization_id,status,needed_by::text,approval_required,approval_state
     FROM supplier_requisitions WHERE id=$1`,
    [id],
  );
  if(!existing.rowCount)return new NextResponse("Requisición no encontrada",{status:404});
  const current=existing.rows[0];
  if(session.platformRole==="user"&&session.organizationId!==current.organization_id)return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const status=String(form.get("status")||current.status);
  const notes=String(form.get("notes")||"").trim();
  const neededBy=String(form.get("needed_by")||"").trim();
  if(!STATUSES.has(status)||(neededBy&&!/^\d{4}-\d{2}-\d{2}$/.test(neededBy))){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=required",request.url),303);
  }
  // Approved/rejected are approval decisions, never ordinary editable lifecycle values.
  if(["approved","rejected"].includes(status)&&status!==current.status){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval_route",request.url),303);
  }
  if(["closed","cancelled"].includes(current.status)&&status!==current.status){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=status_locked",request.url),303);
  }
  if(current.status==="fulfilled"&&!["fulfilled","closed"].includes(status)){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=status_locked",request.url),303);
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const itemRows=await client.query<{
      id:string;quantity_requested:string;quantity_received:string;unit_cost_estimated:string;
    }>(
      `SELECT id,quantity_requested::text,quantity_received::text,unit_cost_estimated::text
       FROM supplier_requisition_items WHERE requisition_id=$1 ORDER BY created_at FOR UPDATE`,
      [id],
    );
    const canEditItems=!LOCKED_ITEM_STATUSES.has(current.status);
    const removeIds=new Set(form.getAll("remove_item").map(value=>String(value)).filter(value=>UUID.test(value)));
    let approvalRelevantChange=(neededBy||null)!==(current.needed_by||null);

    if(canEditItems){
      for(const item of itemRows.rows){
        if(removeIds.has(item.id)){
          if(Number(item.quantity_received)>0){
            await client.query("ROLLBACK");
            return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=received",request.url),303);
          }
          approvalRelevantChange=true;
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
        if(Math.abs(qty-Number(item.quantity_requested))>0.000001||Math.abs(cost-Number(item.unit_cost_estimated))>0.000001){
          approvalRelevantChange=true;
        }
        await client.query(
          "UPDATE supplier_requisition_items SET quantity_requested=$1,unit_cost_estimated=$2 WHERE id=$3 AND requisition_id=$4",
          [qty,cost,item.id,id],
        );
      }
    }

    const remaining=await client.query<{count:string;has_received:boolean}>(
      `SELECT count(*)::text count,
              EXISTS(SELECT 1 FROM supplier_requisition_items WHERE requisition_id=$1 AND quantity_received>0) has_received
       FROM supplier_requisition_items WHERE requisition_id=$1`,
      [id],
    );
    if(Number(remaining.rows[0]?.count||0)===0){
      await client.query("ROLLBACK");
      return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=empty",request.url),303);
    }
    const hasReceived=Boolean(remaining.rows[0]?.has_received);

    if(status==="fulfilled"){
      const pending=await client.query<{count:string}>(
        "SELECT count(*)::text count FROM supplier_requisition_items WHERE requisition_id=$1 AND quantity_received+0.000001 < quantity_requested",
        [id],
      );
      if(Number(pending.rows[0]?.count||0)>0){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=fulfillment",request.url),303);
      }
    }

    const reopenApproval=current.approval_required
      &&approvalRelevantChange
      &&["approved","rejected"].includes(current.approval_state);

    if(current.approval_required&&!reopenApproval){
      const allowedByApprovalState=current.approval_state==="pending"
        ?new Set(hasReceived?["partial","cancelled"]:["sent","cancelled"])
        :current.approval_state==="rejected"
          ?new Set(hasReceived?["partial","cancelled"]:["rejected","cancelled"])
          :current.approval_state==="approved"
            ?new Set([current.status,"closed","cancelled"])
            :null;
      if(allowedByApprovalState&&!allowedByApprovalState.has(status)){
        await client.query("ROLLBACK");
        return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=approval_locked",request.url),303);
      }
    }

    if(reopenApproval){
      const nextStatus=hasReceived?"partial":"sent";
      await client.query(
        `UPDATE supplier_requisitions SET
           status=$1,notes=$2,needed_by=$3,
           approval_state='pending',
           approval_requested_at=now(),
           approval_decided_at=NULL,
           approval_decided_by=NULL,
           approval_decision_notes=NULL,
           sent_at=COALESCE(sent_at,now()),
           updated_at=now()
         WHERE id=$4`,
        [nextStatus,notes||null,neededBy||null,id],
      );
      const actorLabel=session.fullName||session.email||"Sistema";
      await client.query(
        `INSERT INTO supplier_requisition_approval_events(
           organization_id,requisition_id,actor_user_id,actor_label,action,from_state,to_state,notes,metadata
         ) VALUES($1,$2,$3,$4,'reopened',$5,'pending',$6,$7::jsonb)`,
        [
          current.organization_id,id,session.userId||null,actorLabel,current.approval_state,
          "La requisición cambió después de una decisión y requiere nueva aprobación.",
          JSON.stringify({reason:"requisition_changed",status_before:current.status,status_after:nextStatus}),
        ],
      );
      await client.query(
        `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
         VALUES($1,$2,'requisition.approval_reopened','supplier_requisition',$3,$4::jsonb)`,
        [
          current.organization_id,session.userId||null,id,
          JSON.stringify({approval_state_before:current.approval_state,status_before:current.status,status_after:nextStatus}),
        ],
      );
    }else{
      await client.query(
        `UPDATE supplier_requisitions SET
           status=$1,notes=$2,needed_by=$3,
           sent_at=CASE WHEN $1='sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
           fulfilled_at=CASE WHEN $1='fulfilled' AND fulfilled_at IS NULL THEN now() ELSE fulfilled_at END,
           updated_at=now()
         WHERE id=$4`,
        [status,notes||null,neededBy||null,id],
      );
      if(current.approval_required&&approvalRelevantChange&&current.approval_state==="pending"){
        const actorLabel=session.fullName||session.email||"Sistema";
        await client.query(
          `INSERT INTO supplier_requisition_approval_events(
             organization_id,requisition_id,actor_user_id,actor_label,action,from_state,to_state,notes,metadata
           ) VALUES($1,$2,$3,$4,'amended','pending','pending',$5,$6::jsonb)`,
          [
            current.organization_id,id,session.userId||null,actorLabel,
            "La requisición cambió mientras esperaba aprobación.",
            JSON.stringify({reason:"pending_requisition_changed",status_before:current.status,status_after:status}),
          ],
        );
        await client.query(
          `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
           VALUES($1,$2,'requisition.pending_amended','supplier_requisition',$3,$4::jsonb)`,
          [
            current.organization_id,session.userId||null,id,
            JSON.stringify({status_before:current.status,status_after:status}),
          ],
        );
      }
    }

    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }

  return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?updated=1",request.url),303);
}
