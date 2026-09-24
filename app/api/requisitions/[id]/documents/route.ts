import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { OrganizationDocumentUploadError,readOrganizationDocumentUpload } from "@/lib/organization-documents";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set(["purchase_order","delivery_note","invoice","credit_note","other"]);

type Req={organization_id:string;supplier_id:string;number:string};
type ReqItem={id:string;sku:string;description:string;unit:string;site_id:string|null;quantity_requested:string;unit_cost_estimated:string};

function target(id:string,url:string,suffix:string){
  return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?"+suffix,url),303);
}
function numberValue(raw:FormDataEntryValue|null){
  const text=String(raw||"").trim();
  if(!text)return null;
  const value=Number(text);
  return Number.isFinite(value)?value:null;
}
function moneyRound(value:number){return Math.round((value+Number.EPSILON)*100)/100;}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.reconcile"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const form=await request.formData();
  const documentType=String(form.get("document_type")||"").trim();
  const documentNumber=String(form.get("document_number")||"").trim();
  const issueDate=String(form.get("issue_date")||"").trim();
  const currencyCode=String(form.get("currency_code")||"").trim().toUpperCase();
  const notes=String(form.get("notes")||"").trim();
  const taxRaw=numberValue(form.get("tax_total"));
  const subtotalRaw=numberValue(form.get("subtotal"));
  const totalRaw=numberValue(form.get("total"));

  if(!TYPES.has(documentType)||!documentNumber||documentNumber.length>160){
    return target(id,request.url,"error=document_fields");
  }
  if(issueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)){
    return target(id,request.url,"error=document_date");
  }
  if(currencyCode&&!/^[A-Z]{3}$/.test(currencyCode)){
    return target(id,request.url,"error=document_currency");
  }
  if([taxRaw,subtotalRaw,totalRaw].some(value=>value!==null&&value<0)){
    return target(id,request.url,"error=document_amount");
  }

  let file;
  try{
    file=await readOrganizationDocumentUpload(form.get("file"));
  }catch(error){
    if(error instanceof OrganizationDocumentUploadError)return target(id,request.url,"error="+error.code);
    throw error;
  }
  if(!file)return target(id,request.url,"error=document_file");

  const client=await pool.connect();
  try{
    await client.query("BEGIN");

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

    const items=await client.query<ReqItem>(
      `SELECT id,sku,description,unit,site_id,quantity_requested::text,unit_cost_estimated::text
       FROM supplier_requisition_items
       WHERE requisition_id=$1
       ORDER BY created_at
       FOR UPDATE`,
      [id],
    );

    // Reconciliation documents represent the complete requisition. A site-limited
    // manager can only reconcile when every requisition line is inside their scope.
    if(session.platformRole==="user"&&!session.accessAllSites&&items.rows.some(item=>item.site_id&&!session.siteIds.includes(item.site_id))){
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden",{status:403});
    }

    const lines:{item:ReqItem;quantity:number;unitCost:number;lineTotal:number}[]=[];
    for(const item of items.rows){
      const qtyRaw=String(form.get("doc_qty_"+item.id)||"").trim();
      if(!qtyRaw)continue;
      const quantity=Number(qtyRaw);
      const unitCost=numberValue(form.get("doc_cost_"+item.id))??0;
      const explicitTotal=numberValue(form.get("doc_total_"+item.id));
      if(!Number.isFinite(quantity)||quantity<=0||unitCost<0||(explicitTotal!==null&&explicitTotal<0)){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_lines");
      }
      lines.push({item,quantity,unitCost,lineTotal:explicitTotal??moneyRound(quantity*unitCost)});
    }
    if(!lines.length){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_lines");
    }

    const receiptIds=[...new Set(form.getAll("receipt_id").map(value=>String(value)).filter(value=>UUID.test(value)))];
    const returnIds=[...new Set(form.getAll("return_id").map(value=>String(value)).filter(value=>UUID.test(value)))];

    if(!["delivery_note","invoice"].includes(documentType)&&receiptIds.length){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_evidence");
    }
    if(documentType!=="credit_note"&&returnIds.length){
      await client.query("ROLLBACK");
      return target(id,request.url,"error=document_evidence");
    }

    if(receiptIds.length){
      const receipts=await client.query<{id:string}>(
        `SELECT t.id
         FROM inventory_transactions t
         JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id
         WHERE t.id=ANY($1::uuid[]) AND t.requisition_id=$2 AND t.organization_id=$3 AND t.type='receipt'`,
        [receiptIds,id,req.organization_id],
      );
      if(receipts.rowCount!==receiptIds.length){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_evidence");
      }
    }

    if(returnIds.length){
      const returns=await client.query<{id:string}>(
        "SELECT id FROM supplier_returns WHERE id=ANY($1::uuid[]) AND requisition_id=$2 AND organization_id=$3 AND supplier_id=$4",
        [returnIds,id,req.organization_id,req.supplier_id],
      );
      if(returns.rowCount!==returnIds.length){
        await client.query("ROLLBACK");
        return target(id,request.url,"error=document_evidence");
      }
    }

    const linesSubtotal=moneyRound(lines.reduce((sum,line)=>sum+line.lineTotal,0));
    const subtotal=subtotalRaw??linesSubtotal;
    const tax=taxRaw??0;
    const total=totalRaw??moneyRound(subtotal+tax);

    const inserted=await client.query<{id:string}>(
      `INSERT INTO procurement_documents(
         organization_id,supplier_id,requisition_id,document_type,document_number,issue_date,currency_code,
         subtotal,tax_total,total,notes,file_data,file_mime_type,file_name,file_size_bytes,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        req.organization_id,req.supplier_id,id,documentType,documentNumber,issueDate||null,currencyCode||null,
        subtotal,tax,total,notes||null,file.bytes,file.mime,file.name,file.size,session.userId||null,
      ],
    );
    const documentId=inserted.rows[0].id;

    for(const line of lines){
      await client.query(
        `INSERT INTO procurement_document_lines(
           document_id,organization_id,requisition_item_id,sku,description,unit,quantity,unit_cost,line_total
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [documentId,req.organization_id,line.item.id,line.item.sku,line.item.description,line.item.unit,line.quantity,line.unitCost,line.lineTotal],
      );
    }

    for(const receiptId of receiptIds){
      await client.query(
        "INSERT INTO procurement_document_receipts(document_id,receipt_transaction_id,organization_id) VALUES($1,$2,$3)",
        [documentId,receiptId,req.organization_id],
      );
    }
    for(const returnId of returnIds){
      await client.query(
        "INSERT INTO procurement_document_returns(document_id,supplier_return_id,organization_id) VALUES($1,$2,$3)",
        [documentId,returnId,req.organization_id],
      );
    }

    const actorLabel=session.fullName||session.email||"Sistema";
    await client.query(
      `INSERT INTO procurement_document_events(
         organization_id,document_id,action,actor_user_id,actor_label,notes,metadata
       ) VALUES($1,$2,'uploaded',$3,$4,$5,$6::jsonb)`,
      [
        req.organization_id,documentId,session.userId||null,actorLabel,notes||null,
        JSON.stringify({document_type:documentType,document_number:documentNumber,line_count:lines.length,receipt_links:receiptIds.length,return_links:returnIds.length}),
      ],
    );
    await client.query(
      `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
       VALUES($1,$2,'procurement.document_uploaded','procurement_document',$3,$4::jsonb)`,
      [req.organization_id,session.userId||null,documentId,JSON.stringify({requisition_id:id,requisition_number:req.number,supplier_id:req.supplier_id,document_type:documentType,document_number:documentNumber})],
    );

    await client.query("COMMIT");
    return target(id,request.url,"document_saved=1");
  }catch(error){
    await client.query("ROLLBACK");
    console.error("procurement document upload failed",error);
    return target(id,request.url,"error=document");
  }finally{
    client.release();
  }
}
