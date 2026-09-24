import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool,query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { loadProcurementDocumentMatchForUpdate } from "@/lib/procurement-reconciliation";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function target(id:string,url:string,suffix:string){
  return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?"+suffix,url),303);
}

async function fileAccess(id:string,documentId:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const result=await query<{
    organization_id:string;file_data:Buffer;file_mime_type:string;file_name:string;voided_at:string|null;
  }>(
    `SELECT pd.organization_id,pd.file_data,pd.file_mime_type,pd.file_name,pd.voided_at::text
     FROM procurement_documents pd
     WHERE pd.id=$1 AND pd.requisition_id=$2`,
    [documentId,id],
  );
  const row=result.rows[0];
  if(!row)return null;
  if(session.platformRole==="user"&&session.organizationId!==row.organization_id)return null;
  if(session.platformRole==="user"&&!session.accessAllSites){
    const sites=await query<{site_id:string}>(
      "SELECT DISTINCT site_id FROM supplier_requisition_items WHERE requisition_id=$1 AND site_id IS NOT NULL",
      [id],
    );
    if(sites.rows.some(site=>!session.siteIds.includes(site.site_id)))return null;
  }
  return row;
}

export async function GET(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.reconcile"))return new NextResponse("Forbidden",{status:403});

  const {id,documentId}=await params;
  if(!UUID.test(id)||!UUID.test(documentId))return new NextResponse("Documento inv\u00e1lido",{status:400});
  const row=await fileAccess(id,documentId,session);
  if(!row)return new NextResponse("Documento no encontrado",{status:404});
  const safe=row.file_name.replace(/[\r\n"]/g,"_");
  const inline=new URL(request.url).searchParams.get("inline")==="1";
  return new NextResponse(new Uint8Array(row.file_data),{headers:{
    "Content-Type":row.file_mime_type,
    "Content-Length":String(row.file_data.length),
    "Content-Disposition":(inline?"inline":"attachment")+`; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.reconcile"))return new NextResponse("Forbidden",{status:403});

  const {id,documentId}=await params;
  if(!UUID.test(id)||!UUID.test(documentId))return new NextResponse("Documento inv\u00e1lido",{status:400});
  const form=await request.formData();
  const intent=String(form.get("intent")||"").trim();
  const notes=String(form.get("notes")||"").trim();

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const doc=await loadProcurementDocumentMatchForUpdate(client,documentId);
    if(!doc||doc.requisition_id!==id){
      await client.query("ROLLBACK");
      return new NextResponse("Documento no encontrado",{status:404});
    }
    if(session.platformRole==="user"&&session.organizationId!==doc.organization_id){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }
    if(session.platformRole==="user"&&!session.accessAllSites){
      const sites=await client.query<{site_id:string}>(
        "SELECT DISTINCT site_id FROM supplier_requisition_items WHERE requisition_id=$1 AND site_id IS NOT NULL",
        [id],
      );
      if(sites.rows.some(row=>!session.siteIds.includes(row.site_id))){
        await client.query("ROLLBACK");
        return new NextResponse("Forbidden",{status:403});
      }
    }
    if(doc.voided_at){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_voided");
    }

    const actorLabel=session.fullName||session.email||"Sistema";

    if(intent==="link_evidence"){
      const receiptIds=[...new Set(form.getAll("receipt_id").map(value=>String(value)).filter(value=>UUID.test(value)))];
      const returnIds=[...new Set(form.getAll("return_id").map(value=>String(value)).filter(value=>UUID.test(value)))];
      if(!receiptIds.length&&!returnIds.length){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_evidence_empty");
      }
      if(!["delivery_note","invoice"].includes(doc.document_type)&&receiptIds.length){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_evidence");
      }
      if(doc.document_type!=="credit_note"&&returnIds.length){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_evidence");
      }

      if(receiptIds.length){
        const valid=await client.query<{id:string}>(
          "SELECT id FROM inventory_transactions WHERE id=ANY($1::uuid[]) AND organization_id=$2 AND requisition_id=$3 AND type='receipt'",
          [receiptIds,doc.organization_id,id],
        );
        if(valid.rowCount!==receiptIds.length){
          await client.query("ROLLBACK");
          return target(id,request.url,"error=document_evidence");
        }
      }
      if(returnIds.length){
        const valid=await client.query<{id:string}>(
          "SELECT id FROM supplier_returns WHERE id=ANY($1::uuid[]) AND organization_id=$2 AND requisition_id=$3 AND supplier_id=$4",
          [returnIds,doc.organization_id,id,doc.supplier_id],
        );
        if(valid.rowCount!==returnIds.length){
          await client.query("ROLLBACK");
          return target(id,request.url,"error=document_evidence");
        }
      }

      let insertedLinks=0;
      for(const receiptId of receiptIds){
        const inserted=await client.query(
          `INSERT INTO procurement_document_receipts(document_id,receipt_transaction_id,organization_id)
           VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [documentId,receiptId,doc.organization_id],
        );
        insertedLinks+=inserted.rowCount||0;
      }
      for(const returnId of returnIds){
        const inserted=await client.query(
          `INSERT INTO procurement_document_returns(document_id,supplier_return_id,organization_id)
           VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [documentId,returnId,doc.organization_id],
        );
        insertedLinks+=inserted.rowCount||0;
      }
      if(!insertedLinks){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_evidence_duplicate");
      }

      await client.query(
        `UPDATE procurement_documents SET
           review_status='pending',review_notes=NULL,reviewed_at=NULL,reviewed_by=NULL
         WHERE id=$1`,
        [documentId],
      );
      await client.query(
        `INSERT INTO procurement_document_events(
           organization_id,document_id,action,actor_user_id,actor_label,notes,metadata
         ) VALUES($1,$2,'evidence_linked',$3,$4,$5,$6::jsonb)`,
        [doc.organization_id,documentId,session.userId||null,actorLabel,notes||null,JSON.stringify({receipt_links:receiptIds.length,return_links:returnIds.length,review_before:doc.review_status})],
      );
      await client.query(
        `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
         VALUES($1,$2,'procurement.evidence_linked','procurement_document',$3,$4::jsonb)`,
        [doc.organization_id,session.userId||null,documentId,JSON.stringify({requisition_id:id,receipt_links:receiptIds.length,return_links:returnIds.length})],
      );
      await client.query("COMMIT");
      return target(id,request.url,"document_linked="+insertedLinks);
    }

    if(intent==="void"){
      if(!notes){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_void_reason");
      }
      await client.query(
        "UPDATE procurement_documents SET voided_at=now(),voided_by=$1,void_reason=$2 WHERE id=$3",
        [session.userId||null,notes,documentId],
      );
      await client.query(
        `INSERT INTO procurement_document_events(organization_id,document_id,action,actor_user_id,actor_label,notes,metadata)
         VALUES($1,$2,'voided',$3,$4,$5,$6::jsonb)`,
        [doc.organization_id,documentId,session.userId||null,actorLabel,notes,JSON.stringify({match_state:doc.match_state,review_status:doc.review_status})],
      );
      await client.query(
        `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
         VALUES($1,$2,'procurement.document_voided','procurement_document',$3,$4::jsonb)`,
        [doc.organization_id,session.userId||null,documentId,JSON.stringify({requisition_id:id,reason:notes})],
      );
      await client.query("COMMIT");
      return target(id,request.url,"document_review=voided");
    }

    const reviewAction=intent==="verify"?"verified":intent==="accept_exception"?"exception_accepted":intent==="dispute"?"disputed":"";
    if(!reviewAction){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_action");
    }
    if(reviewAction==="verified"&&doc.match_state!=="matched"){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_verify_match");
    }
    if(reviewAction==="exception_accepted"&&doc.match_state!=="difference"){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_exception_state");
    }
    if((reviewAction==="exception_accepted"||reviewAction==="disputed")&&!notes){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_review_notes");
    }

    await client.query(
      `UPDATE procurement_documents SET
         review_status=$1,review_notes=$2,reviewed_at=now(),reviewed_by=$3
       WHERE id=$4`,
      [reviewAction,notes||null,session.userId||null,documentId],
    );
    await client.query(
      `INSERT INTO procurement_document_events(
         organization_id,document_id,action,actor_user_id,actor_label,notes,metadata
       ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        doc.organization_id,documentId,reviewAction,session.userId||null,actorLabel,notes||null,
        JSON.stringify({match_state:doc.match_state,quantity_difference:doc.quantity_difference,value_difference:doc.value_difference}),
      ],
    );
    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,'procurement_document',$4,$5::jsonb)`,
      [
        doc.organization_id,session.userId||null,"procurement.document_"+reviewAction,documentId,
        JSON.stringify({requisition_id:id,match_state:doc.match_state,notes:notes||null}),
      ],
    );

    await client.query("COMMIT");
    return target(id,request.url,"document_review="+reviewAction);
  }catch(error){
    await client.query("ROLLBACK");
    console.error("procurement document action failed",error);
    return target(id,request.url,"error=document_action_failed");
  }finally{
    client.release();
  }
}
